// Owner Home - Main owner interface
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRealtimeStation } from '../hooks/useRealtimeStation';
import { useRealtimeQueue } from '../hooks/useRealtimeQueue';
import Navbar from '../components/shared/Navbar';
import StationControls from '../components/owner/StationControls';
import Analytics from '../components/owner/Analytics';
import VisualQueue from '../components/shared/VisualQueue';
import OperatorManagement from '../components/owner/OperatorManagement';
import Icon from '../components/shared/Icon';
import './OwnerHome.css';

const OwnerHome = () => {
    const { user, userProfile } = useAuth();
    const stationId = userProfile?.stationId;
    const [activeTab, setActiveTab] = useState('dashboard');

    const { station, loading: stationLoading } = useRealtimeStation(stationId);
    const { queue, loading: queueLoading } = useRealtimeQueue(stationId);

    if (stationLoading || queueLoading) {
        return (
            <div className="owner-loading">
                <div className="spinner"></div>
                <p>Loading owner dashboard...</p>
            </div>
        );
    }

    if (!station) {
        return (
            <div className="owner-error">
                <Icon name="alertTriangle" size={40} color="#f59e0b" />
                <h2>Station Not Found</h2>
                <p>You are not assigned to any station. Please contact admin.</p>
            </div>
        );
    }

    if (station.isSuspended) {
        return (
            <div className="owner-home">
                <Navbar title={`Owner - ${station.name}`} />
                <div className="owner-error" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <Icon name="ban" size={56} color="#ef4444" />
                    <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Station Suspended</h2>
                    <p style={{ color: '#6b7280', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
                        Your station <strong>"{station.name}"</strong> has been suspended by the admin.
                        All operations are currently disabled. Please contact the administrator for more information.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="owner-home">
            <Navbar title={`Owner - ${station.name}`} />

            <div className="owner-content">
                <div className="owner-header">
                    <h1>Station Owner Dashboard</h1>
                    <div className="station-info">
                        <span className="station-name">{station.name}</span>
                        <span className="station-address">{station.address}</span>
                    </div>
                </div>

                <div className="owner-tabs">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('dashboard');
                        }}
                        className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    >
                        <Icon name="barChart" size={16} /> Dashboard
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('operators');
                        }}
                        className={`tab-btn ${activeTab === 'operators' ? 'active' : ''}`}
                    >
                        <Icon name="users" size={16} /> Operators
                    </button>
                </div>

                {activeTab === 'dashboard' ? (
                    <div className="dashboard-grid">
                        <div className="dashboard-main">
                            <StationControls station={station} ownerId={user.uid} />
                            <Analytics stationId={stationId} />
                        </div>

                        <div className="dashboard-sidebar">
                            <div className="queue-overview">
                                <h2>Live Queue Overview</h2>
                                <div className="queue-stats-summary">
                                    <div className="stat-item">
                                        <span className="stat-number">{queue.length}</span>
                                        <span className="stat-text">Total in Queue</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-number">
                                            {queue.filter(b => b.isCheckedIn).length}
                                        </span>
                                        <span className="stat-text">Checked-in</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-number">
                                            {queue.filter(b => b.status === 'eligible' && !b.isCheckedIn).length}
                                        </span>
                                        <span className="stat-text">Not Arrived</span>
                                    </div>
                                </div>
                            </div>

                            <VisualQueue
                                stationId={stationId}
                                userRole="owner"
                                maxDisplay={10}
                            />
                        </div>
                    </div>
                ) : (
                    <OperatorManagement stationId={stationId} />
                )}
            </div>
        </div>
    );
};

export default OwnerHome;
