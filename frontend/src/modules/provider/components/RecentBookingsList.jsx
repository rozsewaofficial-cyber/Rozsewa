import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock, MapPin, AlertTriangle, Loader2, Navigation, ImagePlus, Plus, Map as MapIcon, ExternalLink } from "lucide-react";
import LiveTrackingView from "./LiveTrackingView";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const RecentBookingsList = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [staffList, setStaffList] = useState([]);
  const [activeTracking, setActiveTracking] = useState(null);
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState(false);
  const handleImageUpload = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append("image", file);
    setIsUploading(true);
    try {
      const { data } = await API.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      return data.url;
    } catch (err) {
      toast({ title: "Upload Failed", variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const { data } = await API.get("/bookings/provider");
      // Map backend status to frontend expectations if needed
      const mapped = data.map(b => ({
        ...b,
        status: b.status === "confirmed" ? "active" : b.status
      }));
      setRequests(mapped);
      setStaffList(JSON.parse(localStorage.getItem("rozsewa_provider_staff") || "[]"));
    } catch (err) {
      toast({ title: "Failed to fetch bookings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleAction = async (id, action, extraData = {}) => {
    let newStatus = 'pending';
    if (action === 'accept') newStatus = 'confirmed';
    if (action === 'reject') newStatus = 'cancelled';
    if (action === 'complete') newStatus = 'completed';
    if (action === 'on_the_way') newStatus = 'on_the_way';

    try {
      await API.patch(`/bookings/${id}/status`, { status: newStatus, ...extraData });
      toast({ title: `Booking ${action === 'complete' ? 'Completed' : action + 'ed'}` });
      fetchBookings();
    } catch (err) {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const assignStaff = (bookingId, staffId) => {
    // Staff assignment still uses local storage for now until we have Staff API
    toast({ title: "Note", description: "Staff assignment is currently saved locally." });
  };

  const filteredRequests = requests.filter(req => {
    if (activeTab === "active") {
      return ["confirmed", "active", "on_the_way", "started"].includes(req.status);
    }
    return req.status === activeTab;
  });
  const counts = {
    pending: requests.filter(r => r.status === "pending").length,
    active: requests.filter(r => (r.status === "active" || r.status === "confirmed" || r.status === "on_the_way" || r.status === "started")).length,
    cancelled: requests.filter(r => r.status === "cancelled").length,
    completed: requests.filter(r => r.status === "completed").length,
  };

  const [otpBooking, setOtpBooking] = useState(null);
  const [providerOtp, setProviderOtp] = useState(["", "", "", ""]);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [beforeWorkPhoto, setBeforeWorkPhoto] = useState(null);
  const [afterWorkPhoto, setAfterWorkPhoto] = useState(null);

  const [showExtraModal, setShowExtraModal] = useState(false);
  const [newExtraCharges, setNewExtraCharges] = useState([]);
  const [activeBookingForExtra, setActiveBookingForExtra] = useState(null);

  const handleOtpVerify = async () => {
    const fullOtp = providerOtp.join("");
    if (fullOtp.length !== 4) return;
    setIsVerifyingOtp(true);
    try {
      await API.post(`/bookings/${otpBooking}/start`, {
        otp: fullOtp,
        beforeImage: beforeWorkPhoto
      });
      toast({ title: "Service Started Successfully" });
      setOtpBooking(null);
      setProviderOtp(["", "", "", ""]);
      setBeforeWorkPhoto(null);
      fetchBookings();
    } catch (err) {
      toast({ title: "Invalid OTP", description: "Please enter the correct start code.", variant: "destructive" });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const submitExtraCharges = async () => {
    try {
      const filtered = newExtraCharges.filter(c => c.item && c.amount > 0);
      if (filtered.length === 0) return;

      await API.patch(`/bookings/${activeBookingForExtra}/status`, {
        extraCharges: filtered,
        extraStatus: 'pending'
      });

      toast({ title: "Charges Sent for Approval!" });
      setShowExtraModal(false);
      fetchBookings();
    } catch (err) {
      toast({ title: "Failed to add charges", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex p-1 bg-muted rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
        {[
          { id: "pending", label: "New", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400" },
          { id: "active", label: "Active", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
          { id: "completed", label: "Completed", color: "text-emerald-700 bg-emerald-100 dark:bg-emerald-800/30 dark:text-emerald-300" },
          { id: "cancelled", label: "Rejected", color: "text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400" }
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
            {tab.label}
            {counts[tab.id] > 0 && <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${activeTab === tab.id ? tab.color : "bg-muted-foreground/20"}`}>{counts[tab.id]}</span>}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filteredRequests.length === 0 ? (
          <motion.div key={`empty-${activeTab}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-3xl">
            <div className="rounded-full bg-muted p-6 mb-4"><Clock className="h-10 w-10 text-muted-foreground opacity-40" /></div>
            <h3 className="text-lg font-bold text-foreground">No {activeTab} bookings</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">Active requests will appear here.</p>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRequests.map(req => (
              <motion.div key={req._id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className={`relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md border-border`}>

                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black tracking-wider text-muted-foreground uppercase">{req._id.slice(-6)}</span>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${req.status === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                    req.status === 'on_the_way' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                      req.status === 'started' ? 'bg-primary text-primary-foreground' :
                        req.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                          req.status === 'completed' ? 'bg-emerald-500 text-white' :
                            'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                    }`}>
                    {req.status === 'pending' ? 'NEW' : req.status.replace("_", " ").toUpperCase()}
                  </div>
                </div>

                <h3 className="text-lg font-black text-foreground truncate">{req.serviceName}</h3>
                <p className="text-sm font-bold text-muted-foreground">{req.userId?.name || "Customer"}</p>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{req.totalAmount || 0}</div>
                  <div className="flex items-center gap-2">
                    {req.location?.coordinates && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const [lng, lat] = req.location.coordinates;
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
                        }}
                        className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        title="Navigate to Customer"
                      >
                        <Navigation className="h-4 w-4" />
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg max-w-[120px]">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{req.address}</span>
                    </div>
                  </div>
                </div>

                {req.status === "pending" && (
                  <div className="mt-5 flex gap-3">
                    <button onClick={() => handleAction(req._id, 'reject')} className="flex-1 rounded-xl border-2 border-rose-500/10 py-2.5 text-xs font-bold text-rose-600">Reject</button>
                    <button onClick={() => handleAction(req._id, 'accept')} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg">Accept</button>
                  </div>
                )}

                {(req.status === "confirmed" || req.status === "active") && (
                  <button onClick={() => handleAction(req._id, 'on_the_way')} className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-lg">Start Journey (On the Way)</button>
                )}

                {req.status === "on_the_way" && (
                  <div className="mt-5 space-y-3">
                    <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40">
                      <p className="text-[10px] font-bold text-amber-600 uppercase">Tell User this OTP to Start</p>
                      <p className="text-2xl font-black text-amber-700 dark:text-amber-400 tracking-[0.5em]">{req.startOTP || "----"}</p>
                    </div>
                    <button
                      onClick={() => setActiveTracking(req.location.coordinates)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all uppercase tracking-widest"
                    >
                      <MapIcon className="h-4 w-4" /> Open In-App Live Tracking
                    </button>
                    <p className="text-[10px] text-center text-muted-foreground animate-pulse">Waiting for User to enter code...</p>
                  </div>
                )}

                {req.status === "started" && (
                  <div className="mt-5 space-y-4">
                    {/* Extra Charges Section */}
                    {(!req.extraStatus || req.extraStatus === 'none') && (
                      <button
                        onClick={() => {
                          setActiveBookingForExtra(req._id);
                          setShowExtraModal(true);
                          setNewExtraCharges([{ item: '', amount: '' }]);
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary bg-primary/5 py-2 text-[10px] font-black uppercase text-primary tracking-widest hover:bg-primary/10 transition-all"
                      >
                        <Plus className="h-3 w-3" /> Add Extra Charges (Spare Parts)
                      </button>
                    )}

                    {req.extraStatus === 'pending' && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                        <p className="text-[10px] font-bold text-amber-600 uppercase">Extra Charges Pending Approval</p>
                      </div>
                    )}

                    {/* Upload After Photo */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">After Work Photo (Evidence)</p>
                      <div className="flex flex-col items-center">
                        <label className={`w-full h-24 rounded-xl border-2 border-dashed border-border bg-muted/50 hover:bg-muted transition-all cursor-pointer flex flex-col items-center justify-center gap-2 overflow-hidden relative ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                          {afterWorkPhoto ? (
                            <>
                              <img src={afterWorkPhoto} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <p className="text-[10px] font-bold text-white uppercase tracking-tighter">Change</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <ImagePlus className="h-5 w-5 text-muted-foreground" />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">{isUploading ? 'Uploading...' : 'Upload Completion Photo'}</span>
                            </>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const url = await handleImageUpload(e.target.files[0]);
                            if (url) setAfterWorkPhoto(url);
                          }} />
                        </label>
                      </div>
                    </div>

                    {!req.endOTP ? (
                      <button
                        onClick={() => {
                          handleAction(req._id, 'complete', { afterImage: afterWorkPhoto });
                          setAfterWorkPhoto(null);
                        }}
                        disabled={!afterWorkPhoto || isUploading}
                        className={`w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-lg transition-all ${!afterWorkPhoto ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                      >
                        {!afterWorkPhoto ? "Upload Photo to Complete" : "Mark as Completed"}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/40">
                          <p className="text-[10px] font-bold text-blue-600 uppercase">Tell User this Completion OTP</p>
                          <p className="text-2xl font-black text-blue-700 dark:text-blue-400 tracking-[0.5em]">{req.endOTP}</p>
                        </div>
                        <p className="text-[10px] text-center text-muted-foreground animate-pulse font-bold tracking-tight uppercase">Waiting for User Verify...</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* OTP MODAL */}
      <AnimatePresence>
        {otpBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-[32px] bg-card p-8 border border-border shadow-2xl">
              <h3 className="text-lg font-black text-center mb-2">Service Verification</h3>
              <p className="text-xs text-muted-foreground text-center mb-6">Enter the 4-digit code sent to you to start the service.</p>

              <div className="flex justify-center gap-3 mb-8">
                {providerOtp.map((d, i) => (
                  <input key={i} maxLength={1} value={d}
                    onChange={(e) => {
                      const newOtp = [...providerOtp];
                      newOtp[i] = e.target.value.slice(-1);
                      setProviderOtp(newOtp);
                      if (e.target.value && i < 3) document.getElementById(`potp-${i + 1}`)?.focus();
                    }}
                    id={`potp-${i}`}
                    className="h-14 w-12 rounded-xl border-2 border-border bg-muted text-center text-2xl font-black text-foreground focus:border-primary focus:outline-none" />
                ))}
              </div>

              {/* Upload Before Photo */}
              <div className="mb-8 space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground text-center tracking-widest">Before Work Photo (Recommended)</p>
                <div className="flex flex-col items-center">
                  <label className={`w-full h-32 rounded-2xl border-2 border-dashed border-border bg-muted/50 hover:bg-muted transition-all cursor-pointer flex flex-col items-center justify-center gap-2 overflow-hidden relative ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {beforeWorkPhoto ? (
                      <>
                        <img src={beforeWorkPhoto} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <p className="text-[10px] font-bold text-white uppercase tracking-tighter">Click to Change</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{isUploading ? 'Uploading...' : 'Tap to Upload Photo'}</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const url = await handleImageUpload(e.target.files[0]);
                      if (url) setBeforeWorkPhoto(url);
                    }} />
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setOtpBooking(null)} className="flex-1 py-3 text-xs font-bold text-muted-foreground">Cancel</button>
                <button onClick={handleOtpVerify} disabled={isVerifyingOtp} className="flex-1 py-3 rounded-xl bg-primary text-xs font-black text-white disabled:opacity-50">
                  {isVerifyingOtp ? "Verifying..." : "Verify & Start"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXTRA CHARGES MODAL */}
      <AnimatePresence>
        {showExtraModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-[32px] bg-card p-6 border border-border shadow-2xl my-auto">
              <h3 className="text-lg font-black text-center mb-1">Add Extra Charges</h3>
              <p className="text-[10px] text-muted-foreground text-center mb-5 font-bold uppercase tracking-widest">Customer will approve before payment</p>

              <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {newExtraCharges.map((charge, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      placeholder="Part Name"
                      value={charge.item}
                      onChange={(e) => {
                        const updated = [...newExtraCharges];
                        updated[idx].item = e.target.value;
                        setNewExtraCharges(updated);
                      }}
                      className="flex-1 h-11 rounded-xl bg-muted border-none px-4 text-xs font-bold"
                    />
                    <input
                      placeholder="Amount"
                      type="number"
                      value={charge.amount}
                      onChange={(e) => {
                        const updated = [...newExtraCharges];
                        updated[idx].amount = Number(e.target.value);
                        setNewExtraCharges(updated);
                      }}
                      className="w-20 h-11 rounded-xl bg-muted border-none px-3 text-xs font-bold"
                    />
                    <button onClick={() => setNewExtraCharges(prev => prev.filter((_, i) => i !== idx))} className="h-8 w-8 flex items-center justify-center text-rose-500 bg-rose-50 rounded-lg">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setNewExtraCharges([...newExtraCharges, { item: '', amount: '' }])} className="w-full h-11 border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-all">
                  <Plus className="h-4 w-4" /> Add Another Item
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowExtraModal(false)} className="flex-1 py-3 text-xs font-bold text-muted-foreground">Cancel</button>
                <button onClick={submitExtraCharges} className="flex-1 py-3 rounded-xl bg-primary text-xs font-black text-white shadow-lg shadow-primary/20">
                  Send for Approval
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* LIVE TRACKING MODAL */}
      {activeTracking && (
        <LiveTrackingView
          destination={activeTracking}
          onClose={() => setActiveTracking(null)}
        />
      )}
    </div>
  );
};

export default RecentBookingsList;
