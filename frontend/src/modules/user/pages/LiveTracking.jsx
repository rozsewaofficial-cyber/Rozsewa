import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, MessageCircle, AlertOctagon, Check, Clock, User, Star, Shield, CreditCard, X, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";
import ChatModal from "@/components/ChatModal";



const LiveTracking = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bookingDetails, setBookingDetails] = useState(null);
  const bookingDetailsRef = useRef(null);

  const updateBookingDetails = (details) => {
    bookingDetailsRef.current = details;
    setBookingDetails(details);
  };
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const getDynamicSteps = () => {
    const formatTimestamp = (dateString) => {
      if (!dateString) return "";
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (bookingDetails?.serviceLocation === 'shop') {
      return [
        { label: "Booking Placed", time: formatTimestamp(bookingDetails?.createdAt) },
        { label: "Provider Accepted", time: formatTimestamp(bookingDetails?.acceptedAt) },
        { label: "Ready for Visit", time: formatTimestamp(bookingDetails?.onTheWayAt) },
        { label: "Service Started", time: formatTimestamp(bookingDetails?.startedAt) },
        { label: "Completed", time: formatTimestamp(bookingDetails?.completedAt) },
      ];
    }

    return [
      { label: "Booking Placed", time: formatTimestamp(bookingDetails?.createdAt) },
      { label: "Provider Accepted", time: formatTimestamp(bookingDetails?.acceptedAt) },
      { label: "On the Way", time: formatTimestamp(bookingDetails?.onTheWayAt) },
      { label: "Service Started", time: formatTimestamp(bookingDetails?.startedAt) },
      { label: "Completed", time: formatTimestamp(bookingDetails?.completedAt) },
    ];
  };

  const dynamicSteps = getDynamicSteps();
  const [cancelTimer, setCancelTimer] = useState(250);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [showOTP, setShowOTP] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { user } = useAuth();
  const [isPaying, setIsPaying] = useState(false);
  const [proposedSchedule, setProposedSchedule] = useState(null);
  const [counterTimer, setCounterTimer] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);

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
    toast({ title: "Payment Successful", description: "Your payment was processed successfully (Simulated).", variant: "default" });
    return;
    /*
    if (!bookingDetails) return;
    setIsPaying(true);
    const res = await loadRazorpay();

    if (!res) {
      toast({ title: "SDK failed to load.", variant: "destructive" });
      setIsPaying(false);
      return;
    }

    try {
      const finalAmount = (bookingDetails.totalAmount || 0) + (bookingDetails.extraCharges?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0);
      const { data: order } = await API.post("/payment/order", {
        amount: finalAmount,
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
    */
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const fetchBookingStatus = async () => {
    try {
      const { data } = await API.get('/bookings');
      // Find the most recent active booking prioritizing non-cancelled ones
      let active = data.find(b => ['pending', 'confirmed', 'on_the_way', 'started'].includes(b.status));
      if (!active) {
        active = data.find(b => b.status === 'completed' && (!b.rating || b.rating === 0));
      }
      
      // If we are currently tracking a booking, see if it is in the data list and is cancelled
      if (!active && bookingDetailsRef.current?._id) {
        active = data.find(b => b._id === bookingDetailsRef.current._id && b.status === 'cancelled');
      }

      if (!active) {
        active = data.find(b => {
          if (b.status !== 'cancelled') return false;
          let dl = [];
          try { dl = JSON.parse(localStorage.getItem('rozsewa_dismissed_bookings') || '[]'); } catch (e) {}
          if (dl.includes(b._id)) return false;
          const timeToCheck = b.updatedAt || b.createdAt;
          if (timeToCheck) {
            const diffMinutes = Math.abs(new Date() - new Date(timeToCheck)) / (1000 * 60);
            if (diffMinutes > 15) return false;
          }
          return true;
        });
      }
      if (active) {
        const current = active.status;
        updateBookingDetails(active);

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

        // Calculate counter-offer timer
        if (active.offerStatus === 'countered' && active.counterOfferExpiresAt) {
          const expiryTime = new Date(active.counterOfferExpiresAt).getTime();
          const nowTime = new Date().getTime();
          const remaining = Math.max(0, Math.floor((expiryTime - nowTime) / 1000));
          setCounterTimer(remaining);
        } else {
          setCounterTimer(0);
        }

      } else {
        updateBookingDetails(null);
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
      await API.put(`/bookings/${bookingDetails._id}`, { status: 'cancelled' });
      toast({ title: "Booking Cancelled", description: "Your booking has been cancelled successfully." });
      navigate("/my-bookings");
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
        address: p.address,
        city: p.city,
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
    if (counterTimer <= 0) return;
    const timer = setInterval(() => {
      setCounterTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [counterTimer]);

  const handleCounterDecision = async (decision) => {
    if (!bookingDetails) return;
    try {
      await API.put(`/bookings/${bookingDetails._id}`, { counterDecision: decision });
      toast({
        title: decision === 'accept' ? "Counter-Offer Accepted!" : "Counter-Offer Rejected",
        description: decision === 'accept' ? "Your booking is now confirmed." : "Your booking has been cancelled.",
        variant: "default"
      });
      fetchBookingStatus();
    } catch (err) {
      if (err.response?.status === 410) {
        toast({
          title: "Offer Expired",
          description: "This counter-offer has expired.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: err.response?.data?.message || err.message,
          variant: "destructive"
        });
      }
      fetchBookingStatus();
    }
  };

  useEffect(() => {
    const handleRejected = (e) => {
      const data = e.detail || {};
      toast({
        title: data.cancelledBy === 'provider' ? "Booking Cancelled" : "Request Rejected",
        description: data.cancellationReason
          ? `Reason: "${data.cancellationReason}"`
          : "The provider has rejected your request.",
        variant: "destructive"
      });
      fetchBookingStatus();
    };

    const handleScheduleProposed = (e) => {
      const data = e.detail;
      if (data && data.bookingId === bookingDetails?._id) {
        setProposedSchedule(data.proposedSchedule);
        fetchBookingStatus();
      }
    };

    const handleCounterOfferReceived = (e) => {
      const data = e.detail;
      if (data && data.bookingId === bookingDetails?._id) {
        fetchBookingStatus();
      }
    };

    const handleExtraChargesPending = (e) => {
      const data = e.detail;
      if (data && data.bookingId === bookingDetails?._id) {
        fetchBookingStatus();
      }
    };

    window.addEventListener('BOOKING_REJECTED', handleRejected);
    window.addEventListener('SCHEDULE_PROPOSED', handleScheduleProposed);
    window.addEventListener('COUNTER_OFFER_RECEIVED', handleCounterOfferReceived);
    window.addEventListener('EXTRA_CHARGES_PENDING', handleExtraChargesPending);
    
    return () => {
      window.removeEventListener('BOOKING_REJECTED', handleRejected);
      window.removeEventListener('SCHEDULE_PROPOSED', handleScheduleProposed);
      window.removeEventListener('COUNTER_OFFER_RECEIVED', handleCounterOfferReceived);
      window.removeEventListener('EXTRA_CHARGES_PENDING', handleExtraChargesPending);
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

  const handleExtraAction = async (status) => {
    try {
      await API.patch(`/bookings/${bookingDetails._id}/status`, { extraStatus: status });
      toast({ title: status === 'approved' ? 'Extra Charges Approved' : 'Extra Charges Declined' });
      fetchBookingStatus();
    } catch {
      toast({ title: "Failed to update extra charges", variant: "destructive" });
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-5 sm:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Live Tracking</h1>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Booking #{bookingDetails?._id ? bookingDetails._id.slice(-6).toUpperCase() : "..."}</p>
            </div>
          </div>
          {cancelTimer > 0 && currentStep === 0 && (
            <span className="rounded-full bg-rose-50 dark:bg-rose-900/30 px-3 py-1.5 text-[11px] font-bold tracking-widest text-rose-600 dark:text-rose-400 uppercase border border-rose-200 dark:border-rose-800">
              Free Cancel — {formatTime(cancelTimer)}
            </span>
          )}
        </div>

        {/* Cancelled Warning UI */}
        {bookingDetails?.status === 'cancelled' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-[24px] border-2 border-rose-500 bg-rose-50 dark:bg-rose-900/10 p-6 flex flex-col items-center gap-4 text-center shadow-sm mb-6"
          >
            <div className="h-16 w-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 shadow-inner">
              <AlertOctagon className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-rose-700 dark:text-rose-500">
                {bookingDetails.cancelledBy === 'provider' ? 'Cancelled by Provider' : 'Request Not Accepted'}
              </h3>
              <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300 mt-2">
                {bookingDetails.cancellationReason 
                  ? `Reason: "${bookingDetails.cancellationReason}"` 
                  : "Unfortunately, no providers accepted your request. Please try booking again."}
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="mt-2 w-full max-w-[200px] h-12 rounded-full bg-rose-600 text-white font-bold tracking-wide text-sm hover:bg-rose-700 shadow-md shadow-rose-600/20 active:scale-95 transition-all"
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
            className="rounded-[24px] border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/10 p-6 flex flex-col gap-4 shadow-sm mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shadow-inner">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-700 dark:text-amber-500">New Time Proposed</h3>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Provider requested a change</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 mt-2 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Date</p>
                  <p className="font-bold text-[13px] text-slate-900 dark:text-white mt-0.5">{proposedSchedule.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Time</p>
                  <p className="font-bold text-[13px] text-slate-900 dark:text-white mt-0.5">{proposedSchedule.time}</p>
                </div>
              </div>
              {proposedSchedule.message && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Message</p>
                  <p className="text-[13px] font-medium italic text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl mt-1.5 border border-slate-100 dark:border-slate-700">"{proposedSchedule.message}"</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={handleRejectSchedule}
                className="h-12 rounded-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2 transition-all font-bold text-[13px] text-slate-600 dark:text-slate-300"
              >
                <X className="h-4 w-4" /> Reject
              </button>
              <button
                onClick={handleAcceptSchedule}
                className="h-12 rounded-full bg-amber-500 text-white shadow-md shadow-amber-500/20 hover:bg-amber-600 active:scale-95 flex items-center justify-center gap-2 transition-all font-bold text-[13px]"
              >
                <Check className="h-4 w-4" /> Accept Time
              </button>
            </div>
          </motion.div>
        )}

        {/* Counter-Offer Proposal UI */}
        {bookingDetails?.status === 'pending' && bookingDetails?.offerStatus === 'countered' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-[24px] border-2 border-purple-500 bg-purple-50 dark:bg-purple-900/10 p-6 flex flex-col gap-4 shadow-sm mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 shadow-inner">
                <CreditCard className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-purple-700 dark:text-purple-500">Counter-Offer Received</h3>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                  Partner proposed a new price
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 mt-2 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Original Price</p>
                  <p className="font-bold text-[13px] text-slate-500 line-through mt-0.5">₹{bookingDetails.originalFixedPrice}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Your Offer</p>
                  <p className="font-bold text-[13px] text-slate-500 mt-0.5">₹{bookingDetails.customerOffer}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-purple-600 uppercase font-black tracking-wider">Partner Counter</p>
                  <p className="font-black text-lg text-purple-700 dark:text-purple-400 mt-0.5">₹{bookingDetails.partnerCounterOffer}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500">Expires in:</span>
                <span className="font-black text-purple-600 animate-pulse">
                  {formatTime(counterTimer)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => handleCounterDecision('reject')}
                className="h-12 rounded-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2 transition-all font-bold text-[13px] text-slate-600 dark:text-slate-300"
              >
                <X className="h-4 w-4" /> Reject & Cancel
              </button>
              <button
                onClick={() => handleCounterDecision('accept')}
                disabled={counterTimer <= 0}
                className="h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 active:scale-95 flex items-center justify-center gap-2 transition-all font-bold text-[13px] disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Accept Counter
              </button>
            </div>
          </motion.div>
        )}

        {/* Extra Charges Proposal UI */}
        {bookingDetails?.status === 'started' && bookingDetails?.extraStatus === 'pending' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-[24px] border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/10 p-6 flex flex-col gap-4 shadow-sm mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shadow-inner">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black text-amber-700 dark:text-amber-500">Extra Charges Added</h3>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
                  Technician added extra items
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 mt-2 space-y-3">
              {bookingDetails?.extraCharges?.map((item, idx) => (
                <div key={idx} className="flex justify-between text-[13px]">
                  <span className="text-slate-500 dark:text-slate-400">{item.item}</span>
                  <span className="font-bold text-slate-900 dark:text-white">₹{item.amount}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between">
                <span className="text-[13px] font-black text-slate-900 dark:text-white">Extra Total</span>
                <span className="text-[14px] font-black text-amber-600 dark:text-amber-500">
                  ₹{bookingDetails?.extraCharges?.reduce((sum, item) => sum + (item.amount || 0), 0)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => handleExtraAction('declined')}
                className="h-12 rounded-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2 transition-all font-bold text-[13px] text-slate-600 dark:text-slate-300"
              >
                <X className="h-4 w-4" /> Decline
              </button>
              <button
                onClick={() => handleExtraAction('approved')}
                className="h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2 transition-all font-bold text-[13px]"
              >
                <Check className="h-4 w-4" /> Approve
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
              className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
            >
              {bookingDetails?.providerId ? (
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0">
                    <motion.div
                      className="absolute inset-0 rounded-[20px] border-[3px] border-blue-500"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    />
                    <div className="h-full w-full overflow-hidden rounded-[20px] bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 relative z-10">
                      {providerInfo.profileImage ? (
                        <img src={providerInfo.profileImage} alt={providerInfo.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl font-black text-blue-600 dark:text-blue-500 bg-blue-50/50">
                          {providerInfo.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{providerInfo.name}</h3>
                      <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{providerInfo.rating}</span>
                      <span className="text-[11px] font-bold text-slate-400">({providerInfo.jobs} jobs)</span>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">{providerInfo.tags || "Expert Professional"}</p>
                    
                    {bookingDetails?.serviceLocation === 'shop' && providerInfo.address && (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(providerInfo.address + (providerInfo.city ? `, ${providerInfo.city}` : ''))}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 block bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-blue-700 dark:text-blue-300 p-2 rounded-lg border border-blue-100 dark:border-blue-800"
                      >
                        <span className="text-[11px] font-bold flex items-center gap-1"><MapPin className="h-3 w-3" /> Shop Address:</span>
                        <span className="text-[11px] mt-0.5 block">{providerInfo.address} {providerInfo.city ? `, ${providerInfo.city}` : ''}</span>
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => { if (providerInfo.mobile) window.location.href = `tel:${providerInfo.mobile}` }} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"><Phone className="h-4 w-4" /></button>
                    <button onClick={() => setIsChatOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"><MessageCircle className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 py-2">
                  <div className="h-16 w-16 shrink-0 rounded-[20px] bg-slate-50 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden border border-slate-100 dark:border-slate-700">
                    <motion.div
                      className="absolute inset-0 border-[3px] border-transparent rounded-[20px] border-t-emerald-500 border-l-emerald-500 opacity-70"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                    <User className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Finding a Sewak...</h3>
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">Please wait while we assign the best professional near you.</p>
                  </div>
                </div>
              )}
              {/* Cancel Button */}
              {bookingDetails?.status === 'pending' && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancelBooking}
                  className="mt-5 w-full rounded-xl py-3.5 text-[13px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel Booking
                </motion.button>
              )}
            </motion.div>

            {/* Timeline */}
            <section className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <h3 className="mb-5 text-sm font-bold text-card-foreground flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Order Status</h3>
              <div className="space-y-0">
                {dynamicSteps.map((step, i) => (
                  <div key={step.label} className="flex gap-4">
                    {/* Line + Dot */}
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.15, type: "spring", stiffness: 300 }}
                        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${i < currentStep
                          ? "bg-primary text-primary-foreground"
                          : i === currentStep
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/30"
                            : "border-2 border-border bg-background text-muted-foreground"
                          }`}
                      >
                        {i === currentStep && (
                          <motion.div
                            className="absolute inset-0 rounded-full border-[3px] border-primary"
                            animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                          />
                        )}
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
                      {i < dynamicSteps.length - 1 && (
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

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        bookingId={bookingDetails?._id || bookingDetails?.id}
        userType="User"
      />
    </div>
  );
};

export default LiveTracking;
