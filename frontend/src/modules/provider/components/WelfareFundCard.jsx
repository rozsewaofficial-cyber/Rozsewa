import { useState } from "react";
import { ShieldCheck, HeartHandshake, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const AMOUNT_OPTIONS = [10, 20, 50, 100];

// Voluntary provider/Sewak contribution to the RozSewa Welfare Fund
// (replaces the old "Suraksha Nidhi" auto-deduction toggle, which was never
// actually wired to any real deduction — this is a real, ledgered donation).
const WelfareFundCard = () => {
  const { toast } = useToast();
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(20);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = isCustom ? Number(customAmount) || 0 : selectedAmount;

  const handleContribute = async () => {
    if (!amount || amount < 1) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data } = await API.post("/welfare-fund/contribute", { amount });
      updateUser({ walletBalance: data.walletBalance });
      toast({ title: "Thank you!", description: data.message });
      setOpen(false);
      setIsCustom(false);
      setCustomAmount("");
    } catch (err) {
      toast({
        title: "Contribution Failed",
        description: err.response?.data?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            RozSewa Welfare Fund
          </span>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 max-w-[240px] leading-tight">
            Aapka chhota yogdaan, kisi ke liye badi seva. Anna Seva aur Jeev Seva ke liye 100% voluntary contribution.
          </p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            Donate Now
          </button>
        )}
      </div>

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
                    : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
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
                  : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
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
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); setIsCustom(false); setCustomAmount(""); }}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleContribute}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Contribute ₹${amount || 0}`}
            </button>
          </div>
          <p className="text-[9px] text-slate-400 font-medium text-center">
            Deducted from wallet balance · Wallet: ₹{user?.walletBalance ?? 0}
          </p>
        </div>
      )}
    </div>
  );
};

export default WelfareFundCard;
