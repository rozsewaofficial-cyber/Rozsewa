// The language choice for the whole app, kept in this browser.
export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
];

const KEY = "rozsewa_lang";
const OLD_KEY = "rozsewa_provider_lang"; // from before the customer app had it too
export const LANGUAGE_EVENT = "rozsewa-language";

export const getLanguage = () => {
  try {
    const v = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    return LANGUAGES.some((l) => l.code === v) ? v : "en";
  } catch {
    return "en";
  }
};

export const setLanguage = (code) => {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* storage blocked: the choice lasts until reload */
  }
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: code }));
};
