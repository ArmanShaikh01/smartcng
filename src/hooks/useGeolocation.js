// Hook for geolocation and GPS tracking
import { useState, useEffect } from 'react';

/**
 * Hook to get user's current location
 * @param {boolean} watch - Whether to continuously watch location
 * @returns {object} Location data and error
 */
export const useGeolocation = (watch = false) => {
    const [location, setLocation] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const getLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                const errorMsg = 'Geolocation is not supported by your browser';
                setError(errorMsg);
                reject(new Error(errorMsg));
                return;
            }

            setLoading(true);

            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            const success = (position) => {
                const locationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                setLocation(locationData);
                setError(null);
                setLoading(false);
                resolve(locationData);
            };

            const errorCallback = (err) => {
                let errorMessage = 'Unable to retrieve location';

                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied. Please enable GPS.';
                        break;
                    case err.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable.';
                        break;
                    case err.TIMEOUT:
                        errorMessage = 'Location request timed out. Please try again.';
                        break;
                    default:
                        errorMessage = 'An unknown error occurred.';
                }

                setError(errorMessage);
                setLoading(false);
                reject(new Error(errorMessage));
            };

            if (watch) {
                // When watching, the promise resolves immediately with a cleanup function
                // This part is tricky because watchPosition is continuous.
                // The promise will resolve with the first position, but subsequent updates
                // will still update the state. The cleanup function is returned by the effect.
                const watchId = navigator.geolocation.watchPosition(success, errorCallback, options);
                resolve({ cleanup: () => navigator.geolocation.clearWatch(watchId) }); // Resolve with a cleanup object
            } else {
                navigator.geolocation.getCurrentPosition(success, errorCallback, options);
            }
        });
    };

    useEffect(() => {
        let cleanup;
        if (watch) {
            // If watch is true, call getLocation and handle the promise resolution
            // The promise will resolve with an object containing the cleanup function
            getLocation().then(result => {
                if (result && result.cleanup) {
                    cleanup = result.cleanup;
                }
            }).catch(err => {
                // Handle initial error if watchPosition fails immediately
                console.error("Error starting geolocation watch:", err);
            });
        }
        // Return the cleanup function for useEffect
        return () => {
            if (cleanup) {
                cleanup();
            }
        };
    }, [watch]);

    return { location, error, loading, getLocation };
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

/**
 * Validate if user is within check-in radius
 * @param {object} userLocation - {latitude, longitude, accuracy}
 * @param {object} stationLocation - {latitude, longitude}
 * @param {number} radiusMeters - Check-in radius (default 15m)
 * @returns {object} {isValid, distance, accuracy}
 */
export const validateCheckIn = (userLocation, stationLocation, radiusMeters = 15) => {
    const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        stationLocation.latitude,
        stationLocation.longitude
    );

    const isValid = distance <= radiusMeters;

    return {
        isValid,
        distance: Math.round(distance),
        accuracy: userLocation.accuracy || null
    };
};
