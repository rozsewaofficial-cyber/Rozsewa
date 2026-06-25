/**
 * Centralized email validation utility for Rozsewa.
 */

/**
 * Validates whether the given string is a correctly formatted email address.
 * 
 * @param {string} email - The email address to validate.
 * @returns {boolean} - True if valid, false otherwise.
 */
export const validateEmail = (email) => {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Sanitizes the email input by trimming outer spaces, converting all uppercase
 * letters to lowercase, and stripping interior whitespaces.
 * 
 * @param {string} email - The email input string.
 * @returns {string} - The sanitized email.
 */
export const sanitizeEmail = (email) => {
  if (!email) return "";
  return email.toLowerCase().replace(/\s/g, "");
};
