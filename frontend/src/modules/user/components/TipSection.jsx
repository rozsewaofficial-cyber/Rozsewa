import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const CHIPS = [20, 50, 75, 100];

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
 * Customer Tip prompt — shown at two points per the Tip Module spec:
 *   triggerPoint="payment_screen" — alongside the final bill/payment buttons
 *   triggerPoint="post_payment"   — right after payment succeeds, if not already tipped
 * Always its own Razorpay order, independent of how the booking itself is paid.
 * 100% of the amount is credited to the executing party — zero commission.
 */
const TipSection = ({ booking, triggerPoint }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [totalTipped, setTotalTipped] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [selected, setSelected] = useState(50);
  const [isCustom, setIsCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const amount = isCustom ? Number(customAmount) || 0 : selected;

  const fetchTips = async () => {
    try {
      const { data } = await API.get(`/tips/booking/${booking._id}`);
      setTotalTipped(data.totalTipped || 0);
    } catch (err) {
      // Non-critical — tip prompt still works without prior history.
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (booking?._id) fetchTips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?._id]);

  const handleGiveTip = async () => {
    if (!amount || amount < 1) {
      toast({ title: "Enter a valid tip amount", variant: "destructive" });
      return;
    }
    setIsPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        toast({ title: "Payment SDK failed to load", variant: "destructive" });
        setIsPaying(false);
        return;
      }
      const { data: order } = await API.post("/tips/order", {
        bookingId: booking._id,
        amount,
      });
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa",
        description: `Tip for ${booking.serviceName}`,
        order_id: order.id,
        handler: async (response) => {
          try {
            await API.post("/tips/verify", {
              ...response,
              bookingId: booking._id,
              amount,
              triggerPoint,
            });
            toast({
              title: "Thank you! ❤️",
              description: `You tipped ₹${amount} to the professional.`,
            });
            setShowForm(false);
            setIsCustom(false);
            setCustomAmount("");
            fetchTips();
          } catch (err) {
            toast({
              title: "Tip Verification Failed",
              description: err.response?.data?.message,
              variant: "destructive",
            });
          } finally {
            setIsPaying(false);
          }
        },
        modal: { ondismiss: () => setIsPaying(false) },
        prefill: { name: user?.name, email: user?.email, contact: user?.mobile },
        theme: { color: "#B23A5A" },
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast({
        title: "Could Not Start Tip Payment",
        description: err.response?.data?.message || err.message,
        variant: "destructive",
      });
      setIsPaying(false);
    }
  };

  if (!loaded) return null;

  // Already tipped — thank-you state with an option to tip again.
  if (totalTipped > 0 && !showForm) {
    return (
      <section className="rounded-[24px] p-5 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
          <Heart className="h-4 w-4 fill-rose-500 text-rose-500" /> Thank You! You tipped ₹{totalTipped} to the Professional.
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs font-black text-rose-600 dark:text-rose-400 underline underline-offset-2"
        >
          Add More Tip
        </button>
      </section>
    );
  }

  // Customer dismissed the prompt this session and hasn't tipped — collapse quietly.
  if (skipped && totalTipped === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border-2 border-rose-200 dark:border-rose-900/40 shadow-sm space-y-4"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center shrink-0">
          <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
        </div>
        <h3 className="text-[14px] font-black text-slate-900 dark:text-white">
          {triggerPoint === "payment_screen"
            ? "Professional ko Tip dena chahenge?"
            : "Kya aap Professional ko Tip dena chahenge?"}
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setIsCustom(false);
              setSelected(c);
            }}
            className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
              !isCustom && selected === c
                ? "bg-rose-600 text-white border-rose-600"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-rose-300"
            }`}
          >
            ₹{c}
          </button>
        ))}
        <button
          onClick={() => setIsCustom(true)}
          className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
            isCustom
              ? "bg-rose-600 text-white border-rose-600"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-rose-300"
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
          className="w-full rounded-[16px] border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:border-rose-500 focus:outline-none transition-all"
        />
      )}

      <div className="flex gap-3">
        <button
          onClick={() => {
            setShowForm(false);
            setSkipped(true);
          }}
          className="flex-1 py-3 rounded-[16px] border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Skip
        </button>
        <button
          onClick={handleGiveTip}
          disabled={isPaying}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-[16px] bg-rose-600 hover:bg-rose-700 text-white text-sm font-black shadow-md shadow-rose-500/30 transition-colors disabled:opacity-60"
        >
          {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : `Give Tip ₹${amount || 0}`}
        </button>
      </div>
    </motion.section>
  );
};

export default TipSection;
