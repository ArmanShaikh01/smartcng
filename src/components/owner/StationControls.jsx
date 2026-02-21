// Station Controls Component - Owner controls for gas and booking
import { useState } from 'react';
import { toggleGasStatus, toggleBookingStatus } from '../../utils/operatorLogic';
import './StationControls.css';

const StationControls = ({ station, ownerId }) => {
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);

    const handleToggleGas = async () => {
        const action = station.gasOn ? 'turn OFF' : 'turn ON';
        if (!confirm(`Are you sure you want to ${action} gas?`)) {
            return;
        }

        setActionLoading('gas');
        setLoading(true);

        const result = await toggleGasStatus(station.stationId, !station.gasOn, ownerId);

        if (!result.success) {
            alert('Failed to toggle gas status: ' + result.error);
        }

        setLoading(false);
        setActionLoading(null);
    };

    const handleToggleBooking = async () => {
        const action = station.bookingOn ? 'close' : 'open';
        if (!confirm(`Are you sure you want to ${action} booking?`)) {
            return;
        }

        setActionLoading('booking');
        setLoading(true);

        const result = await toggleBookingStatus(station.stationId, !station.bookingOn, ownerId);

        if (!result.success) {
            alert('Failed to toggle booking status: ' + result.error);
        }

        setLoading(false);
        setActionLoading(null);
    };

    return (
        <div className="station-controls">
            <h2>Station Controls</h2>

            <div className="controls-grid">
                <div className="control-section">
                    <div className="control-header">
                        <span className="control-icon">⛽</span>
                        <h3>Gas Status</h3>
                    </div>
                    <div className="control-body">
                        <div className={`status-indicator ${station.gasOn ? 'active' : 'inactive'}`}>
                            {station.gasOn ? 'GAS ON' : 'GAS OFF'}
                        </div>
                        <button
                            type="button"
                            onClick={handleToggleGas}
                            className={`btn ${station.gasOn ? 'btn-danger' : 'btn-success'}`}
                            disabled={loading}
                        >
                            {actionLoading === 'gas' ? (
                                <div className="spinner-small"></div>
                            ) : (
                                station.gasOn ? 'Turn OFF' : 'Turn ON'
                            )}
                        </button>
                        <p className="control-description">
                            {station.gasOn
                                ? 'Gas is currently available. Turn OFF in case of emergency or maintenance.'
                                : 'Gas is currently OFF. Turn ON to allow fueling.'}
                        </p>
                    </div>
                </div>

                <div className="control-section">
                    <div className="control-header">
                        <span className="control-icon">📝</span>
                        <h3>Booking Status</h3>
                    </div>
                    <div className="control-body">
                        <div className={`status-indicator ${station.bookingOn ? 'active' : 'inactive'}`}>
                            {station.bookingOn ? 'BOOKING OPEN' : 'BOOKING CLOSED'}
                        </div>
                        <button
                            type="button"
                            onClick={handleToggleBooking}
                            className={`btn ${station.bookingOn ? 'btn-danger' : 'btn-success'}`}
                            disabled={loading}
                        >
                            {actionLoading === 'booking' ? (
                                <div className="spinner-small"></div>
                            ) : (
                                station.bookingOn ? 'Close Booking' : 'Open Booking'
                            )}
                        </button>
                        <p className="control-description">
                            {station.bookingOn
                                ? 'Customers can book CNG. Close when gas is running low.'
                                : 'Booking is closed. Open to allow new bookings.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="control-info">
                <h4>⚠️ Important Guidelines</h4>
                <ul>
                    <li>Close booking <strong>before</strong> gas runs out to guarantee fueling for booked customers</li>
                    <li>Recommended buffer: Close booking when ~10-15 vehicles remain</li>
                    <li>Turn OFF gas only in emergencies or maintenance</li>
                    <li>All actions are logged for audit purposes</li>
                </ul>
            </div>
        </div>
    );
};

export default StationControls;
