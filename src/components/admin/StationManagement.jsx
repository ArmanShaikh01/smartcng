// Station Management Component - CRUD operations for stations
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import MapLocationPicker from './MapLocationPicker';
import './StationManagement.css';

const StationManagement = () => {
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingStation, setEditingStation] = useState(null);
    const [useMapPicker, setUseMapPicker] = useState(true);
    const [formData, setFormData] = useState({
        stationId: '',
        name: '',
        address: '',
        latitude: '',
        longitude: '',
        checkInRadius: 15,
        maxPhysicalVehicles: 10,
        graceWindowMinutes: 5,
        ownerPhone: '',
        ownerName: ''
    });

    useEffect(() => {
        fetchStations();
    }, []);

    // Generate next station ID
    const generateStationId = () => {
        if (stations.length === 0) {
            return 'STATION_001';
        }

        // Extract numeric parts from existing station IDs
        const numericIds = stations
            .map(s => {
                const match = s.stationId.match(/\d+/);
                return match ? parseInt(match[0]) : 0;
            })
            .filter(n => !isNaN(n));

        const maxId = Math.max(...numericIds, 0);
        const nextId = maxId + 1;
        return `STATION_${String(nextId).padStart(3, '0')}`;
    };

    const fetchStations = async () => {
        try {
            const stationsSnapshot = await getDocs(collection(db, COLLECTIONS.STATIONS));
            const stationsData = stationsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setStations(stationsData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching stations:', error);
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const stationData = {
                stationId: formData.stationId,
                name: formData.name,
                address: formData.address,
                location: {
                    latitude: parseFloat(formData.latitude),
                    longitude: parseFloat(formData.longitude)
                },
                gasOn: true,
                bookingOn: true,
                checkInRadius: parseInt(formData.checkInRadius),
                maxPhysicalVehicles: parseInt(formData.maxPhysicalVehicles),
                graceWindowMinutes: parseInt(formData.graceWindowMinutes),
                totalVehiclesServed: 0,
                totalSkips: 0,
                ownerId: formData.ownerPhone || '',
                operatorIds: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            if (editingStation) {
                await updateDoc(doc(db, COLLECTIONS.STATIONS, editingStation.id), {
                    ...stationData,
                    createdAt: editingStation.createdAt
                });
                alert('Station updated successfully!');
            } else {
                // Create station
                await addDoc(collection(db, COLLECTIONS.STATIONS), stationData);

                // Create owner user if phone provided
                if (formData.ownerPhone && formData.ownerName) {
                    const ownerData = {
                        userId: `owner_${Date.now()}`,
                        phoneNumber: formData.ownerPhone,
                        name: formData.ownerName,
                        role: 'owner',
                        stationId: formData.stationId,
                        vehicles: [],
                        noShowCount: 0,
                        isBanned: false,
                        bannedUntil: null,
                        createdAt: new Date()
                    };
                    await addDoc(collection(db, COLLECTIONS.USERS), ownerData);
                }

                alert('Station and owner created successfully!');
            }

            resetForm();
            fetchStations();
        } catch (error) {
            console.error('Error saving station:', error);
            alert('Failed to save station: ' + error.message);
            setLoading(false);
        }
    };

    const handleEdit = (station) => {
        setEditingStation(station);
        setFormData({
            stationId: station.stationId,
            name: station.name,
            address: station.address,
            latitude: station.location.latitude,
            longitude: station.location.longitude,
            checkInRadius: station.checkInRadius,
            maxPhysicalVehicles: station.maxPhysicalVehicles,
            graceWindowMinutes: station.graceWindowMinutes
        });
        setShowForm(true);
    };

    const handleMapLocationSelect = async (lat, lng, placeInfo = null) => {
        // Update coordinates
        setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
        }));

        // If place info is provided (from map click on a place), use it
        if (placeInfo) {
            setFormData(prev => ({
                ...prev,
                name: placeInfo.name || prev.name,
                address: placeInfo.address || prev.address
            }));
            return;
        }

        // Otherwise, do reverse geocoding
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_GEOLOCATION_API_KEY;
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
            );
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const result = data.results[0];

                // Try to find a good name from the results
                let stationName = '';
                let fullAddress = result.formatted_address;

                // Look for point of interest, establishment, or gas station
                const nameResult = data.results.find(r =>
                    r.types.includes('point_of_interest') ||
                    r.types.includes('establishment') ||
                    r.types.includes('gas_station')
                );

                if (nameResult && nameResult.name) {
                    stationName = nameResult.name;
                } else {
                    // Extract locality/area name from address components
                    const locality = result.address_components.find(c =>
                        c.types.includes('locality') || c.types.includes('sublocality')
                    );
                    if (locality) {
                        stationName = `CNG Station - ${locality.long_name}`;
                    } else {
                        stationName = 'CNG Station';
                    }
                }

                setFormData(prev => ({
                    ...prev,
                    name: stationName,
                    address: fullAddress
                }));
            }
        } catch (error) {
            console.error('Error fetching address:', error);
            // Don't show error to user, just log it
        }
    };

    const handleDelete = async (stationId) => {
        if (!confirm('Are you sure you want to delete this station? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteDoc(doc(db, COLLECTIONS.STATIONS, stationId));
            fetchStations();
        } catch (error) {
            console.error('Error deleting station:', error);
            alert('Failed to delete station: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            stationId: generateStationId(),
            name: '',
            address: '',
            latitude: '',
            longitude: '',
            checkInRadius: 15,
            maxPhysicalVehicles: 10,
            graceWindowMinutes: 5,
            ownerPhone: '',
            ownerName: ''
        });
        setEditingStation(null);
        setShowForm(false);
        setUseMapPicker(true);
        setLoading(false);
    };

    const handleAddNewStation = () => {
        setShowForm(true);
        setFormData({
            stationId: generateStationId(),
            name: '',
            address: '',
            latitude: '',
            longitude: '',
            checkInRadius: 15,
            maxPhysicalVehicles: 10,
            graceWindowMinutes: 5,
            ownerPhone: '',
            ownerName: ''
        });
    };

    return (
        <div className="station-management">
            <div className="management-header">
                <h2>Station Management</h2>
                <button
                    type="button"
                    onClick={() => showForm ? resetForm() : handleAddNewStation()}
                    className="btn btn-primary"
                >
                    {showForm ? 'Cancel' : '+ Add New Station'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="station-form card">
                    <h3>{editingStation ? 'Edit Station' : 'Add New Station'}</h3>

                    <div className="form-grid">
                        <div className="form-group">
                            <label>Station ID *</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.stationId}
                                onChange={(e) => setFormData({ ...formData, stationId: e.target.value })}
                                required
                                placeholder="STATION_001"
                                disabled={!editingStation}
                                style={{ backgroundColor: !editingStation ? '#f3f4f6' : 'white' }}
                            />
                            {!editingStation && <small>Auto-generated unique ID</small>}
                        </div>

                        <div className="form-group">
                            <label>Station Name *</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="CNG Station - Andheri"
                            />
                            {formData.name && formData.latitude && <small style={{ color: '#10b981' }}>✓ Auto-filled from map (editable)</small>}
                        </div>

                        <div className="form-group full-width">
                            <label>Address *</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                required
                                placeholder="Andheri West, Mumbai, Maharashtra"
                            />
                            {formData.address && formData.latitude && <small style={{ color: '#10b981' }}>✓ Auto-filled from map (editable)</small>}
                        </div>

                        {/* Map Picker Toggle */}
                        <div className="form-group full-width">
                            <div className="map-toggle-container">
                                <button
                                    type="button"
                                    onClick={() => setUseMapPicker(!useMapPicker)}
                                    className="btn btn-outline btn-sm"
                                >
                                    {useMapPicker ? '✍️ Switch to Manual Entry' : '🗺️ Use Map Picker'}
                                </button>
                            </div>
                        </div>

                        {/* Map Picker Component */}
                        {useMapPicker && (
                            <div className="form-group full-width">
                                <MapLocationPicker
                                    latitude={parseFloat(formData.latitude) || null}
                                    longitude={parseFloat(formData.longitude) || null}
                                    onLocationSelect={handleMapLocationSelect}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Latitude *</label>
                            <input
                                type="number"
                                step="0.000001"
                                className="input"
                                value={formData.latitude}
                                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                required
                                placeholder="19.1234"
                            />
                        </div>

                        <div className="form-group">
                            <label>Longitude *</label>
                            <input
                                type="number"
                                step="0.000001"
                                className="input"
                                value={formData.longitude}
                                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                required
                                placeholder="72.8367"
                            />
                        </div>

                        <div className="form-group">
                            <label>Check-in Radius (meters)</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.checkInRadius}
                                onChange={(e) => setFormData({ ...formData, checkInRadius: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Max Physical Vehicles</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.maxPhysicalVehicles}
                                onChange={(e) => setFormData({ ...formData, maxPhysicalVehicles: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Grace Window (minutes)</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.graceWindowMinutes}
                                onChange={(e) => setFormData({ ...formData, graceWindowMinutes: e.target.value })}
                                required
                            />
                        </div>

                        {!editingStation && (
                            <>
                                <div className="form-group full-width" style={{ marginTop: 'var(--spacing-xl)' }}>
                                    <h4 style={{ color: 'var(--text-primary)', marginBottom: 'var(--spacing-md)' }}>Station Owner Details</h4>
                                </div>

                                <div className="form-group">
                                    <label>Owner Phone Number</label>
                                    <input
                                        type="tel"
                                        className="input"
                                        value={formData.ownerPhone}
                                        onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                                        placeholder="+91 9876543210"
                                    />
                                    <small>Owner will be created automatically</small>
                                </div>

                                <div className="form-group">
                                    <label>Owner Name</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={formData.ownerName}
                                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                                        placeholder="John Doe"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : (editingStation ? 'Update Station' : 'Create Station')}
                        </button>
                        <button type="button" onClick={resetForm} className="btn btn-outline">
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="stations-list">
                {loading && !showForm ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading stations...</p>
                    </div>
                ) : stations.length === 0 ? (
                    <div className="empty-state">
                        <p>No stations found. Add your first station!</p>
                    </div>
                ) : (
                    <div className="stations-grid">
                        {stations.map(station => (
                            <div key={station.id} className="station-item card">
                                <div className="station-item-header">
                                    <h3>{station.name}</h3>
                                    <div className="station-badges">
                                        {station.gasOn && <span className="badge success">Gas ON</span>}
                                        {station.bookingOn && <span className="badge info">Booking ON</span>}
                                    </div>
                                </div>

                                <div className="station-item-body">
                                    <p><strong>ID:</strong> {station.stationId}</p>
                                    <p><strong>Address:</strong> {station.address}</p>
                                    <p><strong>Location:</strong> {station.location.latitude}, {station.location.longitude}</p>
                                    <p><strong>Check-in Radius:</strong> {station.checkInRadius}m</p>
                                    <p><strong>Served:</strong> {station.totalVehiclesServed || 0} vehicles</p>
                                </div>

                                <div className="station-item-actions">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(station);
                                        }}
                                        className="btn btn-outline btn-sm"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(station.id);
                                        }}
                                        className="btn btn-danger btn-sm"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StationManagement;
