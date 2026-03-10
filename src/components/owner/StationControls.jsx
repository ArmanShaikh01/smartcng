// Station Controls Component - Owner controls for gas and booking
import { useState } from 'react';
import { toggleGasStatus, toggleBookingStatus } from '../../utils/operatorLogic';
import { logAuditAction, AUDIT_ACTION } from '../../utils/auditLog';
import { toast } from '../../utils/toast';
import { confirm } from '../../utils/confirm';
import Icon from '../shared/Icon';
import './StationControls.css';

const StationControls = ({ station, ownerId }) => {
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);

    const handleToggleGas = async () => {
        const action = station.gasOn ? 'turn OFF' : 'turn ON';
        const ok = await confirm(`Are you sure you want to ${action} gas?`, {
            title: station.gasOn ? 'Turn Off Gas' : 'Turn On Gas',
            confirmLabel: station.gasOn ? 'Yes, Turn OFF' : 'Yes, Turn ON',
            variant: station.gasOn ? 'danger' : 'primary',
        });
        if (!ok) return;

        setActionLoading('gas');
        setLoading(true);

        const newVal = !station.gasOn;
        const result = await toggleGasStatus(station.stationId, newVal, ownerId);

        if (result.success) {
            await logAuditAction({
                userId: ownerId, role: 'owner',
                stationId: station.stationId,
                actionType: newVal ? AUDIT_ACTION.GAS_ON : AUDIT_ACTION.GAS_OFF,
                description: `Gas turned ${newVal ? 'ON' : 'OFF'} at ${station.name}`
            });
        } else {
            toast.error('Failed to toggle gas status: ' + result.error);
        }

        setLoading(false);
        setActionLoading(null);
    };

    const handleToggleBooking = async () => {
        const action = station.bookingOn ? 'close' : 'open';
        const ok = await confirm(`Are you sure you want to ${action} booking?`, {
            title: station.bookingOn ? 'Close Booking' : 'Open Booking',
            confirmLabel: station.bookingOn ? 'Yes, Close' : 'Yes, Open',
            variant: station.bookingOn ? 'warning' : 'primary',
        });
        if (!ok) return;

        setActionLoading('booking');
        setLoading(true);

        const newVal = !station.bookingOn;
        const result = await toggleBookingStatus(station.stationId, newVal, ownerId);

        if (result.success) {
            await logAuditAction({
                userId: ownerId, role: 'owner',
                stationId: station.stationId,
                actionType: newVal ? AUDIT_ACTION.BOOKING_OPEN : AUDIT_ACTION.BOOKING_CLOSE,
                description: `Booking ${newVal ? 'opened' : 'closed'} at ${station.name}`
            });
        } else {
            toast.error('Failed to toggle booking status: ' + result.error);
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
                        <span className="control-icon"><Icon name="gas" size={22} /></span>
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
                        <span className="control-icon"><Icon name="clipboardList" size={22} /></span>
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
                <h4><Icon name="alertTriangle" size={16} color="#b45309" /> Important Guidelines</h4>
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
