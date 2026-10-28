import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import API from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/**
 * Keeps a worker visible to customers while Insta Work is on.
 *
 * Matching treats a position older than a few minutes as "app closed", so a
 * worker who switched Insta Work on and then went to another screen (or just
 * used the rest of the app) dropped off the customer's list after five
 * minutes, even though they were online. The ping used to be sent only from
 * the Insta Work screen itself; this sends it from anywhere in the partner
 * app, and again the moment the app comes back to the front.
 */
const PING_EVERY_MS = 60 * 1000;
const RECHECK_EVERY_MS = 5 * 60 * 1000;

const InstaPresence = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isWorker = user?.role === "provider" || user?.role === "sewak";
  // The Insta Work screen sends its own pings and shows the location error.
  const onOwnScreen = pathname.startsWith("/provider/insta-work");

  useEffect(() => {
    if (!isWorker || onOwnScreen || !user?.token) return undefined;

    let live = true;
    let enabled = false;
    let pingTimer = null;
    let recheckTimer = null;

    const ping = () => {
      if (!enabled || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          API.post("/insta/provider/ping", { lat: pos.coords.latitude, lng: pos.coords.longitude }).catch(() => {});
        },
        () => { /* permission or signal: the Permissions card tells the partner */ },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
      );
    };

    const check = async () => {
      try {
        const { data } = await API.get("/insta/provider/profile");
        if (!live) return;
        enabled = !!data?.enabled;
        if (enabled) ping();
      } catch {
        /* not a worker with Insta Work, or offline: nothing to keep alive */
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") check(); };

    check();
    pingTimer = setInterval(ping, PING_EVERY_MS);
    recheckTimer = setInterval(check, RECHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearInterval(pingTimer);
      clearInterval(recheckTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isWorker, onOwnScreen, user?.token]);

  return null;
};

export default InstaPresence;
