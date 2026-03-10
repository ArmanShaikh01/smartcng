// Booking History Page - View past bookings + complaints
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/shared/Navbar';
import ComplaintTracker from '../components/customer/ComplaintTracker';
import Icon from '../components/shared/Icon';
import './History.css';

const History = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab]   = useState('bookings'); // 'bookings' | 'complaints'
    const [bookings, setBookings]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [filter, setFilter]         = useState('all');


    useEffect(() => {
        if (activeTab === 'bookings') fetchHistory();
    }, [user, filter, activeTab]);

    const fetchHistory = async () => {
        if (!user) return;
        setLoading(true);
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
            setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            completed: { text: 'Completed', class: 'success' },
            cancelled: { text: 'Cancelled', class: 'danger' },
            skipped:   { text: 'Skipped',   class: 'warning' }
        };
        return badges[status] || { text: status, class: 'info' };
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return timestamp.toDate().toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="history-page">
            <Navbar title="History" />


            <div className="history-content">
                <div className="history-header">
                    <h1>My Activity</h1>

                    {/* Main tabs */}
                    <div className="history-main-tabs">
                        <button
                            type="button"
                            className={`hmtab ${activeTab === 'bookings' ? 'hmtab--active' : ''}`}
                            onClick={() => setActiveTab('bookings')}
                        >
                            <Icon name="history" size={15} /> Bookings
                        </button>
                        <button
                            type="button"
                            className={`hmtab ${activeTab === 'complaints' ? 'hmtab--active' : ''}`}
                            onClick={() => setActiveTab('complaints')}
                        >
                            <Icon name="alertTriangle" size={15} /> Complaints
                        </button>
                    </div>
                </div>

                {/* ── BOOKINGS TAB ── */}
                {activeTab === 'bookings' && (
                    <>
                        <div className="history-filters">
                            {['all','completed','cancelled','skipped'].map(f => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className={`filter-btn ${filter === f ? 'active' : ''}`}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="history-loading">
                                <div className="spinner" /><p>Loading history...</p>
                            </div>
                        ) : bookings.length === 0 ? (
                            <div className="history-empty"><p>📋 No bookings found</p></div>
                        ) : (
                            <div className="bookings-list">
                                {bookings.map(booking => {
                                    const badge = getStatusBadge(booking.status);
                                    return (
                                        <div key={booking.id} className="booking-card card">
                                            <div className="booking-card-header">
                                                <div className="booking-vehicle">{booking.vehicleNumber}</div>
                                                <span className={`status-badge ${badge.class}`}>{badge.text}</span>
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
                    </>
                )}

                {/* ── COMPLAINTS TAB ── */}
                {activeTab === 'complaints' && (
                    <div style={{ paddingTop: 8 }}>
    
                        <ComplaintTracker customerId={user?.uid} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;
