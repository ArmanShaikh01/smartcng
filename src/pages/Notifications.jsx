// Notifications Page - View all notifications
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/shared/Navbar';
import './Notifications.css';

const Notifications = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, [user]);

    const fetchNotifications = async () => {
        if (!user) return;

        try {
            // Mock notifications for now - in production, fetch from Firestore
            const mockNotifications = [
                {
                    id: '1',
                    type: 'booking_confirmed',
                    title: 'Booking Confirmed',
                    message: 'Your booking for MH12AB1234 has been confirmed. Queue position: #5',
                    timestamp: new Date(),
                    read: false
                },
                {
                    id: '2',
                    type: 'check_in_reminder',
                    title: 'Check-in Reminder',
                    message: 'You are now eligible to check-in. Please arrive at the station.',
                    timestamp: new Date(Date.now() - 3600000),
                    read: false
                },
                {
                    id: '3',
                    type: 'booking_completed',
                    title: 'Booking Completed',
                    message: 'Your fueling is complete. Thank you for using CNG Queue!',
                    timestamp: new Date(Date.now() - 7200000),
                    read: true
                }
            ];

            setNotifications(mockNotifications);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            setLoading(false);
        }
    };

    const getNotificationIcon = (type) => {
        const icons = {
            booking_confirmed: '✓',
            check_in_reminder: '📍',
            booking_completed: '⛽',
            booking_cancelled: '✗',
            queue_advanced: '▶️',
            system_alert: '⚠️'
        };
        return icons[type] || '📢';
    };

    const getNotificationColor = (type) => {
        const colors = {
            booking_confirmed: 'success',
            check_in_reminder: 'warning',
            booking_completed: 'success',
            booking_cancelled: 'danger',
            queue_advanced: 'info',
            system_alert: 'warning'
        };
        return colors[type] || 'info';
    };

    const formatTime = (timestamp) => {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const markAsRead = (id) => {
        setNotifications(notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
        ));
    };

    const markAllAsRead = () => {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="notifications-page">
            <Navbar title="Notifications" />

            <div className="notifications-content">
                <div className="notifications-header">
                    <h1>Notifications</h1>
                    {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="btn btn-outline btn-sm">
                            Mark all as read ({unreadCount})
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="notifications-loading">
                        <div className="spinner"></div>
                        <p>Loading notifications...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="notifications-empty">
                        <p>🔔 No notifications yet</p>
                    </div>
                ) : (
                    <div className="notifications-list">
                        {notifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`notification-card ${!notification.read ? 'unread' : ''}`}
                                onClick={() => markAsRead(notification.id)}
                            >
                                <div className={`notification-icon ${getNotificationColor(notification.type)}`}>
                                    {getNotificationIcon(notification.type)}
                                </div>
                                <div className="notification-content">
                                    <div className="notification-header">
                                        <h3>{notification.title}</h3>
                                        <span className="notification-time">{formatTime(notification.timestamp)}</span>
                                    </div>
                                    <p>{notification.message}</p>
                                </div>
                                {!notification.read && <div className="unread-indicator"></div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;
