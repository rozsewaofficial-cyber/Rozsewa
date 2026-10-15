import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, MapPin, Clock, ChevronRight } from "lucide-react";
import API from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";

/**
 * New leads on the partner home.
 *
 * Leads used to appear only inside the Leads tab, so a partner who stayed on
 * the home page never saw one arrive. This puts the latest few in front, and
 * opens the full list for the rest. It shows nothing for a Sewak (leads are a
 * partner feature) and nothing when there are no new leads.
 */
const SHOW = 3;

const timeLeft = (seconds) => {
  if (seconds == null) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};

const LeadsHomeSection = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [blocked, setBlocked] = useState(null); // message when the wallet gate stops the list
  const timer = useRef(null);

  const isPartner = !!user && user.providerCategory !== "sewak" && user.role !== "sewak";

  const load = useCallback(async () => {
    try {
      const { data } = await API.get("/leads/nearby", { params: { tab: "available", limit: SHOW } });
      setLeads(Array.isArray(data?.leads) ? data.leads : []);
      setTotal(Number(data?.count) || 0);
      setBlocked(null);
    } catch (err) {
      setLeads([]);
      setTotal(0);
      // The wallet-minimum gate answers 403 with a reason worth showing.
      setBlocked(err.response?.status === 403 ? err.response?.data?.message || null : null);
    }
  }, []);

  useEffect(() => {
    if (!isPartner) return;
    load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [isPartner, load]);

  // A new lead arrives over the socket: refresh once for any burst of them.
  useEffect(() => {
    if (!socket || !isPartner) return;
    const refresh = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 500);
    };
    socket.on("NEW_LEAD_REQUEST", refresh);
    return () => {
      clearTimeout(timer.current);
      socket.off("NEW_LEAD_REQUEST", refresh);
    };
  }, [socket, isPartner, load]);

  if (!isPartner) return null;
  if (!leads.length && !blocked) return null;

  return (
    <section data-leads-home className="space-y-3 text-left">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
            <Briefcase className="h-4 w-4" />
          </span>
          New leads near you
          {total > 0 && (
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">{total}</span>
          )}
        </h2>
        <Link to="/provider/leads" className="flex items-center gap-0.5 text-xs font-extrabold text-primary">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {blocked ? (
        <Link
          to="/provider/wallet"
          className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
        >
          {blocked}
        </Link>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <Link
              key={lead._id}
              to="/provider/leads"
              data-lead-card={lead._id}
              className="group block rounded-2xl border border-violet-200/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md dark:border-violet-900/40"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-300">
                  {lead.categoryId?.name || "Lead"}
                </span>
                {lead.expiresIn != null && (
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-muted-foreground">
                    <Clock className="h-3 w-3" /> {timeLeft(lead.expiresIn)}
                  </span>
                )}
              </div>
              <h3 className="line-clamp-2 text-base font-black leading-snug text-foreground">
                {lead.requirementTitle || "New request"}
              </h3>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {[lead.locationDetail?.area, lead.locationDetail?.city].filter(Boolean).join(", ") || lead.distance || "Nearby"}
                  {lead.distance && lead.locationDetail?.city ? ` · ${lead.distance}` : ""}
                </span>
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs font-bold text-muted-foreground">
                  Unlock fee <span className="font-black text-foreground">₹{Number(lead.leadPrice) || 0}</span>
                </span>
                <span className="flex items-center gap-1 text-xs font-black text-violet-600 dark:text-violet-300">
                  View <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

export default LeadsHomeSection;
