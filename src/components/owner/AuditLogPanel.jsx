// AuditLogPanel — shows owner all logged actions with filters
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { AUDIT_ACTION } from '../../utils/auditLog';
import './AuditLogPanel.css';

const ACTION_LABELS = {
    [AUDIT_ACTION.GAS_ON]:              { label: 'Gas ON',              emoji: '🟢', color: '#065f46', bg: '#d1fae5' },
    [AUDIT_ACTION.GAS_OFF]:             { label: 'Gas OFF',             emoji: '🔴', color: '#991b1b', bg: '#fee2e2' },
    [AUDIT_ACTION.BOOKING_OPEN]:        { label: 'Booking Open',        emoji: '📗', color: '#065f46', bg: '#d1fae5' },
    [AUDIT_ACTION.BOOKING_CLOSE]:       { label: 'Booking Closed',      emoji: '📕', color: '#7c3aed', bg: '#ede9fe' },
    [AUDIT_ACTION.SKIP_VEHICLE]:        { label: 'Vehicle Skipped',     emoji: '⏭️', color: '#92400e', bg: '#fef3c7' },
    [AUDIT_ACTION.NO_SHOW]:             { label: 'No-Show',             emoji: '🚫', color: '#991b1b', bg: '#fee2e2' },
    [AUDIT_ACTION.EMERGENCY_PRIORITY]:  { label: 'Emergency Priority',  emoji: '🚨', color: '#b91c1c', bg: '#fee2e2' },
    [AUDIT_ACTION.MARK_COMPLETED]:      { label: 'Marked Completed',    emoji: '✅', color: '#065f46', bg: '#d1fae5' },
    [AUDIT_ACTION.SLOT_CAPACITY_CHANGE]:{ label: 'Slot Capacity Change',emoji: '🔧', color: '#1d4ed8', bg: '#dbeafe' },
    [AUDIT_ACTION.OPERATOR_ADD]:        { label: 'Operator Added',      emoji: '👤', color: '#065f46', bg: '#d1fae5' },
    [AUDIT_ACTION.OPERATOR_REMOVE]:     { label: 'Operator Removed',    emoji: '🗑️', color: '#991b1b', bg: '#fee2e2' },
};

const FILTER_OPTIONS = [
    { value: 'today',   label: 'Today' },
    { value: '7days',   label: 'Last 7 Days' },
    { value: '30days',  label: 'Last 30 Days' },
];

const getFromDate = (filter) => {
    const d = new Date();
    if (filter === 'today')  { d.setHours(0, 0, 0, 0); }
    else if (filter === '7days')  { d.setDate(d.getDate() - 7); }
    else if (filter === '30days') { d.setDate(d.getDate() - 30); }
    return Timestamp.fromDate(d);
};

const AuditLogPanel = ({ stationId }) => {
    const [logs, setLogs]             = useState([]);
    const [loading, setLoading]       = useState(true);
    const [timeFilter, setTime]       = useState('today');
    const [actionFilter, setAction]   = useState('all');

    useEffect(() => {
        if (!stationId) return;

        const fromDate = getFromDate(timeFilter);
        const q = query(
            collection(db, COLLECTIONS.AUDIT_LOGS),
            where('stationId', '==', stationId),
            where('createdAt', '>=', fromDate)
        );

        const unsub = onSnapshot(q, snap => {
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() ?? new Date() }))
                .sort((a, b) => b.createdAt - a.createdAt);
            setLogs(data);
            setLoading(false);
        }, err => {
            console.warn('[AuditLog]', err.message);
            setLoading(false);
        });

        return () => unsub();
    }, [stationId, timeFilter]);

    const filtered = actionFilter === 'all'
        ? logs
        : logs.filter(l => l.actionType === actionFilter);

    const fmt = (d) => d.toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

    if (loading) return <div className="alp-loading"><div className="spinner" /><p>Loading logs...</p></div>;

    return (
        <div className="alp-container">
            {/* ── Filters ── */}
            <div className="alp-filters">
                <div className="alp-filter-group">
                    {FILTER_OPTIONS.map(f => (
                        <button key={f.value} type="button"
                            className={`alp-filter-btn ${timeFilter === f.value ? 'active' : ''}`}
                            onClick={() => setTime(f.value)}>{f.label}</button>
                    ))}
                </div>
                <select
                    className="alp-select"
                    value={actionFilter}
                    onChange={e => setAction(e.target.value)}
                >
                    <option value="all">All Actions</option>
                    {Object.entries(ACTION_LABELS).map(([key, v]) => (
                        <option key={key} value={key}>{v.emoji} {v.label}</option>
                    ))}
                </select>
            </div>

            {/* ── Count ── */}
            <p className="alp-count">{filtered.length} action{filtered.length !== 1 ? 's' : ''} found</p>

            {/* ── Log List ── */}
            {filtered.length === 0 ? (
                <div className="alp-empty">
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
                    <p>No activity in this period.</p>
                </div>
            ) : (
                <div className="alp-list">
                    {filtered.map(log => {
                        const cfg = ACTION_LABELS[log.actionType] || { label: log.actionType, emoji: '📌', color: '#374151', bg: '#f3f4f6' };
                        return (
                            <div key={log.id} className="alp-row">
                                <div className="alp-row-icon" style={{ background: cfg.bg, color: cfg.color }}>
                                    {cfg.emoji}
                                </div>
                                <div className="alp-row-body">
                                    <div className="alp-row-action" style={{ color: cfg.color }}>{cfg.label}</div>
                                    <div className="alp-row-desc">{log.description}</div>
                                    <div className="alp-row-meta">
                                        <span className={`alp-role alp-role--${log.role}`}>{log.role}</span>
                                        <span>{fmt(log.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AuditLogPanel;
