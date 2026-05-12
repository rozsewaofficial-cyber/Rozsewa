import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, Camera, Check, Star, Gift, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import BottomNav from "@/modules/user/components/BottomNav";
import { useAuth } from "@/context/AuthContext";

const tags = ["On Time", "Clean Work", "Polite", "Professional", "Affordable", "Expert"];

const PostService = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showApproval, setShowApproval] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [review, setReview] = useState("");
  const [paymentDone, setPaymentDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const fetchBooking = async () => {
    try {
      const { data } = await API.get('/bookings');
      // Most recent completed or started booking that hasn't been reviewed
      const active = data.find(b => ['completed', 'started'].includes(b.status) && (!b.rating || b.rating === 0));
      if (active) {
        setBooking(active);
        setPaymentDone(active.paymentStatus === 'paid');
        if (active.extraStatus === 'pending') setShowApproval(true);
        if (active.extraStatus === 'approved') setApproved(true);
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

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

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
        currency: "INR"
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
              bookingId: booking._id
            });
            if (verification.success) {
              toast({ title: "Payment Successful!", description: "Your booking is now fully confirmed." });
              setPaymentDone(true);
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 3000);
            }
          } catch (err) {
            toast({ title: "Verification Failed", variant: "destructive" });
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.mobile,
        },
        theme: { color: "#10b981" },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPaying(false);
    }
  };

  const extraTotal = booking?.extraCharges?.reduce((sum, item) => sum + item.amount, 0) || 0;
  const baseAmount = booking?.totalAmount || 0;
  const finalTotal = baseAmount + (approved ? extraTotal : 0);

  const handleExtraAction = async (status) => {
    try {
      await API.patch(`/bookings/${booking._id}/status`, { extraStatus: status });
      if (status === 'approved') setApproved(true);
      setShowApproval(false);
      fetchBooking();
    } catch (err) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handlePayment = async (method) => {
    try {
      await API.patch(`/bookings/${booking._id}/status`, { paymentStatus: 'paid', status: 'completed' });
      setPaymentDone(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      toast({ title: method === 'cod' ? "COD Payment Confirmed!" : "Payment Successful!" });
    } catch (err) {
      toast({ title: "Failed to update payment status", variant: "destructive" });
    }
  };

  if (loading) return (
    <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Generating Service Summary...</p>
    </div>
  );

  if (!booking) return (
    <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-background p-10 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-2">
        <ArrowLeft className="h-8 w-8 text-muted-foreground opacity-40" />
      </div>
      <p className="text-sm font-bold text-muted-foreground">No active service record found.</p>
      <button onClick={() => navigate('/')} className="text-[10px] font-black uppercase text-primary tracking-widest bg-primary/5 px-6 py-2 rounded-full">Back to Home</button>
    </div>
  );

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-bold text-foreground">Service Completed</h1>
        </div>

        {/* Image Upload */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-bold text-card-foreground flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" /> Work Verification
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Before Work", img: booking?.beforeImage },
              { label: "After Work", img: booking?.afterImage },
            ].map(({ label, img }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/50 p-6"
              >
                {img ? (
                  <img src={img} alt={label} className="h-20 w-20 rounded-lg object-cover cursor-pointer" onClick={() => window.open(img, '_blank')} />
                ) : (
                  <div className="h-20 w-20 flex items-center justify-center bg-muted rounded-lg border border-border">
                    <Check className="h-6 w-6 text-muted-foreground opacity-20" />
                  </div>
                )}
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Approval */}
        <AnimatePresence>
          {showApproval && !approved && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border-2 border-secondary bg-secondary/10 p-5"
            >
              <h3 className="text-sm font-bold text-foreground">Extra Charges Added</h3>
              <p className="mt-1 text-xs text-muted-foreground">Technician added spare parts cost</p>
              <div className="mt-3 rounded-xl bg-card p-3 text-sm space-y-2">
                {booking?.extraCharges?.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-muted-foreground">{item.item}</span>
                    <span className="font-bold text-foreground">₹{item.amount}</span>
                  </div>
                ))}
                <div className="border-t border-border mt-2 pt-2 flex justify-between">
                  <span className="font-bold text-foreground">Extra Total</span>
                  <span className="font-extrabold text-secondary-foreground">₹{extraTotal}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleExtraAction('declined')}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Decline
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleExtraAction('approved')}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Approve ₹{extraTotal}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Final Bill */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <h3 className="text-sm font-bold text-card-foreground mb-3">Final Bill</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Booking Amount</span>
            <span className="font-semibold text-card-foreground">₹{baseAmount}</span>
          </div>
          {/* Discount is already subtracted in baseAmount in checkout logic */}
          {approved && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Extra Parts</span>
              <span className="font-semibold text-card-foreground">₹1,250</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex justify-between text-base font-extrabold text-foreground">
            <span>Total</span>
            <span>₹{finalTotal}</span>
          </div>
        </section>

        {/* Payment */}
        {!paymentDone ? (
          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleRazorpayPayment}
              disabled={isPaying}
              className="flex-1 rounded-2xl bg-primary py-4 text-sm font-extrabold text-primary-foreground shadow-xl"
            >
              {isPaying ? "Processing..." : `Pay Online ₹${finalTotal}`}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => handlePayment('cod')}
              className="flex-1 rounded-2xl border-2 border-emerald-600 py-4 text-sm font-extrabold text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              Confirm COD Pay
            </motion.button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl bg-gradient-to-r from-primary to-emerald-500 p-6 text-center text-primary-foreground shadow-xl"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: 2, duration: 0.3 }}>
              <Check className="mx-auto h-12 w-12" />
            </motion.div>
            <h3 className="mt-3 text-xl font-extrabold">Payment Successful!</h3>
            {showConfetti && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
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
                    transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}
                    className="absolute h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: ["#22c55e", "#eab308", "#ef4444", "#3b82f6", "#a855f7", "#f97316"][i % 6],
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
            className="rounded-2xl border border-border bg-card p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-card-foreground">Rate Your Experience</h3>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <motion.button
                  key={s}
                  whileTap={{ scale: 0.8 }}
                  whileHover={{ scale: 1.2 }}
                  onMouseEnter={() => setHoveredStar(s)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setRating(s)}
                >
                  <Star
                    className={`h-10 w-10 transition-colors ${s <= (hoveredStar || rating) ? "fill-secondary text-secondary" : "text-border"
                      }`}
                  />
                </motion.button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {tags.map((tag) => (
                <motion.button
                  key={tag}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${selectedTags.includes(tag)
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-foreground hover:bg-muted"
                    }`}
                >
                  {tag}
                </motion.button>
              ))}
            </div>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Write your feedback..."
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={async () => {
                try {
                  await API.post(`/bookings/${booking._id}/review`, {
                    rating,
                    comment: review,
                    tags: selectedTags
                  });
                  toast({ title: "Review submitted successfully!" });
                  navigate("/");
                } catch (err) {
                  toast({ title: "Failed to submit review", variant: "destructive" });
                }
              }}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              Submit Review
            </motion.button>
          </motion.section>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default PostService;
