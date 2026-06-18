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
  const [proposedSchedule, setProposedSchedule] = useState(null);

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
      // Find the most recent active booking (only include completed if not reviewed)
      const active = data.find(b => 
        ['pending', 'confirmed', 'on_the_way', 'started', 'cancelled'].includes(b.status) || 
        (b.status === 'completed' && (!b.rating || b.rating === 0))
      );
      if (active) {
        const current = active.status;
        setBookingDetails(active);

        if (active.proposedSchedule && active.proposedSchedule.status === 'pending') {
            setProposedSchedule(active.proposedSchedule);
        } else {
            setProposedSchedule(null);
        }

        // Map status to currentStep
        if (current === 'pending') setCurrentStep(0);
        else if (active.status === 'confirmed') setCurrentStep(1);
        else if (active.status === 'on_the_way') setCurrentStep(2);
        else if (active.status === 'started') setCurrentStep(3);
        else if (active.status === 'cancelled') setCurrentStep(-1);
        else if (active.status === 'completed') {
          setCurrentStep(4);
          navigate('/post-service');
        }

        // Calculate cancel timer (5 mins from creation)
        if (active.createdAt) {
          const createdTime = new Date(active.createdAt).getTime();
          const now = new Date().getTime();
          const diffInSeconds = Math.floor((now - createdTime) / 1000);
          const remaining = 300 - diffInSeconds; // 5 mins = 300s
          setCancelTimer(remaining > 0 ? remaining : 0);
        } else {
          setCancelTimer(0);
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
      const p = bookingDetails.providerId;
      let tags = [];
      if (p.planType === 'premium' || p.planType === 'pro') tags.push("Expert Professional");
      if (p.status === 'verified') tags.push("Verified Partner");
      if (tags.length === 0) tags.push("Service Provider");

      setProviderInfo({
        name: p.shopName || p.ownerName || "Technician",
        rating: p.rating !== undefined ? p.rating : 0,
        jobs: p.reviewCount !== undefined ? p.reviewCount : 0,
        mobile: p.mobile || "",
        profileImage: p.profileImage,
        tags: tags.join(" • ")
      });
    }
  }, [bookingDetails]);

  useEffect(() => {
    fetchBookingStatus();
    const interval = setInterval(fetchBookingStatus, 3000); // Polling faster (3s)
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (cancelTimer <= 0) return;
    const timer = setInterval(() => {
      setCancelTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cancelTimer]);

  useEffect(() => {
    const handleRejected = (e) => {
      toast({ 
        title: "Request Rejected", 
        description: "The provider has rejected your request.",
        variant: "destructive"
      });
      fetchBookingStatus(); // Immediately refresh to catch the cancelled status
    };

    const handleScheduleProposed = (data) => {
      if (data.bookingId === bookingDetails?._id) {
        setProposedSchedule(data.proposedSchedule);
        fetchBookingStatus();
      }
    };

    window.addEventListener('BOOKING_REJECTED', handleRejected);
    window.addEventListener('SCHEDULE_PROPOSED', handleScheduleProposed);
    return () => {
      window.removeEventListener('BOOKING_REJECTED', handleRejected);
      window.removeEventListener('SCHEDULE_PROPOSED', handleScheduleProposed);
    };
  }, [bookingDetails]);

  const handleAcceptSchedule = async () => {
    try {
      await API.patch(`/bookings/${bookingDetails._id}/accept-schedule`);
      toast({ title: "Schedule Accepted", description: "Your booking is now confirmed." });
      setProposedSchedule(null);
      fetchBookingStatus();
    } catch (err) {
      toast({ title: "Error", description: "Failed to accept schedule", variant: "destructive" });
    }
  };

  const handleRejectSchedule = async () => {
    try {
      await API.patch(`/bookings/${bookingDetails._id}/reject-schedule`);
      toast({ title: "Schedule Rejected", description: "Provider has been notified.", variant: "default" });
      setProposedSchedule(null);
      fetchBookingStatus();
    } catch (err) {
      toast({ title: "Error", description: "Failed to reject schedule", variant: "destructive" });
    }
  };

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
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Live Tracking</h1>
            <p className="text-xs text-muted-foreground">Booking #{bookingDetails?._id ? bookingDetails._id.slice(-6).toUpperCase() : "..."}</p>
          </div>
          </div>
          {cancelTimer > 0 && currentStep < 3 && (
            <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive">
              Free Cancel — {formatTime(cancelTimer)}
            </span>
          )}
        </div>

        {/* Cancelled Warning UI */}
        {bookingDetails?.status === 'cancelled' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border-2 border-rose-500 bg-rose-500/10 p-6 flex flex-col items-center gap-4 text-center shadow-lg shadow-rose-500/10 mb-6"
          >
            <div className="h-16 w-16 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-500/30">
              <AlertOctagon className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-rose-700">Request Not Accepted</h3>
              <p className="text-sm font-medium text-foreground mt-2">
                Unfortunately, no providers accepted your request. Please try booking again.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="mt-2 w-full max-w-[200px] h-12 rounded-xl bg-rose-600 text-white font-bold uppercase tracking-widest text-xs hover:bg-rose-700 shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
            >
              Go to Home
            </button>
          </motion.div>
        )}

        {/* Schedule Proposal UI */}
        {proposedSchedule && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border-2 border-amber-500 bg-amber-500/10 p-6 flex flex-col gap-4 shadow-lg shadow-amber-500/10 mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/30">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-700">New Time Proposed</h3>
                <p className="text-xs font-bold text-foreground opacity-70 uppercase tracking-widest">Provider requested a change</p>
              </div>
            </div>
            
            <div className="bg-background rounded-xl p-4 border border-border mt-2 space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-border">
                 <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Date</p>
                    <p className="font-bold text-sm">{proposedSchedule.date}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Time</p>
                    <p className="font-bold text-sm">{proposedSchedule.time}</p>
                 </div>
              </div>
              {proposedSchedule.message && (
                <div>
                   <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Message</p>
                   <p className="text-sm italic text-foreground bg-muted/50 p-2 rounded-lg mt-1">"{proposedSchedule.message}"</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={handleRejectSchedule}
                className="h-12 rounded-xl border-2 border-border bg-background hover:bg-muted flex items-center justify-center gap-2 transition-all font-black uppercase text-[10px] tracking-widest text-muted-foreground"
              >
                <X className="h-4 w-4" /> Reject
              </button>
              <button
                onClick={handleAcceptSchedule}
                className="h-12 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 transition-all font-black uppercase text-[10px] tracking-widest"
              >
                <Check className="h-4 w-4" /> Accept Time
              </button>
            </div>
          </motion.div>
        )}

        {/* Payment section removed as per requirement: provider will collect payment */}

        {bookingDetails?.status !== 'cancelled' && (
        <>
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
              <p className="mt-0.5 text-xs text-muted-foreground">{providerInfo.tags || "Expert Professional • Verified Partner"}</p>
              {providerInfo.mobile && (
                  <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      +91 {providerInfo.mobile}
                  </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { if(providerInfo.mobile) window.location.href = `tel:${providerInfo.mobile}` }} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-muted"><Phone className="h-4 w-4 text-primary" /></button>
              <button onClick={() => { if(providerInfo.mobile) window.location.href = `https://wa.me/${providerInfo.mobile.replace(/[^0-9]/g, '')}?text=Hi, I am contacting regarding my booking on RozSewa.` }} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-muted"><MessageCircle className="h-4 w-4 text-primary" /></button>
            </div>
          </div>
          {/* Cancel Button */}
          {currentStep < 3 && (
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
          )}
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
                  {/* Start OTP Display */}
                  {i === currentStep && i === 2 && (
                    <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 w-fit">
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Share this OTP to Start Service</p>
                      <p className="text-2xl font-black tracking-[0.5em] text-blue-700">{bookingDetails?.startOTP || "----"}</p>
                    </div>
                  )}

                  {/* Completion OTP Display */}
                  {i === currentStep && i === 3 && bookingDetails?.endOTP && (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 w-fit">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Share this OTP to Complete Service</p>
                      <p className="text-2xl font-black tracking-[0.5em] text-emerald-700">{bookingDetails?.endOTP || "----"}</p>
                    </div>
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
        </>
        )}

      </main>
      <BottomNav />
    </div>
  );
};

export default LiveTracking;
