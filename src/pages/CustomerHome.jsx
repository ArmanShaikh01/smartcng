// Customer Home - Main customer interface
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getActiveBooking } from '../utils/queueLogic';
import Navbar from '../components/shared/Navbar';
import VehicleSelection from '../components/customer/VehicleSelection';
import StationList from '../components/customer/StationList';
import BookingConfirmation from '../components/customer/BookingConfirmation';
import MyBooking from '../components/customer/MyBooking';
import './CustomerHome.css';

const CustomerHome = () => {
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState('loading'); // loading, vehicle, station, confirm, booking
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [selectedStation, setSelectedStation] = useState(null);
    const [activeBooking, setActiveBooking] = useState(null);

    useEffect(() => {
        checkActiveBooking();
    }, [user]);

    const checkActiveBooking = async () => {
        if (!user) return;

        const booking = await getActiveBooking(user.uid);

        if (booking) {
            setActiveBooking(booking);
            setCurrentStep('booking');
        } else {
            setCurrentStep('vehicle');
        }
    };

    const handleVehicleSelected = (vehicle) => {
        setSelectedVehicle(vehicle);
        setCurrentStep('station');
    };

    const handleStationSelected = (station) => {
        setSelectedStation(station);
        setCurrentStep('confirm');
    };

    const handleBookingCreated = (result) => {
        checkActiveBooking();
    };

    const handleBookingCancelled = () => {
        setActiveBooking(null);
        setSelectedVehicle(null);
        setSelectedStation(null);
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
                {currentStep === 'vehicle' && (
                    <VehicleSelection onVehicleSelected={handleVehicleSelected} />
                )}

                {currentStep === 'station' && (
                    <StationList onSelectStation={handleStationSelected} />
                )}

                {currentStep === 'confirm' && selectedStation && selectedVehicle && (
                    <BookingConfirmation
                        station={selectedStation}
                        vehicleNumber={selectedVehicle}
                        onBookingCreated={handleBookingCreated}
                        onCancel={handleCancelConfirmation}
                    />
                )}

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
