// Gate-based queue logic — Batch notification & promotion system
//
// System:
//   Top 10 (positions 1–10): Station capacity
//   Gate   (positions 11–15): Batch notified, promote when checked-in
//   Outside (16+): Waiting
//
// KEY NOTE: All Firestore queries use ONLY ONE where clause (stationId).
// Firestore requires composite indexes for compound queries — since none are
// defined, we fetch by stationId only and filter/sort in JavaScript.
//
import {
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    doc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';

// ─── Constants ──────────────────────────────────────────────────────────────
export const BATCH_SIZE = 5;
export const TOP_N = 10;
export const GATE_START = TOP_N + 1;       // 11
export const GATE_END = TOP_N + BATCH_SIZE; // 15
const DEFAULT_REFILL_MIN = 3;
const MAX_SKIP_COUNT = 3;

const ACTIVE_STATUSES = ['waiting', 'eligible', 'checked_in', 'fueling'];

// ─── Helper: milliseconds from Firestore timestamp ──────────────────────────
const toMillis = (ts) => {
    if (!ts) return null;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    return null;
};

// ─── Helper: fetch ALL bookings for a station, filter & sort in JS ──────────
// Uses ONLY stationId in the query — no composite index required.
export const fetchActiveBookings = async (stationId) => {
    const snap = await getDocs(
        query(
            collection(db, COLLECTIONS.BOOKINGS),
            where('stationId', '==', stationId)
        )
    );
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => ACTIVE_STATUSES.includes(b.status))
        .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
};

// ─── Avg refill time ─────────────────────────────────────────────────────────
const AVG_CACHE = {};
const fetchAvgRefillMs = async (stationId) => {
    if (AVG_CACHE[stationId] !== undefined) return AVG_CACHE[stationId];
    try {
        const since = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
        // Only one where clause — filter completed & date in JS
        const snap = await getDocs(
            query(collection(db, COLLECTIONS.BOOKINGS), where('stationId', '==', stationId))
        );
        let total = 0, count = 0;
        snap.forEach(d => {
            const { status, fuelingStartedAt, completedAt } = d.data();
            if (status !== 'completed') return;
            const completedMs = toMillis(completedAt);
            if (!completedMs || completedMs < since.toMillis()) return;
            const startMs = toMillis(fuelingStartedAt);
            if (!startMs) return;
            const ms = completedMs - startMs;
            if (ms > 0 && ms < 30 * 60 * 1000) { total += ms; count++; }
        });
        const avg = count > 0 ? Math.max(60_000, total / count) : DEFAULT_REFILL_MIN * 60_000;
        AVG_CACHE[stationId] = avg;
        return avg;
    } catch {
        AVG_CACHE[stationId] = DEFAULT_REFILL_MIN * 60_000;
        return DEFAULT_REFILL_MIN * 60_000;
    }
};

export const getGraceDurationMs = async (stationId) => {
    const avgMs = await fetchAvgRefillMs(stationId);
    return BATCH_SIZE * avgMs;
};

// ─── Send batch notification to gate zone ────────────────────────────────────
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
            { stationId, bookingId: b.id, vehicleNumber: b.vehicleNumber, queuePosition: b.queuePosition }
        )
    ));
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
 * Main gate evaluation — recompacts positions, promotes fueling, notifies batch.
 * Called after: check-in, queue advance, skip, no-show.
 *
 * IMPORTANT: Uses single-field Firestore queries only (stationId).
 * All filtering and sorting is done in JavaScript.
 */
export const evaluateGate = async (stationId) => {
    try {
        let bookings = await fetchActiveBookings(stationId);
        if (bookings.length === 0) return;

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

        if (expiredIds.length > 0) {
            const maxPos = Math.max(...bookings.map(b => b.queuePosition));
            let offset = 1;
            const expBatch = writeBatch(db);

            expiredIds.forEach(id => {
                const b = bookings.find(bk => bk.id === id);
                const newSkipCount = (b.skipCount || 0) + 1;
                if (newSkipCount >= MAX_SKIP_COUNT) {
                    expBatch.update(doc(db, COLLECTIONS.BOOKINGS, id), {
                        status: 'no_show',
                        skippedAt: serverTimestamp(),
                        skipReason: 'grace_expired_auto',
                        skipCount: newSkipCount,
                        gateNotifiedAt: null,
                        updatedAt: serverTimestamp()
                    });
                    createNotification(b.customerId, NOTIF_TYPE.BOOKING_NO_SHOW,
                        '🚫 Booking Cancelled — No Show',
                        `Your booking for ${b.vehicleNumber} was cancelled after ${MAX_SKIP_COUNT} missed check-ins.`,
                        { stationId, bookingId: id, vehicleNumber: b.vehicleNumber }
                    );
                } else {
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
                    createNotification(b.customerId, NOTIF_TYPE.VEHICLE_SKIPPED,
                        '⏭️ Turn Skipped — Check-in Expired',
                        `You didn't check-in in time. Vehicle ${b.vehicleNumber} moved to end of queue (${newSkipCount}/${MAX_SKIP_COUNT}).`,
                        { stationId, bookingId: id, vehicleNumber: b.vehicleNumber, skipCount: newSkipCount }
                    );
                }
            });

            await expBatch.commit();
            // Re-fetch after expiry (single where clause)
            bookings = await fetchActiveBookings(stationId);
        }

        if (bookings.length === 0) return;

        // ── Step 2: Recompact — Priority: fueling → checked_in → eligible → waiting ──
        const fueling   = bookings.filter(b => b.status === 'fueling');
        const checkedIn = bookings.filter(b => b.status === 'checked_in' || (b.isCheckedIn && b.status !== 'fueling'));
        const eligible  = bookings.filter(b => b.status === 'eligible' && !b.isCheckedIn);
        const waiting   = bookings.filter(b => b.status === 'waiting'  && !b.isCheckedIn);

        checkedIn.sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
        eligible.sort((a, b)  => (a.queuePosition || 0) - (b.queuePosition || 0));
        waiting.sort((a, b)   => (a.queuePosition || 0) - (b.queuePosition || 0));

        const sorted = [...fueling, ...checkedIn, ...eligible, ...waiting];

        // ── Step 3: Assign compacted positions & statuses ────────────────────
        const wb = writeBatch(db);
        let nextFuelingId = null;
        const hasFueling = fueling.length > 0;

        sorted.forEach((booking, index) => {
            const newPos = index + 1;
            let newStatus;

            if (booking.status === 'fueling') {
                newStatus = 'fueling';
                nextFuelingId = booking.id;
            } else if (!hasFueling && index === 0 && (booking.isCheckedIn || booking.status === 'checked_in')) {
                // First vehicle is checked-in and no one is fueling → promote to fueling
                newStatus = 'fueling';
                nextFuelingId = booking.id;
                createNotification(
                    booking.customerId,
                    NOTIF_TYPE.TURN_ARRIVED,
                    '🚨 Your Turn Has Arrived!',
                    `Vehicle ${booking.vehicleNumber} is at the pump. Please proceed for fueling.`,
                    { stationId, vehicleNumber: booking.vehicleNumber, bookingId: booking.id }
                );
            } else if (newPos <= GATE_END) {
                newStatus = (booking.isCheckedIn || booking.status === 'checked_in')
                    ? 'checked_in'
                    : 'eligible';
            } else {
                newStatus = 'waiting';
            }

            const updates = {
                queuePosition: newPos,
                status: newStatus,
                estimatedWaitMinutes: (newPos - 1) * DEFAULT_REFILL_MIN,
                updatedAt: serverTimestamp()
            };
            if (newStatus === 'fueling' && booking.status !== 'fueling') {
                updates.fuelingStartedAt = serverTimestamp();
            }
            if ((newStatus === 'eligible' || newStatus === 'checked_in') && !booking.eligibleAt) {
                updates.eligibleAt = serverTimestamp();
            }

            wb.update(doc(db, COLLECTIONS.BOOKINGS, booking.id), updates);
        });

        // ── Step 4: Update station document (single where clause) ────────────
        const stationSnap = await getDocs(
            query(collection(db, COLLECTIONS.STATIONS), where('stationId', '==', stationId))
        );
        if (!stationSnap.empty) {
            wb.update(doc(db, COLLECTIONS.STATIONS, stationSnap.docs[0].id), {
                currentVehicleId: nextFuelingId || null,
                updatedAt: serverTimestamp()
            });
        }

        await wb.commit();
        console.log(`[evaluateGate] ✅ Compacted ${sorted.length} bookings for station ${stationId}`);

        // ── Step 5: Notify gate zone (11–15) if needed ──────────────────────
        const gateVehicles = sorted.filter(
            b => b.queuePosition >= GATE_START
                && b.queuePosition <= GATE_END
                && !b.isCheckedIn
                && b.status !== 'checked_in'
                && b.status !== 'fueling'
                && !b.gateNotifiedAt
        );
        if (gateVehicles.length > 0) {
            const freshBookings = await fetchActiveBookings(stationId);
            await notifyBatch(freshBookings, GATE_START, GATE_END, stationId);
        }

    } catch (err) {
        console.error('[GateLogic] evaluateGate error:', err);
    }
};
