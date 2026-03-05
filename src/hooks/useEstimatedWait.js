/**
 * useEstimatedWait.js
 *
 * Real-time hook that tells a customer:
 *   "If you book NOW at this station, you'll wait ~X minutes."
 *
 * Uses onSnapshot for live queue count, then:
 *   estimatedMinutes = queueLength × avgRefillMin
 *
 * avgRefillMin is derived from completed bookings in the last 3 days.
 * Falls back to 3 min/vehicle when there's no historical data.
 */
import { useState, useEffect, useRef } from 'react';
import {
    collection, query, where, onSnapshot, getDocs, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';

const DEFAULT_REFILL_MIN = 3;
const AVG_REFRESH_MS = 60_000; // re-calc avg refill every 60 s (not every snapshot)

export const useEstimatedWait = (stationId) => {
    const [queueLength, setQueueLength] = useState(0);
    const [estimatedMinutes, setEstimatedMinutes] = useState(null);
    const [loading, setLoading] = useState(true);
    const avgRef = useRef(DEFAULT_REFILL_MIN);

    // ── 1. Compute average refill time from recent completed bookings ────────
    useEffect(() => {
        if (!stationId) return;

        let cancelled = false;

        const fetchAvg = async () => {
            try {
                const threeDaysAgo = Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);
                const snap = await getDocs(
                    query(
                        collection(db, COLLECTIONS.BOOKINGS),
                        where('stationId', '==', stationId),
                        where('status', '==', 'completed'),
                        where('completedAt', '>=', threeDaysAgo)
                    )
                );

                let totalMs = 0, count = 0;
                snap.forEach(d => {
                    const { fuelingStartedAt, completedAt } = d.data();
                    if (fuelingStartedAt?.toMillis && completedAt?.toMillis) {
                        const diff = completedAt.toMillis() - fuelingStartedAt.toMillis();
                        if (diff > 0 && diff < 30 * 60 * 1000) { // sanity: < 30 min
                            totalMs += diff;
                            count++;
                        }
                    }
                });

                if (!cancelled) {
                    avgRef.current = count > 0
                        ? Math.max(1, Math.round((totalMs / count) / 60_000))
                        : DEFAULT_REFILL_MIN;
                }
            } catch { /* non-fatal */ }
        };

        fetchAvg();
        const timer = setInterval(fetchAvg, AVG_REFRESH_MS);
        return () => { cancelled = true; clearInterval(timer); };
    }, [stationId]);

    // ── 2. Real-time listener on active bookings for this station ─────────────
    useEffect(() => {
        if (!stationId) { setLoading(false); return; }

        const q = query(
            collection(db, COLLECTIONS.BOOKINGS),
            where('stationId', '==', stationId),
            where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling'])
        );

        const unsub = onSnapshot(q, (snap) => {
            const len = snap.size;
            setQueueLength(len);
            setEstimatedMinutes(len * avgRef.current);
            setLoading(false);
        }, () => {
            // on error, just stop loading
            setLoading(false);
        });

        return unsub;
    }, [stationId]);

    return { estimatedMinutes, queueLength, loading };
};
