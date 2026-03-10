// Customer Home - Main customer interface
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { getActiveBooking } from '../utils/queueLogic';
import Navbar from '../components/shared/Navbar';
import VehicleSelection from '../components/customer/VehicleSelection';
import StationList from '../components/customer/StationList';
import BookingConfirmation from '../components/customer/BookingConfirmation';
import MyBooking from '../components/customer/MyBooking';
import './CustomerHome.css';

const CustomerHome = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [currentStep, setCurrentStep] = useState('loading'); // loading, station, vehicle, confirm, booking
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [selectedStation, setSelectedStation] = useState(null);
    const [activeBooking, setActiveBooking] = useState(null);

    // Re-run every time the user navigates TO this page (location changes)
    // This prevents stale state when React Router reuses the mounted component
    useEffect(() => {
        // Always reset to loading first — prevents blank content flash
        setCurrentStep('loading');
        setSelectedVehicle(null);
        setSelectedStation(null);
        setActiveBooking(null);
        checkActiveBooking();
    }, [user, location.key]); // location.key changes on every navigation


    const checkActiveBooking = async () => {
        if (!user) return;

        const booking = await getActiveBooking(user.uid);

        if (booking) {
            setActiveBooking(booking);
            setCurrentStep('booking');
        } else {
            setCurrentStep('station');
        }
    };

    // Station selected → go pick a vehicle
    const handleStationSelected = (station) => {
        setSelectedStation(station);
        setCurrentStep('vehicle');
    };

    // Vehicle selected → go to confirm
    const handleVehicleSelected = (vehicle) => {
        setSelectedVehicle(vehicle);
        setCurrentStep('confirm');
    };

    const handleBookingCreated = (result) => {
        checkActiveBooking();
    };

    const handleBookingCancelled = () => {
        setActiveBooking(null);
        setSelectedVehicle(null);
        setSelectedStation(null);
        setCurrentStep('station');
    };

    // Go back to vehicle picker without losing the chosen station
    const handleChangeVehicle = () => {
        setSelectedVehicle(null);
        setCurrentStep('vehicle');
    };

    const handleCancelConfirmation = () => {
        setSelectedStation(null);
        setCurrentStep('station');
    };

    if (currentStep === 'loading') {
        return (
            <div className="customer-loading">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="customer-home">
            <Navbar title="CNG Queue System" />

            <div className="customer-content">
            {/* 1. Station list — first screen after login */}
                {currentStep === 'station' && (
                    <StationList onSelectStation={handleStationSelected} />
                )}

                {/* 2. Vehicle selection — after choosing a station */}
                {currentStep === 'vehicle' && (
                    <VehicleSelection onVehicleSelected={handleVehicleSelected} />
                )}

                {/* 3. Confirm booking */}
                {currentStep === 'confirm' && selectedStation && selectedVehicle && (
                    <BookingConfirmation
                        station={selectedStation}
                        vehicleNumber={selectedVehicle}
                        onBookingCreated={handleBookingCreated}
                        onCancel={handleCancelConfirmation}
                        onChangeVehicle={handleChangeVehicle}
                    />
                )}

                {/* 4. Active booking */}
                {currentStep === 'booking' && activeBooking && (
                    <MyBooking
                        booking={activeBooking}
                        onBookingCancelled={handleBookingCancelled}
                    />
                )}
            </div>
        </div>
    );
};

export default CustomerHome;
