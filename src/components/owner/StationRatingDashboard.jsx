// StationRatingDashboard — avg rating, breakdown, complaint resolution, and warning
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import './StationRatingDashboard.css';

const StationRatingDashboard = ({ stationId }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!stationId) return;
        fetchStats();
    }, [stationId]);

    const fetchStats = async () => {
        try {
            // Ratings
            const ratingsSnap = await getDocs(
                query(collection(db, COLLECTIONS.RATINGS), where('stationId', '==', stationId))
            );
            const ratingDocs = ratingsSnap.docs.map(d => d.data());
            const total = ratingDocs.length;
            const sum   = ratingDocs.reduce((acc, r) => acc + (r.rating || 0), 0);
            const avg   = total > 0 ? +(sum / total).toFixed(1) : null;

            // Breakdown by star
            const breakdown = [5, 4, 3, 2, 1].map(star => ({
                star,
                count: ratingDocs.filter(r => r.rating === star).length
            }));

            // Complaints resolution
            const complaintsSnap = await getDocs(
                query(collection(db, COLLECTIONS.COMPLAINTS), where('stationId', '==', stationId))
            );
            const allComplaints      = complaintsSnap.size;
            const resolvedComplaints = complaintsSnap.docs.filter(d => d.data().status === 'resolved').length;
            const resolutionRate     = allComplaints > 0 ? Math.round((resolvedComplaints / allComplaints) * 100) : 100;

            setStats({ avg, total, breakdown, allComplaints, resolvedComplaints, resolutionRate });
        } catch (err) {
            console.warn('[StationRatingDashboard]', err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="srd-loading"><div className="spinner" /></div>;
    if (!stats)  return null;

    const renderStars = (rating) => {
        if (!rating) return '—';
        return Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ color: i < Math.round(rating) ? '#f59e0b' : '#d1d5db', fontSize: '1.1rem' }}>★</span>
        ));
    };

    return (
        <div className="srd-container">
            {/* Warning */}
            {stats.avg !== null && stats.avg < 3 && (
                <div className="srd-warning">
                    ⚠️ <strong>Performance Alert:</strong> Average rating dropped below 3.0 ({stats.avg}⭐). Immediate attention required.
                </div>
            )}

            <div className="srd-grid">
                {/* Avg Rating */}
                <div className="srd-card srd-card--main">
                    <div className="srd-avg-num">{stats.avg ?? '—'}</div>
                    <div className="srd-stars">{renderStars(stats.avg)}</div>
                    <div className="srd-label">{stats.total} review{stats.total !== 1 ? 's' : ''}</div>
                </div>

                {/* Star Breakdown */}
                <div className="srd-card srd-card--breakdown">
                    {stats.breakdown.map(({ star, count }) => {
                        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                        return (
                            <div key={star} className="srd-bar-row">
                                <span className="srd-bar-label">{star}★</span>
                                <div className="srd-bar-track">
                                    <div className="srd-bar-fill" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="srd-bar-count">{count}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Complaint Resolution */}
                <div className="srd-card srd-card--complaints">
                    <div className="srd-res-rate" style={{ color: stats.resolutionRate >= 80 ? '#065f46' : stats.resolutionRate >= 50 ? '#92400e' : '#991b1b' }}>
                        {stats.resolutionRate}%
                    </div>
                    <div className="srd-label">Complaint Resolution</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
                        {stats.resolvedComplaints} / {stats.allComplaints} resolved
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StationRatingDashboard;
