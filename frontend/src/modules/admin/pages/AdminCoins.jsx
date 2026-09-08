import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Coins,
  Save,
  Loader2,
  Search,
  Lock,
  Unlock,
  Plus,
  Minus,
  RefreshCw,
  History,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ROLE_TABS = [
  { key: "customer", label: "Customer" },
  { key: "partner", label: "Partner / Local Expert" },
  { key: "sewak", label: "Sewak" },
];

const PERIODS = ["lifetime", "daily", "weekly", "monthly"];

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    {children}
    {hint && (
      <span className="mt-1 block text-[11px] font-medium text-muted-foreground/70">
        {hint}
      </span>
    )}
  </label>
);

const NumberInput = (props) => (
  <input
    type="number"
    {...props}
    className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
  />
);

const AdminCoins = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [roleTab, setRoleTab] = useState("customer");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [wallets, setWallets] = useState([]);
  const [search, setSearch] = useState("");
  const [walletsLoading, setWalletsLoading] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustType, setAdjustType] = useState("credit");
  const [adjustCoins, setAdjustCoins] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        API.get("/admin/coins/config"),
        API.get("/admin/coins/stats"),
      ]);
      setConfig(c.data);
      setStats(s.data);
    } catch (err) {
      toast({
        title: "Failed to load coin settings",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWallets = useCallback(async () => {
    setWalletsLoading(true);
    try {
      const { data } = await API.get(
        `/admin/coins/wallets?limit=25${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      );
      setWallets(data.wallets || []);
    } catch (err) {
      // Leave the previous list on screen.
    } finally {
      setWalletsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    setTitle("RozSewa Coins");
  }, [setTitle]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  const setRoleField = (field, value) =>
    setConfig((prev) => ({
      ...prev,
      [roleTab]: { ...prev[roleTab], [field]: value },
    }));

  const setTarget = (index, field, value) =>
    setConfig((prev) => {
      const targets = [...prev[roleTab].targets];
      targets[index] = { ...targets[index], [field]: Number(value) || 0 };
      return { ...prev, [roleTab]: { ...prev[roleTab], targets } };
    });

  const addTarget = () =>
    setConfig((prev) => ({
      ...prev,
      [roleTab]: {
        ...prev[roleTab],
        targets: [...prev[roleTab].targets, { orders: 0, coins: 0 }],
      },
    }));

  const removeTarget = (index) =>
    setConfig((prev) => ({
      ...prev,
      [roleTab]: {
        ...prev[roleTab],
        targets: prev[roleTab].targets.filter((_, i) => i !== index),
      },
    }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await API.put("/admin/coins/config", config);
      setConfig(data.config);
      toast({ title: "Coin settings saved" });
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

  const handleAdjust = async () => {
    if (!adjustTarget) return;
    setAdjusting(true);
    try {
      const { data } = await API.post("/admin/coins/adjust", {
        ownerId: adjustTarget.ownerId,
        type: adjustType,
        coins: Number(adjustCoins),
        reason: adjustReason,
      });
      toast({ title: data.message });
      setAdjustTarget(null);
      setAdjustCoins("");
      setAdjustReason("");
      loadWallets();
      loadAll();
    } catch (err) {
      toast({
        title: "Adjustment failed",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setAdjusting(false);
    }
  };

  const handleFreeze = async (wallet) => {
    const next = !wallet.isFrozen;
    let reason = wallet.freezeReason;
    if (next) {
      reason = window.prompt("Reason for freezing this wallet:");
      if (!reason || reason.trim().length < 3) return;
    }
    try {
      await API.patch(`/admin/coins/wallets/${wallet.ownerId}/freeze`, {
        frozen: next,
        reason,
      });
      toast({ title: next ? "Wallet frozen" : "Wallet unfrozen" });
      loadWallets();
    } catch (err) {
      toast({
        title: "Failed to update wallet",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    }
  };

  const openHistory = async (wallet) => {
    setHistoryFor(wallet);
    setHistory([]);
    try {
      const { data } = await API.get(
        `/admin/coins/wallets/${wallet.ownerId}/history?limit=50`,
      );
      setHistory(data.entries || []);
    } catch (err) {
      toast({ title: "Failed to load history", variant: "destructive" });
    }
  };

  const handleExpirySweep = async () => {
    try {
      const { data } = await API.post("/admin/coins/run-expiry");
      toast({
        title: "Expiry sweep complete",
        description: `${data.coins} coins expired across ${data.lots} batches. ${data.staleHoldsReleased} stale holds released.`,
      });
      loadAll();
      loadWallets();
    } catch (err) {
      toast({ title: "Sweep failed", variant: "destructive" });
    }
  };

  if (loading || !config) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rc = config[roleTab];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tighter text-foreground">
              <Coins className="h-6 w-6 text-amber-500" />
              RozSewa Coins
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Reward rules, redemption limits, wallets and manual overrides.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpirySweep}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-black uppercase tracking-wider text-muted-foreground hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              Run expiry sweep
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save settings
            </button>
          </div>
        </div>

        {/* Liability snapshot */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Coins outstanding
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {stats.outstandingCoins.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Liability value
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-amber-600">
                ₹{stats.outstandingValue.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Wallets
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {stats.walletCount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Programme
              </p>
              <p
                className={`mt-1 text-2xl font-black ${config.enabled ? "text-emerald-600" : "text-rose-600"}`}
              >
                {config.enabled ? "Live" : "Off"}
              </p>
            </div>
          </div>
        )}

        {/* Global settings */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-5 text-sm font-black uppercase tracking-wider text-foreground">
            Global settings
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              label="Coin system"
              hint="Turning this off hides coins everywhere and blocks new redemptions. Existing balances are preserved."
            >
              <button
                type="button"
                onClick={() =>
                  setConfig({ ...config, enabled: !config.enabled })
                }
                className={`mt-1.5 flex h-11 w-full items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider transition ${
                  config.enabled
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {config.enabled ? "Enabled" : "Disabled"}
              </button>
            </Field>
            <Field
              label="Conversion ratio"
              hint={`${config.coinsPerRupee} coins = ₹1`}
            >
              <NumberInput
                min={1}
                value={config.coinsPerRupee}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    coinsPerRupee: Number(e.target.value) || 1,
                  })
                }
              />
            </Field>
            <Field
              label="Max referrals rewarded / day"
              hint="Anti-fraud cap per referrer."
            >
              <NumberInput
                min={0}
                value={config.antiFraud.maxReferralsPerDay}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    antiFraud: {
                      ...config.antiFraud,
                      maxReferralsPerDay: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </Field>
          </div>
        </div>

        {/* Per-role settings */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex gap-1 border-b border-border p-2">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRoleTab(tab.key)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
                  roleTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-6 p-6">
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
              {roleTab === "customer"
                ? "Customer coins can only be redeemed against order checkout — never subscriptions."
                : "Partner and Sewak coins can only be redeemed against subscription purchase or renewal — never customer orders."}
            </p>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Max discount %" hint="Share of each payment coins may cover.">
                <NumberInput
                  min={0}
                  max={100}
                  value={rc.maxDiscountPercent}
                  onChange={(e) =>
                    setRoleField("maxDiscountPercent", Number(e.target.value) || 0)
                  }
                />
              </Field>
              {roleTab === "customer" && (
                <Field label="Minimum order value" hint="Coins are blocked below this.">
                  <NumberInput
                    min={0}
                    value={rc.minOrderValue}
                    onChange={(e) =>
                      setRoleField("minOrderValue", Number(e.target.value) || 0)
                    }
                  />
                </Field>
              )}
              <Field label="Minimum redemption" hint="Fewest coins that may be spent at once.">
                <NumberInput
                  min={0}
                  value={rc.minRedemption}
                  onChange={(e) =>
                    setRoleField("minRedemption", Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field label="Coin expiry (days)">
                <NumberInput
                  min={1}
                  value={rc.expiryDays}
                  onChange={(e) =>
                    setRoleField("expiryDays", Number(e.target.value) || 1)
                  }
                />
              </Field>
              <Field label="Target window">
                <select
                  value={rc.targetPeriod}
                  onChange={(e) => setRoleField("targetPeriod", e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold capitalize text-foreground outline-none focus:border-primary"
                >
                  {PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {roleTab === "customer" && (
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Referral reward (coins)">
                  <NumberInput
                    min={0}
                    value={rc.referralReward}
                    onChange={(e) =>
                      setRoleField("referralReward", Number(e.target.value) || 0)
                    }
                  />
                </Field>
                <Field label="First order reward (coins)">
                  <NumberInput
                    min={0}
                    value={rc.firstOrderReward}
                    onChange={(e) =>
                      setRoleField("firstOrderReward", Number(e.target.value) || 0)
                    }
                  />
                </Field>
                <Field
                  label="Also count first order in Target 1"
                  hint="Off means a customer's first order pays the First Order reward only, never both."
                >
                  <button
                    type="button"
                    onClick={() =>
                      setRoleField(
                        "countFirstOrderInTarget",
                        !rc.countFirstOrderInTarget,
                      )
                    }
                    className={`mt-1.5 flex h-11 w-full items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider transition ${
                      rc.countFirstOrderInTarget
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {rc.countFirstOrderInTarget ? "Both awarded" : "No double reward"}
                  </button>
                </Field>
              </div>
            )}

            {/* Targets */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Order targets
                </h3>
                <button
                  type="button"
                  onClick={addTarget}
                  className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add tier
                </button>
              </div>
              <div className="space-y-2">
                {rc.targets.map((target, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      value={target.orders}
                      onChange={(e) => setTarget(index, "orders", e.target.value)}
                      className="h-10 w-28 rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                    <span className="text-xs font-bold text-muted-foreground">
                      orders →
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={target.coins}
                      onChange={(e) => setTarget(index, "coins", e.target.value)}
                      className="h-10 w-32 rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                    />
                    <span className="text-xs font-bold text-muted-foreground">
                      coins (₹
                      {Math.floor((target.coins || 0) / config.coinsPerRupee)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTarget(index)}
                      className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Wallets */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              Coin wallets
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, mobile or referral code"
                className="h-10 w-72 rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {walletsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : wallets.length === 0 ? (
            <p className="py-12 text-center text-sm font-semibold text-muted-foreground">
              No wallets found.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {wallets.map((wallet) => (
                <div
                  key={wallet._id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-foreground">
                        {wallet.owner?.name || "Unknown"}
                      </p>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        {wallet.ownerType}
                      </span>
                      {wallet.isFrozen && (
                        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:bg-rose-950/30">
                          Frozen
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {wallet.owner?.mobile} · earned{" "}
                      {wallet.totalEarned.toLocaleString("en-IN")} · used{" "}
                      {wallet.totalUsed.toLocaleString("en-IN")}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-black tabular-nums text-foreground">
                        {wallet.balance.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        ₹{wallet.balanceValue}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openHistory(wallet)}
                      title="View ledger"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustTarget(wallet)}
                      className="rounded-lg border border-border px-3 py-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground hover:bg-muted"
                    >
                      Adjust
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFreeze(wallet)}
                      title={wallet.isFrozen ? "Unfreeze" : "Freeze"}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                    >
                      {wallet.isFrozen ? (
                        <Unlock className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual adjustment */}
      {adjustTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight text-foreground">
                  Manual adjustment
                </h3>
                <p className="text-xs font-semibold text-muted-foreground">
                  {adjustTarget.owner?.name} · balance{" "}
                  {adjustTarget.balance.toLocaleString("en-IN")} coins
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                {["credit", "debit"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAdjustType(t)}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition ${
                      adjustType === t
                        ? t === "credit"
                          ? "bg-emerald-500 text-white"
                          : "bg-rose-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <Field label="Coins">
                <NumberInput
                  min={1}
                  value={adjustCoins}
                  onChange={(e) => setAdjustCoins(e.target.value)}
                />
              </Field>

              <Field
                label="Reason"
                hint="Required. Recorded against the coin ledger and the platform audit log."
              >
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-3 text-sm font-medium text-foreground outline-none focus:border-primary"
                  placeholder="e.g. Goodwill credit for support ticket #1234"
                />
              </Field>

              <button
                type="button"
                onClick={handleAdjust}
                disabled={
                  adjusting ||
                  !Number(adjustCoins) ||
                  adjustReason.trim().length < 3
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-wider text-primary-foreground disabled:opacity-50"
              >
                {adjusting && <Loader2 className="h-4 w-4 animate-spin" />}
                Apply adjustment
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Ledger drawer */}
      {historyFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-border p-5">
              <div>
                <h3 className="text-lg font-black tracking-tight text-foreground">
                  Coin ledger
                </h3>
                <p className="text-xs font-semibold text-muted-foreground">
                  {historyFor.owner?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryFor(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 divide-y divide-border overflow-y-auto">
              {history.length === 0 ? (
                <p className="py-12 text-center text-sm font-semibold text-muted-foreground">
                  No entries.
                </p>
              ) : (
                history.map((entry) => (
                  <div key={entry._id} className="flex justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        {entry.source}
                      </p>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {entry.description}
                      </p>
                      <p className="text-[11px] font-semibold text-muted-foreground/70">
                        {new Date(entry.createdAt).toLocaleString("en-IN")} ·{" "}
                        {entry.transactionId}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-black tabular-nums ${
                          entry.type === "CREDIT"
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {entry.type === "CREDIT" ? "+" : "−"}
                        {entry.coins.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        bal {entry.newBalance.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default AdminCoins;
