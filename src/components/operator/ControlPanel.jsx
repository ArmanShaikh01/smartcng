// Control Panel Component - GAS/BOOKING/NEXT buttons
import { useState } from 'react';
import { toggleGasStatus, toggleBookingStatus, advanceQueue } from '../../utils/operatorLogic';
import './ControlPanel.css';

const ControlPanel = ({ station, operatorId, onQueueAdvanced }) => {
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // 'gas', 'booking', 'next'

    const handleToggleGas = async () => {
        setActionLoading('gas');
        setLoading(true);

        const result = await toggleGasStatus(station.stationId, !station.gasOn, operatorId);

        if (!result.success) {
            alert('Failed to toggle gas status: ' + result.error);
        }

        setLoading(false);
        setActionLoading(null);
    };

    const handleToggleBooking = async () => {
        setActionLoading('booking');
        setLoading(true);

        const result = await toggleBookingStatus(station.stationId, !station.bookingOn, operatorId);

        if (!result.success) {
            alert('Failed to toggle booking status: ' + result.error);
        }

        setLoading(false);
        setActionLoading(null);
    };

    const handleNext = async () => {
        if (!confirm('Mark current vehicle as completed and advance queue?')) {
            return;
        }

        setActionLoading('next');
        setLoading(true);

        const result = await advanceQueue(station.stationId, operatorId);

        if (result.success) {
            if (onQueueAdvanced) {
                onQueueAdvanced(result);
            }
        } else {
            alert('Failed to advance queue: ' + result.error);
        }

        setLoading(false);
        setActionLoading(null);
    };

    // Assuming `canAdvance` is a prop or derived from `station`
    // For this change, we'll assume it's available or needs to be added elsewhere.
    // If `canAdvance` is not defined, this will cause a runtime error.
    // For the purpose of this edit, we'll use `station.canAdvance` as a placeholder
    // or simply remove the `!canAdvance` part if it's not provided in the context.
    // Given the instruction is to apply the provided code edit faithfully,
    // we will include `!canAdvance` as shown in the snippet.
    // If `canAdvance` is not defined in the component's scope, this will need further adjustment.
    const canAdvance = station.currentVehicleId !== null; // Placeholder for canAdvance logic

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
                            <span className="btn-icon">⛽</span>
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
                            <span className="btn-icon">📝</span>
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
                            <span className="btn-icon">▶️</span>
                            <span className="btn-label">NEXT</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ControlPanel;
