// Login page with Phone OTP and Signup
import { useState, useEffect } from 'react';
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

    // Redirect if already logged in - only after loading completes
    useEffect(() => {
        if (!loading && user && userRole) {
            navigate('/');
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

            if (!querySnapshot.empty) {
                // User exists (created by admin or previously)
                const existingUser = querySnapshot.docs[0].data();

                // Update the userId to match Firebase Auth UID
                const userDocRef = querySnapshot.docs[0].ref;
                const { updateDoc } = await import('firebase/firestore');
                await updateDoc(userDocRef, {
                    userId: firebaseUser.uid
                });

                setUserProfile(existingUser);
                setUserRole(existingUser.role);
                setFormLoading(false);
                navigate('/');
            } else {
                // Check by UID (for backward compatibility)
                const userDoc = await getDocument(COLLECTIONS.USERS, firebaseUser.uid);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUserProfile(userData);
                    setUserRole(userData.role);
                    setFormLoading(false);
                    navigate('/');
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
            navigate('/');
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
            // Auto-add +91 if phone number doesn't start with +
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
            <div className="login-card card">
                <div className="login-header">
                    <h1>🚗 CNG Station</h1>
                    <p>Smart Queue Management</p>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {step === 'phone' ? (
                    <form onSubmit={handleSendOTP} className="login-form">
                        <div className="form-group">
                            <label htmlFor="phone">Phone Number</label>
                            <input
                                type="tel"
                                id="phone"
                                className="input"
                                placeholder="9876543210"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <small className="form-hint">
                                Enter 10-digit mobile number (country code +91 will be added automatically)
                            </small>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={loading}
                        >
                            {loading ? 'Sending...' : 'Send OTP'}
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
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                maxLength={6}
                                required
                                disabled={loading}
                                autoFocus
                            />
                            <small className="form-hint">
                                OTP sent to {phoneNumber}
                            </small>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={loading || otp.length !== 6}
                        >
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn-link"
                                onClick={handleResendOTP}
                                disabled={loading}
                            >
                                Resend OTP
                            </button>
                            <button
                                type="button"
                                className="btn-link"
                                onClick={() => {
                                    setStep('phone');
                                    setOtp('');
                                    setError('');
                                }}
                                disabled={loading}
                            >
                                Change Number
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleSignup} className="login-form">
                        <h3 style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--text-primary)' }}>
                            Complete Your Profile
                        </h3>

                        <div className="form-group">
                            <label htmlFor="name">Your Name *</label>
                            <input
                                type="text"
                                id="name"
                                className="input"
                                placeholder="John Doe"
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
                            />
                            <small className="form-hint">
                                Enter your vehicle registration number
                            </small>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={loading || !signupData.name || !signupData.vehicleNumber}
                        >
                            {loading ? 'Creating Account...' : 'Complete Signup'}
                        </button>
                    </form>
                )}

                {/* reCAPTCHA container - required for phone authentication */}
                <div id="recaptcha-container"></div>
            </div>
        </div>
    );
};

export default Login;
