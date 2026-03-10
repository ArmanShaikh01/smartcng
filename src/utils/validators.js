/**
 * Smart CNG — Shared Input Validators
 */

/**
 * Validates Indian vehicle registration number.
 * Accepted formats (spaces optional):
 *   MH 12 AB 1234  →  State(2) + RTO(2) + Series(1-3 letters) + Number(4 digits)
 * Also accepts old 2-letter series: MH12A1234
 */
export const VEHICLE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}$/;

export const validateVehicleNumber = (raw) => {
    const clean = raw.toUpperCase().replace(/[\s-]/g, '');
    if (!VEHICLE_REGEX.test(clean)) {
        return {
            valid: false,
            clean,
            error: 'Invalid format. Use Indian format, e.g. MH12AB1234'
        };
    }
    return { valid: true, clean, error: '' };
};

/**
 * Validates a 10-digit Indian mobile number.
 * Accepts: 9876543210  (just the 10 digits, without +91)
 */
export const validatePhone10 = (digits) => {
    const clean = digits.replace(/\D/g, '');
    if (clean.length !== 10) {
        return { valid: false, error: 'Please enter a valid 10-digit mobile number' };
    }
    if (!/^[6-9]/.test(clean)) {
        return { valid: false, error: 'Mobile number must start with 6, 7, 8, or 9' };
    }
    return { valid: true, normalized: '+91' + clean, error: '' };
};

/**
 * Strips only digits from a string (for phone input onChange).
 * Limits to 10 characters.
 */
export const onlyDigits10 = (val) => val.replace(/\D/g, '').slice(0, 10);
