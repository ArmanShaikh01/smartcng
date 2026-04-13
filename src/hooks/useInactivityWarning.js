/**
 * useInactivityWarning.js
 *
 * Watches the station queue in real-time.
 * If the queue has waiting vehicles but this operator has had NO queue_log action
 * in the last 10 minutes, an OPERATOR_INACTIVE notification is sent to the operator.
 *
 * NOTE: Uses single where clause (performedBy only) — compound queries require
 * composite indexes which aren't configured. Time + station filtering done in JS.
 */
import { useEffect, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';

const INACTIVITY_MINUTES = 10;
const CHECK_INTERVAL_MS  = 2 * 60 * 1000; // 2 minutes

export const useInactivityWarning = (operatorId, stationId, queueLength) => {
    const lastWarnedRef = useRef(null);

    useEffect(() => {
        if (!operatorId || !stationId) return;

        const check = async () => {
            if (!queueLength || queueLength === 0) return;

            const now = Date.now();
            if (lastWarnedRef.current && now - lastWarnedRef.current < INACTIVITY_MINUTES * 60 * 1000) return;

            try {
                const cutoffMs = now - INACTIVITY_MINUTES * 60 * 1000;

                // Single where clause (performedBy) — filter stationId + time in JS
                const logsSnap = await getDocs(
                    query(
                        collection(db, COLLECTIONS.QUEUE_LOGS),
                        where('performedBy', '==', operatorId)
                    )
                );

                // Check if any log for this station exists within the last 10 minutes
                const hasRecentAction = logsSnap.docs.some(d => {
                    const data = d.data();
                    if (data.stationId !== stationId) return false;
                    const tsMs = data.timestamp?.toMillis?.() ?? data.timestamp?.seconds * 1000 ?? 0;
                    return tsMs >= cutoffMs;
                });

                if (!hasRecentAction) {
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
                console.warn('[useInactivityWarning] check failed:', err.message);
            }
        };

        check();
        const timer = setInterval(check, CHECK_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [operatorId, stationId, queueLength]);
};
