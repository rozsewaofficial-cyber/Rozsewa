import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, GraduationCap, Loader2, CheckCircle2, Clock, Video,
  MapPin, Phone, User, CalendarDays, X, AlertCircle, ExternalLink
} from "lucide-react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";

const TIME_BANDS = [
  { id: "morning", label: "Morning", hint: "Before 12 PM" },
  { id: "afternoon", label: "Afternoon", hint: "12 – 5 PM" },
  { id: "evening", label: "Evening", hint: "After 5 PM" },
];

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const prettyDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
};

const prettyTime = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

const ProviderSkillSessions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [eligibility, setEligibility] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null); // the eligibility row being booked
  const [form, setForm] = useState({ preferredDate: todayISO(), preferredTimeOfDay: "morning" });
  const [saving, setSaving] = useState(false);

  useScrollLock(!!booking);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [eligRes, mineRes] = await Promise.all([
        API.get("/skill-sessions/eligibility"),
        API.get("/skill-sessions/mine"),
      ]);
      setEligibility((eligRes.data || []).filter((r) => r.required));
      setSessions(mineRes.data || []);
    } catch {
      toast({ title: "Could not load your Skill Sessions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openBooking = (row) => {
    setForm({ preferredDate: todayISO(), preferredTimeOfDay: "morning" });
    setBooking(row);
  };

  const confirmBooking = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.post("/skill-sessions/book", {
        serviceName: booking.serviceName,
        preferredDate: form.preferredDate,
        preferredTimeOfDay: form.preferredTimeOfDay,
      });
      toast({
        title: "Booking received",
        description: "We're confirming your session — you'll be notified shortly.",
      });
      setBooking(null);
      fetchAll();
    } catch (err) {
      toast({
        title: "Could not book",
        description: err.response?.data?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const sessionFor = (row) => sessions.find((s) => s._id === row.sessionId);

  const pending = eligibility.filter((r) => r.sessionStatus === "not_booked");
  const active = eligibility.filter((r) => ["pending", "scheduled"].includes(r.sessionStatus));
  const done = eligibility.filter((r) => r.sessionStatus === "completed");
  const missed = eligibility.filter((r) => r.sessionStatus === "no_show");

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 pb-24">
      <ProviderTopNav />

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-500"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Skill Sessions</h1>
            <p className="text-xs text-slate-500">Training required before these services go live</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
          </div>
        ) : eligibility.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-20 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" />
            <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">No training needed</p>
            <p className="mt-1 text-xs text-slate-500">None of your services require a Skill Session.</p>
          </div>
        ) : (
          <>
            {/* Needs booking */}
            {pending.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Action needed</h2>
                {pending.map((row) => (
                  <motion.div
                    key={row.serviceName}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-900 p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-2.5">
                        <GraduationCap className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                          Skill Session
                        </p>
                        <h3 className="mt-0.5 font-bold text-slate-900 dark:text-white">{row.serviceName}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.mode === "online" ? "Online session" : "In-person session"} · about{" "}
                          {row.durationMinutes} minutes
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openBooking(row)}
                      className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
                    >
                      Book Session
                    </button>
                  </motion.div>
                ))}
              </section>
            )}

            {/* Booked */}
            {active.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Upcoming</h2>
                {active.map((row) => {
                  const s = sessionFor(row);
                  return (
                    <SessionCard
                      key={row.serviceName}
                      row={row}
                      session={s}
                      onCancel={async () => {
                        if (!s || !window.confirm("Cancel this Skill Session?")) return;
                        try {
                          await API.put(`/skill-sessions/${s._id}/cancel`);
                          toast({ title: "Session cancelled" });
                          fetchAll();
                        } catch (err) {
                          toast({
                            title: "Could not cancel",
                            description: err.response?.data?.message || "Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                    />
                  );
                })}
              </section>
            )}

            {/* Missed */}
            {missed.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Missed</h2>
                {missed.map((row) => (
                  <div
                    key={row.serviceName}
                    className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-2.5">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white">{row.serviceName}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          You were marked absent. Contact support to have the session rescheduled.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Completed */}
            {done.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Completed</h2>
                {done.map((row) => (
                  <div
                    key={row.serviceName}
                    className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-emerald-100 dark:bg-emerald-950/60 p-2.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white">{row.serviceName}</h3>
                        <p className="mt-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          Skill Session completed · Service ready for activation
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {/* Booking sheet — two inputs, nothing else */}
      <AnimatePresence>
        {booking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
            onClick={() => setBooking(null)}
          >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={confirmBooking}
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Skill Session</p>
                  <h2 className="mt-0.5 text-lg font-black text-slate-900 dark:text-white">{booking.serviceName}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {booking.mode === "online" ? "Online" : "In-person"} · about {booking.durationMinutes} minutes
                  </p>
                </div>
                <button type="button" onClick={() => setBooking(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Preferred Date
                </label>
                <input
                  type="date"
                  min={todayISO()}
                  value={form.preferredDate}
                  onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Preferred Time
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_BANDS.map((b) => {
                    const on = form.preferredTimeOfDay === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setForm({ ...form, preferredTimeOfDay: b.id })}
                        className={`rounded-xl border-2 px-2 py-3 transition-colors ${
                          on
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span className={`block text-sm font-bold ${on ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}>
                          {b.label}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">{b.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                We'll assign the training center, trainer and exact time automatically, then notify you.
              </p>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm Booking
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <ProviderBottomNav />
    </div>
  );
};

// ── Session card ─────────────────────────────────────────────────────────────

const SessionCard = ({ row, session, onCancel }) => {
  if (!session) return null;

  // Pending never reads as an error — the system is still working on it.
  if (session.status === "pending") {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2.5">
            <Clock className="h-5 w-5 text-slate-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white">{row.serviceName}</h3>
            <p className="mt-0.5 text-xs font-bold text-slate-600 dark:text-slate-400">
              Confirming your session…
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Preferred {prettyDate(session.preferredDate)}, {session.preferredTimeOfDay}. We'll notify
              you as soon as it's scheduled.
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-500 hover:text-red-500 hover:border-red-200"
        >
          Cancel Request
        </button>
      </div>
    );
  }

  const online = session.mode === "online";

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5">
          {online ? <Video className="h-5 w-5 text-emerald-600" /> : <MapPin className="h-5 w-5 text-emerald-600" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
            {online ? "Online Session" : "Offline Session"}
          </p>
          <h3 className="mt-0.5 font-bold text-slate-900 dark:text-white">{row.serviceName}</h3>
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
        <Detail icon={CalendarDays} label="Date & Time">
          {prettyDate(session.scheduledDate)} at {prettyTime(session.scheduledTime)}
        </Detail>
        <Detail icon={User} label="Trainer">{session.trainerId?.name || "To be announced"}</Detail>

        {!online && session.centerId && (
          <>
            <Detail icon={MapPin} label="Training Center">{session.centerId.name}</Detail>
            {session.centerId.address && (
              <Detail icon={MapPin} label="Address">{session.centerId.address}</Detail>
            )}
            {session.centerId.contactNumber && (
              <Detail icon={Phone} label="Contact">
                <a href={`tel:${session.centerId.contactNumber}`} className="text-emerald-600 font-bold">
                  {session.centerId.contactNumber}
                </a>
              </Detail>
            )}
          </>
        )}
      </div>

      {online && (
        session.meetingLink ? (
          <a
            href={session.meetingLink}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            <ExternalLink className="h-4 w-4" /> Join Session
          </a>
        ) : (
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800 py-3 text-center">
            <p className="text-sm font-bold text-slate-400">Join Session</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Meeting link will be shared before the session
            </p>
          </div>
        )
      )}

      <button
        onClick={onCancel}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-500 hover:text-red-500 hover:border-red-200"
      >
        Cancel Session
      </button>
    </div>
  );
};

const Detail = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-2.5">
    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 break-words">{children}</p>
    </div>
  </div>
);

export default ProviderSkillSessions;
