/**
 * Centralized name validation and sanitization utility for Rozsewa.
 */

/**
 * Normalizes whitespace (trims leading space and collapses multiple spaces).
 * Used during typing to keep inputs clean without aggressively stripping characters.
 * 
 * @param {string} name - The raw name input.
 * @returns {string} - Normalized name.
 */
export const sanitizeNameOnChange = (name) => {
  if (!name) return "";
  return name.replace(/^\s+/, "").replace(/\s{2,}/g, " ");
};

/**
 * Sanitizes the name input completely.
 * Trims extra whitespace, collapses multiple spaces into one,
 * and allows only alphabetic characters (including Unicode letters) and spaces.
 * Used during form submission.
 * 
 * @param {string} name - The name input.
 * @returns {string} - The fully sanitized name.
 */
export const sanitizeName = (name) => {
  if (!name) return "";
  // Allow only Unicode letters, marks, and spaces
  const cleaned = name.replace(/[^\p{L}\p{M}\s]/gu, "");
  // Collapse multiple spaces into one and trim leading/trailing
  return cleaned.replace(/\s+/g, " ").trim();
};

/**
 * Validates the name input.
 * Ensures the field is not empty and does not contain numbers or special characters.
 * 
 * @param {string} name - The name to validate.
 * @returns {object} - An object containing { isValid: boolean, message: string }
 */
export const validateName = (name) => {
  if (!name || name.trim() === "") {
    return {
      isValid: false,
      message: "Full name is required."
    };
  }

  // Reject numbers or special characters.
  // Allowed: Unicode letters, marks, and spaces.
  if (/[^\p{L}\p{M}\s]/gu.test(name)) {
    return {
      isValid: false,
      message: "Full name must only contain letters and spaces."
    };
  }

  return {
    isValid: true,
    message: ""
  };
};
