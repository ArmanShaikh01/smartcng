// Map Location Picker Component - Google Maps integration for selecting station location
import { useState, useCallback, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { useGeolocation } from '../../hooks/useGeolocation';
import './MapLocationPicker.css';

const MapLocationPicker = ({ latitude, longitude, onLocationSelect }) => {
    const [mapCenter, setMapCenter] = useState({
        lat: latitude || 20.5937, // Default to India center
        lng: longitude || 78.9629
    });
    const [markerPosition, setMarkerPosition] = useState(
        latitude && longitude ? { lat: latitude, lng: longitude } : null
    );
    const { location, getLocation } = useGeolocation();
    const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false);

    const mapContainerStyle = {
        width: '100%',
        height: '400px',
        borderRadius: 'var(--radius-lg)'
    };

    const mapOptions = {
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
    };

    // Update map center when props change
    useEffect(() => {
        if (latitude && longitude) {
            setMapCenter({ lat: latitude, lng: longitude });
            setMarkerPosition({ lat: latitude, lng: longitude });
        }
    }, [latitude, longitude]);

    const handleMapClick = useCallback((event) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();

        setMarkerPosition({ lat, lng });
        onLocationSelect(lat, lng);
    }, [onLocationSelect]);

    const handleMarkerDragEnd = useCallback((event) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();

        setMarkerPosition({ lat, lng });
        onLocationSelect(lat, lng);
    }, [onLocationSelect]);

    const handleUseCurrentLocation = async () => {
        setLoadingCurrentLocation(true);
        try {
            const currentLocation = await getLocation();
            const lat = currentLocation.latitude;
            const lng = currentLocation.longitude;

            setMapCenter({ lat, lng });
            setMarkerPosition({ lat, lng });
            onLocationSelect(lat, lng);
        } catch (error) {
            alert('Unable to get your current location. Please ensure location permission is granted.');
        } finally {
            setLoadingCurrentLocation(false);
        }
    };

    const apiKey = import.meta.env.VITE_GOOGLE_GEOLOCATION_API_KEY;

    if (!apiKey) {
        return (
            <div className="map-error">
                <p>⚠️ Google Maps API key not found. Please add VITE_GOOGLE_GEOLOCATION_API_KEY to your .env file.</p>
            </div>
        );
    }

    return (
        <div className="map-location-picker">
            <div className="map-controls">
                <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={loadingCurrentLocation}
                    className="btn btn-outline btn-sm"
                >
                    {loadingCurrentLocation ? '📍 Getting location...' : '📍 Use My Current Location'}
                </button>
                <p className="map-hint">Click anywhere on the map to select location, or drag the marker</p>
            </div>

            <LoadScript googleMapsApiKey={apiKey}>
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={mapCenter}
                    zoom={markerPosition ? 15 : 5}
                    onClick={handleMapClick}
                    options={mapOptions}
                >
                    {markerPosition && (
                        <Marker
                            position={markerPosition}
                            draggable={true}
                            onDragEnd={handleMarkerDragEnd}
                        />
                    )}
                </GoogleMap>
            </LoadScript>

            {markerPosition && (
                <div className="selected-location-info">
                    <p>
                        <strong>Selected Location:</strong> {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
                    </p>
                </div>
            )}
        </div>
    );
};

export default MapLocationPicker;
