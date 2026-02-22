// Station List Component
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { useGeolocation, calculateDistance } from '../../hooks/useGeolocation';
import Icon from '../shared/Icon';
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
        }
    };

    const fetchStations = async () => {
        try {
            const stationsSnapshot = await getDocs(collection(db, COLLECTIONS.STATIONS));
            const stationsData = stationsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(s => !s.isSuspended);
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
                location.latitude, location.longitude,
                station.location.latitude, station.location.longitude
            );
            return { ...station, distance };
        });
        stationsWithDistance.sort((a, b) => a.distance - b.distance);
        setStations(stationsWithDistance);
    };

    const formatDistance = (meters) => {
        if (meters < 1000) return `${Math.round(meters)} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    };

    if (loading) {
        return (
            <div className="sl-state">
                <div className="sl-spinner" />
                <p>Loading stations...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="sl-state">
                <Icon name="alertTriangle" size={32} color="#f59e0b" />
                <p>{error}</p>
                <button type="button" onClick={fetchStations} className="sl-retry-btn">
                    Retry
                </button>
            </div>
        );
    }

    if (stations.length === 0) {
        return (
            <div className="sl-state">
                <Icon name="station" size={32} color="#9ca3af" />
                <p>No stations available</p>
            </div>
        );
    }

    return (
        <div className="sl-container anim-page-load">
            <h2 className="sl-heading">Select CNG Station</h2>

            {/* Location banner */}
            {location && (
                <div className="sl-banner success anim-fade-in">
                    <Icon name="mapPin" size={14} color="#0E7C5B" />
                    <span>Showing stations sorted by distance from your location</span>
                </div>
            )}
            {locationError && !location && (
                <div className="sl-banner warning anim-fade-in">
                    <Icon name="alertTriangle" size={14} color="#b45309" />
                    <span>Location unavailable. Showing all stations.</span>
                </div>
            )}

            {/* Station cards grid */}
            <div className="sl-grid">
                {stations.map((station, index) => {
                    const isAvailable = station.gasOn && station.bookingOn;
                    const isNearest = index === 0 && station.distance !== undefined;
                    // Stagger delay capped at 6 cards (360ms max)
                    const staggerClass = index < 6 ? `anim-delay-${index + 1}` : '';

                    return (
                        <div
                            key={station.id}
                            className={`sc anim-card ${staggerClass} ${isNearest ? 'sc--nearest' : ''} ${!isAvailable ? 'sc--disabled' : ''}`}
                            onClick={() => isAvailable && onSelectStation(station)}
                            role="button"
                            tabIndex={isAvailable ? 0 : -1}
                        >
                            {/* ── Top row: icon | name+tags | gas badge ── */}
                            <div className="sc__header">
                                {/* Left: icon */}
                                <div className="sc__icon">
                                    <Icon name="station" size={22} color="#0E7C5B" />
                                </div>

                                {/* Center: name + tags */}
                                <div className="sc__meta">
                                    <h3 className="sc__name">{station.name}</h3>
                                    <div className="sc__tags">
                                        {isNearest && (
                                            <span className="sc__tag sc__tag--nearest">
                                                Nearest
                                            </span>
                                        )}
                                        <span className={`sc__tag ${station.bookingOn ? 'sc__tag--open' : 'sc__tag--closed'}`}>
                                            {station.bookingOn ? 'Booking Open' : 'Booking Closed'}
                                        </span>
                                    </div>
                                </div>

                                {/* Right: gas badge */}
                                <span className={`sc__gas ${station.gasOn ? 'sc__gas--on' : 'sc__gas--off'}`}>
                                    <Icon name="gas" size={13} />
                                    {station.gasOn ? 'Gas ON' : 'Gas OFF'}
                                </span>
                            </div>

                            {/* ── Address row ── */}
                            <div className="sc__address">
                                <Icon name="mapPin" size={14} color="#9ca3af" />
                                <span className="sc__address-text">{station.address}</span>
                            </div>

                            {/* ── Footer: distance + select button ── */}
                            <div className="sc__footer">
                                <div className="sc__info">
                                    {station.distance !== undefined && (
                                        <span className="sc__dist">
                                            <Icon name="ruler" size={13} color="#6b7280" />
                                            {formatDistance(station.distance)} away
                                        </span>
                                    )}
                                </div>

                                {isAvailable ? (
                                    <button
                                        className="sc__btn"
                                        tabIndex={-1}
                                        onClick={(e) => { e.stopPropagation(); onSelectStation(station); }}
                                    >
                                        Select
                                        <Icon name="arrowRight" size={15} color="white" />
                                    </button>
                                ) : (
                                    <span className="sc__unavailable">
                                        <Icon name="ban" size={14} color="#9ca3af" />
                                        Unavailable
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StationList;
