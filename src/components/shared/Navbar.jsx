// Enhanced Navbar Component with Navigation Menu
import { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = ({ title }) => {
    const { user, userProfile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

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
        setMenuOpen(false);
    };

    const isActive = (path) => location.pathname === path;

    // Memoize menu items to prevent creating new array on every render
    const menuItems = useMemo(() => {
        const commonItems = [
            { path: '/profile', label: 'Profile', icon: '👤' },
            { path: '/notifications', label: 'Notifications', icon: '🔔' },
            { path: '/help', label: 'Help', icon: '❓' }
        ];

        const roleSpecificItems = {
            customer: [
                { path: '/customer', label: 'Home', icon: '🏠' },
                { path: '/history', label: 'History', icon: '📋' },
                ...commonItems
            ],
            operator: [
                { path: '/operator', label: 'Dashboard', icon: '🏠' },
                ...commonItems
            ],
            owner: [
                { path: '/owner', label: 'Dashboard', icon: '🏠' },
                ...commonItems
            ],
            admin: [
                { path: '/admin', label: 'Dashboard', icon: '🏠' },
                ...commonItems
            ]
        };

        return roleSpecificItems[userProfile?.role] || commonItems;
    }, [userProfile?.role]);

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div className="navbar-brand">
                    <h1>🚗 {title || 'CNG Station'}</h1>
                </div>

                {user && (
                    <div className="navbar-user">
                        <button
                            className="menu-toggle"
                            onClick={() => setMenuOpen(!menuOpen)}
                            aria-label="Toggle menu"
                        >
                            ☰
                        </button>

                        <div className={`navbar-menu ${menuOpen ? 'open' : ''}`}>
                            <div className="menu-header">
                                <div className="user-info-menu">
                                    <div className="user-avatar">
                                        {userProfile?.name?.charAt(0).toUpperCase() || '👤'}
                                    </div>
                                    <div className="user-details">
                                        <span className="user-name">{userProfile?.name || 'User'}</span>
                                        <span className="user-phone">{user.phoneNumber}</span>
                                        {userProfile?.role && (
                                            <span className="user-role-badge">{userProfile.role}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="menu-items">
                                {menuItems.map(item => (
                                    <button
                                        key={item.path}
                                        onClick={() => handleNavigate(item.path)}
                                        className={`menu-item ${isActive(item.path) ? 'active' : ''}`}
                                    >
                                        <span className="menu-icon">{item.icon}</span>
                                        <span className="menu-label">{item.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="menu-footer">
                                <button onClick={handleSignOut} className="btn-logout-menu">
                                    🚪 Logout
                                </button>
                            </div>
                        </div>

                        {menuOpen && (
                            <div className="menu-overlay" onClick={() => setMenuOpen(false)}></div>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
