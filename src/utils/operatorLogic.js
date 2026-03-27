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
import { evaluateGate, GATE_END } from './gateLogic';

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

        // ── Notifications for gas status change ─────────────────────────────
        const ownerData = stationSnapshot.docs[0].data();
        if (!gasOn) {
            // Gas turned OFF → notify owner
            if (ownerData.ownerId) {
                await createNotification(
                    ownerData.ownerId,
                    NOTIF_TYPE.GAS_TURNED_OFF,
                    '⚠️ Gas Supply Turned OFF',
                    `Gas has been turned OFF at station ${stationId}. New bookings are blocked.`,
                    { stationId, operatorId }
                );
            }
        } else {
            // Gas turned ON → notify owner + all operators at this station
            const notifyTargets = [];
            if (ownerData.ownerId) notifyTargets.push(ownerData.ownerId);
            const operatorIds = ownerData.operatorIds || [];
            operatorIds.forEach(uid => { if (uid !== operatorId) notifyTargets.push(uid); });
            await Promise.all(notifyTargets.map(uid =>
                createNotification(
                    uid,
                    NOTIF_TYPE.GAS_TURNED_ON,
                    '✅ Gas Supply Restored',
                    `Gas is back ON at station ${stationId}. Fueling operations resumed.`,
                    { stationId, operatorId }
                )
            ));
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

        // ── Notifications for booking status change ──────────────────────────
        const ownerData2 = stationSnapshot.docs[0].data();
        if (!bookingOn) {
            // Booking closed → notify owner
            if (ownerData2.ownerId) {
                await createNotification(
                    ownerData2.ownerId,
                    NOTIF_TYPE.STATION_BOOKING_OFF,
                    '🚫 Booking Closed',
                    `Booking has been turned OFF at station ${stationId}. No new tokens will be issued.`,
                    { stationId, operatorId }
                );
            }
        } else {
            // Booking opened → notify owner + all operators
            const notifyTargets2 = [];
            if (ownerData2.ownerId) notifyTargets2.push(ownerData2.ownerId);
            const operatorIds2 = ownerData2.operatorIds || [];
            operatorIds2.forEach(uid => { if (uid !== operatorId) notifyTargets2.push(uid); });
            await Promise.all(notifyTargets2.map(uid =>
                createNotification(
                    uid,
                    NOTIF_TYPE.STATION_BOOKING_ON,
                    '✅ Booking Opened',
                    `Booking is now OPEN at station ${stationId}. Customers can book tokens.`,
                    { stationId, operatorId }
                )
            ));
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
        // Get current fueling vehicle
        const currentBookingSnapshot = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', '==', 'fueling')
            )
        );

        if (currentBookingSnapshot.empty) {
            return { success: false, error: 'No vehicle currently fueling' };
        }

        const currentBooking = currentBookingSnapshot.docs[0];
        const currentBookingId = currentBooking.id;
        const currentVehicleNumber = currentBooking.data().vehicleNumber;
        const completedCustId = currentBooking.data().customerId;

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

        // ── Notification: fueling completed ──
        if (completedCustId) {
            await createNotification(
                completedCustId,
                NOTIF_TYPE.FUELING_COMPLETED,
                '⛽ Fueling Completed!',
                `Fueling for vehicle ${currentVehicleNumber} is complete. Thank you for using Smart CNG.`,
                { stationId, vehicleNumber: currentVehicleNumber, bookingId: currentBookingId }
            );
        }

        // ── Evaluate gate: shift positions, promote checked-in, notify batch ──
        await evaluateGate(stationId);

        // Get updated state to find the new fueling vehicle
        const updatedSnap = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', '==', 'fueling')
            )
        );
        const nextVehicleNumber = updatedSnap.empty
            ? 'Queue empty'
            : updatedSnap.docs[0].data().vehicleNumber;

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
            nextVehicle: nextVehicleNumber,
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

        // ── Evaluate gate: recompact positions, promote checked-in, notify batch ──
        await evaluateGate(stationId);

        // ── Notification: no-show customer ──
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

/**
 * Skip a checked-in vehicle — moves it to the end of the checked-in group.
 * If skipCount reaches 3, auto-marks as no-show.
 *
 * @param {string} bookingId - Booking document ID
 * @param {string} vehicleNumber - Vehicle number (for logging)
 * @param {string} stationId - Station ID
 * @param {string} operatorId - Operator user ID
 * @returns {Promise<{success: boolean}>}
 */
export const skipVehicle = async (bookingId, vehicleNumber, stationId, operatorId) => {
    try {
        const bookingRef = doc(db, COLLECTIONS.BOOKINGS, bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) {
            return { success: false, error: 'Booking not found' };
        }

        const bookingData = bookingSnap.data();
        const newSkipCount = (bookingData.skipCount || 0) + 1;

        // If skipped 3 times → auto no-show
        if (newSkipCount >= 3) {
            return await markNoShow(bookingId, vehicleNumber, stationId, operatorId);
        }

        // Find max queue position to push this vehicle to end
        const activeSnap = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling']),
                orderBy('queuePosition', 'asc')
            )
        );
        const maxPos = activeSnap.empty
            ? 1
            : Math.max(...activeSnap.docs.map(d => d.data().queuePosition || 0));

        // Push the skipped booking to the very end
        await updateDoc(bookingRef, {
            isCheckedIn: false,
            checkedInAt: null,
            checkInLocation: null,
            status: 'waiting',
            queuePosition: maxPos + 1,
            skipCount: newSkipCount,
            skippedAt: serverTimestamp(),
            skipReason: 'operator_skip',
            gateNotifiedAt: null,
            updatedAt: serverTimestamp()
        });

        // Log the skip
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            bookingId,
            vehicleNumber,
            action: 'skipped',
            performedBy: operatorId,
            performedByRole: 'operator',
            timestamp: serverTimestamp(),
            metadata: { skipCount: newSkipCount }
        });

        // Evaluate gate: recompact positions, promote, notify batch
        await evaluateGate(stationId);

        // Notify customer
        if (bookingData.customerId) {
            await createNotification(
                bookingData.customerId,
                NOTIF_TYPE.VEHICLE_SKIPPED,
                '⚠️ Vehicle Skipped',
                `Your vehicle ${vehicleNumber} was skipped (${newSkipCount}/3). Check in again when you're at the pump.`,
                { stationId, bookingId, vehicleNumber, skipCount: newSkipCount }
            );
        }

        return { success: true, skipCount: newSkipCount };
    } catch (error) {
        console.error('Error skipping vehicle:', error);
        return { success: false, error: error.message };
    }
};
