// User Management Component for Admin
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { toast } from '../../utils/toast';
import { confirm } from '../../utils/confirm';
import { validatePhone10, onlyDigits10 } from '../../utils/validators';
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
        // Real-time listener — auto-refreshes whenever roles or any user field changes
        const unsubscribe = onSnapshot(
            collection(db, COLLECTIONS.USERS),
            (snapshot) => {
                const usersData = snapshot.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(user => user.role !== 'customer');
                setUsers(usersData);
                setLoading(false);
            },
            (error) => {
                console.error('Error listening to users:', error);
                setLoading(false);
            }
        );
        fetchStations();
        return () => unsubscribe(); // cleanup on unmount
    }, []);

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

        // Validate phone number
        const phoneResult = validatePhone10(formData.phoneNumber);
        if (!phoneResult.valid) {
            toast.warning(phoneResult.error);
            setLoading(false);
            return;
        }

        try {
            // Create user document with auto-generated ID
            const newUser = {
                userId: `${formData.role}_${Date.now()}`,
                phoneNumber: phoneResult.normalized,
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

            toast.success(`${formData.role} created! They can login with: ${phoneResult.normalized}`);
            setShowForm(false);
            setFormData({ phoneNumber: '', name: '', role: 'operator', stationId: '' });
            fetchUsers();
        } catch (error) {
            console.error('Error creating user:', error);
            toast.error('Failed to create user');
            setLoading(false);
        }
    };

    const handleBlock = async (user) => {
        const isBlocked = user.isBanned === true;
        const action = isBlocked ? 'unblock' : 'block';
        const ok = await confirm(`${isBlocked ? 'Unblock' : 'Block'} "${user.name || user.phoneNumber}"?`, {
            title: isBlocked ? 'Unblock User' : 'Block User',
            confirmLabel: isBlocked ? 'Yes, Unblock' : 'Yes, Block',
            variant: isBlocked ? 'primary' : 'warning',
        });
        if (!ok) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.USERS, user.id), {
                isBanned: !isBlocked,
                bannedUntil: null,
                updatedAt: new Date()
            });
            // onSnapshot listener will auto-refresh the list
        } catch (error) {
            console.error(`Error trying to ${action} user:`, error);
            toast.error(`Failed to ${action} user: ` + error.message);
        }
    };

    const handleDelete = async (userId) => {
        const ok = await confirm('This user will be permanently deleted from the system.', {
            title: 'Delete User',
            confirmLabel: 'Yes, Delete',
            variant: 'danger',
        });
        if (!ok) return;

        try {
            await deleteDoc(doc(db, COLLECTIONS.USERS, userId));
            toast.success('User deleted successfully');
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user');
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
                            <div className="phone-input-wrapper">
                                <span className="phone-prefix">+91</span>
                                <input
                                    type="tel"
                                    className="input"
                                    placeholder="9876543210"
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber: onlyDigits10(e.target.value) })}
                                    required
                                    maxLength={10}
                                    inputMode="numeric"
                                />
                            </div>
                            <small>Enter 10-digit mobile number (without +91)</small>
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
                                    <tr
                                        key={user.id}
                                        className={user.isBanned ? 'um-row-blocked' : ''}
                                    >
                                        <td data-label="Name">
                                            {user.name}
                                            {user.isBanned && (
                                                <span className="um-banned-badge">Blocked</span>
                                            )}
                                        </td>
                                        <td data-label="Phone">{user.phoneNumber}</td>
                                        <td data-label="Role">
                                            <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td data-label="Station">{user.stationId || 'N/A'}</td>
                                        <td data-label="Action">
                                            <div className="um-action-btns">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleBlock(user); }}
                                                    className={user.isBanned ? 'btn-unblock' : 'btn-block'}
                                                >
                                                    {user.isBanned ? 'Unblock' : 'Block'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(user.id); }}
                                                    className="btn-delete"
                                                >
                                                    Delete
                                                </button>
                                            </div>
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
