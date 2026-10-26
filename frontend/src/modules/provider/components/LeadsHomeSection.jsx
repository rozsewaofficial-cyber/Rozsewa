import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, MapPin, Clock, ChevronRight, Check, X, Loader2 } from "lucide-react";
import API from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useToast } from "@/components/ui/use-toast";

/**
 * New leads on the partner home, with Accept and Reject on each one, like the
 * booking and Insta Work requests next to them.
 *
 * Accept unlocks the lead (a free service, the wallet, or, when the wallet
 * cannot cover it, the payment step on the Leads page). Reject turns it down
 * for good: it is not offered to this partner again.
 *
 * Nothing shows for a Sewak (leads are a partner feature) or when there are no
 * new leads.
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
  const { socket, incomingLeadRequest, setIncomingLeadRequest, stopAlarmSound } = useSocket();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [blocked, setBlocked] = useState(null); // why the wallet gate stops the list
  const [asking, setAsking] = useState(null); // { id, kind: 'accept' | 'reject' }
  const [busy, setBusy] = useState(null); // lead id being answered
  const sending = useRef(false);
  const timer = useRef(null);

  const isPartner = !!user && user.providerCategory !== "sewak" && user.role !== "sewak";

  const load = useCallback(async () => {
    try {
      // A lead still open to others (several partners may unlock it) stays in
      // this list after this partner has unlocked it; it is theirs already, so
      // it is not offered again here. Asking for a few extra keeps three to show.
      const { data } = await API.get("/leads/nearby", { params: { tab: "available", limit: SHOW + 6 } });
      const all = Array.isArray(data?.leads) ? data.leads : [];
      const open = all.filter((l) => !l.isUnlocked);
      setLeads(open.slice(0, SHOW));
      setTotal(Math.max(open.length, (Number(data?.count) || 0) - (all.length - open.length)));
      setBlocked(null);
    } catch (err) {
      setLeads([]);
      setTotal(0);
      // The wallet-minimum gate answers 403 with a reason worth showing.
      setBlocked(err.response?.status === 403 ? err.response?.data?.message || null : null);
    }
  }, []);

  useEffect(() => {
    if (!isPartner) return undefined;
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
    if (!socket || !isPartner) return undefined;
    const refresh = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 500);
    };
    socket.on("NEW_LEAD_REQUEST", refresh);
    // Someone else unlocking a lead (or a lead closing) is announced as a lead
    // notification; the list should drop it rather than offer it until the
    // next focus.
    const onNotification = (e) => { if (e.detail?.type === "lead") refresh(); };
    window.addEventListener("NEW_NOTIFICATION", onNotification);
    return () => {
      clearTimeout(timer.current);
      socket.off("NEW_LEAD_REQUEST", refresh);
      window.removeEventListener("NEW_NOTIFICATION", onNotification);
    };
  }, [socket, isPartner, load]);

  const answer = async (lead, kind) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(lead._id);
    try {
      if (kind === "reject") {
        await API.post(`/leads/${lead._id}/decline`);
        toast({ title: "Lead declined", description: "It will not be shown to you again." });
      } else {
        await API.post(`/leads/${lead._id}/unlock`);
        toast({ title: "Lead unlocked", description: "The customer's details are open in My Unlocked." });
        window.dispatchEvent(new CustomEvent("WALLET_UPDATED"));
      }
    } catch (err) {
      if (kind === "accept" && err.response?.status === 402 && err.response?.data?.paymentRequired) {
        // Not enough in the wallet: the payment step is on the Leads page.
        toast({ title: "Payment needed", description: `Pay ₹${err.response.data.leadPrice ?? lead.leadPrice} to unlock this lead.` });
        navigate(`/provider/leads?unlock=${lead._id}`);
        return;
      }
      toast({
        title: kind === "reject" ? "Could not decline" : "Could not unlock",
        description: err.response?.data?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      sending.current = false;
      setBusy(null);
      setAsking(null);
      // Answered here: the "new lead" alert for this same lead has done its job.
      if (incomingLeadRequest && String(incomingLeadRequest.leadId) === String(lead._id)) {
        try { stopAlarmSound?.(); } catch (e) { /* no sound to stop */ }
        sessionStorage.removeItem('activeLeadRequest');
        setIncomingLeadRequest?.(null);
      }
      load();
    }
  };

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
          {leads.map((lead) => {
            const fee = Number(lead.leadPrice) || 0;
            const ask = asking?.id === lead._id ? asking.kind : null;
            const working = busy === lead._id;
            return (
              <div
                key={lead._id}
                data-lead-card={lead._id}
                className="overflow-hidden rounded-2xl border border-violet-200/70 bg-card shadow-sm transition-shadow hover:shadow-md dark:border-violet-900/40"
              >
                <Link to="/provider/leads" className="group block p-4">
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
                  <p className="mt-3 text-xs font-bold text-muted-foreground">
                    Unlock fee <span className="font-black text-foreground">{fee > 0 ? `₹${fee}` : "Free"}</span>
                    {fee === 0 && <span className="ml-1 font-medium">(uses 1 free service)</span>}
                  </p>
                </Link>

                <div className="border-t border-border p-3" data-lead-actions>
                  {ask ? (
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 text-xs font-bold text-foreground">
                        {ask === "accept"
                          ? (fee > 0 ? `Unlock for ₹${fee}?` : "Unlock using 1 free service?")
                          : "Decline this lead?"}
                      </p>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => setAsking(null)}
                        className="h-10 rounded-xl border border-border bg-background px-3.5 text-xs font-black text-foreground disabled:opacity-50"
                      >
                        No
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        data-lead-confirm={ask}
                        onClick={() => answer(lead, ask)}
                        className={`flex h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-black text-white disabled:opacity-60 ${ask === "accept" ? "bg-emerald-600" : "bg-rose-600"}`}
                      >
                        {working && <Loader2 className="h-4 w-4 animate-spin" />} Yes
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        data-lead-reject
                        disabled={working}
                        onClick={() => setAsking({ id: lead._id, kind: "reject" })}
                        className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-black uppercase tracking-wider text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
                      >
                        <X className="h-4 w-4" /> Reject
                      </button>
                      <button
                        type="button"
                        data-lead-accept
                        disabled={working}
                        onClick={() => setAsking({ id: lead._id, kind: "accept" })}
                        className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-black uppercase tracking-wider text-white shadow-sm shadow-emerald-600/25 transition-colors hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" /> Accept
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default LeadsHomeSection;
