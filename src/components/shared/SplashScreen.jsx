import { useEffect, useState, useRef } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const screenRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onComplete, 800); // Allow fade-out animation to finish
        }, 2500);

        const handleMouseMove = (e) => {
            const { clientX, clientY } = e;
            const { innerWidth, innerHeight } = window;
            const x = (clientX / innerWidth - 0.5) * 20;
            const y = (clientY / innerHeight - 0.5) * 20;
            setMousePos({ x, y });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [onComplete]);

    return (
        <div className={`splash-screen ${!isVisible ? 'fade-out' : ''}`} ref={screenRef}>
            <div className="splash-bg">
                <div className="bg-circles">
                    <div className="circle circle-1"></div>
                    <div className="circle circle-2"></div>
                    <div className="circle circle-3"></div>
                </div>
            </div>
            
            <div 
                className="splash-content"
                style={{
                    transform: `translate(${mousePos.x}px, ${mousePos.y}px)`
                }}
            >
                <div className="splash-logo-wrapper">
                    <img 
                        src="/smartcng-logo.jpeg" 
                        alt="Smart CNG Logo" 
                        className="splash-logo"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="logo-glow"></div>
                </div>
                
                <h1 className="splash-title">
                    Smart <span>CNG</span>
                </h1>
                <p className="splash-subtitle">Digital Queue Management</p>
                
                <div className="splash-loader">
                    <div className="loader-bar"></div>
                </div>
            </div>

            <div className="splash-footer">
                <p>© 2026 Smart CNG Station</p>
            </div>
        </div>
    );
};

export default SplashScreen;
