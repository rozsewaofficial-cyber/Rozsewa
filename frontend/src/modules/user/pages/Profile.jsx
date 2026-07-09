import { useState, useEffect } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { motion, AnimatePresence } from "framer-motion";
import { User, MapPin, Phone, Mail, ChevronRight, Wallet, Star, Clock, Settings, LogOut, Bell, Shield, Gift, Heart, HelpCircle, Edit3, X, Save, Crown, MessageCircle, ShoppingBag, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { validateEmail, sanitizeEmail } from "@/lib/emailValidation";
import { validatePhone, sanitizePhone } from "@/lib/phoneValidation";
import { validateName, sanitizeName, sanitizeNameOnChange } from "@/lib/nameValidation";

const menuItems = [
  { icon: Wallet, label: "My Wallet", desc: "Balance & transactions", path: "/wallet" },
  { icon: Clock, label: "My Bookings", desc: "View booking history", path: "/my-bookings" },
  { icon: Heart, label: "Favorites", desc: "Saved providers", path: "/favorites" },
  { icon: ShoppingBag, label: "My Bazaar Ads", desc: "Ads you have posted", path: "/my-bazaar-ads" },
  { icon: MapPin, label: "Saved Addresses", desc: "Home, Office & more", path: "/addresses" },
  { icon: Bell, label: "Notifications", desc: "Manage alerts", path: "/notifications" },
  { icon: HelpCircle, label: "Help & Support", desc: "FAQs & tickets", path: "/help-support" },
  { icon: Shield, label: "Privacy Policy", desc: "How we protect your data", path: "/privacy" },
  { icon: Edit3, label: "Terms & Conditions", desc: "Platform usage rules", path: "/terms" },
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [offerRequests, setOfferRequests] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [activeOfferTab, setActiveOfferTab] = useState('received'); // 'received' or 'sent'

  useScrollLock(showEdit);

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

  useEffect(() => {
    const fetchOfferRequests = async () => {
      try {
        setOffersLoading(true);
        const res = await API.get('/bazaar/user-offers'); // Fetch BOTH incoming and outgoing offers
        if (res.data.success) setOfferRequests(res.data.data);
      } catch (e) {
        // silently fail
      } finally {
        setOffersLoading(false);
      }
    };
    fetchOfferRequests();
  }, []);

  const bookings = JSON.parse(localStorage.getItem("rozsewa_bookings") || "[]");
  const completed = bookings.filter(b => b.status === "completed").length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleDeleteAccount = async () => {
    try {
      setIsSaving(true);
      await API.delete("/auth/profile");
      toast({ title: "Account Deleted", description: "Your account has been deleted successfully." });
      logout();
      navigate("/login");
    } catch (err) {
      toast({ title: "Delete Failed", description: err.response?.data?.message || "Something went wrong", variant: "destructive" });
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeName(editForm.name);
    const nameValidation = validateName(sanitizedName);
    if (!nameValidation.isValid) {
      toast({ title: "Invalid Name", description: nameValidation.message, variant: "destructive" });
      return;
    }
    const updatedForm = { ...editForm, name: sanitizedName };

    if (updatedForm.email && !validateEmail(updatedForm.email)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    const phoneValidation = validatePhone(updatedForm.phone);
    if (!phoneValidation.isValid) {
      toast({ title: "Invalid Mobile", description: phoneValidation.message, variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await API.put("/auth/profile", {
        name: updatedForm.name,
        email: updatedForm.email,
        mobile: updatedForm.phone,
        avatar: updatedForm.avatar,
        location: updatedForm.location
      });
      setProfile(updatedForm);
      toast({ title: "Profile Updated Successfully" });
      setShowEdit(false);
    } catch (err) {
      toast({ title: "Update Failed", description: err.response?.data?.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsSaving(true);
      try {
        const { compressImage } = await import('@/lib/imageCompression');
        const compressedFile = await compressImage(file, 800, 800, 0.7);
        
        const formData = new FormData();
        formData.append("image", compressedFile);
        const { data } = await API.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        setEditForm({ ...editForm, avatar: data.url });
        toast({ title: "Image Uploaded", description: "Profile photo updated. Click Save to confirm." });
      } catch (err) {
        toast({ title: "Upload Failed", description: "Could not upload image.", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 selection:bg-blue-200">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6">
        {/* Profile Header Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-6 mb-6">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center gap-5 relative z-10">
            <div className="relative group cursor-pointer" onClick={() => { setEditForm(profile); setShowEdit(true); }}>
              <div className="h-24 w-24 overflow-hidden rounded-[24px] border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-inner">
                {profile.avatar && !profile.avatar.startsWith('blob:') ? (
                  <img src={profile.avatar} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-blue-50 dark:bg-slate-800/50 text-blue-500">
                    <User className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-[24px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm">
                <Edit3 className="text-white h-6 w-6" />
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{profile.name || "Guest User"}</h1>
              <div className="mt-1.5 flex items-center gap-2 text-[13px] font-bold text-slate-500 dark:text-slate-400">
                <Phone className="h-4 w-4 text-blue-500" /> {profile.phone || "No phone added"}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[13px] font-bold text-slate-500 dark:text-slate-400">
                <Mail className="h-4 w-4 text-emerald-500" /> {profile.email || "No email added"}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bazaar Chat Requests Section */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between mb-3 sticky top-[68px] md:top-[72px] z-40 bg-slate-50 dark:bg-slate-900 py-3 -mx-4 px-4 shadow-sm border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Bazaar Chat Requests</h2>
            </div>
            {offerRequests.length > 0 && (() => {
              const receivedCount = offerRequests.filter(o => o.sellerId?._id === user?._id).length;
              const sentCount = offerRequests.filter(o => o.buyerId?._id === user?._id).length;
              return (
                <div className="flex items-center gap-1.5">
                  {receivedCount > 0 && (
                    <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      {receivedCount} received
                    </span>
                  )}
                  {sentCount > 0 && (
                    <span className="text-[10px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                      {sentCount} sent
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {offersLoading ? (
            <div className="flex justify-center py-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {offerRequests.length > 0 && (
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-4">
                  <button 
                    onClick={() => setActiveOfferTab('received')}
                    className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${activeOfferTab === 'received' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Received
                  </button>
                  <button 
                    onClick={() => setActiveOfferTab('sent')}
                    className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${activeOfferTab === 'sent' ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Sent
                  </button>
                </div>
              )}

              {offerRequests.filter(offer => activeOfferTab === 'sent' ? offer.buyerId?._id === user?._id : offer.sellerId?._id === user?._id).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed text-center">
                  <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-[13px] font-bold text-slate-600 dark:text-slate-400">No {activeOfferTab} requests yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">When someone makes an offer on your items, or you make an offer, it will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {offerRequests.filter(offer => activeOfferTab === 'sent' ? offer.buyerId?._id === user?._id : offer.sellerId?._id === user?._id).map((offer, i) => {
                  const statusColors = {
                    pending: 'bg-blue-100 text-blue-700',
                    countered: 'bg-orange-100 text-orange-700',
                    deal_locked: 'bg-green-100 text-green-700',
                    rejected: 'bg-red-100 text-red-700',
                    accepted: 'bg-green-100 text-green-700',
                  };
                  const statusLabels = {
                    pending: '⏳ Pending',
                    countered: '↔ Countered',
                    deal_locked: '🔒 Deal Locked',
                    rejected: '✗ Rejected',
                    accepted: '✓ Accepted',
                  };
                  
                  const isOutgoing = offer.buyerId?._id === user?._id;
                  const personName = isOutgoing ? offer.sellerId?.name : offer.buyerId?.name;
                  const personInitial = personName ? personName.charAt(0) : (isOutgoing ? 'S' : 'B');
                  const roleLabel = isOutgoing ? 'Seller' : 'Buyer';

                  return (
                    <motion.button
                      key={offer._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => navigate(`/bazaar/${offer.adId?._id}/offer?offerId=${offer._id}`)}
                      className="w-full flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md hover:border-orange-300 transition-all text-left relative overflow-hidden"
                    >
                      {/* Indicator for outgoing/incoming */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isOutgoing ? 'bg-orange-400' : 'bg-blue-400'}`}></div>
                      
                      {/* Ad image */}
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-600 ml-1">
                        {offer.adId?.images?.[0] ? (
                          <img src={offer.adId.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-slate-300 m-3.5" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isOutgoing ? 'bg-orange-100' : 'bg-blue-100'}`}>
                            <span className={`text-[8px] font-black ${isOutgoing ? 'text-orange-600' : 'text-blue-600'}`}>{personInitial}</span>
                          </div>
                          <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">
                            {personName || roleLabel}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500 font-semibold truncate ml-5">
                          {offer.adId?.title || 'Product'}
                        </p>
                      </div>

                      {/* Right side */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className="text-sm font-black text-orange-500">₹{offer.currentOfferAmount?.toLocaleString('en-IN') || '—'}</p>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${statusColors[offer.status] || 'bg-slate-100 text-slate-500'}`}>
                          {statusLabels[offer.status] || offer.status}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
            </>
          )}
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: "Bookings", value: completed.toString(), icon: Clock, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/20" },
            { label: "Favorites", value: (user?.favorites?.length || 0).toString(), icon: Heart, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-500/20" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center gap-2 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-500/30">
              <div className={`p-2.5 rounded-[16px] ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="text-center">
                <span className="block text-2xl font-black text-slate-900 dark:text-white leading-none">{stat.value}</span>
                <span className="mt-1.5 block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Menu Items */}
        <div className="space-y-3 mb-6">
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button key={item.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.98 }}
                onClick={() => item.path && navigate(item.path)} 
                className="group flex w-full items-center gap-4 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-all hover:shadow-md hover:border-blue-500/30">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:border-blue-200 dark:group-hover:border-blue-500/30 transition-all">
                  <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white">{item.label}</p>
                  <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-all">
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Logout Button */}
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 py-4 text-[15px] font-extrabold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/20 shadow-sm">
          <LogOut className="h-5 w-5" /> Sign Out
        </motion.button>

        {/* Delete Account Button */}
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowDeleteConfirm(true)} disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 py-4 text-[15px] font-extrabold text-red-600 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/20 shadow-sm mt-3">
          <Trash2 className="h-5 w-5" /> Delete Account
        </motion.button>
      </main>
      <BottomNav />

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEdit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-[32px] sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" /> Edit Profile
                </h3>
                <button onClick={() => setShowEdit(false)} className="rounded-full p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
                <div className="flex justify-center">
                  <div className="relative group">
                    <div className="h-28 w-28 overflow-hidden rounded-[28px] border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-xl">
                      {isSaving ? (
                        <div className="h-full w-full flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : editForm.avatar && !editForm.avatar.startsWith('blob:') ? (
                        <img src={editForm.avatar} className="h-full w-full object-cover" alt="Avatar" />
                      ) : (
                        <User className="h-full w-full p-6 text-slate-400" />
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 cursor-pointer rounded-full bg-blue-600 p-3 text-white shadow-lg border-4 border-white dark:border-slate-900 hover:bg-blue-700 transition-colors">
                      <Edit3 className="h-4 w-4" />
                      <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 ml-1">Full Name</label>
                    <input type="text" value={editForm.name} onChange={e => { const val = sanitizeNameOnChange(e.target.value); setEditForm(f => ({ ...f, name: val })); }}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3.5 text-[15px] font-semibold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 ml-1">Mobile Number</label>
                    <input type="tel" value={editForm.phone} onChange={e => {
                      const sanitized = sanitizePhone(e.target.value);
                      setEditForm(f => ({ ...f, phone: sanitized }));
                    }}
                      maxLength="10"
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3.5 text-[15px] font-semibold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 ml-1">Email Address</label>
                    <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: sanitizeEmail(e.target.value) }))}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3.5 text-[15px] font-semibold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                </div>

                <div className="pt-2">
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
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-[16px] border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all outline-none"
                  >
                    <MapPin className="h-4 w-4" /> Update Service Location
                  </button>
                </div>

                <motion.button whileTap={{ scale: 0.97 }} type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 py-4 text-[15px] font-black text-white shadow-xl shadow-blue-600/20 transition-all">
                  <Save className="h-5 w-5" /> Save Changes
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="h-8 w-8 text-red-600 dark:text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Delete Account?</h3>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mb-6">
                Are you sure you want to delete your account? This action cannot be undone and you will lose all your data permanently.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} disabled={isSaving}
                  className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDeleteAccount} disabled={isSaving}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center">
                  {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
