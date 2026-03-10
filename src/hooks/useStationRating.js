/**
 * useStationRating.js
 *
 * Fetches ratings for a given station and computes avg rating + total count.
 * Also checks if a specific booking has already been rated (to hide the modal).
 */
import { useState, useEffect } from 'react';
import {
    collection, query, where, getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';

/**
 * @param {string} stationId
 * @param {string} [bookingId] — if provided, also checks if this booking is already rated
 */
export const useStationRating = (stationId, bookingId = null) => {
    const [avgRating, setAvgRating]     = useState(null);
    const [totalRatings, setTotal]      = useState(0);
    const [alreadyRated, setAlready]    = useState(false);
    const [loading, setLoading]         = useState(true);

    useEffect(() => {
        if (!stationId) return;
        let cancelled = false;

        const fetch = async () => {
            try {
                // Fetch all ratings for this station
                const snap = await getDocs(
                    query(
                        collection(db, COLLECTIONS.RATINGS),
                        where('stationId', '==', stationId)
                    )
                );

                let sum = 0, count = 0, rated = false;
                snap.forEach(d => {
                    const data = d.data();
                    sum += data.rating || 0;
                    count++;
                    if (bookingId && data.bookingId === bookingId) rated = true;
                });

                if (!cancelled) {
                    setAvgRating(count > 0 ? +(sum / count).toFixed(1) : null);
                    setTotal(count);
                    setAlready(rated);
                    setLoading(false);
                }
            } catch (err) {
                console.warn('[useStationRating] error:', err.message);
                if (!cancelled) setLoading(false);
            }
        };

        fetch();
        return () => { cancelled = true; };
    }, [stationId, bookingId]);

    return { avgRating, totalRatings, alreadyRated, loading };
};

/**
 * Submit a rating for a station.
 * Returns { success, error }
 */
export const submitRating = async (stationId, customerId, bookingId, rating, comment) => {
    try {
        const { addDoc, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, COLLECTIONS.RATINGS), {
            stationId,
            customerId,
            bookingId,
            rating,
            comment: comment.trim(),
            createdAt: serverTimestamp()
        });
        return { success: true };
    } catch (err) {
        console.error('[submitRating] error:', err);
        return { success: false, error: err.message };
    }
};
