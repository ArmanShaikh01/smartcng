/**
 * notifications.js — Firestore Notification Service
 *
 * Schema: notifications/{userId}/items/{notifId}
 *
 * Every time a real backend event occurs, call createNotification()
 * to persist a record. The frontend listens with onSnapshot — no polling.
 */
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    writeBatch,
    getDocs,
    serverTimestamp,
    query,
    where
} from 'firebase/firestore';
import { db } from './config';

// ─── Collection path helper ─────────────────────────────────────────────────
const itemsRef = (userId) =>
    collection(db, 'notifications', userId, 'items');

// ─── Notification Types ─────────────────────────────────────────────────────
export const NOTIF_TYPE = {
    // Customer
    BOOKING_CONFIRMED:      'booking_confirmed',
    BOOKING_CANCELLED:      'booking_cancelled',
    BOOKING_NO_SHOW:        'booking_no_show',
    QUEUE_POSITION_UPDATED: 'queue_position_updated',
    TURN_ARRIVED:           'turn_arrived',
    TURN_SOON:              'turn_soon',
    FUELING_COMPLETED:      'fueling_completed',

    // Customer — check-in flow
    CHECK_IN_REMINDER:      'check_in_reminder',
    CHECKED_IN_OK:          'checked_in_ok',

    // Customer — lane-priority
    PRE_ARRIVAL_ALERT:      'pre_arrival_alert',
    CHECK_IN_EXPIRED:       'check_in_expired',
    VEHICLE_SKIPPED:        'vehicle_skipped',
    LANE_OVERTAKEN:         'lane_overtaken',

    // Operator
    BOOKING_CLOSED:         'booking_closed',
    QUEUE_ALERT:            'queue_alert',
    OPERATOR_ADDED:         'operator_added',
    OPERATOR_REMOVED:       'operator_removed',
    OPERATOR_INACTIVE:      'operator_inactive',

    // Operator — owner action alerts
    OWNER_COMPLETED_TOKEN:  'owner_completed_token',
    OWNER_SKIPPED_TOKEN:    'owner_skipped_token',
    GPS_CHECKIN_ALERT:      'gps_checkin_alert',
    BOOKING_CLOSED_ALERT:   'booking_closed_alert',

    // Owner — operator monitoring
    OPERATOR_QUEUE_ADVANCE: 'operator_queue_advance',
    QUEUE_CONGESTION:       'queue_congestion',
    SHIFT_SUMMARY:          'shift_summary',
    OPERATOR_OFFLINE:       'operator_offline',

    // Owner — admin events
    STATION_SUSPENDED:      'station_suspended',

    // Owner — gas/booking
    GAS_TURNED_OFF:         'gas_turned_off',
    GAS_TURNED_ON:          'gas_turned_on',
    STATION_BOOKING_OFF:    'station_booking_off',
    STATION_BOOKING_ON:     'station_booking_on',
    QUEUE_BACKLOG_ALERT:    'queue_backlog_alert',

    // Admin (reserved for future use)
    SYSTEM_ALERT:           'system_alert',
};

/**
 * Write a single notification document to Firestore.
 *
 * @param {string}  userId   — UID of the user who will receive this notification
 * @param {string}  type     — one of NOTIF_TYPE values
 * @param {string}  title    — short heading (≤ 60 chars)
 * @param {string}  message  — body text (≤ 140 chars)
 * @param {object}  metadata — { stationId, bookingId, vehicleNumber, ... }
 */
export const createNotification = async (userId, type, title, message, metadata = {}) => {
    if (!userId) {
        console.warn('[Notifications] ⚠️ createNotification called with null/undefined userId — skipped.', { type, title });
        return;
    }
    try {
        await addDoc(itemsRef(userId), {
            type,
            title,
            message,
            metadata,
            read: false,
            createdAt: serverTimestamp()
        });
        console.log(`[Notifications] ✅ Sent "${type}" to ${userId}`);
    } catch (err) {
        // Log clearly — a missing notification must never break the main flow
        console.error('[Notifications] ❌ Failed to write notification:', err.message, { userId, type, title });
    }
};

/**
 * Mark one notification as read.
 *
 * @param {string} userId
 * @param {string} notifId
 */
export const markNotificationRead = async (userId, notifId) => {
    if (!userId || !notifId) return;
    try {
        const notifRef = doc(db, 'notifications', userId, 'items', notifId);
        await updateDoc(notifRef, { read: true });
    } catch (err) {
        console.warn('[Notifications] markNotificationRead error:', err.message);
    }
};

/**
 * Mark ALL unread notifications for a user as read.
 *
 * @param {string} userId
 */
export const markAllNotificationsRead = async (userId) => {
    if (!userId) return;
    try {
        const q = query(itemsRef(userId), where('read', '==', false));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.docs.forEach((d) => {
            batch.update(d.ref, { read: true });
        });
        await batch.commit();
    } catch (err) {
        console.warn('[Notifications] markAllNotificationsRead error:', err.message);
    }
};
