// Authentication helper functions
import {
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
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            size: 'invisible',
            callback: () => {
                // reCAPTCHA solved
            },
            'expired-callback': () => {
                // Response expired
                window.recaptchaVerifier = null;
            }
        });
    }
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
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        return confirmationResult;
    } catch (error) {
        console.error('Error sending OTP:', error);
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
