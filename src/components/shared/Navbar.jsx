// Enhanced Navbar - Desktop: horizontal nav | Mobile: bottom nav bar (Portal)
import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import Icon from './Icon';
import './Navbar.css';


const Navbar = ({ title }) => {
    const { user, userProfile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Live unread notification count
    const { unreadCount } = useNotifications(user?.uid ?? null);

    const handleSignOut = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleNavigate = (path) => {
        navigate(path);
        setUserDropdownOpen(false);
    };

    const isActive = (path) => location.pathname === path;

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setUserDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const menuItems = useMemo(() => {
        const commonItems = [
            { path: '/profile', label: 'Profile', iconName: 'user' },
            { path: '/notifications', label: 'Notifications', iconName: 'bell' },
            { path: '/help', label: 'Help', iconName: 'helpCircle' }
        ];

        const roleSpecificItems = {
            customer: [
                { path: '/customer', label: 'Home', iconName: 'home' },
                { path: '/history', label: 'History', iconName: 'history' },
                ...commonItems
            ],
            operator: [
                { path: '/operator', label: 'Dashboard', iconName: 'home' },
                ...commonItems
            ],
            owner: [
                { path: '/owner', label: 'Dashboard', iconName: 'home' },
                ...commonItems
            ],
            admin: [
                { path: '/admin', label: 'Dashboard', iconName: 'shield' },
                ...commonItems
            ]
        };

        return roleSpecificItems[userProfile?.role] || commonItems;
    }, [userProfile?.role]);

    const avatarLetter = userProfile?.name?.charAt(0).toUpperCase() || '?';

    return (
        <>
            {/* ══ TOP NAVBAR — visible on all screens ══ */}
            <nav className="navbar">
                <div className="navbar-container">
                    {/* Brand */}
                    <div className="navbar-brand" onClick={() => handleNavigate(menuItems[0]?.path || '/')}>
                        <img
                            src="/smartcng-logo.jpeg"
                            alt="Smart CNG"
                            className="brand-logo-img"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                        <span className="brand-text" style={{ display: 'none' }}>Smart<span>CNG</span></span>
                    </div>

                    {user && (
                        <>
                            {/* ── DESKTOP NAV LINKS ── */}
                            <div className="desktop-nav">
                                {menuItems.map(item => (
                                    <button
                                        key={item.path}
                                        onClick={() => handleNavigate(item.path)}
                                        className={`desktop-nav-link ${isActive(item.path) ? 'active' : ''}`}
                                    >
                                        <span className="nav-link-icon"><Icon name={item.iconName} size={16} /></span>
                                        <span>{item.label}</span>
                                        {item.path === '/notifications' && unreadCount > 0 && (
                                            <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* ── DESKTOP USER CHIP ── */}
                            <div className="desktop-user-chip" ref={dropdownRef}>
                                <button
                                    className="user-chip-btn"
                                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                                >
                                    <div className="chip-avatar">{avatarLetter}</div>
                                    <div className="chip-info">
                                        <span className="chip-name">{userProfile?.name || 'User'}</span>
                                        {userProfile?.role && (
                                            <span className="chip-role">{userProfile.role}</span>
                                        )}
                                    </div>
                                    <span className={`chip-caret ${userDropdownOpen ? 'open' : ''}`}>▾</span>
                                </button>

                                {userDropdownOpen && (
                                    <div className="user-dropdown">
                                        <div className="dropdown-info">
                                            <span className="dropdown-phone">{user.phoneNumber}</span>
                                        </div>
                                        <button onClick={handleSignOut} className="dropdown-logout">
                                            <Icon name="logOut" size={14} /> Logout
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ── MOBILE USER AVATAR (right side of top bar) ── */}
                            <div className="mobile-user-avatar-wrap" ref={dropdownRef}>
                                <button
                                    className="mobile-avatar-btn"
                                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                                    aria-label="Account menu"
                                >
                                    <span className="mobile-avatar-letter">{avatarLetter}</span>
                                </button>

                                {userDropdownOpen && (
                                    <div className="mobile-user-dropdown">
                                        <div className="mob-drop-user">
                                            <div className="mob-drop-avatar">{avatarLetter}</div>
                                            <div className="mob-drop-info">
                                                <span className="mob-drop-name">{userProfile?.name || 'User'}</span>
                                                <span className="mob-drop-role">{userProfile?.role}</span>
                                                <span className="mob-drop-phone">{user.phoneNumber}</span>
                                            </div>
                                        </div>
                                        <button onClick={handleSignOut} className="mob-drop-logout">
                                            <Icon name="logOut" size={15} /> Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </nav>

            {/* ══ MOBILE BOTTOM NAV BAR ══
                Rendered via Portal directly into document.body so no ancestor
                CSS (transform / animation / overflow) can break position:fixed */}
            {user && createPortal(
                <nav className="bottom-nav" aria-label="Mobile bottom navigation">
                    {menuItems.map(item => (
                        <button
                            key={item.path}
                            type="button"
                            onClick={() => handleNavigate(item.path)}
                            className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
                            aria-label={item.label}
                        >
                            <span className="bottom-nav-icon">
                                <Icon name={item.iconName} size={22} />
                                {item.path === '/notifications' && unreadCount > 0 && (
                                    <span className="bottom-nav-badge">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </span>
                            <span className="bottom-nav-label">{item.label}</span>
                        </button>
                    ))}
                </nav>,
                document.body
            )}
        </>
    );
};

export default Navbar;
