// My Booking Component - Enhanced with live wait time, auto-cancel, ratings, complaints
import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDocs, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { cancelBooking } from '../../utils/queueLogic';
import { useWaitTime } from '../../hooks/useWaitTime';
import { useStationRating } from '../../hooks/useStationRating';
import { toast } from '../../utils/toast';
import { confirm } from '../../utils/confirm';
import VisualQueue from '../shared/VisualQueue';
import CheckInPrompt from './CheckInPrompt';
import RatingModal from './RatingModal';
import ComplaintForm from './ComplaintForm';
import ComplaintTracker from './ComplaintTracker';
import './MyBooking.css';

const AUTO_CANCEL_SECONDS = 10 * 60; // 10 minutes

const MyBooking = ({ booking, onBookingCancelled }) => {
    const [station, setStation] = useState(null);
    const [liveBooking, setLiveBooking] = useState(booking);
    const [loading, setLoading] = useState(true);
    const [showCheckIn, setShowCheckIn] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // New feature states
    const [showRating, setShowRating] = useState(false);
    const [showComplaint, setShowComplaint] = useState(false);
    const [showTracker, setShowTracker] = useState(false);
    const [countdown, setCountdown] = useState(null); // seconds remaining
    const ratingShownRef = useRef(false);
    const eligibleAtRef = useRef(null);
    const countdownTimerRef = useRef(null);

    // Live wait time hook (auto-refreshes every 5s, fires TURN_SOON at ≤2 ahead)
    const { waitMinutes, vehiclesAhead } = useWaitTime(
        booking.stationId,
        liveBooking.queuePosition,
        booking.customerId,
        booking.id
    );

    // Station rating data
    const { alreadyRated } = useStationRating(booking.stationId, booking.id);

    // ── Real-time booking listener ─────────────────────────────────────────
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

    // ── Check-in prompt ───────────────────────────────────────────────────
    useEffect(() => {
        if (liveBooking.status === 'eligible' && !liveBooking.isCheckedIn) {
            setShowCheckIn(true);
        } else {
            setShowCheckIn(false);
        }
    }, [liveBooking.status, liveBooking.isCheckedIn]);

    // ── Auto-cancel countdown (10 min from when eligible) ─────────────────
    useEffect(() => {
        // Start countdown when status becomes eligible and not yet checked in
        if (liveBooking.status === 'eligible' && !liveBooking.isCheckedIn) {
            if (!eligibleAtRef.current) {
                // Use eligibleAt from Firestore if available, else now
                const eligibleMs = liveBooking.eligibleAt?.toMillis?.() ?? Date.now();
                eligibleAtRef.current = eligibleMs;
            }

            countdownTimerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - eligibleAtRef.current) / 1000);
                const remaining = AUTO_CANCEL_SECONDS - elapsed;

                if (remaining <= 0) {
                    clearInterval(countdownTimerRef.current);
                    setCountdown(0);
                    // Auto-cancel
                    cancelBooking(booking.id, booking.customerId).then(r => {
                        if (r.success) onBookingCancelled();
                    });
                } else {
                    setCountdown(remaining);
                }
            }, 1000);
        } else {
            // Not eligible or already checked in — clear timer
            clearInterval(countdownTimerRef.current);
            setCountdown(null);
            eligibleAtRef.current = null;
        }

        return () => clearInterval(countdownTimerRef.current);
    }, [liveBooking.status, liveBooking.isCheckedIn]);

    // ── Show rating modal when booking completes ───────────────────────────
    useEffect(() => {
        if (
            liveBooking.status === 'completed' &&
            !ratingShownRef.current &&
            !alreadyRated
        ) {
            ratingShownRef.current = true;
            setShowRating(true);
        }
    }, [liveBooking.status, alreadyRated]);

    const fetchStation = async () => {
        try {
            const q = query(
                collection(db, COLLECTIONS.STATIONS),
                where('stationId', '==', booking.stationId)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const d = snap.docs[0];
                setStation({ id: d.id, ...d.data() });
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching station:', error);
            setLoading(false);
        }
    };

    const handleCancelBooking = async () => {
        const ok = await confirm('Your spot in the queue will be lost. This cannot be undone.', {
            title: 'Cancel Booking',
            confirmLabel: 'Yes, Cancel',
            variant: 'danger',
        });
        if (!ok) return;
        setCancelling(true);
        const result = await cancelBooking(liveBooking.id, liveBooking.customerId);
        if (result.success) {
            onBookingCancelled();
        } else {
            toast.error('Failed to cancel booking. Please try again.');
            setCancelling(false);
        }
    };

    const formatCountdown = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
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
    const canCancel = !['fueling', 'checked_in', 'completed'].includes(liveBooking.status);

    return (
        <div className="my-booking-container">

            {showRating && station && (
                <RatingModal
                    stationId={booking.stationId}
                    stationName={station.name}
                    customerId={booking.customerId}
                    bookingId={booking.id}
                    onClose={() => setShowRating(false)}
                />
            )}
            {showComplaint && (
                <ComplaintForm
                    customerId={booking.customerId}
                    stationId={booking.stationId}
                    bookingId={booking.id}
                    onClose={() => setShowComplaint(false)}
                />
            )}

            {/* ── Header ── */}
            <div className="booking-header">
                <h2>My Booking</h2>
                <div className={`booking-status ${statusDisplay.color}`}>
                    <span className="status-icon">{statusDisplay.icon}</span>
                    <span className="status-text">{statusDisplay.text}</span>
                </div>
            </div>

            {/* ── Info grid ── */}
            <div className="booking-info-grid">
                <div className="info-card">
                    <div className="info-label">Lane Position</div>
                    <div className="info-value large">#{liveBooking.lanePosition ?? liveBooking.queuePosition}</div>
                    {(liveBooking.lanePosition && liveBooking.lanePosition !== liveBooking.queuePosition) && (
                        <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: 2 }}>
                            Token #{liveBooking.queuePosition}
                        </div>
                    )}
                </div>

                <div className="info-card">
                    <div className="info-label">
                        Estimated Wait
                        <span style={{ fontSize: '0.65rem', color: '#9ca3af', marginLeft: 4 }}>⟳5s</span>
                    </div>
                    <div className="info-value">
                        {waitMinutes !== null ? `${waitMinutes} min` : `${liveBooking.estimatedWaitMinutes} min`}
                    </div>
                    {vehiclesAhead !== null && (
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>
                            {vehiclesAhead} vehicle{vehiclesAhead !== 1 ? 's' : ''} ahead
                        </div>
                    )}
                </div>

                <div className="info-card">
                    <div className="info-label">Vehicle Number</div>
                    <div className="info-value">{liveBooking.vehicleNumber}</div>
                </div>

                <div className="info-card">
                    <div className="info-label">Station</div>
                    <div className="info-value">{station?.name || 'Loading...'}</div>
                    {station && (
                        <a
                            href={
                                station.location?.latitude
                                    ? `https://www.google.com/maps/dir/?api=1&destination=${station.location.latitude},${station.location.longitude}`
                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address || station.name)}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: '0.72rem', fontWeight: 600,
                                color: '#1a73e8', textDecoration: 'none',
                                marginTop: 4,
                                padding: '3px 8px',
                                background: '#e8f0fe',
                                borderRadius: 6
                            }}
                        >
                            🗺️ Get Directions
                        </a>
                    )}
                </div>
            </div>

            {/* ── Check-in prompt — inline card, not a modal ── */}
            {showCheckIn && station && (
                <CheckInPrompt
                    booking={liveBooking}
                    station={station}
                    onCheckInSuccess={() => setShowCheckIn(false)}
                />
            )}


            {countdown !== null && countdown > 0 && liveBooking.status === 'eligible' && !liveBooking.isCheckedIn && (
                <div className="check-in-urgency" style={{
                    background: countdown < 120 ? '#fef2f2' : '#fef9ec',
                    border: `1.5px solid ${countdown < 120 ? '#fca5a5' : '#fcd34d'}`,
                    borderRadius: 12, padding: '12px 16px', marginTop: 12,
                    display: 'flex', alignItems: 'center', gap: 10
                }}>
                    <span style={{ fontSize: '1.4rem' }}>⏱️</span>
                    <div>
                        <div style={{ fontWeight: 700, color: countdown < 120 ? '#dc2626' : '#b45309', fontSize: '1.1rem' }}>
                            {formatCountdown(countdown)} remaining
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            Check-in now or your booking will be auto-cancelled
                        </div>
                    </div>
                </div>
            )}

            {/* ── Check-in reminder (text only — button is in CheckInPrompt card above) ── */}
            {liveBooking.status === 'eligible' && !liveBooking.isCheckedIn && !showCheckIn && (
                <div className="check-in-reminder">
                    <p>⚠️ You are now eligible to check-in. Please arrive at the station and check-in within 10 minutes.</p>
                </div>
            )}

            {liveBooking.status === 'fueling' && (
                <div className="fueling-notice">
                    <p>⛽ Your vehicle is currently being fueled. Please wait...</p>
                </div>
            )}

            {/* ── Lane position info banners ── */}
            {liveBooking.lanePosition && liveBooking.lanePosition > liveBooking.queuePosition &&
                !['fueling', 'completed'].includes(liveBooking.status) && (
                    <div style={{
                        background: '#fef3c7', border: '1px solid #fcd34d',
                        borderRadius: 12, padding: '12px 16px', marginTop: 12,
                        display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <span style={{ fontSize: '1.4rem' }}>⚡</span>
                        <div>
                            <div style={{ fontWeight: 700, color: '#b45309', fontSize: '0.9rem' }}>
                                Checked-in vehicles are ahead
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                Your token is #{liveBooking.queuePosition}, but {liveBooking.lanePosition - liveBooking.queuePosition} checked-in vehicle(s) are ahead in the lane. Check in now to move up!
                            </div>
                        </div>
                    </div>
                )}

            {liveBooking.lanePosition && liveBooking.lanePosition < liveBooking.queuePosition &&
                !['fueling', 'completed'].includes(liveBooking.status) && (
                    <div style={{
                        background: '#ecfdf5', border: '1px solid #6ee7b7',
                        borderRadius: 12, padding: '12px 16px', marginTop: 12,
                        display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <span style={{ fontSize: '1.4rem' }}>🎉</span>
                        <div>
                            <div style={{ fontWeight: 700, color: '#047857', fontSize: '0.9rem' }}>
                                You're ahead!
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                Lane position #{liveBooking.lanePosition} (token was #{liveBooking.queuePosition}). You checked in early!
                            </div>
                        </div>
                    </div>
                )}

            {/* ── Live Queue ── */}
            <div className="queue-section">
                <h3>Live Queue</h3>
                <VisualQueue
                    stationId={booking.stationId}
                    userRole="customer"
                    currentUserId={booking.customerId}
                    maxDisplay={10}
                />
            </div>

            {/* ── Actions ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                {canCancel && (
                    <button
                        type="button"
                        onClick={handleCancelBooking}
                        className="btn btn-danger btn-block"
                        disabled={cancelling}
                    >
                        {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => setShowComplaint(true)}
                    className="btn btn-outline btn-block"
                >
                    📋 File a Complaint
                </button>

                <button
                    type="button"
                    onClick={() => setShowTracker(!showTracker)}
                    className="btn btn-outline btn-block"
                >
                    {showTracker ? '▲ Hide My Complaints' : '▼ My Complaints History'}
                </button>
            </div>

            {/* ── Complaints tracker ── */}
            {showTracker && (
                <div style={{ marginTop: 16 }}>
                    <ComplaintTracker customerId={booking.customerId} />
                </div>
            )}
        </div>
    );
};

export default MyBooking;
