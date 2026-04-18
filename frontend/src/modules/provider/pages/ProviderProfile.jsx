import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { User, Store, MapPin, Phone, ShieldCheck, Camera, LogOut, Sparkles, Loader2, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProviderProfile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    ownerName: "",
    shopName: "",
    category: "",
    mobile: "",
    address: "",
    profileImage: null,
    location: null
  });

  useEffect(() => {
    if (user) {
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
        bankDetails: user.bankDetails || { accountNumber: "", ifscCode: "", bankName: "", accountHolderName: "" }
      });
    }
  }, [user]);

  const fileInputRef = useRef(null);

  const toggleEdit = async () => {
    if (isEditing) {
      try {
        const isShopNameChanged = profileData.shopName !== user.shopName;
        if (isShopNameChanged && !window.confirm("Changing shop name will reset your verification status to PENDING. Admin will need to re-verify your business. Continue?")) {
          return;
        }
        await API.put("/provider/profile", profileData);
        toast({ title: "Profile Updated", description: "Your business details have been saved." });
        if (isShopNameChanged) {
          window.location.reload();
        }
      } catch (err) {
        toast({ title: "Update Failed", variant: "destructive" });
      }
    }
    setIsEditing(!isEditing);
  };

  const handleLogout = () => {
    logout();
    navigate("/provider/login");
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploading(true);
      const formData = new FormData();
      formData.append("image", file);
      try {
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

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-6">
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
              { icon: Clock, label: "Opening Time", field: "openingTime", type: "text" },
              { icon: Clock, label: "Closing Time", field: "closingTime", type: "text" }
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-4 border-b border-border/50 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><item.icon className="h-5 w-5 text-muted-foreground" /></div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  {isEditing && !item.disabled ? (
                    <div className="space-y-1">
                      {item.type === "textarea"
                        ? <textarea rows={2} className="w-full mt-1 rounded border border-emerald-500 p-2 text-sm bg-background" value={profileData[item.field]} onChange={(e) => setProfileData({ ...profileData, [item.field]: e.target.value })} />
                        : <input type={item.type} className="w-full mt-1 rounded border border-emerald-500 p-2 text-sm bg-background" value={profileData[item.field]} onChange={(e) => setProfileData({ ...profileData, [item.field]: e.target.value })} />
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
                  <input placeholder="Account Number" className="rounded-xl border border-border p-3 text-sm bg-background" value={profileData.bankDetails.accountNumber} onChange={(e) => setProfileData({ ...profileData, bankDetails: { ...profileData.bankDetails, accountNumber: e.target.value } })} />
                  <input placeholder="IFSC Code" className="rounded-xl border border-border p-3 text-sm bg-background" value={profileData.bankDetails.ifscCode} onChange={(e) => setProfileData({ ...profileData, bankDetails: { ...profileData.bankDetails, ifscCode: e.target.value } })} />
                  <input placeholder="Bank Name" className="rounded-xl border border-border p-3 text-sm bg-background" value={profileData.bankDetails.bankName} onChange={(e) => setProfileData({ ...profileData, bankDetails: { ...profileData.bankDetails, bankName: e.target.value } })} />
                  <input placeholder="Holder Name" className="rounded-xl border border-border p-3 text-sm bg-background" value={profileData.bankDetails.accountHolderName} onChange={(e) => setProfileData({ ...profileData, bankDetails: { ...profileData.bankDetails, accountHolderName: e.target.value } })} />
                </div>
              </div>
            )}
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(async (pos) => {
                      const { latitude, longitude } = pos.coords;
                      setProfileData(prev => ({ ...prev, location: { type: 'Point', coordinates: [longitude, latitude] } }));
                      toast({ title: "Shop Coordinates Captured", description: "Save profile to update location." });
                    });
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 py-3 text-xs font-black text-emerald-600 uppercase tracking-widest hover:bg-emerald-500/10 transition-all"
              >
                <MapPin className="h-4 w-4" /> Update Shop Location
              </button>
            )}
          </div>
        </section>

        {/* Referral & Commission Section */}
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

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h3 className="font-black uppercase text-[11px] tracking-widest text-emerald-800">{user?.planType || 'Pro'} Plan - Active</h3>
              <p className="text-[10px] font-bold text-emerald-600/80 mt-1 uppercase tracking-widest">
                Valid till {user?.planExpiry ? new Date(user.planExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '24 Dec 2026'}
              </p>
            </div>
            <button className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition">Upgrade</button>
          </div>
        </section>
        <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 py-4 font-bold text-destructive hover:bg-destructive hover:text-white transition-all"><LogOut className="h-5 w-5" /> Sign Out</button>
      </main>
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderProfile;
