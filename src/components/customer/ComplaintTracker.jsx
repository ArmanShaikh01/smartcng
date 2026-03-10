// ComplaintTracker — shows a customer's complaint history with live status
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import './ComplaintTracker.css';

const ComplaintTracker = ({ customerId }) => {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading]       = useState(true);

    useEffect(() => {
        if (!customerId) return;

        const q = query(
            collection(db, COLLECTIONS.COMPLAINTS),
            where('customerId', '==', customerId),
            orderBy('createdAt', 'desc')
        );

        const unsub = onSnapshot(q, snap => {
            const data = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate?.() ?? new Date()
            }));
            setComplaints(data);
            setLoading(false);
        }, err => {
            console.warn('[ComplaintTracker] error:', err.message);
            setLoading(false);
        });

        return () => unsub();
    }, [customerId]);

    const formatDate = (date) => date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    if (loading) return <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading complaints...</p>;

    return (
        <div className="ct-container">
            <div className="ct-heading">
                <span>📋</span> My Complaints
            </div>

            {complaints.length === 0 ? (
                <div className="ct-empty">
                    <p>No complaints filed yet.</p>
                </div>
            ) : (
                <div className="ct-list">
                    {complaints.map(c => (
                        <div key={c.id} className="ct-card">
                            {c.imageUrl ? (
                                <img
                                    className="ct-card-img"
                                    src={c.imageUrl}
                                    alt="complaint"
                                    onClick={() => window.open(c.imageUrl, '_blank')}
                                    style={{ cursor: 'pointer' }}
                                />
                            ) : (
                                <div className="ct-card-img-placeholder">📷</div>
                            )}
                            <div className="ct-card-body">
                                <p className="ct-card-desc">{c.description}</p>
                                <div className="ct-card-footer">
                                    <span className={`ct-badge ct-badge--${c.status}`}>
                                        {c.status === 'pending' ? '🟡 Pending' : '🟢 Resolved'}
                                    </span>
                                    <span className="ct-date">{formatDate(c.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ComplaintTracker;
