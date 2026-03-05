/**
 * useWaitTime.js
 *
 * Computes accurate, live wait time for a customer's booking:
 *   waitMinutes = vehiclesAhead × avgRefillMinutes
 *
 * avgRefillMinutes is derived from completed bookings in the last 3 days
 * (completedAt - fuelingStartedAt). Falls back to 3 min/vehicle if no data.
 *
 * Auto-refreshes every 5 seconds.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    collection, query, where, getDocs, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';

const DEFAULT_REFILL_MIN = 3;
const REFRESH_MS = 5000;

/**
 * @param {string} stationId
 * @param {number} queuePosition  — current user's position (1-based)
 * @param {string} customerId     — to send TURN_SOON notification
 * @param {string} bookingId      — to deduplicate the TURN_SOON notification
 */
export const useWaitTime = (stationId, queuePosition, customerId, bookingId) => {
    const [waitMinutes, setWaitMinutes]       = useState(null);
    const [vehiclesAhead, setVehiclesAhead]   = useState(null);
    const [avgRefillMin, setAvgRefillMin]     = useState(DEFAULT_REFILL_MIN);
    const turnSoonSentRef = useRef(false); // prevent duplicate notifications

    const computeWait = useCallback(async () => {
        if (!stationId || !queuePosition) return;

        try {
            // 1. Count active vehicles ahead of current user
            const activeSnap = await getDocs(
                query(
                    collection(db, COLLECTIONS.BOOKINGS),
                    where('stationId', '==', stationId),
                    where('status', 'in', ['fueling', 'checked_in', 'eligible', 'waiting']),
                    where('queuePosition', '<', queuePosition)
                )
            );
            const ahead = activeSnap.size;
            setVehiclesAhead(ahead);

            // 2. Compute avg refill time from last 3 days completed bookings
            const threeDaysAgo = Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const completedSnap = await getDocs(
                query(
                    collection(db, COLLECTIONS.BOOKINGS),
                    where('stationId', '==', stationId),
                    where('status', '==', 'completed'),
                    where('completedAt', '>=', threeDaysAgo)
                )
            );

            let totalMs = 0, count = 0;
            completedSnap.forEach(d => {
                const { fuelingStartedAt, completedAt } = d.data();
                if (fuelingStartedAt?.toMillis && completedAt?.toMillis) {
                    const diff = completedAt.toMillis() - fuelingStartedAt.toMillis();
                    if (diff > 0 && diff < 30 * 60 * 1000) { // sanity: < 30 min
                        totalMs += diff;
                        count++;
                    }
                }
            });

            const avgMin = count > 0
                ? Math.max(1, Math.round((totalMs / count) / 60000))
                : DEFAULT_REFILL_MIN;
            setAvgRefillMin(avgMin);

            // 3. Compute total wait
            const wait = ahead * avgMin;
            setWaitMinutes(wait);

            // 4. Fire TURN_SOON when ≤ 2 vehicles ahead (once per session)
            if (ahead <= 2 && ahead > 0 && customerId && bookingId && !turnSoonSentRef.current) {
                turnSoonSentRef.current = true;
                await createNotification(
                    customerId,
                    NOTIF_TYPE.TURN_SOON,
                    '⚡ Almost Your Turn!',
                    `Only ${ahead} vehicle${ahead > 1 ? 's' : ''} ahead. Get ready to fuel up!`,
                    { stationId, bookingId, vehiclesAhead: ahead }
                );
            }
        } catch (err) {
            console.warn('[useWaitTime] error:', err.message);
        }
    }, [stationId, queuePosition, customerId, bookingId]);

    useEffect(() => {
        computeWait();
        const timer = setInterval(computeWait, REFRESH_MS);
        return () => clearInterval(timer);
    }, [computeWait]);

    // Reset TURN_SOON flag when bookingId changes
    useEffect(() => { turnSoonSentRef.current = false; }, [bookingId]);

    return { waitMinutes, vehiclesAhead, avgRefillMin };
};
