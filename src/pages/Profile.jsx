// Profile Page — Role-Aware
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    doc, updateDoc, deleteDoc, collection,
    query, where, getDocs, writeBatch, addDoc, serverTimestamp
} from 'firebase/firestore';
import { deleteUser, signOut } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import { COLLECTIONS } from '../firebase/firestore';
import { sendOTP, verifyOTP } from '../firebase/auth';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/shared/Navbar';
import Icon from '../components/shared/Icon';
import './Profile.css';

const Profile = () => {
    const { user, userProfile, setUserProfile } = useAuth();
    const navigate = useNavigate();
    const role = userProfile?.role || 'customer';

    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: userProfile?.name || '',
    });

    // Vehicle state — customer only
    const [newVehicle, setNewVehicle] = useState('');
    const [vehicleLoading, setVehicleLoading] = useState(false);

    // Account deletion state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteStep, setDeleteStep] = useState('confirm'); // confirm | sending | otp | deleting | done
    const [deleteError, setDeleteError] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [confirmResult, setConfirmResult] = useState(null);

    /* ── Save profile name ── */
    const handleSave = async () => {
        setLoading(true);
        try {
            const userRef = doc(db, COLLECTIONS.USERS, user.uid);
            await updateDoc(userRef, { name: formData.name });
            setUserProfile({ ...userProfile, name: formData.name });
            setEditing(false);
        } catch (err) {
            console.error('Error updating profile:', err);
            alert('Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    /* ── Add vehicle (customer only) ── */
    const handleAddVehicle = async () => {
        if (!newVehicle.trim()) return;
        setVehicleLoading(true);
        try {
            const clean = newVehicle.toUpperCase().replace(/\s/g, '');
            const updated = [...(userProfile.vehicles || []), clean];
            await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { vehicles: updated });
            setUserProfile({ ...userProfile, vehicles: updated });
            setNewVehicle('');
        } catch (err) {
            console.error('Error adding vehicle:', err);
            alert('Failed to add vehicle');
        } finally {
            setVehicleLoading(false);
        }
    };

    /* ── Remove vehicle (customer only) ── */
    const handleRemoveVehicle = async (vehicle) => {
        if (!confirm(`Remove ${vehicle}?`)) return;
        setVehicleLoading(true);
        try {
            const updated = userProfile.vehicles.filter(v => v !== vehicle);
            const newDefault = userProfile.defaultVehicle === vehicle
                ? (updated[0] || null)
                : userProfile.defaultVehicle;
            await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                vehicles: updated,
                defaultVehicle: newDefault
            });
            setUserProfile({ ...userProfile, vehicles: updated, defaultVehicle: newDefault });
        } catch (err) {
            console.error('Error removing vehicle:', err);
            alert('Failed to remove vehicle');
        } finally {
            setVehicleLoading(false);
        }
    };

    /* ── Account Deletion ── */

    // Step 1: Send OTP to the user's registered phone for re-auth
    const handleRequestDelete = async () => {
        setDeleteError('');
        setDeleteStep('sending');   // show a spinner while OTP is being sent

        try {
            // Use the same sendOTP helper as login — handles fresh reCAPTCHA automatically
            // user.phoneNumber is the Firebase Auth verified phone (e.g. "+919876543210")
            const phone = user.phoneNumber || userProfile?.phoneNumber;
            if (!phone) {
                setDeleteError('Phone number not found. Please contact support.');
                setDeleteStep('confirm');
                return;
            }

            const result = await sendOTP(phone);
            setConfirmResult(result);
            setDeleteStep('otp');   // OTP sent — show input
        } catch (err) {
            console.error('Re-auth OTP error:', err);
            setDeleteError(
                err.code === 'auth/too-many-requests'
                    ? 'Too many attempts. Please wait a few minutes and try again.'
                    : 'Failed to send OTP. Please try again.'
            );
            setDeleteStep('confirm');
        }
    };

    // Step 2: Verify OTP → wipe all user data → delete Auth account
    const handleConfirmDelete = async () => {
        if (!otpCode || otpCode.length < 6) {
            setDeleteError('Enter the 6-digit OTP sent to your phone.');
            return;
        }
        setDeleteStep('deleting');
        setDeleteError('');

        try {
            // 1. Verify OTP (re-authenticates the Firebase Auth session)
            await verifyOTP(confirmResult, otpCode);

            const uid = user.uid;
            const batch = writeBatch(db);

            // 2. Cancel all active bookings
            const activeBookingsSnap = await getDocs(
                query(
                    collection(db, COLLECTIONS.BOOKINGS),
                    where('customerId', '==', uid),
                    where('status', 'in', ['waiting', 'eligible', 'checked_in'])
                )
            );
            activeBookingsSnap.forEach(bookingDoc => {
                batch.update(bookingDoc.ref, {
                    status: 'cancelled',
                    updatedAt: serverTimestamp()
                });
            });

            // 3. Delete all notifications for this user (subcollection)
            try {
                const notifSnap = await getDocs(
                    collection(db, 'notifications', uid, 'items')
                );
                notifSnap.forEach(n => batch.delete(n.ref));
            } catch (_) {
                // Notifications are non-critical — continue even if cleanup fails
            }

            // 4. Delete user Firestore document
            batch.delete(doc(db, COLLECTIONS.USERS, uid));

            // Commit all Firestore changes atomically
            await batch.commit();

            // 5. Write audit log (best-effort — don't block deletion if this fails)
            try {
                await addDoc(collection(db, COLLECTIONS.QUEUE_LOGS), {
                    action: 'account_deleted',
                    performedBy: uid,
                    performedByRole: role,
                    timestamp: serverTimestamp(),
                    metadata: {
                        phone: user.phoneNumber || userProfile?.phoneNumber,
                        name: userProfile?.name,
                        cancelledBookings: activeBookingsSnap.size,
                    }
                });
            } catch (_) { /* audit log failure must never block account deletion */ }

            // 6. Delete Firebase Auth account (must be after Firestore writes
            //    because the user doc read in rules requires auth.uid to exist)
            await deleteUser(auth.currentUser);

            // 7. Sign out any residual session and redirect
            try { await signOut(auth); } catch (_) { }
            navigate('/');

        } catch (err) {
            console.error('Delete account error:', err);
            let msg = 'Deletion failed. Please try again or contact support@smartcng.in';
            if (err.code === 'auth/invalid-verification-code') {
                msg = 'Invalid OTP. Please check and try again.';
            } else if (err.code === 'auth/code-expired') {
                msg = 'OTP expired. Please go back and request a new one.';
            } else if (err.code === 'auth/requires-recent-login') {
                msg = 'Session expired. Please log out and log in again, then retry.';
            }
            setDeleteError(msg);
            setDeleteStep('otp');
        }
    };

    /* ── Role badge colors ── */
    const roleBadgeClass = {
        customer: 'role-badge--customer',
        owner: 'role-badge--owner',
        operator: 'role-badge--operator',
        admin: 'role-badge--admin',
    }[role] || '';

    const roleLabel = {
        customer: 'Customer',
        owner: 'Station Owner',
        operator: 'Operator',
        admin: 'Administrator',
    }[role] || role;

    return (
        <div className="profile-page anim-page-load">
            <Navbar title="My Profile" />

            <div className="profile-content">
                <div className="profile-card">

                    {/* ── Avatar + name + role ── */}
                    <div className="profile-header">
                        <div className="profile-avatar">
                            {userProfile?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="profile-identity">
                            <h2>{userProfile?.name || 'User'}</h2>
                            <p className="profile-phone">{userProfile?.phoneNumber}</p>
                            <span className={`role-badge ${roleBadgeClass}`}>
                                <Icon name="user" size={12} />
                                {roleLabel}
                            </span>
                        </div>
                    </div>

                    {/* ── Personal Information ── */}
                    <div className="profile-section">
                        <div className="section-header">
                            <h3>Personal Information</h3>
                            {!editing ? (
                                <button
                                    type="button"
                                    onClick={() => setEditing(true)}
                                    className="edit-btn"
                                >
                                    <Icon name="settings" size={14} /> Edit
                                </button>
                            ) : (
                                <div className="edit-actions">
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        className="save-btn"
                                        disabled={loading}
                                    >
                                        {loading ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditing(false)}
                                        className="cancel-btn"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        {editing ? (
                            <div className="form-group">
                                <label htmlFor="profile-name">Name</label>
                                <input
                                    id="profile-name"
                                    type="text"
                                    className="profile-input"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Your full name"
                                />
                            </div>
                        ) : (
                            <div className="info-grid">
                                <div className="info-row">
                                    <span className="info-label">
                                        <Icon name="user" size={14} color="#9ca3af" /> Name
                                    </span>
                                    <span className="info-value">{userProfile?.name || '—'}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">
                                        <Icon name="phone" size={14} color="#9ca3af" /> Phone
                                    </span>
                                    <span className="info-value">{userProfile?.phoneNumber || '—'}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">
                                        <Icon name="settings" size={14} color="#9ca3af" /> Role
                                    </span>
                                    <span className="info-value">{roleLabel}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ================================================================
                        CUSTOMER ONLY — Vehicle management
                        ================================================================ */}
                    {role === 'customer' && (
                        <div className="profile-section">
                            <h3>My Vehicles</h3>

                            <div className="vehicles-list">
                                {userProfile?.vehicles?.length > 0 ? (
                                    userProfile.vehicles.map(vehicle => (
                                        <div key={vehicle} className="vehicle-item">
                                            <Icon name="car" size={16} color="#0E7C5B" />
                                            <span className="vehicle-num">{vehicle}</span>
                                            {vehicle === userProfile.defaultVehicle && (
                                                <span className="default-badge">Default</span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveVehicle(vehicle)}
                                                className="remove-vehicle-btn"
                                                disabled={vehicleLoading}
                                                title="Remove vehicle"
                                            >
                                                <Icon name="x" size={13} color="#9ca3af" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="no-vehicles">No vehicles added yet</p>
                                )}
                            </div>

                            <div className="add-vehicle-row">
                                <input
                                    type="text"
                                    className="profile-input"
                                    placeholder="MH12AB1234"
                                    value={newVehicle}
                                    onChange={e => setNewVehicle(e.target.value.toUpperCase())}
                                    maxLength={12}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddVehicle}
                                    className="add-vehicle-btn"
                                    disabled={vehicleLoading || !newVehicle.trim()}
                                >
                                    <Icon name="plus" size={15} color="#fff" /> Add
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ================================================================
                        CUSTOMER ONLY — Account stats
                        ================================================================ */}
                    {role === 'customer' && (
                        <div className="profile-section">
                            <h3>Account Stats</h3>
                            <div className="stats-row">
                                <div className="stat-pill">
                                    <span className="stat-pill-label">No-shows</span>
                                    <span className="stat-pill-value">{userProfile?.noShowCount || 0}</span>
                                </div>
                                <div className="stat-pill">
                                    <span className="stat-pill-label">Status</span>
                                    <span className={`stat-pill-value ${userProfile?.isBanned ? 'text-danger' : 'text-success'}`}>
                                        {userProfile?.isBanned ? 'Restricted' : 'Active'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ================================================================
                        OWNER ONLY — Station assignment info
                        ================================================================ */}
                    {role === 'owner' && (
                        <div className="profile-section">
                            <h3>Station Assignment</h3>
                            <div className="info-grid">
                                <div className="info-row">
                                    <span className="info-label">
                                        <Icon name="station" size={14} color="#9ca3af" /> Station ID
                                    </span>
                                    <span className="info-value mono">{userProfile?.stationId || '—'}</span>
                                </div>
                            </div>
                            <p className="section-note">
                                To change station assignment, contact the system administrator.
                            </p>
                        </div>
                    )}

                    {/* ================================================================
                        OPERATOR ONLY — Assigned station info
                        ================================================================ */}
                    {role === 'operator' && (
                        <div className="profile-section">
                            <h3>Assigned Station</h3>
                            <div className="info-grid">
                                <div className="info-row">
                                    <span className="info-label">
                                        <Icon name="station" size={14} color="#9ca3af" /> Station ID
                                    </span>
                                    <span className="info-value mono">{userProfile?.stationId || '—'}</span>
                                </div>
                            </div>
                            <p className="section-note">
                                Contact your station owner to change assignment.
                            </p>
                        </div>
                    )}

                    {/* ================================================================
                        ADMIN — System info
                        ================================================================ */}
                    {role === 'admin' && (
                        <div className="profile-section">
                            <h3>Administrator Access</h3>
                            <div className="info-row">
                                <span className="info-label">
                                    <Icon name="settings" size={14} color="#9ca3af" /> Access Level
                                </span>
                                <span className="info-value">Full System Access</span>
                            </div>
                        </div>
                    )}

                </div>

                {/* ================================================================
                        DANGER ZONE — Account Deletion & Privacy
                        ================================================================ */}
                <div className="profile-section danger-zone">
                    <h3>⚠️ Danger Zone</h3>

                    <div className="danger-zone-links">
                        <Link to="/privacy-policy" className="privacy-link" target="_blank">
                            🔒 Privacy Policy &amp; Data Usage
                        </Link>
                    </div>

                    {!showDeleteConfirm ? (
                        <button
                            type="button"
                            className="delete-account-btn"
                            onClick={() => { setShowDeleteConfirm(true); setDeleteStep('confirm'); }}
                        >
                            <Icon name="trash" size={15} color="#dc2626" /> Delete My Account
                        </button>
                    ) : (
                        <div className="delete-confirm-box">
                            {deleteStep === 'confirm' && (
                                <>
                                    <p className="delete-warning">
                                        ⚠️ This is <strong>permanent and irreversible</strong>. Your account,
                                        vehicles, bookings, and notifications will be permanently deleted.
                                    </p>
                                    <div className="delete-actions">
                                        <button
                                            type="button"
                                            className="delete-proceed-btn"
                                            onClick={handleRequestDelete}
                                        >
                                            Yes, Send OTP to Confirm
                                        </button>
                                        <button
                                            type="button"
                                            className="delete-cancel-btn"
                                            onClick={() => setShowDeleteConfirm(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Sending OTP spinner */}
                            {deleteStep === 'sending' && (
                                <p className="delete-warning">📲 Sending OTP to your phone… please wait.</p>
                            )}

                            {deleteStep === 'otp' && (
                                <>
                                    <p className="delete-warning">
                                        Enter the 6-digit OTP sent to <strong>{user?.phoneNumber || userProfile?.phoneNumber}</strong>:
                                    </p>
                                    <div className="otp-row">
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="6-digit OTP"
                                            value={otpCode}
                                            onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                            className="profile-input otp-input"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            className="delete-proceed-btn"
                                            onClick={handleConfirmDelete}
                                            disabled={otpCode.length < 6}
                                        >
                                            Confirm Delete
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        className="delete-cancel-btn"
                                        onClick={() => { setShowDeleteConfirm(false); setOtpCode(''); }}
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}

                            {/* Deleting in progress */}
                            {deleteStep === 'deleting' && (
                                <p className="delete-warning">🗑️ Permanently deleting your account… please wait.</p>
                            )}

                            {deleteError && (
                                <p className="delete-error">{deleteError}</p>
                            )}
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
};

export default Profile;
