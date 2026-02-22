// Authentication helper functions
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from './config';

// ─── reCAPTCHA container ──────────────────────────────────────────────────
// ONE container element lives on document.body, outside React's virtual DOM.
// The verifier is initialized ONCE (on Login mount) and reused across OTP
// sends. It is only force-recreated after an error to keep a clean slate.
// ─────────────────────────────────────────────────────────────────────────

const RCAP_ID = '__rcap_widget__';

function getFreshContainer() {
    const old = document.getElementById(RCAP_ID);
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = RCAP_ID;
    el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    document.body.appendChild(el);
    return el;
}

function createVerifier() {
    getFreshContainer();
    window.recaptchaVerifier = new RecaptchaVerifier(getAuth(), RCAP_ID, {
        size: 'invisible',
        callback: () => { /* reCAPTCHA solved automatically */ },
        'expired-callback': () => {
            // Token expired — clear so next sendOTP creates a fresh one
            window.recaptchaVerifier = null;
        }
    });
    return window.recaptchaVerifier;
}

/**
 * Call this ONCE when the Login component mounts.
 * Creates the invisible reCAPTCHA verifier and pre-renders it so it is
 * ready the moment the user clicks "Send OTP", eliminating the delay.
 */
export const initRecaptcha = async () => {
    try {
        // Avoid double-init if already set up
        if (window.recaptchaVerifier) return;
        const verifier = createVerifier();
        await verifier.render(); // contact Google servers early → faster OTP
    } catch (err) {
        // Non-fatal on init; sendOTP will retry
        window.recaptchaVerifier = null;
        console.warn('[reCAPTCHA] pre-init failed, will retry on send:', err.message);
    }
};

/**
 * Send OTP to phone number.
 * Reuses the already-initialized verifier. Only creates a new one if the
 * previous attempt errored out and cleared it.
 * @param {string} phoneNumber - e.g. "+919876543210"
 * @returns {Promise<ConfirmationResult>}
 */
export const sendOTP = async (phoneNumber) => {
    try {
        // Use existing verifier or create a fresh one (e.g., after a prior error)
        if (!window.recaptchaVerifier) {
            createVerifier();
        }

        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        return confirmationResult;
    } catch (error) {
        console.error('Error sending OTP:', error);
        // Destroy on failure so the next attempt gets a clean verifier
        if (window.recaptchaVerifier) {
            try { window.recaptchaVerifier.clear(); } catch (_) { }
            window.recaptchaVerifier = null;
        }
        const el = document.getElementById(RCAP_ID);
        if (el) el.remove();
        throw error;
    }
};

/**
 * Verify OTP code
 * @param {ConfirmationResult} confirmationResult
 * @param {string} code - 6-digit OTP
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

/** Sign out current user */
export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
};

/** Get current authenticated user */
export const getCurrentUser = () => auth.currentUser;
