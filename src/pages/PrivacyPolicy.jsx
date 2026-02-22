// Privacy Policy Page — Public (no login required)
import { Link } from 'react-router-dom';
import './PrivacyPolicy.css';

const CONTACT_EMAIL = 'support@smartcng.in';
const LAST_UPDATED = '22 February 2026';
const APP_NAME = 'Smart CNG Station';

export default function PrivacyPolicy() {
    return (
        <div className="pp-page">
            <header className="pp-header">
                <div className="pp-header-inner">
                    <div className="pp-logo">⛽</div>
                    <div>
                        <h1>{APP_NAME}</h1>
                        <p className="pp-subtitle">Privacy Policy</p>
                    </div>
                </div>
                <p className="pp-updated">Last updated: {LAST_UPDATED}</p>
            </header>

            <main className="pp-content">

                {/* ── Introduction ── */}
                <Section title="1. Introduction">
                    <p>
                        <strong>Smart CNG Station</strong> ("we", "our", or "us") operates a digital
                        queue management and CNG fuel-slot booking application available on Android
                        (via Google Play Store) and as a web app. This Privacy Policy explains what
                        data we collect, why we collect it, and how we protect it.
                    </p>
                    <p>
                        By using the App, you agree to the collection and use of information described
                        in this policy. If you do not agree, please uninstall the App and contact us
                        to request data deletion.
                    </p>
                </Section>

                {/* ── Data Collected ── */}
                <Section title="2. Data We Collect">

                    <SubSection title="2.1 Phone Number">
                        <p>
                            We collect your <strong>mobile phone number</strong> (with country code)
                            for the sole purpose of authenticating you via One-Time Password (OTP)
                            through <strong>Firebase Authentication</strong> (Google LLC). We do not
                            use your phone number for marketing calls or share it with third parties
                            for advertising.
                        </p>
                    </SubSection>

                    <SubSection title="2.2 Vehicle Registration Number">
                        <p>
                            You voluntarily provide your <strong>vehicle registration number</strong>
                            (e.g., MH12AB1234) when adding vehicles to your profile. This number is
                            stored in your account and is used exclusively to:
                        </p>
                        <ul>
                            <li>Tag your fuel-slot booking to a specific vehicle</li>
                            <li>Prevent duplicate active bookings for the same vehicle</li>
                            <li>Help station operators verify the correct vehicle at the pump</li>
                        </ul>
                        <p>
                            Your vehicle number is <strong>never shared publicly</strong> or sold to
                            any third party.
                        </p>
                    </SubSection>

                    <SubSection title="2.3 Location (GPS)">
                        <p>
                            Location access is requested <strong>only when you perform check-in</strong>
                            at a CNG station. We verify that you are physically within {' '}
                            <em>the station's geo-fence radius (default: 15 metres)</em> before
                            allowing check-in. We do <strong>not</strong> continuously track your
                            location or store your location history beyond the single check-in event.
                        </p>
                        <p>
                            The check-in coordinates are stored temporarily in your booking record
                            and are deleted when your booking is completed or expired.
                        </p>
                    </SubSection>

                    <SubSection title="2.4 Booking Data">
                        <p>
                            Each fuel-slot booking stores the following in our database:
                        </p>
                        <ul>
                            <li>Station ID and name</li>
                            <li>Vehicle number</li>
                            <li>Queue position and timestamps (booked, eligible, check-in, completed)</li>
                            <li>Booking status (waiting / eligible / checked-in / fueling / completed / cancelled / skipped)</li>
                            <li>Number of skips or no-shows (used for fair-use enforcement)</li>
                        </ul>
                        <p>
                            Booking history is kept for <strong>90 days</strong> after completion
                            for operational analytics, then permanently deleted.
                        </p>
                    </SubSection>

                    <SubSection title="2.5 Account Profile">
                        <p>
                            We store a basic user profile containing: your name (provided by you),
                            phone number, role (customer / operator / owner / admin), assigned station
                            (for operators and owners), and account status flags (no-show count,
                            account restriction status).
                        </p>
                    </SubSection>

                    <SubSection title="2.6 Device &amp; App Metadata">
                        <p>
                            Firebase automatically collects minimal technical data including:
                            device token (for push notifications, if enabled), app version, and
                            crash/performance data via Firebase Crashlytics/Analytics. This data
                            is used solely to improve app stability and performance.
                        </p>
                    </SubSection>
                </Section>

                {/* ── Why We Collect ── */}
                <Section title="3. Why We Collect This Data">
                    <table className="pp-table">
                        <thead>
                            <tr><th>Data</th><th>Purpose</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Phone number</td><td>Account authentication via OTP (no passwords)</td></tr>
                            <tr><td>Vehicle number</td><td>Tag bookings, verify at pump, prevent duplicates</td></tr>
                            <tr><td>Location (check-in)</td><td>Verify physical presence at station before fueling</td></tr>
                            <tr><td>Booking data</td><td>Manage the digital queue, show your booking status</td></tr>
                            <tr><td>Profile / role</td><td>Determine app access level and features available</td></tr>
                            <tr><td>Device token</td><td>Send important queue status push notifications</td></tr>
                        </tbody>
                    </table>
                    <p>We do <strong>not</strong> sell, rent, or trade your data to any third party.</p>
                </Section>

                {/* ── Firebase ── */}
                <Section title="4. How Firebase Is Used">
                    <p>
                        We use <strong>Google Firebase</strong> (Google LLC, USA) as our backend platform:
                    </p>
                    <ul>
                        <li>
                            <strong>Firebase Authentication</strong> — Handles OTP-based phone sign-in securely.
                            Phone numbers are processed by Google's systems under their privacy policy.
                        </li>
                        <li>
                            <strong>Cloud Firestore</strong> — Stores your profile, vehicles, and booking data.
                            Data is encrypted at rest and in transit using TLS.
                        </li>
                        <li>
                            <strong>Firebase Cloud Messaging (FCM)</strong> — Sends queue-status push
                            notifications (token changes, booking confirmations, etc.).
                        </li>
                    </ul>
                    <p>
                        Firebase services are governed by Google's{' '}
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                            Privacy Policy
                        </a>{' '}
                        and their{' '}
                        <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">
                            Data Processing Terms
                        </a>.
                    </p>
                </Section>

                {/* ── Storage & Protection ── */}
                <Section title="5. Data Storage &amp; Protection">
                    <ul>
                        <li>All data is stored on <strong>Google Cloud (Firebase/Firestore)</strong> servers.</li>
                        <li>Data is encrypted <strong>in transit</strong> (HTTPS/TLS) and <strong>at rest</strong>.</li>
                        <li>Firestore Security Rules enforce that users can only read/write their own data.</li>
                        <li>No employee or admin has plain-text access to OTP codes.</li>
                        <li>We do not store passwords — authentication is OTP-only.</li>
                    </ul>
                </Section>

                {/* ── Retention ── */}
                <Section title="6. Data Retention">
                    <table className="pp-table">
                        <thead>
                            <tr><th>Data Type</th><th>Retention Period</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Account profile</td><td>Until you delete your account</td></tr>
                            <tr><td>Active bookings</td><td>Until booking is completed or cancelled</td></tr>
                            <tr><td>Completed booking history</td><td>90 days after completion</td></tr>
                            <tr><td>Queue logs (audit)</td><td>180 days</td></tr>
                            <tr><td>Deleted account data</td><td>Permanently deleted within 7 days</td></tr>
                        </tbody>
                    </table>
                </Section>

                {/* ── Account Deletion ── */}
                <Section title="7. Account Deletion">
                    <div className="pp-highlight">
                        <strong>🗑️ You can permanently delete your account at any time.</strong>
                    </div>
                    <p>
                        In the App, go to <strong>Profile → Delete My Account</strong>. This action:
                    </p>
                    <ul>
                        <li>Permanently deletes your Firebase Authentication account</li>
                        <li>Permanently deletes your user profile from Firestore</li>
                        <li>Cancels any active bookings linked to your account</li>
                        <li>Removes your vehicle numbers from our database</li>
                    </ul>
                    <p>
                        Deletion is <strong>irreversible</strong>. Historical booking records linked
                        to your account will be anonymised (UID removed) within 7 days.
                    </p>
                    <p>
                        If you are unable to use the in-app option, email us at{' '}
                        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the subject line
                        <em> "Account Deletion Request"</em> and we will process it within 7 business days.
                    </p>
                </Section>

                {/* ── User Rights ── */}
                <Section title="8. Your Rights">
                    <p>You have the right to:</p>
                    <ul>
                        <li><strong>Access</strong> — request a copy of your stored data</li>
                        <li><strong>Correction</strong> — update your name or vehicles in Profile</li>
                        <li><strong>Deletion</strong> — permanently delete your account (see §7)</li>
                        <li><strong>Portability</strong> — request your data in a readable format</li>
                        <li><strong>Objection</strong> — object to processing by contacting us</li>
                    </ul>
                    <p>To exercise any right, email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
                </Section>

                {/* ── Third Parties ── */}
                <Section title="9. Third-Party Services">
                    <table className="pp-table">
                        <thead>
                            <tr><th>Service</th><th>Purpose</th><th>Provider</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Firebase Auth</td><td>OTP authentication</td><td>Google LLC</td></tr>
                            <tr><td>Cloud Firestore</td><td>Data storage</td><td>Google LLC</td></tr>
                            <tr><td>Google Maps API</td><td>Station location display</td><td>Google LLC</td></tr>
                            <tr><td>FCM</td><td>Push notifications</td><td>Google LLC</td></tr>
                        </tbody>
                    </table>
                </Section>

                {/* ── Children ── */}
                <Section title="10. Children's Privacy">
                    <p>
                        This app is not intended for users under 13 years of age. We do not
                        knowingly collect data from children. If you believe a child has
                        provided us personal data, contact us immediately.
                    </p>
                </Section>

                {/* ── Changes ── */}
                <Section title="11. Changes to This Policy">
                    <p>
                        We may update this Privacy Policy periodically. We will notify you of
                        significant changes via the app or email. Continued use of the app after
                        changes constitutes acceptance of the updated policy.
                    </p>
                </Section>

                {/* ── Contact ── */}
                <Section title="12. Contact Us">
                    <div className="pp-contact-card">
                        <p><strong>Smart CNG Station Support</strong></p>
                        <p>📧 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
                        <p>Subject line: <em>Privacy / Data Request</em></p>
                    </div>
                </Section>

            </main>

            <footer className="pp-footer">
                <p>© {new Date().getFullYear()} Smart CNG Station. All rights reserved.</p>
                <Link to="/" className="pp-back-link">← Back to App</Link>
            </footer>
        </div>
    );
}

/* ── Sub-components ── */
function Section({ title, children }) {
    return (
        <section className="pp-section">
            <h2 className="pp-section-title">{title}</h2>
            <div className="pp-section-body">{children}</div>
        </section>
    );
}

function SubSection({ title, children }) {
    return (
        <div className="pp-subsection">
            <h3 className="pp-subsection-title">{title}</h3>
            {children}
        </div>
    );
}
