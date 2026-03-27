// Gate-based queue logic — Batch notification & promotion system
// Replaces laneLogic.js with a cleaner batch-based approach
//
// System:
//   Top 10 (positions 1–10): Checked-in at station, served in booking order (FCFS)
//   Gate   (positions 11–15): Batch notified, grace window, promoted when checked-in
//   Outside (16+): Waiting for their batch notification
//
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    writeBatch,
    doc,
    updateDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';

// ─── Constants ──────────────────────────────────────────────────────────────
export const BATCH_SIZE = 5;               // Notify 5 vehicles at a time
export const TOP_N = 10;                   // Station capacity (checked-in vehicles)
export const GATE_START = TOP_N + 1;       // 11
export const GATE_END = TOP_N + BATCH_SIZE; // 15
const DEFAULT_REFILL_MIN = 3;              // Fallback minutes per vehicle
const MAX_SKIP_COUNT = 3;                  // Auto no-show after 3 skips

// ─── Helper: extract milliseconds from a Firestore timestamp ────────────────
const toMillis = (ts) => {
    if (!ts) return null;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    return null;
};

// ─── Avg refill time (for grace window calculation) ─────────────────────────
const AVG_CACHE = {};

const fetchAvgRefillMs = async (stationId) => {
    if (AVG_CACHE[stationId] !== undefined) return AVG_CACHE[stationId];

    try {
        const since = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const snap = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', '==', 'completed'),
                where('completedAt', '>=', since)
            )
        );

        let total = 0, count = 0;
        snap.forEach(d => {
            const { fuelingStartedAt, completedAt } = d.data();
            if (fuelingStartedAt?.toMillis && completedAt?.toMillis) {
                const ms = completedAt.toMillis() - fuelingStartedAt.toMillis();
                if (ms > 0 && ms < 30 * 60 * 1000) { total += ms; count++; }
            }
        });

        const avg = count > 0
            ? Math.max(60_000, total / count) // minimum 1 min
            : DEFAULT_REFILL_MIN * 60_000;
        AVG_CACHE[stationId] = avg;
        return avg;
    } catch {
        AVG_CACHE[stationId] = DEFAULT_REFILL_MIN * 60_000;
        return DEFAULT_REFILL_MIN * 60_000;
    }
};

/**
 * Calculate grace duration (ms) for a batch.
 * Grace = BATCH_SIZE × avgRefillTime
 * This gives the batch enough time — roughly until the last person's ETA.
 *
 * @param {string} stationId
 * @returns {Promise<number>} grace duration in milliseconds
 */
export const getGraceDurationMs = async (stationId) => {
    const avgMs = await fetchAvgRefillMs(stationId);
    return BATCH_SIZE * avgMs; // e.g. 5 × 3 min = 15 min
};

/**
 * Send batch notification to a group of vehicles (by position range).
 *
 * @param {Array}  bookings  — all active bookings (already fetched)
 * @param {number} startPos  — first position to notify (inclusive)
 * @param {number} endPos    — last position to notify (inclusive)
 * @param {string} stationId — for notification metadata
 */
export const notifyBatch = async (bookings, startPos, endPos, stationId) => {
    const batch = bookings.filter(
        b => b.queuePosition >= startPos
            && b.queuePosition <= endPos
            && !b.isCheckedIn
            && b.status !== 'checked_in'
            && b.status !== 'fueling'
    );

    await Promise.all(batch.map(b =>
        createNotification(
            b.customerId,
            NOTIF_TYPE.PRE_ARRIVAL_ALERT,
            '🚗 Your Turn is Approaching!',
            `You are #${b.queuePosition} in queue. Please head to the station and check-in now.`,
            {
                stationId,
                bookingId: b.id,
                vehicleNumber: b.vehicleNumber,
                queuePosition: b.queuePosition
            }
        )
    ));

    // Mark these bookings as notified (set notifiedAt timestamp)
    if (batch.length > 0) {
        const wb = writeBatch(db);
        batch.forEach(b => {
            wb.update(doc(db, COLLECTIONS.BOOKINGS, b.id), {
                gateNotifiedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        });
        await wb.commit();
    }
};

/**
 * Main gate evaluation — call after check-in, queue advance, skip, or no-show.
 *
 * Logic:
 *   1. Fetch all active bookings sorted by queuePosition
 *   2. Count how many spots are available in top 10
 *   3. Among positions 11+, find checked-in vehicles (booking order)
 *   4. Promote them to fill open spots
 *   5. Expire vehicles in gate zone whose grace window has passed
 *   6. Recompact all positions (1, 2, 3, ...)
 *   7. Auto-promote position #1 to 'fueling' if no one is fueling & they're checked-in
 *   8. Notify next batch if needed
 *
 * @param {string} stationId — station ID (field value)
 */
export const evaluateGate = async (stationId) => {
    try {
        const snap = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling']),
                orderBy('queuePosition', 'asc')
            )
        );

        if (snap.empty) return;

        let bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // ── Step 1: Expire gate-notified vehicles whose grace window passed ──
        const graceDuration = await getGraceDurationMs(stationId);
        const now = Date.now();
        const expiredIds = [];

        bookings.forEach(b => {
            if (
                b.queuePosition > TOP_N
                && b.gateNotifiedAt
                && !b.isCheckedIn
                && b.status !== 'checked_in'
                && b.status !== 'fueling'
            ) {
                const notifiedMs = toMillis(b.gateNotifiedAt);
                if (notifiedMs && (now - notifiedMs) > graceDuration) {
                    expiredIds.push(b.id);
                }
            }
        });

        // Move expired vehicles to end of queue
        if (expiredIds.length > 0) {
            const maxPos = Math.max(...bookings.map(b => b.queuePosition));
            let offset = 1;
            const expBatch = writeBatch(db);

            expiredIds.forEach(id => {
                const b = bookings.find(bk => bk.id === id);
                const newSkipCount = (b.skipCount || 0) + 1;

                if (newSkipCount >= MAX_SKIP_COUNT) {
                    // Auto no-show (3 strikes)
                    expBatch.update(doc(db, COLLECTIONS.BOOKINGS, id), {
                        status: 'no_show',
                        skippedAt: serverTimestamp(),
                        skipReason: 'grace_expired_auto',
                        skipCount: newSkipCount,
                        gateNotifiedAt: null,
                        updatedAt: serverTimestamp()
                    });
                    // Notify customer
                    createNotification(
                        b.customerId,
                        NOTIF_TYPE.BOOKING_NO_SHOW,
                        '🚫 Booking Cancelled — No Show',
                        `Your booking for ${b.vehicleNumber} was cancelled after ${MAX_SKIP_COUNT} missed check-ins.`,
                        { stationId, bookingId: id, vehicleNumber: b.vehicleNumber }
                    );
                } else {
                    // Skip to end
                    expBatch.update(doc(db, COLLECTIONS.BOOKINGS, id), {
                        queuePosition: maxPos + offset,
                        status: 'waiting',
                        skipCount: newSkipCount,
                        skippedAt: serverTimestamp(),
                        skipReason: 'grace_expired',
                        gateNotifiedAt: null,
                        updatedAt: serverTimestamp()
                    });
                    offset++;
                    // Notify customer
                    createNotification(
                        b.customerId,
                        NOTIF_TYPE.VEHICLE_SKIPPED,
                        '⏭️ Turn Skipped — Check-in Expired',
                        `You didn't check-in in time. Vehicle ${b.vehicleNumber} moved to end of queue (${newSkipCount}/${MAX_SKIP_COUNT}).`,
                        { stationId, bookingId: id, vehicleNumber: b.vehicleNumber, skipCount: newSkipCount }
                    );
                }
            });

            await expBatch.commit();

            // Re-fetch bookings after expiry
            const snap2 = await getDocs(
                query(
                    collection(db, COLLECTIONS.BOOKINGS),
                    where('stationId', '==', stationId),
                    where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling']),
                    orderBy('queuePosition', 'asc')
                )
            );
            bookings = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        if (bookings.length === 0) return;

        // ── Step 2: Recompact positions (remove gaps) ───────────────────────
        // Keep fueling at top, then checked_in by queuePosition, then eligible, then waiting
        const fueling = bookings.filter(b => b.status === 'fueling');
        const checkedIn = bookings.filter(b => b.status === 'checked_in' || (b.isCheckedIn && b.status !== 'fueling'));
        const rest = bookings.filter(b => b.status !== 'fueling' && b.status !== 'checked_in' && !b.isCheckedIn);

        // Checked-in sorted by booking order (queuePosition)
        checkedIn.sort((a, b) => a.queuePosition - b.queuePosition);
        // Rest sorted by booking order
        rest.sort((a, b) => a.queuePosition - b.queuePosition);

        const sorted = [...fueling, ...checkedIn, ...rest];

        // ── Step 3: Assign compacted positions & determine statuses ─────────
        const wb = writeBatch(db);
        let nextFuelingId = null;
        const hasFueling = fueling.length > 0;

        sorted.forEach((booking, index) => {
            const newPos = index + 1;
            let newStatus;

            if (booking.status === 'fueling') {
                // Keep fueling status
                newStatus = 'fueling';
                nextFuelingId = booking.id;
            } else if (!hasFueling && index === 0 && (booking.isCheckedIn || booking.status === 'checked_in')) {
                // No one fueling & this is first checked-in → promote to fueling!
                newStatus = 'fueling';
                nextFuelingId = booking.id;
                // Notify customer
                createNotification(
                    booking.customerId,
                    NOTIF_TYPE.TURN_ARRIVED,
                    '🚨 Your Turn Has Arrived!',
                    `Vehicle ${booking.vehicleNumber} is at the pump. Please proceed for fueling.`,
                    { stationId, vehicleNumber: booking.vehicleNumber, bookingId: booking.id }
                );
            } else if (newPos <= GATE_END) {
                // Positions 1–15: eligible zone (can check-in)
                newStatus = (booking.isCheckedIn || booking.status === 'checked_in')
                    ? 'checked_in'
                    : 'eligible';
            } else {
                // 16+: waiting
                newStatus = 'waiting';
            }

            const updates = {
                queuePosition: newPos,
                status: newStatus,
                estimatedWaitMinutes: (newPos - 1) * DEFAULT_REFILL_MIN,
                updatedAt: serverTimestamp()
            };

            // Set fuelingStartedAt if newly promoted to fueling
            if (newStatus === 'fueling' && booking.status !== 'fueling') {
                updates.fuelingStartedAt = serverTimestamp();
            }

            // Set eligibleAt if newly entering eligible zone
            if ((newStatus === 'eligible' || newStatus === 'checked_in') && !booking.eligibleAt) {
                updates.eligibleAt = serverTimestamp();
            }

            wb.update(doc(db, COLLECTIONS.BOOKINGS, booking.id), updates);
        });

        // ── Step 4: Update station document ─────────────────────────────────
        const stationQuery = query(
            collection(db, COLLECTIONS.STATIONS),
            where('stationId', '==', stationId)
        );
        const stationSnapshot = await getDocs(stationQuery);
        if (!stationSnapshot.empty) {
            const stationDocId = stationSnapshot.docs[0].id;
            wb.update(doc(db, COLLECTIONS.STATIONS, stationDocId), {
                currentVehicleId: nextFuelingId || null,
                updatedAt: serverTimestamp()
            });
        }

        await wb.commit();

        // ── Step 5: Send batch notification to gate zone (11–15) ────────────
        // Only notify vehicles that haven't been notified yet
        const gateVehicles = sorted.filter(
            b => b.queuePosition >= GATE_START
                && b.queuePosition <= GATE_END
                && !b.isCheckedIn
                && b.status !== 'checked_in'
                && b.status !== 'fueling'
                && !b.gateNotifiedAt
        );

        if (gateVehicles.length > 0) {
            // Re-fetch to get updated positions
            const freshSnap = await getDocs(
                query(
                    collection(db, COLLECTIONS.BOOKINGS),
                    where('stationId', '==', stationId),
                    where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling']),
                    orderBy('queuePosition', 'asc')
                )
            );
            const freshBookings = freshSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            await notifyBatch(freshBookings, GATE_START, GATE_END, stationId);
        }

    } catch (err) {
        console.error('[GateLogic] evaluateGate error:', err);
    }
};
