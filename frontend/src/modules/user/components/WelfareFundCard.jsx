import { useEffect, useState } from "react";
import { ShieldCheck, HeartHandshake, Loader2, Users, Wallet as WalletIcon, CreditCard } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const AMOUNT_OPTIONS = [10, 20, 50, 100];

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

/**
 * The customer's side of the RozSewa Welfare Fund.
 *
 * The same fund partners give to, from the other side of the marketplace. A
 * customer's money sits in a differently-keyed wallet, so the balance is read
 * from the wallet response rather than from the session — a partner carries
 * their balance on their profile, a customer does not.
 *
 * @param walletBalance what the customer has to give from.
 * @param onContributed called after a successful gift so the page that owns
 *        the wallet can refresh it; the balance shown here is not ours to fix
 *        up locally.
 */
const WelfareFundCard = ({ walletBalance = 0, onContributed }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(20);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPayingDirect, setIsPayingDirect] = useState(false);
  const [given, setGiven] = useState({ totalContributed: 0, contributionsCount: 0 });
  const [fund, setFund] = useState(null);

  const amount = isCustom ? Number(customAmount) || 0 : selectedAmount;

  const load = async () => {
    try {
      // What this customer has given, and what the fund holds. Both are totals
      // over everything, counted by the server.
      const [mine, summary] = await Promise.all([
        API.get("/welfare-fund/my-contributions", { params: { limit: 1 } }),
        API.get("/welfare-fund/summary")
      ]);
      setGiven({
        totalContributed: mine.data.totalContributed || 0,
        contributionsCount: mine.data.contributionsCount || 0
      });
      setFund(summary.data);
    } catch {
      // The card still offers to take a contribution without these.
    }
  };

  useEffect(() => { load(); }, []);

  const handleContribute = async () => {
    if (!amount || amount < 1) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (amount > walletBalance) {
      toast({
        title: "Not enough balance",
        description: `Your wallet has ₹${walletBalance}. Add money first, then contribute.`,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await API.post("/welfare-fund/contribute", { amount });
      toast({ title: "Thank you!", description: data.message });
      setOpen(false);
      setIsCustom(false);
      setCustomAmount("");
      await load();
      onContributed?.(data.walletBalance);
    } catch (err) {
      toast({
        title: "Contribution Failed",
        description: err.response?.data?.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // A card/UPI gift, independent of wallet balance — for a customer with
  // nothing in their wallet, or who'd simply rather not draw it down.
  const handleContributeDirect = async () => {
    if (!amount || amount < 1) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setIsPayingDirect(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast({ title: "Payment SDK failed to load", variant: "destructive" });
        setIsPayingDirect(false);
        return;
      }
      const { data: order } = await API.post("/welfare-fund/order", { amount });
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa Welfare Fund",
        description: "Anna Seva & Jeev Seva contribution",
        order_id: order.id,
        handler: async (response) => {
          try {
            await API.post("/welfare-fund/verify", { ...response, amount });
            toast({ title: "Thank you!", description: `Your ₹${amount} contribution has been received.` });
            setOpen(false);
            setIsCustom(false);
            setCustomAmount("");
            await load();
            onContributed?.();
          } catch (err) {
            toast({
              title: "Payment Verification Failed",
              description: err.response?.data?.message,
              variant: "destructive"
            });
          } finally {
            setIsPayingDirect(false);
          }
        },
        modal: { ondismiss: () => setIsPayingDirect(false) },
        prefill: { name: user?.name, email: user?.email, contact: user?.mobile },
        theme: { color: "#059669" }
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast({
        title: "Could Not Start Payment",
        description: err.response?.data?.message || err.message,
        variant: "destructive"
      });
      setIsPayingDirect(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 text-sm font-black text-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            RozSewa Welfare Fund
          </span>
          <p className="text-[11px] font-medium text-muted-foreground mt-1 max-w-[260px] leading-snug">
            Aapka chhota yogdaan, kisi ke liye badi seva. Anna Seva aur Jeev Seva ke
            liye — 100% voluntary.
          </p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex shrink-0 items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            Donate Now
          </button>
        )}
      </div>

      {(given.contributionsCount > 0 || fund) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-muted/50 px-4 py-3">
          {given.contributionsCount > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">You have given</p>
              <p className="text-sm font-black text-foreground">
                ₹{given.totalContributed.toLocaleString("en-IN")}
                <span className="text-[10px] font-bold text-muted-foreground ml-1.5">
                  over {given.contributionsCount} {given.contributionsCount === 1 ? "time" : "times"}
                </span>
              </p>
            </div>
          )}
          {fund && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Fund raised</p>
              <p className="text-sm font-black text-foreground flex items-center gap-1.5">
                ₹{fund.totalRaised.toLocaleString("en-IN")}
                <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {fund.contributors}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap gap-2">
            {AMOUNT_OPTIONS.map((amt) => (
              <button
                key={amt}
                onClick={() => { setIsCustom(false); setSelectedAmount(amt); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  !isCustom && selectedAmount === amt
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                ₹{amt}
              </button>
            ))}
            <button
              onClick={() => setIsCustom(true)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                isCustom
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              Custom
            </button>
          </div>

          {isCustom && (
            <input
              type="number"
              min="1"
              autoFocus
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Enter amount (₹)"
              className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleContribute}
              disabled={isSubmitting || isPayingDirect}
              className="py-2.5 rounded-xl text-[11px] font-bold bg-muted text-foreground border border-border hover:bg-muted/70 disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WalletIcon className="h-3.5 w-3.5" />}
              Pay via Wallet
            </button>
            <button
              onClick={handleContributeDirect}
              disabled={isSubmitting || isPayingDirect}
              className="py-2.5 rounded-xl text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {isPayingDirect ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              Pay via UPI/Card
            </button>
          </div>
          <button
            onClick={() => { setOpen(false); setIsCustom(false); setCustomAmount(""); }}
            className="w-full py-2 rounded-xl text-[10px] font-bold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <p className="text-[9px] text-muted-foreground font-medium text-center">
            Wallet balance: ₹{walletBalance.toLocaleString("en-IN")}
          </p>
        </div>
      )}
    </div>
  );
};

export default WelfareFundCard;
