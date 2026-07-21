/**
 * PII Filter Utility for RozSewa Bazaar
 * Detects phone numbers, emails, obfuscated numbers, address patterns, and social redirects.
 */

// Common digit words in English & Hindi transliterated
const DIGIT_WORDS_PATTERN = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ek|do|teen|chaar|panch|chhe|saat|aath|nau)\b/gi;

// Indian phone number pattern (10 digits starting with 6-9, allowing spaces, hyphens, dots, country code +91 or 0)
const PHONE_PATTERN = /(?:(?:\+?91|0)[ -]?)?[6-9]\d{2}[ -]?\d{3}[ -]?\d{4}\b/;

// Raw digit extraction: 10 or more contiguous or space-separated digits
const DIGITS_ONLY_PATTERN = /(?:\D*\d){10,}/;

// Standard email pattern
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Social media / platform bypass keywords
const SOCIAL_REDIRECT_PATTERN = /\b(whatsapp|wa\.me|insta|instagram|telegram|t\.me|facebook|fb|call me|contact me|my number|ph no|phone|mobile|pin code|pincode)\b/i;

// Address indicators (house numbers, street patterns, pin codes)
const ADDRESS_PATTERN = /\b(house no|h\.no|flat no|plot no|street|sector|block|colony|nagar|road|marg|near|opposite|opp\.|landmark|pincode|pin code)\b/i;

/**
 * Normalizes text by converting digit words to actual digits,
 * stripping common obfuscation characters like @, -, ., spaces, etc.
 */
function normalizeText(text) {
  if (!text) return '';

  const wordToDigit = {
    zero: '0', ek: '1', one: '1', do: '2', two: '2', teen: '3', three: '3',
    chaar: '4', four: '4', panch: '5', five: '5', chhe: '6', six: '6',
    saat: '7', seven: '7', aath: '8', eight: '8', nau: '9', nine: '9'
  };

  let normalized = text.toLowerCase();

  // Replace word digits with actual digits
  normalized = normalized.replace(DIGIT_WORDS_PATTERN, (match) => wordToDigit[match.toLowerCase()] || match);

  return normalized;
}

/**
 * Analyzes text for potential PII (Phone numbers, emails, addresses, social handles)
 * @param {string} text 
 * @returns {{ containsPII: boolean, type: string | null, reason: string | null }}
 */
function detectPII(text) {
  if (!text || typeof text !== 'string') {
    return { containsPII: false, type: null, reason: null };
  }

  // 1. Direct Email Check
  if (EMAIL_PATTERN.test(text)) {
    return { containsPII: true, type: 'email', reason: 'Email address detected' };
  }

  // 2. Direct Indian Phone Pattern Check
  if (PHONE_PATTERN.test(text)) {
    return { containsPII: true, type: 'phone', reason: 'Phone number detected' };
  }

  // 3. Normalized Digit Count Check (Catches obfuscated numbers like "987 654 3210" or "9.8.7.6.5.4.3.2.1.0")
  const normalized = normalizeText(text);
  const digitsOnly = normalized.replace(/\D/g, '');
  if (digitsOnly.length >= 10) {
    return { containsPII: true, type: 'phone_obfuscated', reason: 'Sequence of 10+ digits detected' };
  }

  // 4. Social Redirects / Contact Requests
  if (SOCIAL_REDIRECT_PATTERN.test(text) && /\d{4,}/.test(digitsOnly)) {
    return { containsPII: true, type: 'contact_request', reason: 'Contact request or platform redirect detected' };
  }

  // 5. Address / Location Leaks
  if (ADDRESS_PATTERN.test(text) && /\d+/.test(text)) {
    return { containsPII: true, type: 'address', reason: 'Specific address or landmark details detected' };
  }

  return { containsPII: false, type: null, reason: null };
}

module.exports = {
  detectPII,
  normalizeText
};
