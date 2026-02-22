// Vehicle Card Component - Individual vehicle in queue
import Icon from './Icon';
import StatusIndicator from './StatusIndicator';
import './VehicleCard.css';

/**
 * Vehicle card showing position, number, and check-in status
 */
const VehicleCard = ({ booking, position, isCurrentUser, isFueling, userRole, onNoShow, noShowLoading }) => {
    const { vehicleNumber, isCheckedIn } = booking;

    const getStatusColor = () => {
        if (isFueling) return 'fueling';
        if (isCheckedIn) return 'green';
        return 'red';
    };

    const getStatusText = () => {
        if (isFueling) return 'Currently Fueling';
        if (isCheckedIn) return 'Present';
        return 'Not arrived';
    };

    const getStatusIcon = () => {
        if (isFueling) return <Icon name="gas" size={13} />;
        if (isCheckedIn) return <Icon name="check" size={13} />;
        return <Icon name="clock" size={13} />;
    };

    const showNoShowBtn = onNoShow && !isFueling;

    // Turn-near: current user is checked-in and actively waiting
    const isTurnNear = isCurrentUser && isCheckedIn && !isFueling;

    return (
        <div className={`vehicle-card anim-card ${isCurrentUser ? 'current-user' : ''} ${getStatusColor()} ${isTurnNear ? 'turn-near' : ''}`}>
            <div className="vehicle-position">
                <span className="position-number">#{position}</span>
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

            {isFueling && (
                <div className="fueling-indicator" aria-hidden="true">
                    {/* Pipeline flow — represents CNG moving through pipe */}
                    <div className="fueling-pipeline">
                        <div className="fueling-particle anim-pipeline" />
                        <div className="fueling-particle anim-pipeline" style={{ animationDelay: '0.7s' }} />
                    </div>
                </div>
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
