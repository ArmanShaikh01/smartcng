// Vehicle Card Component - Individual vehicle in queue
import StatusIndicator from './StatusIndicator';
import './VehicleCard.css';

/**
 * Vehicle card showing position, number, and check-in status
 * @param {object} booking - Booking object
 * @param {number} position - Queue position
 * @param {boolean} isCurrentUser - Is this the current user's vehicle
 * @param {boolean} isFueling - Is currently being fueled
 * @param {string} userRole - User role
 */
const VehicleCard = ({ booking, position, isCurrentUser, isFueling, userRole }) => {
    const { vehicleNumber, isCheckedIn, status } = booking;

    const getStatusColor = () => {
        if (isFueling) return 'fueling';
        if (isCheckedIn) return 'green';
        return 'red';
    };

    const getStatusText = () => {
        if (isFueling) return '⛽ Currently Fueling';
        if (isCheckedIn) return '✓ Present';
        return '⏳ Not arrived';
    };

    return (
        <div className={`vehicle-card ${isCurrentUser ? 'current-user' : ''} ${getStatusColor()}`}>
            <div className="vehicle-position">
                <span className="position-number">#{position}</span>
            </div>

            <StatusIndicator
                status={getStatusColor()}
                isFueling={isFueling}
            />

            <div className="vehicle-info">
                <div className="vehicle-number">{vehicleNumber}</div>
                <div className="vehicle-status">{getStatusText()}</div>
            </div>

            {isCurrentUser && (
                <div className="current-user-badge">
                    <span>YOU</span>
                </div>
            )}

            {isFueling && (
                <div className="fueling-indicator">
                    <div className="fueling-animation"></div>
                </div>
            )}
        </div>
    );
};

export default VehicleCard;
