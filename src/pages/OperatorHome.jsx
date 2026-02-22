// Operator Home - Main operator interface
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRealtimeStation } from '../hooks/useRealtimeStation';
import { useRealtimeQueue } from '../hooks/useRealtimeQueue';
import Navbar from '../components/shared/Navbar';
import ControlPanel from '../components/operator/ControlPanel';
import AwarenessPanel from '../components/operator/AwarenessPanel';
import VisualQueue from '../components/shared/VisualQueue';
import './OperatorHome.css';

const OperatorHome = () => {
    const { user, userProfile } = useAuth();
    const stationId = userProfile?.stationId;

    const { station, loading: stationLoading } = useRealtimeStation(stationId);
    const { queue, loading: queueLoading } = useRealtimeQueue(stationId);

    const [showFullQueue, setShowFullQueue] = useState(false);

    const currentVehicle = queue.find(b => b.queuePosition === 1);
    const nextVehicle = queue.find(b => b.queuePosition === 2);

    const handleQueueAdvanced = (result) => {
        // Show success notification
        const message = `✓ ${result.completedVehicle} completed. Next: ${result.nextVehicle}`;

        // You can add a toast notification here
        console.log(message);
    };

    if (stationLoading || queueLoading) {
        return (
            <div className="operator-loading">
                <div className="spinner"></div>
                <p>Loading operator dashboard...</p>
            </div>
        );
    }

    if (!station) {
        return (
            <div className="operator-error">
                <h2>⚠️ Station Not Found</h2>
                <p>You are not assigned to any station. Please contact admin.</p>
            </div>
        );
    }

    if (station.isSuspended) {
        return (
            <div className="operator-home">
                <Navbar title={`Operator - ${station.name}`} />
                <div className="operator-error" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <h2 style={{ fontSize: '3rem', marginBottom: '16px' }}>🚫</h2>
                    <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Station Suspended</h2>
                    <p style={{ color: '#6b7280', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
                        Your station <strong>"{station.name}"</strong> has been suspended by the admin.
                        All operations are currently disabled. Please contact the administrator.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="operator-home">
            <Navbar title={`Operator - ${station.name}`} />

            <div className="operator-content">
                <div className="operator-header">
                    <h1>Operator Dashboard</h1>
                    <div className="station-info">
                        <span className="station-name">{station.name}</span>
                        <span className="station-address">{station.address}</span>
                    </div>
                </div>

                <ControlPanel
                    station={station}
                    operatorId={user.uid}
                    onQueueAdvanced={handleQueueAdvanced}
                />

                <AwarenessPanel
                    currentVehicle={currentVehicle}
                    nextVehicle={nextVehicle}
                    queueLength={queue.length}
                />

                <div className="queue-section">
                    <div className="queue-section-header">
                        <h2>Live Queue {showFullQueue ? '(All)' : '(Top 10)'}</h2>
                        <button
                            onClick={() => setShowFullQueue(!showFullQueue)}
                            className="btn btn-outline"
                        >
                            {showFullQueue ? 'Show Top 10' : 'View Full Queue'}
                        </button>
                    </div>

                    <VisualQueue
                        stationId={stationId}
                        userRole="operator"
                        maxDisplay={showFullQueue ? null : 10}
                    />
                </div>
            </div>
        </div>
    );
};

export default OperatorHome;
