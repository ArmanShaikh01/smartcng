// Operator Management Component for Owner
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { createNotification, NOTIF_TYPE } from '../../firebase/notifications';
import { logAuditAction, AUDIT_ACTION } from '../../utils/auditLog';
import { toast } from '../../utils/toast';
import { confirm } from '../../utils/confirm';
import { validatePhone10, onlyDigits10 } from '../../utils/validators';
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
            // Validate and normalize phone
            const phoneResult = validatePhone10(formData.phoneNumber);
            if (!phoneResult.valid) {
                toast.warning(phoneResult.error);
                setLoading(false);
                return;
            }
            const normalized = phoneResult.normalized;

            // Check if operator with this phone already exists
            const existing = await getDocs(
                query(collection(db, COLLECTIONS.USERS), where('phoneNumber', '==', normalized))
            );
            if (!existing.empty) {
                toast.warning('An account with this phone number already exists!');
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

            const docRef = await addDoc(collection(db, COLLECTIONS.USERS), newOperator);
            await logAuditAction({
                userId: docRef.id, role: 'owner', stationId,
                actionType: AUDIT_ACTION.OPERATOR_ADD,
                description: `Operator '${formData.name}' (${normalized}) added to station`
            });

            toast.success(`Operator created! They can login with: ${normalized}`);
            setShowForm(false);
            setFormData({ phoneNumber: '', name: '' });
            fetchOperators();
        } catch (error) {
            console.error('Error creating operator:', error);
            toast.error('Failed to create operator');
            setLoading(false);
        }
    };

    const handleDelete = async (operatorId) => {
        const ok = await confirm('This operator will be permanently removed from the station.', {
            title: 'Remove Operator',
            confirmLabel: 'Yes, Remove',
            variant: 'danger',
        });
        if (!ok) return;

        try {
            // Get operator data from already-loaded state — avoids a getDoc
            // (owners don't have single-doc read permission on other users' docs,
            //  but the list query used by fetchOperators is allowed)
            const operatorData = operators.find(op => op.id === operatorId) || null;
            const operatorDocRef = doc(db, COLLECTIONS.USERS, operatorId);

            await deleteDoc(operatorDocRef);

            await logAuditAction({
                userId: operatorId, role: 'owner', stationId,
                actionType: AUDIT_ACTION.OPERATOR_REMOVE,
                description: `Operator '${operatorData?.name || operatorId}' removed from station`
            });

            // Notify the operator
            const notifyId = operatorData?.userId && operatorData.userId !== operatorId
                ? operatorData.userId
                : operatorId;

            if (notifyId) {
                await createNotification(
                    notifyId,
                    NOTIF_TYPE.OPERATOR_REMOVED,
                    '⛔ Removed from Station',
                    `You have been removed from the station. Contact the owner for details.`,
                    { stationId: operatorData?.stationId }
                );
            }

            toast.success('Operator removed successfully');
            fetchOperators();
        } catch (error) {
            console.error('Error deleting operator:', error);
            toast.error('Failed to remove operator: ' + error.message);
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
                            <div className="phone-input-wrapper">
                                <span className="phone-prefix">+91</span>
                                <input
                                    type="tel"
                                    className="input"
                                    placeholder="9876543210"
                                    value={formData.phoneNumber}
                                    onChange={(e) => setFormData({ ...formData, phoneNumber: onlyDigits10(e.target.value) })}
                                    required
                                    maxLength={10}
                                    inputMode="numeric"
                                />
                            </div>
                            <small>Enter 10-digit mobile number</small>
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
