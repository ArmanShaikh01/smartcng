// My Booking Component - Shows active booking and queue
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { cancelBooking } from '../../utils/queueLogic';
import VisualQueue from '../shared/VisualQueue';
import CheckInPrompt from './CheckInPrompt';
import './MyBooking.css';

const MyBooking = ({ booking, onBookingCancelled }) => {
    const [station, setStation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCheckIn, setShowCheckIn] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        fetchStation();
    }, [booking.stationId]);

    useEffect(() => {
        // Show check-in prompt if eligible and not checked in
        if (booking.status === 'eligible' && !booking.isCheckedIn) {
            setShowCheckIn(true);
        } else {
            setShowCheckIn(false);
        }
    }, [booking.status, booking.isCheckedIn]);

    const fetchStation = async () => {
        try {
            const stationDoc = await getDoc(doc(db, COLLECTIONS.STATIONS, booking.stationId));
            if (stationDoc.exists()) {
                setStation({ id: stationDoc.id, ...stationDoc.data() });
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
        const result = await cancelBooking(booking.id, booking.customerId);

        if (result.success) {
            onBookingCancelled();
        } else {
            alert('Failed to cancel booking. Please try again.');
            setCancelling(false);
        }
    };

    const getStatusDisplay = () => {
        switch (booking.status) {
            case 'waiting':
                return {
                    icon: '⏳',
                    text: 'Waiting in Queue',
                    color: 'status-waiting'
                };
            case 'eligible':
                return {
                    icon: '📍',
                    text: booking.isCheckedIn ? 'Checked-in' : 'Check-in Required',
                    color: booking.isCheckedIn ? 'status-checked-in' : 'status-eligible'
                };
            case 'checked_in':
                return {
                    icon: '✓',
                    text: 'Checked-in',
                    color: 'status-checked-in'
                };
            case 'fueling':
                return {
                    icon: '⛽',
                    text: 'Currently Fueling',
                    color: 'status-fueling'
                };
            default:
                return {
                    icon: '📋',
                    text: booking.status,
                    color: ''
                };
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
                    booking={booking}
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
                    <div className="info-value large">#{booking.queuePosition}</div>
                </div>

                <div className="info-card">
                    <div className="info-label">Estimated Wait</div>
                    <div className="info-value">{booking.estimatedWaitMinutes} min</div>
                </div>

                <div className="info-card">
                    <div className="info-label">Vehicle Number</div>
                    <div className="info-value">{booking.vehicleNumber}</div>
                </div>

                <div className="info-card">
                    <div className="info-label">Station</div>
                    <div className="info-value">{station?.name || 'Loading...'}</div>
                </div>
            </div>

            {booking.status === 'eligible' && !booking.isCheckedIn && (
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

            {booking.status === 'fueling' && (
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

            {booking.status !== 'fueling' && (
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
