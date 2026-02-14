// System Logs Component - View audit logs
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import './SystemLogs.css';

const SystemLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, gas, booking, queue

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const logsQuery = query(
                collection(db, COLLECTIONS.QUEUE_LOGS),
                orderBy('timestamp', 'desc'),
                limit(100)
            );

            const logsSnapshot = await getDocs(logsQuery);
            const logsData = logsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setLogs(logsData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching logs:', error);
            setLoading(false);
        }
    };

    const getActionIcon = (action) => {
        const icons = {
            'booked': '📝',
            'checked_in': '📍',
            'completed': '✓',
            'cancelled': '✗',
            'skipped': '⏭️',
            'gas_turned_on': '⛽',
            'gas_turned_off': '⛽',
            'booking_opened': '📝',
            'booking_closed': '📝'
        };
        return icons[action] || '📋';
    };

    const getActionColor = (action) => {
        if (action.includes('completed') || action.includes('on') || action.includes('opened')) {
            return 'success';
        }
        if (action.includes('cancelled') || action.includes('off') || action.includes('closed')) {
            return 'danger';
        }
        if (action.includes('skipped')) {
            return 'warning';
        }
        return 'info';
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate();
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const filteredLogs = logs.filter(log => {
        if (filter === 'all') return true;
        if (filter === 'gas') return log.action.includes('gas');
        if (filter === 'booking') return log.action.includes('booking');
        if (filter === 'queue') return ['booked', 'checked_in', 'completed', 'cancelled', 'skipped'].includes(log.action);
        return true;
    });

    return (
        <div className="system-logs">
            <div className="logs-header">
                <h2>System Logs</h2>
                <div className="logs-filters">
                    <button
                        onClick={() => setFilter('all')}
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('queue')}
                        className={`filter-btn ${filter === 'queue' ? 'active' : ''}`}
                    >
                        Queue
                    </button>
                    <button
                        onClick={() => setFilter('gas')}
                        className={`filter-btn ${filter === 'gas' ? 'active' : ''}`}
                    >
                        Gas
                    </button>
                    <button
                        onClick={() => setFilter('booking')}
                        className={`filter-btn ${filter === 'booking' ? 'active' : ''}`}
                    >
                        Booking
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="logs-loading">
                    <div className="spinner"></div>
                    <p>Loading logs...</p>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="logs-empty">
                    <p>No logs found</p>
                </div>
            ) : (
                <div className="logs-table-container">
                    <table className="logs-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Action</th>
                                <th>Station</th>
                                <th>Vehicle</th>
                                <th>Performed By</th>
                                <th>Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map(log => (
                                <tr key={log.id}>
                                    <td className="log-time">{formatTimestamp(log.timestamp)}</td>
                                    <td>
                                        <span className={`log-action ${getActionColor(log.action)}`}>
                                            {getActionIcon(log.action)} {log.action.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                    <td>{log.stationId || 'N/A'}</td>
                                    <td>{log.vehicleNumber || '-'}</td>
                                    <td className="log-user">{log.performedBy?.substring(0, 8)}...</td>
                                    <td>
                                        <span className="role-badge">{log.performedByRole}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <button onClick={fetchLogs} className="btn btn-outline refresh-btn">
                🔄 Refresh Logs
            </button>
        </div>
    );
};

export default SystemLogs;
