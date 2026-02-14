// Help & FAQ Page
import { useState } from 'react';
import Navbar from '../components/shared/Navbar';
import './Help.css';

const Help = () => {
    const [activeCategory, setActiveCategory] = useState('general');
    const [expandedFaq, setExpandedFaq] = useState(null);

    const faqs = {
        general: [
            {
                q: 'What is CNG Queue Management System?',
                a: 'CNG Queue Management System is a smart booking platform that allows you to book your CNG fueling slot in advance, track your queue position in real-time, and check-in using GPS when you arrive at the station.'
            },
            {
                q: 'How do I create an account?',
                a: 'Simply enter your phone number, verify the OTP, and complete your profile with your name and vehicle number. Your account will be created automatically.'
            },
            {
                q: 'Is this service free?',
                a: 'Yes, the booking and queue management service is completely free for customers. You only pay for the CNG you fuel.'
            }
        ],
        booking: [
            {
                q: 'How do I book a CNG slot?',
                a: '1. Select your vehicle\n2. Choose a CNG station\n3. Confirm your booking\n4. Track your queue position in real-time'
            },
            {
                q: 'Can I book for multiple vehicles?',
                a: 'You can add multiple vehicles to your profile, but you can only have one active booking at a time per vehicle.'
            },
            {
                q: 'What if I want to cancel my booking?',
                a: 'You can cancel your booking anytime before fueling starts. Just go to "My Booking" and click "Cancel Booking".'
            },
            {
                q: 'How far in advance can I book?',
                a: 'Bookings are for the current day only. You can book as soon as the station opens booking.'
            }
        ],
        checkin: [
            {
                q: 'What is GPS check-in?',
                a: 'GPS check-in verifies that you are physically present at the station. You must be within 15 meters of the station to check-in successfully.'
            },
            {
                q: 'When should I check-in?',
                a: 'Check-in when your queue position becomes eligible (position ≤ 10) and you have arrived at the station. You will receive a notification.'
            },
            {
                q: 'What if GPS check-in fails?',
                a: 'Make sure:\n- Location services are enabled\n- You are within 15m of the station\n- GPS accuracy is high (not indoors)\n- Browser has location permission'
            },
            {
                q: 'What happens if I don\'t check-in on time?',
                a: 'You have a 5-minute grace window to check-in when your turn comes. If you miss it, your booking will be skipped and you\'ll move to the end of the queue.'
            }
        ],
        queue: [
            {
                q: 'How does the queue system work?',
                a: 'When you book, you get a queue position. The queue moves forward as vehicles are fueled. You can track your position in real-time.'
            },
            {
                q: 'What do the green and red indicators mean?',
                a: 'Green indicator = You have checked-in and are present at the station\nRed indicator = You have not arrived yet'
            },
            {
                q: 'Can I see how many vehicles are ahead of me?',
                a: 'Yes, your queue position shows exactly how many vehicles are ahead. Position #1 means you\'re next.'
            },
            {
                q: 'What if someone skips their turn?',
                a: 'If a vehicle doesn\'t check-in within the grace window, they are automatically skipped and the queue advances.'
            }
        ],
        account: [
            {
                q: 'How do I add a new vehicle?',
                a: 'Go to Profile → My Vehicles → Enter vehicle number → Add Vehicle'
            },
            {
                q: 'Can I change my default vehicle?',
                a: 'Yes, go to your Profile and select a different vehicle as default from your vehicles list.'
            },
            {
                q: 'What are no-shows?',
                a: 'A no-show is when you book a slot but don\'t check-in when your turn comes. After 3 no-shows, your account may be temporarily banned.'
            },
            {
                q: 'How do I delete my account?',
                a: 'Please contact support to request account deletion. Your data will be removed as per privacy policy.'
            }
        ]
    };

    const categories = [
        { id: 'general', name: 'General', icon: '❓' },
        { id: 'booking', name: 'Booking', icon: '📝' },
        { id: 'checkin', name: 'Check-in', icon: '📍' },
        { id: 'queue', name: 'Queue', icon: '📊' },
        { id: 'account', name: 'Account', icon: '👤' }
    ];

    return (
        <div className="help-page">
            <Navbar title="Help & FAQ" />

            <div className="help-content">
                <div className="help-header">
                    <h1>How can we help you?</h1>
                    <p>Find answers to common questions about CNG Queue Management</p>
                </div>

                <div className="help-categories">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                        >
                            <span className="category-icon">{cat.icon}</span>
                            <span className="category-name">{cat.name}</span>
                        </button>
                    ))}
                </div>

                <div className="faq-list">
                    {faqs[activeCategory].map((faq, index) => (
                        <div
                            key={index}
                            className={`faq-item ${expandedFaq === index ? 'expanded' : ''}`}
                            onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                        >
                            <div className="faq-question">
                                <h3>{faq.q}</h3>
                                <span className="faq-toggle">{expandedFaq === index ? '−' : '+'}</span>
                            </div>
                            {expandedFaq === index && (
                                <div className="faq-answer">
                                    <p>{faq.a.split('\n').map((line, i) => (
                                        <span key={i}>{line}<br /></span>
                                    ))}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="help-contact">
                    <h2>Still need help?</h2>
                    <p>Contact our support team for assistance</p>
                    <div className="contact-options">
                        <a href="mailto:support@cngqueue.com" className="contact-btn">
                            📧 Email Support
                        </a>
                        <a href="tel:+919876543210" className="contact-btn">
                            📞 Call Support
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Help;
