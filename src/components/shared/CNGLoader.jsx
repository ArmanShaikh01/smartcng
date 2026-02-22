// CNGLoader — CNG Nozzle Loading Component
// Replaces generic spinner with infrastructure-themed animation
import Icon from './Icon';
import './CNGLoader.css';

/**
 * @param {string}  label       - Loading message
 * @param {string}  size        - 'sm' | 'md' | 'lg'
 * @param {boolean} fullPage    - Full viewport cover (dark green bg)
 */
const CNGLoader = ({
    label = 'Loading...',
    size = 'md',
    fullPage = false,
}) => {
    const cls = [
        'cng-loader',
        size !== 'md' ? `cng-loader--${size}` : '',
        fullPage ? 'cng-loader--fullpage' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={cls} role="status" aria-label={label}>
            {/* Nozzle icon with ambient glow */}
            <div className="cng-loader__nozzle">
                <Icon name="gas" size={size === 'lg' ? 36 : size === 'sm' ? 22 : 28} />
            </div>

            {/* Pipeline track with flowing particles */}
            <div className="cng-loader__pipe" aria-hidden="true">
                <div className="cng-loader__particle" />
                <div className="cng-loader__particle" />
                <div className="cng-loader__particle" />
            </div>

            {/* Label */}
            {label && <p className="cng-loader__label">{label}</p>}
        </div>
    );
};

export default CNGLoader;
