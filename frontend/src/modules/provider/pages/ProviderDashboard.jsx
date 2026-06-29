import { useState, useEffect, useRef } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import EarningsWidget from "@/modules/provider/components/EarningsWidget";
import RecentBookingsList from "@/modules/provider/components/RecentBookingsList";
import {
  Briefcase, CalendarCheck, FileText, Star, ShieldAlert, CreditCard, Tag, Settings, Headset,
  Wallet, Clock, Lock, ShieldCheck, AlertCircle, CheckCircle, TrendingUp, Crown, Zap, Upload, XCircle,
  Percent, ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
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
const defaultMenu = [
  { iconPath: "/assets/3d_icons/services.png", title: "Services", desc: "Catalog", path: "/provider/services", bgColor: "bg-blue-50/80 dark:bg-blue-900/10", borderColor: "border-blue-100 dark:border-blue-900/20" },
  { iconPath: "/assets/3d_icons/timing.png", title: "Timing", desc: "Schedule", path: "/provider/availability", bgColor: "bg-amber-50/80 dark:bg-amber-900/10", borderColor: "border-amber-100 dark:border-amber-900/20" },
  { iconPath: "/assets/3d_icons/wallet.png", title: "Wallet", desc: "Revenue", path: "/provider/wallet", bgColor: "bg-emerald-50/80 dark:bg-emerald-900/10", borderColor: "border-emerald-100 dark:border-emerald-900/20" },
  { iconPath: "/assets/3d_icons/reviews.png", title: "Reviews", desc: "Ratings", path: "/provider/reviews", bgColor: "bg-yellow-50/80 dark:bg-yellow-900/10", borderColor: "border-yellow-100 dark:border-yellow-900/20" },
  { iconPath: "/assets/3d_icons/99card.png", title: "Registration", desc: "Plan & Status", path: "/provider/99card", bgColor: "bg-slate-100 dark:bg-slate-800/30", borderColor: "border-slate-200 dark:border-slate-700" },
  { iconPath: "/assets/3d_icons/docs.png", title: "Docs", desc: "Vault", path: "/provider/documents", bgColor: "bg-cyan-50/80 dark:bg-cyan-900/10", borderColor: "border-cyan-100 dark:border-cyan-900/20" },
  { iconPath: "/assets/3d_icons/support.png", title: "Support", desc: "Hotline", path: "/provider/support", bgColor: "bg-indigo-50/80 dark:bg-indigo-900/10", borderColor: "border-indigo-100 dark:border-indigo-900/20" },
  { iconPath: "/assets/3d_icons/settings.png", title: "Settings", desc: "Admin", path: "/provider/settings", bgColor: "bg-gray-100/80 dark:bg-gray-800/30", borderColor: "border-gray-200 dark:border-gray-700" }
];

import { useSocket } from "@/context/SocketContext";

const ProviderDashboard = () => {
  const { toast } = useToast();
  const { user, updateUser } = useAuth();
  const { socket, incomingRequest, setIncomingRequest } = useSocket();
  const [isOnline, setIsOnline] = useState(user?.isOnline ?? true);
  const [isEmergencyActive, setIsEmergencyActive] = useState(user?.isEmergencyEnabled ?? false);
  const [showEmergencyMenu, setShowEmergencyMenu] = useState(false);
  const emergencyMenuRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [supportNum, setSupportNum] = useState("91XXXXXXXXXX");
  const [dynamicChartData, setDynamicChartData] = useState(chartDataFallback);
  const [plans, setPlans] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const isSubscribed = user?.isSubscribed || false;
  const [commissionPreview, setCommissionPreview] = useState(null);
  const [estimateAmount, setEstimateAmount] = useState("1000");
  const [estimation, setEstimation] = useState(null);

  const fetchCommissionPreview = async () => {
    try {
      const { data } = await API.get("/v2/provider/commission-preview?bookingAmount=1000");
      setCommissionPreview(data);
      setEstimation(data);
    } catch (err) {}
  };

  const handleEstimate = async (val) => {
    setEstimateAmount(val);
    if (!val || isNaN(val)) return;
    try {
      const { data } = await API.get(`/v2/provider/commission-preview?bookingAmount=${val}`);
      setEstimation(data);
    } catch (err) {}
  };

  const { theme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Close emergency menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (emergencyMenuRef.current && !emergencyMenuRef.current.contains(e.target)) {
        setShowEmergencyMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  const tickColor = theme === 'dark' ? '#cbd5e1' : '#64748b'; // slate-300 : slate-500

  const fetchPlans = async () => {
    try {
      const { data } = await API.get("/provider/subscription-plans");
      setPlans(data);
    } catch (err) { }
  };

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

    const loadRazorpay = () => {
      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
      }
    };

    const fetchMenu = async () => {
      try {
        const { data } = await API.get("/provider/menu");
        setMenuItems(data);
      } catch (err) { }
    };

    fetchConfig();
    fetchStats();
    fetchPlans();
    fetchMenu();
    loadRazorpay();
    fetchCommissionPreview();
  }, []);

  const handleUpgrade = () => {
    window.location.href = "/provider/subscriptions";
  };

  useEffect(() => {
    if (user) {
      setIsOnline(user.isOnline);
      setIsEmergencyActive(user.isEmergencyEnabled);
    }
  }, [user]);

  const toggleOnline = async () => {
    const newState = !isOnline;
    
    // Request notification permission to show incoming requests in the background
    if (newState && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }

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
      updateUser({ isEmergencyEnabled: newState }); // Sync global auth context
      toast({ title: newState ? "Emergency Mode ON" : "Emergency Mode OFF" });
    } catch (err) {
      setIsEmergencyActive(!newState); // Revert on failure
      toast({ title: "Failed to update emergency mode", variant: "destructive" });
    } finally {
      setShowEmergencyMenu(false);
    }
  };
  const getChecklistItem = (label, docId, isRequired = false) => {
    const doc = user?.documents?.find(d => d.id === docId);
    
    let icon = "⏳";
    let iconCls = "text-amber-500 bg-amber-50 dark:bg-amber-950/20";
    let statusText = "Pending Review";
    let actionBtn = null;
    
    if (!doc) {
      icon = "⚪";
      iconCls = "text-slate-400 bg-slate-50 dark:bg-slate-900/20";
      statusText = isRequired ? "Required" : "Optional";
      if (!user?.kycSubmitted || user?.kycStatus === 'draft' || user?.kycStatus === 'rejected') {
        actionBtn = (
          <Link to="/provider/documents" className="text-xs font-black text-emerald-600 hover:underline uppercase tracking-wider shrink-0">
            {docId === 'live_video' ? 'Record' : 'Upload'}
          </Link>
        );
      }
    } else if (doc.status === 'draft') {
      icon = "⏳";
      iconCls = "text-blue-500 bg-blue-50 dark:bg-blue-950/20";
      statusText = "Uploaded (Draft)";
      if (!user?.kycSubmitted || user?.kycStatus === 'draft' || user?.kycStatus === 'rejected') {
        actionBtn = (
          <Link to="/provider/documents" className="text-xs font-black text-emerald-600 hover:underline uppercase tracking-wider shrink-0">
            Edit
          </Link>
        );
      }
    } else if (doc.status === 'verified') {
      icon = "✓";
      iconCls = "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20";
      statusText = "Approved";
    } else if (doc.status === 'rejected') {
      icon = "✖";
      iconCls = "text-rose-500 bg-rose-50 dark:bg-rose-950/20";
      statusText = "Rejected";
      if (!user?.kycSubmitted || user?.kycStatus === 'draft' || user?.kycStatus === 'rejected') {
        actionBtn = (
          <Link to="/provider/documents" className="text-xs font-black text-rose-600 hover:underline uppercase tracking-wider shrink-0">
            {docId === 'live_video' ? 'Re-record' : 'Re-upload'}
          </Link>
        );
      }
    }

    return (
      <div key={docId} className="flex flex-col space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black ${iconCls}`}>
              {icon}
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{label}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{statusText}</p>
            </div>
          </div>
          {actionBtn}
        </div>
        {doc?.status === 'rejected' && doc.rejectionReason && (
          <p className="text-[10px] font-bold text-rose-600 bg-rose-100/40 p-2 rounded-lg text-left leading-relaxed">
            Reason: {doc.rejectionReason}
          </p>
        )}
      </div>
    );
  };

  // KYC Check for Sewaks
  if (user?.providerCategory === 'sewak' && !user?.kycVerified) {
    const kycStatus = user?.kycStatus || 'draft';

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800">
          <div className="h-20 w-20 bg-amber-50 dark:bg-amber-950/20 rounded-[28px] flex items-center justify-center mb-6 mx-auto border-2 border-amber-100/50 dark:border-amber-900/30">
            {kycStatus === 'submitted' || kycStatus === 'under_review' ? (
              <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
            ) : kycStatus === 'rejected' ? (
              <XCircle className="h-10 w-10 text-rose-500" />
            ) : (
              <ShieldAlert className="h-10 w-10 text-amber-500" />
            )}
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2 uppercase">
            {kycStatus === 'submitted' ? "KYC Submitted" :
             kycStatus === 'under_review' ? "KYC Under Review" :
             kycStatus === 'partially_approved' ? "Partially Approved" :
             kycStatus === 'rejected' ? "KYC Rejected" : "Identity KYC Required"}
          </h1>

          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed mb-6">
            {kycStatus === 'submitted' || kycStatus === 'under_review' || kycStatus === 'partially_approved'
              ? "Your KYC documents are currently in review by the admin panel. Please check your verification checklist below."
              : kycStatus === 'rejected'
              ? "One or more of your required verification documents were rejected. Please review and update them."
              : "To start receiving customer bookings, you must complete your identity verification by recording a live video and uploading required documents."}
          </p>

          {/* Checklist */}
          <div className="space-y-2 mb-6">
            <h3 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-left mb-1">Verification Checklist</h3>
            {getChecklistItem("Aadhaar Card", "aadhaar", true)}
            {getChecklistItem("PAN Card", "pan", true)}
            {getChecklistItem("Live Video Verification", "live_video", true)}
            {/* Optional ones if uploaded */}
            {user?.documents?.some(d => d.id === 'gst') && getChecklistItem("GST Certificate", "gst")}
            {user?.documents?.some(d => d.id === 'license') && getChecklistItem("Business License", "license")}
            {user?.documents?.some(d => d.id === 'certification') && getChecklistItem("Skill Certification", "certification")}
            {user?.documents?.some(d => d.id === 'police') && getChecklistItem("Police Verification", "police")}
          </div>

          {/* Submit/Action Button */}
          {(!user?.kycSubmitted || kycStatus === 'draft' || kycStatus === 'rejected') ? (
            <Link
              to="/provider/documents"
              className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-14 rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mb-2 text-sm uppercase tracking-wider animate-in fade-in"
            >
              <Upload className="h-4.5 w-4.5" />
              <span>Go to Verification Vault</span>
            </Link>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="w-full h-14 bg-slate-900 text-white hover:bg-slate-800 font-black rounded-2xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 mb-2 text-sm uppercase tracking-wider"
            >
              <span>Refresh Status</span>
            </button>
          )}

          <p className="text-[10px] font-bold text-muted-foreground mt-4">
            Need help? <Link to="/provider/support" className="text-emerald-600 underline">Contact RozSewa Support</Link>
          </p>
        </div>
      </div>
    );
  }

  // Approval Overlay / Pending Screen / Rejected Screen
  if (user?.status === 'pending' || user?.status === 'suspended' || user?.status === 'rejected') {
    return (
      <div className="min-h-[100dvh] bg-background">
        <ProviderTopNav />
        <main className="container max-w-lg px-6 py-12 flex flex-col items-center justify-center text-center space-y-8">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`h-24 w-24 rounded-[40px] flex items-center justify-center rotate-12 ${user?.status === 'rejected' ? 'bg-rose-100' : 'bg-amber-100'}`}>
            {user?.status === 'suspended' ? <AlertCircle className="h-12 w-12 text-red-600 -rotate-12" /> : 
             user?.status === 'rejected' ? <XCircle className="h-12 w-12 text-rose-600 -rotate-12" /> :
             <Clock className="h-12 w-12 text-amber-600 -rotate-12 animate-pulse" />}
          </motion.div>

          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tighter">
              {user?.status === 'suspended' ? "Account Suspended" : 
               user?.status === 'rejected' ? "KYC Rejected" :
               "Approval Pending"}
            </h1>
            <p className="text-sm font-medium text-muted-foreground px-4">
              {user?.status === 'suspended'
                ? "Your account has been suspended due to policy violations. Please contact support."
                : user?.status === 'rejected'
                ? "Your KYC documents were rejected. Please re-apply with valid documents."
                : "Great! Your registration and payment are complete. Our team is currently verifying your documents."}
            </p>
          </div>

          <div className="w-full bg-card border-2 border-dashed border-border p-6 rounded-3xl space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60">
              <span>Partner ID</span>
              <span className="text-emerald-600">Secure Protocol</span>
            </div>
            <p className="text-3xl font-black font-mono tracking-widest text-foreground">{user?.vendorCode}</p>
            <div className={`pt-4 border-t border-border flex items-center justify-center gap-2 text-xs font-bold ${user?.status === 'rejected' ? 'text-rose-700' : 'text-amber-700'}`}>
              <ShieldCheck className="h-4 w-4" /> {user?.status === 'rejected' ? 'Verification Failed' : 'Final Verification In-Progress'}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 w-full">
            <div className="bg-muted p-4 rounded-2xl flex items-center gap-4 text-left">
              <div className="h-10 w-10 bg-background rounded-xl flex items-center justify-center shrink-0"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="text-xs font-black">Registration & Payment</p><p className="text-[10px] text-muted-foreground">Successful</p></div>
            </div>
            <div className={`bg-muted p-4 rounded-2xl flex items-center gap-4 text-left ${user?.status === 'rejected' ? '' : 'opacity-60'}`}>
              <div className="h-10 w-10 bg-background rounded-xl flex items-center justify-center shrink-0">
                {user?.status === 'rejected' ? <XCircle className="h-5 w-5 text-rose-600" /> : <Lock className="h-5 w-5 text-amber-600" />}
              </div>
              <div>
                <p className="text-xs font-black">Admin Approval</p>
                <p className="text-[10px] text-muted-foreground">{user?.status === 'rejected' ? 'Action Required' : 'In Queue (24-48 Hours)'}</p>
              </div>
            </div>
          </div>

          {user?.status === 'rejected' ? (
            <button 
              onClick={async () => {
                try {
                  await API.patch('/provider/reapply-kyc');
                  toast({ title: 'Re-applied successfully', description: 'Please wait for verification.' });
                  window.location.reload();
                } catch (error) {
                  toast({ title: 'Failed to re-apply', variant: 'destructive' });
                }
              }} 
              className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-colors"
            >
              Re-apply for Verification
            </button>
          ) : (
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Refresh Status</button>
          )}
          <p className="text-[10px] font-bold text-muted-foreground">Need help? <Link to="/provider/support" className="text-emerald-600 underline">Contact RozSewa Support</Link></p>
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
          <div className="space-y-1.5 w-full md:w-auto">
            <div className="flex sm:hidden items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg border border-border/50 w-fit mb-2 shadow-sm">
              <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span>{currentTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {currentTime.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Welcome back, {user?.shopName || "Partner"} 👋
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] md:text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">
                RozSewa Verified Professional
              </span>
              {isSubscribed && user?.providerCategory !== 'sewak' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-[9px] font-black text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase tracking-widest">
                  Valid till: {user?.subscriptionExpiry ? new Date(user.subscriptionExpiry).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : 'Lifetime'}
                </span>
              )}
            </div>
          </div>

          <div className="flex bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-emerald-100 dark:border-white/5 rounded-2xl p-1.5 gap-2 shadow-xl shadow-emerald-900/5 w-full md:w-auto shrink-0">
            <button onClick={toggleOnline}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isOnline ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-emerald-50/50 dark:bg-slate-800 text-emerald-300 dark:text-slate-500 border border-emerald-100 dark:border-slate-700"
                }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-white animate-pulse" : "bg-emerald-200"}`} />
              {isOnline ? "Online" : "Offline"}
            </button>

            <div className="relative" ref={emergencyMenuRef}>
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

        {/* Commission Status / Partner Program Card */}
        {user?.providerCategory !== 'sewak' && commissionPreview && (
          <section className="animate-in fade-in duration-700 mt-6 text-left">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[1.5rem] shadow-sm space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-100 dark:border-emerald-900/40 text-[9px] font-bold uppercase tracking-wider">
                    Partner Program Active
                  </div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1.5">
                    Your Commission Overview
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Current active strategy: <span className="text-emerald-500 font-bold">{commissionPreview.currentRule}</span>
                  </p>
                </div>
                <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/40 shrink-0">
                  <Percent className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                {/* State 1: Free Trial */}
                {commissionPreview.appliedSource === 'FREE_TRIAL' && (
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 rounded-2xl text-left">
                    <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 rounded-full">Free Trial Active</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Current Commission</span>
                        <span className="text-base font-black text-emerald-600">0%</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Free Jobs Left</span>
                        <span className="text-base font-black text-slate-800 dark:text-slate-100">{commissionPreview.remainingFreeServices} / 3</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Next Strategy</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-350">Category Default</span>
                      </div>
                      <div className="flex items-center">
                        <Link to="/provider/subscriptions" className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1">
                          Upgrade early <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* State 2: Active Subscription */}
                {commissionPreview.appliedSource === 'SUBSCRIPTION' && commissionPreview.activeSubscription && (
                  <div className="p-4 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100/50 dark:border-purple-900/30 rounded-2xl text-left">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-widest px-2.5 py-1 bg-purple-100 dark:bg-purple-900/40 rounded-full">Active Member: {commissionPreview.activeSubscription.planName}</span>
                      <Link to="/provider/subscriptions" className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 hover:text-purple-800 tracking-wider">Manage</Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Commission Rate</span>
                        <span className="text-base font-black text-purple-600">{commissionPreview.currentCommissionPercentage}%</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Days Left</span>
                        <span className="text-base font-black text-slate-800 dark:text-slate-100">{commissionPreview.activeSubscription.daysRemaining} Days</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Benefits</span>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mt-1 truncate">
                          {commissionPreview.activeSubscription.benefits?.join(', ') || 'Featured badge, priority client listings'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* State 3: Category Slab / Global fallback / Override / Waiver */}
                {commissionPreview.appliedSource !== 'FREE_TRIAL' && commissionPreview.appliedSource !== 'SUBSCRIPTION' && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/40 rounded-2xl text-left">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                        {commissionPreview.appliedSource === 'PROVIDER_OVERRIDE' ? 'Override Applied' : 
                         (commissionPreview.appliedSource === 'WAIVER' ? 'Waiver Active' : 'Category Defaults')}
                      </span>
                      <Link to="/provider/subscriptions" className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 hover:text-blue-850 tracking-widest flex items-center gap-1">
                        Get Discount <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Current Category</span>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase block truncate">{commissionPreview.categoryCommission.categoryName}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Commission Rate</span>
                        <span className="text-base font-black text-emerald-600">{commissionPreview.currentCommissionPercentage}%</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Active Slab Range</span>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-350">{commissionPreview.categoryCommission.activeSlabRange}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Slab Rule Description</span>
                        <span className="text-[10px] text-slate-400 font-medium block">Commission rate scales dynamically based on booking price.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </section>
        )}

        {/* Registration Status / Elite Banner */}
        {user?.providerCategory !== 'sewak' && !isSubscribed && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 p-4 md:p-6 text-white shadow-2xl shadow-emerald-500/20 border border-white/10 group text-left">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>

                <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="h-12 w-12 md:h-16 md:w-16 shrink-0 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30 shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                      <Crown className="h-6 w-6 md:h-8 md:w-8 text-amber-400 fill-amber-400" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-400/20 rounded-full border border-amber-400/30">
                        <Zap className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-amber-200">Registration Hub</span>
                      </div>
                      <h2 className="text-base md:text-2xl font-black tracking-tighter leading-tight">
                        Reduce Commission to <span className="text-amber-400">{plans[0]?.offeredCommissionRate || 5}% Yearly</span>
                      </h2>
                      <p className="text-[10px] md:text-xs font-bold text-emerald-100/70 italic hidden sm:block uppercase tracking-widest">
                        Keep more earnings on every booking.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:flex-col md:items-end gap-3 border-t border-white/10 pt-3 md:border-none md:pt-0">
                    <div className="text-left md:text-right">
                      <p className="text-[8px] font-black text-emerald-300 uppercase tracking-widest leading-none">Starting At</p>
                      <p className="text-xl md:text-3xl font-black tracking-tighter mt-0.5">₹{plans[0]?.price || 999}<span className="text-xs opacity-60">/yr</span></p>
                    </div>
                    <button
                      onClick={handleUpgrade}
                      disabled={isLoading}
                      className="px-6 py-2.5 md:px-8 md:py-3 bg-white text-emerald-900 rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20"
                    >
                      {isLoading ? "Wait..." : "Upgrade Now"}
                    </button>
                  </div>
                </div>
              </div>
          </section>
        )}

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
                  tick={{ fontSize: 10, fontWeight: 900, fill: tickColor }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 900, fill: tickColor }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 900, fontSize: '12px', backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
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
            {(menuItems.length > 0 ? menuItems : defaultMenu).filter(item => user?.providerCategory !== 'sewak' || item.title !== "Registration").map((item, idx) => {
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

    </div>
  );
};

export default ProviderDashboard;
