import { useState, useEffect } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import EarningsWidget from "@/modules/provider/components/EarningsWidget";
import RecentBookingsList from "@/modules/provider/components/RecentBookingsList";
import { Briefcase, CalendarCheck, FileText, Star, ShieldAlert, CreditCard, Tag, Settings, Headset, Wallet, Clock, Lock, ShieldCheck, AlertCircle, CheckCircle, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const chartDataFallback = [
  { day: 'Mon', amount: 0 },
  { day: 'Tue', amount: 0 },
  { day: 'Wed', amount: 0 },
  { day: 'Thu', amount: 0 },
  { day: 'Fri', amount: 0 },
  { day: 'Sat', amount: 0 },
  { day: 'Sun', amount: 0 },
];
import { useSocket } from "@/context/SocketContext";
import IncomingRequestModal from "@/modules/provider/components/IncomingRequestModal";

const ProviderDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { socket, incomingRequest, setIncomingRequest } = useSocket();
  const [isOnline, setIsOnline] = useState(user?.isOnline ?? true);
  const [isEmergencyActive, setIsEmergencyActive] = useState(user?.isEmergencyEnabled ?? false);
  const [showEmergencyMenu, setShowEmergencyMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supportNum, setSupportNum] = useState("91XXXXXXXXXX");
  const [dynamicChartData, setDynamicChartData] = useState(chartDataFallback);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await API.get("/public/config");
        if (data.supportNumber) setSupportNum(data.supportNumber);
      } catch (err) { }
    };
    const fetchStats = async () => {
      try {
        const { data } = await API.get("/provider/stats");
        if (data.chartData) setDynamicChartData(data.chartData);
      } catch (err) { }
    };
    fetchConfig();
    fetchStats();
  }, []);

  useEffect(() => {
    if (user) {
      setIsOnline(user.isOnline);
      setIsEmergencyActive(user.isEmergencyEnabled);
    }
  }, [user]);

  const toggleOnline = async () => {
    const newState = !isOnline;
    setIsOnline(newState); // Optimistic update
    try {
      await API.patch("/provider/status", { isOnline: newState });
      toast({
        title: newState ? "You are now ONLINE" : "You are now OFFLINE",
        variant: newState ? "default" : "destructive"
      });
    } catch (err) {
      setIsOnline(!newState); // Revert on failure
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const triggerSOS = async () => {
    try {
      setIsLoading(true);
      // 1. Attempt Live One-Time Location (with fallback)
      let currentCoords = user?.location?.coordinates || [0, 0];
      let currentAddress = user?.address || "";

      try {
        if ("geolocation" in navigator) {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, enableHighAccuracy: true });
          });
          currentCoords = [pos.coords.longitude, pos.coords.latitude];

          // 1.1 Reverse Geocode using Google Maps API
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            try {
              const geoResp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${pos.coords.latitude},${pos.coords.longitude}&key=${apiKey}`);
              const geoData = await geoResp.json();
              if (geoData.results && geoData.results.length > 0) {
                currentAddress = geoData.results[0].formatted_address;
              }
            } catch (geocodeErr) {
              console.warn("Geocoding failed, using coordinates only");
            }
          }
        }
      } catch (locErr) {
        console.warn("GPS failed, using profile location fallback");
      }

      // 2. Notify Backend with Live Location & Human Readable Address
      await API.post("/provider/emergency-alert", {
        coordinates: currentCoords,
        address: currentAddress
      });

      toast({
        title: "SOS Alert Dispatched",
        description: "Admin notified with your location. Help is on the way."
      });
    } catch (err) {
      console.error("SOS SOS ERROR:", err.response?.data || err.message);
      const errMsg = err.response?.data?.message || "System alert failed.";
      toast({ title: "Priority Error", description: `${errMsg} Please call admin.`, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setShowEmergencyMenu(false);
    }
  };

  const toggleEmergency = async () => {
    const newState = !isEmergencyActive;
    setIsEmergencyActive(newState); // Optimistic update
    try {
      await API.patch("/provider/status", { isEmergencyEnabled: newState });
      toast({ title: newState ? "Emergency Mode ON" : "Emergency Mode OFF" });
    } catch (err) {
      setIsEmergencyActive(!newState); // Revert on failure
      toast({ title: "Failed to update emergency mode", variant: "destructive" });
    } finally {
      setShowEmergencyMenu(false);
    }
  };

  // Approval Overlay / Pending Screen
  if (user?.status === 'pending' || user?.status === 'suspended') {
    return (
      <div className="min-h-[100dvh] bg-background">
        <ProviderTopNav />
        <main className="container max-w-lg px-6 py-12 flex flex-col items-center justify-center text-center space-y-8">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="h-24 w-24 bg-amber-100 rounded-[40px] flex items-center justify-center rotate-12">
            {user?.status === 'suspended' ? <AlertCircle className="h-12 w-12 text-red-600 -rotate-12" /> : <Clock className="h-12 w-12 text-amber-600 -rotate-12 animate-pulse" />}
          </motion.div>

          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tighter">
              {user?.status === 'suspended' ? "Account Suspended" : "Approval Pending"}
            </h1>
            <p className="text-sm font-medium text-muted-foreground px-4">
              {user?.status === 'suspended'
                ? "Your account has been suspended due to policy violations. Please contact support."
                : "Great! Your registration and payment are complete. Our team is currently verifying your documents."}
            </p>
          </div>

          <div className="w-full bg-card border-2 border-dashed border-border p-6 rounded-3xl space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60">
              <span>Partner ID</span>
              <span className="text-emerald-600">Secure Protocol</span>
            </div>
            <p className="text-3xl font-black font-mono tracking-widest text-foreground">{user?.vendorCode}</p>
            <div className="pt-4 border-t border-border flex items-center justify-center gap-2 text-xs font-bold text-amber-700">
              <ShieldCheck className="h-4 w-4" /> Final Verification In-Progress
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 w-full">
            <div className="bg-muted p-4 rounded-2xl flex items-center gap-4 text-left">
              <div className="h-10 w-10 bg-background rounded-xl flex items-center justify-center shrink-0"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="text-xs font-black">Registration & Payment</p><p className="text-[10px] text-muted-foreground">Successful</p></div>
            </div>
            <div className="bg-muted p-4 rounded-2xl flex items-center gap-4 text-left opacity-60">
              <div className="h-10 w-10 bg-background rounded-xl flex items-center justify-center shrink-0"><Lock className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-xs font-black">Admin Approval</p><p className="text-[10px] text-muted-foreground">In Queue (24-48 Hours)</p></div>
            </div>
          </div>

          <button onClick={() => window.location.reload()} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Refresh Status</button>
          <p className="text-[10px] font-bold text-muted-foreground">Need help? <Link to="/support" className="text-emerald-600 underline">Contact RozSewa Support</Link></p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8 relative transition-colors duration-500">
      <ProviderTopNav />
      <main className="container max-w-6xl px-4 py-6 md:py-10 space-y-8 md:space-y-12 animate-in fade-in duration-700">

        {/* Superior Welcome Bar */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Welcome back, {user?.shopName || "Partner"} 👋
            </h1>
            <p className="text-[10px] md:text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">
              RozSewa Verified Professional
            </p>
          </div>

          <div className="flex bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-emerald-100 dark:border-white/5 rounded-2xl p-1.5 gap-2 shadow-xl shadow-emerald-900/5 w-full md:w-auto shrink-0">
            <button onClick={toggleOnline}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isOnline ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-emerald-50/50 dark:bg-slate-800 text-emerald-300 dark:text-slate-500 border border-emerald-100 dark:border-slate-700"
                }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-white animate-pulse" : "bg-emerald-200"}`} />
              {isOnline ? "Online" : "Offline"}
            </button>

            <div className="relative">
              <button onClick={() => setShowEmergencyMenu(!showEmergencyMenu)}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-500 relative overflow-hidden ${isEmergencyActive
                  ? "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                  : "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700"
                  }`}>
                {isEmergencyActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: [1, 2, 2.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-rose-400 rounded-xl"
                  />
                )}
                <ShieldAlert className={`h-4 w-4 relative z-10 ${isEmergencyActive ? "animate-bounce" : ""}`} />
                <span className="relative z-10">{isEmergencyActive ? "Emergency ON" : "Emergency"}</span>
              </button>

              <AnimatePresence>
                {showEmergencyMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full mt-2 right-0 w-64 bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 p-2 z-[100]"
                  >
                    <div className="p-4 border-b border-slate-50 dark:border-slate-800">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Emergency Protocol</p>
                    </div>
                    <div className="p-1 gap-2 flex flex-col">
                      <button
                        disabled
                        className="flex items-center gap-3 w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60"
                      >
                        <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <Lock className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black">SOS Mode Locked</p>
                          <p className="text-[10px] font-bold opacity-60 uppercase tracking-tighter">Feature Temporarily Offline</p>
                        </div>
                      </button>

                      <button
                        onClick={triggerSOS}
                        className="flex items-center gap-3 w-full p-4 rounded-2xl bg-rose-50 text-rose-900 transition-all text-left group"
                      >
                        <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black">SOS Alert Support</p>
                          <p className="text-[10px] font-bold opacity-60 uppercase tracking-tighter">Immediate Response</p>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Global Stats */}
        <section className="animate-in slide-in-from-bottom-5 duration-700 delay-150">
          <EarningsWidget />
        </section>

        {/* Performance Graph Section */}
        <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 shadow-xl shadow-slate-100/50 dark:shadow-none overflow-hidden animate-in slide-in-from-bottom-5 duration-700 delay-200">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white leading-none">Weekly Performance</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-1">Live Revenue Growth</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase text-slate-400">Synced</p>
            </div>
          </div>

          <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 900, fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorAmount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Action Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="space-y-1">
              <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900 dark:text-white italic">Business Infrastructure</h2>
              <div className="h-1 w-12 bg-emerald-500 rounded-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {[
              { iconPath: "/assets/3d_icons/services.png", title: "Services", desc: "Catalog", path: "/provider/services", bgColor: "bg-blue-50/80 dark:bg-blue-900/10", borderColor: "border-blue-100 dark:border-blue-900/20" },
              { iconPath: "/assets/3d_icons/timing.png", title: "Timing", desc: "Schedule", path: "/provider/availability", bgColor: "bg-amber-50/80 dark:bg-amber-900/10", borderColor: "border-amber-100 dark:border-amber-900/20" },
              { iconPath: "/assets/3d_icons/offers.png", title: "Offers", desc: "Growth", path: "/provider/offers", bgColor: "bg-pink-50/80 dark:bg-pink-900/10", borderColor: "border-pink-100 dark:border-pink-900/20" },
              { iconPath: "/assets/3d_icons/wallet.png", title: "Wallet", desc: "Revenue", path: "/provider/wallet", bgColor: "bg-emerald-50/80 dark:bg-emerald-900/10", borderColor: "border-emerald-100 dark:border-emerald-900/20" },
              { iconPath: "/assets/3d_icons/reviews.png", title: "Reviews", desc: "Ratings", path: "/provider/reviews", bgColor: "bg-yellow-50/80 dark:bg-yellow-900/10", borderColor: "border-yellow-100 dark:border-yellow-900/20" },
              { iconPath: "/assets/3d_icons/99card.png", title: "99 Card", desc: "Partner Hub", path: "/provider/99card", bgColor: "bg-slate-100 dark:bg-slate-800/30", borderColor: "border-slate-200 dark:border-slate-700" },
              { iconPath: "/assets/3d_icons/docs.png", title: "Docs", desc: "Vault", path: "/provider/documents", bgColor: "bg-cyan-50/80 dark:bg-cyan-900/10", borderColor: "border-cyan-100 dark:border-cyan-900/20" },
              { iconPath: "/assets/3d_icons/support.png", title: "Support", desc: "Hotline", path: "/provider/support", bgColor: "bg-indigo-50/80 dark:bg-indigo-900/10", borderColor: "border-indigo-100 dark:border-indigo-900/20" },
              { iconPath: "/assets/3d_icons/settings.png", title: "Settings", desc: "Admin", path: "/provider/settings", bgColor: "bg-gray-100/80 dark:bg-gray-800/30", borderColor: "border-gray-200 dark:border-gray-700" }
            ].map((item, idx) => {
              const miniIcons = [Briefcase, Clock, Tag, Wallet, Star, ShieldCheck, FileText, Headset, Settings];
              const MiniIcon = miniIcons[idx];
              return (
                <Link key={idx} to={item.path} className="group">
                  <motion.div
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className={`relative flex flex-col p-6 rounded-[2rem] border ${item.borderColor} ${item.bgColor} shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all h-full overflow-hidden text-center`}
                  >
                    <div className="h-16 w-16 self-center mb-4 transition-all group-hover:scale-110 flex items-center justify-center">
                      <img
                        src={item.iconPath}
                        alt={item.title}
                        className={`max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal ${item.title === "Support" ? "scale-125" : ""}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        <h3 className="font-black text-slate-900 dark:text-white text-sm tracking-tight">{item.title}</h3>
                        <MiniIcon className="h-3 w-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{item.desc}</p>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Activity Stream */}
        <section className="pb-10 md:pb-0">
          <RecentBookingsList />
        </section>
      </main>
      <ProviderBottomNav />

      {incomingRequest && (
        <IncomingRequestModal
          request={incomingRequest}
          onAction={() => setIncomingRequest(null)}
        />
      )}
    </div>
  );
};

export default ProviderDashboard;
