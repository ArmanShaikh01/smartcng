// GPS Check-in Component
import { useState } from 'react';
import { useGeolocation, validateCheckIn } from '../../hooks/useGeolocation';
import { checkInBooking } from '../../utils/queueLogic';
import './CheckInPrompt.css';

const CheckInPrompt = ({ booking, station, onCheckInSuccess }) => {
    const { location, error: gpsError, loading: gpsLoading, getLocation } = useGeolocation(false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState('');

    const handleCheckIn = async () => {
        setError('');
        setChecking(true);

        try {
            // Get current location
            await getLocation();

            if (gpsError) {
                setError(gpsError);
                setChecking(false);
                return;
            }

            if (!location) {
                setError('Unable to get your location. Please try again.');
                setChecking(false);
                return;
            }

            // Validate geofence
            const validation = validateCheckIn(
                location,
                station.location,
                station.checkInRadius || 15
            );

            if (!validation.isValid) {
                if (validation.distance > 50) {
                    setError(`You are ${validation.distance}m away from the station. Please come closer.`);
                } else if (location.accuracy > 20) {
                    setError('GPS accuracy is low. Please enable high-accuracy mode and try again.');
                } else {
                    setError(`You are ${validation.distance}m away. Required: ${station.checkInRadius || 15}m`);
                }
                setChecking(false);
                return;
            }

            // Check in
            const result = await checkInBooking(
                booking.id,
                { ...location, distance: validation.distance },
                booking.customerId
            );

            if (result.success) {
                onCheckInSuccess();
            } else {
                setError(result.error || 'Check-in failed. Please try again.');
            }

            setChecking(false);
        } catch (err) {
            console.error('Error during check-in:', err);
            setError('An error occurred. Please try again.');
            setChecking(false);
        }
    };

    return (
        <div className="checkin-prompt">
            <div className="checkin-card">
                <div className="checkin-icon">📍</div>

                <h3>Check-in Required</h3>
                <p className="checkin-message">
                    You have arrived at the station. Please check-in to confirm your presence.
                </p>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <div className="checkin-info">
                    <div className="info-item">
                        <span className="info-label">Your Position:</span>
                        <span className="info-value">#{booking.queuePosition}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Station:</span>
                        <span className="info-value">{station.name}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Check-in Radius:</span>
                        <span className="info-value">{station.checkInRadius || 15}m</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Check-in button clicked!');
                        handleCheckIn();
                    }}
                    className="btn btn-primary btn-block btn-large"
                    disabled={checking || gpsLoading}
                    style={{ position: 'relative', zIndex: 10, cursor: 'pointer' }}
                >
                    {checking || gpsLoading ? (
                        <>
                            <div className="spinner-small"></div>
                            Checking location...
                        </>
                    ) : (
                        <>
                            📍 Check-in Now
                        </>
                    )}
                </button>

                <p className="checkin-note">
                    ⚠️ Check-in is mandatory. You must be within {station.checkInRadius || 15} meters of the station.
                </p>
            </div>
        </div>
    );
};

export default CheckInPrompt;
