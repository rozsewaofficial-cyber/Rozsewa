import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Shield, Key, Eye, Fingerprint, Smartphone, LogOut, ChevronRight, X, AlertTriangle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const Security = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast } = useToast();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "" });
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.put("/auth/password", passwordData);
      toast({ title: "Success", description: "Password updated successfully" });
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: "", newPassword: "" });
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed update", variant: "destructive" });
    }
    setLoading(false);
  };

  const confirmDeleteAccount = async () => {
    setLoading(true);
    try {
      await API.delete("/auth/profile");
      toast({ title: "Account Deleted" });
      logout();
      navigate("/login");
    } catch (err) {
      toast({ title: "Failed to delete account", variant: "destructive" });
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-black text-foreground tracking-tight">Privacy & Security</h1>
        </div>

        {/* Hero */}
        <div className="rounded-[32px] bg-emerald-600 p-8 text-white flex items-center gap-6 shadow-xl">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black italic uppercase">Account Secured</h2>
            <p className="text-xs font-bold opacity-80 leading-relaxed">Your data is protected with industry-standard encryption.</p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-2">Account Access</h3>
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowPasswordModal(true)}
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:bg-muted/50">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Key className="h-6 w-6" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-black text-foreground">Change Password</h4>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">Protect your account with a strong key</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30" />
          </motion.button>

          <div className="flex w-full items-center gap-4 rounded-2xl border border-border bg-muted/30 p-5 opacity-60">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="text-sm font-black text-foreground">Biometric Login</h4>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">Use FaceID or Fingerprint</p>
            </div>
            <span className="text-[10px] font-black uppercase text-muted-foreground bg-background px-2 py-1 rounded-lg">Soon</span>
          </div>
        </div>

        <div className="pt-4 space-y-4">
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-2">Dangerous Area</h3>
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowDeleteModal(true)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 transition-all hover:bg-rose-500/10">
            <div className="text-left">
              <h4 className="text-sm font-black text-rose-600">Delete Account</h4>
              <p className="text-xs font-bold text-rose-500/70 mt-0.5 whitespace-pre-wrap">Permanently remove all data including wallet history.</p>
            </div>
            <Trash2 className="h-5 w-5 text-rose-500" />
          </motion.button>
        </div>
      </main>

      <AnimatePresence>
        {showPasswordModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="w-full max-w-sm rounded-[32px] bg-card p-6 border border-border shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-foreground tracking-tight">Security Code</h3>
                <button onClick={() => setShowPasswordModal(false)}><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Current Password</label>
                  <input type="password" required value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full h-12 rounded-xl border border-border bg-background px-4 text-sm font-bold focus:border-primary focus:outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">New Password</label>
                  <input type="password" required minLength={6} value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full h-12 rounded-xl border border-border bg-background px-4 text-sm font-bold focus:border-primary focus:outline-none" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-primary text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showDeleteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="w-full max-w-sm rounded-[32px] bg-card p-6 border border-border shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-foreground tracking-tight">Delete Account?</h3>
                <button onClick={() => setShowDeleteModal(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="flex flex-col items-center text-center p-4 mb-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                <AlertTriangle className="h-10 w-10 text-rose-500 mb-2" />
                <p className="text-sm font-bold text-foreground">Are you absolutely sure?</p>
                <p className="text-xs font-medium text-muted-foreground mt-1">This action cannot be undone. All your data and wallet history will be permanently erased.</p>
              </div>
              <div className="space-y-3">
                <button onClick={confirmDeleteAccount} disabled={loading} className="w-full bg-rose-500 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-rose-600 transition-colors">
                  {loading ? "Deleting..." : "Yes, Delete Account"}
                </button>
                <button onClick={() => setShowDeleteModal(false)} className="w-full bg-muted text-foreground py-3.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-muted/80 transition-colors">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <BottomNav />
    </div>
  );
};

export default Security;
