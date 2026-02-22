// Map Location Picker Component - Google Maps integration for selecting station location
import { useState, useCallback, useEffect } from 'react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { useGeolocation } from '../../hooks/useGeolocation';
import './MapLocationPicker.css';

// CRITICAL: Define libraries outside component to prevent re-initialization
const libraries = ['places'];

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

    const apiKey = import.meta.env.VITE_GOOGLE_GEOLOCATION_API_KEY;

    // Use useLoadScript hook instead of LoadScript component
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: apiKey || '',
        libraries: libraries, // Required for Places API
        id: 'google-map-script' // Prevents multiple script loads
    });

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
        gestureHandling: 'greedy', // Allows map interaction without ctrl+scroll
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

    console.log('MapLocationPicker - API Key present:', !!apiKey);
    console.log('MapLocationPicker - isLoaded:', isLoaded);
    console.log('MapLocationPicker - loadError:', loadError);
    console.log('MapLocationPicker - Current position:', { latitude, longitude });
    console.log('MapLocationPicker - Marker position:', markerPosition);

    if (!apiKey) {
        return (
            <div className="map-error">
                <p>⚠️ Google Maps API key not found. Please add VITE_GOOGLE_GEOLOCATION_API_KEY to your .env file.</p>
            </div>
        );
    }

    if (loadError) {
        console.error('🗺️ Google Maps Load Error:', loadError);
        console.error('Error details:', {
            message: loadError?.message || 'Unknown error',
            type: loadError?.type || 'Unknown type',
            apiKey: apiKey ? 'Present' : 'Missing'
        });

        // Common error: Maps JavaScript API not enabled
        if (loadError?.message?.includes('ApiNotActivatedMapError') ||
            loadError?.message?.includes('Google Maps JavaScript API') ||
            loadError?.message?.includes('RefererNotAllowedMapError')) {
            console.error('⚠️ SOLUTION: Enable "Maps JavaScript API" in Google Cloud Console');
            console.error('📍 Go to: https://console.cloud.google.com/apis/library/maps-backend.googleapis.com');
        }

        return (
            <div className="map-error">
                <h4>🗺️ Google Maps Not Loading</h4>
                <p><strong>The map cannot be displayed because the Maps JavaScript API is not enabled.</strong></p>
                <div className="error-details">
                    <p className="error-reason">
                        ⚠️ Your Google Cloud project has a valid API key, but the <strong>Maps JavaScript API</strong> service is not activated.
                    </p>

                    <p><strong>🔧 Quick Fix (Takes 2 minutes):</strong></p>
                    <ol>
                        <li>
                            Open <a href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com" target="_blank" rel="noopener noreferrer">
                                <strong>Maps JavaScript API</strong> in Google Cloud Console
                            </a> (opens in new tab)
                        </li>
                        <li>Click the blue <strong>"ENABLE"</strong> button</li>
                        <li>Wait 2-5 minutes for the API to activate</li>
                        <li>Refresh this page (Ctrl+R or F5)</li>
                    </ol>

                    <div className="alternative-method">
                        <p><strong>Alternative Method:</strong></p>
                        <ol>
                            <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                            <li>Select your project: <code>smartcng-c49e1</code></li>
                            <li>Navigate to <strong>APIs & Services → Library</strong></li>
                            <li>Search for <strong>"Maps JavaScript API"</strong></li>
                            <li>Click <strong>Enable</strong></li>
                        </ol>
                    </div>

                    <p className="fallback-note">
                        💡 <strong>Can't enable the API right now?</strong><br />
                        No problem! You can still add stations using manual latitude/longitude entry below.
                        Use <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">Google Maps</a> to find coordinates.
                    </p>
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="map-loading">
                <div className="spinner"></div>
                <p>Loading Google Maps...</p>
            </div>
        );
    }

    console.log('✅ Google Maps loaded successfully!');
    console.log('Map center:', mapCenter);
    console.log('Marker position:', markerPosition);

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

            <div style={{ width: '100%', height: '400px', overflow: 'visible', position: 'relative' }}>
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
            </div>

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
