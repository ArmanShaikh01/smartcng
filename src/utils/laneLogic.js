// Lane-priority queue logic utilities
// Handles physical lane ordering: checked-in vehicles served by arrival time
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    writeBatch,
    doc,
    updateDoc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';

// ─── Constants ──────────────────────────────────────────────────────────
const CHECK_IN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const EXPIRY_EXEMPT_LANE_POS = 3;          // top 3 lane positions exempt from expiry

// ─── Helper: extract milliseconds from a Firestore timestamp ────────────
const toMillis = (ts) => {
    if (!ts) return Infinity;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds) return ts.seconds * 1000;
    return Infinity;
};

/**
 * Pure sorting function – returns bookings in lane-priority order.
 *
 * Priority:
 *   1. FUELING vehicles (keep at top, should be max 1)
 *   2. CHECKED_IN vehicles – sorted by checkedInAt (earliest = closest to pump)
 *   3. ELIGIBLE vehicles (top 10, not checked in) – sorted by queuePosition
 *   4. WAITING vehicles (position > 10) – sorted by queuePosition
 *
 * @param {Array} bookings – array of booking objects (must have status, isCheckedIn, checkedInAt, queuePosition)
 * @returns {Array} sorted array in serving order
 */
export const getLaneOrder = (bookings) => {
    const fueling = bookings
        .filter(b => b.status === 'fueling')
        .sort((a, b) => a.queuePosition - b.queuePosition);

    const checkedIn = bookings
        .filter(b => b.status !== 'fueling' && (b.isCheckedIn === true || b.status === 'checked_in'))
        .sort((a, b) => {
            const aTime = toMillis(a.checkedInAt);
            const bTime = toMillis(b.checkedInAt);
            return aTime !== bTime ? aTime - bTime : a.queuePosition - b.queuePosition;
        });

    const eligible = bookings
        .filter(b => b.status !== 'fueling' && !b.isCheckedIn && b.status !== 'checked_in'
            && (b.status === 'eligible' || b.queuePosition <= 10))
        .sort((a, b) => a.queuePosition - b.queuePosition);

    const waiting = bookings
        .filter(b => b.status !== 'fueling' && !b.isCheckedIn && b.status !== 'checked_in'
            && b.status !== 'eligible' && b.queuePosition > 10)
        .sort((a, b) => a.queuePosition - b.queuePosition);

    return [...fueling, ...checkedIn, ...eligible, ...waiting];
};

/**
 * Recalculate lanePosition for every active booking at a station.
 * Call this after check-in, skip, or any event that changes lane order.
 * 
 * Logic:
 *   1. Fetch all active bookings
 *   2. Sort using getLaneOrder()
 *   3. If no one is currently 'fueling' and the first one is 'checked_in', promote it!
 *
 * @param {string} stationId – station ID (field value)
 */
export const recalculateLanePositions = async (stationId) => {
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

        const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sorted = getLaneOrder(bookings);

        // Check if anyone is currently fueling
        const currentFueling = sorted.find(b => b.status === 'fueling');

        const batch = writeBatch(db);
        sorted.forEach((booking, index) => {
            const newLanePos = index + 1;
            let updates = {};

            // If no one is fueling, and this is the first (checked-in) one, start fueling!
            if (!currentFueling && index === 0 && (booking.isCheckedIn || booking.status === 'checked_in')) {
                updates.status = 'fueling';
                updates.fuelingStartedAt = serverTimestamp();

                // Also notify the customer that they can now proceed
                createNotification(
                    booking.customerId,
                    NOTIF_TYPE.TURN_ARRIVED,
                    '🚨 Your Turn Has Arrived!',
                    `Vehicle ${booking.vehicleNumber} is at the pump. Please proceed for fueling.`,
                    { stationId, vehicleNumber: booking.vehicleNumber, bookingId: booking.id }
                );
            }

            if (booking.lanePosition !== newLanePos || updates.status) {
                batch.update(doc(db, COLLECTIONS.BOOKINGS, booking.id), {
                    ...updates,
                    lanePosition: newLanePos,
                    updatedAt: serverTimestamp()
                });
            }
        });

        // Update station document with the current fueling vehicle ID
        const stationQuery = query(
            collection(db, COLLECTIONS.STATIONS),
            where('stationId', '==', stationId)
        );
        const stationSnapshot = await getDocs(stationQuery);
        if (!stationSnapshot.empty) {
            const stationDocId = stationSnapshot.docs[0].id;
            const finalSorted = getLaneOrder(sorted); // re-sort after promotion
            const currentId = finalSorted.find(b => b.status === 'fueling')?.id || null;

            batch.update(doc(db, COLLECTIONS.STATIONS, stationDocId), {
                currentVehicleId: currentId,
                updatedAt: serverTimestamp()
            });
        }

        await batch.commit();
    } catch (err) {
        console.error('[LaneLogic] recalculateLanePositions error:', err);
    }
};

/**
 * Expire stale check-ins — revert checked-in vehicles that have been
 * waiting too long (> 5 min) and are NOT in the top 3 lane positions.
 *
 * Call this periodically or after queue advances.
 *
 * @param {string} stationId – station ID (field value)
 */
export const expireStaleCheckIns = async (stationId) => {
    try {
        const snap = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', '==', 'checked_in')
            )
        );

        if (snap.empty) return;

        const now = Date.now();
        const batch = writeBatch(db);
        const expiredCustomers = [];

        snap.docs.forEach(d => {
            const data = d.data();
            const checkedInMs = toMillis(data.checkedInAt);
            const lanePos = data.lanePosition ?? data.queuePosition;

            // Only expire if > 5 min AND not in top 3 lane positions
            if ((now - checkedInMs) > CHECK_IN_EXPIRY_MS && lanePos > EXPIRY_EXEMPT_LANE_POS) {
                batch.update(doc(db, COLLECTIONS.BOOKINGS, d.id), {
                    status: 'eligible',
                    isCheckedIn: false,
                    checkedInAt: null,
                    checkInLocation: null,
                    updatedAt: serverTimestamp()
                });
                expiredCustomers.push({
                    customerId: data.customerId,
                    vehicleNumber: data.vehicleNumber,
                    bookingId: d.id
                });
            }
        });

        if (expiredCustomers.length === 0) return;

        await batch.commit();

        // Recalculate lane positions after expiry
        await recalculateLanePositions(stationId);

        // Notify expired customers
        await Promise.all(expiredCustomers.map(c =>
            createNotification(
                c.customerId,
                NOTIF_TYPE.CHECK_IN_EXPIRED,
                '⏰ Check-in Expired',
                `Your check-in for ${c.vehicleNumber} has expired. Please check-in again when you\'re at the station.`,
                { stationId, bookingId: c.bookingId, vehicleNumber: c.vehicleNumber }
            )
        ));
    } catch (err) {
        console.error('[LaneLogic] expireStaleCheckIns error:', err);
    }
};
