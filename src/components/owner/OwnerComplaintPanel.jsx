// OwnerComplaintPanel — lists all complaints for this station, owner can mark as resolved
import { useState, useEffect } from 'react';
import {
    collection, query, where,
    onSnapshot, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { toast } from '../../utils/toast';
import { confirm } from '../../utils/confirm';
import './OwnerComplaintPanel.css';

const STATUS_LABELS = {
    pending:  { text: 'Pending',  emoji: '🟡', cls: 'ocp-badge--pending'  },
    resolved: { text: 'Resolved', emoji: '🟢', cls: 'ocp-badge--resolved' },
};

const OwnerComplaintPanel = ({ stationId }) => {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [filter, setFilter]         = useState('all'); // 'all' | 'pending' | 'resolved'
    const [resolving, setResolving]   = useState(null); // complaintId being resolved

    useEffect(() => {
        if (!stationId) return;

        const q = query(
            collection(db, COLLECTIONS.COMPLAINTS),
            where('stationId', '==', stationId)
        );

        const unsub = onSnapshot(q, snap => {
            const data = snap.docs
                .map(d => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
                    resolvedAt: d.data().resolvedAt?.toDate?.() ?? null,
                }))
                // sort newest first in JS (no Firestore composite index needed)
                .sort((a, b) => b.createdAt - a.createdAt);
            setComplaints(data);
            setLoading(false);
        }, err => {
            console.warn('[OwnerComplaintPanel]', err.message);
            setLoading(false);
        });

        return () => unsub();
    }, [stationId]);

    const handleResolve = async (complaintId) => {
        const ok = await confirm('Mark this complaint as resolved? This action cannot be undone.', {
            title: 'Resolve Complaint',
            confirmLabel: 'Mark Resolved',
            variant: 'primary',
        });
        if (!ok) return;
        setResolving(complaintId);
        try {
            await updateDoc(doc(db, COLLECTIONS.COMPLAINTS, complaintId), {
                status: 'resolved',
                resolvedAt: serverTimestamp(),
            });
        } catch (err) {
            toast.error('Could not update complaint: ' + err.message);
        } finally {
            setResolving(null);
        }
    };

    const formatDate = (date) => date?.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }) ?? '—';

    const filtered = filter === 'all'
        ? complaints
        : complaints.filter(c => c.status === filter);

    const pendingCount = complaints.filter(c => c.status === 'pending').length;

    if (loading) return <div className="ocp-loading"><div className="spinner" /><p>Loading complaints...</p></div>;

    return (
        <div className="ocp-container">
            {/* Header */}
            <div className="ocp-header">
                <div className="ocp-title">
                    <span>📋</span>
                    <h2>Customer Complaints</h2>
                    {pendingCount > 0 && (
                        <span className="ocp-pending-badge">{pendingCount} pending</span>
                    )}
                </div>

                {/* Filter tabs */}
                <div className="ocp-filters">
                    {['all', 'pending', 'resolved'].map(f => (
                        <button
                            key={f}
                            type="button"
                            className={`ocp-filter-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? `All (${complaints.length})` :
                             f === 'pending' ? `🟡 Pending (${complaints.filter(c=>c.status==='pending').length})` :
                             `🟢 Resolved (${complaints.filter(c=>c.status==='resolved').length})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="ocp-empty">
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎉</div>
                    <p>{filter === 'pending' ? 'No pending complaints!' : 'No complaints found.'}</p>
                </div>
            )}

            {/* Complaint cards */}
            <div className="ocp-list">
                {filtered.map(c => {
                    const status = STATUS_LABELS[c.status] || STATUS_LABELS.pending;
                    return (
                        <div key={c.id} className={`ocp-card ${c.status === 'pending' ? 'ocp-card--pending' : ''}`}>
                            {/* Left: image */}
                            <div className="ocp-card-media">
                                {c.imageUrl ? (
                                    <img
                                        src={c.imageUrl}
                                        alt="complaint"
                                        className="ocp-card-img"
                                        onClick={() => window.open(c.imageUrl, '_blank')}
                                    />
                                ) : (
                                    <div className="ocp-card-no-img">📷<br /><span>No photo</span></div>
                                )}
                            </div>

                            {/* Right: details */}
                            <div className="ocp-card-body">
                                <p className="ocp-card-desc">{c.description}</p>

                                <div className="ocp-card-meta">
                                    <span className={`ocp-badge ${status.cls}`}>
                                        {status.emoji} {status.text}
                                    </span>
                                    <span className="ocp-card-date">
                                        Filed: {formatDate(c.createdAt)}
                                    </span>
                                </div>

                                {c.resolvedAt && (
                                    <div className="ocp-card-resolved">
                                        ✓ Resolved on {formatDate(c.resolvedAt)}
                                    </div>
                                )}

                                {c.status === 'pending' && (
                                    <button
                                        type="button"
                                        className="ocp-resolve-btn"
                                        onClick={() => handleResolve(c.id)}
                                        disabled={resolving === c.id}
                                    >
                                        {resolving === c.id ? 'Resolving...' : '✓ Mark as Resolved'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OwnerComplaintPanel;
