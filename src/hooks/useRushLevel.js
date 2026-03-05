/**
 * useRushLevel.js
 *
 * Analyses last 7 days of booking data for a station and computes:
 *  - currentRush: 'low' | 'medium' | 'high' for the current hour
 *  - bestHour: the quietest hour (0–23) historically
 *  - hourlyAvg: array of 24 numbers (avg bookings per hour)
 *
 * Classification thresholds (bookings / hour):
 *   Low    < 5
 *   Medium 5 – 10
 *   High   > 10
 */
import { useState, useEffect } from 'react';
import {
    collection, query, where, getDocs, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';

const LOW_THRESHOLD  = 5;
const HIGH_THRESHOLD = 10;

export const useRushLevel = (stationId) => {
    const [currentRush, setCurrentRush] = useState('low');
    const [bestHour, setBestHour]       = useState(null);
    const [hourlyAvg, setHourlyAvg]     = useState(Array(24).fill(0));
    const [loading, setLoading]         = useState(true);

    useEffect(() => {
        if (!stationId) return;
        let cancelled = false;

        const analyse = async () => {
            try {
                const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

                const snap = await getDocs(
                    query(
                        collection(db, COLLECTIONS.BOOKINGS),
                        where('stationId', '==', stationId),
                        where('createdAt', '>=', sevenDaysAgo)
                    )
                );

                // Accumulate booking counts per hour across 7 days
                const counts = Array(24).fill(0);
                snap.forEach(d => {
                    const ts = d.data().createdAt;
                    if (ts?.toDate) {
                        const hour = ts.toDate().getHours();
                        counts[hour]++;
                    }
                });

                // Average over 7 days
                const avg = counts.map(c => +(c / 7).toFixed(1));

                // Find quietest hour (exclude midnight–5 AM as station may be closed)
                let minVal = Infinity, minHour = 9;
                for (let h = 6; h <= 22; h++) {
                    if (avg[h] < minVal) { minVal = avg[h]; minHour = h; }
                }

                // Current hour rush
                const nowHour = new Date().getHours();
                const nowAvg  = avg[nowHour];
                const rush = nowAvg < LOW_THRESHOLD ? 'low'
                    : nowAvg <= HIGH_THRESHOLD ? 'medium' : 'high';

                if (!cancelled) {
                    setHourlyAvg(avg);
                    setBestHour(minHour);
                    setCurrentRush(rush);
                    setLoading(false);
                }
            } catch (err) {
                console.warn('[useRushLevel] error:', err.message);
                if (!cancelled) setLoading(false);
            }
        };

        analyse();
        return () => { cancelled = true; };
    }, [stationId]);

    return { currentRush, bestHour, hourlyAvg, loading };
};

/** Helper: format hour like "2 PM", "10 AM" */
export const formatHour = (h) => {
    if (h === null) return '—';
    const period = h < 12 ? 'AM' : 'PM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display} ${period}`;
};
