// Operator queue management utilities
import {
    doc,
    updateDoc,
    getDocs,
    getDoc,
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
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';

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

        // ── Notification: owner alert when gas is turned OFF ──────────────────
        if (!gasOn) {
            // Fetch ownerId from the station document
            const ownerData = stationSnapshot.docs[0].data();
            if (ownerData.ownerId) {
                await createNotification(
                    ownerData.ownerId,
                    NOTIF_TYPE.GAS_TURNED_OFF,
                    'Gas Supply Turned OFF',
                    `Gas has been turned OFF at station ${stationId}. New bookings are blocked.`,
                    { stationId, operatorId }
                );
            }
        }

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

        // ── Notification: owner alert when booking is disabled ──────────────
        if (!bookingOn) {
            const ownerData = stationSnapshot.docs[0].data();
            if (ownerData.ownerId) {
                await createNotification(
                    ownerData.ownerId,
                    NOTIF_TYPE.STATION_BOOKING_OFF,
                    'Booking Disabled at Station',
                    `Booking has been turned OFF at station ${stationId}. No new tokens will be issued.`,
                    { stationId, operatorId }
                );
            }
        }

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

        // Collect remaining bookings into array and sort smartly:
        // Checked-in vehicles should be served before non-arrived ones.
        // Priority: checked_in first (sorted by original position), then the rest (by position).
        const remaining = remainingBookings.docs.map(d => ({ id: d.id, ...d.data() }));

        // Separate checked-in from non-arrived
        const checkedIn = remaining.filter(b => b.isCheckedIn || b.status === 'checked_in')
            .sort((a, b) => a.queuePosition - b.queuePosition);
        const notArrived = remaining.filter(b => !b.isCheckedIn && b.status !== 'checked_in')
            .sort((a, b) => a.queuePosition - b.queuePosition);

        // Merge: checked-in first, then non-arrived
        const sorted = [...checkedIn, ...notArrived];

        // Update all positions based on new order
        const batch = writeBatch(db);
        let nextVehicleNumber = null;

        sorted.forEach((booking, index) => {
            const newPosition = index + 1;

            let newStatus;
            if (newPosition === 1) {
                newStatus = 'fueling';
                nextVehicleNumber = booking.vehicleNumber;
            } else if (newPosition <= 10) {
                newStatus = booking.isCheckedIn ? 'checked_in' : 'eligible';
            } else {
                newStatus = 'waiting';
            }

            batch.update(doc(db, COLLECTIONS.BOOKINGS, booking.id), {
                queuePosition: newPosition,
                status: newStatus,
                eligibleAt: newPosition <= 10 && !booking.eligibleAt
                    ? serverTimestamp()
                    : (booking.eligibleAt ?? null),
                fuelingStartedAt: newPosition === 1 ? serverTimestamp() : null,
                estimatedWaitMinutes: (newPosition - 1) * 3,
                updatedAt: serverTimestamp()
            });
        });

        await batch.commit();

        // ── Notifications after queue advance ─────────────────────────────
        // 1. Notify completed customer
        const completedCustId = currentBooking.data().customerId;
        if (completedCustId) {
            await createNotification(
                completedCustId,
                NOTIF_TYPE.FUELING_COMPLETED,
                'Fueling Completed',
                `Fueling for vehicle ${currentVehicleNumber} is complete. Thank you for using Smart CNG.`,
                { stationId, vehicleNumber: currentVehicleNumber, bookingId: currentBookingId }
            );
        }

        // 2. Notify the newly-promoted vehicle (now at position 1)
        if (sorted.length > 0) {
            const nextBooking = sorted[0];
            if (nextBooking.customerId) {
                await createNotification(
                    nextBooking.customerId,
                    NOTIF_TYPE.TURN_ARRIVED,
                    'Your Turn Has Arrived!',
                    `Vehicle ${nextBooking.vehicleNumber} is now at the pump. Please proceed for fueling.`,
                    { stationId, vehicleNumber: nextBooking.vehicleNumber, bookingId: nextBooking.id }
                );
            }
        }

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

/**
 * Mark a vehicle as no-show — removes from queue and reorders remaining
 * @param {string} bookingId - Booking document ID
 * @param {string} vehicleNumber - Vehicle number (for logging)
 * @param {string} stationId - Station ID
 * @param {string} operatorId - Operator user ID
 * @returns {Promise<{success: boolean}>}
 */
export const markNoShow = async (bookingId, vehicleNumber, stationId, operatorId) => {
    try {
        // Mark booking as no_show
        await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), {
            status: 'no_show',
            skippedAt: serverTimestamp(),
            skipReason: 'operator_no_show',
            updatedAt: serverTimestamp()
        });

        // Log the action
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            bookingId,
            vehicleNumber,
            action: 'no_show',
            performedBy: operatorId,
            performedByRole: 'operator',
            timestamp: serverTimestamp()
        });

        // Re-fetch remaining active bookings and reorder
        const remaining = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling']),
                orderBy('queuePosition', 'asc')
            )
        );

        const remainingList = remaining.docs.map(d => ({ id: d.id, ...d.data() }));

        // Keep fueling at pos 1, checked-in next, then non-arrived
        const fueling = remainingList.filter(b => b.status === 'fueling');
        const checkedIn = remainingList
            .filter(b => b.isCheckedIn && b.status !== 'fueling')
            .sort((a, b) => a.queuePosition - b.queuePosition);
        const notArrived = remainingList
            .filter(b => !b.isCheckedIn && b.status !== 'fueling')
            .sort((a, b) => a.queuePosition - b.queuePosition);

        const sorted = [...fueling, ...checkedIn, ...notArrived];

        const batch = writeBatch(db);
        sorted.forEach((booking, index) => {
            const newPosition = index + 1;
            let newStatus;
            if (booking.status === 'fueling') {
                newStatus = 'fueling';
            } else if (newPosition <= 10) {
                newStatus = booking.isCheckedIn ? 'checked_in' : 'eligible';
            } else {
                newStatus = 'waiting';
            }

            batch.update(doc(db, COLLECTIONS.BOOKINGS, booking.id), {
                queuePosition: newPosition,
                status: newStatus,
                estimatedWaitMinutes: (newPosition - 1) * 3,
                updatedAt: serverTimestamp()
            });
        });

        await batch.commit();

        // ── Notification: no-show customer ──────────────────────────────
        // Fetch customerId from the booking document
        const noShowBookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);
        const noShowSnap = await getDoc(noShowBookingRef);
        if (noShowSnap.exists()) {
            const noShowCustId = noShowSnap.data().customerId;
            if (noShowCustId) {
                await createNotification(
                    noShowCustId,
                    NOTIF_TYPE.BOOKING_NO_SHOW,
                    'No-Show Recorded',
                    `Vehicle ${vehicleNumber} was marked as no-show. Your token has been cancelled.`,
                    { stationId, bookingId, vehicleNumber }
                );
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Error marking no-show:', error);
        return { success: false, error: error.message };
    }
};
