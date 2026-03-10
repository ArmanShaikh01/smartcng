// Visual Queue Simulation Component (lane-priority aware)
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeQueue } from '../../hooks/useRealtimeQueue';
import { markNoShow, skipVehicle } from '../../utils/operatorLogic';
import { toast } from '../../utils/toast';
import { confirm } from '../../utils/confirm';
import VehicleCard from './VehicleCard';
import Icon from './Icon';
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
    const { user } = useAuth();
    const [noShowLoading, setNoShowLoading] = useState(null);
    const [skipLoading, setSkipLoading] = useState(null);

    const handleNoShow = async (booking) => {
        const ok = await confirm(`Mark ${booking.vehicleNumber} as No-Show? They will be removed from the queue.`, {
            title: 'Mark as No-Show',
            confirmLabel: 'Yes, Mark No-Show',
            variant: 'warning',
        });
        if (!ok) return;

        setNoShowLoading(booking.id);
        const result = await markNoShow(booking.id, booking.vehicleNumber, stationId, user?.uid);
        if (!result.success) {
            toast.error('Failed to mark no-show: ' + result.error);
        }
        setNoShowLoading(null);
    };

    const handleSkip = async (booking) => {
        const ok = await confirm(`Skip ${booking.vehicleNumber}? They will move to the back and can re-check-in.`, {
            title: 'Skip Vehicle',
            confirmLabel: 'Yes, Skip',
            variant: 'warning',
        });
        if (!ok) return;

        setSkipLoading(booking.id);
        const result = await skipVehicle(booking.id, booking.vehicleNumber, stationId, user?.uid);
        if (result.success) {
            toast.success(`${booking.vehicleNumber} skipped (${result.skipCount}/3)`);
        } else {
            toast.error('Failed to skip: ' + result.error);
        }
        setSkipLoading(null);
    };

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
                <Icon name="alertTriangle" size={32} color="#f59e0b" />
                <p>Error loading queue</p>
                <small>{error}</small>
            </div>
        );
    }

    if (queue.length === 0) {
        return (
            <div className="visual-queue-empty">
                <Icon name="list" size={36} color="#d1d5db" />
                <p>No vehicles in queue</p>
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

            {/* Lane-order explainer */}
            <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
                padding: '8px 12px', marginBottom: 10, fontSize: '0.75rem',
                color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6
            }}>
                <span>ℹ️</span>
                <span>Lane order — checked-in vehicles near the pump are served first.</span>
            </div>

            <div className="queue-legend">
                <div className="legend-item">
                    <span className="status-dot green"></span>
                    <span>Checked-in</span>
                </div>
                <div className="legend-item">
                    <span className="status-dot" style={{ background: '#f59e0b' }}></span>
                    <span>Late</span>
                </div>
                <div className="legend-item">
                    <span className="status-dot red"></span>
                    <span>Not arrived</span>
                </div>
            </div>

            <div className="queue-list">
                {displayQueue.map((booking) => (
                    <VehicleCard
                        key={booking.id}
                        booking={booking}
                        position={booking.lanePosition ?? booking.queuePosition}
                        isCurrentUser={booking.customerId === currentUserId}
                        isFueling={booking.status === 'fueling'}
                        userRole={userRole}
                        onNoShow={userRole === 'operator' ? handleNoShow : null}
                        onSkip={userRole === 'operator' ? handleSkip : null}
                        noShowLoading={noShowLoading === booking.id}
                        skipLoading={skipLoading === booking.id}
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

