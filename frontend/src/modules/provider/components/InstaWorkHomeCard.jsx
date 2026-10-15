import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap, ChevronRight } from "lucide-react";
import API from "@/lib/api";

/**
 * Home-page entry to Insta Work for partners and Sewaks.
 *
 * The top bar only has a small ⚡ icon, which is easy to miss. This is the
 * proper button, and it shows whether the worker is live right now. The
 * status is a convenience: if it can't be loaded the button still works.
 */
const InstaWorkHomeCard = () => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await API.get("/insta/provider/profile");
        if (alive) setProfile(data);
      } catch {
        /* status is optional */
      }
    };
    load();
    // The worker toggles Insta Work on its own screen and comes back here.
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  const live = !!profile?.enabled && !profile?.disabledByAdmin;
  const blocked = !!profile?.disabledByAdmin;

  const line = blocked
    ? "Turned off for your account"
    : live
      ? "You are live — getting nearby jobs"
      : "Go live for instant jobs nearby";

  return (
    <Link
      to="/provider/insta-work"
      data-insta-work-card
      className="group flex items-center gap-3.5 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 p-3.5 shadow-sm transition-all hover:shadow-md active:scale-[0.99] dark:border-amber-900/40 dark:from-amber-950/30 dark:to-orange-950/20"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30">
        <Zap className="h-5 w-5 fill-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-900 dark:text-white">Insta Work</span>
          {profile && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                live
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : blocked
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                    : "bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-500" : blocked ? "bg-rose-500" : "bg-slate-400"}`} />
              {live ? "Live" : blocked ? "Disabled" : "Offline"}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs font-medium text-slate-600 dark:text-slate-400">{line}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-amber-600 transition-transform group-hover:translate-x-0.5 dark:text-amber-400" />
    </Link>
  );
};

export default InstaWorkHomeCard;
