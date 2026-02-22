// Help & FAQ Page — Role-Aware
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/shared/Navbar';
import Icon from '../components/shared/Icon';
import './Help.css';

/* ================================================================
   FAQ DATA — scoped per role
   ================================================================ */

const FAQ_DATA = {

    /* ── CUSTOMER ── */
    customer: {
        categories: [
            { id: 'general',  label: 'General',  iconName: 'helpCircle' },
            { id: 'booking',  label: 'Booking',  iconName: 'list'       },
            { id: 'checkin',  label: 'Check-in', iconName: 'mapPin'     },
            { id: 'queue',    label: 'Queue',    iconName: 'queue'      },
            { id: 'account',  label: 'Account',  iconName: 'user'       },
        ],
        faqs: {
            general: [
                { q: 'What is Smart CNG Queue System?', a: 'A smart booking platform to reserve your CNG fueling slot in advance, track queue position in real-time, and check-in using GPS when you arrive.' },
                { q: 'How do I create an account?', a: 'Enter your phone number, verify the OTP, and complete your profile with your name and vehicle number.' },
                { q: 'Is this service free?', a: 'Yes, booking and queue management is completely free. You only pay for the CNG you fuel.' }
            ],
            booking: [
                { q: 'How do I book a CNG slot?', a: '1. Select your vehicle\n2. Choose a CNG station\n3. Confirm your booking\n4. Track your queue position in real-time' },
                { q: 'Can I book for multiple vehicles?', a: 'You can add multiple vehicles, but only one active booking per vehicle at a time.' },
                { q: 'How do I cancel my booking?', a: 'Go to "My Booking" and click "Cancel Booking" before fueling starts.' },
                { q: 'How far in advance can I book?', a: 'Bookings are for the current day only, as soon as the station opens booking.' }
            ],
            checkin: [
                { q: 'What is GPS check-in?', a: 'GPS check-in verifies you are physically at the station. You must be within 15 meters to check-in.' },
                { q: 'When should I check-in?', a: 'When your queue position becomes eligible (≤10) and you have arrived at the station.' },
                { q: 'What if GPS check-in fails?', a: 'Ensure:\n— Location services are enabled\n— You are within 15m of the station\n— Browser has location permission' },
                { q: 'What if I miss my check-in window?', a: 'You have a grace window to check-in. If missed, your booking is skipped and you move to the end.' }
            ],
            queue: [
                { q: 'How does the queue system work?', a: 'When you book, you get a queue position. Queue moves forward as vehicles are fueled.' },
                { q: 'What do green/red indicators mean?', a: 'Green = Checked-in and present at station\nRed = Not yet arrived' },
                { q: 'Can I see vehicles ahead of me?', a: 'Yes, your position shows exactly how many are ahead. Position #1 means you\'re next.' }
            ],
            account: [
                { q: 'How do I add a vehicle?', a: 'Go to Profile → My Vehicles → Enter vehicle number → Add Vehicle' },
                { q: 'What are no-shows?', a: 'A no-show is when you book but don\'t check-in when your turn comes. Repeated no-shows may restrict your account.' },
                { q: 'How do I delete my account?', a: 'Contact support to request account deletion.' }
            ]
        }
    },

    /* ── OWNER ── */
    owner: {
        categories: [
            { id: 'station',    label: 'Station Setup',    iconName: 'station'    },
            { id: 'operators',  label: 'Operators',        iconName: 'users'      },
            { id: 'queue',      label: 'Queue Config',     iconName: 'queue'      },
            { id: 'reports',    label: 'Reports',          iconName: 'barChart'   },
            { id: 'account',    label: 'Account',          iconName: 'user'       },
        ],
        faqs: {
            station: [
                { q: 'How do I enable or disable booking?', a: 'Go to Dashboard → Station Controls → Toggle "Booking ON/OFF". Disabling stops new bookings but does not affect the existing queue.' },
                { q: 'How do I turn gas supply on or off?', a: 'Go to Dashboard → Station Controls → Toggle "Gas ON/OFF". Turning gas OFF pauses the fueling queue and alerts your operator.' },
                { q: 'How do I configure station timings?', a: 'Contact the system admin to configure opening/closing hours and days of operation for your station.' },
                { q: 'What does "Station Suspended" mean?', a: 'Your station was suspended by the admin due to a compliance or operational issue. Contact admin to resolve it.' }
            ],
            operators: [
                { q: 'How do I add an operator?', a: 'Go to Dashboard → Operators tab → Enter operator\'s registered phone number → Assign to Station. The operator must have an existing account.' },
                { q: 'How do I remove an operator?', a: 'Go to Operators tab → Find the operator → Click "Remove". They will immediately lose access to your station.' },
                { q: 'Can I have multiple operators?', a: 'Yes, you can assign multiple operators to your station for shift management.' },
                { q: 'How do I track operator activity?', a: 'The Operators tab shows last active time, queue actions taken, and shift logs for each assigned operator.' }
            ],
            queue: [
                { q: 'How do I set the queue limit?', a: 'Go to Station Controls → Queue Settings → Set the maximum number of bookings allowed per day.' },
                { q: 'What is the no-show time setting?', a: 'It defines the grace period (in minutes) a customer gets to check-in when their turn comes before being marked as no-show.' },
                { q: 'How does the no-show system work?', a: 'If a customer doesn\'t check-in within the no-show window, they are automatically moved to the end of the queue and marked as a no-show.' },
                { q: 'Can I override a no-show manually?', a: 'Only operators can mark a vehicle as "No Show" manually from the control panel during their active shift.' }
            ],
            reports: [
                { q: 'How do I download a daily report?', a: 'Go to Dashboard → Analytics → Select date → Click "Download CSV". Reports are available for the last 30 days.' },
                { q: 'What data is in the daily report?', a: 'Each report includes: total vehicles served, no-show count, peak hours, average waiting time, and operator activity.' },
                { q: 'Can I see queue trend graphs?', a: 'Yes, the Analytics tab shows daily and weekly queue volume trends with peak hour analysis.' },
                { q: 'How far back can I access reports?', a: 'Reports are available for the last 30 days. For older data, contact the system admin.' }
            ],
            account: [
                { q: 'How do I update my contact information?', a: 'Go to Profile → Edit → Update name and phone number. Changes take effect immediately.' },
                { q: 'Can I manage multiple stations?', a: 'Currently each owner account is assigned to one station. Contact admin to extend multi-station access.' },
                { q: 'How do I contact admin support?', a: 'Use the contact options below or email your registered support address for priority assistance.' }
            ]
        }
    },

    /* ── OPERATOR ── */
    operator: {
        categories: [
            { id: 'operations', label: 'Operations',    iconName: 'settings' },
            { id: 'queue',      label: 'Queue Mgmt',   iconName: 'queue'    },
            { id: 'account',    label: 'Account',       iconName: 'user'     },
        ],
        faqs: {
            operations: [
                { q: 'How do I turn gas on or off?', a: 'Use the Gas ON/OFF toggle in your Control Panel. Turning it OFF pauses the queue and notifies the station owner.' },
                { q: 'How do I enable or disable booking?', a: 'Use the Booking ON/OFF toggle in your Control Panel to open or close new slot bookings.' },
                { q: 'What does "NEXT" button do?', a: 'Pressing NEXT marks the current vehicle as served and advances the queue to the next token.' }
            ],
            queue: [
                { q: 'How do I mark a no-show?', a: 'Click the "No Show" button on the vehicle card in the queue list. The vehicle will be removed and queue advances.' },
                { q: 'Can I see which vehicles are checked-in?', a: 'Yes, the queue panel shows checked-in (green) vs not-arrived (red) status for each vehicle.' },
                { q: 'What happens if gas runs out?', a: 'Turn Gas OFF using the toggle. The queue pauses and customers are notified. Turn it back ON when supply is restored.' }
            ],
            account: [
                { q: 'Which station am I assigned to?', a: 'Your assigned station is shown in your Profile under "Station Assignment".' },
                { q: 'Can I be assigned to multiple stations?', a: 'No, each operator account is linked to one station at a time. Contact your owner for reassignment.' }
            ]
        }
    },

    /* ── ADMIN ── */
    admin: {
        categories: [
            { id: 'stations',  label: 'Stations',  iconName: 'station'  },
            { id: 'users',     label: 'Users',     iconName: 'users'    },
            { id: 'system',    label: 'System',    iconName: 'settings' },
        ],
        faqs: {
            stations: [
                { q: 'How do I approve a new station?', a: 'Go to Admin Panel → Stations → Pending Approval → Review details → Approve or Reject.' },
                { q: 'How do I suspend a station?', a: 'Go to Stations → Select station → Toggle "Suspend". All operations at that station are immediately halted.' }
            ],
            users: [
                { q: 'How do I ban a customer?', a: 'Go to Users → Search → Select customer → Click "Ban Account". The customer cannot book new slots.' },
                { q: 'How do I assign an owner to a station?', a: 'Go to Stations → Select station → Owner Assignment → Search user by phone → Assign.' }
            ],
            system: [
                { q: 'How do I schedule maintenance?', a: 'Go to System → Maintenance Window → Set date/time → Notify all users. Queue is auto-paused during window.' }
            ]
        }
    }
};

/* ================================================================
   Component
   ================================================================ */

const Help = () => {
    const { userProfile } = useAuth();
    const role = userProfile?.role || 'customer';
    const data = FAQ_DATA[role] || FAQ_DATA.customer;

    const [activeCategory, setActiveCategory] = useState(data.categories[0].id);
    const [expandedFaq, setExpandedFaq] = useState(null);

    const toggleFaq = (index) =>
        setExpandedFaq(expandedFaq === index ? null : index);

    const currentFaqs = data.faqs[activeCategory] || [];

    return (
        <div className="help-page anim-page-load">
            <Navbar title="Help & Support" />

            <div className="help-content">
                {/* Header */}
                <div className="help-header">
                    <h1>Help & Support</h1>
                    <p>
                        {role === 'owner'    && 'Station management and administration guide'}
                        {role === 'operator' && 'Operator controls and queue management guide'}
                        {role === 'admin'    && 'System administration reference'}
                        {role === 'customer' && 'Find answers about booking, check-in, and queue'}
                    </p>
                </div>

                {/* Category tabs */}
                <div className="help-categories">
                    {data.categories.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => { setActiveCategory(cat.id); setExpandedFaq(null); }}
                            className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                        >
                            <Icon
                                name={cat.iconName}
                                size={16}
                                color={activeCategory === cat.id ? '#fff' : '#6b7280'}
                            />
                            <span className="category-name">{cat.label}</span>
                        </button>
                    ))}
                </div>

                {/* FAQ accordion */}
                <div className="faq-list">
                    {currentFaqs.map((faq, index) => (
                        <div
                            key={index}
                            className={`faq-item ${expandedFaq === index ? 'expanded' : ''}`}
                        >
                            <button
                                type="button"
                                className="faq-question"
                                onClick={() => toggleFaq(index)}
                            >
                                <span>{faq.q}</span>
                                <span className="faq-toggle">
                                    <Icon
                                        name={expandedFaq === index ? 'x' : 'plus'}
                                        size={16}
                                        color="#9ca3af"
                                    />
                                </span>
                            </button>
                            {expandedFaq === index && (
                                <div className="faq-answer anim-reveal">
                                    {faq.a.split('\n').map((line, i) => (
                                        <p key={i}>{line}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Contact block */}
                <div className="help-contact">
                    <h2>Still need help?</h2>
                    <p>Contact our support team for priority assistance</p>
                    <div className="contact-options">
                        <a href="mailto:support@smartcng.in" className="contact-btn">
                            <Icon name="mail" size={16} color="#0E7C5B" />
                            Email Support
                        </a>
                        <a href="tel:+919876543210" className="contact-btn">
                            <Icon name="phone" size={16} color="#0E7C5B" />
                            Call Support
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Help;
