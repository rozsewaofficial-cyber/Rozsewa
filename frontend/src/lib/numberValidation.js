// src/lib/numberValidation.js

/**
 * Normalizes a number input to a non-negative string value.
 * Useful for filtering out invalid characters in onChange handlers.
 * @param {string|number} value - The input value.
 * @returns {string} The normalized non-negative value.
 */
export const normalizeNonNegativeNumber = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const numStr = String(value).replace(/[^0-9.]/g, '');
    const parts = numStr.split('.');
    let clean = numStr;
    if (parts.length > 2) {
        clean = parts[0] + '.' + parts.slice(1).join('');
    }
    if (/^0\d/.test(clean)) {
        clean = clean.replace(/^0+/, '');
        if (clean.startsWith('.')) {
            clean = '0' + clean;
        } else if (clean === '') {
            clean = '0';
        }
    }
    return clean;
};

/**
 * Validates if a value is a valid non-negative number.
 * @param {string|number} value - The value to validate.
 * @param {Object} options - Validation options.
 * @param {boolean} [options.allowEmpty=false] - Whether empty strings are allowed.
 * @param {number} [options.min=0] - Minimum allowed value.
 * @param {number} [options.max=Infinity] - Maximum allowed value.
 * @param {string} [options.fieldName='Value'] - Name of the field for error messages.
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export const validateNonNegativeNumber = (value, options = {}) => {
    const { allowEmpty = false, min = 0, max = Infinity, fieldName = 'Value' } = options;

    if (value === '' || value === null || value === undefined) {
        if (allowEmpty) return { isValid: true, error: null };
        return { isValid: false, error: `${fieldName} is required.` };
    }

    const num = Number(value);

    if (isNaN(num)) {
        return { isValid: false, error: `${fieldName} must be a valid number.` };
    }

    if (num < 0) {
        return { isValid: false, error: `${fieldName} cannot be negative.` };
    }

    if (num < min) {
        return { isValid: false, error: `${fieldName} must be at least ${min}.` };
    }

    if (num > max) {
        return { isValid: false, error: `${fieldName} cannot exceed ${max}.` };
    }

    return { isValid: true, error: null };
};
