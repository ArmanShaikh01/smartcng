// Operator queue management utilities
import {
    doc,
    updateDoc,
    getDocs,
    query,
    collection,
    where,
    orderBy,
    writeBatch,
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';

/**
 * Toggle station gas status
 * @param {string} stationId - Station ID (field value, not document ID)
 * @param {boolean} gasOn - New gas status
 * @param {string} operatorId - Operator user ID
 * @returns {Promise<{success: boolean}>}
 */
export const toggleGasStatus = async (stationId, gasOn, operatorId) => {
    try {
        // Find station by stationId field
        const stationQuery = query(
            collection(db, COLLECTIONS.STATIONS),
            where('stationId', '==', stationId)
        );
        const stationSnapshot = await getDocs(stationQuery);

        if (stationSnapshot.empty) {
            return { success: false, error: 'Station not found' };
        }

        const stationDocId = stationSnapshot.docs[0].id;
        const stationRef = doc(db, COLLECTIONS.STATIONS, stationDocId);

        await updateDoc(stationRef, {
            gasOn,
            updatedAt: serverTimestamp()
        });

        // Log action
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            action: gasOn ? 'gas_turned_on' : 'gas_turned_off',
            performedBy: operatorId,
            performedByRole: 'operator',
            timestamp: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error toggling gas status:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Toggle station booking status
 * @param {string} stationId - Station ID (field value, not document ID)
 * @param {boolean} bookingOn - New booking status
 * @param {string} operatorId - Operator user ID
 * @returns {Promise<{success: boolean}>}
 */
export const toggleBookingStatus = async (stationId, bookingOn, operatorId) => {
    try {
        // Find station by stationId field
        const stationQuery = query(
            collection(db, COLLECTIONS.STATIONS),
            where('stationId', '==', stationId)
        );
        const stationSnapshot = await getDocs(stationQuery);

        if (stationSnapshot.empty) {
            return { success: false, error: 'Station not found' };
        }

        const stationDocId = stationSnapshot.docs[0].id;
        const stationRef = doc(db, COLLECTIONS.STATIONS, stationDocId);

        await updateDoc(stationRef, {
            bookingOn,
            updatedAt: serverTimestamp()
        });

        // Log action
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            action: bookingOn ? 'booking_opened' : 'booking_closed',
            performedBy: operatorId,
            performedByRole: 'operator',
            timestamp: serverTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error('Error toggling booking status:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Advance queue - Mark current vehicle as completed and shift all positions
 * @param {string} stationId - Station ID
 * @param {string} operatorId - Operator user ID
 * @returns {Promise<{success: boolean, nextVehicle: string}>}
 */
export const advanceQueue = async (stationId, operatorId) => {
    try {
        // Get current fueling vehicle (position 1)
        const currentBookingSnapshot = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('queuePosition', '==', 1),
                where('status', 'in', ['fueling', 'checked_in'])
            )
        );

        if (currentBookingSnapshot.empty) {
            return { success: false, error: 'No vehicle currently fueling' };
        }

        const currentBooking = currentBookingSnapshot.docs[0];
        const currentBookingId = currentBooking.id;
        const currentVehicleNumber = currentBooking.data().vehicleNumber;

        // Mark current booking as completed
        await updateDoc(doc(db, COLLECTIONS.BOOKINGS, currentBookingId), {
            status: 'completed',
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Log completion
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            bookingId: currentBookingId,
            vehicleNumber: currentVehicleNumber,
            action: 'completed',
            performedBy: operatorId,
            performedByRole: 'operator',
            timestamp: serverTimestamp()
        });

        // Get all remaining bookings
        const remainingBookings = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', 'in', ['waiting', 'eligible', 'checked_in']),
                orderBy('queuePosition', 'asc')
            )
        );

        // Update all positions (shift everyone up by 1)
        const batch = writeBatch(db);
        let nextVehicleNumber = null;

        remainingBookings.forEach((bookingDoc, index) => {
            const newPosition = index + 1;
            const booking = bookingDoc.data();

            let newStatus = 'waiting';
            if (newPosition === 1) {
                newStatus = 'fueling';
                nextVehicleNumber = booking.vehicleNumber;
            } else if (newPosition <= 10) {
                newStatus = booking.isCheckedIn ? 'checked_in' : 'eligible';
            }

            batch.update(doc(db, COLLECTIONS.BOOKINGS, bookingDoc.id), {
                queuePosition: newPosition,
                status: newStatus,
                eligibleAt: newPosition <= 10 && !booking.eligibleAt
                    ? serverTimestamp()
                    : booking.eligibleAt,
                fuelingStartedAt: newPosition === 1 ? serverTimestamp() : null,
                estimatedWaitMinutes: (newPosition - 1) * 3,
                updatedAt: serverTimestamp()
            });
        });

        await batch.commit();

        // Update station stats
        const stationQuery = query(
            collection(db, COLLECTIONS.STATIONS),
            where('stationId', '==', stationId)
        );
        const stationSnapshot = await getDocs(stationQuery);

        if (!stationSnapshot.empty) {
            const stationDocId = stationSnapshot.docs[0].id;
            const stationRef = doc(db, COLLECTIONS.STATIONS, stationDocId);

            await updateDoc(stationRef, {
                totalVehiclesServed: (await getDocs(
                    query(
                        collection(db, COLLECTIONS.BOOKINGS),
                        where('stationId', '==', stationId),
                        where('status', '==', 'completed')
                    )
                )).size
            });
        }

        return {
            success: true,
            nextVehicle: nextVehicleNumber || 'Queue empty',
            completedVehicle: currentVehicleNumber
        };
    } catch (error) {
        console.error('Error advancing queue:', error);
        return { success: false, error: error.message };
    }
};
