// Station List Component — enhanced with rush level badge and avg rating
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import { useGeolocation, calculateDistance } from '../../hooks/useGeolocation';
import { useRushLevel, formatHour } from '../../hooks/useRushLevel';
import { useStationQueue } from '../../hooks/useStationQueue';
import Icon from '../shared/Icon';
import './StationList.css';

// ── Per-station sub-component so each station gets its own hooks ─────────────
const StationCard = ({ station, index, isNearest, onSelectStation }) => {
    const { currentRush, bestHour, loading: rushLoading } = useRushLevel(station.stationId);
    const { queueCount, estWaitMin, loading: queueLoading } = useStationQueue(station.stationId);
    const [avgRating, setAvgRating] = useState(null);
    const [totalRatings, setTotal]  = useState(0);
    const isAvailable = station.gasOn && station.bookingOn;

    // Fetch avg rating for this station
    useEffect(() => {
        let cancelled = false;
        const fetchRatings = async () => {
            try {
                const snap = await getDocs(
                    query(collection(db, COLLECTIONS.RATINGS), where('stationId', '==', station.stationId))
                );
                let sum = 0;
                snap.forEach(d => { sum += d.data().rating || 0; });
                if (!cancelled) {
                    setAvgRating(snap.size > 0 ? +(sum / snap.size).toFixed(1) : null);
                    setTotal(snap.size);
                }
            } catch { /* non-fatal */ }
        };
        fetchRatings();
        return () => { cancelled = true; };
    }, [station.stationId]);

    const rushConfig = {
        low:    { label: 'Low Rush',    color: '#065f46', bg: '#d1fae5', emoji: '🟢' },
        medium: { label: 'Medium Rush', color: '#92400e', bg: '#fef3c7', emoji: '🟡' },
        high:   { label: 'High Rush',   color: '#991b1b', bg: '#fee2e2', emoji: '🔴' },
    };
    const rush = rushConfig[currentRush] || rushConfig.low;

    const formatDistance = (m) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
    const staggerClass = index < 6 ? `anim-delay-${index + 1}` : '';

    // Format wait time for display
    const formatWait = (min) => {
        if (min === null || min === undefined) return null;
        if (min === 0) return 'No wait';
        if (min < 60) return `~${min} min`;
        const h = Math.floor(min / 60);
        const m = min % 60;
        return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
    };

    return (
        <div
            className={`sc anim-card ${staggerClass} ${isNearest ? 'sc--nearest' : ''} ${!isAvailable ? 'sc--disabled' : ''}`}
            onClick={() => isAvailable && onSelectStation(station)}
            role="button"
            tabIndex={isAvailable ? 0 : -1}
        >
            {/* ── Top row ── */}
            <div className="sc__header">
                <div className="sc__icon">
                    <Icon name="station" size={22} color="#0E7C5B" />
                </div>
                <div className="sc__meta">
                    <h3 className="sc__name">{station.name}</h3>
                    <div className="sc__tags">
                        {isNearest && <span className="sc__tag sc__tag--nearest">Nearest</span>}
                        <span className={`sc__tag ${station.bookingOn ? 'sc__tag--open' : 'sc__tag--closed'}`}>
                            {station.bookingOn ? 'Booking Open' : 'Booking Closed'}
                        </span>
                        {/* Rush level badge */}
                        {!rushLoading && (
                            <span className="sc__tag" style={{ background: rush.bg, color: rush.color, fontWeight: 700 }}>
                                {rush.emoji} {rush.label}
                            </span>
                        )}
                    </div>
                </div>
                <span className={`sc__gas ${station.gasOn ? 'sc__gas--on' : 'sc__gas--off'}`}>
                    <Icon name="gas" size={13} />
                    {station.gasOn ? 'Gas ON' : 'Gas OFF'}
                </span>
            </div>

            {/* ── Queue Stats Bar ── */}
            {isAvailable && !queueLoading && queueCount !== null && (
                <div className="sc__queue-bar">
                    <div className="sc__queue-stat">
                        <span className="sc__queue-icon">
                            <Icon name="car" size={16} color="#6b7280" />
                        </span>
                        <div className="sc__queue-text">
                            <span className="sc__queue-val">{queueCount}</span>
                            <span className="sc__queue-lbl">in queue</span>
                        </div>
                    </div>
                    <div className="sc__queue-divider" />
                    <div className="sc__queue-stat">
                        <span className="sc__queue-icon">
                            <Icon name="clock" size={16} color="#0E7C5B" />
                        </span>
                        <div className="sc__queue-text">
                            <span className="sc__queue-val sc__queue-val--wait">{formatWait(estWaitMin)}</span>
                            <span className="sc__queue-lbl">est. wait</span>
                        </div>
                    </div>
                    {!rushLoading && (
                        <>
                            <div className="sc__queue-divider" />
                            <div className="sc__queue-stat">
                                <span className="sc__queue-icon">
                                    <Icon name="activity" size={16} color={rush.color} />
                                </span>
                                <div className="sc__queue-text">
                                    <span className="sc__queue-val" style={{ color: rush.color, fontSize: '0.7rem' }}>{rush.label}</span>
                                    <span className="sc__queue-lbl">right now</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Best time hint ── */}
            {!rushLoading && bestHour !== null && (
                <div className="sc__best-time">
                    <span>💡</span>
                    <span>Best time: <strong>{formatHour(bestHour)}</strong></span>
                </div>
            )}

            {/* ── Address ── */}
            <div className="sc__address">
                <Icon name="mapPin" size={14} color="#9ca3af" />
                <span className="sc__address-text">{station.address}</span>
            </div>

            {/* ── Directions button ── */}
            {(station.location?.latitude || station.address) && (
                <a
                    href={
                        station.location?.latitude
                            ? `https://www.google.com/maps/dir/?api=1&destination=${station.location.latitude},${station.location.longitude}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: '0.78rem', fontWeight: 600,
                        color: '#1a73e8', textDecoration: 'none',
                        padding: '5px 10px',
                        background: '#e8f0fe',
                        borderRadius: 8,
                        marginTop: 6,
                        transition: 'background 0.15s'
                    }}
                >
                    🗺️ Get Directions
                </a>
            )}

            {/* ── Footer ── */}
            <div className="sc__footer">
                <div className="sc__info">
                    {station.distance !== undefined && (
                        <span className="sc__dist">
                            <Icon name="ruler" size={13} color="#6b7280" />
                            {formatDistance(station.distance)} away
                        </span>
                    )}
                    {/* Avg rating */}
                    {avgRating !== null && (
                        <span style={{ fontSize: '0.78rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                            ⭐ {avgRating} ({totalRatings})
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
};

// ── Main StationList ──────────────────────────────────────────────────────────
const StationList = ({ onSelectStation }) => {
    const [stations, setStations]               = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [error, setError]                     = useState(null);
    const { location, error: locationError, getLocation } = useGeolocation();

    useEffect(() => {
        fetchStations();
        getLocation().catch(() => {});
    }, []);

    useEffect(() => {
        if (location && stations.length > 0) sortByDistance();
    }, [location, stations.length]);

    const fetchStations = async () => {
        try {
            const snap = await getDocs(collection(db, COLLECTIONS.STATIONS));
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => !s.isSuspended);
            setStations(data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching stations:', err);
            setError('Failed to load stations');
            setLoading(false);
        }
    };

    const sortByDistance = () => {
        setStations(prev =>
            [...prev]
                .map(s => ({
                    ...s,
                    distance: calculateDistance(
                        location.latitude, location.longitude,
                        s.location?.latitude, s.location?.longitude
                    )
                }))
                .sort((a, b) => a.distance - b.distance)
        );
    };

    if (loading) return <div className="sl-state"><div className="sl-spinner" /><p>Loading stations...</p></div>;
    if (error)   return <div className="sl-state"><Icon name="alertTriangle" size={32} color="#f59e0b" /><p>{error}</p><button type="button" onClick={fetchStations} className="sl-retry-btn">Retry</button></div>;
    if (stations.length === 0) return <div className="sl-state"><Icon name="station" size={32} color="#9ca3af" /><p>No stations available</p></div>;

    return (
        <div className="sl-container anim-page-load">
            <h2 className="sl-heading">Select CNG Station</h2>

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

            <div className="sl-grid">
                {stations.map((station, index) => (
                    <StationCard
                        key={station.id}
                        station={station}
                        index={index}
                        isNearest={index === 0 && station.distance !== undefined}
                        onSelectStation={onSelectStation}
                    />
                ))}
            </div>
        </div>
    );
};

export default StationList;
