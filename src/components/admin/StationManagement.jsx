// Station Management Component - CRUD operations for stations
import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
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
        ownerName: '',
        ownerPhone: '',
    });

    useEffect(() => {
        // Real-time listener — auto-refreshes whenever a station is added/edited/deleted
        const unsubscribe = onSnapshot(
            collection(db, COLLECTIONS.STATIONS),
            (snapshot) => {
                const stationsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setStations(stationsData);
                setLoading(false);
            },
            (error) => {
                console.error('Error listening to stations:', error);
                setLoading(false);
            }
        );
        return () => unsubscribe(); // cleanup on unmount
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
            // Duplicate stationId check for new stations
            if (!editingStation) {
                const dupCheck = await getDocs(
                    query(collection(db, COLLECTIONS.STATIONS), where('stationId', '==', formData.stationId))
                );
                if (!dupCheck.empty) {
                    alert(`Station ID "${formData.stationId}" already exists! Please use a unique ID.`);
                    setLoading(false);
                    return;
                }
            }

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
                ownerName: formData.ownerName || '',
                ownerPhone: formData.ownerPhone || '',
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
                const stationRef = await addDoc(collection(db, COLLECTIONS.STATIONS), stationData);

                // Also create an owner user in Firestore so they can log in
                if (formData.ownerName && formData.ownerPhone) {
                    const ownerPhone = '+91' + formData.ownerPhone.replace(/\D/g, '').slice(-10);
                    await addDoc(collection(db, COLLECTIONS.USERS), {
                        name: formData.ownerName,
                        phoneNumber: ownerPhone,
                        role: 'owner',
                        stationId: formData.stationId,
                        createdAt: serverTimestamp()
                    });
                }

                alert('Station created successfully!');
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
        console.log('🗺️ Map clicked:', { lat, lng });
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
            console.log('🔑 API Key present:', !!apiKey);
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
            console.log('📡 Calling geocoding API...');
            const response = await fetch(url);
            const data = await response.json();
            console.log('📥 API Response:', data);

            if (data.status === 'OK' && data.results && data.results.length > 0) {
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

                console.log('✅ Auto-filling fields:', { stationName, fullAddress });
                setFormData(prev => ({
                    ...prev,
                    name: stationName,
                    address: fullAddress
                }));
            } else {
                console.error('❌ Geocoding failed:', data.status, data.error_message);
                if (data.status === 'REQUEST_DENIED') {
                    alert('⚠️ Geocoding API not enabled. Please enable it in Google Cloud Console or manually enter station details.');
                }
            }
        } catch (error) {
            console.error('❌ Error calling geocoding API:', error);
        }
    };

    const handleToggleSuspend = async (station) => {
        const isSuspended = station.isSuspended || false;
        const action = isSuspended ? 'unsuspend' : 'suspend';
        if (!confirm(`Are you sure you want to ${action} "${station.name}"?`)) {
            return;
        }

        try {
            await updateDoc(doc(db, COLLECTIONS.STATIONS, station.id), {
                isSuspended: !isSuspended,
                updatedAt: serverTimestamp()
            });
            alert(`Station ${isSuspended ? 'unsuspended' : 'suspended'} successfully!`);
        } catch (error) {
            console.error('Error updating station:', error);
            alert('Failed to update station: ' + error.message);
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
            ownerName: '',
            ownerPhone: '',
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
            ownerName: '',
            ownerPhone: '',
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
                <form onSubmit={handleSubmit} className="station-form">

                    {/* ─ Form Header ─ */}
                    <div className="station-form-header">
                        <div className="station-form-header-icon">
                            {editingStation ? '✏️' : '🏢'}
                        </div>
                        <div>
                            <h3>{editingStation ? 'Edit Station' : 'Add New Station'}</h3>
                            <p>{editingStation ? `Editing: ${editingStation.name}` : 'Fill in the details to register a new CNG station'}</p>
                        </div>
                    </div>

                    {/* ─ Form Body ─ */}
                    <div className="station-form-body">
                        <div className="form-grid">

                            {/* Station ID */}
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
                                    style={{ backgroundColor: !editingStation ? 'var(--color-neutral-50)' : '' }}
                                />
                                {!editingStation && <small>Auto-generated unique ID</small>}
                            </div>

                            {/* Station Name */}
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
                                {formData.name && formData.latitude && <small style={{ color: 'var(--color-primary-600)' }}>✓ Auto-filled from map (editable)</small>}
                            </div>

                            {/* Address */}
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
                                {formData.address && formData.latitude && <small style={{ color: 'var(--color-primary-600)' }}>✓ Auto-filled from map (editable)</small>}
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
                                    <span className="map-toggle-label">
                                        {useMapPicker ? 'Click on the map to auto-fill location' : 'Enter coordinates manually below'}
                                    </span>
                                </div>
                            </div>

                            {/* Map Component */}
                            {useMapPicker && (
                                <div className="form-group full-width">
                                    <MapLocationPicker
                                        latitude={parseFloat(formData.latitude) || null}
                                        longitude={parseFloat(formData.longitude) || null}
                                        onLocationSelect={handleMapLocationSelect}
                                    />
                                </div>
                            )}

                            {/* Lat / Lng */}
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

                            {/* Settings */}
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

                            {/* Owner Details (add only) */}
                            {!editingStation && (
                                <>
                                    <div className="form-section-title">
                                        <h4>👤 Station Owner Details</h4>
                                    </div>

                                    <div className="form-group">
                                        <label>Owner Name *</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.ownerName}
                                            onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                                            required
                                            placeholder="e.g. Rajesh Kumar"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Owner Phone *</label>
                                        <div className="phone-input-wrapper">
                                            <span className="phone-prefix">+91</span>
                                            <input
                                                type="tel"
                                                className="input"
                                                value={formData.ownerPhone}
                                                onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                                                required
                                                placeholder="9876543210"
                                                maxLength={10}
                                            />
                                        </div>
                                        <small>Enter owner's 10-digit mobile number</small>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ─ Form Footer ─ */}
                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving…' : (editingStation ? '✓ Update Station' : '+ Create Station')}
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
                                        {station.isSuspended && <span className="badge" style={{background:'#ef4444',color:'#fff'}}>🚫 Suspended</span>}
                                        {!station.isSuspended && station.gasOn && <span className="badge success">Gas ON</span>}
                                        {!station.isSuspended && station.bookingOn && <span className="badge info">Booking ON</span>}
                                    </div>
                                </div>

                                <div className="station-item-body">
                                    <p><strong>ID</strong><span className="val-id">{station.stationId}</span></p>
                                    <p><strong>Address</strong><span className="val-address">{station.address}</span></p>
                                    <p><strong>Coords</strong><span className="val-coords">{station.location.latitude.toFixed(5)}, {station.location.longitude.toFixed(5)}</span></p>
                                    <div className="station-item-stats">
                                        <div className="station-stat-chip">
                                            <span className="chip-val">{station.checkInRadius}m</span>
                                            <span className="chip-label">Check-in Radius</span>
                                        </div>
                                        <div className="station-stat-chip">
                                            <span className="chip-val">{station.totalVehiclesServed || 0}</span>
                                            <span className="chip-label">Vehicles Served</span>
                                        </div>
                                    </div>
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
                                            handleToggleSuspend(station);
                                        }}
                                        className={`btn btn-sm ${station.isSuspended ? 'btn-outline' : 'btn-danger'}`}
                                    >
                                        {station.isSuspended ? '✅ Unsuspend' : '🚫 Suspend'}
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
