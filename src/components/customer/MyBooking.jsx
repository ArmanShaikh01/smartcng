// My Booking Component - Enhanced with live wait time, auto-cancel, ratings, complaints
import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDocs, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { cancelBooking, checkInBooking } from '../../utils/queueLogic';
import { useWaitTime } from '../../hooks/useWaitTime';
import { useStationRating } from '../../hooks/useStationRating';
import { calculateDistance } from '../../hooks/useGeolocation';
import { toast } from '../../utils/toast';
import { confirm } from '../../utils/confirm';
import VisualQueue from '../shared/VisualQueue';
import RatingModal from './RatingModal';
import ComplaintForm from './ComplaintForm';
import ComplaintTracker from './ComplaintTracker';
import LiveDirectionsMap from './LiveDirectionsMap';
import './MyBooking.css';

const AUTO_CANCEL_SECONDS = 10 * 60; // 10 minutes

const MyBooking = ({ booking, onBookingCancelled }) => {
    const [station, setStation] = useState(null);
    const [liveBooking, setLiveBooking] = useState(booking);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);

    // Live tracking & gated check-in
    const [showMap, setShowMap] = useState(false);
    const [isWithinRadius, setIsWithinRadius] = useState(false);
    const [userDistance, setUserDistance] = useState(null);
    const [checkingIn, setCheckingIn] = useState(false);
    const [checkInError, setCheckInError] = useState('');
    const insideRadiusRef = useRef(false);
    const gpsWatchRef = useRef(null);

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

    // ── Continuous GPS tracking — watches location & determines if within station radius ──
    useEffect(() => {
        if (!station?.location?.latitude || !station?.location?.longitude) return;
        if (['fueling', 'completed', 'checked_in'].includes(liveBooking.status)) return;
        if (liveBooking.isCheckedIn) return;

        const stationLat = station.location.latitude;
        const stationLng = station.location.longitude;
        const radius = station.checkInRadius || 50;
        const ARRIVED_BUFFER = 10; // must be this far inside radius to trigger
        const LEAVE_BUFFER = 30;   // must exceed radius + this to un-trigger (prevents flicker)

        if (!navigator.geolocation) return;

        gpsWatchRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const dist = Math.round(calculateDistance(
                    pos.coords.latitude, pos.coords.longitude,
                    stationLat, stationLng
                ));
                setUserDistance(dist);

                // Hysteresis to prevent GPS jitter toggling the button
                if (!insideRadiusRef.current && dist <= radius - ARRIVED_BUFFER) {
                    insideRadiusRef.current = true;
                    setIsWithinRadius(true);
                } else if (insideRadiusRef.current && dist > radius + LEAVE_BUFFER) {
                    insideRadiusRef.current = false;
                    setIsWithinRadius(false);
                }
            },
            () => { /* GPS error — button stays disabled */ },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );

        return () => {
            if (gpsWatchRef.current !== null) {
                navigator.geolocation.clearWatch(gpsWatchRef.current);
                gpsWatchRef.current = null;
            }
        };
    }, [station, liveBooking.status, liveBooking.isCheckedIn]);

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

    // ── Handle inline check-in (GPS verified at click time) ──
    const handleCheckIn = async () => {
        setCheckInError('');
        setCheckingIn(true);

        try {
            // Get fresh GPS fix
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true, timeout: 10000, maximumAge: 0
                });
            });

            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            const stationLat = station.location.latitude;
            const stationLng = station.location.longitude;
            const checkRadius = station.checkInRadius || 15;

            const dist = Math.round(calculateDistance(userLat, userLng, stationLat, stationLng));

            if (dist > checkRadius) {
                setCheckInError(`You are ${dist}m away. Must be within ${checkRadius}m.`);
                setCheckingIn(false);
                return;
            }

            const result = await checkInBooking(
                liveBooking.id,
                { latitude: userLat, longitude: userLng, accuracy: pos.coords.accuracy, distance: dist },
                liveBooking.customerId,
                liveBooking.stationId
            );

            if (result.success) {
                toast.success('Check-in successful! 🎉');
            } else {
                setCheckInError(result.error || 'Check-in failed. Try again.');
            }
        } catch (err) {
            setCheckInError('Unable to get your location. Please enable GPS.');
        }
        setCheckingIn(false);
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
                    <div className="info-label">Queue Position</div>
                    <div className="info-value large">#{liveBooking.queuePosition}</div>
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
                    {station?.location?.latitude && !['fueling', 'completed', 'checked_in'].includes(liveBooking.status) && (
                        <button
                            type="button"
                            onClick={() => setShowMap(true)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                fontSize: '0.72rem', fontWeight: 700,
                                background: isWithinRadius ? '#ecfdf5' : '#e8f0fe',
                                borderColor: isWithinRadius ? '#6ee7b7' : '#c5d9f7',
                                color: isWithinRadius ? '#047857' : '#1a73e8',
                                border: '1.5px solid',
                                borderRadius: 8, padding: '5px 10px',
                                cursor: 'pointer', marginTop: 6,
                            }}
                        >
                            {isWithinRadius ? '✅ Arrived — Re-open Map' : '🗺️ Get Directions'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Live Directions Map overlay ── */}
            {showMap && station && (
                <LiveDirectionsMap
                    station={station}
                    onArrived={() => setShowMap(false)}
                    onClose={() => setShowMap(false)}
                />
            )}

            {/* ── Always-visible Check-in Button (above countdown) ── */}
            {liveBooking.status === 'eligible' && !liveBooking.isCheckedIn && (
                <div className="checkin-inline-card">
                    <div className="checkin-inline-header">
                        <span className="checkin-inline-icon">{isWithinRadius ? '✅' : '📍'}</span>
                        <div className="checkin-inline-title">
                            {isWithinRadius
                                ? 'You\'re at the station!'
                                : 'Check-in to confirm arrival'}
                        </div>
                    </div>

                    {userDistance !== null && !isWithinRadius && (
                        <div className="checkin-inline-distance">
                            🚗 {userDistance < 1000 ? `${userDistance}m` : `${(userDistance / 1000).toFixed(1)}km`} away · Check-in unlocks within {station?.checkInRadius || 50}m
                        </div>
                    )}

                    {checkInError && (
                        <div className="checkin-inline-error">⚠️ {checkInError}</div>
                    )}

                    <button
                        type="button"
                        className={`checkin-inline-btn ${isWithinRadius ? 'enabled' : 'disabled'}`}
                        disabled={!isWithinRadius || checkingIn || liveBooking.queuePosition > 15}
                        onClick={handleCheckIn}
                    >
                        {checkingIn ? (
                            <><div className="spinner-small"></div> Verifying location...</>
                        ) : isWithinRadius ? (
                            <><span>📍</span> I Have Arrived — Check In</>
                        ) : (
                            <><span>🔒</span> Check-in (Reach Station First)</>
                        )}
                    </button>

                    {liveBooking.queuePosition > 15 && (
                        <div className="checkin-inline-lock-notice">
                            🔒 Check-in opens at position ≤15. You're #{liveBooking.queuePosition}
                        </div>
                    )}
                </div>
            )}

            {/* ── Countdown timer ── */}
            {countdown !== null && countdown > 0 && liveBooking.status === 'eligible' && !liveBooking.isCheckedIn && (
                <div className="check-in-urgency" style={{
                    background: countdown < 120 ? '#fef2f2' : '#fef9ec',
                    border: `1.5px solid ${countdown < 120 ? '#fca5a5' : '#fcd34d'}`,
                    borderRadius: 12, padding: '12px 16px', marginTop: 0,
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

            {/* ── Check-in reminder ── */}
            {liveBooking.status === 'eligible' && !liveBooking.isCheckedIn && (
                <div className="check-in-reminder">
                    <p>⚠️ You are now eligible to check-in. Please arrive at the station and check-in within 10 minutes.</p>
                </div>
            )}

            {liveBooking.status === 'fueling' && (
                <div className="fueling-notice">
                    <p>⛽ Your vehicle is currently being fueled. Please wait...</p>
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
