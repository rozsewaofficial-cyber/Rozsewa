import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet, Save, Loader2, Info, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const WEEKDAYS = [
  { id: 0, label: "Sunday" }, { id: 1, label: "Monday" }, { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" }, { id: 4, label: "Thursday" }, { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
];

const AdminKitPaymentSettings = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState("");
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setTitle("Kit Payment Settings"); }, [setTitle]);

  useEffect(() => {
    API.get("/admin/categories")
      .then(({ data }) => {
        setCategories(data || []);
        if (data?.length) setSelectedCat(data[0]._id);
      })
      .catch(() => toast({ title: "Could not load categories", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const fetchConfig = useCallback(async (categoryId) => {
    if (!categoryId) return;
    setLoading(true);
    try {
      const { data } = await API.get(`/admin/kit-payment-config/${categoryId}`);
      setConfig(data);
    } catch {
      toast({ title: "Could not load payment settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfig(selectedCat); }, [selectedCat, fetchConfig]);

  const save = async (e) => {
    e.preventDefault();
    const allowsPart = config.paymentMode === "part" || config.paymentMode === "both";
    if (allowsPart && !(Number(config.instalmentAmount) > 0)) {
      return toast({ title: "Set an instalment amount above 0 for part payment", variant: "destructive" });
    }

    setSaving(true);
    try {
      const { data } = await API.put(`/admin/kit-payment-config/${selectedCat}`, config);
      setConfig(data);
      toast({ title: "Payment settings saved" });
    } catch (err) {
      toast({ title: "Save failed", description: err.response?.data?.message || "Could not save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500";
  const labelCls = "block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5";
  const allowsPart = config && (config.paymentMode === "part" || config.paymentMode === "both");

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <label className={labelCls}>Category</label>
        <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)} className={inputCls}>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <p className="mt-1.5 text-[11px] text-slate-400">
          These rules apply to every starter kit and combo pack purchase in this category.
        </p>
      </div>

      {loading || !config ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>
      ) : (
        <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={save}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">

          {config._unsaved && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30 px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                Showing defaults — nothing saved for this category yet. Save to apply.
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Payment Options Allowed</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "full", label: "Full Only" },
                { id: "part", label: "Part Only" },
                { id: "both", label: "Both" },
              ].map((o) => (
                <button key={o.id} type="button" onClick={() => setConfig({ ...config, paymentMode: o.id })}
                  className={`rounded-xl border-2 py-3 text-sm font-bold transition-colors ${config.paymentMode === o.id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              "Full Only" means the Sewak must pay the whole amount up front.
            </p>
          </div>

          {allowsPart && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                <label className={labelCls}>Down Payment</label>
                <div className="grid grid-cols-2 gap-3">
                  <select value={config.downPaymentType} onChange={(e) => setConfig({ ...config, downPaymentType: e.target.value })} className={inputCls}>
                    <option value="percentage">Percentage of total</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                  <input type="number" min="0" value={config.downPaymentValue}
                    onChange={(e) => setConfig({ ...config, downPaymentValue: Number(e.target.value) })}
                    className={inputCls} placeholder={config.downPaymentType === "percentage" ? "e.g. 50" : "e.g. 500"} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Recovery Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {["daily", "weekly", "monthly"].map((f) => (
                    <button key={f} type="button" onClick={() => setConfig({ ...config, deductionFrequency: f })}
                      className={`rounded-xl border-2 py-2.5 text-sm font-bold capitalize transition-colors ${config.deductionFrequency === f
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {config.deductionFrequency === "weekly" && (
                <div>
                  <label className={labelCls}>Deduct On</label>
                  <select value={config.weeklyDeductionDay} onChange={(e) => setConfig({ ...config, weeklyDeductionDay: Number(e.target.value) })} className={inputCls}>
                    {WEEKDAYS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              )}

              {config.deductionFrequency === "monthly" && (
                <div>
                  <label className={labelCls}>Deduct On Date</label>
                  <input type="number" min="1" max="28" value={config.monthlyDeductionDate}
                    onChange={(e) => setConfig({ ...config, monthlyDeductionDate: Number(e.target.value) })} className={inputCls} />
                  <p className="mt-1 text-[11px] text-slate-400">Capped at 28 so short months are never skipped.</p>
                </div>
              )}

              <div>
                <label className={labelCls}>Instalment Amount (₹) *</label>
                <input type="number" min="1" value={config.instalmentAmount}
                  onChange={(e) => setConfig({ ...config, instalmentAmount: Number(e.target.value) })} className={inputCls} required />
                <p className="mt-1 text-[11px] text-slate-400">
                  Deducted from the Sewak's wallet each cycle until the balance clears. The final
                  instalment is automatically just the remainder.
                </p>
              </div>

              <label className="flex items-start gap-2 cursor-pointer border-t border-slate-100 dark:border-slate-800 pt-5">
                <input type="checkbox" checked={config.blockPayoutOnDues !== false}
                  onChange={(e) => setConfig({ ...config, blockPayoutOnDues: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                    <Lock className="h-3.5 w-3.5" /> Block payouts while dues are pending
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    Withdrawals are blocked while the wallet is negative and instalments remain. The
                    Sewak can still work and earn — only withdrawal is paused.
                  </span>
                </span>
              </label>
            </>
          )}

          <button type="submit" disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
          </button>
        </motion.form>
      )}
    </div>
  );
};

export default AdminKitPaymentSettings;
