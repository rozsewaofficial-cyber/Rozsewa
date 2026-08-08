import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Check,
  Star,
  Loader2,
  ShieldCheck,
  CreditCard,
  Banknote,
  Sparkles,
  ThumbsUp,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import BottomNav from "@/modules/user/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";

const tags = [
  "On Time",
  "Clean Work",
  "Polite",
  "Professional",
  "Affordable",
  "Expert",
];

const PostService = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showApproval, setShowApproval] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [review, setReview] = useState("");
  const [paymentDone, setPaymentDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const fetchBooking = async () => {
    try {
      const { data } = await API.get("/bookings");
      const active = data.find(
        (b) =>
          ["completed", "started"].includes(b.status) &&
          (!b.rating || b.rating === 0),
      );
      if (active) {
        setBooking(active);
        setPaymentDone(active.paymentStatus === "paid");
        if (active.extraStatus === "pending") setShowApproval(true);
      }
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
  }, []);

  useEffect(() => {
    if (socket) {
      const handleExtraPending = (data) => {
        if (booking && data.bookingId === booking._id) {
          fetchBooking();
        } else if (!booking) {
          fetchBooking();
        }
      };

      socket.on("EXTRA_CHARGES_PENDING", handleExtraPending);

      return () => {
        socket.off("EXTRA_CHARGES_PENDING", handleExtraPending);
      };
    }
  }, [socket, booking]);

  const loadRazorpay = () =>
    new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleRazorpayPayment = async () => {
    if (!booking) return;
    setIsPaying(true);
    const res = await loadRazorpay();
    if (!res) {
      toast({ title: "SDK failed to load.", variant: "destructive" });
      setIsPaying(false);
      return;
    }
    try {
      const { data: order } = await API.post("/payment/order", {
        amount: finalTotal,
        currency: "INR",
      });
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa",
        description: `Payment for ${booking.serviceName}`,
        order_id: order.id,
        handler: async (response) => {
          try {
            const { data: verification } = await API.post("/payment/verify", {
              ...response,
              bookingId: booking._id,
            });
            if (verification.success) {
              toast({ title: "Payment Successful!" });
              setPaymentDone(true);
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 3000);
            }
          } catch {
            toast({ title: "Verification Failed", variant: "destructive" });
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.mobile,
        },
        theme: { color: "#2563eb" },
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast({
        title: "Payment Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsPaying(false);
    }
  };

  const pendingExtraTotal =
    booking?.extraCharges
      ?.filter((c) => c.status === "pending")
      .reduce((sum, item) => sum + item.amount, 0) || 0;
  const approvedExtraTotal =
    booking?.extraCharges
      // Night/Travel Charge entries are already baked into booking.totalAmount at
      // creation time — only sum genuinely separate provider-added extras here,
      // or they'd be double-counted into the final payable amount.
      ?.filter(
        (c) =>
          c.status !== "declined" &&
          c.status !== "pending" &&
          !c.item.includes("Night Charge") &&
          !c.item.includes("Travel Charge"),
      )
      .reduce((sum, item) => sum + item.amount, 0) || 0;
  const baseAmount = booking?.totalAmount || 0;
  const finalTotal = baseAmount + approvedExtraTotal;

  const handleExtraAction = async (status) => {
    try {
      await API.patch(`/bookings/${booking._id}/status`, {
        extraStatus: status,
      });
      setShowApproval(false);
      fetchBooking();
    } catch (err) {
      if (err?.response?.status === 409) {
        toast({ title: "Booking Updated", description: "This booking just changed elsewhere — refreshing, please try again.", variant: "destructive" });
        fetchBooking();
        return;
      }
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handlePayment = async (method) => {
    try {
      if (method === "cod") {
        await API.patch(`/bookings/${booking._id}/status`, {
          paymentMode: "after",
          status: "completed",
        });
      } else {
        await API.patch(`/bookings/${booking._id}/status`, {
          paymentStatus: "paid",
          status: "completed",
        });
      }
      setPaymentDone(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      toast({
        title:
          method === "cod"
            ? "Please pay the provider in cash"
            : "Payment Successful!",
      });
    } catch {
      toast({
        title: "Failed to update payment status",
        variant: "destructive",
      });
    }
  };

  const toggleTag = (tag) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  if (loading)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
        <div className="h-12 w-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
          Preparing Summary...
        </p>
      </div>
    );

  if (!booking)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950 p-10 text-center">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          No active service record found.
        </p>
        <button
          onClick={() => navigate("/")}
          className="text-[12px] font-black uppercase text-blue-600 tracking-widest bg-blue-50 dark:bg-blue-900/20 px-6 py-2.5 rounded-full"
        >
          Back to Home
        </button>
      </div>
    );

  const starLabels = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Great",
    5: "Excellent!",
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-8">
      <TopNav />
      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/profile")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all"
          >
            <ArrowLeft className="h-5 w-5 text-slate-700 dark:text-white" />
          </motion.button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Service Completed
            </h1>
            <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500">
              Review & pay for the work done
            </p>
          </div>
        </div>

        {/* Work Verification */}
        <section className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-[14px] font-black text-slate-900 dark:text-white">
              Work Verification
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Before Work",
                img: booking?.beforeImage,
                color: "amber",
              },
              {
                label: "After Work",
                img: booking?.afterImage,
                color: "emerald",
              },
            ].map(({ label, img, color }) => (
              <div
                key={label}
                className={`flex flex-col items-center gap-2 rounded-[20px] border-2 border-dashed overflow-hidden ${color === "amber" ? "border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10" : "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10"}`}
              >
                {img ? (
                  <img
                    src={img}
                    alt={label}
                    className="w-full h-36 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(img, "_blank")}
                  />
                ) : (
                  <div className="w-full h-36 flex items-center justify-center">
                    <Camera className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                  </div>
                )}
                <span
                  className={`text-[10px] font-black uppercase tracking-wider pb-3 ${color === "amber" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Extra Charges Approval */}
        <AnimatePresence>
          {showApproval && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border-2 border-amber-200 dark:border-amber-900/40 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-black text-slate-900 dark:text-white">
                    Extra Charges Added
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Technician added spare parts cost
                  </p>
                </div>
              </div>
              <div className="rounded-[16px] bg-slate-50 dark:bg-slate-800 p-4 space-y-2 mb-4">
                {booking?.extraCharges
                  ?.filter((item) => item.status === "pending")
                  .map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        {item.item}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        ₹{item.amount}
                      </span>
                    </div>
                  ))}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between">
                  <span className="text-[13px] font-black text-slate-900 dark:text-white">
                    Extra Total
                  </span>
                  <span className="text-[13px] font-black text-amber-600 dark:text-amber-400">
                    ₹{pendingExtraTotal}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleExtraAction("declined")}
                  className="flex-1 py-3 rounded-[16px] border-2 border-slate-200 dark:border-slate-700 text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Decline
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleExtraAction("approved")}
                  className="flex-1 py-3 rounded-[16px] bg-amber-500 text-[13px] font-black text-white shadow-md shadow-amber-500/30 hover:bg-amber-600 transition-colors"
                >
                  Approve ₹{pendingExtraTotal}
                </motion.button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Final Bill */}
        <section className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <h3 className="text-[14px] font-black text-slate-900 dark:text-white mb-4">
            Final Bill
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-slate-500 dark:text-slate-400">
                Booking Amount
              </span>
              <span className="text-[13px] font-bold text-slate-900 dark:text-white">
                ₹{baseAmount}
              </span>
            </div>
            {approvedExtraTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-slate-500 dark:text-slate-400">
                  Extra Parts
                </span>
                <span className="text-[13px] font-bold text-amber-600 dark:text-amber-400">
                  +₹{approvedExtraTotal}
                </span>
              </div>
            )}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center">
              <span className="text-[15px] font-black text-slate-900 dark:text-white">
                Total Payable
              </span>
              <span className="text-[22px] font-black text-blue-600 dark:text-blue-400">
                ₹{finalTotal}
              </span>
            </div>
          </div>
        </section>

        {/* Payment Buttons */}
        {!paymentDone ? (
          <div className="flex flex-col gap-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleRazorpayPayment}
              disabled={isPaying}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[20px] bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-black shadow-lg shadow-blue-500/30 transition-all disabled:opacity-70"
            >
              {isPaying ? (
                <>
                  <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />{" "}
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" /> Pay Online ₹{finalTotal}
                </>
              )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => handlePayment("cod")}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[20px] border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 text-[15px] font-black hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all"
            >
              <Banknote className="h-5 w-5" /> Confirm Cash Payment
            </motion.button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-[24px] bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center text-white shadow-2xl shadow-emerald-500/30 overflow-hidden"
          >
            <div className="absolute inset-0 opacity-10">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: 60 + i * 20,
                    height: 60 + i * 20,
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    opacity: 0.1,
                  }}
                />
              ))}
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: 2, duration: 0.4 }}
              className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"
            >
              <Check className="h-9 w-9 text-white" strokeWidth={3} />
            </motion.div>
            <h3 className="text-xl font-black">Payment Successful!</h3>
            <p className="text-[13px] text-white/80 mt-1">
              Your service is complete
            </p>
            {showConfetti && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
                {Array.from({ length: 30 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: "50%", y: "100%", opacity: 1, scale: 0 }}
                    animate={{
                      x: `${Math.random() * 100}%`,
                      y: `${-Math.random() * 200}%`,
                      opacity: 0,
                      scale: 1,
                      rotate: Math.random() * 720,
                    }}
                    transition={{
                      duration: 1.5 + Math.random(),
                      ease: "easeOut",
                    }}
                    className="absolute h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: [
                        "#22c55e",
                        "#eab308",
                        "#ef4444",
                        "#3b82f6",
                        "#a855f7",
                        "#f97316",
                      ][i % 6],
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Review Section */}
        {paymentDone && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <h3 className="text-[14px] font-black text-slate-900 dark:text-white">
                Rate Your Experience
              </h3>
            </div>

            {/* Stars */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <motion.button
                    key={s}
                    whileTap={{ scale: 0.8 }}
                    whileHover={{ scale: 1.15 }}
                    onMouseEnter={() => setHoveredStar(s)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRating(s)}
                  >
                    <Star
                      className={`h-10 w-10 transition-all ${s <= (hoveredStar || rating) ? "fill-amber-400 text-amber-400 drop-shadow-md" : "text-slate-200 dark:text-slate-700"}`}
                    />
                  </motion.button>
                ))}
              </div>
              {(hoveredStar || rating) > 0 && (
                <p className="text-[12px] font-black text-amber-500 uppercase tracking-wider">
                  {starLabels[hoveredStar || rating]}
                </p>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <motion.button
                  key={tag}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-bold border transition-all ${
                    selectedTags.includes(tag)
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/30"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-300"
                  }`}
                >
                  {selectedTags.includes(tag) && (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  )}
                  {tag}
                </motion.button>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your experience with this provider..."
              rows={3}
              className="w-full rounded-[16px] border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-[13px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-all resize-none"
            />

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={async () => {
                try {
                  await API.post(`/bookings/${booking._id}/review`, {
                    rating,
                    comment: review,
                    tags: selectedTags,
                  });
                  toast({ title: "Review submitted!" });
                  navigate("/");
                } catch {
                  toast({
                    title: "Failed to submit review",
                    variant: "destructive",
                  });
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[18px] bg-blue-600 text-[14px] font-black text-white shadow-md shadow-blue-500/30 hover:bg-blue-700 transition-colors"
            >
              <Sparkles className="h-4 w-4" /> Submit Review
            </motion.button>
          </motion.section>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default PostService;
