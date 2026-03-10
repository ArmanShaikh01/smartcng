// Awareness Panel - Shows current and next vehicle (lane-priority aware)
import Icon from '../shared/Icon';
import './AwarenessPanel.css';

const AwarenessPanel = ({ currentVehicle, nextVehicle, queueLength }) => {
    const renderPosition = (vehicle) => {
        const lanePos = vehicle.lanePosition ?? vehicle.queuePosition;
        const tokenPos = vehicle.queuePosition;
        return (
            <>
                <div className="vehicle-position">Lane #{lanePos}</div>
                {lanePos !== tokenPos && (
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 1 }}>
                        Token #{tokenPos}
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="awareness-panel">
            <h3>Queue Status</h3>

            <div className="awareness-grid">
                {/* Currently Fueling */}
                <div className="awareness-card current-vehicle">
                    <div className="card-header">
                        <span className="card-icon"><Icon name="gas" size={18} /></span>
                        <span className="card-title">Currently Fueling</span>
                    </div>
                    <div className="card-content">
                        {currentVehicle ? (
                            <>
                                <div className="vehicle-number-large">{currentVehicle.vehicleNumber}</div>
                                {renderPosition(currentVehicle)}
                                {currentVehicle.isCheckedIn && (
                                    <div className="vehicle-status checked-in">
                                        <Icon name="check" size={12} /> Checked-in
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="no-vehicle">No vehicle fueling</div>
                        )}
                    </div>
                </div>

                {/* Next Vehicle */}
                <div className="awareness-card next-vehicle">
                    <div className="card-header">
                        <span className="card-icon"><Icon name="skipForward" size={18} /></span>
                        <span className="card-title">Next Vehicle</span>
                    </div>
                    <div className="card-content">
                        {nextVehicle ? (
                            <>
                                <div className="vehicle-number-large">{nextVehicle.vehicleNumber}</div>
                                {renderPosition(nextVehicle)}
                                {nextVehicle.isCheckedIn ? (
                                    <div className="vehicle-status checked-in">
                                        <Icon name="checkCircle" size={12} /> Present
                                    </div>
                                ) : (
                                    <div className="vehicle-status not-arrived">
                                        <Icon name="clock" size={12} /> Not arrived
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="no-vehicle">Queue empty</div>
                        )}
                    </div>
                </div>

                {/* Queue Stats */}
                <div className="awareness-card queue-stats">
                    <div className="card-header">
                        <span className="card-icon"><Icon name="list" size={18} /></span>
                        <span className="card-title">Queue Length</span>
                    </div>
                    <div className="card-content">
                        <div className="stat-number">{queueLength}</div>
                        <div className="stat-label">Vehicles waiting</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AwarenessPanel;

