import { useState, useEffect } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { Link, useNavigate } from "react-router-dom";
import { User, Building, Landmark, Lock, Bell, HelpCircle, FileText, ChevronRight, LogOut, Loader2, Power, Zap, ShieldCheck, Home } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import API from "@/lib/api";
import { motion } from "framer-motion";

const ProviderSettings = () => {
  const { logout, updateUser } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await API.get("/provider/profile");
      setProvider(data);
    } catch (err) {
      toast({ title: "Sync Error", description: "Could not load profile settings.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (type) => {
    setStatusLoading(true);
    try {
      const payload = type === 'online'
        ? { isOnline: !provider.isOnline }
        : type === 'emergency'
        ? { isEmergencyEnabled: !provider.isEmergencyEnabled }
        : { isHomeVisitAvailable: !provider.isHomeVisitAvailable };

      const { data } = await API.patch("/provider/status", payload);
      setProvider({ ...provider, ...data });
      updateUser(data); // Sync global auth context
      toast({
        title: "Status Updated",
        description: `${type === 'online' ? 'Duty visibility' : type === 'emergency' ? '24/7 service' : 'Home visit service'} changed successfully.`
      });
    } catch (err) {
      toast({ title: "Update Failed", description: "Check your connection.", variant: "destructive" });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleLogout = async () => {
    const ok = await confirm("Are you sure you want to sign out securely?", { title: "Sign Out", confirmLabel: "Sign Out", destructive: true });
    if (!ok) return;
    logout();
    toast({ title: "Signed Out", description: "Session closed securely." });
    navigate("/provider/login");
  };

  if (loading) return (
    <div className="flex h-[100dvh] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      <main className="container max-w-2xl px-4 py-6 md:py-8 space-y-6">
        {/* Profile Header Card */}
        <section className="rounded-[32px] bg-card border border-border p-6 shadow-sm flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center border-2 border-white shadow-md overflow-hidden shrink-0">
            {provider?.profileImage ? (
              <img src={provider.profileImage} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-black text-emerald-700">{provider?.ownerName?.charAt(0)}</span>
            )}
          </div>
          <div className="text-left overflow-hidden">
            <h2 className="text-lg font-black tracking-tighter text-foreground truncate">{provider?.ownerName}</h2>
            <p className="text-xs text-muted-foreground font-bold flex items-center gap-1.5 truncate">
              {provider?.shopName} • <span className="text-emerald-600 flex items-center gap-0.5"><ShieldCheck className="h-3 w-3" /> Verified</span>
            </p>
          </div>
        </section>

        {/* Live Status Toggles */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            disabled={statusLoading}
            onClick={() => handleToggleStatus('online')}
            className={`rounded-2xl p-3 sm:p-4 border text-left transition-all cursor-pointer ${provider?.isOnline ? 'bg-emerald-50 border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800/40' : 'bg-muted/30 border-border opacity-70'}`}
          >
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center mb-2 ${provider?.isOnline ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-muted text-muted-foreground'}`}>
              <Power className="h-4 w-4" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground truncate">Duty Status</p>
            <h4 className={`text-xs sm:text-sm font-black mt-0.5 ${provider?.isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
              {provider?.isOnline ? 'ONLINE' : 'OFFLINE'}
            </h4>
          </button>

          <button
            disabled={statusLoading}
            onClick={() => handleToggleStatus('emergency')}
            className={`rounded-2xl p-3 sm:p-4 border text-left transition-all cursor-pointer ${provider?.isEmergencyEnabled ? 'bg-amber-50 border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-800/40' : 'bg-muted/30 border-border opacity-70'}`}
          >
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center mb-2 ${provider?.isEmergencyEnabled ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-muted text-muted-foreground'}`}>
              <Zap className="h-4 w-4" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground truncate">24/7 Service</p>
            <h4 className={`text-xs sm:text-sm font-black mt-0.5 ${provider?.isEmergencyEnabled ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
              {provider?.isEmergencyEnabled ? 'ACTIVE' : 'INACTIVE'}
            </h4>
          </button>

          <button
            disabled={statusLoading}
            onClick={() => handleToggleStatus('homeVisit')}
            className={`rounded-2xl p-3 sm:p-4 border text-left transition-all cursor-pointer ${provider?.isHomeVisitAvailable ? 'bg-blue-50 border-blue-200/80 dark:bg-blue-950/40 dark:border-blue-800/40' : 'bg-muted/30 border-border opacity-70'}`}
          >
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center mb-2 ${provider?.isHomeVisitAvailable ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-muted text-muted-foreground'}`}>
              <Home className="h-4 w-4" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground truncate">Home Visit</p>
            <h4 className={`text-xs sm:text-sm font-black mt-0.5 ${provider?.isHomeVisitAvailable ? 'text-blue-700 dark:text-blue-400' : 'text-foreground'}`}>
              {provider?.isHomeVisitAvailable ? 'ACTIVE' : 'INACTIVE'}
            </h4>
          </button>
        </div>

        <div className="space-y-4 md:space-y-6">
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <h3 className="bg-muted/30 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-border text-left">Business Management</h3>
            <div className="divide-y divide-border">
              <Link to="/provider/profile" className="flex items-center justify-between p-5 hover:bg-muted/30 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600"><User className="h-5 w-5" /></div>
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-foreground">Profile & Account</h4>
                    <p className="text-[10px] text-muted-foreground font-medium">Edit owner & shop information</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 transition" />
              </Link>
              <Link to="/provider/wallet" className="flex items-center justify-between p-5 hover:bg-muted/30 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 dark:bg-green-900/30 text-emerald-600"><Landmark className="h-5 w-5" /></div>
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-foreground">Wallet & Payouts</h4>
                    <p className="text-[10px] text-muted-foreground font-medium">Bank details & earnings history</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 transition" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <h3 className="bg-muted/30 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-border text-left">Preferences</h3>
            <div className="divide-y divide-border">
              <Link to="/provider/notifications" className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600"><Bell className="h-5 w-5" /></div>
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-foreground">Notifications</h4>
                    <p className="text-[10px] text-muted-foreground font-medium">SMS & App notification alerts</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 transition" />
              </Link>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 dark:bg-rose-900/20 py-4 text-sm font-black text-rose-600 shadow-sm border border-rose-100 dark:border-rose-900/40 hover:bg-rose-100 transition-all active:scale-95">
              <LogOut className="h-4 w-4" /> Sign Out Securely
            </button>
            <button className="w-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-600 transition-colors">Request Account Deletion</button>
          </div>
        </div>
      </main>
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderSettings;
