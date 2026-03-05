// Owner Home - Main owner interface
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRealtimeStation } from '../hooks/useRealtimeStation';
import { useRealtimeQueue } from '../hooks/useRealtimeQueue';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import Navbar from '../components/shared/Navbar';
import StationControls from '../components/owner/StationControls';
import Analytics from '../components/owner/Analytics';
import VisualQueue from '../components/shared/VisualQueue';
import OperatorManagement from '../components/owner/OperatorManagement';
import OwnerComplaintPanel from '../components/owner/OwnerComplaintPanel';
import AuditLogPanel from '../components/owner/AuditLogPanel';
import StationRatingDashboard from '../components/owner/StationRatingDashboard';
import SmartQueueControl from '../components/owner/SmartQueueControl';
import Icon from '../components/shared/Icon';
import './OwnerHome.css';

const OwnerHome = () => {
    const { user, userProfile } = useAuth();
    const stationId = userProfile?.stationId;
    const [activeTab, setActiveTab] = useState('dashboard');
    const [pendingComplaints, setPending] = useState(0);

    const { station, loading: stationLoading } = useRealtimeStation(stationId);
    const { queue, loading: queueLoading } = useRealtimeQueue(stationId);

    // Live count of pending complaints for badge
    useEffect(() => {
        if (!stationId) return;
        const q = query(
            collection(db, COLLECTIONS.COMPLAINTS),
            where('stationId', '==', stationId),
            where('status', '==', 'pending')
        );
        const unsub = onSnapshot(q, snap => setPending(snap.size));
        return () => unsub();
    }, [stationId]);

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

    const tabs = [
        { key: 'dashboard',  label: 'Dashboard',      icon: 'barChart'   },
        { key: 'operators',  label: 'Operators',       icon: 'users'      },
        { key: 'complaints', label: 'Complaints',      icon: 'alertTriangle' },
        { key: 'logs',       label: 'Activity Logs',   icon: 'history'    },
    ];

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

                {/* ── Tabs ── */}
                <div className="owner-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setActiveTab(tab.key); }}
                            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                            style={{ position: 'relative' }}
                        >
                            {tab.icon && <Icon name={tab.icon} size={16} />} {tab.label}
                            {/* Complaint badge */}
                            {tab.key === 'complaints' && pendingComplaints > 0 && (
                                <span style={{
                                    position: 'absolute', top: -6, right: -6,
                                    background: '#ef4444', color: '#fff',
                                    fontSize: '0.65rem', fontWeight: 700,
                                    borderRadius: '99px', padding: '2px 6px', lineHeight: 1
                                }}>{pendingComplaints}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ── */}
                {activeTab === 'dashboard' && (
                    <div className="dashboard-grid">
                        <div className="dashboard-main">
                            <StationControls station={station} ownerId={user.uid} />
                            <Analytics stationId={stationId} />
                            {/* Smart Queue Control Panel */}
                            <SmartQueueControl stationId={stationId} ownerId={user.uid} />
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
                )}

                {activeTab === 'operators' && (
                    <OperatorManagement stationId={stationId} />
                )}

                {activeTab === 'complaints' && (
                    <div>
                        {/* Rating Dashboard at top */}
                        <StationRatingDashboard stationId={stationId} />
                        {/* Complaint List below */}
                        <OwnerComplaintPanel stationId={stationId} />
                    </div>
                )}

                {activeTab === 'logs' && (
                    <AuditLogPanel stationId={stationId} />
                )}
            </div>
        </div>
    );
};

export default OwnerHome;
