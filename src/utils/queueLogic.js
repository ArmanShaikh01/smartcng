// Queue management utility functions
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';
import { evaluateGate, GATE_END } from './gateLogic';

/**
 * Validate if booking is allowed
 * @param {string} stationId - Station ID
 * @param {string} vehicleNumber - Vehicle number
 * @returns {Promise<{valid: boolean, error: string}>}
 */
export const validateBooking = async (stationId, vehicleNumber) => {
    try {
        // Get station data
        const stationDoc = await getDocs(
            query(collection(db, COLLECTIONS.STATIONS), where('stationId', '==', stationId))
        );

        if (stationDoc.empty) {
            return { valid: false, error: 'Station not found' };
        }

        const station = stationDoc.docs[0].data();

        // Rule 1: Gas must be ON
        if (!station.gasOn) {
            return { valid: false, error: 'Gas is currently OFF. Booking not allowed.' };
        }

        // Rule 2: Booking must be ON
        if (!station.bookingOn) {
            return { valid: false, error: 'Booking is currently closed.' };
        }

        // Rule 3: No duplicate active booking for this vehicle (single where, filter in JS)
        const existingBookingSnap = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('vehicleNumber', '==', vehicleNumber)
            )
        );
        const activeStatuses = ['waiting', 'eligible', 'checked_in', 'fueling'];
        const hasActiveBooking = existingBookingSnap.docs.some(d => activeStatuses.includes(d.data().status));

        if (hasActiveBooking) {
            return { valid: false, error: 'This vehicle already has an active booking.' };
        }

        return { valid: true, error: null };
    } catch (error) {
        console.error('Error validating booking:', error);
        return { valid: false, error: 'Validation failed. Please try again.' };
    }
};

/**
 * Create a new booking
 * @param {string} stationId - Station ID
 * @param {string} vehicleNumber - Vehicle number
 * @param {string} customerId - Customer user ID
 * @param {string} customerPhone - Customer phone number
 * @returns {Promise<{success: boolean, bookingId: string, queuePosition: number}>}
 */
export const createBooking = async (stationId, vehicleNumber, customerId, customerPhone) => {
    try {
        // Get current queue length (single where, filter in JS)
        const queueSnapshot = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId)
            )
        );
        const activeStatuses2 = ['waiting', 'eligible', 'checked_in', 'fueling'];
        const activeCount = queueSnapshot.docs.filter(d => activeStatuses2.includes(d.data().status)).length;
        const newPosition = activeCount + 1;
        const estimatedWaitMinutes = (newPosition - 1) * 3; // 3 min per vehicle

        const bookingData = {
            stationId,
            vehicleNumber,
            customerId,
            customerPhone,
            queuePosition: newPosition,
            originalPosition: newPosition,
            status: newPosition <= GATE_END ? 'eligible' : 'waiting',
            isCheckedIn: false,
            checkedInAt: null,
            checkInLocation: null,
            bookedAt: serverTimestamp(),
            eligibleAt: newPosition <= GATE_END ? serverTimestamp() : null,
            fuelingStartedAt: null,
            completedAt: null,
            skippedAt: null,
            skipCount: 0,
            skipReason: null,
            estimatedWaitMinutes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const bookingRef = await addDoc(collection(db, COLLECTIONS.BOOKINGS), bookingData);

        // Log booking
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            bookingId: bookingRef.id,
            vehicleNumber,
            action: 'booked',
            performedBy: customerId,
            performedByRole: 'customer',
            timestamp: serverTimestamp(),
            metadata: { queuePosition: newPosition }
        });

        // ── Notification: booking confirmed ──────────────────────────────
        await createNotification(
            customerId,
            NOTIF_TYPE.BOOKING_CONFIRMED,
            'Token Booked Successfully ✅',
            `You are #${newPosition} in queue. Estimated wait: ${estimatedWaitMinutes} min.`,
            { stationId, bookingId: bookingRef.id, vehicleNumber, queuePosition: newPosition }
        );

        // ── Notification: check-in reminder for top-15 positions ─────────
        if (newPosition <= GATE_END) {
            await createNotification(
                customerId,
                NOTIF_TYPE.CHECK_IN_REMINDER,
                'Please Proceed to Station 📍',
                `Your queue position is #${newPosition}. Please arrive at the station and check-in now.`,
                { stationId, bookingId: bookingRef.id, vehicleNumber, queuePosition: newPosition }
            );
        }

        return {
            success: true,
            bookingId: bookingRef.id,
            queuePosition: newPosition,
            estimatedWaitMinutes
        };
    } catch (error) {
        console.error('Error creating booking:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Cancel a booking — atomically marks as cancelled AND re-indexes all
 * remaining vehicles in one writeBatch so positions shift immediately.
 *
 * WHY a writeBatch instead of updateDoc → evaluateGate:
 *   evaluateGate calls fetchActiveBookings (getDocs) right after the
 *   updateDoc. Firestore's eventual-consistency model can return the
 *   pre-cancel snapshot, so the cancelled vehicle is still counted and
 *   positions are never shifted. One atomic batch eliminates this race.
 *
 * @param {string} bookingId  — Booking ID to cancel
 * @param {string} customerId — Customer user ID (for logs & notifications)
 * @param {string} stationId  — Station ID (needed for queue re-index)
 * @returns {Promise<{success: boolean}>}
 */
export const cancelBooking = async (bookingId, customerId, stationId) => {
    try {
        const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);

        // ── Resolve stationId from the doc if it wasn't passed ─────────────
        let resolvedStationId = stationId;
        if (!resolvedStationId) {
            const snap = await getDoc(bookingRef);
            resolvedStationId = snap.exists() ? snap.data().stationId : null;
        }

        // ── Fetch all currently-active bookings for this station ───────────
        // (Single where clause — no composite index required)
        const ACTIVE = ['waiting', 'eligible', 'checked_in', 'fueling'];
        let remaining = [];
        if (resolvedStationId) {
            const queueSnap = await getDocs(
                query(
                    collection(db, COLLECTIONS.BOOKINGS),
                    where('stationId', '==', resolvedStationId)
                )
            );
            remaining = queueSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                // Exclude the booking being cancelled AND any other non-active ones
                .filter(b => b.id !== bookingId && ACTIVE.includes(b.status))
                // Sort by current position to preserve relative order
                .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
        }

        // ── Atomic writeBatch: cancel + re-index in one commit ─────────────
        const wb = writeBatch(db);

        // 1. Mark the target booking as cancelled
        wb.update(bookingRef, {
            status: 'cancelled',
            cancelledAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // 2. Re-assign position = index + 1 for every remaining vehicle
        //    (.map over sorted remaining → gap-fill starting from #1)
        remaining.forEach((booking, index) => {
            const newPos = index + 1;
            wb.update(doc(db, COLLECTIONS.BOOKINGS, booking.id), {
                queuePosition: newPos,
                updatedAt: serverTimestamp()
            });
        });

        await wb.commit();
        console.log(
            `[cancelBooking] ✅ Cancelled ${bookingId}, re-indexed ${remaining.length} remaining vehicles.`
        );

        // ── Log cancellation ───────────────────────────────────────────────
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            bookingId,
            stationId: resolvedStationId || '',
            action: 'cancelled',
            performedBy: customerId,
            performedByRole: 'customer',
            timestamp: serverTimestamp()
        });

        // ── Run gate evaluation for status promotions & gate notifications ─
        // (evaluateGate now sees the already-committed, correct positions)
        if (resolvedStationId) {
            await evaluateGate(resolvedStationId);
        }

        // ── Notification: booking cancelled ───────────────────────────────
        await createNotification(
            customerId,
            NOTIF_TYPE.BOOKING_CANCELLED,
            '🗑️ Booking Cancelled',
            'Your token has been cancelled. You can book a new token anytime.',
            { bookingId, stationId: resolvedStationId }
        );

        return { success: true };
    } catch (error) {
        console.error('Error cancelling booking:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check in to station (GPS validation done in component)
 * @param {string} bookingId - Booking ID
 * @param {object} location - {latitude, longitude, accuracy}
 * @param {string} customerId - Customer user ID
 * @param {string} stationId - Station ID (for lane recalculation)
 * @returns {Promise<{success: boolean}>}
 */
export const checkInBooking = async (bookingId, location, customerId, stationId) => {
    try {
        const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);

        // ── SAFEGUARD 1: Top-10 check-in gate ────────────────────────────
        const bookingSnap = await getDoc(bookingRef);
        if (!bookingSnap.exists()) {
            return { success: false, error: 'Booking not found.' };
        }
        const bookingData = bookingSnap.data();
        if (bookingData.queuePosition > GATE_END) {
            return { success: false, error: 'Check-in is only available for top ' + GATE_END + ' positions. Your position: #' + bookingData.queuePosition };
        }

        // Resolve stationId from booking if not passed
        const resolvedStationId = stationId || bookingData.stationId;

        await updateDoc(bookingRef, {
            isCheckedIn: true,
            checkedInAt: serverTimestamp(),
            checkInLocation: location,
            status: 'checked_in',
            updatedAt: serverTimestamp()
        });

        // Log check-in
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            bookingId,
            stationId: resolvedStationId,
            action: 'checked_in',
            performedBy: customerId,
            performedByRole: 'customer',
            timestamp: serverTimestamp(),
            metadata: { distance: location.distance }
        });

        // ── Evaluate gate (promote checked-in to top 10, auto-promote to 'fueling' if idle) ──
        await evaluateGate(resolvedStationId);

        // ── Notify operators: new GPS check-in arrived ──────────────────────
        const stationSnap = await getDocs(
            query(collection(db, COLLECTIONS.STATIONS), where('stationId', '==', resolvedStationId))
        );
        if (!stationSnap.empty) {
            const stationData = stationSnap.docs[0].data();
            const operatorIds = stationData.operatorIds || [];
            await Promise.all(operatorIds.map(opUid =>
                createNotification(
                    opUid,
                    NOTIF_TYPE.GPS_CHECKIN_ALERT,
                    '📍 Arrival: Vehicle Checked In',
                    `Vehicle ${bookingData.vehicleNumber} is now at the station. Verified via GPS. (Position #${bookingData.queuePosition})`,
                    { stationId: resolvedStationId, bookingId, vehicleNumber: bookingData.vehicleNumber }
                )
            ));
        }

        // ── Notification: check-in confirmed ─────────────────────────────
        await createNotification(
            customerId,
            NOTIF_TYPE.CHECKED_IN_OK,
            'Check-in Successful ✓',
            'You are checked-in. Stay near the station — your fueling will begin shortly.',
            { bookingId, stationId: resolvedStationId }
        );

        return { success: true };
    } catch (error) {
        console.error('Error checking in:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get customer's active booking
 * @param {string} customerId - Customer user ID
 * @returns {Promise<object|null>}
 */
export const getActiveBooking = async (customerId) => {
    try {
        const bookingsSnapshot = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('customerId', '==', customerId)
            )
        );

        if (bookingsSnapshot.empty) return null;

        const activeStatuses3 = ['waiting', 'eligible', 'checked_in', 'fueling'];
        const active = bookingsSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(b => activeStatuses3.includes(b.status));

        if (active.length === 0) return null;
        return active[0];
    } catch (error) {
        console.error('Error getting active booking:', error);
        return null;
    }
};
