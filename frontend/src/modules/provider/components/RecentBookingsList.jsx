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
      setRequests(data);
      
      // Fetch staff from API
      const { data: staffData } = await API.get("/provider/staff");
      setStaffList(staffData);
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
      toast({ 
          title: "Action failed", 
          description: err.response?.data?.message || err.message, 
          variant: "destructive" 
      });
    }
  };

  const assignStaff = async (bookingId, staffId) => {
    try {
      await API.patch(`/bookings/${bookingId}/status`, { staffId });
      toast({ title: "Staff Assigned", description: "Worker has been assigned to this booking." });
      fetchBookings();
    } catch (err) {
      toast({ title: "Failed to assign staff", variant: "destructive" });
    }
  };

  const filteredRequests = requests.filter(req => {
    if (activeTab === "pending") return req.status === "pending";
    if (activeTab === "active") return ['confirmed', 'on_the_way', 'started'].includes(req.status) || (req.status === 'completed' && req.paymentStatus !== 'paid');
    if (activeTab === "completed") return req.status === "completed" && req.paymentStatus === 'paid';
    if (activeTab === "cancelled") return req.status === "cancelled";
    return true;
  });
  const counts = {
    pending: requests.filter(r => r.status === "pending").length,
    active: requests.filter(r => (['confirmed', 'on_the_way', 'started'].includes(r.status) || (r.status === 'completed' && r.paymentStatus !== 'paid'))).length,
    cancelled: requests.filter(r => r.status === "cancelled").length,
    completed: requests.filter(r => r.status === "completed" && r.paymentStatus === 'paid').length,
  };

  const [otpBooking, setOtpBooking] = useState(null);
  const [otpType, setOtpType] = useState('start');
  const [providerOtp, setProviderOtp] = useState(["", "", "", ""]);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [beforeWorkPhoto, setBeforeWorkPhoto] = useState(null);
  const [afterWorkPhoto, setAfterWorkPhoto] = useState(null);

  const [showExtraModal, setShowExtraModal] = useState(false);
  const [newExtraCharges, setNewExtraCharges] = useState([{ item: '', amount: '' }]);
  const [activeBookingForExtra, setActiveBookingForExtra] = useState(null);

  const [reportBookingId, setReportBookingId] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  const handleOtpVerify = async () => {
    const fullOtp = providerOtp.join("");
    if (fullOtp.length !== 4) return;
    setIsVerifyingOtp(true);
    try {
      if (otpType === 'start') {
        await API.post(`/bookings/${otpBooking}/start`, {
          otp: fullOtp,
          beforeImage: beforeWorkPhoto
        });
        toast({ title: "Service Started Successfully" });
      } else {
        await API.post(`/bookings/${otpBooking}/complete`, {
          otp: fullOtp
        });
        toast({ title: "Service Completed Successfully" });
      }
      setOtpBooking(null);
      setProviderOtp(["", "", "", ""]);
      setBeforeWorkPhoto(null);
      setAfterWorkPhoto(null);
      fetchBookings();
    } catch (err) {
      toast({ title: "Invalid OTP", description: "Please enter the correct code.", variant: "destructive" });
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

  const submitReport = async () => {
    if (!reportReason.trim()) return toast({ title: "Please enter a reason", variant: "destructive" });
    setIsReporting(true);
    try {
      await API.patch(`/bookings/${reportBookingId}/status`, {
        adminRequest: { reason: reportReason }
      });
      toast({ title: "Report Sent", description: "Admin has been notified." });
      setReportBookingId(null);
      setReportReason("");
      fetchBookings();
    } catch (err) {
      toast({ title: "Failed to send report", variant: "destructive" });
    } finally {
      setIsReporting(false);
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
                
                <div className="flex items-center gap-1.5 mt-1.5 mb-1 text-xs font-bold text-muted-foreground bg-muted/30 w-fit px-2 py-1 rounded-lg">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>{req.bookingDate} • {req.bookingTime}</span>
                </div>

                <p className="text-sm font-bold text-muted-foreground mt-1">{req.userId?.name || "Customer"}</p>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{req.totalAmount || 0}</div>
                    {req.extraCharges && req.extraCharges.length > 0 && (
                      <div className="space-y-0.5">
                        {req.extraCharges.map((extra, idx) => (
                          <div key={idx} className="flex gap-2 text-[9px] font-black text-muted-foreground/60 uppercase tracking-tighter">
                            <span>+ {extra.item}:</span>
                            <span>₹{extra.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {req.location?.coordinates && req.location.coordinates.length >= 2 && req.location.coordinates[0] !== 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const [lng, lat] = req.location.coordinates;
                          if (lat !== undefined && lng !== undefined) {
                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
                          } else {
                            toast({ title: "Location not available", variant: "destructive" });
                          }
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

                {req.status === "pending" && (!req.proposedSchedule || req.proposedSchedule.status !== 'pending') && (
                  <div className="mt-5 flex gap-3">
                    <button onClick={() => handleAction(req._id, 'reject')} className="flex-1 rounded-xl border-2 border-rose-500/10 py-2.5 text-xs font-bold text-rose-600">Reject</button>
                    <button onClick={() => handleAction(req._id, 'accept')} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg">Accept</button>
                  </div>
                )}

                {req.status === "pending" && req.proposedSchedule && req.proposedSchedule.status === 'pending' && (
                  <div className="mt-5 rounded-xl border-2 border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2">Schedule Proposed</p>
                    <div className="flex justify-between items-center bg-background rounded-lg p-2 border border-border">
                        <div>
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Date</p>
                            <p className="font-bold text-xs">{req.proposedSchedule.date}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Time</p>
                            <p className="font-bold text-xs">{req.proposedSchedule.time}</p>
                        </div>
                    </div>
                    {req.proposedSchedule.message && (
                        <p className="mt-2 text-xs italic text-muted-foreground bg-background p-2 rounded-lg border border-border">
                            "{req.proposedSchedule.message}"
                        </p>
                    )}
                    <p className="mt-2 text-[10px] font-bold text-amber-600 text-center uppercase tracking-widest animate-pulse">Waiting for customer approval...</p>
                  </div>
                )}

                {(req.status === "confirmed" || req.status === "active") && (() => {
                  const [year, month, day] = req.bookingDate.split('-');
                  const timeParts = req.bookingTime.split(' ');
                  let [hours, minutes] = timeParts[0].split(':').map(Number);
                  if (timeParts[1]) {
                      const ampm = timeParts[1].toUpperCase();
                      if (ampm === 'PM' && hours < 12) hours += 12;
                      if (ampm === 'AM' && hours === 12) hours = 0;
                  }
                  const bookingDateTime = new Date(year, month - 1, day, hours, minutes);
                  const now = new Date();
                  
                  // Allow starting journey 30 minutes before the booking time
                  const isReady = (bookingDateTime - now) <= 30 * 60 * 1000;

                  return (
                    <button 
                      onClick={() => handleAction(req._id, 'on_the_way')} 
                      disabled={!isReady}
                      className={`mt-5 w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-lg transition-colors ${isReady ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed opacity-70'}`}
                    >
                      {isReady ? 'Start Journey (On the Way)' : 'Start Journey (Available 30 mins before)'}
                    </button>
                  );
                })()}

                {req.status === "on_the_way" && (
                  <div className="mt-5 space-y-3">
                    <button
                      onClick={() => { setOtpBooking(req._id); setOtpType('start'); }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black text-white shadow-xl hover:bg-primary/90 transition-all uppercase tracking-widest"
                    >
                      Verify OTP & Start Work
                    </button>
                    <button
                      onClick={() => {
                        if (req.location?.coordinates && req.location.coordinates.length >= 2 && req.location.coordinates[0] !== 0) {
                          setActiveTracking(req.location.coordinates);
                        } else {
                          toast({ title: "Location missing. Opening Google Maps with address.", variant: "warning" });
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(req.address)}`, "_blank");
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all uppercase tracking-widest"
                    >
                      <MapIcon className="h-4 w-4" /> Open In-App Live Tracking
                    </button>
                  </div>
                )}

                {req.status === "started" && (
                  <div className="mt-5 space-y-4">
                    {/* Before Work Photo Display/Upload */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Before Work Photo</p>
                      {req.beforeImage ? (
                        <div className="w-full h-24 rounded-xl overflow-hidden border border-border">
                          <img src={req.beforeImage} className="w-full h-full object-cover" alt="Before Work" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <label className={`w-full h-24 rounded-xl border-2 border-dashed border-border bg-muted/50 hover:bg-muted transition-all cursor-pointer flex flex-col items-center justify-center gap-2 overflow-hidden relative ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
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
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{isUploading ? 'Uploading...' : 'Tap to Upload Before Photo'}</span>
                              </>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const url = await handleImageUpload(e.target.files[0]);
                              if (url) {
                                setBeforeWorkPhoto(url);
                                await API.patch(`/bookings/${req._id}/status`, { beforeImage: url });
                                toast({ title: "Before photo updated!" });
                                fetchBookings();
                              }
                            }} />
                          </label>
                        </div>
                      )}
                    </div>

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
                        }}
                        disabled={!afterWorkPhoto || isUploading}
                        className={`w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-lg transition-all ${!afterWorkPhoto ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                      >
                        {!afterWorkPhoto ? "Upload Photo to Complete" : "Generate Completion OTP"}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setOtpBooking(req._id); setOtpType('complete'); }}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black text-white shadow-xl hover:bg-emerald-700 transition-all uppercase tracking-widest"
                      >
                        Verify Completion OTP
                      </button>
                    )}
                  </div>
                )}

                {/* Payment Collection UI (Visible after Completion if unpaid) */}
                {req.status === 'completed' && req.paymentStatus !== "paid" && (
                  <div className="mt-5 space-y-4 border-t border-border pt-4">
                    <div className="rounded-xl border border-border p-4 bg-emerald-50/50 dark:bg-emerald-900/10">
                      <h4 className="text-sm font-black text-foreground mb-3 uppercase tracking-wider text-center">Payment Collection</h4>
                      <div className="flex justify-between text-xs font-bold text-muted-foreground mb-2">
                        <span>Booking Amount</span>
                        <span>₹{req.totalAmount || 0}</span>
                      </div>
                      {req.extraCharges && req.extraCharges.length > 0 && (
                        <div className="flex justify-between text-xs font-bold text-muted-foreground mb-2">
                          <span>Extra Charges</span>
                          <span>₹{req.extraCharges.reduce((sum, c) => sum + (c.amount || 0), 0)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-emerald-700 dark:text-emerald-400 mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900">
                        <span>Total Bill</span>
                        <span>₹{(req.totalAmount || 0) + (req.extraCharges?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0)}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleAction(req._id, 'completed', { paymentStatus: 'paid' })}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all uppercase tracking-widest"
                    >
                      <Check className="h-4 w-4" /> Confirm Payment Collected
                    </button>
                    <p className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-tight">Click this after receiving cash or online transfer from customer.</p>
                    
                    {!req.adminRequest || req.adminRequest.status === 'none' ? (
                      <button
                        onClick={() => { setReportBookingId(req._id); setReportReason(""); }}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-50 border border-rose-200 py-2.5 text-xs font-black text-rose-600 hover:bg-rose-100 transition-all uppercase tracking-widest mt-2"
                      >
                        <AlertTriangle className="h-4 w-4" /> Report Issue to Admin
                      </button>
                    ) : (
                      <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                        <p className="text-[10px] font-bold text-amber-600 uppercase">Report Sent to Admin. Pending Action.</p>
                      </div>
                    )}
                  </div>
                )}

                {['started', 'completed'].includes(req.status) && req.paymentStatus === "paid" && (
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 p-2 text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                    <Check className="h-4 w-4" /> Payment Settled
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
              <h3 className="text-lg font-black text-center mb-2">{otpType === 'start' ? 'Service Verification' : 'Completion Verification'}</h3>
              <p className="text-xs text-muted-foreground text-center mb-6">Ask the customer for the 4-digit code to {otpType === 'start' ? 'start' : 'complete'} the service.</p>

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
              {otpType === 'start' && (
                <div className="mb-8 space-y-3">
                  <p className="text-[10px] font-black uppercase text-muted-foreground text-center tracking-widest">Before Work Photo (Mandatory)</p>
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
              )}

              <div className="flex gap-3">
                <button onClick={() => setOtpBooking(null)} className="flex-1 py-3 text-xs font-bold text-muted-foreground">Cancel</button>
                <button onClick={handleOtpVerify} disabled={isVerifyingOtp || (otpType === 'start' && !beforeWorkPhoto)} className={`flex-1 py-3 rounded-xl text-xs font-black text-white shadow-lg transition-all ${((otpType === 'start' && !beforeWorkPhoto) || isVerifyingOtp) ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}>
                  {(otpType === 'start' && !beforeWorkPhoto) ? "Upload Photo to Start" : (isVerifyingOtp ? "Verifying..." : "Verify & " + (otpType === 'start' ? 'Start' : 'Complete'))}
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

      {/* REPORT MODAL */}
      <AnimatePresence>
        {reportBookingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-[32px] bg-card p-8 border border-border shadow-2xl">
              <h3 className="text-lg font-black text-center mb-2 text-rose-600">Report Issue</h3>
              <p className="text-xs text-muted-foreground text-center mb-6">Describe the issue you are facing with this customer or booking.</p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Reason</label>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="e.g., Customer refused to pay, Fake booking..."
                    className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setReportBookingId(null)}
                  className="flex-1 rounded-xl bg-muted py-3 text-xs font-bold text-muted-foreground hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReport}
                  disabled={isReporting}
                  className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black text-white hover:bg-rose-700 shadow-lg shadow-rose-500/20 uppercase tracking-widest"
                >
                  {isReporting ? "Sending..." : "Submit Report"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecentBookingsList;
