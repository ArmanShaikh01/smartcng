// Vehicle Selection Component
import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { validateVehicleNumber } from '../../utils/validators';
import './VehicleSelection.css';

const VehicleSelection = ({ onVehicleSelected }) => {
    const { user, userProfile, setUserProfile } = useAuth();
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState(userProfile?.defaultVehicle || '');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (userProfile?.defaultVehicle) {
            setSelectedVehicle(userProfile.defaultVehicle);
        }
    }, [userProfile]);

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Validate Indian vehicle number format
            const result = validateVehicleNumber(vehicleNumber);
            if (!result.valid) {
                setError(result.error);
                setLoading(false);
                return;
            }
            const cleanVehicle = result.clean;

            const userRef = doc(db, COLLECTIONS.USERS, user.uid);
            const updatedVehicles = [...(userProfile.vehicles || []), cleanVehicle];
            const isFirstVehicle = !userProfile.defaultVehicle;

            await updateDoc(userRef, {
                vehicles: updatedVehicles,
                defaultVehicle: isFirstVehicle ? cleanVehicle : userProfile.defaultVehicle
            });

            // Update local state
            setUserProfile({
                ...userProfile,
                vehicles: updatedVehicles,
                defaultVehicle: isFirstVehicle ? cleanVehicle : userProfile.defaultVehicle
            });

            setSelectedVehicle(cleanVehicle);
            setVehicleNumber('');
            setIsAddingNew(false);
            setLoading(false);
        } catch (err) {
            console.error('Error adding vehicle:', err);
            setError('Failed to add vehicle. Please try again.');
            setLoading(false);
        }
    };

    const handleSelectVehicle = (vehicle) => {
        setSelectedVehicle(vehicle);
    };

    const handleContinue = () => {
        if (selectedVehicle) {
            onVehicleSelected(selectedVehicle);
        }
    };

    return (
        <div className="vehicle-selection-container">
            <div className="vehicle-selection-card card">
                <h2>Select Vehicle</h2>
                <p className="subtitle">Choose or add a vehicle to book CNG</p>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {userProfile?.vehicles && userProfile.vehicles.length > 0 && (
                    <div className="vehicles-list">
                        <h3>Your Vehicles</h3>
                        {userProfile.vehicles.map((vehicle) => (
                            <div
                                key={vehicle}
                                className={`vehicle-item ${selectedVehicle === vehicle ? 'selected' : ''}`}
                                onClick={() => handleSelectVehicle(vehicle)}
                            >
                                <div className="vehicle-icon">🚗</div>
                                <div className="vehicle-number">{vehicle}</div>
                                {selectedVehicle === vehicle && (
                                    <div className="selected-badge">✓</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {!isAddingNew ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsAddingNew(true);
                        }}
                        className="btn btn-outline btn-block mt-3"
                    >
                        + Add New Vehicle
                    </button>
                ) : (
                    <form onSubmit={handleAddVehicle} className="add-vehicle-form mt-3">
                        <div className="form-group">
                            <label htmlFor="vehicle">Vehicle Number</label>
                            <input
                                type="text"
                                id="vehicle"
                                className="input"
                                placeholder="MH12AB1234"
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                                required
                                disabled={loading}
                                autoFocus
                                style={{ fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                            />
                            <small className="form-hint">
                                Format: MH12AB1234 — State · RTO · Series · Number
                            </small>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading || !vehicleNumber}
                            >
                                {loading ? 'Adding...' : 'Add Vehicle'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddingNew(false);
                                    setVehicleNumber('');
                                    setError('');
                                }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleContinue();
                    }}
                    className="btn btn-primary btn-block mt-4"
                    disabled={!selectedVehicle}
                >
                    Continue with {selectedVehicle || 'Selected Vehicle'}
                </button>
            </div>
        </div>
    );
};

export default VehicleSelection;
