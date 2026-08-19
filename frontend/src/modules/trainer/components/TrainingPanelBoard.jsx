import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, Loader2, User, Phone, MapPin, Layers, FileText, Eye, CheckCircle2,
  XCircle, PauseCircle, ShieldCheck, AlertTriangle, Package, GraduationCap, Truck
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const STATUS_META = {
  pending: { label: "Not started", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  in_progress: { label: "In progress", cls: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400" },
  on_hold_item_missing: { label: "On hold — item missing", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  training_done: { label: "Training done", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
};

const DOC_LABELS = {
  aadhaarFront: "Aadhaar (Front)",
  aadhaarBack: "Aadhaar (Back)",
  pan: "PAN Card",
  police: "Police Verification",
  liveVideo: "Live Video",
};

const GateTile = ({ ok, label }) => (
  <div className={`rounded-xl p-3 ${ok ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-slate-50 dark:bg-slate-800/50"}`}>
    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
      {ok
        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        : <XCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
      <span className={ok ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}>{label}</span>
    </p>
  </div>
);

/**
 * The five-step training panel. Shared by the trainer app and the admin panel —
 * the API scopes what a trainer may see, so the same component serves both.
 */
const TrainingPanelBoard = ({ initialSewakId = null, onReopen = null, isAdmin = false }) => {
  const { toast } = useToast();

  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [record, setRecord] = useState(null);
  const [gates, setGates] = useState(null);
  const [sewak, setSewak] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);

  const loadRecord = useCallback(async (sewakId) => {
    setLoading(true);
    try {
      const { data } = await API.get(`/training-panel/${sewakId}`);
      setRecord(data.record);
      setGates(data.gates);
      setSewak(data.sewak);
    } catch (err) {
      toast({ title: "Could not load the record", description: err.response?.data?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (initialSewakId) loadRecord(initialSewakId);
  }, [initialSewakId, loadRecord]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setRecord(null);
    try {
      const { data } = await API.get("/training-panel/search", { params: { code: code.trim() } });
      setSearchResult(data);
      await loadRecord(data.sewak._id);
    } catch (err) {
      toast({
        title: "Not found",
        description: err.response?.data?.message || "No Sewak with that code.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const viewDoc = async (docId) => {
    try {
      const { data } = await API.post(`/training-panel/${sewak._id}/view-document`, { docId });
      window.open(data.url, "_blank", "noopener");
    } catch (err) {
      toast({ title: "Could not open document", description: err.response?.data?.message, variant: "destructive" });
    }
  };

  const toggleItem = async (itemId, verified) => {
    setBusy(itemId);
    try {
      const { data } = await API.put(`/training-panel/${sewak._id}/verify-item`, { itemId, verified });
      setRecord(data.record);
      setGates(data.gates);
    } catch (err) {
      toast({ title: "Could not update", description: err.response?.data?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const toggleTopic = async (topicKey, covered) => {
    setBusy(topicKey);
    try {
      const { data } = await API.put(`/training-panel/${sewak._id}/topic`, { topicKey, covered });
      setRecord(data.record);
      setGates(data.gates);
    } catch (err) {
      toast({ title: "Could not update", description: err.response?.data?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const holdTraining = async () => {
    setBusy("hold");
    try {
      await API.put(`/training-panel/${sewak._id}/hold`, {});
      toast({ title: "Training put on hold", description: "The Sewak has been notified to order the missing items." });
      await loadRecord(sewak._id);
    } catch (err) {
      toast({ title: "Could not hold", description: err.response?.data?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const completeTraining = async () => {
    if (!window.confirm("Mark training complete? This activates the Sewak's profile and makes them visible to customers.")) return;
    setBusy("complete");
    try {
      await API.post(`/training-panel/${sewak._id}/complete`, {});
      toast({ title: "Training complete", description: "The Sewak's profile is now live." });
      await loadRecord(sewak._id);
    } catch (err) {
      toast({ title: "Could not complete", description: err.response?.data?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const meta = record ? STATUS_META[record.status] : null;
  const mandatoryItems = record?.itemVerifications?.filter((i) => i.isMandatory) || [];
  const optionalItems = record?.itemVerifications?.filter((i) => !i.isMandatory) || [];

  return (
    <div className="space-y-5">
      {/* STEP 1 — search */}
      {!initialSewakId && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter Sewak Code (e.g. RSSEW00016)"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-3 text-sm font-bold outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
          </button>
        </form>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>
      )}

      {!loading && sewak && record && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Sewak profile */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {sewak.profileImage
                    ? <img src={sewak.profileImage} alt={sewak.name} className="h-full w-full object-cover" />
                    : <User className="h-6 w-6 text-slate-400" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">{sewak.name}</h2>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">{sewak.vendorCode}</span>
                    {meta && <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${meta.cls}`}>{meta.label}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {sewak.mobile}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {sewak.city}</span>
                    <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> {sewak.category}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${sewak.kycVerified ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"}`}>
                      KYC {sewak.kycVerified ? "verified" : "pending"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${sewak.status === "verified" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                      Profile {sewak.status === "verified" ? "live" : "not live"}
                    </span>
                  </div>
                </div>
              </div>

              {isAdmin && record.status === "training_done" && onReopen && (
                <button
                  onClick={() => onReopen(sewak)}
                  className="rounded-xl border border-amber-200 dark:border-amber-900/50 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                >
                  Reopen Training
                </button>
              )}
            </div>

            {/* Documents */}
            {searchResult && (
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Registration Documents</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(DOC_LABELS).map(([key, label]) => {
                    const doc = searchResult.documents[key];
                    return (
                      <button
                        key={key}
                        disabled={!doc?.hasFile}
                        onClick={() => viewDoc(doc.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${doc?.hasFile
                          ? "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600"
                          : "border-dashed border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"}`}
                      >
                        {doc?.hasFile ? <Eye className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                        {label}
                        {!doc?.hasFile && <span className="text-[9px]">· not uploaded</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <span className="text-slate-500">Aadhaar: <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">{searchResult.identity.aadhaarMasked || "—"}</span></span>
                  <span className="text-slate-500">PAN: <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">{searchResult.identity.panMasked || "—"}</span></span>
                  <span className="text-slate-500">Police: <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">{searchResult.identity.policeVerification || "not provided"}</span></span>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Opening a document is recorded in the audit log.</p>
              </div>
            )}
          </div>

          {!sewak.kycVerified && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                KYC is not yet approved for this Sewak. Training cannot be completed until admin approves their KYC.
              </p>
            </div>
          )}

          {/* Hold banner */}
          {record.status === "on_hold_item_missing" && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4">
              <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Training On Hold — Item Missing</p>
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">{record.holdReason}</p>
                <p className="mt-1 text-[11px] text-amber-600/80">
                  The Sewak orders the missing item from their own app. Re-open this panel once they bring it in.
                </p>
              </div>
            </div>
          )}

          {/* Skill Session prerequisite — not actionable here, it happens in the
              booked-session flow, but it blocks activation so it must be visible. */}
          {gates && !gates.skillSessionPassed && record.status !== "training_done" && (
            <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30 p-4">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <div>
                <p className="text-sm font-bold text-sky-700 dark:text-sky-400">Skill Session not passed yet</p>
                <p className="mt-0.5 text-xs text-sky-600 dark:text-sky-400">
                  Pending for: {gates.pendingSkillSessions.join(", ")}
                </p>
                <p className="mt-1 text-[11px] text-sky-600/80">
                  The Sewak must attend and pass their booked skill session before the profile can be activated.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2 — item verification */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <Package className="h-4 w-4 text-emerald-600" /> Starter Kit Verification
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Physically check each item
              </span>
            </div>

            {record.itemVerifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400 italic">
                No starter kit items configured for this category.
              </p>
            ) : (
              <div className="space-y-2">
                {[...mandatoryItems, ...optionalItems].map((item) => (
                  <button
                    key={String(item.itemId)}
                    disabled={record.status === "training_done" || busy === String(item.itemId)}
                    onClick={() => toggleItem(String(item.itemId), !item.verified)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-60 ${item.verified
                      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
                      : item.isMandatory
                        ? "border-amber-200 dark:border-amber-900/50 hover:border-amber-400"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${item.verified ? "border-emerald-600 bg-emerald-600" : "border-slate-300 dark:border-slate-600"}`}>
                        {item.verified && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.itemName}</span>
                          {item.isMandatory && (
                            <span className="rounded-full bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-400">Mandatory</span>
                          )}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>Required qty: <span className="font-bold tabular-nums">×{item.requiredQty}</span></span>
                          {item.orderContext && (
                            <span className="flex items-center gap-1 text-sky-600">
                              <Truck className="h-3 w-3" /> order {item.orderContext.status}
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                    {busy === String(item.itemId) && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-500" />}
                  </button>
                ))}
              </div>
            )}

            {gates && !gates.allMandatoryVerified && record.status !== "training_done" && (
              <button
                onClick={holdTraining}
                disabled={busy === "hold" || record.status === "on_hold_item_missing"}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 dark:border-amber-900/50 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-50"
              >
                {busy === "hold" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
                {record.status === "on_hold_item_missing" ? "Already on hold" : "Put Training On Hold — Item Missing"}
              </button>
            )}
          </div>

          {/* STEP 4 — training topics */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <GraduationCap className="h-4 w-4 text-emerald-600" /> Basic Training
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 tabular-nums">
                {record.trainingTopics.filter((t) => t.covered).length}/{record.trainingTopics.length} covered
              </span>
            </div>

            <div className="space-y-2">
              {record.trainingTopics.map((t) => (
                <button
                  key={t.key}
                  disabled={record.status === "training_done" || busy === t.key}
                  onClick={() => toggleTopic(t.key, !t.covered)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-60 ${t.covered
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${t.covered ? "border-emerald-600 bg-emerald-600" : "border-slate-300 dark:border-slate-600"}`}>
                    {t.covered && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.label}</span>
                  {busy === t.key && <Loader2 className="ml-auto h-4 w-4 animate-spin text-emerald-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* STEP 5 — completion */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            {record.status === "training_done" ? (
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5"><ShieldCheck className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">Training Done · Profile Active</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Completed {record.completedAt ? new Date(record.completedAt).toLocaleString("en-IN") : ""}
                    {record.reopenedCount > 0 && ` · reopened ${record.reopenedCount}×`}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <GateTile ok={gates?.skillSessionPassed} label="Skill session" />
                  <GateTile ok={gates?.allMandatoryVerified} label="Mandatory items" />
                  <GateTile ok={gates?.allTopicsCovered} label="Training complete" />
                </div>

                {gates?.pendingSkillSessions?.length > 0 && (
                  <p className="mb-2 text-xs font-semibold text-amber-600">
                    Skill Session not passed for: {gates.pendingSkillSessions.join(", ")}
                  </p>
                )}
                {gates?.missingMandatory?.length > 0 && (
                  <p className="mb-3 text-xs font-semibold text-amber-600">
                    Items still missing: {gates.missingMandatory.join(", ")}
                  </p>
                )}

                <button
                  onClick={completeTraining}
                  disabled={!gates?.canComplete || !sewak.kycVerified || busy === "complete"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy === "complete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Training Done — Activate Profile
                </button>
                {!gates?.canComplete && (
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    Both checks above must pass before the profile can go live.
                  </p>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TrainingPanelBoard;
