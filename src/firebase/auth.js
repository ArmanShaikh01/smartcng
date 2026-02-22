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
//   We ALWAYS create a brand-new RecaptchaVerifier right before calling
//   signInWithPhoneNumber(). This is the ONLY reliable way to guarantee
//   the reCAPTCHA token is fresh at the exact moment Firebase talks to
//   Google's identity API.
//
//   Pre-creating the verifier on component mount (initRecaptcha) causes
//   the invisible reCAPTCHA to grab a token that may expire in ~30-120s.
//   If the user delays sending the OTP, Firebase sees a stale/recycled
//   token and returns auth/code-expired even when OTP is entered immediately.
//
//   Destroying and recreating on every sendOTP call costs one extra DOM
//   operation but eliminates the entire class of "OTP expired immediately"
//   bugs caused by a stale reCAPTCHA session.
// ─────────────────────────────────────────────────────────────────────────

const RCAP_ID = '__rcap_widget__';

function destroyVerifier() {
    if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (_) { /* already cleared */ }
        window.recaptchaVerifier = null;
    }
    const el = document.getElementById(RCAP_ID);
    if (el) el.remove();
}

function createFreshVerifier() {
    // Always destroy any previous instance first — stale tokens = expired errors
    destroyVerifier();

    const el = document.createElement('div');
    el.id = RCAP_ID;
    el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    document.body.appendChild(el);

    window.recaptchaVerifier = new RecaptchaVerifier(getAuth(), RCAP_ID, {
        size: 'invisible',
        callback: () => { /* reCAPTCHA solved — signInWithPhoneNumber continues */ },
        'expired-callback': () => {
            // Token expired mid-flow — will be recreated on next sendOTP call
            destroyVerifier();
        }
    });
    return window.recaptchaVerifier;
}

/**
 * Send OTP to phone number.
 * Creates a FRESH reCAPTCHA verifier on every call to avoid stale-token
 * errors (auth/code-expired appearing immediately after OTP is sent).
 * @param {string} phoneNumber - e.g. "+919876543210"
 * @returns {Promise<ConfirmationResult>}
 */
export const sendOTP = async (phoneNumber) => {
    try {
        // Always create a fresh verifier to guarantee the token is valid
        // right at the moment signInWithPhoneNumber hits Google's API.
        const appVerifier = createFreshVerifier();
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        return confirmationResult;
    } catch (error) {
        console.error('Error sending OTP:', error);
        // Destroy on failure so the next attempt starts completely clean
        destroyVerifier();
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
