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
//
// Key design decision:
//   We create the RecaptchaVerifier on Login mount but do NOT call
//   render() / pre-fetch a token. Calling render() early generates a
//   short-lived reCAPTCHA token; if the user takes >30s to type their
//   number, that token is stale and Firebase creates a new session
//   internally — causing a session mismatch that Firebase reports as
//   auth/code-expired even when the OTP is entered immediately.
//
//   Let signInWithPhoneNumber() trigger the reCAPTCHA challenge itself
//   (it always fetches a fresh token right before calling Google's API).
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
        callback: () => { /* reCAPTCHA solved — signInWithPhoneNumber continues */ },
        'expired-callback': () => {
            // reCAPTCHA token expired between sends — clear so next sendOTP
            // calls createVerifier() fresh (safe, OTP not sent yet at this point).
            window.recaptchaVerifier = null;
        }
    });
    return window.recaptchaVerifier;
}

/**
 * Call this ONCE when the Login component mounts.
 * Creates the invisible reCAPTCHA verifier and attaches its DOM node.
 * Does NOT call render() — the fresh token is fetched by signInWithPhoneNumber
 * itself so it is always valid at the exact moment of the API call.
 */
export const initRecaptcha = () => {
    if (window.recaptchaVerifier) return; // already set up
    createVerifier();
};

/**
 * Send OTP to phone number.
 * Reuses the verifier created on Login mount.
 * Only creates a new one if the old verifier was cleared by an error.
 * @param {string} phoneNumber - e.g. "+919876543210"
 * @returns {Promise<ConfirmationResult>}
 */
export const sendOTP = async (phoneNumber) => {
    try {
        // Ensure a verifier exists (safe to call if already set up)
        if (!window.recaptchaVerifier) {
            createVerifier();
        }

        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        return confirmationResult;
    } catch (error) {
        console.error('Error sending OTP:', error);
        // Destroy on failure so the next attempt starts completely clean
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
