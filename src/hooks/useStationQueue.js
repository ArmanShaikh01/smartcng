/**
 * useStationQueue — Lightweight hook for station list cards.
 *
 * Returns:
 *   queueCount  — number of active vehicles in queue right now
 *   estWaitMin  — estimated wait (minutes) if a new customer joins NOW
 *   loading     — true while first data loads
 *
 * Strategy:
 *   1. Firestore real-time listener on active bookings → queueCount
 *   2. One-time fetch of avg refill time from recent completed bookings
 *   3. estWaitMin = queueCount × avgRefillMin  (fallback: 3 min/vehicle)
 */
import { useState, useEffect, useRef } from 'react';
import {
    collection, query, where, onSnapshot, getDocs, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';

const DEFAULT_MIN = 3; // fallback minutes per vehicle
const AVG_CACHE = {}; // module-level cache to avoid re-fetching on every card

const fetchAvgRefill = async (stationId) => {
    if (AVG_CACHE[stationId] !== undefined) return AVG_CACHE[stationId];

    try {
        const since = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days
        const snap = await getDocs(
            query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', '==', 'completed'),
                where('completedAt', '>=', since)
            )
        );

        let total = 0, count = 0;
        snap.forEach(d => {
            const { fuelingStartedAt, completedAt } = d.data();
            if (fuelingStartedAt?.toMillis && completedAt?.toMillis) {
                const ms = completedAt.toMillis() - fuelingStartedAt.toMillis();
                if (ms > 0 && ms < 30 * 60 * 1000) { total += ms; count++; }
            }
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

    // Real-time listener for active queue
    useEffect(() => {
        if (!stationId) { setLoading(false); return; }

        const q = query(
            collection(db, COLLECTIONS.BOOKINGS),
            where('stationId', '==', stationId),
            where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling'])
        );

        const unsub = onSnapshot(q, (snap) => {
            const count = snap.size;
            setQueueCount(count);
            setEstWaitMin(count * avgRef.current);
            setLoading(false);
        }, () => {
            setLoading(false);
        });

        return () => unsub();
    }, [stationId]);

    return { queueCount, estWaitMin, loading };
};
