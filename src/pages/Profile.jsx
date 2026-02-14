// User Profile Page - Edit profile and manage vehicles
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/shared/Navbar';
import './Profile.css';

const Profile = () => {
    const { user, userProfile, setUserProfile } = useAuth();
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: userProfile?.name || '',
        defaultVehicle: userProfile?.defaultVehicle || ''
    });
    const [newVehicle, setNewVehicle] = useState('');

    const handleSave = async () => {
        setLoading(true);
        try {
            const userRef = doc(db, COLLECTIONS.USERS, user.uid);
            await updateDoc(userRef, {
                name: formData.name,
                defaultVehicle: formData.defaultVehicle
            });

            setUserProfile({
                ...userProfile,
                name: formData.name,
                defaultVehicle: formData.defaultVehicle
            });

            setEditing(false);
            setLoading(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile');
            setLoading(false);
        }
    };

    const handleAddVehicle = async () => {
        if (!newVehicle) return;

        setLoading(true);
        try {
            const cleanVehicle = newVehicle.toUpperCase().replace(/\s/g, '');
            const updatedVehicles = [...(userProfile.vehicles || []), cleanVehicle];

            const userRef = doc(db, COLLECTIONS.USERS, user.uid);
            await updateDoc(userRef, {
                vehicles: updatedVehicles
            });

            setUserProfile({
                ...userProfile,
                vehicles: updatedVehicles
            });

            setNewVehicle('');
            setLoading(false);
        } catch (error) {
            console.error('Error adding vehicle:', error);
            alert('Failed to add vehicle');
            setLoading(false);
        }
    };

    const handleRemoveVehicle = async (vehicle) => {
        if (!confirm(`Remove ${vehicle}?`)) return;

        setLoading(true);
        try {
            const updatedVehicles = userProfile.vehicles.filter(v => v !== vehicle);
            const userRef = doc(db, COLLECTIONS.USERS, user.uid);

            await updateDoc(userRef, {
                vehicles: updatedVehicles,
                defaultVehicle: userProfile.defaultVehicle === vehicle ? updatedVehicles[0] || null : userProfile.defaultVehicle
            });

            setUserProfile({
                ...userProfile,
                vehicles: updatedVehicles,
                defaultVehicle: userProfile.defaultVehicle === vehicle ? updatedVehicles[0] || null : userProfile.defaultVehicle
            });

            setLoading(false);
        } catch (error) {
            console.error('Error removing vehicle:', error);
            alert('Failed to remove vehicle');
            setLoading(false);
        }
    };

    return (
        <div className="profile-page">
            <Navbar title="My Profile" />

            <div className="profile-content">
                <div className="profile-card card">
                    <div className="profile-header">
                        <div className="profile-avatar">
                            {userProfile?.name?.charAt(0).toUpperCase() || '👤'}
                        </div>
                        <div className="profile-info">
                            <h2>{userProfile?.name || 'User'}</h2>
                            <p>{userProfile?.phoneNumber}</p>
                            <span className="role-badge">{userProfile?.role}</span>
                        </div>
                    </div>

                    <div className="profile-section">
                        <div className="section-header">
                            <h3>Personal Information</h3>
                            {!editing ? (
                                <button onClick={() => setEditing(true)} className="btn btn-outline btn-sm">
                                    Edit
                                </button>
                            ) : (
                                <div className="edit-actions">
                                    <button onClick={handleSave} className="btn btn-primary btn-sm" disabled={loading}>
                                        {loading ? 'Saving...' : 'Save'}
                                    </button>
                                    <button onClick={() => setEditing(false)} className="btn btn-outline btn-sm">
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        {editing ? (
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        ) : (
                            <div className="info-row">
                                <span className="info-label">Name:</span>
                                <span className="info-value">{userProfile?.name}</span>
                            </div>
                        )}

                        <div className="info-row">
                            <span className="info-label">Phone:</span>
                            <span className="info-value">{userProfile?.phoneNumber}</span>
                        </div>

                        <div className="info-row">
                            <span className="info-label">Role:</span>
                            <span className="info-value">{userProfile?.role}</span>
                        </div>
                    </div>

                    <div className="profile-section">
                        <h3>My Vehicles</h3>

                        <div className="vehicles-list">
                            {userProfile?.vehicles?.map(vehicle => (
                                <div key={vehicle} className="vehicle-item">
                                    <span className="vehicle-number">{vehicle}</span>
                                    {vehicle === userProfile.defaultVehicle && (
                                        <span className="default-badge">Default</span>
                                    )}
                                    <button
                                        onClick={() => handleRemoveVehicle(vehicle)}
                                        className="btn-icon"
                                        disabled={loading}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="add-vehicle-form">
                            <input
                                type="text"
                                className="input"
                                placeholder="Add new vehicle (e.g., MH12AB1234)"
                                value={newVehicle}
                                onChange={(e) => setNewVehicle(e.target.value.toUpperCase())}
                            />
                            <button
                                onClick={handleAddVehicle}
                                className="btn btn-primary"
                                disabled={loading || !newVehicle}
                            >
                                Add Vehicle
                            </button>
                        </div>
                    </div>

                    {userProfile?.role === 'customer' && (
                        <div className="profile-section">
                            <h3>Account Stats</h3>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-label">No-shows</span>
                                    <span className="stat-value">{userProfile?.noShowCount || 0}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Status</span>
                                    <span className={`stat-value ${userProfile?.isBanned ? 'banned' : 'active'}`}>
                                        {userProfile?.isBanned ? 'Banned' : 'Active'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
