import API from "@/lib/api";

// Where uploaded media lives: the API server's own origin. A relative image
// path used to be prefixed with http://localhost:5000, which only ever worked
// on a developer's machine.
export const mediaUrl = (url) => {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  try {
    const origin = new URL(API.defaults.baseURL, window.location.origin).origin;
    return `${origin}/${String(url).replace(/^\//, "")}`;
  } catch {
    return url;
  }
};

const SEEN_KEY = "rozsewa_banner_seen";
const CLICK_KEY = "rozsewa_banner_click";
const CLICK_TTL_MS = 24 * 60 * 60 * 1000;

const readSeen = () => {
  try { return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); }
};

/**
 * Counts a partner banner as seen once per visit, when it is actually on
 * screen — not every time the home page fetches its list.
 */
export const reportBannerSeen = (bannerId) => {
  if (!bannerId) return;
  const seen = readSeen();
  if (seen.has(bannerId)) return;
  seen.add(bannerId);
  try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* storage unavailable */ }
  API.post("/public/provider-banners/impressions", { ids: [bannerId] }).catch(() => {});
};

/** Remembers the banner a customer tapped, so a booking with that partner can be credited to it. */
export const rememberBannerClick = (bannerId, providerId) => {
  if (!bannerId || !providerId) return;
  try {
    sessionStorage.setItem(CLICK_KEY, JSON.stringify({ bannerId, providerId: String(providerId), at: Date.now() }));
  } catch { /* storage unavailable */ }
};

/** The banner to credit for a booking with this partner, if the customer came from one recently. */
export const bannerIdForBooking = (providerId) => {
  if (!providerId) return undefined;
  try {
    const c = JSON.parse(sessionStorage.getItem(CLICK_KEY) || "null");
    if (c && c.providerId === String(providerId) && Date.now() - c.at < CLICK_TTL_MS) return c.bannerId;
  } catch { /* ignore */ }
  return undefined;
};
