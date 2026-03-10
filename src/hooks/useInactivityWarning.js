/**
 * useInactivityWarning.js
 *
 * Watches the station queue in real-time.
 * If the queue has waiting vehicles but this operator has had NO queue_log action
 * in the last 10 minutes, a OPERATOR_INACTIVE notification is sent to the operator.
 *
 * Check runs every 2 minutes (on mount and at each interval tick).
 * A ref prevents duplicate notifications in the same session.
 */
import { useEffect, useRef } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';

const INACTIVITY_MINUTES = 10;
const CHECK_INTERVAL_MS  = 2 * 60 * 1000; // 2 minutes

/**
 * @param {string|null} operatorId  — UID of the logged-in operator
 * @param {string|null} stationId   — custom stationId field (not Firestore doc ID)
 * @param {number}      queueLength — live queue length from useRealtimeQueue
 */
export const useInactivityWarning = (operatorId, stationId, queueLength) => {
    const lastWarnedRef = useRef(null); // timestamp (ms) of last warning sent this session

    useEffect(() => {
        if (!operatorId || !stationId) return;

        const check = async () => {
            // Only bother if there are vehicles waiting
            if (!queueLength || queueLength === 0) return;

            // Don't re-warn within the same 10-minute window
            const now = Date.now();
            if (lastWarnedRef.current && now - lastWarnedRef.current < INACTIVITY_MINUTES * 60 * 1000) return;

            try {
                // Look for any queue_log action by this operator in the last 10 minutes
                const cutoff = Timestamp.fromMillis(now - INACTIVITY_MINUTES * 60 * 1000);

                const logsSnap = await getDocs(
                    query(
                        collection(db, COLLECTIONS.QUEUE_LOGS),
                        where('stationId', '==', stationId),
                        where('performedBy', '==', operatorId),
                        where('timestamp', '>=', cutoff),
                        orderBy('timestamp', 'desc'),
                        limit(1)
                    )
                );

                if (logsSnap.empty) {
                    // No action in the last 10 minutes — send inactivity warning
                    lastWarnedRef.current = now;
                    await createNotification(
                        operatorId,
                        NOTIF_TYPE.OPERATOR_INACTIVE,
                        '⏰ Inactivity Warning',
                        `No queue action recorded in the last ${INACTIVITY_MINUTES} minutes. Please attend to the queue — ${queueLength} vehicle(s) waiting.`,
                        { stationId, queueLength }
                    );
                }
            } catch (err) {
                // Non-fatal — silently ignore (e.g. index not ready)
                console.warn('[useInactivityWarning] check failed:', err.message);
            }
        };

        // Run immediately on mount, then every CHECK_INTERVAL_MS
        check();
        const timer = setInterval(check, CHECK_INTERVAL_MS);
        return () => clearInterval(timer);

    }, [operatorId, stationId, queueLength]);
};
