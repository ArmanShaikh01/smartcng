// Status Indicator Component
import Icon from './Icon';
import './StatusIndicator.css';

/**
 * Visual status indicator (colored dot + icon)
 * @param {string} status - 'green', 'red', or 'fueling'
 * @param {boolean} isFueling - Is currently fueling
 */
const StatusIndicator = ({ status, isFueling }) => {
    const getIndicatorClass = () => {
        if (isFueling) return 'fueling';
        return status;
    };

    const getIndicatorIcon = () => {
        if (isFueling) return <Icon name="gas" size={14} />;
        if (status === 'green') return <Icon name="checkCircle" size={14} color="#16a34a" />;
        return <Icon name="clock" size={14} color="#dc2626" />;
    };

    return (
        <div className={`status-indicator ${getIndicatorClass()}`}>
            <span className="status-icon">{getIndicatorIcon()}</span>
        </div>
    );
};

export default StatusIndicator;
