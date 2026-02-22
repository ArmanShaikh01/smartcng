// Enhanced Navbar - Desktop: horizontal nav | Mobile: slide-in drawer
import { useState, useMemo, useRef, useEffect } from 'react';
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
    const [drawerOpen, setDrawerOpen] = useState(false);
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
        setDrawerOpen(false);
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
        <nav className="navbar">
            <div className="navbar-container">
                {/* Brand */}
                <div className="navbar-brand" onClick={() => handleNavigate(menuItems[0]?.path || '/')}>
                    <img
                        src="/smartcng-logo.jpeg"
                        alt="Smart CNG"
                        className="brand-logo-img"
                        onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                    />
                    <span className="brand-text" style={{display:'none'}}>Smart<span>CNG</span></span>
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

                        {/* ── MOBILE HAMBURGER ── */}
                        <button
                            className="hamburger-btn"
                            onClick={() => setDrawerOpen(!drawerOpen)}
                            aria-label="Toggle menu"
                        >
                            <span className={`ham-line ${drawerOpen ? 'open' : ''}`}></span>
                            <span className={`ham-line ${drawerOpen ? 'open' : ''}`}></span>
                            <span className={`ham-line ${drawerOpen ? 'open' : ''}`}></span>
                        </button>

                        {/* ── MOBILE DRAWER ── */}
                        <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
                            <div className="drawer-header">
                                <div className="drawer-user-info">
                                    <div className="drawer-avatar">{avatarLetter}</div>
                                    <div className="drawer-details">
                                        <span className="drawer-name">{userProfile?.name || 'User'}</span>
                                        <span className="drawer-phone">{user.phoneNumber}</span>
                                        {userProfile?.role && (
                                            <span className="drawer-role-badge">{userProfile.role}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="drawer-items">
                                {menuItems.map(item => (
                                    <button
                                        key={item.path}
                                        onClick={() => handleNavigate(item.path)}
                                        className={`drawer-item ${isActive(item.path) ? 'active' : ''}`}
                                    >
                                        <span className="drawer-item-icon"><Icon name={item.iconName} size={18} /></span>
                                        <span className="drawer-item-label">{item.label}</span>
                                        {item.path === '/notifications' && unreadCount > 0 && (
                                            <span className="nav-badge nav-badge--drawer">{unreadCount > 99 ? '99+' : unreadCount}</span>
                                        )}
                                        {isActive(item.path) && <span className="drawer-active-dot"></span>}
                                    </button>
                                ))}
                            </div>

                            <div className="drawer-footer">
                                <button onClick={handleSignOut} className="drawer-logout-btn">
                                    <Icon name="logOut" size={16} /> Logout
                                </button>
                            </div>
                        </div>

                        {/* Overlay for drawer */}
                        {drawerOpen && (
                            <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
                        )}
                    </>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
