// ComplaintForm — modal for submitting a complaint with optional image proof
import { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { toast } from '../../utils/toast';
import './ComplaintForm.css';

const ComplaintForm = ({ customerId, stationId, bookingId, onClose }) => {
    const [description, setDesc] = useState('');
    const [imageFile, setImage]  = useState(null);
    const [preview, setPreview]  = useState(null);
    const [progress, setProgress]= useState(0);
    const [submitting, setSub]   = useState(false);
    const [done, setDone]        = useState(false);
    const fileRef = useRef();

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.warning('Image must be under 5 MB');
            return;
        }
        setImage(file);
        setPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async () => {
        if (!description.trim()) {
            toast.warning('Please describe your complaint');
            return;
        }
        setSub(true);

        try {
            let imageUrl = null;

            if (imageFile) {
                // Upload to Firebase Storage
                const path = `complaints/${customerId}/${Date.now()}_${imageFile.name}`;
                const storageRef = ref(storage, path);
                const task = uploadBytesResumable(storageRef, imageFile);

                imageUrl = await new Promise((resolve, reject) => {
                    task.on(
                        'state_changed',
                        snap => {
                            setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
                        },
                        reject,
                        async () => {
                            resolve(await getDownloadURL(task.snapshot.ref));
                        }
                    );
                });
            }

            await addDoc(collection(db, COLLECTIONS.COMPLAINTS), {
                customerId,
                stationId,
                bookingId: bookingId || null,
                description: description.trim(),
                imageUrl,
                status: 'pending',
                resolvedAt: null,
                createdAt: serverTimestamp()
            });

            setDone(true);
            setTimeout(() => onClose(), 1800);
        } catch (err) {
            console.error('[ComplaintForm] submit error:', err);
            toast.error('Failed to submit complaint. Please try again.');
            setSub(false);
        }
    };

    if (done) {
        return (
            <div className="cf-overlay">
                <div className="cf-modal" style={{ textAlign: 'center', padding: '40px 24px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
                    <h3 style={{ color: '#0E7C5B' }}>Complaint Submitted</h3>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 6 }}>
                        We will review it and respond soon.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="cf-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="cf-modal">
                <h3>📋 File a Complaint</h3>
                <p className="cf-sub">Describe your issue. Attach a photo if needed.</p>

                <div className="cf-field">
                    <label>Complaint Description *</label>
                    <textarea
                        className="cf-textarea"
                        rows={4}
                        placeholder="e.g. Long wait time, rude behavior, gas quality issue..."
                        value={description}
                        onChange={e => setDesc(e.target.value)}
                        maxLength={500}
                    />
                </div>

                <div className="cf-field">
                    <label>Photo Proof (optional, max 5 MB)</label>
                    <div
                        className="cf-upload-zone"
                        onClick={() => fileRef.current?.click()}
                    >
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                        />
                        {!preview ? (
                            <>
                                <div className="cf-upload-icon">📷</div>
                                <p>Tap to select a photo</p>
                            </>
                        ) : (
                            <div className="cf-preview">
                                <img src={preview} alt="preview" />
                            </div>
                        )}
                    </div>
                </div>

                {submitting && imageFile && (
                    <div className="cf-progress">
                        <div className="cf-progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                )}

                <div className="cf-actions">
                    <button type="button" className="cf-btn-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="cf-btn-submit"
                        onClick={handleSubmit}
                        disabled={submitting || !description.trim()}
                    >
                        {submitting ? 'Submitting...' : 'Submit Complaint'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComplaintForm;
