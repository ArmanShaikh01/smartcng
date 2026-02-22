/**
 * useNotifications.js — Real-time Firestore notification hook
 *
 * Subscribes to notifications/{userId}/items via onSnapshot.
 * Returns live-updating list, unread count, and mutators.
 */
import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
    markNotificationRead,
    markAllNotificationsRead
} from '../firebase/notifications';

const MAX_NOTIFICATIONS = 50;

/**
 * @param {string|null} userId — current authenticated user UID
 * @returns {{
 *   notifications: Array,
 *   unreadCount: number,
 *   loading: boolean,
 *   markAsRead: (notifId: string) => void,
 *   markAllAsRead: () => void
 * }}
 */
export const useNotifications = (userId) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const itemsRef = collection(db, 'notifications', userId, 'items');
        const q = query(
            itemsRef,
            orderBy('createdAt', 'desc'),
            limit(MAX_NOTIFICATIONS)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const docs = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                    // Normalise Firestore Timestamp → JS Date for consistent rendering
                    createdAt: d.data().createdAt?.toDate?.() ?? new Date()
                }));
                setNotifications(docs);
                setLoading(false);
            },
            (err) => {
                console.error('[useNotifications] snapshot error:', err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    const markAsRead = useCallback(
        (notifId) => markNotificationRead(userId, notifId),
        [userId]
    );

    const markAllAsRead = useCallback(
        () => markAllNotificationsRead(userId),
        [userId]
    );

    const unreadCount = notifications.filter((n) => !n.read).length;

    return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
};
