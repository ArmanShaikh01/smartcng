// LiveDirectionsMap — In-app live tracking map (Leaflet via CDN)
// Shows customer location → station, tracks proximity, reveals "I've Arrived" button
import { useEffect, useRef, useState } from 'react';
import { calculateDistance } from '../../hooks/useGeolocation';
import './LiveDirectionsMap.css';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// Inject Leaflet CSS + JS once, returns a Promise that resolves with the L global
const loadLeaflet = () =>
    new Promise((resolve, reject) => {
        if (window.L) { resolve(window.L); return; }

        // CSS
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = LEAFLET_CSS;
            document.head.appendChild(link);
        }

        // JS
        if (!document.getElementById('leaflet-js')) {
            const script = document.createElement('script');
            script.id = 'leaflet-js';
            script.src = LEAFLET_JS;
            script.onload = () => resolve(window.L);
            script.onerror = () => reject(new Error('Failed to load Leaflet from CDN'));
            document.head.appendChild(script);
        } else {
            // Script tag exists but L not ready — wait for it
            const check = setInterval(() => {
                if (window.L) { clearInterval(check); resolve(window.L); }
            }, 50);
        }
    });

// Hysteresis: must be this many meters INSIDE radius before triggering arrived
const ARRIVED_BUFFER = 10;
// Must exceed radius + this buffer to re-hide the arrived state (prevents flickering)
const LEAVE_BUFFER = 30;

const LiveDirectionsMap = ({ station, onArrived, onClose }) => {
    const mapRef = useRef(null);       // DOM element
    const leafletMap = useRef(null);   // Leaflet map instance
    const userMarker = useRef(null);   // Customer marker
    const stationMarker = useRef(null);
    const routeLine = useRef(null);    // Road-based route polyline
    const watchIdRef = useRef(null);
    const isFirstFix = useRef(true);   // Only fly to location on first GPS fix
    const lastRouteFetchRef = useRef(0);   // Timestamp of last OSRM fetch
    const lastFetchPosRef = useRef(null);  // Position at last OSRM fetch

    const [distance, setDistance] = useState(null);
    const [gpsError, setGpsError] = useState(null);
    const [insideRadius, setInsideRadius] = useState(false);
    const [accuracy, setAccuracy] = useState(null);
    const [mapReady, setMapReady] = useState(false);
    const insideRef = useRef(false);   // Ref copy to avoid stale closure in watchPosition

    const radius = station?.checkInRadius || 50;
    const stationLat = station?.location?.latitude;
    const stationLng = station?.location?.longitude;

    // ── Load Leaflet from CDN, then init map ─────────────────────────────
    useEffect(() => {
        if (!mapRef.current || !stationLat || !stationLng) return;
        if (leafletMap.current) return;

        loadLeaflet().then((L) => {
            if (!mapRef.current) return; // unmounted before load

            // Fix default icon paths broken by bundlers
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            const map = L.map(mapRef.current, {
                center: [stationLat, stationLng],
                zoom: 15,
                zoomControl: true,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
                maxZoom: 19,
            }).addTo(map);

            // Station marker — green ⛽
            const stationIcon = L.divIcon({
                html: `<div class="ldm-station-pin">⛽</div>`,
                className: '',
                iconSize: [40, 40],
                iconAnchor: [20, 40],
            });
            stationMarker.current = L.marker([stationLat, stationLng], { icon: stationIcon })
                .addTo(map)
                .bindPopup(`<b>${station.name}</b><br>${station.address || ''}`);

            // Draw check-in radius circle
            L.circle([stationLat, stationLng], {
                radius,
                color: '#0E7C5B',
                fillColor: '#0E7C5B',
                fillOpacity: 0.08,
                weight: 2,
                dashArray: '6 4',
            }).addTo(map);

            leafletMap.current = map;
            setMapReady(true);
            startWatching(L);
        }).catch((err) => {
            setGpsError('Failed to load map. Check your internet connection.');
            console.error(err);
        });

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            if (leafletMap.current) {
                leafletMap.current.remove();
                leafletMap.current = null;
            }
        };
    }, []); // run once

    // ── OSRM road-based route fetch ───────────────────────────────────────
    // Uses the free OSRM demo server (no API key needed)
    const fetchAndDrawRoute = async (L, userLat, userLng) => {
        const now = Date.now();
        const THROTTLE_MS = 30000; // re-fetch at most every 30s
        const MOVE_THRESHOLD_M = 20; // or if moved >20m

        const lastPos = lastFetchPosRef.current;
        const movedFar = !lastPos ||
            calculateDistance(userLat, userLng, lastPos.lat, lastPos.lng) > MOVE_THRESHOLD_M;
        const timeOk = (now - lastRouteFetchRef.current) > THROTTLE_MS;

        if (!movedFar && !timeOk) return; // throttle

        lastRouteFetchRef.current = now;
        lastFetchPosRef.current = { lat: userLat, lng: userLng };

        try {
            // OSRM public API — free, no key, uses OpenStreetMap roads
            const url = `https://router.project-osrm.org/route/v1/driving/` +
                `${userLng},${userLat};${stationLng},${stationLat}` +
                `?overview=full&geometries=geojson`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.code !== 'Ok' || !data.routes?.[0]) return;

            const coords = data.routes[0].geometry.coordinates
                .map(([lng, lat]) => [lat, lng]); // GeoJSON is [lng,lat], Leaflet wants [lat,lng]

            if (!leafletMap.current) return;

            if (routeLine.current) {
                // Update existing route — no zoom reset
                routeLine.current.setLatLngs(coords);
            } else {
                // First route draw — draw a solid blue road-style polyline
                routeLine.current = L.polyline(coords, {
                    color: '#1a73e8',   // Google/Ola blue
                    weight: 5,
                    opacity: 0.85,
                    lineJoin: 'round',
                    lineCap: 'round',
                }).addTo(leafletMap.current);

                // Casing (white border under the route for road look)
                L.polyline(coords, {
                    color: '#ffffff',
                    weight: 9,
                    opacity: 0.4,
                    lineJoin: 'round',
                    lineCap: 'round',
                }).addTo(leafletMap.current).bringToBack();
            }
        } catch (err) {
            // If OSRM fails, silently fall back — don't show error to user
            console.warn('[OSRM] Route fetch failed:', err.message);
        }
    };

    const startWatching = (L) => {
        if (!navigator.geolocation) {
            setGpsError('Geolocation is not supported by your browser.');
            return;
        }

        const onPosition = (pos) => {
            const userLat = pos.coords.latitude;
            const userLng = pos.coords.longitude;
            const acc = Math.round(pos.coords.accuracy);
            setAccuracy(acc);
            setGpsError(null);

            const dist = Math.round(calculateDistance(userLat, userLng, stationLat, stationLng));
            setDistance(dist);

            // ── Update or create user marker ──
            if (!userMarker.current && leafletMap.current) {
                const userIcon = L.divIcon({
                    html: `<div class="ldm-user-pin"></div>`,
                    className: '',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                });
                userMarker.current = L.marker([userLat, userLng], { icon: userIcon })
                    .addTo(leafletMap.current)
                    .bindPopup('You are here');
            } else if (userMarker.current) {
                // Move marker WITHOUT resetting the map view
                userMarker.current.setLatLng([userLat, userLng]);
            }

            // ── Fetch road-based route via OSRM (throttled) ──
            fetchAndDrawRoute(L, userLat, userLng);

            // ── First fix: fit both markers in view (no zoom reset after this) ──
            if (isFirstFix.current && leafletMap.current) {
                isFirstFix.current = false;
                try {
                    const bounds = L.latLngBounds([[userLat, userLng], [stationLat, stationLng]]);
                    leafletMap.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
                } catch (_) {}
            }

            // ── Proximity detection with hysteresis ──
            if (!insideRef.current && dist <= radius - ARRIVED_BUFFER) {
                insideRef.current = true;
                setInsideRadius(true);
            } else if (insideRef.current && dist > radius + LEAVE_BUFFER) {
                insideRef.current = false;
                setInsideRadius(false);
            }
        };

        const onError = (err) => {
            if (err.code === err.PERMISSION_DENIED) {
                setGpsError('Location permission denied. Please enable GPS.');
            } else {
                setGpsError('Unable to get location. Please ensure GPS is on.');
            }
        };

        watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 15000,
        });
    };

    const handleArrived = () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (leafletMap.current) {
            leafletMap.current.remove();
            leafletMap.current = null;
        }
        onArrived();
    };

    return (
        <div className="ldm-overlay">
            <div className="ldm-header">
                <div className="ldm-header-info">
                    <span className="ldm-station-name">📍 {station?.name}</span>
                    {distance !== null && (
                        <span className={`ldm-distance ${insideRadius ? 'inside' : ''}`}>
                            {distance < 1000 ? `${distance}m away` : `${(distance / 1000).toFixed(1)}km away`}
                        </span>
                    )}
                    {accuracy !== null && (
                        <span className="ldm-accuracy">GPS ±{accuracy}m</span>
                    )}
                </div>
                <button className="ldm-close-btn" onClick={onClose} title="Close map">✕</button>
            </div>

            {gpsError && (
                <div className="ldm-gps-error">⚠️ {gpsError}</div>
            )}

            {!mapReady && !gpsError && (
                <div className="ldm-loading">
                    <div className="spinner" />
                    <p>Loading map…</p>
                </div>
            )}

            {/* Map container — Leaflet renders here */}
            <div ref={mapRef} className="ldm-map" />

            {/* "I've Arrived" bottom sheet */}
            <div className={`ldm-bottom-sheet ${insideRadius ? 'visible' : ''}`}>
                <div className="ldm-arrived-badge">✅ You're within the station area!</div>
                <button className="ldm-arrived-btn" onClick={handleArrived}>
                    🏁 I've Arrived — Show Check-In
                </button>
            </div>

            {/* Hint when outside radius */}
            {!insideRadius && !gpsError && (
                <div className="ldm-footer">
                    <span>🚗 Head to the station — check-in unlocks within {radius}m</span>
                </div>
            )}
        </div>
    );
};

export default LiveDirectionsMap;

