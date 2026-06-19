import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Search, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";

const BookingWaiting = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("waiting"); // waiting | accepted | rejected
  const [countdown, setCountdown] = useState(30);
  const [assignedProvider, setAssignedProvider] = useState("");
  const [latestBooking, setLatestBooking] = useState(null);

  useEffect(() => {
    const allBookings = JSON.parse(localStorage.getItem("rozsewa_bookings") || "[]");
    if (allBookings.length > 0) {
      setLatestBooking(allBookings[0]);
    }
  }, []);

  useEffect(() => {
    if (status !== "waiting") return;
    if (countdown <= 0) {
      setStatus("rejected"); // Or do some logic
      return;
    }
    const timer = setInterval(() => setCountdown(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown, status]);

  useEffect(() => {
    // 1. Pick a provider from localStorage if available
    const allProviders = JSON.parse(localStorage.getItem("rozsewa_providers") || "[]");
    const approvedProviders = allProviders.filter(p => p.status === "approved");
    const mockProvider = approvedProviders.length > 0 
      ? approvedProviders[Math.floor(Math.random() * approvedProviders.length)]
      : { shopName: "Ramesh Services", owner: "Ramesh Kumar" };

    // 2. Poll local storage to see if the pending booking got an 'active' status or simulate after 5s
    const timer = setTimeout(() => {
      const allBookings = JSON.parse(localStorage.getItem("rozsewa_bookings") || "[]");
      if (allBookings.length > 0 && status === "waiting") {
        const updatedBookings = allBookings.map((b, idx) => {
          if (idx === 0 && b.status === "pending") {
            return { 
              ...b, 
              status: "active", 
              provider: mockProvider.shopName || mockProvider.owner,
              providerMobile: mockProvider.mobile || "+91 9876543210"
            };
          }
          return b;
        });
        localStorage.setItem("rozsewa_bookings", JSON.stringify(updatedBookings));
        setAssignedProvider(mockProvider.shopName || mockProvider.owner);
        setStatus("accepted");
      }
    }, 5000); // 5 second simulation
    
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-white dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-950 pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-5 py-6 flex flex-col items-center justify-center min-h-[75vh] space-y-8">
        <AnimatePresence mode="wait">
          {status === "waiting" && (
            <motion.div key="waiting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center space-y-6 w-full max-w-sm">
              {/* Pulsing Loader */}
              <div className="relative mx-auto h-32 w-32">
                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full bg-blue-500/20" />
                <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }} transition={{ repeat: Infinity, duration: 2, delay: 0.3 }}
                  className="absolute inset-2 rounded-full bg-blue-500/30" />
                <div className="absolute inset-4 flex items-center justify-center rounded-full bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 shadow-[0_8px_30px_rgba(59,130,246,0.2)]">
                  <Loader2 className="h-10 w-10 text-blue-600 dark:text-blue-500 animate-spin" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Finding a Provider...</h1>
                <p className="mt-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">Your booking request has been sent to nearby professionals.</p>
              </div>

              {/* Countdown */}
              <div className="rounded-[24px] border border-white/40 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Estimated Wait</p>
                <p className="text-4xl font-black text-blue-600 dark:text-blue-500 mt-1">
                  00:{String(countdown).padStart(2, "0")}
                </p>
              </div>

              {/* Booking Summary */}
              <div className="rounded-[24px] border border-white/40 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 text-left space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="flex justify-between items-center"><span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">Service</span><span className="text-sm font-bold text-slate-900 dark:text-white text-right max-w-[60%] truncate">{latestBooking?.service || "Service"}</span></div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800/50"><span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">Amount</span><span className="text-lg font-black text-blue-600 dark:text-blue-500">₹{latestBooking?.amount || 0}</span></div>
              </div>

              <button onClick={() => { navigate("/"); }} className="text-[13px] font-bold text-rose-500 hover:text-rose-600 hover:underline transition-all">
                Cancel Request
              </button>
            </motion.div>
          )}

          {status === "accepted" && (
            <motion.div key="accepted" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 w-full max-w-sm">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
                className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 shadow-[0_8px_30px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="h-14 w-14 text-emerald-600 dark:text-emerald-500" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Provider Accepted! 🎉</h1>
                <p className="mt-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">A technician has accepted your booking and is getting ready.</p>
              </div>
              
              {/* Provider Card */}
              <div className="rounded-[24px] border border-white/40 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xl font-black text-blue-600 dark:text-blue-500">{(assignedProvider || "PRO").substring(0,2).toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-white truncate">{assignedProvider || "Ramesh Kumar"}</p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">⭐ 4.8 • Expert Professional</p>
                  </div>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/")}
                className="group w-full flex items-center justify-center gap-2 rounded-full bg-blue-600 py-4 text-sm font-bold tracking-wide text-white shadow-[0_8px_30px_rgba(59,130,246,0.3)] hover:bg-blue-700 transition-all">
                Track Booking <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.button>
            </motion.div>
          )}

          {status === "rejected" && (
            <motion.div key="rejected" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 w-full max-w-sm">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
                className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 shadow-[0_8px_30px_rgba(244,63,94,0.2)]">
                <XCircle className="h-14 w-14 text-rose-600 dark:text-rose-500" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">No Provider Available</h1>
                <p className="mt-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">We couldn't find a provider near you. Let us search again.</p>
              </div>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setStatus("waiting"); setCountdown(30); }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full bg-blue-600 py-4 text-[13px] font-bold text-white shadow-[0_8px_30px_rgba(59,130,246,0.3)] hover:bg-blue-700 transition-all">
                  <Search className="h-4 w-4" /> Try Again
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/")}
                  className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-4 text-[13px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                  Go Home
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
};

export default BookingWaiting;
