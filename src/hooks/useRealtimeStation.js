// Hook for real-time station updates
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';

/**
 * Hook to listen to real-time station updates
 * @param {string} stationId - Station ID (field value, not document ID)
 * @returns {object} Station data with loading and error states
 */
export const useRealtimeStation = (stationId) => {
    const [station, setStation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!stationId) {
            setStation(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Query by stationId field, not document ID
        const q = query(
            collection(db, COLLECTIONS.STATIONS),
            where('stationId', '==', stationId)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    setStation({
                        id: doc.id,
                        ...doc.data()
                    });
                    setError(null);
                } else {
                    setStation(null);
                    setError('Station not found');
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error listening to station:', err);
                setError(err.message);
                setStation(null);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [stationId]);

    return { station, loading, error };
};
