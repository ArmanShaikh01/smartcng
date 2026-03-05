// Audit Log Utility — logs important owner/operator actions to Firestore
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';

export const AUDIT_ACTION = {
    GAS_ON:              'GAS_ON',
    GAS_OFF:             'GAS_OFF',
    BOOKING_OPEN:        'BOOKING_OPEN',
    BOOKING_CLOSE:       'BOOKING_CLOSE',
    SKIP_VEHICLE:        'SKIP_VEHICLE',
    NO_SHOW:             'NO_SHOW',
    EMERGENCY_PRIORITY:  'EMERGENCY_PRIORITY',
    MARK_COMPLETED:      'MARK_COMPLETED',
    SLOT_CAPACITY_CHANGE:'SLOT_CAPACITY_CHANGE',
    OPERATOR_ADD:        'OPERATOR_ADD',
    OPERATOR_REMOVE:     'OPERATOR_REMOVE',
};

/**
 * Log an audit action to Firestore.
 * Non-blocking — errors are swallowed so they never break UI flow.
 *
 * @param {object} params
 * @param {string} params.userId    - UID of the user performing the action
 * @param {string} params.role      - 'owner' | 'operator' | 'admin'
 * @param {string} params.actionType - One of AUDIT_ACTION constants
 * @param {string} params.description - Human-readable description
 * @param {string} params.stationId - Station ID
 */
export const logAuditAction = async ({
    userId,
    role,
    actionType,
    description,
    stationId = null,
    meta = {}
}) => {
    try {
        await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
            userId,
            role,
            actionType,
            description,
            stationId,
            meta,
            createdAt: serverTimestamp()
        });
    } catch (err) {
        // Non-critical — log to console but don't surface to user
        console.warn('[AuditLog] Failed to write audit log:', err.message);
    }
};
