import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Bell, Camera, Check, ShieldAlert, Loader2, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

/**
 * What the partner app needs the phone's permission for, in one place: the
 * state of each, and one tap to allow it.
 *
 * `granted`  allowed.
 * `prompt`   not asked yet: the Allow button asks.
 * `denied`   blocked: a page cannot ask again, so it says where to switch it on.
 */
const ITEMS = [
  { key: "location", icon: MapPin, title: "Location", why: "To get requests and leads near you." },
  { key: "notifications", icon: Bell, title: "Notifications", why: "To hear about new requests and reminders." },
  { key: "camera", icon: Camera, title: "Camera", why: "For your live profile photo." },
];

const read = async (key) => {
  try {
    if (key === "notifications") {
      if (!("Notification" in window)) return "unsupported";
      return Notification.permission === "default" ? "prompt" : Notification.permission;
    }
    if (!navigator.permissions?.query) return "prompt";
    const status = await navigator.permissions.query({ name: key === "camera" ? "camera" : "geolocation" });
    return status.state; // granted | prompt | denied
  } catch {
    return "prompt";
  }
};

export const usePermissions = () => {
  const [state, setState] = useState({ location: "prompt", notifications: "prompt", camera: "prompt" });
  const refresh = useCallback(async () => {
    const [location, notifications, camera] = await Promise.all(ITEMS.map((i) => read(i.key)));
    setState({ location, notifications, camera });
  }, []);
  useEffect(() => {
    refresh();
    // Coming back from the phone's settings page.
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);
  return { state, refresh };
};

const WHERE_TO_ENABLE = "It is blocked. Open your browser or phone Settings → this app/site → Permissions, switch it on, then come back.";

const PermissionsCard = ({ onAllowLocation, onAllowNotifications }) => {
  const { toast } = useToast();
  const { state, refresh } = usePermissions();
  const [busy, setBusy] = useState(null);

  const allow = async (key) => {
    setBusy(key);
    try {
      if (key === "location") {
        await onAllowLocation?.();
      } else if (key === "notifications") {
        if ("Notification" in window) await Notification.requestPermission();
        await onAllowNotifications?.();
      } else if (key === "camera") {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      /* a refusal shows up as a state, below */
    } finally {
      await refresh();
      setBusy(null);
    }
    const after = await read(key);
    if (after === "denied") toast({ title: "Permission is blocked", description: WHERE_TO_ENABLE, variant: "destructive" });
  };

  const needing = ITEMS.filter((i) => state[i.key] === "prompt");
  const allowAll = async () => { for (const i of needing) await allow(i.key); };

  return (
    <section id="permissions" className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-permissions-card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">App permissions</h2>
          <p className="text-xs font-medium text-muted-foreground">Switch these on so requests reach you and everything works.</p>
        </div>
        {needing.length > 1 && (
          <button type="button" onClick={allowAll} disabled={!!busy} className="shrink-0 rounded-xl bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground disabled:opacity-60">
            Allow all
          </button>
        )}
      </div>

      <ul className="divide-y divide-border/60">
        {ITEMS.map(({ key, icon: Icon, title, why }) => {
          const s = state[key];
          return (
            <li key={key} className="flex items-center gap-3 py-3" data-permission={key} data-state={s}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s === "granted" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40" : s === "denied" ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40" : "bg-muted text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{title}</p>
                <p className="text-[11px] font-medium leading-snug text-muted-foreground">
                  {s === "denied" ? WHERE_TO_ENABLE : s === "unsupported" ? "This device does not support it." : why}
                </p>
              </div>
              {s === "granted" ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Check className="h-3 w-3" /> On
                </span>
              ) : s === "denied" ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  <ShieldAlert className="h-3 w-3" /> Blocked
                </span>
              ) : s === "unsupported" ? null : (
                <button type="button" onClick={() => allow(key)} disabled={!!busy} data-allow={key} className="flex shrink-0 items-center gap-1 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary disabled:opacity-60">
                  {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Allow
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

/** A one-line nudge on the home page while location or notifications are off. */
export const PermissionsBanner = () => {
  const { state } = usePermissions();
  const off = [
    state.location !== "granted" && state.location !== "unsupported" ? "location" : null,
    state.notifications !== "granted" && state.notifications !== "unsupported" ? "notifications" : null,
  ].filter(Boolean);
  if (!off.length) return null;
  return (
    <Link
      to="/provider/profile#permissions"
      data-permissions-banner
      className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-left dark:border-amber-900/40 dark:bg-amber-950/20"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"><ShieldAlert className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-foreground">Turn on {off.join(" and ")}</span>
        <span className="block text-[11px] font-medium text-muted-foreground">You may miss requests without it. Tap to allow.</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-amber-600" />
    </Link>
  );
};

export default PermissionsCard;
