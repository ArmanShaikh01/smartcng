// Authentication helper functions
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from './config';

/**
 * Initialize reCAPTCHA verifier for phone authentication.
 *
 * Root-cause fix for "reCAPTCHA has already been rendered in this element":
 *   grecaptcha tracks widgets by DOM node reference, NOT by id string.
 *   Clearing innerHTML leaves the old node alive in grecaptcha's internal map.
 *   Solution: completely replace the old node with a brand-new element so
 *   grecaptcha has zero prior knowledge of it.
 *
 * @param {string} containerId - ID of the container element
 * @returns {RecaptchaVerifier}
 */
export const initRecaptcha = (containerId = 'recaptcha-container') => {
    // 1. Destroy old verifier instance
    if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (_) { }
        window.recaptchaVerifier = null;
    }

    // 2. Replace the container DOM node entirely
    //    A fresh node has no grecaptcha history → no "already rendered" error
    const old = document.getElementById(containerId);
    if (old && old.parentNode) {
        const fresh = document.createElement('div');
        fresh.id = containerId;
        old.parentNode.replaceChild(fresh, old);
    }

    // 3. Create new RecaptchaVerifier on the clean node
    window.recaptchaVerifier = new RecaptchaVerifier(getAuth(), containerId, {
        size: 'invisible',
        callback: () => {
            console.log('reCAPTCHA verified');
        },
        'expired-callback': () => {
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
        await appVerifier.render();
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        return confirmationResult;
    } catch (error) {
        console.error('Error sending OTP:', error);
        window.recaptchaVerifier = null;
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
        return await confirmationResult.confirm(code);
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
export const getCurrentUser = () => auth.currentUser;
