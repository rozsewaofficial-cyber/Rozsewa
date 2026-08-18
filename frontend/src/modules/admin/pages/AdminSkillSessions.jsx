import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck, Loader2, X, Save, Video, MapPin, RotateCcw,
  CheckCircle2, UserX, Link2, AlertCircle, BarChart3, ListFilter
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  scheduled: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  completed: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  no_show: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const STATUS_LABEL = {
  pending: "Pending",
  scheduled: "Scheduled",
  completed: "Completed",
  no_show: "No Show",
  cancelled: "Cancelled",
};

const isPast = (session) => {
  if (!session.scheduledDate || !session.scheduledTime) return false;
  const [y, m, d] = session.scheduledDate.split("-").map(Number);
  const [h, min] = session.scheduledTime.split(":").map(Number);
  return new Date(y, m - 1, d, h, min) < new Date();
};

const AdminSkillSessions = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [tab, setTab] = useState("sessions"); // "sessions" | "reports"
  const [sessions, setSessions] = useState([]);
  const [reports, setReports] = useState(null);
  const [centers, setCenters] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [filters, setFilters] = useState({
    status: "", mode: "", centerId: "", trainerId: "", dateFrom: "", dateTo: "",
  });

  const [assignFor, setAssignFor] = useState(null);
  const [assignForm, setAssignForm] = useState({ centerId: "", trainerId: "", scheduledDate: "", scheduledTime: "" });
  const [linkFor, setLinkFor] = useState(null);
  const [linkValue, setLinkValue] = useState("");
  const [saving, setSaving] = useState(false);

  useScrollLock(!!assignFor || !!linkFor);

  useEffect(() => {
    setTitle("Skill Sessions");
  }, [setTitle]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await API.get("/admin/skill-sessions", { params });
      setSessions(data || []);
    } catch {
      toast({ title: "Could not load sessions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      const { data } = await API.get("/admin/skill-sessions/reports", { params });
      setReports(data);
    } catch {
      toast({ title: "Could not load reports", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters.dateFrom, filters.dateTo, toast]);

  useEffect(() => {
    if (tab === "sessions") fetchSessions();
    else fetchReports();
  }, [tab, fetchSessions, fetchReports]);

  useEffect(() => {
    Promise.all([
      API.get("/admin/training-centers").catch(() => ({ data: [] })),
      API.get("/admin/trainers").catch(() => ({ data: [] })),
    ]).then(([c, t]) => {
      setCenters(c.data || []);
      setTrainers(t.data || []);
    });
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const openAssign = (session) => {
    setAssignFor(session);
    setAssignForm({
      centerId: session.centerId?._id || "",
      trainerId: session.trainerId?._id || "",
      scheduledDate: session.scheduledDate || session.preferredDate || "",
      scheduledTime: session.scheduledTime || "10:00",
    });
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.put(`/admin/skill-sessions/${assignFor._id}/assign`, assignForm);
      toast({ title: "Session assigned" });
      setAssignFor(null);
      fetchSessions();
    } catch (err) {
      toast({
        title: "Could not assign",
        description: err.response?.data?.message || "Assignment failed.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const submitLink = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await API.put(`/admin/skill-sessions/${linkFor._id}/meeting-link`, { meetingLink: linkValue });
      toast({ title: "Meeting link saved", description: "The Sewak has been notified." });
      setLinkFor(null);
      setLinkValue("");
      fetchSessions();
    } catch (err) {
      toast({
        title: "Could not save link",
        description: err.response?.data?.message || "Save failed.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const markAttendance = async (session, attendance) => {
    setBusyId(session._id);
    try {
      await API.put(`/admin/skill-sessions/${session._id}/attendance`, { attendance });
      toast({
        title: attendance === "present" ? "Marked completed" : "Marked no-show",
        description: attendance === "present" ? "Their service is now ready for activation." : undefined,
      });
      fetchSessions();
    } catch (err) {
      toast({
        title: "Could not mark attendance",
        description: err.response?.data?.message || "Update failed.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const createReSession = async (session) => {
    if (!window.confirm(`Schedule another ${session.serviceName} session for this Sewak?`)) return;
    setBusyId(session._id);
    try {
      await API.post(`/admin/skill-sessions/${session._id}/re-session`, {});
      toast({ title: "Re-session created" });
      fetchSessions();
    } catch (err) {
      toast({
        title: "Could not create re-session",
        description: err.response?.data?.message || "Failed.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = sessions.filter((s) => s.status === "pending").length;
  const centerTrainers = trainers.filter(
    (t) => (t.trainingCenter?._id || t.trainingCenter) === assignForm.centerId
  );

  const inputCls =
    "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500";
  const labelCls =
    "block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "sessions", label: "Sessions", icon: ListFilter },
          { id: "reports", label: "Reports", icon: BarChart3 },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {tab === "sessions" && (
          <>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filters.mode}
              onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
            >
              <option value="">All modes</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
            <select
              value={filters.centerId}
              onChange={(e) => setFilters({ ...filters, centerId: e.target.value })}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
            >
              <option value="">All centers</option>
              {centers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select
              value={filters.trainerId}
              onChange={(e) => setFilters({ ...filters, trainerId: e.target.value })}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
            >
              <option value="">All trainers</option>
              {trainers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </>
        )}
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
        />
        {Object.values(filters).some(Boolean) && (
          <button
            onClick={() => setFilters({ status: "", mode: "", centerId: "", trainerId: "", dateFrom: "", dateTo: "" })}
            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
        </div>
      ) : tab === "reports" ? (
        <ReportsView reports={reports} />
      ) : (
        <>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {pendingCount} session{pendingCount === 1 ? "" : "s"} awaiting allocation — assign a center and trainer, or wait for the retry job.
              </p>
            </div>
          )}

          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-20 text-center">
              <CalendarCheck className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">No sessions match these filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div
                  key={s._id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLES[s.status]}`}>
                          {STATUS_LABEL[s.status]}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {s.mode === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                          {s.mode}
                        </span>
                        {s.isReSession && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                            <RotateCcw className="h-2.5 w-2.5" /> Re-session {s.reSessionRound}
                          </span>
                        )}
                        {s.status === "scheduled" && isPast(s) && (
                          <span className="rounded-full bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400">
                            Awaiting attendance
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-900 dark:text-white">{s.serviceName}</h3>

                      <p className="text-xs text-slate-500">
                        {s.sewakId?.ownerName || "Sewak"}
                        {s.sewakId?.vendorCode ? ` · ${s.sewakId.vendorCode}` : ""}
                        {s.sewakId?.mobile ? ` · ${s.sewakId.mobile}` : ""}
                        {s.sewakId?.city ? ` · ${s.sewakId.city}` : ""}
                      </p>

                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {s.status === "pending" ? (
                          <>Preferred: {s.preferredDate} · {s.preferredTimeOfDay}</>
                        ) : (
                          <>
                            {s.scheduledDate} at {s.scheduledTime}
                            {s.centerId?.name ? ` · ${s.centerId.name}` : ""}
                            {s.trainerId?.name ? ` · ${s.trainerId.name}` : ""}
                          </>
                        )}
                      </p>

                      {s.mode === "online" && s.meetingLink && (
                        <a
                          href={s.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
                        >
                          <Link2 className="h-3 w-3" /> Meeting link
                        </a>
                      )}
                    </div>

                    {/* Contextual actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(s.status === "pending" || s.status === "scheduled") && (
                        <button
                          onClick={() => openAssign(s)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600"
                        >
                          {s.status === "pending" ? "Assign" : "Reassign"}
                        </button>
                      )}
                      {s.status === "scheduled" && s.mode === "online" && (
                        <button
                          onClick={() => { setLinkFor(s); setLinkValue(s.meetingLink || ""); }}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600"
                        >
                          {s.meetingLink ? "Edit link" : "Add link"}
                        </button>
                      )}
                      {s.status === "scheduled" && (
                        <>
                          <button
                            disabled={busyId === s._id}
                            onClick={() => markAttendance(s, "present")}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Present
                          </button>
                          <button
                            disabled={busyId === s._id}
                            onClick={() => markAttendance(s, "no_show")}
                            className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                          >
                            <UserX className="h-3.5 w-3.5" /> No Show
                          </button>
                        </>
                      )}
                      {(s.status === "completed" || s.status === "no_show") && (
                        <button
                          disabled={busyId === s._id}
                          onClick={() => createReSession(s)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Re-session
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Assign modal */}
      <AnimatePresence>
        {assignFor && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setAssignFor(null)}
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={submitAssign}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Assign Session</h2>
                <button type="button" onClick={() => setAssignFor(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                {assignFor.serviceName} · {assignFor.sewakId?.ownerName} · preferred{" "}
                {assignFor.preferredDate} ({assignFor.preferredTimeOfDay})
              </p>

              <div>
                <label className={labelCls}>Training Center</label>
                <select
                  value={assignForm.centerId}
                  onChange={(e) => setAssignForm({ ...assignForm, centerId: e.target.value, trainerId: "" })}
                  className={inputCls}
                  required
                >
                  <option value="">— Select a center —</option>
                  {centers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Trainer</label>
                <select
                  value={assignForm.trainerId}
                  onChange={(e) => setAssignForm({ ...assignForm, trainerId: e.target.value })}
                  className={inputCls}
                  required
                  disabled={!assignForm.centerId}
                >
                  <option value="">— Select a trainer —</option>
                  {centerTrainers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                {assignForm.centerId && centerTrainers.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">That center has no trainers yet.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    type="date"
                    value={assignForm.scheduledDate}
                    onChange={(e) => setAssignForm({ ...assignForm, scheduledDate: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Time</label>
                  <input
                    type="time"
                    value={assignForm.scheduledTime}
                    onChange={(e) => setAssignForm({ ...assignForm, scheduledTime: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAssignFor(null)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Assign
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meeting link modal */}
      <AnimatePresence>
        {linkFor && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setLinkFor(null)}
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={submitLink}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Meeting Link</h2>
                <button type="button" onClick={() => setLinkFor(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {linkFor.serviceName} · {linkFor.scheduledDate} at {linkFor.scheduledTime}. The Sewak is
                notified as soon as the link is added.
              </p>
              <input
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                className={inputCls}
                placeholder="https://meet.google.com/..."
                required
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setLinkFor(null)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Link
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Reports ──────────────────────────────────────────────────────────────────

const StatTile = ({ label, value, accent }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-1 text-2xl font-black tabular-nums ${accent || "text-slate-900 dark:text-white"}`}>{value}</p>
  </div>
);

const BreakdownTable = ({ title, rows, nameKey = "name" }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
    <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
    {!rows?.length ? (
      <p className="text-xs text-slate-400 italic">No data yet.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="pb-2 text-left">Name</th>
              <th className="pb-2 text-right">Total</th>
              <th className="pb-2 text-right">Done</th>
              <th className="pb-2 text-right">No Show</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-2 font-semibold text-slate-700 dark:text-slate-300">{r[nameKey] || r._id}</td>
                <td className="py-2 text-right tabular-nums font-bold">{r.n}</td>
                <td className="py-2 text-right tabular-nums text-sky-600">{r.completed}</td>
                <td className="py-2 text-right tabular-nums text-red-600">{r.noShow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const ReportsView = ({ reports }) => {
  if (!reports) return null;
  const t = reports.totals;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatTile label="Total" value={t.total} />
        <StatTile label="Pending" value={t.pending} accent="text-amber-600" />
        <StatTile label="Scheduled" value={t.scheduled} accent="text-emerald-600" />
        <StatTile label="Completed" value={t.completed} accent="text-sky-600" />
        <StatTile label="No Show" value={t.noShow} accent="text-red-600" />
        <StatTile label="Re-Session" value={t.reSession} accent="text-purple-600" />
        <StatTile label="Cancelled" value={t.cancelled} />
        <StatTile label="Awaiting Attendance" value={t.awaitingAttendance} accent="text-orange-600" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <StatTile label="Online" value={reports.byMode.online} />
        <StatTile label="Offline" value={reports.byMode.offline} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownTable title="Service-wise" rows={reports.byService} nameKey="_id" />
        <BreakdownTable title="Center-wise" rows={reports.byCenter} />
        <BreakdownTable title="Trainer-wise" rows={reports.byTrainer} />
      </div>
    </div>
  );
};

export default AdminSkillSessions;
