// Admin Home — Top Navbar layout with mobile hamburger drawer
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../firebase/auth';
import { useNavigate } from 'react-router-dom';
import StationManagement from '../components/admin/StationManagement';
import SystemLogs from '../components/admin/SystemLogs';
import UserManagement from '../components/admin/UserManagement';
import Icon from '../components/shared/Icon';
import './AdminHome.css';

const NAV = [
    { id: 'stations', iconName: 'station', label: 'Stations'       },
    { id: 'users',    iconName: 'users',   label: 'User Management' },
    { id: 'logs',     iconName: 'list',    label: 'System Logs'     },
];

const AdminHome = () => {
    const [activeTab, setActiveTab]       = useState('stations');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [drawerOpen, setDrawerOpen]     = useState(false);
    const { user, userProfile } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        try { await signOut(); navigate('/login'); }
        catch (err) { console.error(err); }
    };

    const handleTabChange = (id) => {
        setActiveTab(id);
        setDrawerOpen(false);      // close drawer after selection
    };

    const avatarLetter = userProfile?.name?.charAt(0).toUpperCase() || 'A';

    return (
        <div className="admin-home">

            {/* ══ TOP NAVBAR ══ */}
            <header className="admin-navbar">
                <div className="admin-navbar-inner">

                    {/* Brand / Logo */}
                    <div className="admin-brand">
                        <img
                            src="/smartcng-logo.jpeg"
                            alt="Smart CNG"
                            className="admin-brand-logo"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div className="admin-brand-text">
                            <span className="admin-brand-name">Smart CNG</span>
                            <span className="admin-brand-role">Admin Panel</span>
                        </div>
                    </div>

                    {/* Desktop Nav Tabs (hidden on mobile) */}
                    <nav className="admin-nav-tabs">
                        {NAV.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                className={`admin-nav-tab ${activeTab === item.id ? 'active' : ''}`}
                                onClick={() => handleTabChange(item.id)}
                            >
                            <span><Icon name={item.iconName} size={16} /></span>
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {/* Right side: user chip + hamburger */}
                    <div className="admin-navbar-right">

                        {/* User Chip (desktop) */}
                        <div className="admin-user-chip" onClick={() => setDropdownOpen(!dropdownOpen)}>
                            <div className="admin-avatar">{avatarLetter}</div>
                            <div className="admin-chip-info">
                                <span className="admin-chip-name">{userProfile?.name || 'Admin'}</span>
                                <span className="admin-chip-role">Admin</span>
                            </div>
                            <span className="admin-chip-caret">▾</span>

                            {dropdownOpen && (
                                <div className="admin-dropdown">
                                    <div className="admin-dropdown-user">
                                        <div className="admin-dropdown-avatar">{avatarLetter}</div>
                                        <div>
                                            <div className="admin-dropdown-name">{userProfile?.name || 'Admin'}</div>
                                            <div className="admin-dropdown-phone">{user?.phoneNumber}</div>
                                        </div>
                                    </div>
                                    <button className="admin-dropdown-logout" onClick={handleSignOut}>
                                        <Icon name="logOut" size={14} /> Logout
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Hamburger Button (mobile only) ── */}
                        <button
                            type="button"
                            className="admin-hamburger"
                            onClick={() => setDrawerOpen(!drawerOpen)}
                            aria-label="Toggle menu"
                        >
                            <span className={`hamburger-line ${drawerOpen ? 'open' : ''}`} />
                            <span className={`hamburger-line ${drawerOpen ? 'open' : ''}`} />
                            <span className={`hamburger-line ${drawerOpen ? 'open' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Mobile Drawer ── */}
            {drawerOpen && (
                <div className="admin-drawer-overlay" onClick={() => setDrawerOpen(false)} />
            )}
            <aside className={`admin-drawer ${drawerOpen ? 'open' : ''}`}>
                {/* Drawer brand */}
                <div className="admin-drawer-header">
                    <img
                        src="/smartcng-logo.jpeg"
                        alt="Smart CNG"
                        className="admin-drawer-logo"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div>
                        <div className="admin-drawer-title">Smart CNG</div>
                        <div className="admin-drawer-subtitle">Admin Panel</div>
                    </div>
                    <button className="admin-drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
                </div>

                {/* Drawer nav */}
                <nav className="admin-drawer-nav">
                    {NAV.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            className={`admin-drawer-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => handleTabChange(item.id)}
                        >
                            <span className="admin-drawer-icon"><Icon name={item.iconName} size={18} /></span>
                            <span className="admin-drawer-label">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Drawer footer: user + logout */}
                <div className="admin-drawer-footer">
                    <div className="admin-drawer-user">
                        <div className="admin-avatar">{avatarLetter}</div>
                        <div>
                            <div className="admin-chip-name">{userProfile?.name || 'Admin'}</div>
                            <div className="admin-dropdown-phone">{user?.phoneNumber}</div>
                        </div>
                    </div>
                    <button className="admin-drawer-logout" onClick={handleSignOut}>
                        <Icon name="logOut" size={16} /> Logout
                    </button>
                </div>
            </aside>

            {/* ══ CONTENT AREA ══ */}
            <main className="admin-main">
                <div className="admin-content">
                    <div className="admin-tab-content">
                        {activeTab === 'stations' && <StationManagement />}
                        {activeTab === 'users'    && <UserManagement />}
                        {activeTab === 'logs'     && <SystemLogs />}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminHome;
