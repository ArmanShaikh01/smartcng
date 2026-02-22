/**
 * Notifications.jsx — Real-Time Event-Driven Notification Feed
 *
 * Subscribes to notifications/{userId}/items via useNotifications hook.
 * No static / hardcoded data. Empty panel when no events have fired.
 */
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import Navbar from '../components/shared/Navbar';
import Icon from '../components/shared/Icon';
import './Notifications.css';

// ─── Icon + colour mapping per notification type ────────────────────────────
const TYPE_META = {
    booking_confirmed:      { icon: 'checkCircle', variant: 'success' },
    booking_cancelled:      { icon: 'xCircle',     variant: 'info'    },
    booking_no_show:        { icon: 'alertTriangle',variant: 'danger'  },
    queue_position_updated: { icon: 'queue',        variant: 'info'    },
    turn_arrived:           { icon: 'play',         variant: 'warning' },
    fueling_completed:      { icon: 'checkCircle',  variant: 'success' },
    booking_closed:         { icon: 'ban',          variant: 'warning' },
    queue_alert:            { icon: 'alertTriangle',variant: 'danger'  },
    gas_turned_off:         { icon: 'alertTriangle',variant: 'danger'  },
    station_booking_off:    { icon: 'ban',          variant: 'warning' },
    system_alert:           { icon: 'shield',       variant: 'danger'  },
};

const getMeta = (type) => TYPE_META[type] ?? { icon: 'bell', variant: 'info' };

// ─── Relative time formatter ────────────────────────────────────────────────
const formatRelativeTime = (date) => {
    if (!date) return '';
    const diffMs  = Date.now() - (date instanceof Date ? date.getTime() : date);
    const diffSec  = Math.floor(diffMs / 1000);
    const diffMin  = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay  = Math.floor(diffHour / 24);

    if (diffSec < 60)  return 'Just now';
    if (diffMin < 60)  return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7)   return `${diffDay}d ago`;
    return date instanceof Date
        ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        : '';
};

// ─── Component ───────────────────────────────────────────────────────────────
const Notifications = () => {
    const { user } = useAuth();
    const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
        useNotifications(user?.uid ?? null);

    const handleCardClick = (notif) => {
        if (!notif.read) markAsRead(notif.id);
    };

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="notifications-page">
                <Navbar title="Notifications" />
                <div className="notifications-content">
                    <div className="notifications-loading">
                        <div className="notif-spinner" />
                        <span>Loading notifications…</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="notifications-page">
            <Navbar title="Notifications" />

            <div className="notifications-content anim-page-load">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="notifications-header">
                    <div className="notifications-title">
                        <h1>Notifications</h1>
                        {unreadCount > 0 && (
                            <span className="unread-count-badge">{unreadCount}</span>
                        )}
                    </div>

                    {unreadCount > 0 && (
                        <button className="mark-all-btn" onClick={markAllAsRead}>
                            Mark all as read
                        </button>
                    )}
                </div>

                {/* ── Empty state ─────────────────────────────────────────── */}
                {notifications.length === 0 ? (
                    <div className="notifications-empty">
                        <Icon name="bell" size={36} color="#d1d5db" />
                        <p>No notifications yet.</p>
                        <span>Events like token bookings, queue updates, and alerts will appear here.</span>
                    </div>
                ) : (
                    /* ── Notification list ──────────────────────────────── */
                    <div className="notifications-list">
                        {notifications.map((notif) => {
                            const { icon, variant } = getMeta(notif.type);
                            return (
                                <div
                                    key={notif.id}
                                    className={`notification-card${notif.read ? '' : ' unread'}`}
                                    onClick={() => handleCardClick(notif)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCardClick(notif)}
                                    aria-label={notif.title}
                                >
                                    {/* Icon */}
                                    <div className={`notif-icon-wrap notif-icon--${variant}`}>
                                        <Icon name={icon} size={18} />
                                    </div>

                                    {/* Text */}
                                    <div className="notification-content">
                                        <div className="notification-meta">
                                            <p className="notification-title">{notif.title}</p>
                                            <span className="notification-time">
                                                {formatRelativeTime(notif.createdAt)}
                                            </span>
                                        </div>
                                        <p className="notification-msg">{notif.message}</p>
                                    </div>

                                    {/* Unread indicator */}
                                    {!notif.read && (
                                        <div className="unread-dot anim-dot-active" aria-hidden="true" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;
