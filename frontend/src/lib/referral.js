// Refer & Earn plumbing shared by the invite link, the signup form and the
// automatic apply after sign-in.
//
// A friend arrives through an invite link (…/login?ref=CODE). The code is kept
// here until they are signed in as a customer, whichever way they sign in
// (password, OTP, Google, Apple), and is then applied to their account. The
// server decides whether it still counts (not their own code, no completed
// order yet, no code applied before).

const PENDING_KEY = "rozsewa_pending_ref";
const DEVICE_KEY = "rozsewa_device_id";
const KEEP_MS = 30 * 24 * 60 * 60 * 1000; // an invite link stays good for 30 days

export const normalizeReferralCode = (code) =>
  String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

export const savePendingReferral = (code) => {
  const clean = normalizeReferralCode(code);
  try {
    if (!clean) localStorage.removeItem(PENDING_KEY);
    else localStorage.setItem(PENDING_KEY, JSON.stringify({ code: clean, at: Date.now() }));
  } catch { /* storage blocked: the friend can still type the code */ }
  return clean;
};

export const getPendingReferral = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    if (!saved?.code) return "";
    if (Date.now() - Number(saved.at || 0) > KEEP_MS) {
      localStorage.removeItem(PENDING_KEY);
      return "";
    }
    return saved.code;
  } catch {
    return "";
  }
};

export const clearPendingReferral = () => {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
};

/** Keeps the code from an invite link (?ref=CODE) on whatever page it opens. */
export const captureReferralFromUrl = () => {
  try {
    const code = new URLSearchParams(window.location.search).get("ref");
    return code ? savePendingReferral(code) : "";
  } catch {
    return "";
  }
};

/** A random id for this browser, used by the server's same-device check. */
export const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
};

export const inviteLink = (code) =>
  `${window.location.origin}/login?ref=${encodeURIComponent(normalizeReferralCode(code))}`;
