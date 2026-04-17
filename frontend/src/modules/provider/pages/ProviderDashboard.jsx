import { useState, useEffect } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import EarningsWidget from "@/modules/provider/components/EarningsWidget";
import RecentBookingsList from "@/modules/provider/components/RecentBookingsList";
import { Briefcase, CalendarCheck, FileText, Star, ShieldAlert, CreditCard, Tag, Settings, Headset, Wallet, Clock, Lock, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";
import { useSocket } from "@/context/SocketContext";
import IncomingRequestModal from "@/modules/provider/components/IncomingRequestModal";

const ProviderDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { socket, incomingRequest, setIncomingRequest } = useSocket();
  const [isOnline, setIsOnline] = useState(user?.isOnline ?? true);
  const [isEmergencyActive, setIsEmergencyActive] = useState(user?.isEmergencyEnabled ?? false);

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

  const toggleEmergency = async () => {
    const newState = !isEmergencyActive;
    setIsEmergencyActive(newState); // Optimistic update
    try {
      await API.patch("/provider/status", { isEmergencyEnabled: newState });
      toast({ title: newState ? "Emergency Mode ON" : "Emergency Mode OFF" });
    } catch (err) {
      setIsEmergencyActive(!newState); // Revert on failure
      toast({ title: "Failed to update emergency mode", variant: "destructive" });
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

            <button onClick={toggleEmergency}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isEmergencyActive ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700"
                }`}>
              <ShieldAlert className="h-3.5 w-3.5" />
              Emergency
            </button>
          </div>
        </section>

        {/* Global Stats */}
        <section className="animate-in slide-in-from-bottom-5 duration-700 delay-150">
          <EarningsWidget />
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
