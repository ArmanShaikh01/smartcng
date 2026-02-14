// Status Indicator Component
import './StatusIndicator.css';

/**
 * Visual status indicator (green/red dot)
 * @param {string} status - 'green', 'red', or 'fueling'
 * @param {boolean} isFueling - Is currently fueling
 */
const StatusIndicator = ({ status, isFueling }) => {
    const getIndicatorClass = () => {
        if (isFueling) return 'fueling';
        return status;
    };

    const getIndicatorIcon = () => {
        if (isFueling) return '⛽';
        if (status === 'green') return '🟢';
        return '🔴';
    };

    return (
        <div className={`status-indicator ${getIndicatorClass()}`}>
            <span className="status-icon">{getIndicatorIcon()}</span>
        </div>
    );
};

export default StatusIndicator;
