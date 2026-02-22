// Booking Confirmation Component
import { useState } from 'react';
import { validateBooking, createBooking } from '../../utils/queueLogic';
import { useAuth } from '../../hooks/useAuth';
import './BookingConfirmation.css';

const BookingConfirmation = ({ station, vehicleNumber, onBookingCreated, onCancel, onChangeVehicle }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleConfirmBooking = async () => {
        setError('');
        setLoading(true);

        try {
            // Validate booking
            const validation = await validateBooking(station.stationId, vehicleNumber);

            if (!validation.valid) {
                setError(validation.error);
                setLoading(false);
                return;
            }

            // Create booking
            const result = await createBooking(
                station.stationId,
                vehicleNumber,
                user.uid,
                user.phoneNumber
            );

            if (result.success) {
                onBookingCreated(result);
            } else {
                setError(result.error || 'Failed to create booking');
            }

            setLoading(false);
        } catch (err) {
            console.error('Error confirming booking:', err);
            setError('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="booking-confirmation-container">
            <div className="booking-confirmation-card card">
                <h2>Confirm Booking</h2>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <div className="booking-details">
                    <div className="detail-row">
                        <span className="detail-label">Station:</span>
                        <span className="detail-value">{station.name}</span>
                    </div>

                    <div className="detail-row">
                        <span className="detail-label">Address:</span>
                        <span className="detail-value">{station.address}</span>
                    </div>

                    <div className="detail-row">
                        <span className="detail-label">Vehicle:</span>
                        <span className="detail-value vehicle-number">{vehicleNumber}</span>
                    </div>

                    <div className="detail-row">
                        <span className="detail-label">Status:</span>
                        <span className="detail-value">
                            {station.gasOn && station.bookingOn ? (
                                <span className="status-open">✓ Available</span>
                            ) : (
                                <span className="status-closed">✗ Unavailable</span>
                            )}
                        </span>
                    </div>
                </div>

                <div className="booking-info">
                    <div className="info-card">
                        <div className="info-icon">⛽</div>
                        <div className="info-content">
                            <h4>Guaranteed Fueling</h4>
                            <p>Your booking guarantees CNG availability</p>
                        </div>
                    </div>

                    <div className="info-card">
                        <div className="info-icon">📍</div>
                        <div className="info-content">
                            <h4>GPS Check-in Required</h4>
                            <p>You must check-in when you reach the station</p>
                        </div>
                    </div>

                    <div className="info-card">
                        <div className="info-icon">⏱️</div>
                        <div className="info-content">
                            <h4>Grace Window</h4>
                            <p>5 minutes to check-in when your turn comes</p>
                        </div>
                    </div>
                </div>

                <div className="booking-actions">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmBooking();
                        }}
                        className="btn btn-primary btn-block"
                        disabled={loading || !station.gasOn || !station.bookingOn}
                    >
                        {loading ? 'Booking...' : 'Confirm Booking'}
                    </button>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChangeVehicle && onChangeVehicle();
                        }}
                        className="btn btn-outline btn-block"
                        disabled={loading}
                    >
                        🚗 Change Vehicle
                    </button>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancel();
                        }}
                        className="btn btn-outline btn-block"
                        disabled={loading}
                    >
                        ← Back to Stations
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingConfirmation;
