// My Booking Component - Shows active booking and queue
import { useState, useEffect } from 'react';
import { doc, getDocs, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { cancelBooking } from '../../utils/queueLogic';
import VisualQueue from '../shared/VisualQueue';
import CheckInPrompt from './CheckInPrompt';
import './MyBooking.css';

const MyBooking = ({ booking, onBookingCancelled }) => {
    const [station, setStation] = useState(null);
    const [liveBooking, setLiveBooking] = useState(booking); // real-time updated copy
    const [loading, setLoading] = useState(true);
    const [showCheckIn, setShowCheckIn] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Real-time listener on the booking document
    useEffect(() => {
        const unsubscribe = onSnapshot(
            doc(db, COLLECTIONS.BOOKINGS, booking.id),
            (snap) => {
                if (snap.exists()) {
                    setLiveBooking({ id: snap.id, ...snap.data() });
                }
            },
            (err) => console.error('Booking listener error:', err)
        );
        return () => unsubscribe();
    }, [booking.id]);

    useEffect(() => {
        fetchStation();
    }, [booking.stationId]);

    useEffect(() => {
        // Auto-show check-in prompt when status becomes eligible
        if (liveBooking.status === 'eligible' && !liveBooking.isCheckedIn) {
            setShowCheckIn(true);
        } else {
            setShowCheckIn(false);
        }
    }, [liveBooking.status, liveBooking.isCheckedIn]);

    const fetchStation = async () => {
        try {
            // booking.stationId is a custom field (e.g. 'STATION_001'), NOT the Firestore doc ID
            // — must query by field, not getDoc by ID
            const q = query(
                collection(db, COLLECTIONS.STATIONS),
                where('stationId', '==', booking.stationId)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const d = snap.docs[0];
                setStation({ id: d.id, ...d.data() });
            } else {
                console.warn('Station not found for stationId:', booking.stationId);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching station:', error);
            setLoading(false);
        }
    };

    const handleCancelBooking = async () => {
        if (!confirm('Are you sure you want to cancel this booking?')) {
            return;
        }

        setCancelling(true);
        const result = await cancelBooking(liveBooking.id, liveBooking.customerId);

        if (result.success) {
            onBookingCancelled();
        } else {
            alert('Failed to cancel booking. Please try again.');
            setCancelling(false);
        }
    };

    const getStatusDisplay = () => {
        switch (liveBooking.status) {
            case 'waiting':
                return { icon: '⏳', text: 'Waiting in Queue', color: 'status-waiting' };
            case 'eligible':
                return {
                    icon: '📍',
                    text: liveBooking.isCheckedIn ? 'Checked-in' : 'Check-in Required',
                    color: liveBooking.isCheckedIn ? 'status-checked-in' : 'status-eligible'
                };
            case 'checked_in':
                return { icon: '✓', text: 'Checked-in', color: 'status-checked-in' };
            case 'fueling':
                return { icon: '⛽', text: 'Currently Fueling', color: 'status-fueling' };
            default:
                return { icon: '📋', text: liveBooking.status, color: '' };
        }
    };

    if (loading) {
        return (
            <div className="my-booking-loading">
                <div className="spinner"></div>
                <p>Loading booking...</p>
            </div>
        );
    }

    const statusDisplay = getStatusDisplay();

    return (
        <div className="my-booking-container">
            {showCheckIn && station && (
                <CheckInPrompt
                    booking={liveBooking}
                    station={station}
                    onCheckInSuccess={() => setShowCheckIn(false)}
                />
            )}

            <div className="booking-header">
                <h2>My Booking</h2>
                <div className={`booking-status ${statusDisplay.color}`}>
                    <span className="status-icon">{statusDisplay.icon}</span>
                    <span className="status-text">{statusDisplay.text}</span>
                </div>
            </div>

            <div className="booking-info-grid">
                <div className="info-card">
                    <div className="info-label">Queue Position</div>
                    <div className="info-value large">#{liveBooking.queuePosition}</div>
                </div>

                <div className="info-card">
                    <div className="info-label">Estimated Wait</div>
                    <div className="info-value">{liveBooking.estimatedWaitMinutes} min</div>
                </div>

                <div className="info-card">
                    <div className="info-label">Vehicle Number</div>
                    <div className="info-value">{liveBooking.vehicleNumber}</div>
                </div>

                <div className="info-card">
                    <div className="info-label">Station</div>
                    <div className="info-value">{station?.name || 'Loading...'}</div>
                </div>
            </div>

            {liveBooking.status === 'eligible' && !liveBooking.isCheckedIn && (
                <div className="check-in-reminder">
                    <p>⚠️ You are now eligible to check-in. Please arrive at the station and check-in within 5 minutes.</p>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowCheckIn(true);
                        }}
                        className="btn btn-primary btn-block"
                    >
                        Check-in Now
                    </button>
                </div>
            )}

            {liveBooking.status === 'fueling' && (
                <div className="fueling-notice">
                    <p>⛽ Your vehicle is currently being fueled. Please wait...</p>
                </div>
            )}

            <div className="queue-section">
                <h3>Live Queue</h3>
                <VisualQueue
                    stationId={booking.stationId}
                    userRole="customer"
                    currentUserId={booking.customerId}
                    maxDisplay={10}
                />
            </div>

            {liveBooking.status !== 'fueling' && liveBooking.status !== 'checked_in' && (
                <button
                    type="button"
                    onClick={handleCancelBooking}
                    className="btn btn-danger btn-block"
                    disabled={cancelling}
                >
                    {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                </button>
            )}
        </div>
    );
};

export default MyBooking;
