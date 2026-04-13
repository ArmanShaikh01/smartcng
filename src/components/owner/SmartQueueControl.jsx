// SmartQueueControl — manual queue management for owner
// Uses operatorLogic functions (skipVehicle, markNoShow, advanceQueue)
// which call evaluateGate for proper position recompaction.
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { skipVehicle, markNoShow, advanceQueue } from '../../utils/operatorLogic';
import { logAuditAction, AUDIT_ACTION } from '../../utils/auditLog';
import { createNotification, NOTIF_TYPE } from '../../firebase/notifications';
import { toast } from '../../utils/toast';
import { confirm } from '../../utils/confirm';
import './SmartQueueControl.css';

// Helper: get all operator UIDs — tries station doc first, then users collection
const fetchOperatorIds = async (stationId) => {
    try {
        // Try station doc first (fast path)
        const stationSnap = await getDocs(
            query(collection(db, COLLECTIONS.STATIONS), where('stationId', '==', stationId))
        );
        if (!stationSnap.empty) {
            const ids = stationSnap.docs[0].data().operatorIds || [];
            if (ids.length > 0) return ids;
        }
        // Slow path: query users with stationId + role=operator
        const usersSnap = await getDocs(
            query(collection(db, COLLECTIONS.USERS), where('stationId', '==', stationId))
        );
        return usersSnap.docs
            .filter(d => d.data().role === 'operator')
            .map(d => d.data().userId || d.id);
    } catch { return []; }
};

// Helper: get owner UID — tries station doc first, then users collection
const fetchOwnerIdOfStation = async (stationId) => {
    try {
        const stationSnap = await getDocs(
            query(collection(db, COLLECTIONS.STATIONS), where('stationId', '==', stationId))
        );
        if (!stationSnap.empty) {
            const ownerId = stationSnap.docs[0].data().ownerId;
            if (ownerId) return ownerId;
        }
        // Slow path
        const usersSnap = await getDocs(
            query(collection(db, COLLECTIONS.USERS), where('stationId', '==', stationId))
        );
        const ownerDoc = usersSnap.docs.find(d => d.data().role === 'owner');
        return ownerDoc ? (ownerDoc.data().userId || ownerDoc.id) : null;
    } catch { return null; }
};

const ACTION_BTNS = [
    { key: 'complete',  label: '✅ Complete',  cls: 'sqc-btn--complete',  tip: 'Mark as fueling done' },
    { key: 'skip',      label: '⏭️ Skip',      cls: 'sqc-btn--skip',      tip: 'Move to end of queue' },
    { key: 'noshow',    label: '🚫 No-Show',   cls: 'sqc-btn--noshow',    tip: 'Cancel — not arrived' },
    { key: 'emergency', label: '🚨 Emergency', cls: 'sqc-btn--emergency', tip: 'Move to top of queue' },
];

const SmartQueueControl = ({ stationId, ownerId }) => {
    const [queue, setQueue]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(null);

    // ── Live queue listener ──────────────────────────────────────────────────
    // NOTE: Single where clause only (stationId) — no composite index needed.
    // Filtering by status is done in JS after snapshot arrives.
    useEffect(() => {
        if (!stationId) return;

        const q = query(
            collection(db, COLLECTIONS.BOOKINGS),
            where('stationId', '==', stationId)
            // No status filter here — Firestore requires composite index for compound queries
        );

        const unsub = onSnapshot(q, snap => {
            const ACTIVE = ['waiting', 'eligible', 'checked_in', 'fueling'];
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(b => ACTIVE.includes(b.status))
                .sort((a, b) => {
                    if (a.isEmergency && !b.isEmergency) return -1;
                    if (!a.isEmergency &&  b.isEmergency) return 1;
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
            if (actionKey === 'complete') {
                // Use advanceQueue — handles fueling promotion + evaluateGate
                const ok = await confirm(
                    `Mark ${booking.vehicleNumber} as completed and advance the queue?`,
                    { title: 'Complete Vehicle', confirmLabel: 'Yes, Complete', variant: 'primary' }
                );
                if (!ok) { setWorking(null); return; }

                const result = await advanceQueue(stationId, ownerId);
                if (!result.success) {
                    toast.error('Failed: ' + result.error);
                } else {
                    toast.success(`✅ ${booking.vehicleNumber} completed. Next: ${result.nextVehicle}`);
                    await logAuditAction({
                        userId: ownerId, role: 'owner', stationId,
                        actionType: AUDIT_ACTION.MARK_COMPLETED,
                        description: `Marked vehicle ${booking.vehicleNumber} as completed (Position #${booking.queuePosition})`
                    });
                    // ── Alert operators: owner completed a token ─────────────────────
                    const opIds = await fetchOperatorIds(stationId);
                    await Promise.all(opIds.map(uid =>
                        createNotification(uid, NOTIF_TYPE.OWNER_COMPLETED_TOKEN,
                            '⚠️ Owner Action: Token Completed',
                            `Token #${booking.queuePosition} (${booking.vehicleNumber}) completed by Owner. Please signal the next vehicle.`,
                            { stationId, vehicleNumber: booking.vehicleNumber, bookingId: booking.id }
                        )
                    ));
                }

            } else if (actionKey === 'skip') {
                // Use skipVehicle — moves to end + calls evaluateGate to recompact
                const ok = await confirm(
                    `Skip ${booking.vehicleNumber}? They will move to the back of the queue.`,
                    { title: 'Skip Vehicle', confirmLabel: 'Yes, Skip', variant: 'warning' }
                );
                if (!ok) { setWorking(null); return; }

                const result = await skipVehicle(booking.id, booking.vehicleNumber, stationId, ownerId);
                if (!result.success) {
                    toast.error('Failed to skip: ' + result.error);
                } else {
                    toast.success(`⏭️ ${booking.vehicleNumber} skipped (${result.skipCount}/3)`);
                    await logAuditAction({
                        userId: ownerId, role: 'owner', stationId,
                        actionType: AUDIT_ACTION.SKIP_VEHICLE,
                        description: `Skipped vehicle ${booking.vehicleNumber} (was #${booking.queuePosition})`
                    });
                    // ── Alert operators: owner skipped a token ───────────────────────
                    const opIds = await fetchOperatorIds(stationId);
                    await Promise.all(opIds.map(uid =>
                        createNotification(uid, NOTIF_TYPE.OWNER_SKIPPED_TOKEN,
                            '🚫 Owner Action: Token Skipped!',
                            `Token #${booking.queuePosition} (${booking.vehicleNumber}) has been SKIPPED. Update physical queue immediately.`,
                            { stationId, vehicleNumber: booking.vehicleNumber, bookingId: booking.id, skipCount: result.skipCount }
                        )
                    ));
                }

            } else if (actionKey === 'noshow') {
                // Use markNoShow — removes from queue + calls evaluateGate
                const ok = await confirm(
                    `Mark ${booking.vehicleNumber} as No-Show? They will be removed from the queue.`,
                    { title: 'Mark No-Show', confirmLabel: 'Yes, No-Show', variant: 'danger' }
                );
                if (!ok) { setWorking(null); return; }

                const result = await markNoShow(booking.id, booking.vehicleNumber, stationId, ownerId);
                if (!result.success) {
                    toast.error('Failed: ' + result.error);
                } else {
                    toast.success(`🚫 ${booking.vehicleNumber} marked as no-show`);
                    await logAuditAction({
                        userId: ownerId, role: 'owner', stationId,
                        actionType: AUDIT_ACTION.NO_SHOW,
                        description: `Marked vehicle ${booking.vehicleNumber} as No-Show (was #${booking.queuePosition})`
                    });
                }

            } else if (actionKey === 'emergency') {
                // Emergency — move to position 1, shift all others down + evaluateGate
                const ok = await confirm(
                    `Give emergency priority to ${booking.vehicleNumber}? They will be moved to #1.`,
                    { title: 'Emergency Priority', confirmLabel: 'Yes, Emergency', variant: 'warning' }
                );
                if (!ok) { setWorking(null); return; }

                const batch = writeBatch(db);
                // Shift all other vehicles +1
                queue
                    .filter(b => b.id !== booking.id)
                    .forEach(b => {
                        batch.update(doc(db, COLLECTIONS.BOOKINGS, b.id), {
                            queuePosition: (b.queuePosition || 1) + 1,
                            updatedAt: serverTimestamp()
                        });
                    });
                // Move emergency vehicle to position 1
                batch.update(doc(db, COLLECTIONS.BOOKINGS, booking.id), {
                    queuePosition: 1,
                    isEmergency: true,
                    emergencyAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                await batch.commit();
                toast.success(`🚨 ${booking.vehicleNumber} moved to #1 — Emergency!`);
                await logAuditAction({
                    userId: ownerId, role: 'owner', stationId,
                    actionType: AUDIT_ACTION.EMERGENCY_PRIORITY,
                    description: `Emergency priority given to vehicle ${booking.vehicleNumber} — moved to #1`
                });
                await createNotification(
                    booking.customerId,
                    NOTIF_TYPE.QUEUE_POSITION_UPDATED,
                    '🚨 Emergency Priority Granted!',
                    `Vehicle ${booking.vehicleNumber} has been moved to #1 in the queue.`,
                    { stationId, bookingId: booking.id }
                );
            }
        } catch (err) {
            console.error('[SmartQueueControl] Action failed:', err);
            toast.error(`Action failed: ${err.message}`);
        } finally {
            setWorking(null);
        }
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

    if (loading) return (
        <div className="sqc-loading">
            <div className="spinner" />
            <p>Loading queue...</p>
        </div>
    );

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
