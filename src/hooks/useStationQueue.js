/**
 * useStationQueue — Lightweight hook for station list cards.
 *
 * Returns:
 *   queueCount  — number of active vehicles in queue right now
 *   estWaitMin  — estimated wait (minutes) if a new customer joins NOW
 *   loading     — true while first data loads
 *
 * NOTE: Uses single where clause (stationId only) — Firestore requires
 * composite indexes for compound queries. All filtering done in JS.
 */
import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';

const DEFAULT_MIN  = 3;
const ACTIVE_STATUSES = ['waiting', 'eligible', 'checked_in', 'fueling'];
const AVG_CACHE    = {};

// Single where clause — no composite index needed
const fetchAvgRefill = async (stationId) => {
    if (AVG_CACHE[stationId] !== undefined) return AVG_CACHE[stationId];
    try {
        const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const snap = await getDocs(
            query(collection(db, COLLECTIONS.BOOKINGS), where('stationId', '==', stationId))
        );

        let total = 0, count = 0;
        snap.forEach(d => {
            const { status, fuelingStartedAt, completedAt } = d.data();
            if (status !== 'completed') return;
            const completedMs = completedAt?.toMillis?.() ?? completedAt?.seconds * 1000;
            if (!completedMs || completedMs < since) return;
            const startMs = fuelingStartedAt?.toMillis?.() ?? fuelingStartedAt?.seconds * 1000;
            if (!startMs) return;
            const ms = completedMs - startMs;
            if (ms > 0 && ms < 30 * 60 * 1000) { total += ms; count++; }
        });

        const avg = count > 0
            ? Math.max(1, Math.round((total / count) / 60000))
            : DEFAULT_MIN;
        AVG_CACHE[stationId] = avg;
        return avg;
    } catch {
        AVG_CACHE[stationId] = DEFAULT_MIN;
        return DEFAULT_MIN;
    }
};

export const useStationQueue = (stationId) => {
    const [queueCount, setQueueCount] = useState(null);
    const [estWaitMin, setEstWaitMin] = useState(null);
    const [loading, setLoading]       = useState(true);
    const avgRef = useRef(DEFAULT_MIN);

    // Fetch avg refill time once
    useEffect(() => {
        if (!stationId) return;
        fetchAvgRefill(stationId).then(avg => { avgRef.current = avg; });
    }, [stationId]);

    // Real-time listener — single stationId where clause, filter in JS
    useEffect(() => {
        if (!stationId) { setLoading(false); return; }

        const q = query(
            collection(db, COLLECTIONS.BOOKINGS),
            where('stationId', '==', stationId)
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const count = snap.docs.filter(d => ACTIVE_STATUSES.includes(d.data().status)).length;
                setQueueCount(count);
                setEstWaitMin(count * avgRef.current);
                setLoading(false);
            },
            () => { setLoading(false); }
        );

        return () => unsub();
    }, [stationId]);

    return { queueCount, estWaitMin, loading };
};
