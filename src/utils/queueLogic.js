// Queue management utility functions
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';

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

        // Rule 3: No duplicate active booking for this vehicle
        const existingBooking = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('vehicleNumber', '==', vehicleNumber),
                where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling'])
            )
        );

        if (!existingBooking.empty) {
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
        // Get current queue length
        const queueSnapshot = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling'])
            )
        );

        const newPosition = queueSnapshot.size + 1;
        const estimatedWaitMinutes = (newPosition - 1) * 3; // 3 min per vehicle

        const bookingData = {
            stationId,
            vehicleNumber,
            customerId,
            customerPhone,
            queuePosition: newPosition,
            originalPosition: newPosition,
            status: newPosition <= 10 ? 'eligible' : 'waiting',
            isCheckedIn: false,
            checkedInAt: null,
            checkInLocation: null,
            bookedAt: serverTimestamp(),
            eligibleAt: newPosition <= 10 ? serverTimestamp() : null,
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
            'Token Booked Successfully',
            `You are #${newPosition} in queue. Estimated wait: ${estimatedWaitMinutes} min.`,
            { stationId, bookingId: bookingRef.id, vehicleNumber, queuePosition: newPosition }
        );

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
 * Cancel a booking
 * @param {string} bookingId - Booking ID
 * @param {string} customerId - Customer user ID
 * @returns {Promise<{success: boolean}>}
 */
export const cancelBooking = async (bookingId, customerId) => {
    try {
        const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);

        await updateDoc(bookingRef, {
            status: 'cancelled',
            updatedAt: serverTimestamp()
        });

        // Log cancellation
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            bookingId,
            action: 'cancelled',
            performedBy: customerId,
            performedByRole: 'customer',
            timestamp: serverTimestamp()
        });

        // ── Notification: booking cancelled ──────────────────────────────
        await createNotification(
            customerId,
            NOTIF_TYPE.BOOKING_CANCELLED,
            'Booking Cancelled',
            'Your token has been cancelled. You can book a new token anytime.',
            { bookingId }
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
 * @returns {Promise<{success: boolean}>}
 */
export const checkInBooking = async (bookingId, location, customerId) => {
    try {
        const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);

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
            action: 'checked_in',
            performedBy: customerId,
            performedByRole: 'customer',
            timestamp: serverTimestamp(),
            metadata: { distance: location.distance }
        });

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
                where('customerId', '==', customerId),
                where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling'])
            )
        );

        if (bookingsSnapshot.empty) {
            return null;
        }

        const booking = bookingsSnapshot.docs[0];
        return {
            id: booking.id,
            ...booking.data()
        };
    } catch (error) {
        console.error('Error getting active booking:', error);
        return null;
    }
};
