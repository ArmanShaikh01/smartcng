// Analytics Component - Station statistics and metrics
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import './Analytics.css';

const Analytics = ({ stationId }) => {
    const [stats, setStats] = useState({
        totalServed: 0,
        totalSkipped: 0,
        totalCancelled: 0,
        currentQueue: 0,
        todayServed: 0
    });
    const [loading, setLoading] = useState(true);

    // Memoize fetchAnalytics to prevent infinite loop
    const fetchAnalytics = useCallback(async () => {
        if (!stationId) {
            setLoading(false);
            return;
        }

        try {
            // Get all completed bookings
            const completedQuery = query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', '==', 'completed')
            );
            const completedSnapshot = await getDocs(completedQuery);

            // Get all skipped bookings
            const skippedQuery = query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', '==', 'skipped')
            );
            const skippedSnapshot = await getDocs(skippedQuery);

            // Get all cancelled bookings
            const cancelledQuery = query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', '==', 'cancelled')
            );
            const cancelledSnapshot = await getDocs(cancelledQuery);

            // Get current queue
            const queueQuery = query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('stationId', '==', stationId),
                where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling'])
            );
            const queueSnapshot = await getDocs(queueQuery);

            // Get today's completed bookings
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayServed = completedSnapshot.docs.filter(doc => {
                const completedAt = doc.data().completedAt?.toDate();
                return completedAt && completedAt >= today;
            }).length;

            setStats({
                totalServed: completedSnapshot.size,
                totalSkipped: skippedSnapshot.size,
                totalCancelled: cancelledSnapshot.size,
                currentQueue: queueSnapshot.size,
                todayServed
            });

            setLoading(false);
        } catch (error) {
            console.error('Error fetching analytics:', error);
            setLoading(false);
        }
    }, [stationId]); // Only recreate when stationId changes

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]); // Now safe to use in dependency array

    if (loading) {
        return (
            <div className="analytics-loading">
                <div className="spinner"></div>
                <p>Loading analytics...</p>
            </div>
        );
    }

    const successRate = stats.totalServed > 0
        ? ((stats.totalServed / (stats.totalServed + stats.totalSkipped + stats.totalCancelled)) * 100).toFixed(1)
        : 0;

    return (
        <div className="analytics-container">
            <h2>Station Analytics</h2>

            <div className="stats-grid">
                <div className="stat-card primary">
                    <div className="stat-icon">✓</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.totalServed}</div>
                        <div className="stat-label">Total Served</div>
                    </div>
                </div>

                <div className="stat-card success">
                    <div className="stat-icon">📊</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.todayServed}</div>
                        <div className="stat-label">Served Today</div>
                    </div>
                </div>

                <div className="stat-card warning">
                    <div className="stat-icon">⏭️</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.totalSkipped}</div>
                        <div className="stat-label">Total Skipped</div>
                    </div>
                </div>

                <div className="stat-card danger">
                    <div className="stat-icon">✗</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.totalCancelled}</div>
                        <div className="stat-label">Cancelled</div>
                    </div>
                </div>

                <div className="stat-card info">
                    <div className="stat-icon">📋</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats.currentQueue}</div>
                        <div className="stat-label">Current Queue</div>
                    </div>
                </div>

                <div className="stat-card success">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-content">
                        <div className="stat-value">{successRate}%</div>
                        <div className="stat-label">Success Rate</div>
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    fetchAnalytics();
                }}
                className="btn btn-outline refresh-btn"
            >
                🔄 Refresh Analytics
            </button>
        </div>
    );
};

export default Analytics;
