import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, MapPin, Phone, Mail, ChevronRight, Wallet, Star, Clock, Settings, LogOut, Bell, Shield, Gift, Heart, HelpCircle, Edit3, X, Save, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const menuItems = [
  { icon: Clock, label: "My Bookings", desc: "View booking history", path: "/my-bookings" },
  { icon: Heart, label: "Favorites", desc: "Saved providers", path: "/favorites" },
  { icon: MapPin, label: "Saved Addresses", desc: "Home, Office & more", path: "/addresses" },
  { icon: Bell, label: "Notifications", desc: "Manage alerts", path: "/notifications" },
  { icon: Shield, label: "Security", desc: "Password & biometrics", path: "/security" },
  { icon: HelpCircle, label: "Help & Support", desc: "FAQs & tickets", path: "/help-support" },
];

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState({
    name: user?.name || "",
    phone: user?.mobile || "",
    email: user?.email || "",
    avatar: user?.avatar || null
  });

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(profile);
  const [isSaving, setIsSaving] = useState(false);

  // Sync profile when user context updates
  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name,
        phone: user.mobile,
        email: user.email,
        avatar: user.avatar
      });
      setEditForm({
        name: user.name,
        phone: user.mobile,
        email: user.email,
        avatar: user.avatar
      });
    }
  }, [user]);

  // Real stats (Keep bookings as is for now until we integrate Bookings API)
  const bookings = JSON.parse(localStorage.getItem("rozsewa_bookings") || "[]");
  const completed = bookings.filter(b => b.status === "completed").length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await API.put("/auth/profile", {
        name: editForm.name,
        email: editForm.email,
        mobile: editForm.phone,
        avatar: editForm.avatar,
        location: editForm.location
      });
      setProfile(editForm);
      toast({ title: "Profile Updated Successfully" });
      setShowEdit(false);
    } catch (err) {
      toast({ title: "Update Failed", description: err.response?.data?.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setEditForm({ ...editForm, avatar: url });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-gradient-to-br from-card to-card/50 p-6 shadow-xl shadow-black/5 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

          <div className="flex items-center gap-5 relative z-10">
            <div className="relative group cursor-pointer" onClick={() => { setEditForm(profile); setShowEdit(true); }}>
              <div className="flex h-24 w-24 overflow-hidden items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 shadow-inner">
                {profile.avatar ? <img src={profile.avatar} alt="Profile" className="h-full w-full object-cover" /> : <User className="h-10 w-10 text-primary" />}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Edit3 className="text-white h-6 w-6" />
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-black text-foreground tracking-tight">{profile.name}</h1>
              <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Phone className="h-4 w-4 text-primary" /> {profile.phone}</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Mail className="h-4 w-4 text-emerald-500" /> {profile.email}</div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Bookings", value: completed.toString(), icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Favorites", value: (user?.favorites?.length || 0).toString(), icon: Heart, color: "text-pink-500", bg: "bg-pink-500/10" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:bg-muted/50">
              <div className={`p-2 rounded-xl ${stat.bg}`}><stat.icon className={`h-5 w-5 ${stat.color}`} /></div>
              <span className="text-xl font-black text-foreground">{stat.value}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </motion.div>
          ))}
        </div>

        <div className="space-y-2">
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button key={item.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.98 }}
                onClick={() => item.path && navigate(item.path)} className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Icon className="h-5 w-5 text-primary group-hover:text-primary-foreground transition-all" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-foreground">{item.label}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all" />
              </motion.button>
            );
          })}
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-4 text-sm font-extrabold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400">
          <LogOut className="h-5 w-5" /> Logout
        </motion.button>
      </main>
      <BottomNav />

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEdit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-5 bg-muted/30">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Edit Profile</h3>
                <button onClick={() => setShowEdit(false)} className="rounded-full p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleSaveProfile} className="p-5 space-y-5">
                <div className="flex justify-center">
                  <div className="relative group">
                    <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-muted shadow-lg">
                      {editForm.avatar ? <img src={editForm.avatar} className="h-full w-full object-cover" alt="Avatar" /> : <User className="h-full w-full p-4 text-muted-foreground" />}
                    </div>
                    <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-primary p-2 text-white shadow-lg hover:bg-primary/90 transition-colors">
                      <Edit3 className="h-4 w-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Full Name</label>
                    <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Mobile Number</label>
                    <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Email Address</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-border">
                  <button
                    type="button"
                    onClick={() => {
                      if ("geolocation" in navigator) {
                        navigator.geolocation.getCurrentPosition(async (pos) => {
                          const { latitude, longitude } = pos.coords;
                          setEditForm(f => ({ ...f, location: { type: 'Point', coordinates: [longitude, latitude] } }));
                          toast({ title: "Coordinates Detected", description: "Save profile to update service location." });
                        });
                      }
                    }}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs font-black uppercase text-emerald-600 tracking-widest hover:bg-emerald-500/10 transition-all outline-none"
                  >
                    <MapPin className="h-4 w-4" /> Update Service Location
                  </button>
                </div>

                <motion.button whileTap={{ scale: 0.97 }} type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-600 py-4 text-sm font-black text-white shadow-xl shadow-primary/20 hover:shadow-2xl transition-all">
                  <Save className="h-5 w-5" /> Save Changes
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
