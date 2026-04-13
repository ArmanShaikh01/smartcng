/**
 * useOwnerMonitoring.js — Owner Dashboard Monitoring Hook
 *
 * Monitors the following conditions and sends Firestore notifications to owner:
 *   1. Queue Congestion  — avg wait > 45 mins → Orange alert (checks every 5 min)
 *   2. Shift Summary     — every 4 hours, report vehicles fueled in last 4h → Purple
 *   3. Operator Offline  — operator dashboard inactive 10+ mins with waiting queue → Red
 *
 * All intervals are cleared automatically on unmount.
 * Guards prevent duplicate notifications within the same window.
 *
 * NOTE: Uses single-field Firestore queries (stationId only) to avoid
 * composite index requirements. All filtering is done in JavaScript.
 */
import { useEffect, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../firebase/notifications';

// ─── Thresholds ──────────────────────────────────────────────────────────────
const CONGESTION_AVG_WAIT_MIN   = 45;   // minutes — alert if avg wait > this
const CONGESTION_CHECK_INTERVAL = 5 * 60 * 1000;   // 5 minutes
const SHIFT_SUMMARY_INTERVAL    = 4 * 60 * 60 * 1000; // 4 hours
const OPERATOR_OFFLINE_MINS     = 10;   // minutes
const OPERATOR_CHECK_INTERVAL   = 2 * 60 * 1000;   // check every 2 minutes

// ─── Cooldown: prevent re-sending same type of alert within N ms ─────────────
const CONGESTION_COOLDOWN  = 30 * 60 * 1000;  // 30 min
const OPERATOR_COOLDOWN    = 15 * 60 * 1000;  // 15 min

/**
 * @param {string}  stationId   — station being monitored
 * @param {string}  ownerId     — UID of the owner to notify
 * @param {Array}   queue       — live queue array from useRealtimeQueue
 * @param {object}  station     — live station doc from useRealtimeStation
 */
export const useOwnerMonitoring = (stationId, ownerId, queue, station) => {
    const lastCongestionAlert  = useRef(0);
    const lastOperatorAlert    = useRef(0);
    const lastShiftSummary     = useRef(Date.now()); // start cycle from now

    // ── 1. Queue Congestion Monitor ──────────────────────────────────────────
    useEffect(() => {
        if (!stationId || !ownerId) return;

        const checkCongestion = async () => {
            try {
                // Cooldown guard
                if (Date.now() - lastCongestionAlert.current < CONGESTION_COOLDOWN) return;

                // Fetch active bookings (single where, filter in JS)
                const snap = await getDocs(
                    query(collection(db, COLLECTIONS.BOOKINGS), where('stationId', '==', stationId))
                );
                const active = snap.docs
                    .map(d => d.data())
                    .filter(b => ['waiting', 'eligible', 'checked_in'].includes(b.status));

                if (active.length === 0) return;

                // Avg wait = average estimatedWaitMinutes of all active bookings
                const totalWait = active.reduce((sum, b) => sum + (b.estimatedWaitMinutes || 0), 0);
                const avgWait   = totalWait / active.length;

                if (avgWait > CONGESTION_AVG_WAIT_MIN) {
                    lastCongestionAlert.current = Date.now();
                    await createNotification(
                        ownerId,
                        NOTIF_TYPE.QUEUE_CONGESTION,
                        '📉 Efficiency Alert',
                        `Average wait time has exceeded ${Math.round(avgWait)} mins. Check station flow.`,
                        { stationId, avgWaitMinutes: Math.round(avgWait), queueLength: active.length }
                    );
                }
            } catch (err) {
                console.warn('[useOwnerMonitoring] Congestion check failed:', err.message);
            }
        };

        checkCongestion(); // immediate first run
        const timer = setInterval(checkCongestion, CONGESTION_CHECK_INTERVAL);
        return () => clearInterval(timer);
    }, [stationId, ownerId]);

    // ── 2. Shift Summary (every 4 hours) ────────────────────────────────────
    useEffect(() => {
        if (!stationId || !ownerId) return;

        const sendShiftSummary = async () => {
            try {
                const fourHoursAgo = Date.now() - SHIFT_SUMMARY_INTERVAL;

                const snap = await getDocs(
                    query(collection(db, COLLECTIONS.BOOKINGS), where('stationId', '==', stationId))
                );

                const recentCompleted = snap.docs
                    .map(d => d.data())
                    .filter(b => {
                        if (b.status !== 'completed') return false;
                        const completedMs = b.completedAt?.toMillis?.() ?? b.completedAt?.seconds * 1000;
                        return completedMs && completedMs >= fourHoursAgo;
                    });

                await createNotification(
                    ownerId,
                    NOTIF_TYPE.SHIFT_SUMMARY,
                    '📊 Shift Update',
                    `${recentCompleted.length} vehicle${recentCompleted.length !== 1 ? 's' : ''} fueled in the last 4 hours.`,
                    { stationId, totalCompleted: recentCompleted.length }
                );
            } catch (err) {
                console.warn('[useOwnerMonitoring] Shift summary failed:', err.message);
            }
        };

        // Run every 4 hours
        const timer = setInterval(sendShiftSummary, SHIFT_SUMMARY_INTERVAL);
        return () => clearInterval(timer);
    }, [stationId, ownerId]);

    // ── 3. Operator Offline Monitor ──────────────────────────────────────────
    // Checks if any operator's lastActiveAt is stale while queue is non-empty
    useEffect(() => {
        if (!stationId || !ownerId) return;

        const checkOperatorOnline = async () => {
            try {
                if (Date.now() - lastOperatorAlert.current < OPERATOR_COOLDOWN) return;

                const activeQueue = (queue || []).filter(b =>
                    ['waiting', 'eligible', 'checked_in'].includes(b.status)
                );
                if (activeQueue.length === 0) return;

                // Get operator IDs — from users collection (reliable, single where clause)
                const usersSnap = await getDocs(
                    query(collection(db, COLLECTIONS.USERS), where('stationId', '==', stationId))
                );
                const operatorIds = usersSnap.docs
                    .filter(d => d.data().role === 'operator')
                    .map(d => d.data().userId || d.id);

                if (operatorIds.length === 0) return;

                const cutoff = Date.now() - OPERATOR_OFFLINE_MINS * 60 * 1000;
                let anyOffline = false;

                for (const opId of operatorIds) {
                    const opDoc = usersSnap.docs.find(d =>
                        (d.data().userId || d.id) === opId
                    );
                    if (!opDoc) continue;
                    const profile = opDoc.data();
                    const lastActive = profile.lastActiveAt?.toMillis?.()
                        ?? (profile.lastActiveAt?.seconds * 1000)
                        ?? 0;

                    if (lastActive < cutoff) {
                        anyOffline = true;
                        break;
                    }
                }

                if (anyOffline) {
                    lastOperatorAlert.current = Date.now();
                    await createNotification(
                        ownerId,
                        NOTIF_TYPE.OPERATOR_OFFLINE,
                        '⚠️ Attention: Operator Inactive',
                        `Operator dashboard inactive for ${OPERATOR_OFFLINE_MINS}+ mins with ${activeQueue.length} vehicle${activeQueue.length !== 1 ? 's' : ''} waiting.`,
                        { stationId, queueLength: activeQueue.length }
                    );
                }
            } catch (err) {
                console.warn('[useOwnerMonitoring] Operator check failed:', err.message);
            }
        };

        const timer = setInterval(checkOperatorOnline, OPERATOR_CHECK_INTERVAL);
        return () => clearInterval(timer);
    }, [stationId, ownerId, queue]);
};
