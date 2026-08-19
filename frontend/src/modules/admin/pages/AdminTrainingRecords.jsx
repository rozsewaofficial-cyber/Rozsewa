import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, Loader2, Search, X, ListFilter, User, PauseCircle,
  CheckCircle2, Clock, AlertTriangle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";
import TrainingPanelBoard from "@/modules/trainer/components/TrainingPanelBoard";

const STATUS_META = {
  pending: { label: "Not started", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  in_progress: { label: "In progress", cls: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400" },
  on_hold_item_missing: { label: "On hold", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  training_done: { label: "Done", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
};

const Tile = ({ label, value, accent }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-1 text-2xl font-black tabular-nums ${accent || "text-slate-900 dark:text-white"}`}>{value}</p>
  </div>
);

const AdminTrainingRecords = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [tab, setTab] = useState("queue");
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [openSewak, setOpenSewak] = useState(null);
  const [reopenFor, setReopenFor] = useState(null);
  const [reopenReason, setReopenReason] = useState("");
  const [saving, setSaving] = useState(false);

  useScrollLock(!!openSewak || !!reopenFor);

  useEffect(() => { setTitle("Training Records"); }, [setTitle]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const [recRes, statRes] = await Promise.all([
        API.get("/admin/training-records", { params }),
        API.get("/admin/training-records/stats"),
      ]);
      setRecords(recRes.data || []);
      setStats(statRes.data);
    } catch {
      toast({ title: "Could not load training records", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { if (tab === "queue") fetchAll(); }, [tab, fetchAll]);

  const submitReopen = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) return toast({ title: "A reason is required", variant: "destructive" });
    setSaving(true);
    try {
      await API.post(`/admin/training-records/${reopenFor._id || reopenFor.sewakId?._id}/reopen`, { reason: reopenReason });
      toast({ title: "Training reopened", description: "The Sewak is now offline until training is completed again." });
      setReopenFor(null);
      setReopenReason("");
      setOpenSewak(null);
      fetchAll();
    } catch (err) {
      toast({ title: "Could not reopen", description: err.response?.data?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onHoldCount = records.filter((r) => r.status === "on_hold_item_missing").length;

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "queue", label: "Work Queue", icon: ListFilter },
          { id: "panel", label: "Training Panel", icon: ClipboardCheck },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === t.id ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "panel" ? (
        <div className="max-w-3xl">
          <p className="mb-4 text-xs text-slate-500">
            Enter any Sewak Code — admin access is not restricted to a training centre.
          </p>
          <TrainingPanelBoard isAdmin onReopen={(s) => setReopenFor({ _id: s._id, name: s.name })} />
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Tile label="Total" value={stats.total} />
              <Tile label="Not Started" value={stats.pending} accent="text-slate-500" />
              <Tile label="In Progress" value={stats.inProgress} accent="text-sky-600" />
              <Tile label="On Hold" value={stats.onHold} accent="text-amber-600" />
              <Tile label="Completed" value={stats.completed} accent="text-emerald-600" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500">
              <option value="">All statuses</option>
              <option value="pending">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="on_hold_item_missing">On hold</option>
              <option value="training_done">Completed</option>
            </select>
          </div>

          {onHoldCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {onHoldCount} Sewak{onHoldCount === 1 ? "" : "s"} on hold waiting for missing kit items.
              </p>
            </div>
          )}

          {records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-20 text-center">
              <ClipboardCheck className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">No training records match these filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.pending;
                const done = (r.trainingTopics || []).filter((t) => t.covered).length;
                const mandatoryTotal = (r.itemVerifications || []).filter((i) => i.isMandatory).length;
                const mandatoryDone = (r.itemVerifications || []).filter((i) => i.isMandatory && i.verified).length;
                return (
                  <div key={r._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          {r.sewakId?.profileImage
                            ? <img src={r.sewakId.profileImage} alt="" className="h-full w-full object-cover" />
                            : <User className="h-4 w-4 text-slate-400" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900 dark:text-white">{r.sewakId?.ownerName || "—"}</h3>
                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">{r.sewakId?.vendorCode}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${meta.cls}`}>{meta.label}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {r.categoryId?.name || "—"}{r.sewakId?.city ? ` · ${r.sewakId.city}` : ""}{r.sewakId?.mobile ? ` · ${r.sewakId.mobile}` : ""}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500 tabular-nums">
                            Items {mandatoryDone}/{mandatoryTotal} mandatory · Topics {done}/{(r.trainingTopics || []).length}
                          </p>
                          {r.holdReason && (
                            <p className="mt-1 text-[11px] font-semibold text-amber-600">{r.holdReason}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setOpenSewak(r.sewakId)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                          Open Panel
                        </button>
                        {r.status === "training_done" && (
                          <button onClick={() => setReopenFor({ _id: r.sewakId?._id, name: r.sewakId?.ownerName })}
                            className="rounded-lg border border-amber-200 dark:border-amber-900/50 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40">
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Inline panel */}
      <AnimatePresence>
        {openSewak && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
            onClick={() => setOpenSewak(null)}>
            <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.97, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="my-8 w-full max-w-3xl rounded-2xl bg-slate-50 dark:bg-slate-950 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Training Panel — {openSewak.ownerName}
                </h2>
                <button onClick={() => setOpenSewak(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>
              <TrainingPanelBoard
                initialSewakId={openSewak._id}
                isAdmin
                onReopen={(s) => setReopenFor({ _id: s._id, name: s.name })}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reopen modal */}
      <AnimatePresence>
        {reopenFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setReopenFor(null)}>
            <motion.form initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} onSubmit={submitReopen}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-2.5"><PauseCircle className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Reopen Training</h2>
                  <p className="text-xs text-slate-500">{reopenFor.name}</p>
                </div>
              </div>
              <p className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                This takes the Sewak offline immediately — they stop receiving bookings until training is completed again.
              </p>
              <textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={3} required
                placeholder="Why is this training being reopened?"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setReopenFor(null)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />} Reopen
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTrainingRecords;
