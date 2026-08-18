import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap, LogOut, Loader2, MapPin, Video, User, Phone,
  CheckCircle2, UserX, RotateCcw, CalendarDays, Building2
} from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { STORAGE_KEY } from "@/modules/trainer/components/TrainerProtectedRoute";

const TABS = [
  { id: "scheduled", label: "Scheduled" },
  { id: "completed", label: "Completed" },
  { id: "no_show", label: "No Show" },
];

const prettyDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

const prettyTime = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

const isPast = (session) => {
  if (!session.scheduledDate || !session.scheduledTime) return false;
  const [y, m, d] = session.scheduledDate.split("-").map(Number);
  const [h, min] = session.scheduledTime.split(":").map(Number);
  return new Date(y, m - 1, d, h, min) < new Date();
};

const TrainerSessions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [trainer, setTrainer] = useState(null);
  const [tab, setTab] = useState("scheduled");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setTrainer(JSON.parse(raw)?.trainer);
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/trainer/sessions", { params: { status: tab } });
      setSessions(data || []);
    } catch {
      toast({ title: "Could not load your sessions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    navigate("/trainer/login", { replace: true });
  };

  const markAttendance = async (session, attendance) => {
    setBusyId(session._id);
    try {
      await API.put(`/trainer/sessions/${session._id}/attendance`, { attendance });
      toast({
        title: attendance === "present" ? "Marked completed" : "Marked no-show",
        description: attendance === "present" ? "The Sewak's service is now ready for activation." : undefined,
      });
      fetchSessions();
    } catch (err) {
      toast({
        title: "Could not mark attendance",
        description: err.response?.data?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const createReSession = async (session) => {
    if (!window.confirm(`Schedule another ${session.serviceName} session for ${session.sewakId?.ownerName || "this Sewak"}?`)) return;
    setBusyId(session._id);
    try {
      await API.post(`/trainer/sessions/${session._id}/re-session`, {});
      toast({ title: "Re-session created" });
      fetchSessions();
    } catch (err) {
      toast({
        title: "Could not create re-session",
        description: err.response?.data?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 pb-10">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2">
              <GraduationCap className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white">{trainer?.name || "Trainer"}</h1>
              <p className="flex items-center gap-1 text-[11px] text-slate-500">
                <Building2 className="h-3 w-3" /> {trainer?.trainingCenter?.name || "—"}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-500 hover:border-red-200"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-4">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === t.id
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-20 text-center">
            <CalendarDays className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              No {TABS.find((t) => t.id === tab)?.label.toLowerCase()} sessions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <motion.div
                key={s._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {s.mode === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                        {s.mode}
                      </span>
                      {s.isReSession && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                          <RotateCcw className="h-2.5 w-2.5" /> Re-session {s.reSessionRound}
                        </span>
                      )}
                      {tab === "scheduled" && isPast(s) && (
                        <span className="rounded-full bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400">
                          Past due
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{s.serviceName}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <User className="h-3 w-3" /> {s.sewakId?.ownerName || "Sewak"}
                      {s.sewakId?.vendorCode ? ` · ${s.sewakId.vendorCode}` : ""}
                    </p>
                    {s.sewakId?.mobile && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3 w-3" />
                        <a href={`tel:${s.sewakId.mobile}`} className="text-emerald-600 font-semibold">{s.sewakId.mobile}</a>
                      </p>
                    )}
                    <p className="mt-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {prettyDate(s.scheduledDate)} at {prettyTime(s.scheduledTime)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  {tab === "scheduled" && (
                    <>
                      <button
                        disabled={busyId === s._id}
                        onClick={() => markAttendance(s, "present")}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Present
                      </button>
                      <button
                        disabled={busyId === s._id}
                        onClick={() => markAttendance(s, "no_show")}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                      >
                        <UserX className="h-3.5 w-3.5" /> No Show
                      </button>
                    </>
                  )}
                  {(tab === "completed" || tab === "no_show") && (
                    <button
                      disabled={busyId === s._id}
                      onClick={() => createReSession(s)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Re-session
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerSessions;
