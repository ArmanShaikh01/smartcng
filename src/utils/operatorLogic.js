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
import { getLaneOrder, recalculateLanePositions, expireStaleCheckIns } from './laneLogic';

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

        // Collect remaining bookings and sort using lane-priority logic:
        // Checked-in vehicles sorted by checkedInAt (physical lane order),
        // then eligible (not checked in) by queuePosition, then waiting.
        const remaining = remainingBookings.docs.map(d => ({ id: d.id, ...d.data() }));
        const sorted = getLaneOrder(remaining);

        // Update all positions based on new lane order
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
                lanePosition: newPosition,
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

        // ── Notifications after queue advance ─────────────────────────────────
        // 1. Notify completed customer
        const completedCustId = currentBooking.data().customerId;
        if (completedCustId) {
            await createNotification(
                completedCustId,
                NOTIF_TYPE.FUELING_COMPLETED,
                '⛽ Fueling Completed!',
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
                    '🚨 Your Turn Has Arrived!',
                    `Vehicle ${nextBooking.vehicleNumber} is now at the pump. Please proceed for fueling.`,
                    { stationId, vehicleNumber: nextBooking.vehicleNumber, bookingId: nextBooking.id }
                );
            }
        }

        // 3. Notify customers newly promoted into eligible zone (positions 2–10)
        //    so they know to head to the station and check-in
        const newlyEligible = sorted.slice(1, 10); // positions 2–10 after the advance
        await Promise.all(
            newlyEligible
                .filter(b => b.customerId && !b.isCheckedIn)
                .map(b =>
                    createNotification(
                        b.customerId,
                        NOTIF_TYPE.CHECK_IN_REMINDER,
                        '📍 Proceed to Station — Check-in Required',
                        `Your queue position is now #${b.queuePosition}. Please arrive at the station and check-in.`,
                        { stationId, vehicleNumber: b.vehicleNumber, bookingId: b.id, queuePosition: b.queuePosition }
                    )
                )
        );

        // 4. SAFEGUARD 3: Pre-arrival notification for positions 11-13
        const preArrival = sorted.filter(b =>
            b.queuePosition >= 11 && b.queuePosition <= 13 && b.customerId
        );
        await Promise.all(preArrival.map(b =>
            createNotification(
                b.customerId,
                NOTIF_TYPE.PRE_ARRIVAL_ALERT,
                '🚗 Get Ready! Your turn is approaching',
                `You are #${b.queuePosition} in queue. Start heading to the station now!`,
                { stationId, bookingId: b.id, vehicleNumber: b.vehicleNumber, queuePosition: b.queuePosition }
            )
        ));

        // 5. Expire stale check-ins (Safeguard 2)
        await expireStaleCheckIns(stationId);

        // 6. Queue backlog alert to owner if queue > 15
        const queueLen = sorted.length + 1; // +1 for the one just completed
        if (queueLen > 15) {
            const stationDataSnap = await getDocs(
                query(collection(db, COLLECTIONS.STATIONS), where('stationId', '==', stationId))
            );
            if (!stationDataSnap.empty) {
                const stData = stationDataSnap.docs[0].data();
                if (stData.ownerId) {
                    await createNotification(
                        stData.ownerId,
                        NOTIF_TYPE.QUEUE_BACKLOG_ALERT,
                        '🚨 Queue Backlog Alert',
                        `Station ${stationId} has ${queueLen} vehicles in queue. Consider adding more operators.`,
                        { stationId, queueLength: queueLen }
                    );
                }
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

        // Use lane-priority sorting: fueling first, then checked-in by checkedInAt, then rest
        const fueling = remainingList.filter(b => b.status === 'fueling');
        const rest = remainingList.filter(b => b.status !== 'fueling');
        const sorted = [...fueling, ...getLaneOrder(rest)];

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
                lanePosition: newPosition,
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

        // Reset check-in → move to end of checked-in group
        await updateDoc(bookingRef, {
            isCheckedIn: false,
            checkedInAt: null,
            checkInLocation: null,
            status: 'eligible',
            skipCount: newSkipCount,
            skippedAt: serverTimestamp(),
            skipReason: 'operator_skip',
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

        // Recalculate lane positions
        await recalculateLanePositions(stationId);

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
