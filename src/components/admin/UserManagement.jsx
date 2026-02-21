// User Management Component for Admin
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import './UserManagement.css';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        phoneNumber: '',
        name: '',
        role: 'operator',
        stationId: ''
    });

    useEffect(() => {
        fetchUsers();
        fetchStations();
    }, []);

    const fetchUsers = async () => {
        try {
            const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
            const usersData = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(user => user.role !== 'customer'); // Only show staff
            setUsers(usersData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching users:', error);
            setLoading(false);
        }
    };

    const fetchStations = async () => {
        try {
            const snapshot = await getDocs(collection(db, COLLECTIONS.STATIONS));
            const stationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStations(stationsData);
        } catch (error) {
            console.error('Error fetching stations:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Create user document with auto-generated ID
            const newUser = {
                userId: `${formData.role}_${Date.now()}`,
                phoneNumber: formData.phoneNumber,
                name: formData.name,
                role: formData.role,
                stationId: formData.role === 'admin' ? null : formData.stationId,
                vehicles: [],
                noShowCount: 0,
                isBanned: false,
                bannedUntil: null,
                createdAt: new Date()
            };

            await addDoc(collection(db, COLLECTIONS.USERS), newUser);

            alert(`${formData.role} created successfully! They can login with phone: ${formData.phoneNumber}`);
            setShowForm(false);
            setFormData({ phoneNumber: '', name: '', role: 'operator', stationId: '' });
            fetchUsers();
        } catch (error) {
            console.error('Error creating user:', error);
            alert('Failed to create user');
            setLoading(false);
        }
    };

    const handleDelete = async (userId) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
            alert('User deleted successfully');
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user');
        }
    };

    const getRoleBadgeClass = (role) => {
        const classes = {
            admin: 'role-admin',
            owner: 'role-owner',
            operator: 'role-operator'
        };
        return classes[role] || 'role-default';
    };

    return (
        <div className="user-management">
            <div className="um-header">
                <h2>User Management</h2>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowForm(!showForm);
                    }}
                    className="btn btn-primary"
                >
                    {showForm ? 'Cancel' : '+ Add User'}
                </button>
            </div>

            {showForm && (
                <div className="um-form card">
                    <h3>Create New User</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Phone Number *</label>
                            <input
                                type="tel"
                                className="input"
                                placeholder="+91 9876543210"
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                required
                            />
                            <small>Include country code (e.g., +91)</small>
                        </div>

                        <div className="form-group">
                            <label>Name *</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Role *</label>
                            <select
                                className="input"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                required
                            >
                                <option value="operator">Operator</option>
                                <option value="owner">Owner</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        {formData.role !== 'admin' && (
                            <div className="form-group">
                                <label>Assign Station *</label>
                                <select
                                    className="input"
                                    value={formData.stationId}
                                    onChange={(e) => setFormData({ ...formData, stationId: e.target.value })}
                                    required
                                >
                                    <option value="">Select Station</option>
                                    {stations.map(station => (
                                        <option key={station.id} value={station.stationId}>
                                            {station.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                            {loading ? 'Creating...' : 'Create User'}
                        </button>
                    </form>
                </div>
            )}

            <div className="um-list">
                {loading ? (
                    <div className="um-loading">Loading users...</div>
                ) : users.length === 0 ? (
                    <div className="um-empty">No users found</div>
                ) : (
                    <div className="users-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>Role</th>
                                    <th>Station</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.name}</td>
                                        <td>{user.phoneNumber}</td>
                                        <td>
                                            <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>{user.stationId || 'N/A'}</td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(user.id);
                                                }}
                                                className="btn-delete"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
