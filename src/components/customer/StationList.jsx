// Station List Component
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { useGeolocation, calculateDistance } from '../../hooks/useGeolocation';
import './StationList.css';

const StationList = ({ onSelectStation }) => {
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { location, error: locationError, getLocation } = useGeolocation();
    const [locationRequested, setLocationRequested] = useState(false);

    useEffect(() => {
        fetchStations();
        requestLocation();
    }, []);

    useEffect(() => {
        if (location && stations.length > 0) {
            sortStationsByDistance();
        }
    }, [location, stations.length]);

    const requestLocation = async () => {
        try {
            setLocationRequested(true);
            await getLocation();
        } catch (err) {
            console.log('Location access denied or unavailable:', err);
            // Continue without location - stations will show unsorted
        }
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
        } catch (err) {
            console.error('Error fetching stations:', err);
            setError('Failed to load stations');
            setLoading(false);
        }
    };

    const sortStationsByDistance = () => {
        const stationsWithDistance = stations.map(station => {
            const distance = calculateDistance(
                location.latitude,
                location.longitude,
                station.location.latitude,
                station.location.longitude
            );
            return { ...station, distance };
        });

        // Sort by distance (nearest first)
        stationsWithDistance.sort((a, b) => a.distance - b.distance);
        setStations(stationsWithDistance);
    };

    const formatDistance = (meters) => {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
    };

    if (loading) {
        return (
            <div className="station-list-loading">
                <div className="spinner"></div>
                <p>Loading stations...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="station-list-error">
                <p>⚠️ {error}</p>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        fetchStations();
                    }}
                    className="btn btn-primary"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (stations.length === 0) {
        return (
            <div className="station-list-empty">
                <p>No stations available</p>
            </div>
        );
    }

    return (
        <div className="station-list-container">
            <h2>Select CNG Station</h2>

            {locationError && (
                <div className="location-notice">
                    <p>📍 Location access denied. Showing all stations.</p>
                </div>
            )}

            {location && (
                <div className="location-notice success">
                    <p>✅ Showing stations sorted by distance from your location</p>
                </div>
            )}

            <div className="station-grid">
                {stations.map((station, index) => (
                    <div
                        key={station.id}
                        className={`station-card ${!station.gasOn || !station.bookingOn ? 'disabled' : ''}`}
                        onClick={() => station.gasOn && station.bookingOn && onSelectStation(station)}
                    >
                        <div className="station-header">
                            <h3>{station.name}</h3>
                            <div className="station-status">
                                {station.gasOn ? (
                                    <span className="status-badge success">⛽ Gas ON</span>
                                ) : (
                                    <span className="status-badge danger">⛽ Gas OFF</span>
                                )}
                            </div>
                        </div>

                        <div className="station-info">
                            <p className="station-address">{station.address}</p>

                            {station.distance !== undefined && (
                                <div className="station-distance">
                                    <span className={`distance-badge ${index === 0 ? 'nearest' : ''}`}>
                                        {index === 0 ? '📍 ' : '📏 '}
                                        {formatDistance(station.distance)} away
                                        {index === 0 && ' (Nearest)'}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="station-footer">
                            {station.bookingOn ? (
                                <span className="booking-status open">📝 Booking Open</span>
                            ) : (
                                <span className="booking-status closed">📝 Booking Closed</span>
                            )}
                        </div>

                        {(!station.gasOn || !station.bookingOn) && (
                            <div className="station-overlay">
                                <p>Currently Unavailable</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StationList;
