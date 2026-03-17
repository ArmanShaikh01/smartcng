// Vehicle Card Component - Individual vehicle in queue (lane-priority aware)
import Icon from './Icon';
import StatusIndicator from './StatusIndicator';
import './VehicleCard.css';

/**
 * Vehicle card showing lane position, token number, and check-in status
 */
const VehicleCard = ({ booking, position, isCurrentUser, isFueling, userRole, onNoShow, onSkip, noShowLoading, skipLoading }) => {
    const { vehicleNumber, isCheckedIn, lanePosition, queuePosition } = booking;

    // Use lanePosition if available, fallback to prop position
    const displayLanePos = lanePosition ?? position;
    const displayTokenPos = queuePosition ?? position;
    const positionsDiffer = displayLanePos !== displayTokenPos;

    // Late vehicle: eligible but not checked in
    const isLate = !isCheckedIn && !isFueling && (booking.status === 'eligible');

    const getStatusColor = () => {
        if (isFueling) return 'fueling';
        if (isCheckedIn) return 'green';
        if (isLate) return 'yellow';
        return 'red';
    };

    const getStatusText = () => {
        if (isFueling) return 'Currently Fueling';
        if (isCheckedIn) return 'Present';
        if (isLate) return 'Late — not arrived';
        return 'Not arrived';
    };

    const getStatusIcon = () => {
        if (isFueling) return <Icon name="gas" size={13} />;
        if (isCheckedIn) return <Icon name="check" size={13} />;
        if (isLate) return <Icon name="clock" size={13} />;
        return <Icon name="clock" size={13} />;
    };

    const showNoShowBtn = onNoShow && !isFueling;
    const showSkipBtn = onSkip && !isFueling;

    // Turn-near: current user is checked-in and actively waiting
    const isTurnNear = isCurrentUser && isCheckedIn && !isFueling;

    return (
        <div className={`vehicle-card anim-card ${isCurrentUser ? 'current-user' : ''} ${getStatusColor()} ${isTurnNear ? 'turn-near' : ''}`}>
            <div className="vehicle-position">
                <span className="position-number">#{displayLanePos}</span>
                {positionsDiffer && (
                    <span style={{ fontSize: '0.6rem', color: '#9ca3af', display: 'block', marginTop: 1 }}>
                        Token #{displayTokenPos}
                    </span>
                )}
            </div>

            <StatusIndicator status={getStatusColor()} isFueling={isFueling} />

            <div className="vehicle-info">
                <div className="vehicle-number">{vehicleNumber}</div>
                <div className="vehicle-status">
                    {getStatusIcon()}
                    <span>{getStatusText()}</span>
                </div>
            </div>

            {isCurrentUser && (
                <div className="current-user-badge">YOU</div>
            )}

            {isLate && !isCurrentUser && (
                <div style={{
                    fontSize: '0.6rem', fontWeight: 700, color: '#b45309',
                    background: '#fef3c7', padding: '2px 6px', borderRadius: 4,
                    position: 'absolute', top: 6, right: 6
                }}>⏳ Late</div>
            )}

            {isFueling && (
                <div className="fueling-indicator" aria-hidden="true">
                    {/* Pipeline flow — represents CNG moving through pipe */}
                    <div className="fueling-pipeline">
                        <div className="fueling-particle anim-pipeline" />
                        <div className="fueling-particle anim-pipeline" style={{ animationDelay: '0.7s' }} />
                    </div>
                </div>
            )}

            {showSkipBtn && (
                <button
                    className="no-show-btn"
                    onClick={(e) => { e.stopPropagation(); onSkip(booking); }}
                    disabled={skipLoading}
                    title="Skip Vehicle"
                    style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fcd34d' }}
                >
                    {skipLoading
                        ? <><div className="spinner-tiny"></div></>
                        : <><Icon name="skipForward" size={12} /> Skip</>
                    }
                </button>
            )}

            {showNoShowBtn && (
                <button
                    className="no-show-btn"
                    onClick={(e) => { e.stopPropagation(); onNoShow(booking); }}
                    disabled={noShowLoading}
                    title="Mark as No-Show"
                >
                    {noShowLoading
                        ? <><div className="spinner-tiny"></div></>
                        : <><Icon name="x" size={12} /> No Show</>
                    }
                </button>
            )}
        </div>
    );
};

export default VehicleCard;

