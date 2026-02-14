// Authentication helper functions
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from './config';

/**
 * Initialize reCAPTCHA verifier for phone authentication
 * @param {string} containerId - ID of the container element for reCAPTCHA
 * @returns {RecaptchaVerifier}
 */
export const initRecaptcha = (containerId = 'recaptcha-container') => {
    // Clear existing verifier if present
    if (window.recaptchaVerifier) {
        try {
            window.recaptchaVerifier.clear();
        } catch (e) {
            console.log('Error clearing recaptcha:', e);
        }
        window.recaptchaVerifier = null;
    }

    // Create new RecaptchaVerifier with correct Firebase v9+ syntax
    // Use getAuth() to ensure we have the auth instance
    const authInstance = getAuth();

    window.recaptchaVerifier = new RecaptchaVerifier(authInstance, containerId, {
        size: 'invisible',
        callback: (response) => {
            // reCAPTCHA solved, allow signInWithPhoneNumber
            console.log('reCAPTCHA verified successfully');
        },
        'expired-callback': () => {
            // Response expired, ask user to solve reCAPTCHA again
            console.log('reCAPTCHA expired');
            window.recaptchaVerifier = null;
        }
    });

    return window.recaptchaVerifier;
};

/**
 * Send OTP to phone number
 * @param {string} phoneNumber - Phone number with country code (e.g., +919876543210)
 * @returns {Promise<ConfirmationResult>}
 */
export const sendOTP = async (phoneNumber) => {
    try {
        const appVerifier = initRecaptcha();

        // Render the reCAPTCHA widget
        await appVerifier.render();

        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        return confirmationResult;
    } catch (error) {
        console.error('Error sending OTP:', error);
        // Clear the verifier on error so it can be recreated
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier = null;
        }
        throw error;
    }
};

/**
 * Verify OTP code
 * @param {ConfirmationResult} confirmationResult - Result from sendOTP
 * @param {string} code - 6-digit OTP code
 * @returns {Promise<UserCredential>}
 */
export const verifyOTP = async (confirmationResult, code) => {
    try {
        const result = await confirmationResult.confirm(code);
        return result;
    } catch (error) {
        console.error('Error verifying OTP:', error);
        throw error;
    }
};

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
};

/**
 * Get current user
 * @returns {User | null}
 */
export const getCurrentUser = () => {
    return auth.currentUser;
};
