// Operator Management Component for Owner
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import './OperatorManagement.css';

const OperatorManagement = ({ stationId }) => {
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        phoneNumber: '',
        name: ''
    });

    useEffect(() => {
        fetchOperators();
    }, [stationId]);

    const fetchOperators = async () => {
        try {
            const q = query(
                collection(db, COLLECTIONS.USERS),
                where('role', '==', 'operator'),
                where('stationId', '==', stationId)
            );
            const snapshot = await getDocs(q);
            const operatorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOperators(operatorsData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching operators:', error);
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Normalize to E.164: +91XXXXXXXXXX
            let phone = formData.phoneNumber.trim().replace(/\s+/g, '');
            if (!phone.startsWith('+')) {
                phone = '+91' + phone.replace(/^0+/, '');
            }
            const digits = phone.replace(/\D/g, '');
            if (digits.length < 10) {
                alert('Please enter a valid 10-digit phone number');
                setLoading(false);
                return;
            }
            // Always store as +91XXXXXXXXXX (last 10 digits)
            const normalized = '+91' + digits.slice(-10);

            // Check if operator with this phone already exists
            const existing = await getDocs(
                query(collection(db, COLLECTIONS.USERS), where('phoneNumber', '==', normalized))
            );
            if (!existing.empty) {
                alert('An account with this phone number already exists!');
                setLoading(false);
                return;
            }

            const newOperator = {
                userId: `operator_${Date.now()}`,
                phoneNumber: normalized,
                name: formData.name,
                role: 'operator',
                stationId: stationId,
                vehicles: [],
                noShowCount: 0,
                isBanned: false,
                bannedUntil: null,
                createdAt: new Date()
            };

            await addDoc(collection(db, COLLECTIONS.USERS), newOperator);

            alert(`Operator created! They can login with: ${normalized}`);
            setShowForm(false);
            setFormData({ phoneNumber: '', name: '' });
            fetchOperators();
        } catch (error) {
            console.error('Error creating operator:', error);
            alert('Failed to create operator');
            setLoading(false);
        }
    };

    const handleDelete = async (operatorId) => {
        if (!confirm('Are you sure you want to remove this operator?')) return;

        try {
            await deleteDoc(doc(db, COLLECTIONS.USERS, operatorId));
            alert('Operator removed successfully');
            fetchOperators();
        } catch (error) {
            console.error('Error deleting operator:', error);
            alert('Failed to remove operator');
        }
    };

    return (
        <div className="operator-management">
            <div className="om-header">
                <h2>Manage Operators</h2>
                <button type="button" onClick={() => setShowForm(!showForm)} className="btn btn-primary">
                    {showForm ? 'Cancel' : '+ Add Operator'}
                </button>
            </div>

            {showForm && (
                <div className="om-form card">
                    <h3>Add New Operator</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Phone Number *</label>
                            <input
                                type="tel"
                                className="input"
                                placeholder="9876543210"
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                required
                                maxLength={13}
                            />
                            <small>Enter 10-digit mobile number (without +91)</small>
                        </div>

                        <div className="form-group">
                            <label>Name *</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Operator'}
                        </button>
                    </form>
                </div>
            )}

            <div className="om-list">
                {loading && !showForm ? (
                    <div className="om-loading">Loading operators...</div>
                ) : operators.length === 0 ? (
                    <div className="om-empty">No operators assigned to this station</div>
                ) : (
                    <div className="operators-grid">
                        {operators.map(operator => (
                            <div key={operator.id} className="operator-card card">
                                <div className="operator-info">
                                    <div className="operator-avatar">
                                        {operator.name?.charAt(0).toUpperCase() || 'O'}
                                    </div>
                                    <div className="operator-details">
                                        <h4>{operator.name}</h4>
                                        <p>{operator.phoneNumber}</p>
                                        <span className="role-badge">Operator</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(operator.id);
                                    }}
                                    className="btn-delete-small"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OperatorManagement;
