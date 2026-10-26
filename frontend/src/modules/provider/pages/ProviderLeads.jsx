import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Briefcase,
  MapPin,
  Calendar,
  Clock,
  Lock,
  Unlock,
  RefreshCcw,
  AlertTriangle,
  FileText,
  ArrowRight,
  Phone,
  IndianRupee,
  Wallet,
  CheckCircle2,
  Eye,
  Sparkles,
  Shield,
  Mail,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";

// Booking times offered when turning a lead into a booking (hh:mm AM/PM,
// the format the Bookings screens read), 6 AM to 11 PM.
const BOOKING_TIMES = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6;
  return `${String(h % 12 || 12).padStart(2, "0")}:00 ${h < 12 ? "AM" : "PM"}`;
});
const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// ─── Status Badge Config ──────────────────────────────────────────────────────
const STATUS = {
  available: {
    label: "Available",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  partially_unlocked: {
    label: "Partially Open",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  fully_unlocked: {
    label: "Fully Taken",
    color: "bg-slate-100 text-slate-600 border-slate-200",
  },
  expired: {
    label: "Expired",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  closed: {
    label: "Closed",
    color: "bg-slate-50 text-slate-400 border-slate-100",
  },
  disputed: {
    label: "Disputed",
    color: "bg-red-50 text-red-700 border-red-200",
  },
};

// ─── Expiry Countdown ─────────────────────────────────────────────────────────
const ExpiryCountdown = ({ expiry }) => {
  const [timeLeft, setTimeLeft] = useState(
    Math.max(0, new Date(expiry) - Date.now()),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, new Date(expiry) - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [expiry]);

  if (timeLeft === 0)
    return <span className="text-[9px] text-rose-500 font-bold">Expired</span>;
  const h = Math.floor(timeLeft / 3600000);
  const m = Math.floor((timeLeft % 3600000) / 60000);
  const label = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  const urgent = timeLeft < 2 * 3600000;
  return (
    <span
      className={`text-[9px] font-bold flex items-center gap-1 ${urgent ? "text-rose-500" : "text-slate-400"}`}
    >
      <Clock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
};

// ─── Meeting OTP ──────────────────────────────────────────────────────────────
// The customer sees a 4-digit code in My Leads and gives it to the partner when
// they meet. Typing it here confirms the meeting.
const MeetOtpBox = ({ leadId, onVerified }) => {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);

  const verify = async (e) => {
    e.preventDefault();
    if (sending.current) return;
    if (!/^\d{4}$/.test(otp)) { setError("Enter the 4-digit OTP the customer gives you."); return; }
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await API.post(`/leads/${leadId}/verify-otp`, { otp });
      toast({ title: "Meeting confirmed", description: "The customer has been told you met." });
      onVerified?.();
    } catch (err) {
      setError(err.response?.data?.message || "Could not verify the OTP. Please try again.");
      setOtp("");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={verify} className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-950/20" data-meet-otp>
      <p className="text-[10px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">Met the customer?</p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">Ask them for the 4-digit OTP in their My Leads, and enter it here.</p>
      <div className="mt-2 flex gap-2">
        <input
          value={otp}
          onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          placeholder="• • • •"
          aria-label="Customer OTP"
          className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-center text-lg font-black tracking-[0.5em] text-slate-900 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <button type="submit" disabled={busy || otp.length !== 4} className="h-11 shrink-0 rounded-xl bg-violet-600 px-4 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11px] font-bold text-rose-600" role="alert">{error}</p>}
    </form>
  );
};

// ─── Lead Card ────────────────────────────────────────────────────────────────
const LeadCard = ({ lead, onUnlock, onDispute, onBook, onRefresh }) => {
  const conf = STATUS[lead.status] || STATUS.available;
  const isUnlocked = lead.isUnlocked;

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      {/* Top section */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">
            #{lead._id?.substring(lead._id.length - 6).toUpperCase()}
          </span>
          <span
            className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${conf.color}`}
          >
            {conf.label}
          </span>
          {lead.distance && (
            <span className="text-[9px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-100 uppercase tracking-widest flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" />
              {lead.distance}
            </span>
          )}
          {isUnlocked && (
            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-widest flex items-center gap-1">
              <Unlock className="h-2.5 w-2.5" /> Unlocked
            </span>
          )}
          {lead.categoryId?.name && (
            <span className="text-[9px] font-black text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase tracking-widest">
              {lead.categoryId.name}
            </span>
          )}
        </div>

        {/* Title and schedule */}
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
            {lead.requirementTitle ||
              lead.requirementForm?.description?.slice(0, 80) ||
              lead.service ||
              "Service Request"}
          </h3>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex flex-wrap gap-3 items-center">
              {(lead.preferredDate || lead.requirementForm?.preferredDate) && (
                <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Schedule:{" "}
                  {lead.preferredDate || lead.requirementForm?.preferredDate}
                  {(lead.preferredTime ||
                    lead.requirementForm?.preferredTime) &&
                    ` · ${lead.preferredTime || lead.requirementForm?.preferredTime}`}
                </p>
              )}
              {lead.expiry &&
                ["available", "partially_unlocked"].includes(lead.status) && (
                  <ExpiryCountdown expiry={lead.expiry} />
                )}
            </div>
            {lead.createdAt && (
              <p className="text-[9px] font-black text-violet-600 dark:text-violet-450 flex items-center gap-1 uppercase tracking-wider">
                <Clock className="h-3 w-3" />
                Generated:{" "}
                {new Date(lead.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                at{" "}
                {new Date(lead.createdAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            )}
          </div>
        </div>

        {/* Requirement preview */}
        <div className="bg-slate-50/70 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700/50">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Requirement
          </p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-3">
            {lead.requirementDesc ||
              lead.requirementForm?.description ||
              "No description provided."}
          </p>
        </div>

        {/* Dynamic answers preview (first 2) */}
        {lead.dynamicAnswersPreview?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Key Details
            </p>
            {lead.dynamicAnswersPreview.map((a) => (
              <div key={a.fieldId} className="flex gap-2 items-start">
                <span className="text-[9px] font-bold text-slate-400 w-20 shrink-0 truncate">
                  {a.label}:
                </span>
                <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 line-clamp-1 flex-1">
                  {Array.isArray(a.value)
                    ? a.value.join(", ")
                    : String(a.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Attachments badge */}
        {lead.attachments?.length > 0 && (
          <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
            📎 {lead.attachments.length} attachment
            {lead.attachments.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Unlocked customer details */}
        {isUnlocked && (
          <div className="bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl px-4 py-3 space-y-3">
            <p className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Customer Contact Revealed
            </p>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 w-12">
                  Name
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                  {lead.customer?.name || "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 w-12">
                  Phone
                </span>
                <a
                  href={`tel:${lead.customer?.mobile}`}
                  className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {lead.customer?.mobile}
                </a>
              </div>
              {lead.customer?.email && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-400 w-12">
                    Email
                  </span>
                  <a
                    href={`mailto:${lead.customer?.email}`}
                    className="text-xs font-medium text-violet-600 flex items-center gap-1.5 hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    {lead.customer?.email}
                  </a>
                </div>
              )}
              {(lead.locationDetail?.city || lead.requirementForm?.address) && (
                <div className="flex items-start gap-2 mt-1">
                  <span className="text-[9px] font-black text-slate-400 w-12 mt-0.5">
                    Address
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {[
                        lead.locationDetail?.houseNo,
                        lead.locationDetail?.apartment,
                        lead.locationDetail?.street,
                        lead.locationDetail?.area,
                        lead.locationDetail?.city,
                        lead.locationDetail?.state,
                        lead.locationDetail?.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ") || lead.requirementForm?.address}
                    </p>
                    {lead.location?.coordinates?.length >= 2 && (
                      <button
                        onClick={() => {
                          const lat = lead.location.coordinates[1];
                          const lng = lead.location.coordinates[0];
                          const label = encodeURIComponent(
                            lead.requirementTitle || "Lead Location",
                          );
                          // Use platform-appropriate map link to avoid WebView "Not Available" errors
                          const isIOS = /iPad|iPhone|iPod/.test(
                            navigator.userAgent,
                          );
                          const url = isIOS
                            ? `maps://maps.apple.com/?q=${lat},${lng}&label=${label}`
                            : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                          window.open(url, "_blank");
                        }}
                        className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg uppercase tracking-widest mt-1.5 hover:bg-emerald-200 transition-colors"
                      >
                        <MapPin className="h-2.5 w-2.5" /> Open in Maps
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirm the meeting with the customer's OTP. */}
      {isUnlocked && (!lead.disputeStatus || lead.disputeStatus === "none") && (
        <div className="px-5 pb-4">
          {lead.myMeetVerified ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400" data-meet-verified>
              <CheckCircle2 className="h-4 w-4" /> Meeting confirmed with customer OTP
            </div>
          ) : (
            <MeetOtpBox leadId={lead._id} onVerified={onRefresh} />
          )}
        </div>
      )}

      {/* Booking: the work agreed with the customer becomes a normal booking
          (both Bookings tabs, OTP start/finish, cash after service). */}
      {isUnlocked && (!lead.disputeStatus || lead.disputeStatus === "none") && (
        <div className="px-5 pb-4" data-lead-booking>
          {lead.myBooking ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Booking created
                </p>
                <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  {lead.myBooking.bookingDate} · {lead.myBooking.bookingTime} · ₹{lead.myBooking.totalAmount}
                </p>
              </div>
              <Link to="/provider/bookings" className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700">
                View
              </Link>
            </div>
          ) : (
            <button
              onClick={() => onBook(lead)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 py-3 text-xs font-black uppercase tracking-widest text-white transition-all active:scale-95 shadow-lg shadow-violet-600/20"
            >
              <Calendar className="h-4 w-4" /> Create Booking
            </button>
          )}
        </div>
      )}

      {/* Bottom action strip */}
      <div className="px-5 pb-5 flex flex-row items-center justify-between gap-3 border-t border-slate-50 dark:border-slate-800 pt-4">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Unlock Fee
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-white">
            ₹{lead.leadPrice || 0}
          </p>
          <p className="text-[9px] text-slate-400 font-medium mt-0.5">
            {lead.unlockedProviders?.length || 0} / {lead.maxUnlockLimit}{" "}
            unlocked
          </p>
        </div>

        <div className="flex gap-2">
          {!isUnlocked &&
            ["available", "partially_unlocked"].includes(lead.status) && (
              <button
                onClick={() => onUnlock(lead._id, lead.leadPrice)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                Unlock <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          {isUnlocked && lead.disputeStatus === "none" && (
            <button
              onClick={() => onDispute(lead._id)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              <AlertTriangle className="h-3 w-3" /> Dispute
            </button>
          )}
          {lead.disputeStatus && lead.disputeStatus !== "none" && (
            <span className="text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl uppercase tracking-widest">
              Dispute: {lead.disputeStatus}
            </span>
          )}
          {isUnlocked && lead.status === "fully_unlocked" && (
            <span className="text-[9px] font-black text-slate-400 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Lead Closed
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const VALID_TABS = ["available", "unlocked", "expired"];

const ProviderLeads = () => {
  const { toast } = useToast();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [unlockModal, setUnlockModal] = useState(null); // { leadId, price }
  // Create Booking from an unlocked lead: { lead, price, date, time, saving, error }
  const [bookModal, setBookModal] = useState(null);
  const [unlocking, setUnlocking] = useState(false);

  // Derive activeTab and page from URL, with fallback defaults
  const rawTab = searchParams.get("tab");
  const activeTab = VALID_TABS.includes(rawTab) ? rawTab : "available";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));

  const setActiveTab = (tab) => {
    setSearchParams((prev) => {
      prev.set("tab", tab);
      prev.set("page", "1");
      return prev;
    });
  };
  const setPage = (p) => {
    const next = typeof p === "function" ? p(page) : p;
    setSearchParams((prev) => {
      prev.set("page", String(next));
      return prev;
    });
  };

  // Dispute
  const [disputingLeadId, setDisputingLeadId] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeError, setDisputeError] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const TABS = [
    { id: "available", label: "Available" },
    { id: "unlocked", label: "My Unlocked" },
    { id: "expired", label: "Expired" },
  ];

  const fetchLeadsAndWallet = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setTabLoading(true);
      try {
        const [leadsRes, walletRes] = await Promise.all([
          API.get(`/leads/nearby?page=${page}&limit=10&tab=${activeTab}`),
          API.get("/wallet"),
        ]);
        setLeads(leadsRes.data.leads || []);
        setTotalPages(leadsRes.data.pages || 1);
        setWalletBalance(
          walletRes.data.availableBalance !== undefined
            ? walletRes.data.availableBalance
            : walletRes.data.balance || 0,
        );
      } catch (err) {
        if (!silent) {
          toast({
            title: "Fetch Failed",
            description: err.response?.data?.message || "Could not sync leads.",
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
        setTabLoading(false);
      }
    },
    [page, activeTab],
  );

  useEffect(() => {
    // Initial load
    const isInitial = leads.length === 0 && loading;
    fetchLeadsAndWallet(isInitial ? false : true);

    // ── Real-time: socket event when new lead is broadcast ──
    const handleNewLeadSocket = () => {
      fetchLeadsAndWallet(true);
    };

    // ── Fallback: window notification event ──
    const handleNewNotification = (e) => {
      const data = e.detail;
      if (data?.type === "lead") {
        fetchLeadsAndWallet(true);
      }
    };

    // ── Polling: silent refresh every 30 seconds ──
    const pollInterval = setInterval(() => {
      fetchLeadsAndWallet(true);
    }, 30000);

    if (socket) socket.on("NEW_LEAD_REQUEST", handleNewLeadSocket);
    window.addEventListener("NEW_NOTIFICATION", handleNewNotification);

    return () => {
      if (socket) socket.off("NEW_LEAD_REQUEST", handleNewLeadSocket);
      window.removeEventListener("NEW_NOTIFICATION", handleNewNotification);
      clearInterval(pollInterval);
    };
  }, [fetchLeadsAndWallet, socket]);

  const confirmUnlock = (leadId, price) => setUnlockModal({ leadId, price });

  // A lead accepted on the home page that needs a payment lands here with
  // ?unlock=<id>: the unlock window opens for it, once the list has loaded.
  useEffect(() => {
    const wanted = searchParams.get("unlock");
    if (!wanted || loading) return;
    const lead = leads.find((l) => l._id === wanted);
    setSearchParams((prev) => { prev.delete("unlock"); return prev; }, { replace: true });
    if (lead && !lead.isUnlocked) setUnlockModal({ leadId: lead._id, price: lead.leadPrice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, loading]);

  // Prefilled with what the customer asked for; the partner sets the price.
  const openBooking = (lead) => {
    const today = todayLocal();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(lead.preferredDate || "") && lead.preferredDate >= today ? lead.preferredDate : today;
    const time = BOOKING_TIMES.includes(lead.preferredTime) ? lead.preferredTime : "10:00 AM";
    setBookModal({ lead, price: "", date, time, saving: false, error: "" });
  };

  const handleCreateBooking = async () => {
    if (!bookModal || bookModal.saving) return;
    const price = Number(bookModal.price);
    if (!Number.isFinite(price) || price < 1) {
      setBookModal({ ...bookModal, error: "Enter the price you agreed with the customer." });
      return;
    }
    setBookModal({ ...bookModal, saving: true, error: "" });
    try {
      await API.post(`/leads/${bookModal.lead._id}/booking`, {
        price,
        bookingDate: bookModal.date,
        bookingTime: bookModal.time,
      });
      toast({ title: "Booking created", description: "It's in your Bookings. The customer has been notified." });
      setBookModal(null);
      fetchLeadsAndWallet(true);
    } catch (err) {
      setBookModal((m) => m && { ...m, saving: false, error: err.response?.data?.message || "Couldn't create the booking." });
    }
  };

  const handleUnlock = async () => {
    if (!unlockModal) return;
    setUnlocking(true);
    try {
      const { data } = await API.post(`/leads/${unlockModal.leadId}/unlock`);
      if (data.success) {
        toast({
          title: "Lead Unlocked!",
          description: "Customer contact details are now visible.",
        });
        setUnlockModal(null);
        fetchLeadsAndWallet();
        window.dispatchEvent(new CustomEvent("WALLET_UPDATED"));
      }
    } catch (err) {
      setUnlockModal(null);
      if (err.response?.status === 402 && err.response?.data?.paymentRequired) {
        handleRazorpayCheckout(unlockModal.leadId, err.response.data.leadPrice);
      } else {
        toast({
          title: "Unlock Failed",
          description: err.response?.data?.message || "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setUnlocking(false);
    }
  };

  const handleRazorpayCheckout = async (leadId) => {
    try {
      // The server prices the unlock from the lead itself; no amount is sent.
      const { data: orderData } = await API.post("/payment/order", { purpose: "lead", leadId });
      const options = {
        key: orderData.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: "INR",
        name: "RozSewa",
        description: "Lead Unlock Fee",
        order_id: orderData.id,
        // Who is paying, so the checkout does not ask for it again.
        prefill: { name: user?.ownerName || user?.name, email: user?.email, contact: user?.mobile },
        // When the payment goes through a bank page and this page is not told,
        // the server unlocks the lead there instead.
        callback_url: `${API.defaults.baseURL}/payment/callback`,
        modal: { ondismiss: () => toast({ title: "Payment cancelled", description: "No money was taken." }) },
        handler: async (response) => {
          try {
            const { data } = await API.post("/payment/verify-lead-payment", response);
            toast(data?.unlocked === false
              ? { title: "Lead no longer available", description: data.message }
              : { title: "Payment Successful", description: "Lead unlocked!" });
            fetchLeadsAndWallet();
            window.dispatchEvent(new CustomEvent("WALLET_UPDATED"));
          } catch (err) {
            toast({ title: "Verification Failed", description: err.response?.data?.message || "If money was deducted, the lead is unlocked automatically within a few minutes.", variant: "destructive" });
          }
        },
        theme: { color: "#7c3aed" },
      };
      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (r) => toast({ title: "Payment failed", description: `${r.error?.description || "The payment didn't go through."} Nothing was unlocked.`, variant: "destructive" }));
        rzp.open();
      } else {
        toast({ title: "Payment gateway not loaded", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Payment Failed",
        description: err.response?.data?.message || "Try again.",
        variant: "destructive",
      });
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!disputeReason.trim()) {
      setDisputeError("Please describe your reason before submitting a claim.");
      toast({
        title: "⚠️ Reason Required",
        description:
          "Please describe why this lead was invalid before submitting.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    setDisputeError("");
    setSubmittingDispute(true);
    try {
      await API.post(`/leads/${disputingLeadId}/dispute`, {
        reason: disputeReason,
      });
      toast({
        title: "✅ Dispute Raised",
        description: "Admin will review your claim within 24 hours.",
      });
      setDisputingLeadId(null);
      setDisputeReason("");
      setDisputeError("");
      fetchLeadsAndWallet();
    } catch (err) {
      const errMsg =
        err.response?.data?.message || "Could not submit claim. Try again.";
      setDisputeError(errMsg);
      toast({
        title: "Submission Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24 transition-colors duration-500">
      <ProviderTopNav />

      <main className="container max-w-3xl px-4 py-6 space-y-5 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Lead Marketplace
            </p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Available Leads
            </h1>
          </div>
          <button
            onClick={() => fetchLeadsAndWallet(false)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white dark:bg-slate-900 border border-border shadow-sm hover:shadow-md text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-all active:scale-95"
          >
            <RefreshCcw
              className={`h-3.5 w-3.5 ${loading || tabLoading ? "animate-spin text-violet-600" : ""}`}
            />{" "}
            Refresh
          </button>
        </div>

        {/* Wallet Balance */}
        <div className="bg-white dark:bg-slate-900/50 border border-violet-100 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Available Balance
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                ₹{walletBalance.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Minimum balance required to unlock leads
              </p>
            </div>
          </div>
          <IndianRupee className="h-8 w-8 text-violet-100 dark:text-violet-900/40 shrink-0" />
        </div>

        {/* Privacy Notice */}
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
          <Shield className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-[10px] font-medium text-amber-800">
            Customer contact details are masked until you unlock a lead. The
            platform does not charge any commission.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                  : "bg-white dark:bg-slate-900 border border-border text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
              {tabLoading && activeTab === tab.id && (
                <span className="inline-block ml-1.5 h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Lead Cards */}
        <div
          className={`space-y-4 transition-opacity duration-200 ${tabLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}
        >
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-64 bg-white dark:bg-slate-900/50 border border-border rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-16 flex flex-col items-center gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                <Briefcase className="h-7 w-7 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                {activeTab === "available"
                  ? "No Leads Available"
                  : activeTab === "unlocked"
                    ? "No Unlocked Leads"
                    : "No Expired Leads"}
              </h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs mb-2">
                {activeTab === "available"
                  ? "No new requests in your area. Stay active to receive notifications!"
                  : "Nothing here yet."}
              </p>
              <button
                onClick={() => fetchLeadsAndWallet(false)}
                className="flex items-center gap-2 h-9 px-4 rounded-xl bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors text-[10px] font-black uppercase tracking-widest"
              >
                <RefreshCcw
                  className={`h-3.5 w-3.5 ${loading || tabLoading ? "animate-spin" : ""}`}
                />{" "}
                Refresh Now
              </button>
            </div>
          ) : (
            leads.map((lead) => (
              <LeadCard
                key={lead._id}
                lead={lead}
                onUnlock={confirmUnlock}
                onBook={openBooking}
                onDispute={setDisputingLeadId}
                onRefresh={() => fetchLeadsAndWallet(true)}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-3 pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-5 py-2.5 rounded-xl border border-border bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 hover:shadow-sm transition-all"
            >
              ← Prev
            </button>
            <span className="flex items-center px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-5 py-2.5 rounded-xl border border-border bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 hover:shadow-sm transition-all"
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {/* Unlock Confirmation Modal */}
      {unlockModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => !unlocking && setUnlockModal(null)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-border">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Unlock className="h-5 w-5 text-emerald-500" /> Confirm Unlock
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                #{unlockModal.leadId?.slice(-6).toUpperCase()}
              </span>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You are about to unlock this lead for{" "}
              <strong>₹{unlockModal.price}</strong>. This will deduct from your
              wallet or subscription credits.
            </p>
            <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
              After unlocking, the customer's name, phone, and address will be
              visible. The platform charges no further commission.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setUnlockModal(null)}
                disabled={unlocking}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlock}
                disabled={unlocking}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {unlocking ? "Unlocking..." : "Confirm Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Booking Modal */}
      {bookModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" data-lead-booking-modal>
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => !bookModal.saving && setBookModal(null)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-border">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-violet-500" /> Create Booking
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                #{bookModal.lead._id?.slice(-6).toUpperCase()}
              </span>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Book <strong>{bookModal.lead.requirementTitle || "this request"}</strong> at the price and time you agreed with the customer.
            </p>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agreed price (₹)</span>
              <input
                type="text" inputMode="numeric" value={bookModal.price}
                onChange={(e) => setBookModal({ ...bookModal, price: e.target.value.replace(/[^\d]/g, "").slice(0, 6), error: "" })}
                placeholder="e.g. 800"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</span>
                <input
                  type="date" value={bookModal.date} min={todayLocal()}
                  onChange={(e) => setBookModal({ ...bookModal, date: e.target.value, error: "" })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-500"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time</span>
                <select
                  value={bookModal.time}
                  onChange={(e) => setBookModal({ ...bookModal, time: e.target.value, error: "" })}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold outline-none focus:border-violet-500"
                >
                  {BOOKING_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
              The customer pays you after the service. No commission — you already unlocked this lead.
            </p>
            {bookModal.error && <p className="text-xs font-bold text-rose-600">{bookModal.error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setBookModal(null)}
                disabled={bookModal.saving}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBooking}
                disabled={bookModal.saving}
                className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-black transition-all active:scale-95 shadow-lg shadow-violet-600/20"
              >
                {bookModal.saving ? "Creating..." : "Create Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputingLeadId && (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center pt-16 p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => {
              setDisputingLeadId(null);
              setDisputeError("");
            }}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-border">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" /> Raise Refund
                Dispute
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                #{disputingLeadId?.slice(-6).toUpperCase()}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Describe why this lead was invalid. False claims may restrict your
              account.
            </p>
            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <textarea
                  rows={4}
                  value={disputeReason}
                  onChange={(e) => {
                    setDisputeReason(e.target.value);
                    if (e.target.value.trim()) setDisputeError("");
                  }}
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-medium focus:ring-2 outline-none text-slate-800 dark:text-white resize-none transition-colors ${
                    disputeError
                      ? "border-rose-400 focus:ring-rose-500/20 bg-rose-50 dark:bg-rose-900/10"
                      : "border-slate-200 dark:border-slate-700 focus:ring-rose-500/20"
                  }`}
                  placeholder="e.g. Phone number was incorrect. Customer refused the work immediately."
                />
                {disputeError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      {disputeError}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDisputingLeadId(null);
                    setDisputeError("");
                  }}
                  className="flex-1 py-3 border border-border rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60"
                >
                  {submittingDispute ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ProviderBottomNav />
    </div>
  );
};

export default ProviderLeads;
