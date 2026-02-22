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
    BOOKING_CONFIRMED:     'booking_confirmed',
    BOOKING_CANCELLED:     'booking_cancelled',
    BOOKING_NO_SHOW:       'booking_no_show',
    QUEUE_POSITION_UPDATED:'queue_position_updated',
    TURN_ARRIVED:          'turn_arrived',
    FUELING_COMPLETED:     'fueling_completed',

    // Operator
    BOOKING_CLOSED:        'booking_closed',
    QUEUE_ALERT:           'queue_alert',

    // Owner
    GAS_TURNED_OFF:        'gas_turned_off',
    STATION_BOOKING_OFF:   'station_booking_off',

    // Admin (reserved for future use)
    SYSTEM_ALERT:          'system_alert',
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
    if (!userId) return;   // safety guard — never write without a target

    try {
        await addDoc(itemsRef(userId), {
            type,
            title,
            message,
            metadata,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (err) {
        // Fail silently — a missing notification must never break the main flow
        console.warn('[Notifications] Failed to write notification:', err.message);
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
