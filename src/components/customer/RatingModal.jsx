// RatingModal — shown after booking completes, allows 1–5 star rating + comment
import { useState } from 'react';
import { submitRating } from '../../hooks/useStationRating';
import { toast } from '../../utils/toast';
import './RatingModal.css';

const STARS = [1, 2, 3, 4, 5];
const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

const RatingModal = ({ stationId, stationName, customerId, bookingId, onClose }) => {
    const [selected, setSelected]  = useState(0);
    const [hover, setHover]        = useState(0);
    const [comment, setComment]    = useState('');
    const [submitting, setSubmit]  = useState(false);
    const [done, setDone]          = useState(false);

    const handleSubmit = async () => {
        if (!selected) return;
        setSubmit(true);
        const result = await submitRating(stationId, customerId, bookingId, selected, comment);
        if (result.success) {
            setDone(true);
            setTimeout(() => onClose(), 1800);
        } else {
            toast.error('Could not submit rating. Please try again.');
            setSubmit(false);
        }
    };

    if (done) {
        return (
            <div className="rating-overlay">
                <div className="rating-modal">
                    <div className="rm-success">
                        🎉
                        <p>Thank you for your rating!</p>
                    </div>
                </div>
            </div>
        );
    }

    const activeVal = hover || selected;

    return (
        <div className="rating-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="rating-modal">
                <h3>Rate Your Experience</h3>
                <p className="rm-sub">at {stationName}</p>

                {/* Stars */}
                <div className="rm-stars">
                    {STARS.map(s => (
                        <button
                            key={s}
                            type="button"
                            className={`rm-star ${s <= activeVal ? 'active' : ''}`}
                            onMouseEnter={() => setHover(s)}
                            onMouseLeave={() => setHover(0)}
                            onClick={() => setSelected(s)}
                        >
                            ⭐
                        </button>
                    ))}
                </div>

                {activeVal > 0 && (
                    <p style={{ color: '#0E7C5B', fontWeight: 600, marginBottom: 12 }}>
                        {LABELS[activeVal]}
                    </p>
                )}

                <textarea
                    className="rm-textarea"
                    rows={3}
                    placeholder="Optional: tell us about your experience..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    maxLength={200}
                />

                <div className="rm-actions">
                    <button type="button" className="rm-btn-skip" onClick={onClose}>
                        Skip
                    </button>
                    <button
                        type="button"
                        className="rm-btn-primary"
                        onClick={handleSubmit}
                        disabled={!selected || submitting}
                    >
                        {submitting ? 'Submitting...' : 'Submit Rating'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RatingModal;
