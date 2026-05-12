import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, MessageCircle, AlertOctagon, Check, Clock, User, Star, Shield, CreditCard, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const steps = [
  { label: "Booking Placed", time: "10:00 AM" },
  { label: "Provider Accepted", time: "10:02 AM" },
  { label: "On the Way", time: "10:15 AM" },
  { label: "Service Started", time: "" },
  { label: "Completed", time: "" },
];

const LiveTracking = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookingDetails, setBookingDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [cancelTimer, setCancelTimer] = useState(250);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [showOTP, setShowOTP] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { user } = useAuth();
  const [isPaying, setIsPaying] = useState(false);

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
    if (!bookingDetails) return;
    setIsPaying(true);
    const res = await loadRazorpay();

    if (!res) {
      toast({ title: "SDK failed to load.", variant: "destructive" });
      setIsPaying(false);
      return;
    }

    try {
      const { data: order } = await API.post("/payment/order", {
        amount: bookingDetails.totalAmount,
        currency: "INR"
      });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa",
        description: `Payment for ${bookingDetails.serviceName}`,
        order_id: order.id,
        handler: async (response) => {
          try {
            const { data: verification } = await API.post("/payment/verify", {
              ...response,
              bookingId: bookingDetails._id
            });
            if (verification.success) {
              toast({ title: "Payment Successful!", description: "Your booking is now fully confirmed." });
              fetchBookingStatus(); // Refresh to update paymentStatus
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

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const fetchBookingStatus = async () => {
    try {
      const { data } = await API.get('/bookings');
      // Find the most recent active booking (including pending and completed)
      const active = data.find(b => ['pending', 'confirmed', 'on_the_way', 'started', 'completed'].includes(b.status));
      if (active) {
        setBookingDetails(active);
        // Map status to currentStep
        if (active.status === 'pending') setCurrentStep(0);
        else if (active.status === 'confirmed') setCurrentStep(1);
        else if (active.status === 'on_the_way') setCurrentStep(2);
        else if (active.status === 'started') setCurrentStep(3);
        else if (active.status === 'completed') {
          setCurrentStep(4);
          navigate('/post-service');
        }
      }
    } catch (err) {
      console.error("Failed to fetch booking status", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!bookingDetails) return;
    const confirmCancel = window.confirm("Are you sure you want to cancel this booking?");
    if (!confirmCancel) return;

    try {
      await API.patch(`/bookings/${bookingDetails._id}/status`, { status: 'cancelled' });
      toast({ title: "Booking Cancelled", description: "Your booking has been cancelled successfully." });
      navigate("/bookings");
    } catch (err) {
      toast({ title: "Failed to cancel booking", variant: "destructive" });
    }
  };

  const [providerInfo, setProviderInfo] = useState({
    name: "Loading...",
    rating: 4.8,
    jobs: 120,
    mobile: ""
  });

  useEffect(() => {
    if (bookingDetails?.providerId) {
      setProviderInfo({
        name: bookingDetails.providerId.shopName || bookingDetails.providerId.ownerName || "Technician",
        rating: bookingDetails.providerId.rating || 4.8,
        jobs: bookingDetails.providerId.reviewCount || 0,
        mobile: bookingDetails.providerId.mobile || "",
        profileImage: bookingDetails.providerId.profileImage
      });
    }
  }, [bookingDetails]);

  useEffect(() => {
    fetchBookingStatus();
    const interval = setInterval(fetchBookingStatus, 3000); // Polling faster (3s)
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleRejected = (e) => {
      toast({ 
        title: "Request Rejected", 
        description: "The provider has rejected your request.",
        variant: "destructive"
      });
    };

    window.addEventListener('BOOKING_REJECTED', handleRejected);
    return () => window.removeEventListener('BOOKING_REJECTED', handleRejected);
  }, []);

  const handleOtpChange = async (idx, val) => {
    if (val.length > 1) return;
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 3) {
      const next = document.getElementById(`otp-${idx + 1}`);
      next?.focus();
    }
    if (newOtp.every((d) => d !== "")) {
      const fullOtp = newOtp.join("");
      setIsVerifying(true);
      try {
        // Use different endpoints for Start vs Completion
        const endpoint = currentStep === 2 ? `/bookings/${bookingDetails._id}/start` : `/bookings/${bookingDetails._id}/complete`;
        await API.post(endpoint, { otp: fullOtp });

        if (currentStep === 2) {
          setCurrentStep(3);
          toast({ title: "OTP Verified", description: "Service has started!" });
        } else {
          setCurrentStep(4);
          toast({ title: "Work Completed", description: "Technician has confirmed the work!" });
        }

        setShowOTP(false);
        setOtp(["", "", "", ""]);
      } catch (err) {
        toast({ title: "Verification Failed", description: "Invalid OTP. Please check with technician.", variant: "destructive" });
        setOtp(["", "", "", ""]);
      } finally {
        setIsVerifying(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Live Tracking</h1>
              <p className="text-xs text-muted-foreground">Booking #{bookingDetails?.id || "ROJ-2024-0000"}</p>
            </div>
          </div>
          {cancelTimer > 0 && currentStep < 3 && (
            <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive">
              Free Cancel — {formatTime(cancelTimer)}
            </span>
          )}
        </div>

        {/* Payment Required Warning */}
        {bookingDetails?.paymentMode === 'now' && bookingDetails?.paymentStatus === 'pending' && bookingDetails?.status !== 'pending' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border-2 border-emerald-500 bg-emerald-500/10 p-5 flex flex-col items-center gap-4 text-center shadow-lg shadow-emerald-500/10"
          >
            <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-emerald-700">Payment Required!</h3>
              <p className="text-xs font-bold text-emerald-600/80 mt-1 uppercase tracking-wider">Provider has accepted your request</p>
              <p className="text-sm font-medium text-foreground mt-2">Please complete the payment of <span className="font-black">₹{bookingDetails.totalAmount}</span> to proceed with the service.</p>
            </div>
            <button
              onClick={handleRazorpayPayment}
              disabled={isPaying}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              {isPaying ? "Processing..." : <>Confirm & Pay <ArrowLeft className="h-4 w-4 rotate-180" /></>}
            </button>
          </motion.div>
        )}

        {/* Technician Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-primary/10 border border-border">
              {providerInfo.profileImage ? (
                <img src={providerInfo.profileImage} alt={providerInfo.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-primary">
                  {providerInfo.name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-card-foreground">{providerInfo.name}</h3>
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Star className="h-3.5 w-3.5 fill-secondary text-secondary" />
                <span className="text-xs font-semibold text-card-foreground">{providerInfo.rating}</span>
                <span className="text-xs text-muted-foreground">({providerInfo.jobs} jobs)</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Expert Professional • Verified Partner</p>
            </div>
            <div className="flex flex-col gap-2">
              <a href={`tel:${providerInfo.mobile}`} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-muted"><Phone className="h-4 w-4 text-primary" /></a>
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-muted"><MessageCircle className="h-4 w-4 text-primary" /></button>
            </div>
          </div>
          {/* Cancel Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCancelBooking}
            className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-destructive border-2 border-destructive bg-transparent hover:bg-destructive/5 transition-colors"
          >
            <div className="flex items-center justify-center gap-2">
              <X className="h-5 w-5" />
              Cancel Booking
            </div>
          </motion.button>
        </motion.div>

        {/* Timeline */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-5 text-sm font-bold text-card-foreground flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Order Status</h3>
          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={step.label} className="flex gap-4">
                {/* Line + Dot */}
                <div className="flex flex-col items-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.15, type: "spring", stiffness: 300 }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${i <= currentStep
                      ? "bg-primary text-primary-foreground"
                      : "border-2 border-border bg-background text-muted-foreground"
                      }`}
                  >
                    {i <= currentStep ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.15 + 0.1, type: "spring", stiffness: 500 }}
                      >
                        <Check className="h-4 w-4" />
                      </motion.div>
                    ) : (
                      <span className="text-xs font-bold">{i + 1}</span>
                    )}
                  </motion.div>
                  {i < steps.length - 1 && (
                    <div className="relative h-10 w-0.5 bg-border">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: i < currentStep ? "100%" : "0%" }}
                        transition={{ delay: i * 0.2, duration: 0.5 }}
                        className="absolute left-0 top-0 w-full bg-primary"
                      />
                    </div>
                  )}
                </div>
                {/* Label */}
                <div className="pb-8">
                  <p className={`text-sm font-semibold ${i <= currentStep ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                  {step.time && <p className="text-xs text-muted-foreground">{step.time}</p>}
                  {/* Only show OTP button on 'On the Way' step to START service */}
                  {i === currentStep && i === 2 && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowOTP(true)}
                      className="mt-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      Enter OTP to Start
                    </motion.button>
                  )}

                  {/* New: Completion OTP to finish service */}
                  {i === currentStep && i === 3 && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowOTP(true)}
                      className="mt-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      Enter OTP to Complete
                    </motion.button>
                  )}
                  {i === currentStep && i === 4 && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate("/post-service")}
                      className="mt-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                    >
                      View Bill & Review →
                    </motion.button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* OTP Modal */}
        {showOTP && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-2xl"
            >
              <h3 className="text-lg font-bold text-card-foreground">Enter 4-digit OTP</h3>
              <p className="mt-1 text-xs text-muted-foreground">Share this OTP with your technician</p>
              <div className="mt-6 flex justify-center gap-3">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    className="h-14 w-14 rounded-xl border-2 border-border bg-background text-center text-2xl font-extrabold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                ))}
              </div>
              <button onClick={() => setShowOTP(false)} className="mt-5 text-sm font-semibold text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default LiveTracking;
