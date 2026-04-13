// Hook for real-time queue updates
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';

const ACTIVE_STATUSES = ['waiting', 'eligible', 'checked_in', 'fueling'];

/**
 * Hook to listen to real-time queue updates for a station.
 *
 * NOTE: Uses single where clause (stationId only) — Firestore requires
 * composite indexes for compound queries (where + in + orderBy etc).
 * Since none are configured, all filtering and sorting is done in JS.
 *
 * @param {string} stationId - Station ID
 * @returns {{ queue: Array, loading: boolean, error: any }}
 */
export const useRealtimeQueue = (stationId) => {
    const [queue, setQueue]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState(null);

    useEffect(() => {
        if (!stationId) {
            setQueue([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Single where clause — no composite index required
        const q = query(
            collection(db, COLLECTIONS.BOOKINGS),
            where('stationId', '==', stationId)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const bookings = snapshot.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(b => ACTIVE_STATUSES.includes(b.status))   // JS filter
                    .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0)); // JS sort

                setQueue(bookings);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('[useRealtimeQueue] snapshot error:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [stationId]);

    return { queue, loading, error };
};
