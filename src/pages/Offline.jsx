import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Offline() {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(false);

    // Auto-redirect when connection is restored
    useEffect(() => {
        const handleOnline = () => {
            setChecking(true);
            setTimeout(() => navigate(-1), 800); // go back to where they were
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [navigate]);

    return (
        <div className="offline-screen">
            <div className="offline-content">
                <div className="offline-icon">⛽</div>
                <h1>You're Offline</h1>
                <p>
                    No internet connection detected.<br />
                    Please check your network and try again.
                </p>

                <button
                    className="btn btn-primary"
                    onClick={() => window.location.reload()}
                    style={{ minWidth: 180, marginTop: 8 }}
                >
                    🔄 {checking ? 'Reconnecting…' : 'Try Again'}
                </button>

                <div className="offline-status">
                    <span className="offline-dot" />
                    Waiting for connection…
                </div>
            </div>

            <style>{`
        .offline-screen {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100dvh;
          background: var(--gradient-hero);
          padding: env(safe-area-inset-top, 20px) 24px env(safe-area-inset-bottom, 20px);
        }
        .offline-content {
          text-align: center;
          max-width: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .offline-icon {
          font-size: 5rem;
          animation: offlinePulse 2s ease-in-out infinite;
          line-height: 1;
          margin-bottom: 8px;
        }
        @keyframes offlinePulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(0.92); opacity: 0.7; }
        }
        .offline-content h1 {
          font-size: 1.8rem;
          font-weight: 700;
          color: white;
          font-family: var(--font-heading);
          margin: 0;
        }
        .offline-content p {
          color: rgba(255,255,255,0.85);
          font-size: 1rem;
          line-height: 1.6;
          margin: 0;
        }
        .offline-status {
          margin-top: 20px;
          font-size: 0.8rem;
          color: rgba(255,255,255,0.55);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .offline-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #FF8C1A;
          display: inline-block;
          animation: blink 1.2s ease-in-out infinite;
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.2; }
        }
      `}</style>
        </div>
    );
}
