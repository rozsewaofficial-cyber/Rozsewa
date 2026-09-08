import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Coins, Loader2, X, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

/**
 * RozSewa Coins redemption control, shared by customer checkout
 * (purpose="order") and Partner/Sewak subscription checkout
 * (purpose="subscription").
 *
 * The client never computes a discount. It asks the server how much may be
 * applied (POST /coins/quote), and to actually apply it, it asks the server to
 * reserve the coins (POST /coins/hold) and passes only the returned
 * redemptionId onward. The parent sends that id with its own payment call; the
 * server re-derives the discount from the hold. That is what keeps the discount
 * un-tamperable from the browser.
 *
 * The applied redemption is owned by the PARENT and passed back in as `value`,
 * rather than mirrored in local state. The parent has to hold it anyway (it
 * sends the id with the payment), and keeping a second copy here meant a
 * remount of this card silently lost the "applied" view while the parent still
 * had the discount — the bill showed a coin discount with no way to remove it.
 *
 * Props:
 *   amount       gross payable before coins
 *   purpose      "order" | "subscription"
 *   value        the applied redemption ({ redemptionId, coins, discount, quotedAmount }) or null
 *   onChange     called with that shape, or null when cleared
 *   disabled     lock the control while the parent is mid-payment
 */
const CoinRedeemCard = ({ amount, purpose, value = null, onChange, disabled = false }) => {
  const { toast } = useToast();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const applied = value;

  const fetchQuote = useCallback(async () => {
    if (!amount || amount <= 0) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await API.post("/coins/quote", { amount, purpose });
      setQuote(data);
    } catch (err) {
      // A wallet-less account (or coins switched off) simply hides the card.
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [amount, purpose]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // If the basket changes after coins were applied, the old hold was quoted
  // against a stale amount — drop it so the user re-applies against the new one.
  useEffect(() => {
    if (applied && applied.quotedAmount !== amount) {
      handleRemove(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  const handleApply = async () => {
    if (!quote?.eligible || applying) return;
    setApplying(true);
    try {
      const { data } = await API.post("/coins/hold", {
        coins: quote.maxCoins,
        amount,
        purpose,
      });
      onChange?.({
        redemptionId: data.redemptionId,
        coins: data.coins,
        discount: data.discount,
        quotedAmount: amount,
      });
      toast({
        title: `${data.coins} coins applied`,
        description: `You saved ₹${data.discount} on this payment.`,
      });
    } catch (err) {
      toast({
        title: "Could not apply coins",
        description: err.response?.data?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleRemove = async (silent = false) => {
    const current = applied;
    onChange?.(null);
    if (!current) return;
    try {
      // Hand the coins straight back rather than waiting for the hold to age
      // out, so the balance is spendable again immediately.
      await API.post("/coins/release", {
        redemptionId: current.redemptionId,
        reason: "Removed at checkout",
      });
    } catch (err) {
      // The server-side sweeper will reclaim it regardless.
    }
    await fetchQuote();
    if (!silent) toast({ title: "Coins removed" });
  };

  if (loading) return null;
  // Nothing to show if the programme is off, or the wallet is empty and there
  // is no useful message to surface.
  if (!quote || !quote.config?.enabled) return null;
  if (!quote.eligible && !quote.balance) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
          <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-foreground">RozSewa Coins</p>
            <p className="shrink-0 text-xs font-semibold text-muted-foreground">
              {quote.balance.toLocaleString("en-IN")} coins · ₹{quote.balanceValue}
            </p>
          </div>

          {/* Rendered as a plain conditional rather than through
              AnimatePresence: with mode="wait" the exiting branch could keep
              hold of the slot and the replacement never mounted, leaving the
              bill showing a coin discount while this card still offered to
              apply one. The fade was decorative; correctness is not. */}
          <div>
            {applied ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {applied.coins.toLocaleString("en-IN")} coins applied — you save ₹
                  {applied.discount}
                </p>
                <button
                  type="button"
                  onClick={() => handleRemove()}
                  disabled={disabled}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            ) : quote.eligible ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Use{" "}
                  <span className="font-bold text-foreground">
                    {quote.maxCoins.toLocaleString("en-IN")}
                  </span>{" "}
                  coins to save{" "}
                  <span className="font-bold text-foreground">₹{quote.maxDiscount}</span>
                </p>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={handleApply}
                  disabled={disabled || applying}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60"
                >
                  {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Apply
                </motion.button>
              </div>
            ) : (
              <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {quote.reason}
              </p>
            )}
          </div>

          <p className="mt-2 text-[11px] font-medium text-muted-foreground">
            Up to {quote.config.maxDiscountPercent}% of this payment ·{" "}
            {quote.config.coinsPerRupee} coins = ₹1
          </p>
        </div>
      </div>
    </div>
  );
};

export default CoinRedeemCard;
