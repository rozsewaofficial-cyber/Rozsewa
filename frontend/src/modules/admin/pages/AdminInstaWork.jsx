import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Zap, Plus, Loader2, Pencil, Trash2, X, Save, Users, Activity, Clock,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import API from "@/lib/api";
import TablePager from "@/modules/admin/components/TablePager";

/**
 * Admin "⚡ Insta Work Management" — the service master, the platform pricing
 * rules, and a live view of jobs in flight.
 */

const PRICING_LABELS = {
  per_hour: "Per Hour",
  per_km: "Per KM",
  per_meter: "Per Meter",
  per_unit: "Per Unit",
  custom: "Custom",
};

const UNIT_OF = {
  per_hour: "Hour",
  per_km: "KM",
  per_meter: "Meter",
  per_unit: "Unit",
  custom: "Job",
};

const emptyService = {
  name: "",
  description: "",
  icon: "Zap",
  pricingType: "per_hour",
  sewakRate: "",
  minRate: "",
  maxRate: "",
  baseChargeEnabled: false,
  baseCharge: "",
  minQuantity: 1,
  maxQuantity: 12,
  availableFor: ["sewak", "partner"],
  isActive: true,
};

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
      {label}
    </span>
    {children}
    {hint && (
      <span className="mt-1 block text-[11px] font-medium text-gray-400">{hint}</span>
    )}
  </label>
);

const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-blue-500";

const JOBS_PER_PAGE = 30;

const AdminInstaWork = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState("services");
  const [services, setServices] = useState([]);
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyService);

  useEffect(() => setTitle("Insta Work"), [setTitle]);

  const load = useCallback(async () => {
    try {
      const [s, c, st] = await Promise.all([
        API.get("/admin/insta/services"),
        API.get("/admin/insta/config"),
        API.get("/admin/insta/stats"),
      ]);
      setServices(s.data.services || []);
      setConfig(c.data);
      setStats(st.data);
    } catch (err) {
      toast({
        title: "Failed to load Insta Work",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The server already reports how many jobs matched; the tab used to fetch a
  // page of 30 and throw that away, so an admin could not tell thirty jobs
  // from the first thirty of three thousand.
  const loadJobs = useCallback(async (toPage = 1) => {
    try {
      const { data } = await API.get(
        `/admin/insta/jobs?limit=${JOBS_PER_PAGE}&page=${toPage}`
      );
      setJobs(data.jobs || []);
      setJobsTotal(Number(data.total) || 0);
      setJobsPage(toPage);
    } catch (err) {
      /* the tab simply shows nothing */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "jobs") loadJobs();
  }, [tab, loadJobs]);

  const isCustom = form.pricingType === "custom";
  const servesPartner = form.availableFor.includes("partner");
  const servesSewak = form.availableFor.includes("sewak");

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyService);
    setShowModal(true);
  };

  const openEdit = (svc) => {
    setEditingId(svc._id);
    setForm({
      name: svc.name,
      description: svc.description || "",
      icon: svc.icon || "Zap",
      pricingType: svc.pricingType,
      sewakRate: String(svc.sewakRate ?? ""),
      minRate: String(svc.minRate ?? ""),
      maxRate: String(svc.maxRate ?? ""),
      baseChargeEnabled: !!svc.baseChargeEnabled,
      baseCharge: String(svc.baseCharge ?? ""),
      minQuantity: svc.minQuantity,
      maxQuantity: svc.maxQuantity,
      availableFor: svc.availableFor || ["sewak", "partner"],
      isActive: svc.isActive,
    });
    setShowModal(true);
  };

  const toggleSupply = (model) =>
    setForm((f) => {
      const has = f.availableFor.includes(model);
      // At least one supply model must remain, or nobody can serve the service.
      if (has && f.availableFor.length === 1) return f;
      return {
        ...f,
        availableFor: has
          ? f.availableFor.filter((m) => m !== model)
          : [...f.availableFor, model],
      };
    });

  const saveService = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        sewakRate: Number(form.sewakRate) || 0,
        minRate: Number(form.minRate) || 0,
        maxRate: Number(form.maxRate) || 0,
        baseCharge: Number(form.baseCharge) || 0,
        minQuantity: Number(form.minQuantity) || 1,
        maxQuantity: Number(form.maxQuantity) || 1,
      };
      if (editingId) {
        await API.put(`/admin/insta/services/${editingId}`, payload);
        toast({ title: "Service updated" });
      } else {
        await API.post("/admin/insta/services", payload);
        toast({ title: "Service created" });
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (svc) => {
    try {
      await API.patch(`/admin/insta/services/${svc._id}/status`, {
        isActive: !svc.isActive,
      });
      load();
    } catch (err) {
      toast({ title: "Failed", description: err.response?.data?.message, variant: "destructive" });
    }
  };

  const removeService = async (svc) => {
    const ok = await confirm(`Remove "${svc.name}" from Insta Work?`, {
      title: "Delete Service",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await API.delete(`/admin/insta/services/${svc._id}`);
      toast({ title: "Service removed" });
      load();
    } catch (err) {
      toast({
        title: "Could not delete",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const { data } = await API.put("/admin/insta/config", config);
      setConfig(data.config);
      toast({ title: "Insta Work settings saved" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const setCfg = (path, value) =>
    setConfig((c) => {
      const next = { ...c };
      const keys = path.split(".");
      let node = next;
      for (let i = 0; i < keys.length - 1; i++) {
        node[keys[i]] = { ...node[keys[i]] };
        node = node[keys[i]];
      }
      node[keys[keys.length - 1]] = value;
      return next;
    });

  if (loading || !config) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-gray-900">
            <Zap className="h-6 w-6 text-amber-500" />
            Insta Work Management
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            On-demand jobs — service master, pricing rules and live monitoring.
          </p>
        </div>
        {tab === "services" && (
          <button
            onClick={openCreate}
            className="flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-amber-600 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Add Service
          </button>
        )}
      </div>

      {/* Live counters */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            // "Online" means matchable right now — pinging, not disabled, not
            // restricted. The count with the toggle on is shown beside it,
            // because the gap between the two is the useful thing: workers who
            // mean to be available but whose app is shut.
            {
              label: "Workers online",
              value: stats.workersOnline,
              sub: stats.workersEnabled !== undefined
                ? `of ${stats.workersEnabled} switched on`
                : null,
              icon: Users,
              color: "text-emerald-600"
            },
            { label: "Jobs completed", value: stats.completedJobs, icon: Activity, color: "text-blue-600" },
            { label: "Revenue", value: `₹${Math.round(stats.revenue).toLocaleString("en-IN")}`, icon: Zap, color: "text-amber-600" },
            { label: "Commission", value: `₹${Math.round(stats.commission).toLocaleString("en-IN")}`, icon: Clock, color: "text-purple-600" },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <k.icon className={`h-4 w-4 ${k.color}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  {k.label}
                </span>
              </div>
              <p className="mt-1 text-2xl font-black tabular-nums text-gray-900">{k.value}</p>
              {k.sub && (
                <p className="text-[10px] font-bold text-gray-400">{k.sub}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-gray-200 bg-white p-2">
        {[
          { key: "services", label: "Service Master" },
          { key: "pricing", label: "Pricing & Rules" },
          { key: "jobs", label: "Live Jobs" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
              tab === t.key ? "bg-amber-500 text-white" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ------------------------- Service master ------------------------- */}
      {tab === "services" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-bold">Service</th>
                  <th className="px-6 py-4 font-bold">Pricing</th>
                  <th className="px-6 py-4 font-bold">Sewak rate</th>
                  <th className="px-6 py-4 font-bold">Partner band</th>
                  <th className="px-6 py-4 font-bold">Base</th>
                  <th className="px-6 py-4 font-bold">Supply</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 text-center font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center text-sm font-semibold text-gray-400">
                      No Insta Work services yet. Add one to make it bookable.
                    </td>
                  </tr>
                ) : (
                  services.map((s) => (
                    <tr key={s._id} className="transition hover:bg-gray-50/60">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{s.name}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{s.description}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-black uppercase text-gray-600">
                        {PRICING_LABELS[s.pricingType]}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {s.availableFor.includes("sewak") ? `₹${s.sewakRate}` : "—"}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {s.availableFor.includes("partner") ? `₹${s.minRate} – ₹${s.maxRate}` : "—"}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-600">
                        {s.baseChargeEnabled ? `₹${s.baseCharge}` : "Off"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {s.availableFor.map((m) => (
                            <span
                              key={m}
                              className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-600"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleStatus(s)}
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            s.isActive
                              ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                              : "border-gray-200 bg-gray-100 text-gray-500"
                          }`}
                        >
                          {s.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(s)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-600 hover:text-white"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeService(s)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------- Pricing & rules ------------------------- */}
      {tab === "pricing" && (
        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Insta Work" hint="Switches the whole module off for customers.">
              <button
                onClick={() => setCfg("enabled", !config.enabled)}
                className={`mt-1.5 h-11 w-full rounded-xl text-xs font-black uppercase tracking-wider ${
                  config.enabled ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {config.enabled ? "Enabled" : "Disabled"}
              </button>
            </Field>
            <Field label="Billing interval" hint="Hourly work rounds up to this block.">
              <select
                value={config.billingIntervalMinutes}
                onChange={(e) => setCfg("billingIntervalMinutes", Number(e.target.value))}
                className={inputCls}
              >
                {[15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Match radius (km)" hint="How far to search for a worker.">
              <input
                type="number"
                min={1}
                value={config.matchRadiusKm}
                onChange={(e) => setCfg("matchRadiusKm", Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </div>

          <h3 className="pt-2 text-xs font-black uppercase tracking-wider text-gray-700">
            Waiting time
          </h3>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Arrival grace (min)" hint="Free waiting after the worker arrives.">
              <input
                type="number"
                min={0}
                value={config.arrivalGraceMinutes}
                onChange={(e) => setCfg("arrivalGraceMinutes", Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Waiting charge (₹/min)" hint="Charged only after the grace period.">
              <input
                type="number"
                min={0}
                value={config.idleChargePerMinute}
                onChange={(e) => setCfg("idleChargePerMinute", Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Overrun threshold (min)" hint="Past this, the customer must approve more time.">
              <input
                type="number"
                min={0}
                value={config.overrunThresholdMinutes}
                onChange={(e) => setCfg("overrunThresholdMinutes", Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field
              label="Auto-confirm after (hours)"
              hint="Finished work the customer never confirms is confirmed for them. Cash jobs then settle; online jobs move to awaiting payment. 0 switches it off."
            >
              <input
                type="number"
                min={0}
                value={config.autoConfirmHours ?? 0}
                onChange={(e) => setCfg("autoConfirmHours", Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </div>

          <h3 className="pt-2 text-xs font-black uppercase tracking-wider text-gray-700">
            Cancellation fees (₹)
          </h3>
          <div className="grid gap-5 sm:grid-cols-4">
            {[
              ["beforeAcceptance", "Before acceptance"],
              ["afterAcceptance", "After acceptance"],
              ["afterArrival", "After arrival"],
              ["workStarted", "Work started"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  min={0}
                  value={config.cancellationFees[key]}
                  onChange={(e) => setCfg(`cancellationFees.${key}`, Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            ))}
          </div>

          <h3 className="pt-2 text-xs font-black uppercase tracking-wider text-gray-700">
            Repeated cancellation policy
          </h3>
          <div className="grid gap-5 sm:grid-cols-4">
            {[
              ["warnAfter", "Warn after"],
              ["restrictAfter", "Restrict after"],
              ["restrictionHours", "Restriction (hours)"],
              ["disableAfter", "Disable after"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  min={0}
                  value={config.cancellationPolicy[key]}
                  onChange={(e) => setCfg(`cancellationPolicy.${key}`, Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            ))}
          </div>

          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-8 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
        </div>
      )}

      {/* ---------------------------- Live jobs ---------------------------- */}
      {tab === "jobs" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-bold">Job</th>
                  <th className="px-6 py-4 font-bold">Service</th>
                  <th className="px-6 py-4 font-bold">Supply</th>
                  <th className="px-6 py-4 font-bold">Worker</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-sm font-semibold text-gray-400">
                      No Insta Work jobs yet.
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => (
                    <tr key={j._id} className="transition hover:bg-gray-50/60">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-gray-900">{j.jobCode}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{j.serviceName}</td>
                      <td className="px-6 py-4 text-xs font-black uppercase text-gray-600">{j.supplyModel}</td>
                      <td className="px-6 py-4 text-gray-700">
                        {j.providerId?.ownerName || j.providerId?.shopName || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-gray-700">
                          {j.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-gray-900">
                        ₹{j.finalAmount || j.estimateAmount}
                        {!j.finalAmount && (
                          <span className="ml-1 text-[10px] font-bold uppercase text-gray-400">est</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <TablePager
              page={jobsPage}
              total={jobsTotal}
              perPage={JOBS_PER_PAGE}
              onPage={loadJobs}
              noun="jobs"
            />
          </div>
        </div>
      )}

      {/* ------------------------- Create / edit ------------------------- */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <h3 className="text-lg font-black tracking-tight text-gray-900">
                {editingId ? "Edit Insta Service" : "New Insta Service"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Service name *">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Bathroom Cleaning"
                    className={inputCls}
                  />
                </Field>
                <Field label="Pricing type *">
                  <select
                    value={form.pricingType}
                    onChange={(e) => setForm({ ...form, pricingType: e.target.value })}
                    className={inputCls}
                  >
                    {Object.entries(PRICING_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Description">
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <Field label="Supply model *" hint="Who can serve this service.">
                <div className="mt-1.5 flex gap-2">
                  {["sewak", "partner"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleSupply(m)}
                      className={`h-11 flex-1 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                        form.availableFor.includes(m)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {m === "sewak" ? "Sewak (auto-assign)" : "Partner (customer picks)"}
                    </button>
                  ))}
                </div>
              </Field>

              {servesSewak && (
                <Field
                  label={`Sewak rate (₹ per ${UNIT_OF[form.pricingType]}) *`}
                  hint="Admin-fixed. Sewaks cannot change this."
                >
                  <input
                    type="number"
                    min={0}
                    value={form.sewakRate}
                    onChange={(e) => setForm({ ...form, sewakRate: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              )}

              {servesPartner && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`Partner min rate (₹/${UNIT_OF[form.pricingType]}) *`}>
                    <input
                      type="number"
                      min={0}
                      value={form.minRate}
                      onChange={(e) => setForm({ ...form, minRate: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field
                    label={`Partner max rate (₹/${UNIT_OF[form.pricingType]}) *`}
                    hint="Partners set their own rate inside this band."
                  >
                    <input
                      type="number"
                      min={0}
                      value={form.maxRate}
                      onChange={(e) => setForm({ ...form, maxRate: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Base charge" hint="Flat fee on top, e.g. Delivery = ₹30 + ₹15/KM.">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, baseChargeEnabled: !form.baseChargeEnabled })}
                    className={`mt-1.5 h-11 w-full rounded-xl text-xs font-black uppercase tracking-wider ${
                      form.baseChargeEnabled ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {form.baseChargeEnabled ? "Enabled" : "Disabled"}
                  </button>
                </Field>
                {form.baseChargeEnabled && (
                  <Field label="Base charge amount (₹) *">
                    <input
                      type="number"
                      min={0}
                      value={form.baseCharge}
                      onChange={(e) => setForm({ ...form, baseCharge: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                )}
              </div>

              {!isCustom && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`Min ${UNIT_OF[form.pricingType]}s per job *`}>
                    <input
                      type="number"
                      min={1}
                      value={form.minQuantity}
                      onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label={`Max ${UNIT_OF[form.pricingType]}s per job *`}>
                    <input
                      type="number"
                      min={1}
                      value={form.maxQuantity}
                      onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              <button
                onClick={saveService}
                disabled={saving || !form.name}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Save changes" : "Create service"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminInstaWork;
