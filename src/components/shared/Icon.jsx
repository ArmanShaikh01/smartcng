/**
 * Icon.jsx — Central inline SVG icon library
 * Theme: Smart CNG — green brand, classic minimal strokes
 * All icons use stroke-based style (no fill), consistent 24x24 viewBox.
 * Usage: <Icon name="gas" size={20} color="#059669" />
 */

const icons = {
    // Station / Gas
    gas: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 6h12a1 1 0 011 1v9a2 2 0 002 2h0a2 2 0 002-2V9l-3-3M3 6v13h12V6M7 10h4M7 14h4M17 6l2 2" />
    ),
    station: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M4 21V8l8-5 8 5v13M9 21v-6h6v6M12 3v4" />
    ),

    // Navigation / Location
    mapPin: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 13 6 13s6-7.75 6-13c0-3.314-2.686-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z" />
    ),
    navigation: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    ),
    ruler: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M2 12h20M6 8v8M10 10v4M14 8v8M18 10v4" />
    ),

    // Status / Check
    checkCircle: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" />
    ),
    check: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    ),
    xCircle: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
        </>
    ),
    x: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    ),
    alertTriangle: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
    ),

    // Queue / Controls
    skipForward: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M5 4l10 8-10 8V4zM19 4v16" />
    ),
    play: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
        </>
    ),
    // Booking
    clipboardList: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" />
    ),

    // People / User
    user: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
    ),
    users: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    ),

    // Admin / Settings
    settings: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    ),
    shield: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    ),
    barChart: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M18 20V10M12 20V4M6 20v-6" />
    ),
    activity: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M22 12h-4l-3 9L9 3l-3 9H2" />
    ),

    // Misc
    home: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM9 22V12h6v10" />
    ),
    history: (
        <>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </>
    ),
    bell: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    ),
    helpCircle: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
        </>
    ),
    logOut: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    ),
    phone: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    ),
    car: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2h-2M14 17a2 2 0 100 4 2 2 0 000-4zM6 17a2 2 0 100 4 2 2 0 000-4z" />
    ),
    trash: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
    ),
    edit: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    ),
    plus: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    ),
    ban: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.93 4.93l14.14 14.14" />
        </>
    ),
    arrowRight: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
    ),
    list: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    ),
    queue: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M4 6h16M4 10h16M4 14h10M4 18h6M18 14l2 2 4-4" />
    ),
    mail: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 0l8 9 8-9" />
    ),
    eye: (
        <>
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    eyeOff: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
    ),
    checkIn: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    ),
    wifi: (
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
    ),
    suspend: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 15V9M14 15V9" />
        </>
    ),
};

/**
 * Icon component
 * @param {string} name - icon name from the icons map above
 * @param {number} size - px size (default 18)
 * @param {string} color - stroke color (default 'currentColor')
 * @param {string} className - optional extra class
 */
const Icon = ({ name, size = 18, color = 'currentColor', className = '', strokeWidth = 2 }) => {
    const paths = icons[name];
    if (!paths) return null;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            {paths}
        </svg>
    );
};

export default Icon;
