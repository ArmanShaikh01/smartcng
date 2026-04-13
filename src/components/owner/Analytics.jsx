// Analytics Component - Station statistics and metrics
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import Icon from '../shared/Icon';
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

    const fetchAnalytics = useCallback(async () => {
        if (!stationId) { setLoading(false); return; }
        try {
            // Single query — filter all statuses in JS (no composite index needed)
            const allSnap = await getDocs(
                query(collection(db, COLLECTIONS.BOOKINGS), where('stationId', '==', stationId))
            );
            const all = allSnap.docs.map(d => d.data());

            const ACTIVE = ['waiting', 'eligible', 'checked_in', 'fueling'];
            const today  = new Date(); today.setHours(0, 0, 0, 0);

            const totalServed    = all.filter(b => b.status === 'completed').length;
            const totalSkipped   = all.filter(b => b.status === 'skipped' || b.status === 'no_show').length;
            const totalCancelled = all.filter(b => b.status === 'cancelled').length;
            const currentQueue   = all.filter(b => ACTIVE.includes(b.status)).length;
            const todayServed    = all.filter(b => {
                if (b.status !== 'completed') return false;
                const t = b.completedAt?.toDate?.();
                return t && t >= today;
            }).length;

            setStats({ totalServed, totalSkipped, totalCancelled, currentQueue, todayServed });
            setLoading(false);
        } catch (err) {
            console.error('Error fetching analytics:', err);
            setLoading(false);
        }
    }, [stationId]);

    useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

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

    const statCards = [
        { iconName: 'checkCircle',  label: 'Total Served',  value: stats.totalServed,    variant: 'primary' },
        { iconName: 'barChart',     label: 'Served Today',  value: stats.todayServed,    variant: 'success' },
        { iconName: 'skipForward',  label: 'Total Skipped', value: stats.totalSkipped,   variant: 'warning' },
        { iconName: 'xCircle',      label: 'Cancelled',     value: stats.totalCancelled, variant: 'danger'  },
        { iconName: 'list',         label: 'Current Queue', value: stats.currentQueue,   variant: 'info'    },
        { iconName: 'activity',     label: 'Success Rate',  value: `${successRate}%`,    variant: 'success' },
    ];

    return (
        <div className="analytics-container">
            <h2>Station Analytics</h2>

            <div className="stats-grid">
                {statCards.map(({ iconName, label, value, variant }) => (
                    <div key={label} className={`stat-card ${variant}`}>
                        <div className="stat-icon">
                            <Icon name={iconName} size={22} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{value}</div>
                            <div className="stat-label">{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fetchAnalytics(); }}
                className="btn btn-outline refresh-btn"
            >
                <Icon name="activity" size={14} /> Refresh Analytics
            </button>
        </div>
    );
};

export default Analytics;
