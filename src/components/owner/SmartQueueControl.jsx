// SmartQueueControl — manual queue management for owner
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { logAuditAction, AUDIT_ACTION } from '../../utils/auditLog';
import { createNotification, NOTIF_TYPE } from '../../firebase/notifications';
import './SmartQueueControl.css';

const ACTION_BTNS = [
    { key: 'complete',   label: '✅ Complete',   cls: 'sqc-btn--complete',   tip: 'Mark as fueling done' },
    { key: 'skip',       label: '⏭️ Skip',       cls: 'sqc-btn--skip',       tip: 'Move to end of queue' },
    { key: 'noshow',     label: '🚫 No-Show',    cls: 'sqc-btn--noshow',     tip: 'Cancel — not arrived' },
    { key: 'emergency',  label: '🚨 Emergency',  cls: 'sqc-btn--emergency',  tip: 'Move to top of queue' },
];

const SmartQueueControl = ({ stationId, ownerId }) => {
    const [queue, setQueue]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [working, setWorking]   = useState(null); // bookingId being actioned

    // Live queue listener sorted by priority then position
    useEffect(() => {
        if (!stationId) return;
        const q = query(
            collection(db, COLLECTIONS.BOOKINGS),
            where('stationId', '==', stationId),
            where('status', 'in', ['waiting', 'eligible', 'checked_in', 'fueling'])
        );
        const unsub = onSnapshot(q, snap => {
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    // Emergency first, then FIFO by queuePosition
                    if (a.isEmergency && !b.isEmergency) return -1;
                    if (!a.isEmergency && b.isEmergency) return 1;
                    return (a.queuePosition || 0) - (b.queuePosition || 0);
                });
            setQueue(data);
            setLoading(false);
        });
        return () => unsub();
    }, [stationId]);

    const doAction = async (booking, actionKey) => {
        setWorking(booking.id);
        try {
            const bookingRef = doc(db, COLLECTIONS.BOOKINGS, booking.id);

            if (actionKey === 'complete') {
                await updateDoc(bookingRef, {
                    status: 'completed',
                    completedAt: serverTimestamp(),
                    completedBy: ownerId
                });
                await logAuditAction({
                    userId: ownerId, role: 'owner', stationId,
                    actionType: AUDIT_ACTION.MARK_COMPLETED,
                    description: `Marked vehicle ${booking.vehicleNumber} as completed (Position #${booking.queuePosition})`
                });
                await createNotification(booking.customerId, NOTIF_TYPE.BOOKING_COMPLETE, {
                    message: '⛽ Your vehicle fueling is complete!'
                });

            } else if (actionKey === 'skip') {
                // Move to last position
                const maxPos = Math.max(...queue.map(b => b.queuePosition || 0));
                await updateDoc(bookingRef, {
                    status: 'waiting',
                    queuePosition: maxPos + 1,
                    skippedAt: serverTimestamp()
                });
                await logAuditAction({
                    userId: ownerId, role: 'owner', stationId,
                    actionType: AUDIT_ACTION.SKIP_VEHICLE,
                    description: `Skipped vehicle ${booking.vehicleNumber} (was #${booking.queuePosition})`
                });
                await createNotification(booking.customerId, NOTIF_TYPE.BOOKING_UPDATE, {
                    message: '⏭️ Your vehicle was skipped. You have been moved to the end of the queue.'
                });

            } else if (actionKey === 'noshow') {
                await updateDoc(bookingRef, {
                    status: 'skipped',
                    cancelledAt: serverTimestamp(),
                    cancelReason: 'no_show'
                });
                // Recalculate positions for remaining vehicles
                await recalcPositions(booking.queuePosition);
                await logAuditAction({
                    userId: ownerId, role: 'owner', stationId,
                    actionType: AUDIT_ACTION.NO_SHOW,
                    description: `Marked vehicle ${booking.vehicleNumber} as No-Show (was #${booking.queuePosition})`
                });
                await createNotification(booking.customerId, NOTIF_TYPE.BOOKING_UPDATE, {
                    message: '🚫 Your booking was cancelled as you did not arrive in time.'
                });

            } else if (actionKey === 'emergency') {
                // Mark as emergency & move to position 1; shift others down
                const batch = writeBatch(db);
                // Shift all existing vehicles +1
                queue
                    .filter(b => b.id !== booking.id)
                    .forEach(b => {
                        batch.update(doc(db, COLLECTIONS.BOOKINGS, b.id), {
                            queuePosition: (b.queuePosition || 1) + 1
                        });
                    });
                batch.update(bookingRef, {
                    queuePosition: 1,
                    isEmergency: true,
                    emergencyAt: serverTimestamp()
                });
                await batch.commit();
                await logAuditAction({
                    userId: ownerId, role: 'owner', stationId,
                    actionType: AUDIT_ACTION.EMERGENCY_PRIORITY,
                    description: `Emergency priority given to vehicle ${booking.vehicleNumber} — moved to #1`
                });
                await createNotification(booking.customerId, NOTIF_TYPE.BOOKING_UPDATE, {
                    message: '🚨 Emergency priority granted! You are now #1 in the queue.'
                });
            }
        } catch (err) {
            alert(`Action failed: ${err.message}`);
        } finally {
            setWorking(null);
        }
    };

    // Recalculate queue positions after a no-show removal
    const recalcPositions = async (removedPos) => {
        const toUpdate = queue.filter(b => (b.queuePosition || 0) > removedPos);
        if (toUpdate.length === 0) return;
        const batch = writeBatch(db);
        toUpdate.forEach(b => {
            batch.update(doc(db, COLLECTIONS.BOOKINGS, b.id), {
                queuePosition: (b.queuePosition || 1) - 1
            });
        });
        await batch.commit();
    };

    const statusBadge = (b) => {
        const map = {
            waiting:    { text: 'Waiting',    cls: 'sqc-status--waiting' },
            eligible:   { text: 'Eligible',   cls: 'sqc-status--eligible' },
            checked_in: { text: 'Checked-in', cls: 'sqc-status--checked' },
            fueling:    { text: 'Fueling',    cls: 'sqc-status--fueling' },
        };
        return map[b.status] || { text: b.status, cls: '' };
    };

    if (loading) return <div className="sqc-loading"><div className="spinner" /><p>Loading queue...</p></div>;

    return (
        <div className="sqc-container">
            <div className="sqc-heading">
                <span>🎛️ Smart Queue Control</span>
                <span className="sqc-count">{queue.length} vehicle{queue.length !== 1 ? 's' : ''} in queue</span>
            </div>

            {queue.length === 0 ? (
                <div className="sqc-empty">
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
                    <p>Queue is empty</p>
                </div>
            ) : (
                <div className="sqc-list">
                    {queue.map(b => {
                        const badge = statusBadge(b);
                        const isWorking = working === b.id;
                        return (
                            <div key={b.id} className={`sqc-row ${b.isEmergency ? 'sqc-row--emergency' : ''}`}>
                                {/* Position + emergency badge */}
                                <div className="sqc-pos">
                                    #{b.queuePosition}
                                    {b.isEmergency && <span className="sqc-emer-tag">🚨</span>}
                                </div>

                                {/* Vehicle details */}
                                <div className="sqc-info">
                                    <div className="sqc-vehicle">{b.vehicleNumber}</div>
                                    <span className={`sqc-status ${badge.cls}`}>{badge.text}</span>
                                    {b.isCheckedIn && <span className="sqc-checkin-tag">✓ In</span>}
                                </div>

                                {/* Action buttons */}
                                <div className="sqc-actions">
                                    {ACTION_BTNS.map(btn => (
                                        <button
                                            key={btn.key}
                                            type="button"
                                            title={btn.tip}
                                            className={`sqc-btn ${btn.cls}`}
                                            onClick={() => doAction(b, btn.key)}
                                            disabled={isWorking}
                                        >
                                            {isWorking ? '...' : btn.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SmartQueueControl;
