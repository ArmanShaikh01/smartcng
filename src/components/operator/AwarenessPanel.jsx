// Awareness Panel - Shows current and next vehicle
import './AwarenessPanel.css';

const AwarenessPanel = ({ currentVehicle, nextVehicle, queueLength }) => {
    return (
        <div className="awareness-panel">
            <h3>Queue Status</h3>

            <div className="awareness-grid">
                <div className="awareness-card current-vehicle">
                    <div className="card-header">
                        <span className="card-icon">⛽</span>
                        <span className="card-title">Currently Fueling</span>
                    </div>
                    <div className="card-content">
                        {currentVehicle ? (
                            <>
                                <div className="vehicle-number-large">{currentVehicle.vehicleNumber}</div>
                                <div className="vehicle-position">Position #{currentVehicle.queuePosition}</div>
                                {currentVehicle.isCheckedIn && (
                                    <div className="vehicle-status checked-in">✓ Checked-in</div>
                                )}
                            </>
                        ) : (
                            <div className="no-vehicle">No vehicle fueling</div>
                        )}
                    </div>
                </div>

                <div className="awareness-card next-vehicle">
                    <div className="card-header">
                        <span className="card-icon">▶️</span>
                        <span className="card-title">Next Vehicle</span>
                    </div>
                    <div className="card-content">
                        {nextVehicle ? (
                            <>
                                <div className="vehicle-number-large">{nextVehicle.vehicleNumber}</div>
                                <div className="vehicle-position">Position #{nextVehicle.queuePosition}</div>
                                {nextVehicle.isCheckedIn ? (
                                    <div className="vehicle-status checked-in">🟢 Present</div>
                                ) : (
                                    <div className="vehicle-status not-arrived">🔴 Not arrived</div>
                                )}
                            </>
                        ) : (
                            <div className="no-vehicle">Queue empty</div>
                        )}
                    </div>
                </div>

                <div className="awareness-card queue-stats">
                    <div className="card-header">
                        <span className="card-icon">📊</span>
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
