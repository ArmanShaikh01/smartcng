// Operator queue management utilities
//
// KEY NOTE: All Firestore queries use ONLY ONE where clause (stationId or bookingId).
// Firestore requires composite indexes for compound queries — since none are defined,
// we fetch by a single field and filter everything else in JavaScript.
//
import {
    doc,
    updateDoc,
    getDocs,
    getDoc,
    query,
    collection,
    where,
    addDoc,
    writeBatch,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';
import { evaluateGate, fetchActiveBookings } from './gateLogic';

// ─── Helper: fetch station doc by stationId field ────────────────────────────
const fetchStationDoc = async (stationId) => {
    const snap = await getDocs(
        query(collection(db, COLLECTIONS.STATIONS), where('stationId', '==', stationId))
    );
    if (snap.empty) return null;
    return { docId: snap.docs[0].id, ...snap.docs[0].data() };
};

// ─── Helper: get owner UID for a station (checks station doc first, then users)
const fetchOwnerOfStation = async (stationId, stationDocOwnerId) => {
    // Fast path: already have it from station doc
    if (stationDocOwnerId) return stationDocOwnerId;
    // Slow path: query users collection for owner with this stationId
    try {
        const snap = await getDocs(
            query(collection(db, COLLECTIONS.USERS), where('stationId', '==', stationId))
        );
        const ownerDoc = snap.docs.find(d => d.data().role === 'owner');
        return ownerDoc ? (ownerDoc.data().userId || ownerDoc.id) : null;
    } catch { return null; }
};

// ─── Helper: get all operator UIDs for a station (checks station doc first, then users)
const fetchOperatorsOfStation = async (stationId, stationDocOperatorIds) => {
    // Fast path: already have it from station doc
    if (stationDocOperatorIds && stationDocOperatorIds.length > 0) return stationDocOperatorIds;
    // Slow path: query users collection
    try {
        const snap = await getDocs(
            query(collection(db, COLLECTIONS.USERS), where('stationId', '==', stationId))
        );
        return snap.docs
            .filter(d => d.data().role === 'operator')
            .map(d => d.data().userId || d.id);
    } catch { return []; }
};

/**
 * Toggle station gas status
 */
export const toggleGasStatus = async (stationId, gasOn, operatorId) => {
    try {
        const station = await fetchStationDoc(stationId);
        if (!station) return { success: false, error: 'Station not found' };

        await updateDoc(doc(db, COLLECTIONS.STATIONS, station.docId), {
            gasOn,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            action: gasOn ? 'gas_turned_on' : 'gas_turned_off',
            performedBy: operatorId,
            performedByRole: 'operator',
            timestamp: serverTimestamp()
        });

        if (!gasOn) {
            const ownerId = await fetchOwnerOfStation(stationId, station.ownerId);
            if (ownerId) {
                await createNotification(ownerId, NOTIF_TYPE.GAS_TURNED_OFF,
                    '⚠️ Gas Supply Turned OFF',
                    `Gas has been turned OFF at station ${stationId}. New bookings are blocked.`,
                    { stationId, operatorId }
                );
            }
        } else {
            const ownerId = await fetchOwnerOfStation(stationId, station.ownerId);
            const opIds   = await fetchOperatorsOfStation(stationId, station.operatorIds);
            const targets = [...new Set([ownerId, ...opIds].filter(Boolean))];
            targets.forEach(uid => { if (uid === operatorId) targets.splice(targets.indexOf(uid), 1); });
            await Promise.all(targets.map(uid =>
                createNotification(uid, NOTIF_TYPE.GAS_TURNED_ON,
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
 */
export const toggleBookingStatus = async (stationId, bookingOn, operatorId) => {
    try {
        const station = await fetchStationDoc(stationId);
        if (!station) return { success: false, error: 'Station not found' };

        await updateDoc(doc(db, COLLECTIONS.STATIONS, station.docId), {
            bookingOn,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            action: bookingOn ? 'booking_opened' : 'booking_closed',
            performedBy: operatorId,
            performedByRole: 'operator',
            timestamp: serverTimestamp()
        });

        if (!bookingOn) {
            if (station.ownerId) {
                await createNotification(station.ownerId, NOTIF_TYPE.STATION_BOOKING_OFF,
                    '🚫 Booking Closed',
                    `Booking has been turned OFF at station ${stationId}. No new tokens will be issued.`,
                    { stationId, operatorId }
                );
            }
            // ── Notify all operators: booking is now closed ──────────────────
            const allOperators = station.operatorIds || [];
            await Promise.all(allOperators.map(uid =>
                createNotification(uid, NOTIF_TYPE.BOOKING_CLOSED_ALERT,
                    '🔒 System: Bookings OFF',
                    'New bookings are now OFF. Finish current queue only.',
                    { stationId }
                )
            ));
        } else {
            const targets2 = [];
            if (station.ownerId) targets2.push(station.ownerId);
            (station.operatorIds || []).forEach(uid => { if (uid !== operatorId) targets2.push(uid); });
            await Promise.all(targets2.map(uid =>
                createNotification(uid, NOTIF_TYPE.STATION_BOOKING_ON,
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
 * Advance queue — Mark current vehicle as completed and shift all positions.
 * Uses fetchActiveBookings (single where clause) to avoid composite index requirement.
 */
export const advanceQueue = async (stationId, operatorId) => {
    try {
        // Fetch all active bookings for this station (single where stationId)
        const allActive = await fetchActiveBookings(stationId);

        // Find the fueling vehicle
        let currentVehicle = allActive.find(b => b.status === 'fueling');

        // Fallback: no fueling vehicle — look for checked_in at lowest position
        if (!currentVehicle) {
            const checkedIn = allActive
                .filter(b => b.status === 'checked_in' || b.isCheckedIn === true)
                .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

            if (checkedIn.length === 0) {
                return {
                    success: false,
                    error: 'No vehicle currently fueling or checked in. Please wait for a customer to check in first.'
                };
            }

            // Promote first checked-in vehicle to fueling
            currentVehicle = checkedIn[0];
            await updateDoc(doc(db, COLLECTIONS.BOOKINGS, currentVehicle.id), {
                status: 'fueling',
                fuelingStartedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }

        const currentBookingId = currentVehicle.id;
        const currentVehicleNumber = currentVehicle.vehicleNumber;
        const completedCustId = currentVehicle.customerId;

        // ── Remaining vehicles (completed one removed), already sorted by pos ─
        const remaining = allActive.filter(b => b.id !== currentBookingId);

        // ── Atomic writeBatch: complete current + re-index everyone else ───────
        const wb = writeBatch(db);

        // Mark current vehicle as completed
        wb.update(doc(db, COLLECTIONS.BOOKINGS, currentBookingId), {
            status: 'completed',
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Re-assign position = index + 1 for every remaining vehicle
        // Promote first checked-in vehicle at pos 1 to 'fueling'
        let nextFuelingVehicleNumber = 'Queue empty';

        remaining.forEach((booking, index) => {
            const newPos = index + 1;
            const updates = {
                queuePosition: newPos,
                updatedAt: serverTimestamp()
            };

            // First slot is now free — promote if checked-in
            if (newPos === 1 && (booking.status === 'checked_in' || booking.isCheckedIn)) {
                updates.status = 'fueling';
                updates.fuelingStartedAt = serverTimestamp();
                nextFuelingVehicleNumber = booking.vehicleNumber;
            }

            wb.update(doc(db, COLLECTIONS.BOOKINGS, booking.id), updates);
        });

        await wb.commit();
        console.log(`[advanceQueue] ✅ Completed ${currentVehicleNumber}, re-indexed ${remaining.length} remaining.`);

        // ── Log completion ────────────────────────────────────────────────────
        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            bookingId: currentBookingId,
            vehicleNumber: currentVehicleNumber,
            action: 'completed',
            performedBy: operatorId,
            performedByRole: 'operator',
            timestamp: serverTimestamp()
        });

        // ── Notify completed customer ─────────────────────────────────────────
        if (completedCustId) {
            await createNotification(
                completedCustId, NOTIF_TYPE.FUELING_COMPLETED,
                '⛽ Fueling Completed!',
                `Fueling for vehicle ${currentVehicleNumber} is complete. Thank you for using Smart CNG.`,
                { stationId, vehicleNumber: currentVehicleNumber, bookingId: currentBookingId }
            );
        }

        // ── Gate evaluation — best-effort for notifications & gate zone ───────
        await evaluateGate(stationId);

        // ── Update station served count ───────────────────────────────────────
        const allStationSnap = await getDocs(
            query(collection(db, COLLECTIONS.BOOKINGS), where('stationId', '==', stationId))
        );
        const completedCount = allStationSnap.docs.filter(d => d.data().status === 'completed').length;

        const station = await fetchStationDoc(stationId);
        if (station) {
            await updateDoc(doc(db, COLLECTIONS.STATIONS, station.docId), {
                totalVehiclesServed: completedCount,
                updatedAt: serverTimestamp()
            });

            // ── Notify owner: operator advanced queue ──────────────────────────
            const ownerId = await fetchOwnerOfStation(stationId, station.ownerId);
            console.log('[advanceQueue] ownerId for notification:', ownerId);
            if (ownerId) {
                await createNotification(
                    ownerId,
                    NOTIF_TYPE.OPERATOR_QUEUE_ADVANCE,
                    '✅ Operator Activity',
                    `Token #${currentVehicle.queuePosition} (${currentVehicleNumber}) called to pump by Operator.`,
                    { stationId, vehicleNumber: currentVehicleNumber, bookingId: currentBookingId, operatorId }
                );
            }
        } else {
            // Station doc not found via stationId field — still try to get owner
            const ownerId = await fetchOwnerOfStation(stationId, null);
            if (ownerId) {
                await createNotification(
                    ownerId,
                    NOTIF_TYPE.OPERATOR_QUEUE_ADVANCE,
                    '✅ Operator Activity',
                    `Token #${currentVehicle.queuePosition} (${currentVehicleNumber}) called to pump by Operator.`,
                    { stationId, vehicleNumber: currentVehicleNumber, bookingId: currentBookingId, operatorId }
                );
            }
        }

        return {
            success: true,
            nextVehicle: nextFuelingVehicleNumber,
            completedVehicle: currentVehicleNumber
        };
    } catch (error) {
        console.error('Error advancing queue:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Mark a vehicle as no-show
 */
export const markNoShow = async (bookingId, vehicleNumber, stationId, operatorId) => {
    try {
        await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), {
            status: 'no_show',
            skippedAt: serverTimestamp(),
            skipReason: 'operator_no_show',
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
            stationId,
            bookingId,
            vehicleNumber,
            action: 'no_show',
            performedBy: operatorId,
            performedByRole: 'operator',
            timestamp: serverTimestamp()
        });

        await evaluateGate(stationId);

        // Notify customer
        const noShowSnap = await getDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId));
        if (noShowSnap.exists()) {
            const custId = noShowSnap.data().customerId;
            if (custId) {
                await createNotification(custId, NOTIF_TYPE.BOOKING_NO_SHOW,
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
 * Skip a vehicle — moves it to the end and re-indexes ALL positions atomically.
 * Auto no-show after 3 skips.
 *
 * Re-indexing logic:
 *   1. Fetch all active bookings, sorted by current queuePosition.
 *   2. Remove the skipped vehicle from the list.
 *   3. Append the skipped vehicle at the end.
 *   4. Assign position = index + 1 to every booking in one writeBatch.
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

        // Auto no-show after 3 skips
        if (newSkipCount >= 3) {
            return await markNoShow(bookingId, vehicleNumber, stationId, operatorId);
        }

        // ── Step 1: Fetch all active bookings sorted by position ──────────────
        const allActive = await fetchActiveBookings(stationId); // already sorted by queuePosition

        // ── Step 2: Split into [others] + [skipped] ───────────────────────────
        const others = allActive.filter(b => b.id !== bookingId);
        // If this vehicle is the only one in the queue, nothing to shift — just reset it
        const reordered = others.length === 0
            ? [allActive.find(b => b.id === bookingId)] // stays at pos 1
            : [...others, allActive.find(b => b.id === bookingId)]; // move to end

        // ── Step 3: Atomic batch — re-assign position = index + 1 for all ────
        const wb = writeBatch(db);
        reordered.forEach((booking, index) => {
            const newPos = index + 1;
            const isSkipped = booking.id === bookingId;

            const updates = {
                queuePosition: newPos,
                updatedAt: serverTimestamp()
            };

            if (isSkipped) {
                // Reset check-in state and mark as waiting
                updates.isCheckedIn = false;
                updates.checkedInAt = null;
                updates.checkInLocation = null;
                updates.status = 'waiting';
                updates.skipCount = newSkipCount;
                updates.skippedAt = serverTimestamp();
                updates.skipReason = 'operator_skip';
                updates.gateNotifiedAt = null;
            }

            wb.update(doc(db, COLLECTIONS.BOOKINGS, booking.id), updates);
        });

        await wb.commit();
        console.log(`[skipVehicle] ✅ Skipped ${vehicleNumber}, re-indexed ${reordered.length} bookings.`);

        // ── Step 4: Log the skip ──────────────────────────────────────────────
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

        // ── Step 5: Run gate evaluation for status promotions & notifications ─
        await evaluateGate(stationId);

        // ── Step 6: Notify customer ───────────────────────────────────────────
        if (bookingData.customerId) {
            await createNotification(
                bookingData.customerId, NOTIF_TYPE.VEHICLE_SKIPPED,
                '⚠️ Vehicle Skipped',
                `Your vehicle ${vehicleNumber} was skipped (${newSkipCount}/3). Check in again when you're at the pump.`,
                { stationId, bookingId, vehicleNumber, skipCount: newSkipCount }
            );
        }

        // ── Step 7: Notify owner that operator skipped ────────────────────────
        const skipStation = await fetchStationDoc(stationId);
        const skipOwnerId = await fetchOwnerOfStation(stationId, skipStation?.ownerId);
        console.log('[skipVehicle] ownerId for notification:', skipOwnerId);
        if (skipOwnerId) {
            await createNotification(
                skipOwnerId,
                NOTIF_TYPE.OPERATOR_QUEUE_ADVANCE,
                '⏭️ Operator Activity: Skip',
                `Token for ${vehicleNumber} skipped by Operator (${newSkipCount}/3). Queue recompacted.`,
                { stationId, bookingId, vehicleNumber, skipCount: newSkipCount, operatorId }
            );
        }

        return { success: true, skipCount: newSkipCount };
    } catch (error) {
        console.error('Error skipping vehicle:', error);
        return { success: false, error: error.message };
    }
};
