// Admin Home - Main admin interface
import { useState } from 'react';
import Navbar from '../components/shared/Navbar';
import StationManagement from '../components/admin/StationManagement';
import SystemLogs from '../components/admin/SystemLogs';
import UserManagement from '../components/admin/UserManagement';
import './AdminHome.css';

const AdminHome = () => {
    const [activeTab, setActiveTab] = useState('stations'); // stations, users, logs

    return (
        <div className="admin-home">
            <Navbar title="Admin Dashboard" />

            <div className="admin-content">
                <div className="admin-header">
                    <h1>SaaS Admin Panel</h1>
                    <p>Manage stations, users, and monitor the entire system</p>
                </div>

                <div className="admin-tabs">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('stations');
                        }}
                        className={`tab-btn ${activeTab === 'stations' ? 'active' : ''}`}
                    >
                        🏢 Stations
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('users');
                        }}
                        className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    >
                        👥 Users
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('logs');
                        }}
                        className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                    >
                        📋 Logs
                    </button>
                </div>

                <div className="admin-tab-content" onClick={(e) => e.stopPropagation()}>
                    {activeTab === 'stations' && <StationManagement />}
                    {activeTab === 'users' && <UserManagement />}
                    {activeTab === 'logs' && <SystemLogs />}
                </div>
            </div>
        </div>
    );
};

export default AdminHome;
