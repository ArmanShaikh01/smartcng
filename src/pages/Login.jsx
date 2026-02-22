// Login page with Phone OTP and Signup
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOTP, verifyOTP } from '../firebase/auth';
import { getDocument, COLLECTIONS } from '../firebase/firestore';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import './Login.css';

const Login = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('phone'); // 'phone', 'otp', or 'signup'
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState('');
    const [signupData, setSignupData] = useState({
        name: '',
        vehicleNumber: ''
    });

    const { user, userRole, loading, setUserProfile, setUserRole } = useAuth();
    const navigate = useNavigate();

    // ── Role-aware redirect helper ──────────────────────────────
    const navigateByRole = (role) => {
        switch (role) {
            case 'admin':    return navigate('/admin',    { replace: true });
            case 'owner':    return navigate('/owner',    { replace: true });
            case 'operator': return navigate('/operator', { replace: true });
            default:         return navigate('/customer', { replace: true });
        }
    };

    // Redirect if already logged in (once, after auth loads)
    const didRedirect = useRef(false);
    useEffect(() => {
        if (!loading && user && userRole && !didRedirect.current) {
            didRedirect.current = true;
            navigateByRole(userRole);
        }
    }, [loading, user, userRole]); // eslint-disable-line react-hooks/exhaustive-deps


    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setFormLoading(true);

        try {
            // Auto-add +91 if phone number doesn't start with +
            let formattedPhone = phoneNumber.trim();
            if (!formattedPhone.startsWith('+')) {
                // Remove any leading zeros or spaces
                formattedPhone = formattedPhone.replace(/^0+/, '');
                // Add +91 for Indian numbers
                formattedPhone = '+91' + formattedPhone;
            }

            // Validate phone number length (should be 10 digits after +91)
            const digitsOnly = formattedPhone.replace(/\D/g, '');
            if (digitsOnly.length < 10) {
                setError('Please enter a valid 10-digit phone number');
                setFormLoading(false);
                return;
            }

            const result = await sendOTP(formattedPhone);
            setConfirmationResult(result);
            setStep('otp');
            setFormLoading(false);
        } catch (err) {
            console.error('Error sending OTP:', err);
            setError(err.message || 'Failed to send OTP. Please try again.');
            setFormLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        setFormLoading(true);

        try {
            const userCredential = await verifyOTP(confirmationResult, otp);
            const firebaseUser = userCredential.user;

            // First, try to find user by phone number (for admin-created users)
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const { db } = await import('../firebase/config');

            const usersRef = collection(db, COLLECTIONS.USERS);
            const q = query(usersRef, where('phoneNumber', '==', firebaseUser.phoneNumber));
            const querySnapshot = await getDocs(q);

            let existingUserDoc = querySnapshot.empty ? null : querySnapshot.docs[0];

            // Backward-compat: try matching last 10 digits for old records saved without +91 or with spaces
            if (!existingUserDoc) {
                const last10 = firebaseUser.phoneNumber.replace(/\D/g, '').slice(-10);
                const allUsersSnap = await getDocs(usersRef);
                const match = allUsersSnap.docs.find(d => {
                    const savedPhone = (d.data().phoneNumber || '').replace(/\D/g, '');
                    return savedPhone.endsWith(last10);
                });
                if (match) existingUserDoc = match;
            }

            if (existingUserDoc) {
                // User exists (created by admin/owner or previously)
                const existingUser = existingUserDoc.data();

                // Update the userId to match Firebase Auth UID & normalize phone
                const { updateDoc } = await import('firebase/firestore');
                await updateDoc(existingUserDoc.ref, {
                    userId: firebaseUser.uid,
                    phoneNumber: firebaseUser.phoneNumber // normalize stored number
                });

                setUserProfile(existingUser);
                setUserRole(existingUser.role);
                setFormLoading(false);
                navigateByRole(existingUser.role);
            } else {
                // Check by UID (for backward compatibility)
                const userDoc = await getDocument(COLLECTIONS.USERS, firebaseUser.uid);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUserProfile(userData);
                    setUserRole(userData.role);
                    setFormLoading(false);
                    navigateByRole(userData.role);
                } else {
                    // New user - show signup form
                    setFormLoading(false);
                    setStep('signup');
                }
            }
        } catch (err) {
            console.error('Error verifying OTP:', err);
            setError('Invalid OTP. Please try again.');
            setFormLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        setFormLoading(true);

        try {
            const firebaseUser = user || (await verifyOTP(confirmationResult, otp)).user;

            const newUserData = {
                userId: firebaseUser.uid,
                phoneNumber: firebaseUser.phoneNumber,
                name: signupData.name,
                role: 'customer',
                stationId: null,
                defaultVehicle: signupData.vehicleNumber.toUpperCase(),
                vehicles: [signupData.vehicleNumber.toUpperCase()],
                noShowCount: 0,
                isBanned: false,
                bannedUntil: null,
                createdAt: new Date()
            };

            // Use setDoc with Firebase UID as document ID to prevent duplicates
            await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), newUserData);

            setUserProfile(newUserData);
            setUserRole('customer');
            setFormLoading(false);
            navigateByRole('customer');
        } catch (err) {
            console.error('Error creating user:', err);
            setError('Failed to create account. Please try again.');
            setFormLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setOtp('');
        setError('');
        setFormLoading(true);

        try {
            let formattedPhone = phoneNumber.trim();
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = formattedPhone.replace(/^0+/, '');
                formattedPhone = '+91' + formattedPhone;
            }

            const result = await sendOTP(formattedPhone);
            setConfirmationResult(result);
            setFormLoading(false);
        } catch (err) {
            console.error('Error resending OTP:', err);
            setError('Failed to resend OTP. Please try again.');
            setFormLoading(false);
        }
    };

    return (
        <div className="login-container">

            {/* ── Left Branding Panel (desktop only) ── */}
            <div className="login-branding">
                <div className="login-brand-logo">
                    <img src="/smartcng-logo.jpeg" alt="Smart CNG" style={{ height: 72, objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; }} />
                </div>
                <h1 className="login-brand-title">
                    Smart <span>CNG</span><br />Station
                </h1>
                <p className="login-brand-subtitle">
                    Skip the wait. Book your slot digitally and arrive when it&apos;s your turn.
                </p>
                <div className="login-brand-features">
                    <div className="brand-feature">
                        <div className="brand-feature-icon">📱</div>
                        Phone OTP — no password needed
                    </div>
                    <div className="brand-feature">
                        <div className="brand-feature-icon">🔴</div>
                        Live queue updates in real-time
                    </div>
                    <div className="brand-feature">
                        <div className="brand-feature-icon">🗺️</div>
                        Find nearest CNG stations
                    </div>
                    <div className="brand-feature">
                        <div className="brand-feature-icon">✅</div>
                        Check-in when you arrive
                    </div>
                </div>
            </div>

            {/* ── Right Form Panel ── */}
            <div className="login-form-panel">
                <div className="login-card">

                    {/* Header */}
                    <div className="login-header">
                        <img src="/smartcng-logo.jpeg" alt="Smart CNG" className="login-header-logo" style={{ height: 48, objectFit: 'contain', marginBottom: 4 }} onError={(e) => { e.target.style.display='none'; }} />
                        <h1>CNG Station</h1>
                        <p>Smart Queue Management</p>
                    </div>

                    {/* Step indicator */}
                    <div className="step-indicator">
                        <div className={`step-dot-sm ${step === 'phone' ? 'active' : 'done'}`} />
                        <div className={`step-dot-sm ${step === 'otp' ? 'active' : step === 'signup' ? 'done' : ''}`} />
                        <div className={`step-dot-sm ${step === 'signup' ? 'active' : ''}`} />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Step: Phone */}
                    {step === 'phone' ? (
                        <form onSubmit={handleSendOTP} className="login-form">
                            <div className="form-group">
                                <label htmlFor="phone">Phone Number</label>
                                <div className="phone-input-wrapper">
                                    <span className="phone-prefix">+91</span>
                                    <input
                                        type="tel"
                                        id="phone"
                                        className="input"
                                        placeholder="9876543210"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        required
                                        disabled={formLoading}
                                    />
                                </div>
                                <small className="form-hint">
                                    Enter your 10-digit mobile number
                                </small>
                            </div>

                            <button
                                type="submit"
                                className={`btn btn-primary btn-block ${formLoading ? 'btn-loading' : ''}`}
                                disabled={formLoading}
                            >
                                {formLoading ? 'Sending OTP…' : 'Send OTP →'}
                            </button>
                        </form>

                    ) : step === 'otp' ? (
                        <form onSubmit={handleVerifyOTP} className="login-form">
                            <div className="form-group">
                                <label htmlFor="otp">Enter OTP</label>
                                <input
                                    type="text"
                                    id="otp"
                                    className="input"
                                    placeholder="• • • • • •"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    maxLength={6}
                                    required
                                    disabled={loading}
                                    autoFocus
                                    style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 'var(--text-xl)' }}
                                />
                                <small className="form-hint">
                                    OTP sent to +91 {phoneNumber}
                                </small>
                            </div>

                            <button
                                type="submit"
                                className={`btn btn-primary btn-block ${loading ? 'btn-loading' : ''}`}
                                disabled={loading || otp.length !== 6}
                            >
                                {loading ? 'Verifying…' : 'Verify OTP →'}
                            </button>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn-link"
                                    onClick={handleResendOTP}
                                    disabled={loading}
                                >
                                    🔄 Resend OTP
                                </button>
                                <button
                                    type="button"
                                    className="btn-link"
                                    onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                                    disabled={loading}
                                >
                                    ← Change Number
                                </button>
                            </div>
                        </form>

                    ) : (
                        <form onSubmit={handleSignup} className="login-form">
                            <p className="signup-subtitle">
                                👋 Welcome! Complete your profile to get started.
                            </p>

                            <div className="form-group">
                                <label htmlFor="name">Your Name *</label>
                                <input
                                    type="text"
                                    id="name"
                                    className="input"
                                    placeholder="e.g. Arman Shaikh"
                                    value={signupData.name}
                                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                                    required
                                    disabled={loading}
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="vehicle">Vehicle Number *</label>
                                <input
                                    type="text"
                                    id="vehicle"
                                    className="input"
                                    placeholder="MH12AB1234"
                                    value={signupData.vehicleNumber}
                                    onChange={(e) => setSignupData({ ...signupData, vehicleNumber: e.target.value.toUpperCase() })}
                                    required
                                    disabled={loading}
                                    style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                                />
                                <small className="form-hint">
                                    Enter your vehicle registration number
                                </small>
                            </div>

                            <button
                                type="submit"
                                className={`btn btn-primary btn-block ${loading ? 'btn-loading' : ''}`}
                                disabled={loading || !signupData.name || !signupData.vehicleNumber}
                            >
                                {loading ? 'Creating Account…' : '🚀 Complete Signup'}
                            </button>
                        </form>
                    )}

                    {/* reCAPTCHA container */}
                    <div id="recaptcha-container"></div>
                </div>
            </div>
        </div>
    );
};

export default Login;
