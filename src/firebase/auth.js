// Authentication helper functions
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from './config';

// ─── reCAPTCHA container ──────────────────────────────────────────────────
// We manage ONE container element that lives directly on document.body,
// completely outside React's virtual DOM. This prevents two problems:
//
//   1. React subtree remount when replaceChild touches a React-owned node.
//   2. Duplicate id="recaptcha-container" in App.jsx AND Login.jsx — both
//      existed before, getElementById returned the first, Firebase rendered
//      in the wrong / unexpected element causing page-refresh-like behaviour.
//
// The element is invisible (size:0, overflow:hidden) and is recreated fresh
// on every initRecaptcha call so grecaptcha never sees a "used" node.
// ─────────────────────────────────────────────────────────────────────────

const RCAP_ID = '__rcap_widget__'; // unique, never clashes with React markup

function getFreshContainer() {
    // Remove old one if it exists
    const old = document.getElementById(RCAP_ID);
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = RCAP_ID;
    el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    document.body.appendChild(el);
    return el;
}

/**
 * Initialize (or re-initialize) the invisible reCAPTCHA verifier.
 * Safe to call multiple times; always returns a fresh verifier on a fresh node.
 */
export const initRecaptcha = () => {
    // Destroy old verifier instance first
    if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (_) { }
        window.recaptchaVerifier = null;
    }

    // Create a fresh DOM node completely outside React
    getFreshContainer();

    window.recaptchaVerifier = new RecaptchaVerifier(getAuth(), RCAP_ID, {
        size: 'invisible',
        callback: () => { /* reCAPTCHA solved — signInWithPhoneNumber continues */ },
        'expired-callback': () => {
            window.recaptchaVerifier = null;
            window._rcapRendered = false;
        }
    });

    return window.recaptchaVerifier;
};

/**
 * Pre-render reCAPTCHA while user types phone number so OTP is faster.
 * Safe to call multiple times — only renders once.
 */
export const warmupRecaptcha = async () => {
    try {
        if (window._rcapRendered) return;          // already warmed up
        if (!window.recaptchaVerifier) initRecaptcha();
        await window.recaptchaVerifier.render();   // contact Google servers early
        window._rcapRendered = true;
    } catch (_) {
        // warmup failure is non-fatal — sendOTP will retry
        window._rcapRendered = false;
    }
};

/**
 * Send OTP to phone number
 * @param {string} phoneNumber - e.g. "+919876543210"
 * @returns {Promise<ConfirmationResult>}
 */
export const sendOTP = async (phoneNumber) => {
    try {
        // Always start with a fresh verifier for each OTP send.
        // initRecaptcha() clears the old verifier + DOM node internally,
        // so this is safe and avoids "used" reCAPTCHA token errors.
        initRecaptcha();
        window._rcapRendered = false;

        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        return confirmationResult;
    } catch (error) {
        console.error('Error sending OTP:', error);
        // Clean up so the next attempt gets a completely fresh start
        if (window.recaptchaVerifier) {
            try { window.recaptchaVerifier.clear(); } catch (_) { }
            window.recaptchaVerifier = null;
        }
        window._rcapRendered = false;
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
