/**
 * Centralized phone number validation and sanitization utility for Rozsewa.
 */

/**
 * Sanitizes phone input by accepting only numeric characters, supporting paste formatting,
 * and limiting to exactly 10 digits.
 * 
 * @param {string} value - The input value to sanitize.
 * @returns {string} - The sanitized 10-digit (max) numeric string.
 */
export const sanitizePhone = (value) => {
  if (!value) return "";
  let cleaned = value.replace(/\D/g, "");
  
  // Handle common prefixes if user pasted with country code or leading zero
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }
  
  return cleaned.slice(0, 10);
};

/**
 * Validates if the phone number has exactly 10 digits.
 * 
 * @param {string} phone - The phone number to validate.
 * @returns {object} - An object containing { isValid: boolean, message: string }
 */
export const validatePhone = (phone) => {
  if (!phone) {
    return {
      isValid: false,
      message: "Mobile number is required."
    };
  }
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length !== 10) {
    return {
      isValid: false,
      message: "Mobile number must be exactly 10 digits."
    };
  }
  return {
    isValid: true,
    message: ""
  };
};
