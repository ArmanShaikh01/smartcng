// Control Panel Component - GAS/BOOKING/NEXT buttons
import { useState } from 'react';
import { toggleGasStatus, toggleBookingStatus, advanceQueue } from '../../utils/operatorLogic';
import { toast } from '../../utils/toast';
import { confirm } from '../../utils/confirm';
import Icon from '../shared/Icon';
import './ControlPanel.css';

const ControlPanel = ({ station, operatorId, onQueueAdvanced }) => {
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // 'gas', 'booking', 'next'

    const handleToggleGas = async () => {
        setActionLoading('gas');
        setLoading(true);
        const result = await toggleGasStatus(station.stationId, !station.gasOn, operatorId);
        if (!result.success) toast.error('Failed to toggle gas status: ' + result.error);
        setLoading(false);
        setActionLoading(null);
    };

    const handleToggleBooking = async () => {
        setActionLoading('booking');
        setLoading(true);
        const result = await toggleBookingStatus(station.stationId, !station.bookingOn, operatorId);
        if (!result.success) toast.error('Failed to toggle booking status: ' + result.error);
        setLoading(false);
        setActionLoading(null);
    };

    const handleNext = async () => {
        const ok = await confirm('Mark the current vehicle as completed and move to the next in queue?', {
            title: 'Advance Queue',
            confirmLabel: 'Yes, Advance',
            variant: 'primary',
        });
        if (!ok) return;
        setActionLoading('next');
        setLoading(true);
        const result = await advanceQueue(station.stationId, operatorId);
        if (result.success) {
            if (onQueueAdvanced) onQueueAdvanced(result);
        } else {
            toast.error('Failed to advance queue: ' + result.error);
        }
        setLoading(false);
        setActionLoading(null);
    };

    const canAdvance = station.currentVehicleId !== null;

    return (
        <div className="control-panel">
            <h3>Station Controls</h3>

            <div className="control-buttons">
                <button
                    type="button"
                    onClick={handleToggleGas}
                    className={`control-btn ${station.gasOn ? 'btn-gas-on' : 'btn-gas-off'}`}
                    disabled={loading}
                >
                    {actionLoading === 'gas' ? (
                        <div className="spinner-small"></div>
                    ) : (
                        <>
                            <span className="btn-icon"><Icon name="gas" size={20} /></span>
                            <span className="btn-label">GAS</span>
                            <span className="btn-status">{station.gasOn ? 'ON' : 'OFF'}</span>
                        </>
                    )}
                </button>

                <button
                    type="button"
                    onClick={handleToggleBooking}
                    className={`control-btn ${station.bookingOn ? 'btn-booking-on' : 'btn-booking-off'}`}
                    disabled={loading}
                >
                    {actionLoading === 'booking' ? (
                        <div className="spinner-small"></div>
                    ) : (
                        <>
                            <span className="btn-icon"><Icon name="clipboardList" size={20} /></span>
                            <span className="btn-label">BOOKING</span>
                            <span className="btn-status">{station.bookingOn ? 'ON' : 'OFF'}</span>
                        </>
                    )}
                </button>

                <button
                    type="button"
                    onClick={handleNext}
                    className="control-btn btn-next"
                    disabled={loading || !canAdvance}
                >
                    {actionLoading === 'next' ? (
                        <div className="spinner-small"></div>
                    ) : (
                        <>
                            <span className="btn-icon"><Icon name="skipForward" size={20} /></span>
                            <span className="btn-label">NEXT</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ControlPanel;
