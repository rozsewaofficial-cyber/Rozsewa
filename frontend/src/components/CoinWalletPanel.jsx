import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Clock,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import API from "@/lib/api";

/**
 * The RozSewa Coins wallet dashboard, shared by the customer and
 * Partner/Sewak pages. Both roles see the same balance, aggregates and ledger;
 * only what the coins may be spent on differs, and the server tells us which
 * that is (`redeemableFor`) rather than the client inferring it from the role.
 */

const SOURCE_LABELS = {
  REFERRAL_REWARD: "Referral reward",
  FIRST_ORDER: "First order reward",
  TARGET_ACHIEVEMENT: "Target achieved",
  ORDER_DISCOUNT: "Order discount",
  SUB_DISCOUNT: "Subscription discount",
  CLAWBACK: "Reward reversed",
  REFUND: "Refunded",
  EXPIRY: "Expired",
  ADMIN_ADJUSTMENT: "Adjustment by RozSewa",
};

const TYPE_STYLES = {
  CREDIT: { sign: "+", cls: "text-emerald-600 dark:text-emerald-400" },
  DEBIT: { sign: "−", cls: "text-slate-600 dark:text-slate-300" },
  REVERSAL: { sign: "−", cls: "text-rose-600 dark:text-rose-400" },
  EXPIRY: { sign: "−", cls: "text-amber-600 dark:text-amber-400" },
};

// Written out in full rather than interpolated — Tailwind only ships classes
// it can find as literal strings in the source.
const TONE_CLASSES = {
  emerald: "text-emerald-500",
  blue: "text-blue-500",
  amber: "text-amber-500",
  slate: "text-slate-500",
};

const StatTile = ({ icon: Icon, label, value, tone = "slate" }) => (
  <div className="rounded-2xl border border-border bg-card p-4">
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${TONE_CLASSES[tone] || TONE_CLASSES.slate}`} />
      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
    <p className="mt-2 text-xl font-black tabular-nums text-foreground">
      {(value || 0).toLocaleString("en-IN")}
    </p>
  </div>
);

const CoinWalletPanel = () => {
  const [wallet, setWallet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [w, h] = await Promise.all([
          API.get("/coins/wallet"),
          API.get("/coins/history?page=1&limit=20"),
        ]);
        setWallet(w.data);
        setEntries(h.data.entries || []);
        setPages(h.data.pages || 1);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "We couldn't load your coins right now.",
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const { data } = await API.get(`/coins/history?page=${next}&limit=20`);
      setEntries((prev) => [...prev, ...(data.entries || [])]);
      setPage(next);
      setPages(data.pages || next);
    } catch (err) {
      // Leave what's already loaded on screen.
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !wallet) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!wallet.enabled) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Coins className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          The RozSewa Coins programme isn't active right now.
        </p>
      </div>
    );
  }

  const spendOn =
    wallet.redeemableFor === "subscription"
      ? "subscription purchases and renewals"
      : "discounts at checkout";

  return (
    <div className="space-y-5">
      {/* Balance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-500 via-amber-500 to-orange-600 p-7 text-white shadow-xl"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            <span className="text-[11px] font-black uppercase tracking-widest opacity-90">
              RozSewa Coins
            </span>
          </div>
          <p className="mt-4 text-5xl font-black tabular-nums leading-none">
            {wallet.balance.toLocaleString("en-IN")}
          </p>
          <p className="mt-2 text-sm font-bold opacity-90">
            Worth ₹{wallet.balanceValue.toLocaleString("en-IN")} ·{" "}
            {wallet.config.coinsPerRupee} coins = ₹1
          </p>
          <p className="mt-4 text-xs font-semibold opacity-80">
            Use them for {spendOn} — up to {wallet.config.maxDiscountPercent}% of
            each payment.
          </p>
        </div>
      </motion.div>

      {wallet.isFrozen && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-bold text-rose-700 dark:text-rose-400">
              This wallet is on hold
            </p>
            <p className="text-xs font-medium text-rose-600/80 dark:text-rose-400/70">
              {wallet.freezeReason} — you can still earn coins, but redeeming is
              paused. Please contact support.
            </p>
          </div>
        </div>
      )}

      {wallet.expiringSoon > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {wallet.expiringSoon.toLocaleString("en-IN")} coins expire on{" "}
            {new Date(wallet.nextExpiryDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            . Use them before they lapse.
          </p>
        </div>
      )}

      {/* Lifetime aggregates */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={TrendingUp} label="Total earned" value={wallet.totalEarned} tone="emerald" />
        <StatTile icon={TrendingDown} label="Total used" value={wallet.totalUsed} tone="blue" />
        <StatTile icon={Clock} label="Expired" value={wallet.totalExpired} tone="amber" />
        <StatTile icon={RotateCcw} label="Refunded" value={wallet.totalRefunded} tone="slate" />
      </div>

      {/* Ledger */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
            Coin history
          </h3>
        </div>

        {entries.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Coins className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-semibold text-muted-foreground">
              No coin activity yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => {
              const style = TYPE_STYLES[entry.type] || TYPE_STYLES.DEBIT;
              return (
                <div
                  key={entry._id}
                  className="flex items-start justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {SOURCE_LABELS[entry.source] || entry.source}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                      {entry.description}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground/70">
                      {new Date(entry.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {entry.transactionId}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-black tabular-nums ${style.cls}`}>
                      {style.sign}
                      {entry.coins.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      ₹{entry.monetaryValue}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {page < pages && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="flex w-full items-center justify-center gap-2 border-t border-border py-4 text-xs font-black uppercase tracking-wider text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Load more
          </button>
        )}
      </div>

      <p className="px-1 text-center text-[11px] font-medium leading-relaxed text-muted-foreground">
        RozSewa Coins are platform reward points. They cannot be withdrawn as
        cash, transferred to a bank account, or sent to another user.
      </p>
    </div>
  );
};

export default CoinWalletPanel;
