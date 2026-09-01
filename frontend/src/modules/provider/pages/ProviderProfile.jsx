import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import WelfareFundCard from "@/modules/provider/components/WelfareFundCard";
import { motion, AnimatePresence } from "framer-motion";
import { User, Store, MapPin, Phone, ShieldCheck, Camera, LogOut, Sparkles, Loader2, Navigation, Trash2, Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import API from "@/lib/api";
import { validateName, sanitizeName, sanitizeNameOnChange } from "@/lib/nameValidation";

const ProviderProfile = () => {
  const navigate = useNavigate();
  const { user, logout, syncFCMToken } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const draft = JSON.parse(sessionStorage.getItem("provider-profile-draft") || "{}");
  const [isEditing, setIsEditing] = useState(draft.isEditing || false);
  const [profileData, setProfileData] = useState(draft.profileData || {
    ownerName: "",
    shopName: "",
    category: "",
    mobile: "",
    address: "",
    profileImage: null,
    location: null,
    surakshaNidhiOptIn: false
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);

  // Service radius state
  const [serviceRadius, setServiceRadius] = useState(15);
  const [radiusLimits, setRadiusLimits] = useState({ minimumRadius: 1, maximumRadius: 50 });
  const [radiusSaving, setRadiusSaving] = useState(false);

  useEffect(() => {
    if (user && !draft.isEditing) {
      setProfileData({
        ownerName: user.ownerName || "",
        shopName: user.shopName || "",
        category: user.vendorType || "",
        mobile: user.mobile || "",
        address: user.address || "",
        profileImage: user.profileImage || null,
        location: user.location || null,
        openingTime: user.openingTime || "09:00 AM",
        closingTime: user.closingTime || "09:00 PM",
        bankDetails: user.bankDetails || { accountNumber: "", ifscCode: "", bankName: "", accountHolderName: "" },
        surakshaNidhiOptIn: user.surakshaNidhiOptIn || false
      });
      if (typeof user.serviceRadius === 'number') {
        setServiceRadius(user.serviceRadius);
      }
    }
    // Fetch admin-configured limits (always, independent of user)
    fetchRadiusLimits();
  }, [user]);

  const fetchRadiusLimits = async () => {
    try {
      const { data } = await API.get("/provider/service-radius-limits");
      setRadiusLimits({ minimumRadius: data.minimumRadius || 1, maximumRadius: data.maximumRadius || 50 });
    } catch {
      // silently fall back to defaults
    }
  };

  const handleSaveRadius = async () => {
    setRadiusSaving(true);
    try {
      await API.put("/provider/profile", { serviceRadius });
      toast({ title: "Service Area Updated", description: `Your service radius is now ${serviceRadius} km.` });
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update service radius.";
      toast({ title: "Update Failed", description: msg, variant: "destructive" });
    } finally {
      setRadiusSaving(false);
    }
  };



  useEffect(() => {
    sessionStorage.setItem("provider-profile-draft", JSON.stringify({ isEditing, profileData }));
  }, [isEditing, profileData]);

  const clearDraft = () => sessionStorage.removeItem("provider-profile-draft");

  const fileInputRef = useRef(null);

  const toggleEdit = async () => {
    if (isEditing) {
      const sanitizedOwnerName = sanitizeName(profileData.ownerName);
      const ownerNameValidation = validateName(sanitizedOwnerName);
      if (!ownerNameValidation.isValid) {
        toast({ title: "Invalid Name", description: `Owner Name: ${ownerNameValidation.message}`, variant: "destructive" });
        return;
      }

      let sanitizedHolderName = "";
      if (profileData.bankDetails && profileData.bankDetails.accountHolderName) {
        sanitizedHolderName = sanitizeName(profileData.bankDetails.accountHolderName);
        const holderNameValidation = validateName(sanitizedHolderName);
        if (!holderNameValidation.isValid) {
          toast({ title: "Invalid Name", description: `Account Holder Name: ${holderNameValidation.message}`, variant: "destructive" });
          return;
        }
      }

      if (profileData.bankDetails) {
        if (profileData.bankDetails.accountNumber && !/^\d{9,18}$/.test(profileData.bankDetails.accountNumber)) {
          toast({ title: "Invalid Account Number", description: "Account number must be 9–18 digits.", variant: "destructive" });
          return;
        }
        if (profileData.bankDetails.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(profileData.bankDetails.ifscCode)) {
          toast({ title: "Invalid IFSC Code", description: "Format must be 4 letters + 0 + 6 alphanumeric (e.g. HDFC0001234).", variant: "destructive" });
          return;
        }
      }

      const updatedProfile = {
        ...profileData,
        ownerName: sanitizedOwnerName,
        bankDetails: profileData.bankDetails
          ? { ...profileData.bankDetails, accountHolderName: sanitizedHolderName }
          : undefined
      };

      try {
        const isShopNameChanged = updatedProfile.shopName !== user.shopName;
        if (isShopNameChanged) {
          const ok = await confirm(
            "Changing your shop name will reset your verification status to PENDING. Admin will need to re-verify your business.",
            { title: "Change Shop Name?", confirmLabel: "Yes, Change It", cancelLabel: "Keep Current" }
          );
          if (!ok) return;
        }
        await API.put("/provider/profile", updatedProfile);
        setProfileData(updatedProfile);
        toast({ title: "Profile Updated", description: "Your business details have been saved." });
        clearDraft();
        if (isShopNameChanged) {
          window.location.reload();
        }
      } catch (err) {
        toast({ title: "Update Failed", variant: "destructive" });
        return;
      }
    }
    setIsEditing(!isEditing);
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await Notification.requestPermission();
      }
      if ('Notification' in window && Notification.permission === 'denied') {
        toast({ title: "Notifications Blocked", description: "Please enable notifications for this site in your browser settings, then try again.", variant: "destructive" });
        return;
      }
      await syncFCMToken();
      await API.post("/notifications/fcm-tokens/test");
      toast({ title: "Test Notification Sent", description: "You should receive a push notification on this device shortly." });
    } catch (err) {
      toast({ title: "Test Failed", description: err.response?.data?.message || "Could not send test notification.", variant: "destructive" });
    } finally {
      setTestingNotification(false);
    }
  };

  const handleLogout = async () => {
    const ok = await confirm("Are you sure you want to sign out securely?", { title: "Sign Out", confirmLabel: "Sign Out", destructive: true });
    if (!ok) return;
    logout();
    navigate("/provider/login");
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await API.delete("/auth/profile");
      toast({ title: "Account Deleted", description: "Your provider account has been deleted successfully." });
      logout();
      navigate("/provider/login");
    } catch (err) {
      toast({ title: "Delete Failed", description: err.response?.data?.message || "Something went wrong", variant: "destructive" });
      setIsDeleting(false);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploading(true);
      try {
        // Compress before upload to avoid slow uploads from large camera photos
        const { compressImage } = await import('@/lib/imageCompression');
        const compressedFile = await compressImage(file, 800, 800, 0.7);

        const formData = new FormData();
        formData.append("image", compressedFile);
        const { data } = await API.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        setProfileData({ ...profileData, profileImage: data.url });
        await API.put("/provider/profile", { profileImage: data.url });
        toast({ title: "Image Uploaded", description: "Profile photo updated." });
      } catch (err) {
        toast({ title: "Upload Failed", variant: "destructive" });
      } finally {
        setUploading(false);
      }
    }
  };

  const [uploading, setUploading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  return (
    <div className={`min-h-screen bg-background ${isEditing ? 'pb-64' : 'pb-24'} md:pb-6`}>
      <ProviderTopNav />
      <main className="container max-w-3xl px-4 py-8 space-y-8">
        <div className="flex flex-col items-center justify-center space-y-4 rounded-3xl bg-emerald-600 p-8 text-center shadow-lg">
          <div className="relative">
            <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-emerald-100 text-3xl font-bold text-emerald-700 shadow-sm">
              {uploading ? <Loader2 className="h-8 w-8 animate-spin text-emerald-600" /> : (
                profileData.profileImage ? <img src={profileData.profileImage} alt="Profile" className="h-full w-full object-cover" /> : profileData.shopName?.split(' ').map(n => n[0]).join('').toUpperCase() || "RS"
              )}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 rounded-full bg-background p-2 text-emerald-600 shadow-md transition-transform hover:scale-110"><Camera className="h-4 w-4" /></button>
          </div>
          <div><h1 className="text-2xl font-black text-white">{profileData.shopName}</h1><p className="flex items-center justify-center gap-1 text-sm text-emerald-100 font-medium mt-1"><ShieldCheck className="h-4 w-4" /> Verified Provider</p></div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-foreground">Business Information</h2><button onClick={toggleEdit} className="text-sm font-semibold text-emerald-600 hover:text-emerald-500">{isEditing ? "Save Changes" : "Edit Profile"}</button></div>
          <div className="space-y-4">
            {[
              { icon: User, label: "Owner Name", field: "ownerName", type: "text" },
              { icon: Store, label: "Shop Name", field: "shopName", type: "text", warning: "Changing this resets verification!" },
              { icon: Phone, label: "Mobile Number", field: "mobile", type: "tel", disabled: true },
              { icon: MapPin, label: "Shop Address", field: "address", type: "textarea" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-4 border-b border-border/50 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><item.icon className="h-5 w-5 text-muted-foreground" /></div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  {isEditing && !item.disabled ? (
                    <div className="space-y-1">
                      {item.type === "textarea"
                        ? <textarea rows={2} className="w-full mt-1 rounded border border-emerald-500 p-2 text-sm bg-background" value={profileData[item.field]} onChange={(e) => { const val = e.target.value.replace(/[^a-zA-Z0-9\s,.\-/#]/g, ''); setProfileData({ ...profileData, [item.field]: val }); }} onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} />
                        : <input type={item.type} className="w-full mt-1 rounded border border-emerald-500 p-2 text-sm bg-background" value={profileData[item.field]} onChange={(e) => { const val = item.field === "ownerName" ? e.target.value.replace(/[^a-zA-Z\s]/g, '') : e.target.value; setProfileData({ ...profileData, [item.field]: val }); }} onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} />
                      }
                      {item.warning && <p className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">{item.warning}</p>}
                    </div>
                  ) : <p className="font-semibold text-foreground">{profileData[item.field] || 'Not Set'}</p>}
                </div>
              </div>
            ))}

            {isEditing && (
              <div className="space-y-4 mt-6 pt-4 border-t border-border text-left">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Bank Payout Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input placeholder="Account Number" className="rounded-xl border border-border p-3 text-sm bg-background" value={profileData.bankDetails.accountNumber} onChange={(e) => setProfileData({ ...profileData, bankDetails: { ...profileData.bankDetails, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) } })} />
                  <input placeholder="IFSC Code" className="rounded-xl border border-border p-3 text-sm bg-background" value={profileData.bankDetails.ifscCode} onChange={(e) => setProfileData({ ...profileData, bankDetails: { ...profileData.bankDetails, ifscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) } })} />
                  <input placeholder="Bank Name" className="rounded-xl border border-border p-3 text-sm bg-background" value={profileData.bankDetails.bankName} onChange={(e) => setProfileData({ ...profileData, bankDetails: { ...profileData.bankDetails, bankName: e.target.value.replace(/[^a-zA-Z\s]/g, '') } })} />
                  <input placeholder="Holder Name" className="rounded-xl border border-border p-3 text-sm bg-background" value={profileData.bankDetails.accountHolderName} onChange={(e) => setProfileData({ ...profileData, bankDetails: { ...profileData.bankDetails, accountHolderName: e.target.value.replace(/[^a-zA-Z\s]/g, '') } })} />
                </div>
              </div>
            )}
            {isEditing && (
              <button
                type="button"
                disabled={locationLoading}
                onClick={() => {
                  if (!("geolocation" in navigator)) {
                    toast({ title: "Not Supported", description: "Geolocation is not supported by your browser.", variant: "destructive" });
                    return;
                  }
                  setLocationLoading(true);
                  navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                      const { latitude, longitude } = pos.coords;
                      setProfileData(prev => ({ ...prev, location: { type: 'Point', coordinates: [longitude, latitude] } }));
                      toast({ title: "Shop Coordinates Captured", description: "Save profile to update location." });
                      setLocationLoading(false);
                    },
                    (err) => {
                      setLocationLoading(false);
                      const msg = err.code === 1
                        ? "Location permission denied. Please allow location access in your browser settings."
                        : err.code === 2
                        ? "Location unavailable. Please check your device GPS."
                        : "Location request timed out. Please try again.";
                      toast({ title: "Location Error", description: msg, variant: "destructive" });
                    },
                    { timeout: 10000, enableHighAccuracy: true }
                  );
                }}
                className={`w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-black uppercase tracking-widest transition-all ${
                  locationLoading
                    ? 'border-emerald-300 bg-emerald-500/10 text-emerald-400 cursor-not-allowed'
                    : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10'
                }`}
              >
                {locationLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Detecting Location...</>
                  : <><MapPin className="h-4 w-4" /> Update Shop Location</>}
              </button>
            )}
          </div>
        </section>

        {/* ── Service Area ─────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Navigation className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-black text-foreground">Service Area</h2>
                <p className="text-[10px] text-muted-foreground font-medium">
                  Allowed range: {radiusLimits.minimumRadius} km – {radiusLimits.maximumRadius} km
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1">
                <input
                  id="service-radius-number"
                  type="number"
                  min={radiusLimits.minimumRadius}
                  max={radiusLimits.maximumRadius}
                  value={serviceRadius}
                  onChange={(e) => {
                    const v = Math.max(radiusLimits.minimumRadius, Math.min(radiusLimits.maximumRadius, Number(e.target.value)));
                    setServiceRadius(v);
                  }}
                  className="w-12 bg-transparent text-center text-sm font-black text-emerald-700 outline-none"
                />
                <span className="text-xs font-black text-emerald-600">km</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <input
              id="service-radius-slider"
              type="range"
              min={radiusLimits.minimumRadius}
              max={radiusLimits.maximumRadius}
              step={1}
              value={serviceRadius}
              onChange={(e) => setServiceRadius(Number(e.target.value))}
              className="w-full h-2 rounded-full accent-emerald-600 cursor-pointer"
              style={{
                background: `linear-gradient(to right, #059669 0%, #059669 ${((serviceRadius - radiusLimits.minimumRadius) / (radiusLimits.maximumRadius - radiusLimits.minimumRadius)) * 100}%, #e5e7eb ${((serviceRadius - radiusLimits.minimumRadius) / (radiusLimits.maximumRadius - radiusLimits.minimumRadius)) * 100}%, #e5e7eb 100%)`
              }}
            />
            <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
              <span>{radiusLimits.minimumRadius} km</span>
              <span className="text-emerald-700 font-black">{serviceRadius} km selected</span>
              <span>{radiusLimits.maximumRadius} km</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            You will only receive booking requests from customers within <strong className="text-emerald-700">{serviceRadius} km</strong> of your shop location.
          </p>

          <button
            id="save-service-radius-btn"
            onClick={handleSaveRadius}
            disabled={radiusSaving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60"
          >
            {radiusSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            {radiusSaving ? "Saving…" : "Save Service Area"}
          </button>
        </section>

        {/* ── Referral & Rewards ───────────────────────────────────────── */}
        {user?.providerCategory !== 'sewak' && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Referral & Rewards</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Referral Code</span>
                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl font-black text-sm border border-emerald-100 uppercase tracking-wider select-all">
                  {user?.vendorCode || "N/A"}
                </div>
                <p className="text-[9px] font-bold text-muted-foreground mt-1">Share this to earn 3 free services</p>
              </div>
              <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Free Services</span>
                <div className="h-10 w-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-emerald-500/20">
                  {user?.freeServicesLeft || 0}
                </div>
                <p className="text-[9px] font-bold text-muted-foreground mt-1">Remaining without commission</p>
              </div>
              <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Your Pay Plan</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-600">{user?.commissionRate || 10}</span>
                  <span className="text-xs font-black text-emerald-600">%</span>
                </div>
                <p className="text-[9px] font-bold text-muted-foreground mt-1">After free services exhausted</p>
              </div>
            </div>
          </section>
        )}

        {/* ── Vendor Welfare ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Vendor Welfare</h2>
          </div>
          <WelfareFundCard />
        </section>

        {/* ── Notifications ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Bell className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Notifications</h2>
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-black text-foreground">Push Notifications</span>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 max-w-[220px]">Send a test push to this device to confirm alerts are working.</p>
            </div>
            <button
              onClick={handleTestNotification}
              disabled={testingNotification}
              className="shrink-0 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60"
            >
              {testingNotification ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              {testingNotification ? "Sending…" : "Send Test"}
            </button>
          </div>
        </section>

        {user?.providerCategory !== 'sewak' && (
          <section className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="font-black uppercase text-[11px] tracking-widest text-emerald-800">{user?.planType || 'Pro'} Plan - Active</h3>
                <p className="text-[10px] font-bold text-emerald-600/80 mt-1 uppercase tracking-widest">
                  Valid till {user?.planExpiry ? new Date(user.planExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '24 Dec 2026'}
                </p>
              </div>
              <button onClick={() => navigate("/provider/99card")} className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition">Upgrade</button>
            </div>
          </section>
        )}

        <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/20 bg-muted/50 py-4 font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"><LogOut className="h-5 w-5" /> Sign Out</button>
        <button onClick={() => setShowDeleteConfirm(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 py-4 font-bold text-destructive hover:bg-destructive hover:text-white transition-all"><Trash2 className="h-5 w-5" /> Delete Account</button>
      </main>
      <ProviderBottomNav />

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-[24px] bg-background border border-border shadow-2xl p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-xl font-black text-foreground mb-2">Delete Account?</h3>
              <p className="text-[13px] font-medium text-muted-foreground mb-6">
                Are you sure you want to delete your provider account? This action cannot be undone and you will lose all your data permanently.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}
                  className="flex-1 py-3.5 rounded-xl font-bold text-foreground bg-muted hover:bg-muted/80 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDeleteAccount} disabled={isDeleting}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white bg-destructive hover:bg-destructive/90 transition-colors flex items-center justify-center">
                  {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProviderProfile;
