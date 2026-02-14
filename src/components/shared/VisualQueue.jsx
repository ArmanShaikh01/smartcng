// Visual Queue Simulation Component
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue';
import VehicleCard from './VehicleCard';
import './VisualQueue.css';

/**
 * Visual queue simulation showing live queue with status indicators
 * @param {string} stationId - Station ID
 * @param {string} userRole - User role (customer/operator/owner)
 * @param {string} currentUserId - Current user ID (optional)
 * @param {number} maxDisplay - Maximum vehicles to display (default: all)
 */
const VisualQueue = ({ stationId, userRole, currentUserId, maxDisplay = null }) => {
    const { queue, loading, error } = useRealtimeQueue(stationId);

    if (loading) {
        return (
            <div className="visual-queue-loading">
                <div className="spinner"></div>
                <p>Loading queue...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="visual-queue-error">
                <p>⚠️ Error loading queue</p>
                <small>{error}</small>
            </div>
        );
    }

    if (queue.length === 0) {
        return (
            <div className="visual-queue-empty">
                <p>📭 No vehicles in queue</p>
                <small>Queue is currently empty</small>
            </div>
        );
    }

    const displayQueue = maxDisplay ? queue.slice(0, maxDisplay) : queue;
    const hasMore = maxDisplay && queue.length > maxDisplay;

    return (
        <div className="visual-queue-container">
            <div className="queue-header">
                <h3>Live Queue</h3>
                <div className="queue-stats">
                    <span className="queue-count">{queue.length} vehicles</span>
                </div>
            </div>

            <div className="queue-legend">
                <div className="legend-item">
                    <span className="status-dot green"></span>
                    <span>Checked-in</span>
                </div>
                <div className="legend-item">
                    <span className="status-dot red"></span>
                    <span>Not arrived</span>
                </div>
            </div>

            <div className="queue-list">
                {displayQueue.map((booking, index) => (
                    <VehicleCard
                        key={booking.id}
                        booking={booking}
                        position={booking.queuePosition}
                        isCurrentUser={booking.customerId === currentUserId}
                        isFueling={booking.status === 'fueling'}
                        userRole={userRole}
                    />
                ))}
            </div>

            {hasMore && (
                <div className="queue-more">
                    <p>+ {queue.length - maxDisplay} more vehicles in queue</p>
                </div>
            )}
        </div>
    );
};

export default VisualQueue;
