import { useCallback, useEffect, useRef, useState } from "react";
import API from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/**
 * Keeps a partner's saved location current without them doing anything.
 *
 * It used to be saved only by a button (Sync GPS) or by Edit → Update location
 * → Save, so a partner who never found them had no location at all — and a
 * partner with no location is never matched for leads or nearby bookings.
 *
 * Runs once when a signed-in partner opens the app (at most every 30 minutes
 * per browser session), and on demand through `refresh`. It saves only when
 * the saved point is missing or the partner has moved, and never nags: a
 * refused permission is reported through `error`, not a pop-up.
 */
const MIN_MOVE_KM = 0.2;
const RECHECK_MS = 30 * 60 * 1000;
const STAMP_KEY = "rozsewa_auto_location_at";

const km = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const savedPoint = (user) => {
  const c = user?.location?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const [lng, lat] = c.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
};

const messageFor = (err) =>
  err?.code === 1
    ? "Location permission is off. Allow it in your browser or phone settings."
    : err?.code === 2
      ? "Location is unavailable. Check that GPS is on."
      : "Location took too long. Please try again.";

export default function useProviderAutoLocation({ auto = true } = {}) {
  const { user, updateUser } = useAuth();
  // idle | detecting | saved | unchanged | error
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  const refresh = useCallback(async ({ force = false } = {}) => {
    if (busy.current) return null;
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("This device does not support location.");
      return null;
    }
    busy.current = true;
    setStatus("detecting");
    setError("");
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5 * 60 * 1000,
        })
      );
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const before = savedPoint(userRef.current);
      if (!force && before && km(before, here) < MIN_MOVE_KM) {
        setStatus("unchanged");
        return { changed: false, ...here };
      }
      const location = { type: "Point", coordinates: [here.lng, here.lat] };
      await API.put("/provider/profile", { location });
      updateUser({ location });
      setStatus("saved");
      return { changed: true, ...here };
    } catch (err) {
      setStatus("error");
      setError(err?.code ? messageFor(err) : err?.response?.data?.message || "Could not save your location.");
      return null;
    } finally {
      busy.current = false;
    }
  }, [updateUser]);

  const isProvider = !!user && (user.role === "provider" || user.role === "sewak" || user.providerCategory);

  useEffect(() => {
    if (!auto || !isProvider) return;
    try {
      const last = Number(sessionStorage.getItem(STAMP_KEY) || 0);
      // A partner with no location is always retried; the throttle is only
      // for keeping a known location fresh.
      if (savedPoint(userRef.current) && Date.now() - last < RECHECK_MS) return;
      sessionStorage.setItem(STAMP_KEY, String(Date.now()));
    } catch {
      /* storage blocked: just run */
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, isProvider]);

  return { status, error, refresh, hasLocation: !!savedPoint(user) };
}
