import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Clock, MapPin, AlertTriangle, Loader2, Navigation, ImagePlus, Plus, Map as MapIcon, ExternalLink, MessageCircle, CalendarDays } from "lucide-react";
import LiveTrackingView from "./LiveTrackingView";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";
import ChatModal from "@/components/ChatModal";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { ToastAction } from "@/components/ui/toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const RecentBookingsList = ({ hideCompletedAndCancelled = false }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('bookings_active_tab') || "pending";
  });

  useEffect(() => {
    sessionStorage.setItem('bookings_active_tab', activeTab);
  }, [activeTab]);
  const [staffList, setStaffList] = useState([]);
  const [activeTracking, setActiveTracking] = useState(null);
  const [pollingIntervalId, setPollingIntervalId] = useState(null);

  // Poll for online payment completion if any booking is waiting
  useEffect(() => {
    const isWaitingForOnlinePayment = requests.some(
      (req) => req.status === 'completed' && req.paymentMode === 'now' && req.paymentStatus !== 'paid'
    );

    if (isWaitingForOnlinePayment) {
      if (!pollingIntervalId) {
        const id = setInterval(() => {
          fetchBookings();
        }, 3000);
        setPollingIntervalId(id);
      }
    } else {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        setPollingIntervalId(null);
      }
    }

    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [requests, pollingIntervalId]);
  const [activeChatBookingId, setActiveChatBookingId] = useState(null);
  const { toast } = useToast();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [counteringBookingId, setCounteringBookingId] = useState(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);

  // Cancellation Modal States
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelMode, setCancelMode] = useState("cancel");
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCounterSubmit = async (bookingId, originalFixedPrice, customerOffer, extraCharges = []) => {
    const extraChargesAmount = (extraCharges || []).filter(c => c.item && (c.item.includes('Travel Charge') || c.item.includes('Night Charge'))).reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
    const baseCustomerOffer = Math.max(0, customerOffer - extraChargesAmount);
    const baseFixedPrice = Math.max(0, originalFixedPrice - extraChargesAmount);

    const amt = Number(counterAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      toast({ title: "Validation Error", description: "Please enter a valid positive amount.", variant: "destructive" });
      return;
    }
    if (amt <= baseCustomerOffer) {
      toast({ title: "Validation Error", description: `Counter offer must be greater than customer's offer of ₹${baseCustomerOffer}.`, variant: "destructive" });
      return;
    }
    if (amt > baseFixedPrice) {
      toast({ title: "Validation Error", description: `Counter offer cannot exceed original fixed price of ₹${baseFixedPrice}.`, variant: "destructive" });
      return;
    }

    setIsSubmittingCounter(true);
    try {
      await API.patch(`/bookings/${bookingId}/status`, {
        status: 'pending',
        offerDecision: 'counter',
        counterAmount: amt + extraChargesAmount
      });
      toast({ title: "Counter Offer Sent!", description: `Proposed ₹${amt} to the customer.`, variant: "default" });
      setCounteringBookingId(null);
      setCounterAmount('');
      fetchBookings();
    } catch (err) {
      toast({
        title: "Failed to send counter-offer",
        description: err.response?.data?.message || err.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmittingCounter(false);
    }
  };

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
      if (err.response?.status !== 401) {
        toast({ title: "Failed to fetch bookings", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    if (user && user._id) {
      API.get(`/public/services/${user._id}`)
        .then(res => {
          setProviderServices(res.data?.services || []);
        })
        .catch(err => console.error("Failed to load provider services", err));
    }
  }, [user]);

  useEffect(() => {
    if (socket) {
      const handleSocketUpdate = () => {
        fetchBookings();
      };
      
      socket.on("EXTRA_CHARGES_UPDATE", handleSocketUpdate);
      socket.on("PAYMENT_COMPLETED", handleSocketUpdate);
      socket.on("NEW_NOTIFICATION", handleSocketUpdate);
      socket.on("BOOKING_UPDATE", handleSocketUpdate);
      
      return () => {
        socket.off("EXTRA_CHARGES_UPDATE", handleSocketUpdate);
        socket.off("PAYMENT_COMPLETED", handleSocketUpdate);
        socket.off("NEW_NOTIFICATION", handleSocketUpdate);
        socket.off("BOOKING_UPDATE", handleSocketUpdate);
      };
    }
  }, [socket]);

  const handleAction = async (id, action, extraData = {}) => {
    // If action is scheduled, the API calls are handled by specific endpoints.
    if (action === 'scheduled') {
      setRequests(prev => prev.filter(req => req._id !== id));
      return;
    }

    let newStatus = 'pending';
    if (action === 'accept') newStatus = 'confirmed';
    if (action === 'complete' || action === 'completed') newStatus = 'completed';
    if (action === 'on_the_way') newStatus = 'on_the_way';
    if (action === 'reject') newStatus = 'cancelled';

    // Optimistically update the UI
    if (action === 'reject') {
      setRequests(prev => prev.filter(req => req._id !== id));
    } else {
      setRequests(prev => prev.map(req => req._id === id ? { ...req, status: newStatus, ...extraData } : req));
    }

    try {
      await API.patch(`/bookings/${id}/status`, { status: newStatus, ...extraData });
      toast({ title: `Booking ${action === 'complete' ? 'Completed' : action === 'reject' ? 'Rejected' : action + 'ed'}` });
      fetchBookings();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err.response?.data?.message || err.message,
        variant: "destructive"
      });
      fetchBookings();
    }
  };

  const handleRejectRequest = (req) => {
    const providerId = req.providerId?._id || req.providerId;
    const isAssignedProvider = providerId && user?._id &&
      providerId.toString() === user._id.toString();

    if (isAssignedProvider) {
      setCancelMode("reject");
      setCancelBookingId(req._id);
      setCancelReason("");
      setCancelModalOpen(true);
      return;
    }

    handleAction(req._id, 'reject');
  };

  const handleCancelBookingByProvider = (bookingId) => {
    setCancelMode("cancel");
    setCancelBookingId(bookingId);
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const submitCancellation = async () => {
    const wordCount = cancelReason.trim().split(/\s+/).filter(word => word.length > 0).length;
    if (cancelReason.trim().length < 10 || wordCount < 3) {
      toast({
        title: "Reason too short",
        description: "Please provide a proper reason (minimum 10 characters and 3 words).",
        variant: "destructive"
      });
      return;
    }

    setIsCancelling(true);
    try {
      await API.patch(`/bookings/${cancelBookingId}/status`, { 
        status: 'cancelled',
        cancellationReason: cancelReason.trim()
      });
      toast({ title: cancelMode === "reject" ? "Booking Rejected" : "Booking Cancelled", description: cancelMode === "reject" ? "The customer has been notified." : "The booking has been cancelled and penalty has been applied." });
      setCancelModalOpen(false);
      setCancelBookingId(null);
      setCancelReason("");
      fetchBookings();
    } catch (err) {
      toast({
        title: "Cancellation failed",
        description: err.response?.data?.message || err.message,
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
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

  const isSewak = user?.role === 'sewak' || user?.providerCategory === 'sewak';

  const [filterCity, setFilterCity] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");      // YYYY-MM-DD
  const [filterToDate, setFilterToDate] = useState("");          // YYYY-MM-DD
  const [fromDateDisplay, setFromDateDisplay] = useState("");    // DD/MM/YYYY display
  const [toDateDisplay, setToDateDisplay] = useState("");        // DD/MM/YYYY display
  const today = new Date().toISOString().split('T')[0];          // YYYY-MM-DD

  // Convert DD/MM/YYYY → YYYY-MM-DD (returns '' if invalid)
  const toISO = (ddmmyyyy) => {
    const parts = ddmmyyyy.split('/');
    if (parts.length !== 3 || parts[2].length !== 4) return '';
    const [dd, mm, yyyy] = parts;
    if (!dd || !mm || !yyyy) return '';
    const iso = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return iso;
  };

  // Auto-format typed input as DD/MM/YYYY
  const maskDate = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 2) out = digits.slice(0,2) + '/' + digits.slice(2);
    if (digits.length > 4) out = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
    return out;
  };

  const handleFromDateChange = (raw) => {
    const masked = maskDate(raw);
    setFromDateDisplay(masked);
    if (masked.length === 10) {
      let iso = toISO(masked);
      if (iso > today) { iso = today; setFromDateDisplay(today.split('-').reverse().join('/')); }
      setFilterFromDate(iso);
      if (filterToDate && iso && iso > filterToDate) { setFilterToDate(''); setToDateDisplay(''); }
    } else {
      setFilterFromDate('');
    }
  };

  const handleToDateChange = (raw) => {
    const masked = maskDate(raw);
    setToDateDisplay(masked);
    if (masked.length === 10) {
      let iso = toISO(masked);
      if (iso > today) { iso = today; setToDateDisplay(today.split('-').reverse().join('/')); }
      if (filterFromDate && iso && iso < filterFromDate) { iso = filterFromDate; setToDateDisplay(filterFromDate.split('-').reverse().join('/')); }
      setFilterToDate(iso);
    } else {
      setFilterToDate('');
    }
  };

  const filteredRequests = requests.filter(req => {
    if (activeTab === "pending" && req.status !== "pending") return false;
    if (activeTab === "active" && !(['confirmed', 'on_the_way', 'started'].includes(req.status) || (req.status === 'completed' && req.paymentStatus !== 'paid'))) return false;
    if (activeTab === "completed" && !(req.status === "completed" && req.paymentStatus === 'paid')) return false;
    if (activeTab === "cancelled" && req.status !== "cancelled") return false;

    // Filter by city/address/customer/service
    if (filterCity) {
        const query = filterCity.toLowerCase();
        const bookingAddress = (req.address || "").toLowerCase();
        const customerName = (req.userId?.name || "").toLowerCase();
        const customerCity = (req.userId?.city || "").toLowerCase();
        const customerAddress = (req.userId?.address || "").toLowerCase();
        const serviceName = (req.serviceName || "").toLowerCase();

        if (
            !bookingAddress.includes(query) &&
            !customerName.includes(query) &&
            !customerCity.includes(query) &&
            !customerAddress.includes(query) &&
            !serviceName.includes(query)
        ) {
            return false;
        }
    }
    
    // Filter by Date
    if (filterFromDate || filterToDate) {
        if (!req.bookingDate) return false;
        const bDate = new Date(req.bookingDate);
        if (filterFromDate) {
            const fDate = new Date(filterFromDate);
            if (bDate < fDate) return false;
        }
        if (filterToDate) {
            const tDate = new Date(filterToDate);
            if (bDate > tDate) return false;
        }
    }

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
  const [providerOtp, setProviderOtp] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [beforeWorkPhoto, setBeforeWorkPhoto] = useState(null);
  const [afterWorkPhoto, setAfterWorkPhoto] = useState(null);

  const [showExtraModal, setShowExtraModal] = useState(false);
  const [newExtraCharges, setNewExtraCharges] = useState([]);
  
  const isBeautyBooking = (req) => {
    const svc = (req?.serviceName || '').toLowerCase();
    const biz = (user?.businessType || '').toLowerCase();
    const shop = (user?.shopName || '').toLowerCase();
    return svc.match(/salon|spa|grooming|beauty|makeup|facial|hair/) || 
           biz.match(/salon|spa|grooming|beauty|makeup|facial|hair/) ||
           shop.match(/salon|spa|grooming|beauty|makeup|facial|hair/);
  };
  const [extraMode, setExtraMode] = useState('parts');
  const [providerServices, setProviderServices] = useState([]);
  const [showAdminRequestModal, setShowAdminRequestModal] = useState(false);
  const [activeBookingForExtra, setActiveBookingForExtra] = useState(null);

  const [reportBookingId, setReportBookingId] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  useScrollLock(showExtraModal || !!otpBooking || cancelModalOpen || !!counteringBookingId || !!reportBookingId || showAdminRequestModal || !!activeTracking);

  const handleOtpVerify = async () => {
    const fullOtp = providerOtp;
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
      setProviderOtp("");
      setBeforeWorkPhoto(null);
      setAfterWorkPhoto(null);
      fetchBookings();
    } catch (err) {
      toast({ 
        title: "Verification Failed", 
        description: err.response?.data?.message || "Please enter the correct code.", 
        variant: "destructive" 
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const submitExtraCharges = async () => {
    try {
      const filtered = newExtraCharges
        .map(c => ({ item: c.item, amount: Number(c.amount) }))
        .filter(c => c.item && !isNaN(c.amount) && c.amount > 0);
      if (filtered.length === 0) return;

      const booking = requests.find(r => r._id === activeBookingForExtra);
      const existingCharges = booking?.extraCharges || [];
      const updatedCharges = [...existingCharges, ...filtered];

      await API.patch(`/bookings/${activeBookingForExtra}/status`, {
        extraCharges: updatedCharges,
        extraStatus: 'pending'
      });

      toast({ title: "Extra charges sent to user for approval." });
      setShowExtraModal(false);
      fetchBookings();
    } catch (err) {
      toast({ title: "Failed to add charges", variant: "destructive" });
    }
  };

  const handleRemoveExtraCharge = async (bookingId, chargeIndex, currentCharges) => {
    try {
      const updatedCharges = currentCharges.filter((_, i) => i !== chargeIndex);
      await API.patch(`/bookings/${bookingId}/status`, {
        extraCharges: updatedCharges,
        extraStatus: updatedCharges.length === 0 ? 'none' : 'pending'
      });
      toast({ title: "Extra charge removed" });
      fetchBookings();
    } catch (err) {
      toast({ title: "Failed to remove extra charge", variant: "destructive" });
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
          ...(hideCompletedAndCancelled ? [] : [
            { id: "completed", label: "Completed", color: "text-emerald-700 bg-emerald-100 dark:bg-emerald-800/30 dark:text-emerald-300" },
            { id: "cancelled", label: "Rejected", color: "text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400" }
          ])
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
            {tab.label}
            {counts[tab.id] > 0 && <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${activeTab === tab.id ? tab.color : "bg-muted-foreground/20"}`}>{counts[tab.id]}</span>}
          </button>
        ))}
      </div>

      {/* Filters Section - Only for Partner (Provider), not for Sewak */}
      {user?.role === 'provider' && (
        <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-2xl border border-border">
          {!isSewak && (
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">Search City/Address</label>
              <input
                type="text"
                placeholder="e.g. Delhi, Mumbai..."
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-2 text-xs focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          )}
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">From Date</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                value={fromDateDisplay}
                maxLength={10}
                onChange={(e) => handleFromDateChange(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-2 pr-8 text-xs focus:ring-2 focus:ring-primary outline-none"
              />
              {/* Hidden native date picker triggered by icon */}
              <input
                type="date"
                max={today}
                tabIndex={-1}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                onChange={(e) => {
                  const iso = e.target.value;
                  if (!iso) return;
                  const [yyyy, mm, dd] = iso.split('-');
                  handleFromDateChange(`${dd}${mm}${yyyy}`);
                }}
              />
              <CalendarDays className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">To Date</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                value={toDateDisplay}
                maxLength={10}
                onChange={(e) => handleToDateChange(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-2 pr-8 text-xs focus:ring-2 focus:ring-primary outline-none"
              />
              {/* Hidden native date picker triggered by icon */}
              <input
                type="date"
                min={filterFromDate || undefined}
                max={today}
                tabIndex={-1}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                onChange={(e) => {
                  const iso = e.target.value;
                  if (!iso) return;
                  const [yyyy, mm, dd] = iso.split('-');
                  handleToDateChange(`${dd}${mm}${yyyy}`);
                }}
              />
              <CalendarDays className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => { setFilterCity(""); setFilterFromDate(""); setFilterToDate(""); setFromDateDisplay(""); setToDateDisplay(""); }}
              className="w-full sm:w-auto px-4 py-2 bg-muted text-foreground text-xs font-bold rounded-lg hover:bg-muted/80"
            >
              Clear
            </button>
          </div>
        </div>
      )}

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

                <div className="mt-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${req.serviceLocation === 'shop' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                    {req.serviceLocation === 'shop' ? 'At Shop' : 'At Home'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-1.5 mb-1 text-xs font-bold text-muted-foreground bg-muted/30 w-fit px-2 py-1 rounded-lg">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>{req.bookingDate} • {req.bookingTime}</span>
                </div>

                <p className="text-sm font-bold text-muted-foreground mt-1">{req.userId?.name || "Customer"}</p>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    {/* Total collected from customer */}
                    {(req.customerOffer !== undefined && req.customerOffer !== null) || (req.negotiation && req.negotiation.userProposedAmount) ? (
                      <div className="flex flex-col">
                        <div className="text-sm font-black text-emerald-600/60 dark:text-emerald-400/60 italic line-through">₹{req.originalFixedPrice}</div>
                        <div className="flex items-center gap-2">
                          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{req.customerOffer || req.negotiation.userProposedAmount}</div>
                          <span className="text-[9px] font-black uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded">Proposed</span>
                        </div>
                      </div>
                    ) : req.discountAmount > 0 ? (
                      <div className="flex flex-col">
                        <div className="text-sm font-black text-emerald-600/60 dark:text-emerald-400/60 italic line-through">₹{(req.totalAmount || 0) + req.discountAmount}</div>
                        <div className="flex items-center gap-2">
                          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{req.totalAmount}</div>
                          <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded">Discounted</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹{req.totalAmount || 0}</div>
                    )}
                    {/* Provider payout vs commission breakdown */}
                    {req.providerPayout > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                            Your share: ₹{req.providerPayout}
                          </span>
                        </div>
                        {req.adminCommission > 0 && (
                          <div className="text-[9px] font-bold text-slate-400">
                            Commission: ₹{req.adminCommission}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">Total billed to customer</div>
                    )}
                    {req.extraCharges && req.extraCharges.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {req.extraCharges.map((extra, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tighter bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="flex gap-2">
                              <span>+ {extra.item}:</span>
                              <span className="text-emerald-600 dark:text-emerald-500">₹{extra.amount}</span>
                            </div>
                            
                            {/* Remove button only if booking is started/pending/confirmed and not completed/cancelled */}
                            {['started', 'pending', 'confirmed'].includes(req.status) && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveExtraCharge(req._id, idx, req.extraCharges); }}
                                className="h-5 w-5 flex items-center justify-center rounded bg-rose-100/50 text-rose-500 hover:bg-rose-100 transition-colors"
                                title="Remove extra charge"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
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
                    <div className="flex items-start gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg max-w-[180px]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{req.serviceLocation === 'shop' ? 'Customer visits shop' : req.address}</span>
                    </div>
                  </div>
                </div>

                {req.status === "pending" && req.offerStatus === "countered" && (
                  <div className="mt-5 rounded-xl border-2 border-purple-500/20 bg-purple-50/50 dark:bg-purple-900/10 p-3">
                    <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest mb-1">Counter-Offer Proposed</p>
                    <div className="flex justify-between items-center bg-background rounded-lg p-2 border border-border">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Your Counter</p>
                        <p className="font-bold text-xs">₹{req.partnerCounterOffer}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-wider">Customer Offer</p>
                        <p className="font-bold text-xs text-amber-600">₹{req.customerOffer}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] font-bold text-purple-600 text-center uppercase tracking-widest animate-pulse">Waiting for customer response...</p>
                  </div>
                )}

                {req.status === "pending" && req.offerStatus !== "countered" && (!req.proposedSchedule || req.proposedSchedule.status !== 'pending') && (
                  req.bargainDiscount > 0 ? (
                    counteringBookingId === req._id ? (() => {
                      const extraChargesAmount = (req.extraCharges || []).filter(c => c.item && (c.item.includes('Travel Charge') || c.item.includes('Night Charge'))).reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
                      const baseCustomerOffer = Math.max(0, req.customerOffer - extraChargesAmount);
                      const baseFixedPrice = Math.max(0, req.originalFixedPrice - extraChargesAmount);
                      return (
                        <div className="mt-5 bg-muted/50 rounded-xl p-3 border border-border space-y-3">
                          <p className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Propose Counter Offer</p>
                          <input
                            type="number"
                            placeholder={`Enter amount between ₹${baseCustomerOffer + 1} and ₹${baseFixedPrice}`}
                            value={counterAmount}
                            onChange={(e) => setCounterAmount(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg p-2 text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                setCounteringBookingId(null);
                                setCounterAmount('');
                              }}
                              className="rounded-lg border border-border py-1.5 text-xs font-bold text-muted-foreground bg-background hover:bg-muted"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleCounterSubmit(req._id, req.originalFixedPrice, req.customerOffer, req.extraCharges)}
                              disabled={isSubmittingCounter}
                              className="rounded-lg bg-purple-600 hover:bg-purple-700 py-1.5 text-xs font-bold text-white shadow-md disabled:opacity-50"
                            >
                              {isSubmittingCounter ? 'Sending...' : 'Send'}
                            </button>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="mt-5 flex flex-col gap-2 w-full">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleRejectRequest(req)}
                            className="rounded-xl border-2 border-rose-500/10 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleAction(req._id, 'accept', { offerDecision: 'accept' })}
                            className="rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-700"
                          >
                            Accept Offer
                          </button>
                        </div>
                        <div className="flex flex-col gap-2 w-full">
                          <button
                            onClick={() => setCounteringBookingId(req._id)}
                            className="w-full rounded-xl border-2 border-purple-500/20 bg-purple-50 dark:bg-purple-900/10 py-2.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/20"
                          >
                            Counter Offer
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="mt-5 flex gap-3">
                      <button onClick={() => handleRejectRequest(req)} className="flex-1 rounded-xl border-2 border-rose-500/10 py-2.5 text-xs font-bold text-rose-600">Reject</button>
                      <button onClick={() => handleAction(req._id, 'accept')} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg">Accept</button>
                    </div>
                  )
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
                    <div className="flex flex-col gap-2 w-full mt-5">
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => handleAction(req._id, 'on_the_way')}
                          disabled={!isReady}
                          className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white shadow-lg transition-colors ${isReady ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed opacity-70'}`}
                        >
                          {isReady ? 'Start Journey (On the Way)' : 'Start Journey (Available 30 mins before)'}
                        </button>
                        <button onClick={() => setActiveChatBookingId(req._id)} className="w-12 h-[42px] shrink-0 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleCancelBookingByProvider(req._id)}
                        className="w-full rounded-xl py-2.5 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/30 transition-colors border border-rose-200 dark:border-rose-900"
                      >
                        Cancel Booking (₹100 Penalty)
                      </button>
                    </div>
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
                    <button
                      onClick={() => handleCancelBookingByProvider(req._id)}
                      className="w-full rounded-xl py-2 px-4 text-xs font-extrabold text-rose-500 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/30 transition-colors border border-rose-200 dark:border-rose-900"
                    >
                      Cancel Booking (₹100 Penalty)
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setExtraMode('parts');
                            setActiveBookingForExtra(req._id);
                            setShowExtraModal(true);
                            setNewExtraCharges([{ item: '', amount: '' }]);
                          }}
                          className="w-full flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary bg-primary/5 dark:bg-primary/10 py-3 text-[10px] font-black uppercase text-primary dark:text-primary-foreground tracking-widest hover:bg-primary/10 dark:hover:bg-primary/20 transition-all"
                        >
                          <Plus className="h-4 w-4" /> {isBeautyBooking(req) ? 'Add Products Used' : 'Add Spare Parts'}
                        </button>
                        <button
                          onClick={() => {
                            setExtraMode('services');
                            setActiveBookingForExtra(req._id);
                            setShowExtraModal(true);
                            setNewExtraCharges([{ item: '', amount: '' }]);
                          }}
                          className="w-full flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 py-3 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-950/30 transition-all"
                        >
                          <Plus className="h-4 w-4" /> Add Extra Service
                        </button>
                      </div>
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
                        <span>Base Price</span>
                        <span>₹{(req.totalAmount || 0) - ((req.extraCharges || []).filter(c => c.item.includes('Travel Charge') || c.item.includes('Night Charge')).reduce((sum, c) => sum + (c.amount || 0), 0) || 0)}</span>
                      </div>
                      {req.extraCharges && req.extraCharges.length > 0 && (
                        <div className="flex justify-between text-xs font-bold text-muted-foreground mb-2">
                          <span>Extra Charges (Travel, Parts, etc.)</span>
                          <span>₹{req.extraCharges.reduce((sum, c) => sum + (c.amount || 0), 0)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-emerald-700 dark:text-emerald-400 mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900">
                        <span>Total Bill</span>
                        <span>₹{(req.totalAmount || 0) + ((req.extraCharges || []).filter(c => !c.item.includes('Travel Charge') && !c.item.includes('Night Charge')).reduce((sum, c) => sum + (c.amount || 0), 0) || 0)}</span>
                      </div>
                    </div>

                    {req.paymentMode === 'now' ? (
                      <div className="space-y-3">
                        <div className="w-full flex flex-col items-center justify-center gap-2 rounded-xl bg-blue-50 border border-blue-200 p-3 shadow-sm">
                          <div className="flex items-center gap-2 text-xs font-black text-blue-600 uppercase tracking-widest">
                            <Clock className="h-4 w-4 animate-pulse" /> Waiting for Online Payment
                          </div>
                          <button onClick={fetchBookings} className="text-[10px] bg-white border border-blue-200 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100 transition-all font-bold">
                            Refresh Status
                          </button>
                        </div>
                        <button
                          onClick={() => handleAction(req._id, 'completed', { paymentStatus: 'paid', paymentMode: 'after' })}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-100 border border-slate-200 py-2.5 text-[10px] font-black text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all uppercase tracking-widest"
                        >
                          <Check className="h-3 w-3" /> Mark as Cash Collected (Skip Online)
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAction(req._id, 'completed', { paymentStatus: 'paid' })}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all uppercase tracking-widest"
                        >
                          <Check className="h-4 w-4" /> Confirm Payment Collected
                        </button>
                        <p className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-tight mt-1">Click this after receiving cash or online transfer from customer.</p>
                      </>
                    )}

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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 touch-none">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-[32px] bg-card p-8 border border-border shadow-2xl touch-auto">
              <h3 className="text-lg font-black text-center mb-2">{otpType === 'start' ? 'Service Verification' : 'Completion Verification'}</h3>
              <p className="text-xs text-muted-foreground text-center mb-6">Ask the customer for the 4-digit code to {otpType === 'start' ? 'start' : 'complete'} the service.</p>

              <div className="flex justify-center mb-8">
                <InputOTP maxLength={4} value={providerOtp} onChange={(val) => setProviderOtp(val)}>
                  <InputOTPGroup className="gap-3">
                    <InputOTPSlot index={0} className="w-14 h-16 text-3xl font-black rounded-xl border-2 border-border !border-l" />
                    <InputOTPSlot index={1} className="w-14 h-16 text-3xl font-black rounded-xl border-2 border-border !border-l" />
                    <InputOTPSlot index={2} className="w-14 h-16 text-3xl font-black rounded-xl border-2 border-border !border-l" />
                    <InputOTPSlot index={3} className="w-14 h-16 text-3xl font-black rounded-xl border-2 border-border !border-l" />
                  </InputOTPGroup>
                </InputOTP>
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
                <button onClick={handleOtpVerify} disabled={isVerifyingOtp || (otpType === 'start' && !beforeWorkPhoto)} className={`flex-1 py-3 rounded-xl text-xs font-black shadow-lg transition-all ${((otpType === 'start' && !beforeWorkPhoto) || isVerifyingOtp) ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90'}`}>
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
              <h3 className="text-lg font-black text-center mb-1">{extraMode === 'services' ? 'Add Extra Services' : (isBeautyBooking(requests.find(r => r._id === activeBookingForExtra)) ? 'Add Products Used' : 'Add Spare Parts')}</h3>
              <p className="text-[10px] text-muted-foreground text-center mb-5 font-bold uppercase tracking-widest">Customer will approve before payment</p>

              <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {newExtraCharges.map((charge, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    {extraMode === 'services' ? (
                      <select
                        value={charge.item}
                        onChange={(e) => {
                          const updated = [...newExtraCharges];
                          const selectedName = e.target.value;
                          const svc = providerServices.find(s => s.name === selectedName);
                          updated[idx].item = selectedName;
                          if (svc && (svc.price !== undefined && svc.price !== null)) {
                            updated[idx].amount = svc.price;
                          }
                          setNewExtraCharges(updated);
                        }}
                        className="flex-1 h-11 rounded-xl bg-muted border-none px-4 text-xs font-bold appearance-none"
                      >
                        <option value="" disabled>Select Service</option>
                        {providerServices.map((s, i) => (
                          <option key={i} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        placeholder={isBeautyBooking(requests.find(r => r._id === activeBookingForExtra)) ? "Product Name" : "Part Name"}
                        value={charge.item}
                        onChange={(e) => {
                          const updated = [...newExtraCharges];
                          updated[idx].item = e.target.value;
                          setNewExtraCharges(updated);
                        }}
                        className="flex-1 h-11 rounded-xl bg-muted border-none px-4 text-xs font-bold"
                      />
                    )}
                    <input
                      placeholder="Amount"
                      type="number"
                      min="0"
                      value={charge.amount}
                      onChange={(e) => {
                        const updated = [...newExtraCharges];
                        const val = e.target.value;
                        if (val === '' || Number(val) >= 0) {
                          updated[idx].amount = val;
                          setNewExtraCharges(updated);
                        }
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

      <AnimatePresence>
        {cancelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-black text-foreground">
                  {cancelMode === "reject" ? "Reject Booking" : "Cancel Booking"}
                </h3>
                <button
                  onClick={() => setCancelModalOpen(false)}
                  className="rounded-full bg-muted p-2 hover:bg-muted/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-6 space-y-4">
                {cancelMode === "cancel" && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-4 border border-rose-200 dark:border-rose-800">
                  <p className="text-sm text-rose-600 dark:text-rose-400 font-bold">
                    Penalty Warning: ₹100 will be deducted from your wallet (₹50 to customer, ₹50 to company).
                  </p>
                </div>
                )}
                <div>
                  <label className="text-sm font-bold text-foreground">
                    Cancellation Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Provide a specific reason for cancelling (min 10 chars, 3 words)..."
                    className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required: Min 10 characters & 3 words
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCancelModalOpen(false)}
                  className="flex-1 rounded-xl bg-muted py-3 text-xs font-bold text-muted-foreground hover:bg-muted/80"
                >
                  Back
                </button>
                <button
                  onClick={submitCancellation}
                  disabled={isCancelling}
                  className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black text-white hover:bg-rose-700 shadow-lg shadow-rose-500/20 tracking-wide"
                >
                  {isCancelling ? "Processing..." : cancelMode === "reject" ? "Confirm Reject" : "Confirm Cancel"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ChatModal
        isOpen={!!activeChatBookingId}
        onClose={() => setActiveChatBookingId(null)}
        bookingId={activeChatBookingId}
        userType="Provider"
        recipientName={requests.find(b => b._id === activeChatBookingId)?.userId?.name}
      />
    </div>
  );
};

export default RecentBookingsList;
