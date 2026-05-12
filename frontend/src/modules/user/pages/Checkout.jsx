import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, CreditCard, Wallet, Tag, Clock, Plus, Home, Briefcase, X, Check, ShieldCheck, Copy, Navigation, Zap, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import API from "@/lib/api";

const mapContainerStyle = { width: '100%', height: '200px' };
const center = { lat: 28.6139, lng: 77.2090 }; // Delhi

const dates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return { day: d.toLocaleDateString("en", { weekday: "short" }), date: d.getDate(), full: d.toISOString().split("T")[0] };
});

const timeSlots = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM"];

const defaultAddresses = [
  { id: 1, label: "Home", address: "123 MG Road, Lucknow, UP 226001", icon: "home", location: { type: "Point", coordinates: [80.9462, 26.8467] } },
  { id: 2, label: "Office", address: "456 Hazratganj, Lucknow, UP 226001", icon: "office", location: { type: "Point", coordinates: [80.9462, 26.8467] } },
];

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [paymentMode, setPaymentMode] = useState("now");
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [serviceNotes, setServiceNotes] = useState("");
  const [appliedCouponData, setAppliedCouponData] = useState(null);

  const checkoutData = JSON.parse(localStorage.getItem("rozsewa_checkout_data")) || {
    shopName: "Provider",
    category: "General",
    items: [{ name: "Demo Service", price: 499, qty: 1 }],
    total: 499
  };

  const subtotal = checkoutData.total || 499;
  const serviceNames = checkoutData.items?.length > 0 ? checkoutData.items.map(i => i.name).join(", ") : "General Service";

  // New features
  const [isExpress, setIsExpress] = useState(false);
  const [isRequestingQuote, setIsRequestingQuote] = useState(false);
  const EXPRESS_FEE = checkoutData?.expressPrice || 0;

  // Address state (Sync with backend user)
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: "", address: "" });
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // Booking Confirmed
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [currentBookingStatus, setCurrentBookingStatus] = useState("pending");

  useEffect(() => {
    if (user?.addresses) {
      setAddresses(user.addresses);
      if (!selectedAddress && user.addresses.length > 0) {
        setSelectedAddress(user.addresses[0]);
      }
    }
  }, [user]);

  useEffect(() => {
    // Auto-load copied coupon
    const lastCopied = localStorage.getItem("rozsewa_last_copied_coupon");
    if (lastCopied) {
      setCoupon(lastCopied);
      localStorage.removeItem("rozsewa_last_copied_coupon");
    }
  }, []);

  useEffect(() => {
    let interval;
    if (bookingConfirmed && bookingId) {
      interval = setInterval(async () => {
        try {
          const { data } = await API.get('/bookings');
          const myBooking = data.find(b => b._id === bookingId);
          if (myBooking) {
            setCurrentBookingStatus(myBooking.status);
            if (myBooking.status !== 'pending') {
              clearInterval(interval);
            }
          }
        } catch (err) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [bookingConfirmed, bookingId]);

  const applyCoupon = async () => {
    try {
      const { data } = await API.post("/public/coupons/validate", {
        code: coupon,
        amount: subtotal
      });

      setAppliedCouponData(data);
      setCouponApplied(true);
      setShowConfetti(true);
      toast({ title: "Coupon Applied!", description: `You saved with ${data.code}` });
      setTimeout(() => setShowConfetti(false), 2000);
    } catch (err) {
      toast({
        title: "Invalid Coupon",
        description: err.response?.data?.message || "This code is expired or incorrect.",
        variant: "destructive"
      });
      setCoupon("");
    }
  };



  let discount = 0;
  if (couponApplied && appliedCouponData) {
    if (appliedCouponData.discount.includes("%")) {
      const percent = parseInt(appliedCouponData.discount);
      discount = Math.round(subtotal * (percent / 100));
    } else {
      discount = parseInt(appliedCouponData.discount.replace(/[^0-9]/g, "")) || 0;
    }
  }

  const total = subtotal - discount + (isExpress && !isRequestingQuote ? EXPRESS_FEE : 0);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const handleDetectLocation = () => {
    if ("geolocation" in navigator) {
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            if (data?.display_name) {
              setNewAddress(prev => ({
                ...prev,
                address: data.display_name,
                location: { type: "Point", coordinates: [pos.coords.longitude, pos.coords.latitude] }
              }));
            }
          } catch { }
          setIsFetchingLocation(false);
        },
        () => setIsFetchingLocation(false)
      );
    }
  };

  const onMapClick = useCallback((e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setNewAddress(prev => ({
      ...prev,
      location: { type: "Point", coordinates: [lng, lat] }
    }));

    // Reverse Geocode
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => {
        if (data?.display_name) {
          setNewAddress(prev => ({ ...prev, address: data.display_name }));
        }
      });
  }, []);

  const handleSaveNewAddress = async () => {
    if (!newAddress.label || !newAddress.address) return;
    const updated = [...addresses, {
      label: newAddress.label,
      address: newAddress.address,
      icon: "home",
      location: newAddress.location
    }];

    try {
      await API.put("/auth/profile", { addresses: updated });
      toast({ title: "Address Saved" });
      setNewAddress({ label: "", address: "" });
      setShowNewAddressForm(false);
      setShowAddressModal(false);
      setAddresses(updated);
    } catch (err) {
      toast({ title: "Failed to save address", variant: "destructive" });
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };


  const processBooking = async () => {
    setIsProcessing(true);
    try {
      const bookingData = {
        serviceId: checkoutData.serviceId || "DEMO-ID",
        serviceName: serviceNames,
        providerId: checkoutData.providerId || null,
        bookingDate: isExpress ? "ASAP" : selectedDate,
        bookingTime: isExpress ? "ASAP" : selectedTime,
        totalAmount: total,
        address: selectedAddress.address,
        location: selectedAddress.location,
        paymentMode: paymentMode,
        couponCode: appliedCouponData?.code || "",
        discountAmount: discount || 0
      };

      const { data } = await API.post("/bookings", bookingData);

      setBookingId(data._id);
      setBookingId(data._id);
      setBookingConfirmed(true);

      // Clear checkout data
      localStorage.removeItem("rozsewa_checkout_data");
    } catch (err) {
      setIsProcessing(false);
    }
  };

  const handleConfirmBooking = () => {
    if (!isExpress && !selectedDate) {
      toast({ title: "Select Date", description: "Please select a booking date.", variant: "destructive" });
      return;
    }
    if (!isExpress && !selectedTime) {
      toast({ title: "Select Time", description: "Please select a time slot.", variant: "destructive" });
      return;
    }
    if (!selectedAddress) {
      toast({ title: "Select Address", description: "Please select a delivery address.", variant: "destructive" });
      return;
    }

    if (isRequestingQuote) {
      const confirmQuote = window.confirm("You are submitting a quote request. Real cost may vary. Continue?");
      if (!confirmQuote) return;
    }

    processBooking();
  };

  const handleRazorpayPayment = async () => {
    const res = await loadRazorpay();

    if (!res) {
      toast({ title: "Razorpay SDK failed to load. Are you online?", variant: "destructive" });
      return;
    }

    try {
      const { data: order } = await API.post("/payment/order", {
        amount: total,
        currency: "INR"
      });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa",
        description: `Booking for ${serviceNames}`,
        order_id: order.id,
        handler: async (response) => {
          try {
            const { data: verification } = await API.post("/payment/verify", response);
            if (verification.success) {
              processBooking();
            }
          } catch (err) {
            toast({ title: "Payment Verification Failed", variant: "destructive" });
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.mobile,
        },
        theme: {
          color: "#10b981",
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      toast({ title: "Failed to initiate payment", description: err.message, variant: "destructive" });
    }
  };

  // ─── BOOKING CONFIRMED SCREEN ─────────────────────────────────
  if (bookingConfirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md text-center space-y-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="h-12 w-12 text-emerald-500" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Request Sent! 📡</h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground leading-relaxed">
              We've sent your request to nearby providers. {paymentMode === "now" ? "Please check your alerts for a 'Pay Now' notification once a provider accepts your request." : "A provider will be assigned shortly."}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 text-left shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Booking ID</span>
              <button onClick={() => { navigator.clipboard.writeText(bookingId); toast({ title: "Copied!", description: bookingId }); }}
                className="flex items-center gap-1.5 text-sm font-black text-primary hover:text-primary/80 transition-colors">
                {bookingId} <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date & Time</span>
              <span className="text-sm font-black text-foreground">
                {isExpress ? "ASAP (Within 45m)" : `${selectedDate} • ${selectedTime}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Amount</span>
              <span className="text-sm font-black text-primary">₹{total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment</span>
              <span className="text-sm font-black text-foreground">{paymentMode === "now" ? "Online (Wait for Acceptance)" : "Pay After Service"}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <motion.button 
              whileTap={{ scale: currentBookingStatus !== 'pending' ? 0.97 : 1 }} 
              onClick={() => currentBookingStatus !== 'pending' && navigate("/tracking")}
              className={`flex-1 rounded-2xl py-4 text-sm font-black transition-all ${
                currentBookingStatus !== 'pending' 
                ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:shadow-2xl" 
                : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}>
              {currentBookingStatus !== 'pending' ? "Track Booking" : "Waiting for Provider..."}
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/my-bookings")}
              className="flex-1 rounded-2xl border-2 border-border py-4 text-sm font-extrabold text-foreground hover:bg-muted transition-colors">
              My Bookings
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── MAIN CHECKOUT ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-muted">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </motion.button>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">Checkout</h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5 line-clamp-1">{serviceNames}</p>
          </div>
        </div>

        {/* Feature Toggles */}
        <section className={`grid gap-3 ${EXPRESS_FEE > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
          {EXPRESS_FEE > 0 && (
            <motion.div whileTap={{ scale: 0.98 }} onClick={() => { setIsExpress(true); setIsRequestingQuote(false); }}
              className={`relative flex cursor-pointer flex-col p-4 rounded-2xl border-2 transition-all ${isExpress ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10" : "border-border bg-card hover:border-border/80"
                }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-xl ${isExpress ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}><Zap className="h-4 w-4" /></div>
                {isExpress && <Check className="h-4 w-4 text-amber-500" />}
              </div>
              <h3 className="text-sm font-black text-foreground">Express Service</h3>
              <p className="text-[10px] font-bold text-muted-foreground leading-tight mt-1">Get it done within 45 mins (+₹{EXPRESS_FEE})</p>
            </motion.div>
          )}

          <motion.div whileTap={{ scale: 0.98 }} onClick={() => { setIsRequestingQuote(true); setIsExpress(false); setPaymentMode("after"); }}
            className={`relative flex cursor-pointer flex-col p-4 rounded-2xl border-2 transition-all ${isRequestingQuote ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10" : "border-border bg-card hover:border-border/80"
              }`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 rounded-xl ${isRequestingQuote ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}><FileText className="h-4 w-4" /></div>
              {isRequestingQuote && <Check className="h-4 w-4 text-blue-500" />}
            </div>
            <h3 className="text-sm font-black text-foreground">Request Quote</h3>
            <p className="text-[10px] font-bold text-muted-foreground leading-tight mt-1">Submit details, get final pricing before payment</p>
          </motion.div>
        </section>

        <AnimatePresence mode="wait">
          <motion.div key="scheduling" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden">
            <section className={(isExpress || isRequestingQuote) ? "opacity-40 grayscale-[0.5]" : ""}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Select Date
                </h2>
                {(isExpress || isRequestingQuote) && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">Not Required</span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {dates.map((d) => (
                  <motion.button key={d.full} whileTap={{ scale: 0.93 }}
                    onClick={() => {
                      setSelectedDate(d.full);
                      setIsExpress(false);
                      setIsRequestingQuote(false);
                    }}
                    className={`flex min-w-[72px] flex-col items-center justify-center rounded-2xl border-2 py-3 transition-all ${selectedDate === d.full ? "border-primary bg-primary shadow-md shadow-primary/20 text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
                      }`}>
                    <span className="text-[10px] font-bold uppercase opacity-80 mb-1">{d.day}</span>
                    <span className="text-xl font-black">{d.date}</span>
                  </motion.button>
                ))}
              </div>
            </section>

            <section>
              <div className="grid grid-cols-3 gap-2">
                {timeSlots.map((t) => (
                  <motion.button key={t} whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedTime(t);
                      setIsExpress(false);
                      setIsRequestingQuote(false);
                    }}
                    className={`rounded-xl py-3 px-2 text-xs font-bold transition-all ${selectedTime === t ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "border border-border bg-card text-foreground hover:bg-muted"
                      }`}>{t}</motion.button>
                ))}
              </div>
            </section>
          </motion.div>
        </AnimatePresence>

        {/* Address */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Location</h3>
            <button onClick={() => setShowAddressModal(true)} className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors">Change</button>
          </div>
          {selectedAddress ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
                {selectedAddress.icon === "office" ? <Briefcase className="h-6 w-6 text-foreground" /> : <Home className="h-6 w-6 text-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground">{selectedAddress.label}</p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5 leading-snug truncate">{selectedAddress.address}</p>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddressModal(true)} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border bg-muted/50 text-sm font-bold text-foreground hover:bg-muted transition-colors">
              <Plus className="h-5 w-5" /> Add Delivery Address
            </button>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">Service Notes / Instructions</h3>
          <textarea placeholder="Any special instructions for the provider..." rows={2} value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </section>

        {!isRequestingQuote && (
          <>
            {/* Coupon */}
            <section className="relative rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-muted-foreground"><Tag className="h-4 w-4 text-emerald-500" /> Apply Promo</h3>
                <button
                  onClick={() => navigate("/offers")}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline transition-all"
                >
                  View All Offers
                </button>
              </div>
              <div className="flex gap-2">
                <input type="text" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Enter coupon code" disabled={couponApplied}
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold uppercase tracking-wider placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 transition-all" />
                <motion.button whileTap={{ scale: 0.95 }} onClick={applyCoupon} disabled={couponApplied || !coupon}
                  className="rounded-xl bg-emerald-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-emerald-500/20 disabled:opacity-50 transition-all">
                  {couponApplied ? "Applied ✓" : "Apply"}
                </motion.button>
              </div>
            </section>

            {/* Price Summary */}
            <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex justify-between text-sm"><span className="font-semibold text-muted-foreground">Subtotal</span><span className="font-black text-foreground">₹{subtotal}</span></div>
              {isExpress && <div className="flex justify-between text-sm"><span className="font-semibold flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-amber-500" /> Express Fee</span><span className="font-black text-foreground">₹{EXPRESS_FEE}</span></div>}
              {couponApplied && <div className="flex justify-between text-sm text-emerald-500"><span className="font-bold">Discount Applied</span><span className="font-black">-₹{discount}</span></div>}
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-sm font-black uppercase tracking-wider text-muted-foreground">Total To Pay</span>
                <span className="text-xl font-black text-primary">₹{total}</span>
              </div>
            </section>

            {/* Payment Mode removed as requested */}
          </>
        )}
      </main>

      {/* Floating Action */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t border-border p-4 pb-navbar md:pb-4 md:relative md:bg-transparent md:border-0 md:p-0 md:max-w-2xl md:mx-auto">
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleConfirmBooking}
          className={`flex w-full items-center justify-between rounded-2xl py-4 px-6 shadow-2xl transition-all ${isRequestingQuote
            ? "bg-blue-600 text-white shadow-blue-600/20"
            : "bg-primary text-primary-foreground shadow-primary/30"
            }`}>
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
              {isRequestingQuote ? "Submit Details" : "Grand Total"}
            </span>
            <span className="text-xl font-black">
              {isRequestingQuote ? "Request Quote" : `₹${total}`}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-black/20 px-4 py-2 text-sm font-bold uppercase tracking-wider">
            {isRequestingQuote ? "Submit" : "Send Request"} <ArrowLeft className="h-4 w-4 rotate-180" />
          </div>
        </motion.button>
      </div>

      {/* Modals -> Address Select Modal, Add Address Form, OTP Verification... (Kept identical structures, slightly styled up) */}
      {/* ADDRESS SELECT MODAL */}
      <AnimatePresence>
        {showAddressModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/50 backdrop-blur-sm p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-t-[32px] sm:rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 p-5 shrink-0">
                <h3 className="text-base font-black text-foreground">Select Address</h3>
                <button onClick={() => { setShowAddressModal(false); setShowNewAddressForm(false); }} className="rounded-full p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-5 space-y-3 overflow-y-auto">
                {addresses.map(addr => (
                  <button key={addr.id} onClick={() => { setSelectedAddress(addr); setShowAddressModal(false); }}
                    className={`w-full flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${selectedAddress?.id === addr.id ? "border-primary bg-primary/5 shadow-md shadow-primary/5" : "border-border hover:bg-muted hover:border-border/80"
                      }`}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted/80">
                      {addr.icon === "office" ? <Briefcase className="h-6 w-6 text-foreground" /> : <Home className="h-6 w-6 text-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-foreground">{addr.label}</p>
                      <p className="text-xs font-medium text-muted-foreground truncate leading-relaxed">{addr.address}</p>
                    </div>
                    {selectedAddress?.id === addr.id && <div className="rounded-full bg-primary/20 p-1"><Check className="h-4 w-4 text-primary shrink-0" /></div>}
                  </button>
                ))}

                {!showNewAddressForm ? (
                  <button onClick={() => setShowNewAddressForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-sm font-bold text-primary hover:bg-primary/10 transition-colors mt-2">
                    <Plus className="h-5 w-5" /> Add New Address
                  </button>
                ) : (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 rounded-3xl border border-border bg-muted/30 p-5 mt-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">New Address</h4>

                    {isLoaded && (
                      <div className="rounded-2xl overflow-hidden border border-border h-[180px] relative">
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '100%' }}
                          center={newAddress.location ? { lat: newAddress.location.coordinates[1], lng: newAddress.location.coordinates[0] } : center}
                          zoom={15}
                          onClick={onMapClick}
                          options={{ disableDefaultUI: true, zoomControl: false }}
                        >
                          {newAddress.location && (
                            <MarkerF position={{ lat: newAddress.location.coordinates[1], lng: newAddress.location.coordinates[0] }} />
                          )}
                        </GoogleMap>
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="bg-white/80 backdrop-blur text-[8px] font-bold text-center py-1 rounded-lg shadow-sm border border-white/50">
                            Tap on map to pin exact service location
                          </p>
                        </div>
                      </div>
                    )}

                    <input type="text" placeholder="Label (e.g. Home, Office)" value={newAddress.label}
                      onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3.5 text-sm font-bold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                    <div className="relative">
                      <textarea rows={2} placeholder={isFetchingLocation ? "Detecting location..." : "Full address"} value={newAddress.address}
                        onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })} disabled={isFetchingLocation}
                        className="w-full rounded-xl border border-border bg-background p-4 pr-12 text-sm font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-70" />
                      <button type="button" onClick={handleDetectLocation}
                        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Detect location">
                        <Navigation className={`h-4 w-4 ${isFetchingLocation ? "animate-pulse" : ""}`} />
                      </button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setShowNewAddressForm(false)}
                        className="flex-1 rounded-xl border border-border bg-background py-3.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-muted transition-colors">Cancel</button>
                      <button onClick={handleSaveNewAddress}
                        className="flex-1 rounded-xl bg-primary py-3.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl">Save</button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Checkout;
