// Hook for real-time queue updates
import { useState, useEffect } from 'react';
import { listenToQuery, COLLECTIONS } from '../firebase/firestore';

/**
 * Hook to listen to real-time queue updates for a station
 * @param {string} stationId - Station ID
 * @returns {Array} Array of booking objects sorted by queue position
 */
export const useRealtimeQueue = (stationId) => {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!stationId) {
            setQueue([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const filters = [
            { field: 'stationId', operator: '==', value: stationId },
            { field: 'status', operator: 'in', value: ['waiting', 'eligible', 'checked_in', 'fueling'] }
        ];

        const unsubscribe = listenToQuery(
            COLLECTIONS.BOOKINGS,
            filters,
            (snapshot) => {
                const bookings = [];
                snapshot.forEach((doc) => {
                    bookings.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                // Sort by queue position
                bookings.sort((a, b) => a.queuePosition - b.queuePosition);

                setQueue(bookings);
                setLoading(false);
                setError(null);
            },
            'queuePosition'
        );

        return () => unsubscribe();
    }, [stationId]);

    return { queue, loading, error };
};
