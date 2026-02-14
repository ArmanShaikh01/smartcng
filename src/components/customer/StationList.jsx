// Station List Component
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { COLLECTIONS } from '../../firebase/firestore';
import './StationList.css';

const StationList = ({ onSelectStation }) => {
    const [stations, setStations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchStations();
    }, []);

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
            <div className="station-grid">
                {stations.map(station => (
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
