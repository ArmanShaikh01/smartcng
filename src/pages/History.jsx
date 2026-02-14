// Booking History Page - View past bookings
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/shared/Navbar';
import './History.css';

const History = () => {
    const { user } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, completed, cancelled, skipped

    useEffect(() => {
        fetchHistory();
    }, [user, filter]);

    const fetchHistory = async () => {
        if (!user) return;

        try {
            let q = query(
                collection(db, COLLECTIONS.BOOKINGS),
                where('customerId', '==', user.uid),
                orderBy('bookedAt', 'desc'),
                limit(50)
            );

            if (filter !== 'all') {
                q = query(
                    collection(db, COLLECTIONS.BOOKINGS),
                    where('customerId', '==', user.uid),
                    where('status', '==', filter),
                    orderBy('bookedAt', 'desc'),
                    limit(50)
                );
            }

            const snapshot = await getDocs(q);
            const bookingsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setBookings(bookingsData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching history:', error);
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            completed: { text: 'Completed', class: 'success' },
            cancelled: { text: 'Cancelled', class: 'danger' },
            skipped: { text: 'Skipped', class: 'warning' }
        };
        return badges[status] || { text: status, class: 'info' };
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate();
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="history-page">
            <Navbar title="Booking History" />

            <div className="history-content">
                <div className="history-header">
                    <h1>My Bookings</h1>
                    <div className="history-filters">
                        <button
                            onClick={() => setFilter('all')}
                            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('completed')}
                            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                        >
                            Completed
                        </button>
                        <button
                            onClick={() => setFilter('cancelled')}
                            className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
                        >
                            Cancelled
                        </button>
                        <button
                            onClick={() => setFilter('skipped')}
                            className={`filter-btn ${filter === 'skipped' ? 'active' : ''}`}
                        >
                            Skipped
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="history-loading">
                        <div className="spinner"></div>
                        <p>Loading history...</p>
                    </div>
                ) : bookings.length === 0 ? (
                    <div className="history-empty">
                        <p>📋 No bookings found</p>
                    </div>
                ) : (
                    <div className="bookings-list">
                        {bookings.map(booking => {
                            const badge = getStatusBadge(booking.status);
                            return (
                                <div key={booking.id} className="booking-card card">
                                    <div className="booking-card-header">
                                        <div className="booking-vehicle">{booking.vehicleNumber}</div>
                                        <span className={`status-badge ${badge.class}`}>
                                            {badge.text}
                                        </span>
                                    </div>

                                    <div className="booking-details">
                                        <div className="detail-row">
                                            <span className="detail-label">Station:</span>
                                            <span className="detail-value">{booking.stationId}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Booked:</span>
                                            <span className="detail-value">{formatDate(booking.bookedAt)}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Queue Position:</span>
                                            <span className="detail-value">#{booking.queuePosition}</span>
                                        </div>
                                        {booking.completedAt && (
                                            <div className="detail-row">
                                                <span className="detail-label">Completed:</span>
                                                <span className="detail-value">{formatDate(booking.completedAt)}</span>
                                            </div>
                                        )}
                                        {booking.isCheckedIn && (
                                            <div className="detail-row">
                                                <span className="detail-label">Check-in:</span>
                                                <span className="detail-value success">✓ Checked-in</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;
