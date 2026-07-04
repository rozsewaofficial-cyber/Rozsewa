import { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Settings2, Save, LogOut, ShieldCheck, Mail, IndianRupee, BellRing, Phone, ShieldX, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";
import { validateEmail, sanitizeEmail } from "@/lib/emailValidation";
import { validateName, sanitizeName, sanitizeNameOnChange } from "@/lib/nameValidation";

const AdminSettings = () => {
  const { setTitle } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [platformSettings, setPlatformSettings] = useState({
    commissionRate: 10,
    minBookingAmount: 199,
    emergencyEnabled: true,
    autoAssign: true,
    vendorCardEnabled: true,
    vendorCardPrice: 99,
    max_bargain_discount_limit: 20,
    lead_min_wallet_balance: 200,
    lead_unlock_price: 50,
    lead_free_unlock_limit: 3,
    lead_max_unlock_count: 1,
    lead_geofence_radius: 15,
    lead_expiry: 24,
    lead_dispute_enabled: true,
    lead_refund_enabled: true,
    lead_pay_per_lead_enabled: true
  });

  const [adminProfile, setAdminProfile] = useState({
    name: "System Admin",
    email: "admin@rozsewa.com",
    phone: ""
  });

  const [policySettings, setPolicySettings] = useState({
    terms: "",
    privacy: "",
    cancellation: ""
  });

  useEffect(() => {
    setTitle("Platform Settings");
    fetchSettings();
  }, [setTitle]);

  const fetchSettings = async () => {
    try {
      const { data } = await API.get("/admin/settings");
      setPlatformSettings({
        commissionRate: data.commissionRate || 10,
        minBookingAmount: data.minBookingAmount || 199,
        emergencyEnabled: data.emergencyEnabled !== undefined ? data.emergencyEnabled : true,
        autoAssign: data.autoAssign !== undefined ? data.autoAssign : true,
        vendorCardEnabled: data.vendorCardEnabled !== undefined ? data.vendorCardEnabled : true,
        vendorCardPrice: data.vendorCardPrice || 99,
        max_bargain_discount_limit: data.max_bargain_discount_limit !== undefined ? data.max_bargain_discount_limit : 20,
        lead_min_wallet_balance: data.lead_min_wallet_balance || 200,
        lead_unlock_price: data.lead_unlock_price || 50,
        lead_free_unlock_limit: data.lead_free_unlock_limit !== undefined ? Number(data.lead_free_unlock_limit) : 3,
        lead_max_unlock_count: data.lead_max_unlock_count || 1,
        lead_geofence_radius: data.lead_geofence_radius || 15,
        lead_expiry: data.lead_expiry || 24,
        lead_dispute_enabled: data.lead_dispute_enabled !== undefined ? (data.lead_dispute_enabled === 'true' || data.lead_dispute_enabled === true) : true,
        lead_refund_enabled: data.lead_refund_enabled !== undefined ? (data.lead_refund_enabled === 'true' || data.lead_refund_enabled === true) : true,
        lead_pay_per_lead_enabled: data.lead_pay_per_lead_enabled !== undefined ? (data.lead_pay_per_lead_enabled === 'true' || data.lead_pay_per_lead_enabled === true) : true,
      });
      setPolicySettings({
        terms: data.terms || "",
        privacy: data.privacy || "",
        cancellation: data.cancellation || ""
      });
      if (data.adminProfile) {
        setAdminProfile({
          name: data.adminProfile.name || "",
          email: data.adminProfile.email || "",
          phone: data.adminProfile.mobile || ""
        });
      }
    } catch (err) {
      toast({ title: "Sync Error", description: "Could not load cloud settings.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateKey = async (key, value, label) => {
    try {
      await API.post("/admin/settings", { key, value });
      toast({ title: "Updated", description: `${label} saved to cloud.` });
    } catch (err) {
      toast({ title: "Update Failed", description: "Network error.", variant: "destructive" });
    }
  };

  const saveSettingsGroup = async () => {
    const maxLimit = parseInt(platformSettings.max_bargain_discount_limit);
    if (isNaN(maxLimit) || maxLimit < 0 || maxLimit > 90) {
      toast({ title: "Validation Error", description: "Max bargain limit must be between 0% and 90%.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const updates = [
        API.post("/admin/settings", { key: "commissionRate", value: platformSettings.commissionRate }),
        API.post("/admin/settings", { key: "minBookingAmount", value: platformSettings.minBookingAmount }),
        API.post("/admin/settings", { key: "vendorCardPrice", value: platformSettings.vendorCardPrice }),
        API.post("/admin/settings", { key: "max_bargain_discount_limit", value: platformSettings.max_bargain_discount_limit }),
      ];
      await Promise.all(updates);
      toast({ title: "Settings Saved", description: "Global rules updated successfully." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save some settings.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const saveLeadSettingsGroup = async () => {
    setLoading(true);
    try {
      const updates = [
        API.post("/admin/settings", { key: "lead_min_wallet_balance", value: platformSettings.lead_min_wallet_balance }),
        API.post("/admin/settings", { key: "lead_unlock_price", value: platformSettings.lead_unlock_price }),
        API.post("/admin/settings", { key: "lead_free_unlock_limit", value: platformSettings.lead_free_unlock_limit }),
        API.post("/admin/settings", { key: "lead_max_unlock_count", value: platformSettings.lead_max_unlock_count }),
        API.post("/admin/settings", { key: "lead_geofence_radius", value: platformSettings.lead_geofence_radius }),
        API.post("/admin/settings", { key: "lead_expiry", value: platformSettings.lead_expiry }),
        API.post("/admin/settings", { key: "lead_dispute_enabled", value: platformSettings.lead_dispute_enabled }),
        API.post("/admin/settings", { key: "lead_refund_enabled", value: platformSettings.lead_refund_enabled }),
        API.post("/admin/settings", { key: "lead_pay_per_lead_enabled", value: platformSettings.lead_pay_per_lead_enabled }),
      ];
      await Promise.all(updates);
      toast({ title: "Lead Rules Saved", description: "Global lead controls updated successfully." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save lead settings.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicies = async () => {
    setLoading(true);
    try {
      await Promise.all([
        API.post("/admin/settings", { key: "terms", value: policySettings.terms }),
        API.post("/admin/settings", { key: "privacy", value: policySettings.privacy }),
        API.post("/admin/settings", { key: "cancellation", value: policySettings.cancellation }),
      ]);
      toast({ title: "Policies Updated", description: "Legal documents synchronized." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save policies.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const sanitizedName = sanitizeName(adminProfile.name);
    const nameValidation = validateName(sanitizedName);
    if (!nameValidation.isValid) {
      toast({ title: "Invalid Name", description: nameValidation.message, variant: "destructive" });
      return;
    }
    setAdminProfile(prev => ({ ...prev, name: sanitizedName }));

    if (adminProfile.email && !validateEmail(adminProfile.email)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await API.post("/admin/profile", {
        name: sanitizedName,
        email: adminProfile.email,
        mobile: adminProfile.phone
      });
      toast({ title: "Profile Updated", description: "Identity details saved successfully." });
    } catch (err) {
      toast({ title: "Update Failed", description: err.response?.data?.message || "Check your details.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast({ title: "Logged Out", description: "You have been securely signed out." });
    navigate("/admin/login");
  };


  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Fetching Configuration Vault...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 lg:space-y-8">
      <div className="border-b border-gray-100 pb-6 text-left">
        <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-emerald-600" /> Settings & Configuration
        </h2>
        <p className="mt-1 text-sm text-gray-500">Manage your administrative profile, policies and core platform behaviors.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 md:p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900 border-l-4 border-emerald-500 pl-3">Global Rules</h3>
              <button onClick={saveSettingsGroup} className="flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-700 transition-colors border border-emerald-200 shadow-sm">
                <Save className="h-4 w-4" /> Save Rules
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> Commission Rate (%)</label>
                <div className="relative">
                  <input type="number" value={platformSettings.commissionRate} onChange={e => setPlatformSettings({ ...platformSettings, commissionRate: e.target.value })} className="block w-full rounded-xl border border-border bg-muted/20 py-3 px-4 text-sm font-bold focus:border-emerald-500/20 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  <span className="absolute inset-y-0 right-4 flex items-center text-gray-500 font-bold">%</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400 font-medium tracking-tight">Platform's cut from each booking.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> Min. Order Amount</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-4 flex items-center text-gray-500 font-bold">₹</span>
                  <input type="number" value={platformSettings.minBookingAmount} onChange={e => setPlatformSettings({ ...platformSettings, minBookingAmount: e.target.value })} className="block w-full rounded-xl border border-border bg-muted/20 py-3 pl-8 pr-4 text-sm font-bold focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <p className="mt-1.5 text-xs text-gray-400 font-medium tracking-tight">Lowest possible cart checkout value.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Max Bargain Limit (%)</label>
                <div className="relative">
                  <input type="number" min="0" max="90" value={platformSettings.max_bargain_discount_limit} onChange={e => {
                    const val = Math.min(90, Math.max(0, parseInt(e.target.value) || 0));
                    setPlatformSettings({ ...platformSettings, max_bargain_discount_limit: val });
                  }} className="block w-full rounded-xl border border-border bg-muted/20 py-3 px-4 text-sm font-bold focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  <span className="absolute inset-y-0 right-4 flex items-center text-gray-500 font-bold">%</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-400 font-medium tracking-tight">Maximum allowed discount limit (0-90%).</p>
              </div>
            </div>

            <div className="mt-8 border-t border-gray-100 pt-6 space-y-5 text-left">
              <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4 border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2"><BellRing className="h-4 w-4 text-amber-500" /> Emergency Service Module</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Allow users to book 24x7 instant services.</p>
                </div>
                <button onClick={() => {
                  const newVal = !platformSettings.emergencyEnabled;
                  setPlatformSettings({ ...platformSettings, emergencyEnabled: newVal });
                  handleUpdateKey("emergencyEnabled", newVal, "Emergency Status");
                }} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${platformSettings.emergencyEnabled ? 'bg-emerald-600 shadow-emerald-200 shadow-md' : 'bg-gray-200'}`} role="switch">
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${platformSettings.emergencyEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4 border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Auto-assign Providers</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Automatically route bookings to closest available provider.</p>
                </div>
                <button onClick={() => {
                  const newVal = !platformSettings.autoAssign;
                  setPlatformSettings({ ...platformSettings, autoAssign: newVal });
                  handleUpdateKey("autoAssign", newVal, "Auto-Assign Rules");
                }} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${platformSettings.autoAssign ? 'bg-emerald-600 shadow-emerald-200 shadow-md' : 'bg-gray-200'}`} role="switch">
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${platformSettings.autoAssign ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">Vendor Verification Card</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Mandatory subscription card during provider onboarding.</p>
                </div>
                <div className="flex items-center gap-4">
                  {platformSettings.vendorCardEnabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-700">₹</span>
                      <input type="number" value={platformSettings.vendorCardPrice} onChange={(e) => setPlatformSettings({ ...platformSettings, vendorCardPrice: parseInt(e.target.value) || 0 })} className="w-16 rounded-lg border border-gray-200 py-1.5 px-2 text-sm text-center font-bold focus:border-emerald-500 focus:outline-none" />
                    </div>
                  )}
                  <button onClick={() => {
                    const newVal = !platformSettings.vendorCardEnabled;
                    setPlatformSettings({ ...platformSettings, vendorCardEnabled: newVal });
                    handleUpdateKey("vendorCardEnabled", newVal, "Subscription Card Status");
                  }} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${platformSettings.vendorCardEnabled ? 'bg-emerald-600 shadow-emerald-200 shadow-md' : 'bg-gray-200'}`} role="switch">
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${platformSettings.vendorCardEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 md:p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900 border-l-4 border-blue-500 pl-3 text-left">Lead Model settings</h3>
              <button onClick={saveLeadSettingsGroup} className="flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 px-4 py-2 text-xs font-bold text-blue-700 transition-colors border border-blue-200 shadow-sm">
                <Save className="h-4 w-4" /> Save Lead Rules
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Min. Wallet Balance (₹)</label>
                <input type="number" value={platformSettings.lead_min_wallet_balance} onChange={e => setPlatformSettings({ ...platformSettings, lead_min_wallet_balance: Number(e.target.value) })} className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Lead Unlock Price (₹)</label>
                <input type="number" value={platformSettings.lead_unlock_price} onChange={e => setPlatformSettings({ ...platformSettings, lead_unlock_price: Number(e.target.value) })} className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Free Unlocks Limit</label>
                <input type="number" value={platformSettings.lead_free_unlock_limit} onChange={e => setPlatformSettings({ ...platformSettings, lead_free_unlock_limit: Number(e.target.value) })} className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Max Unlock Limit</label>
                <input type="number" value={platformSettings.lead_max_unlock_count} onChange={e => setPlatformSettings({ ...platformSettings, lead_max_unlock_count: Number(e.target.value) })} className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Geofence Radius (KM)</label>
                <input type="number" value={platformSettings.lead_geofence_radius} onChange={e => setPlatformSettings({ ...platformSettings, lead_geofence_radius: Number(e.target.value) })} className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Lead Expiry (Hours)</label>
                <input type="number" value={platformSettings.lead_expiry} onChange={e => setPlatformSettings({ ...platformSettings, lead_expiry: Number(e.target.value) })} className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-blue-500" />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100 text-left">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Enable Lead Disputes</h4>
                  <p className="text-xs text-gray-500">Allow providers to file refund disputes for invalid leads.</p>
                </div>
                <button onClick={() => setPlatformSettings(prev => ({ ...prev, lead_dispute_enabled: !prev.lead_dispute_enabled }))} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${platformSettings.lead_dispute_enabled ? 'bg-blue-600' : 'bg-gray-200'}`} role="switch">
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ${platformSettings.lead_dispute_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Enable Dispute Refunds</h4>
                  <p className="text-xs text-gray-500">Enable automated credit or wallet balances refund upon dispute approval.</p>
                </div>
                <button onClick={() => setPlatformSettings(prev => ({ ...prev, lead_refund_enabled: !prev.lead_refund_enabled }))} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${platformSettings.lead_refund_enabled ? 'bg-blue-600' : 'bg-gray-200'}`} role="switch">
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ${platformSettings.lead_refund_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Pay Per Lead Fallback</h4>
                  <p className="text-xs text-gray-500">Allow direct payment checkout when wallet balance and subscription credits are low.</p>
                </div>
                <button onClick={() => setPlatformSettings(prev => ({ ...prev, lead_pay_per_lead_enabled: !prev.lead_pay_per_lead_enabled }))} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${platformSettings.lead_pay_per_lead_enabled ? 'bg-blue-600' : 'bg-gray-200'}`} role="switch">
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition duration-200 ${platformSettings.lead_pay_per_lead_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 md:p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-900 border-l-4 border-blue-500 pl-3 text-left">Legal Policies</h3>
              <button onClick={handleSavePolicies} className="flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 px-4 py-2 text-xs font-bold text-blue-700 transition-colors border border-blue-200 shadow-sm">
                <Save className="h-4 w-4" /> Save Policies
              </button>
            </div>

            <div className="space-y-6 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Terms of Service</label>
                <textarea
                  rows={4}
                  value={policySettings.terms}
                  onChange={e => setPolicySettings({ ...policySettings, terms: e.target.value })}
                  className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-medium focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Enter Terms of Service..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Privacy Policy</label>
                <textarea
                  rows={4}
                  value={policySettings.privacy}
                  onChange={e => setPolicySettings({ ...policySettings, privacy: e.target.value })}
                  className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-medium focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Enter Privacy Policy..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Cancellation & Refund Policy</label>
                <textarea
                  rows={4}
                  value={policySettings.cancellation}
                  onChange={e => setPolicySettings({ ...policySettings, cancellation: e.target.value })}
                  className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-medium focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Enter Cancellation Policy..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1 space-y-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col items-center">
            <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden mb-4 ring-2 ring-emerald-50">
              <span className="text-2xl font-black text-emerald-700">{adminProfile.name.charAt(0)}D</span>
            </div>
            <h3 className="text-lg font-extrabold text-gray-900">{adminProfile.name}</h3>
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 mt-1 text-[10px] font-black uppercase tracking-widest text-amber-800 border border-amber-200">Super Admin</span>

            <div className="w-full mt-8 space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Full Name</label>
                <input type="text" value={adminProfile.name} onChange={e => setAdminProfile({ ...adminProfile, name: sanitizeNameOnChange(e.target.value) })} className="block w-full rounded-xl border border-border bg-muted/20 py-2.5 px-3 text-sm font-semibold focus:border-emerald-500 focus:bg-white focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Mail className="h-3 w-3" /> Email</label>
                <input type="email" value={adminProfile.email} onChange={e => setAdminProfile({ ...adminProfile, email: sanitizeEmail(e.target.value) })} className="block w-full rounded-xl border border-border bg-muted/20 py-2.5 px-3 text-sm font-semibold focus:border-emerald-500 focus:bg-white focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Phone className="h-3 w-3" /> Phone</label>
                <input type="text" value={adminProfile.phone} onChange={e => setAdminProfile({ ...adminProfile, phone: e.target.value })} className="block w-full rounded-xl border border-border bg-muted/20 py-2.5 px-3 text-sm font-semibold focus:border-emerald-500 focus:bg-white focus:outline-none transition-all" />
              </div>
              <button onClick={handleSaveProfile} className="w-full rounded-xl bg-gray-900 text-white py-3 text-sm font-bold hover:bg-black transition-all shadow-lg active:scale-95 transition-all mt-2">
                Update Profile
              </button>
            </div>
          </div>

          <motion.button onClick={handleLogout} whileTap={{ scale: 0.98 }} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50 py-4 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 shadow-sm transition-all group">
            <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" /> Sign Out Securely
          </motion.button>
        </div>

      </div>
    </div>
  );
};

export default AdminSettings;
