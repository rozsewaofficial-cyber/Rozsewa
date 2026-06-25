import { useState, useEffect, useCallback } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, CreditCard, Wallet, Tag, Clock, Plus, Home, Briefcase, X, Check, ShieldCheck, Copy, Navigation, Zap, FileText, Radar } from "lucide-react";
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
  const [maxBargainLimit, setMaxBargainLimit] = useState(20);
  const [customerOffer, setCustomerOffer] = useState("");
  const [providerHours, setProviderHours] = useState({ openingTime: "09:00 AM", closingTime: "06:00 PM", availability: [] });

  const checkoutData = JSON.parse(localStorage.getItem("rozsewa_checkout_data")) || {
    shopName: "Provider",
    category: "General",
    items: [{ name: "Demo Service", price: 499, qty: 1 }],
    total: 499,
  };

  useEffect(() => {
    const fetchProviderHours = async () => {
      if (checkoutData.providerId) {
        try {
          const { data } = await API.get(`/public/providers/${checkoutData.providerId}`);
          if (data) {
            setProviderHours({
              openingTime: data.openingTime || "09:00 AM",
              closingTime: data.closingTime || "06:00 PM",
              availability: data.availability || [],
              bookedSlots: data.bookedSlots || []
            });
          }
        } catch (error) {
          console.error("Failed to fetch provider hours:", error);
        }
      }
    };
    fetchProviderHours();
  }, [checkoutData.providerId]);

  const defaultAddresses = [
    { id: 1, label: "Home", address: "123 MG Road, Lucknow, UP 226001", icon: "home", location: { type: "Point", coordinates: [80.9462, 26.8467] } },
    { id: 2, label: "Office", address: "456 Hazratganj, Lucknow, UP 226001", icon: "office", location: { type: "Point", coordinates: [80.9462, 26.8467] } },
  ];

  const generateTimeSlots = () => {
    let startStr = providerHours.openingTime;
    let endStr = providerHours.closingTime;

    if (selectedDate && providerHours.availability?.length > 0) {
      const dateObj = new Date(selectedDate);
      const dayName = dateObj.toLocaleDateString("en", { weekday: "long" });
      const dayAvail = providerHours.availability.find(d => d.day.toLowerCase() === dayName.toLowerCase());
      
      if (dayAvail) {
        if (!dayAvail.isActive) {
           return []; // Closed on this day
        }
        if (dayAvail.startTime) startStr = dayAvail.startTime;
        if (dayAvail.endTime) endStr = dayAvail.endTime;
      }
    }

    const parseTime = (t) => {
      if (!t) return 9;
      const parts = t.split(' ');
      if (parts[0].includes(':')) {
        let [hours, minutes] = parts[0].split(':');
        hours = parseInt(hours, 10);
        if (parts.length > 1) {
          const modifier = parts[1];
          if (hours === 12) hours = modifier === 'AM' || modifier === 'am' ? 0 : 12;
          else if (modifier === 'PM' || modifier === 'pm') hours += 12;
        }
        return hours;
      }
      return 9;
    };
    
    const start = parseTime(startStr);
    const end = parseTime(endStr);
    const slots = [];
    for (let i = start; i <= end; i++) {
      let hour = i % 12 || 12;
      let ampm = i < 12 ? 'AM' : 'PM';
      slots.push(`${hour.toString().padStart(2, '0')}:00 ${ampm}`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const availableSlots = timeSlots.filter((t) => {
    // Helper to convert "HH:mm AM/PM" to minutes
    const toMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(' ');
      let [h, m] = parts[0].split(':').map(Number);
      if (parts[1]) {
         const modifier = parts[1].toLowerCase();
         if (modifier === 'pm' && h < 12) h += 12;
         if (modifier === 'am' && h === 12) h = 0;
      }
      return h * 60 + (m || 0);
    };

    const slotStartMins = toMinutes(t);

    // 1. Filter out past times for today
    if (selectedDate === new Date().toISOString().split("T")[0]) {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      // Only allow slots that are in the future
      if (slotStartMins <= currentMins) return false;
    }

    // 2. Filter out already booked slots considering their duration
    if (providerHours.bookedSlots && providerHours.bookedSlots.length > 0) {
       const isBooked = providerHours.bookedSlots.some(b => {
         if (b.date !== selectedDate) return false;
         const bookedStart = toMinutes(b.time);
         const bookedEnd = bookedStart + (b.duration || 30);
         // The slot is unavailable if it falls within an existing booking's duration
         return slotStartMins >= bookedStart && slotStartMins < bookedEnd;
       });
       if (isBooked) return false;
    }

    return true;
  });

  const subtotal = checkoutData.total || 499;
  const serviceNames = checkoutData.items?.length > 0 ? checkoutData.items.map(i => i.name).join(", ") : "General Service";

  // New features
  const [isExpress, setIsExpress] = useState(false);
  const EXPRESS_FEE = checkoutData?.expressPrice || 0;

  // Address state (Sync with backend user)
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: "", address: "" });
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  useScrollLock(showAddressModal);

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

    const fetchConfig = async () => {
      try {
        const { data } = await API.get("/public/config");
        if (data && data.maxBargainLimit !== undefined) {
          setMaxBargainLimit(data.maxBargainLimit);
        }
      } catch (err) {
        console.error("Failed to fetch public config:", err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    let interval;
    if (bookingConfirmed && bookingId) {
      // Prevent hardware back button from going back to checkout form
      window.history.pushState(null, "", window.location.href);
      const handlePopState = () => {
        navigate("/my-bookings", { replace: true });
      };
      window.addEventListener("popstate", handlePopState);

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

      return () => {
        clearInterval(interval);
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [bookingConfirmed, bookingId, navigate]);

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



  let couponDiscount = 0;
  if (couponApplied && appliedCouponData) {
    if (appliedCouponData.discount.includes("%")) {
      const percent = parseInt(appliedCouponData.discount);
      couponDiscount = Math.round(subtotal * (percent / 100));
    } else {
      couponDiscount = parseInt(appliedCouponData.discount.replace(/[^0-9]/g, "")) || 0;
    }
  }

  // Cap couponDiscount to subtotal
  couponDiscount = Math.min(couponDiscount, subtotal);

  // Maximum allowed discount calculation
  const maxAllowedDiscount = Math.round(subtotal * (maxBargainLimit / 100));
  const minAllowedOffer = Math.max(0, subtotal - maxAllowedDiscount);

  // Parse bargaining customerOffer
  const hasCustomOffer = customerOffer !== "" && !isNaN(Number(customerOffer));
  const parsedCustomerOffer = hasCustomOffer ? Number(customerOffer) : (subtotal - couponDiscount);
  
  // Calculate bargain discount
  const bargainDiscount = Math.max(0, subtotal - couponDiscount - parsedCustomerOffer);
  const totalDiscount = couponDiscount + bargainDiscount;

  // Final subtotal price to pay after discounts (before express fees)
  const payableSubtotal = parsedCustomerOffer;
  const total = payableSubtotal + (isExpress ? EXPRESS_FEE : 0);

  // Validation flags for custom offer
  const isOfferTooLow = hasCustomOffer && (payableSubtotal < minAllowedOffer);
  const isOfferTooHigh = hasCustomOffer && (payableSubtotal > subtotal - couponDiscount);
  const isOfferNegative = hasCustomOffer && (payableSubtotal < 0);
  const isOfferInvalid = isOfferTooLow || isOfferTooHigh || isOfferNegative;

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
        serviceId: checkoutData.serviceId || (checkoutData.items?.[0]?.id) || "DEMO-ID",
        serviceName: serviceNames,
        providerId: checkoutData.providerId || null,
        requiredProviderCategory: checkoutData.requiredProviderCategory || 'partner',
        bookingDate: isExpress ? "ASAP" : selectedDate,
        bookingTime: isExpress ? "ASAP" : selectedTime,
        totalAmount: total,
        address: selectedAddress.address,
        location: selectedAddress.location,
        paymentMode: paymentMode,
        couponCode: appliedCouponData?.code || "",
        discountAmount: totalDiscount,
        customerOffer: hasCustomOffer ? payableSubtotal : null,
        items: checkoutData.items || []
      };

      const { data } = await API.post("/bookings", bookingData);

      setBookingId(data.booking._id);
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
    if (isOfferInvalid) {
      toast({ title: "Invalid Offer", description: "Your customer offer does not meet bargaining rules.", variant: "destructive" });
      return;
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans flex items-center justify-center px-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md text-center space-y-6">
          
          {currentBookingStatus === 'pending' ? (
            <div className="mx-auto flex h-48 w-48 items-center justify-center relative mb-8 mt-4">
              {/* Faint distance rings */}
              <div className="absolute inset-0 rounded-full border border-emerald-500/10" />
              <div className="absolute inset-8 rounded-full border border-emerald-500/10" />
              <div className="absolute inset-16 rounded-full border border-emerald-500/10" />
              
              {/* Radar Sweep */}
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                className="absolute inset-0 rounded-full"
                style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(16, 185, 129, 0.4) 100%)' }}
              />

              {/* Multiple overlapping ripples */}
              {[0, 1, 2].map((i) => (
                <motion.div 
                  key={i}
                  animate={{ scale: [0.5, 3], opacity: [0.6, 0] }} 
                  transition={{ repeat: Infinity, duration: 3, ease: "easeOut", delay: i * 1 }}
                  className="absolute inset-0 m-auto h-16 w-16 bg-emerald-500 rounded-full"
                />
              ))}

              {/* Center Map Pin */}
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 shadow-[0_0_30px_rgba(16,185,129,0.5)] border-4 border-white dark:border-slate-800">
                <MapPin className="h-7 w-7 text-white animate-bounce" />
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-48 w-48 items-center justify-center relative mb-8 mt-4">
               {/* Expanding Outer Ring */}
               <motion.div 
                 initial={{ scale: 0.8, opacity: 1, borderWidth: "12px" }} 
                 animate={{ scale: 1.6, opacity: 0, borderWidth: "0px" }} 
                 transition={{ duration: 1, ease: "easeOut" }}
                 className="absolute inset-0 rounded-full border-emerald-500 m-auto h-28 w-28"
               />
               
               {/* Main Success Circle */}
               <motion.div 
                 initial={{ scale: 0, rotate: -45 }} 
                 animate={{ scale: [0, 1.2, 1], rotate: 0 }} 
                 transition={{ type: "spring", damping: 12, stiffness: 150, delay: 0.1 }}
                 className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.7)] border-4 border-emerald-100 dark:border-emerald-900"
               >
                 <motion.div
                   initial={{ scale: 0 }}
                   animate={{ scale: 1 }}
                   transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                 >
                    <Check className="h-14 w-14 text-white stroke-[4]" />
                 </motion.div>
               </motion.div>
               
               {/* Starburst Particles */}
               {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={`starburst-${i}`}
                    initial={{ scale: 0, x: 0, y: 0 }}
                    animate={{ 
                      scale: [0, 1.5, 0], 
                      x: Math.cos((i * 60 - 30) * (Math.PI / 180)) * 90, 
                      y: Math.sin((i * 60 - 30) * (Math.PI / 180)) * 90 
                    }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    className="absolute m-auto h-3 w-3 bg-emerald-400 rounded-full"
                    style={{ left: '50%', top: '50%', marginLeft: '-6px', marginTop: '-6px' }}
                  />
               ))}
            </div>
          )}

          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              {currentBookingStatus === 'pending' ? "Finding Nearby Sewak..." : "Sewak Assigned! 🎉"}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              {currentBookingStatus === 'pending' 
                ? "Broadcasting your request to all available sewaks in your area. Please wait..." 
                : (paymentMode === "now" ? "A sewak has accepted your request! Please check your alerts for a 'Pay Now' notification." : "A sewak has accepted your request and is assigned to you.")}
            </p>
          </div>

          <div className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3 text-left shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700/50">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Booking ID</span>
              <button onClick={() => { navigator.clipboard.writeText(bookingId); toast({ title: "Copied!", description: bookingId }); }}
                className="flex items-center gap-1.5 text-sm font-black text-blue-600 dark:text-blue-400 hover:text-blue-600 dark:text-blue-400/80 transition-colors">
                {bookingId} <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 mr-4">Service</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white text-right line-clamp-2">
                {serviceNames}
              </span>
            </div>

            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 mr-4">Location</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-right line-clamp-2 max-w-[200px]">
                {selectedAddress?.address || "Address unavailable"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date & Time</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {isExpress ? "ASAP (Within 45m)" : `${selectedDate} • ${selectedTime}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Amount</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">₹{total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment</span>
              <span className="text-sm font-black text-slate-900 dark:text-white">{paymentMode === "now" ? "Online (Wait for Acceptance)" : "Pay After Service"}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <motion.button 
              whileTap={{ scale: currentBookingStatus !== 'pending' ? 0.97 : 1 }} 
              onClick={() => currentBookingStatus !== 'pending' && navigate("/tracking", { replace: true })}
              className={`flex-1 rounded-[20px] py-4 text-sm font-black transition-all ${
                currentBookingStatus !== 'pending' 
                ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20 hover:shadow-2xl" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              }`}>
              {currentBookingStatus !== 'pending' ? "Track Booking" : "Waiting for Provider..."}
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/my-bookings", { replace: true })}
              className="flex-1 rounded-[20px] border-2 border-slate-200 dark:border-slate-700 py-4 text-sm font-extrabold text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800 transition-colors">
              My Bookings
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── MAIN CHECKOUT ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-28 md:pb-8">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-800">
            <ArrowLeft className="h-5 w-5 text-slate-900 dark:text-white" />
          </motion.button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Checkout</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{serviceNames}</p>
          </div>
        </div>

        {/* Feature Toggles */}
        {EXPRESS_FEE > 0 && (
          <section className="grid grid-cols-2 gap-3">
            <motion.div whileTap={{ scale: 0.98 }} onClick={() => { setIsExpress(false); }}
              className={`relative flex cursor-pointer flex-col p-4 rounded-[20px] border-2 transition-all overflow-hidden ${!isExpress ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300"
                }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-[12px] ${!isExpress ? "bg-blue-500 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}><Clock className="h-4 w-4" /></div>
                {!isExpress && <Check className="h-4 w-4 text-blue-600" />}
              </div>
              <h3 className="text-[13px] font-black text-slate-900 dark:text-white">Standard Service</h3>
              <p className="text-[10px] font-bold text-slate-500 leading-tight mt-1">Book for scheduled time</p>
            </motion.div>

            <motion.div whileTap={{ scale: 0.98 }} onClick={() => { setIsExpress(true); }}
              className={`relative flex cursor-pointer flex-col p-4 rounded-[20px] border-2 transition-all overflow-hidden ${isExpress ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-sm" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300"
                }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-[12px] ${isExpress ? "bg-amber-500 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}><Zap className="h-4 w-4" /></div>
                {isExpress && <Check className="h-4 w-4 text-amber-600" />}
              </div>
              <h3 className="text-[13px] font-black text-slate-900 dark:text-white">Express Service</h3>
              <p className="text-[10px] font-bold text-slate-500 leading-tight mt-1">In 45 mins (+₹{EXPRESS_FEE})</p>
            </motion.div>
          </section>
        )}

        <AnimatePresence mode="wait">
          <motion.div key="scheduling" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden">
            <section className={isExpress ? "opacity-40 grayscale-[0.5]" : ""}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-blue-500" /> Select Date
                </h2>
                {isExpress && (
                  <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-[6px] uppercase tracking-widest">Not Required</span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {dates.map((d) => (
                  <motion.button key={d.full} whileTap={{ scale: 0.93 }}
                    onClick={() => {
                      setSelectedDate(d.full);
                      setIsExpress(false);
                    }}
                    className={`flex min-w-[72px] shrink-0 flex-col items-center justify-center rounded-[20px] border-2 py-3.5 transition-all ${selectedDate === d.full ? "border-blue-600 bg-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.2)] text-white" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-blue-300"
                      }`}>
                    <span className="text-[10px] font-bold uppercase opacity-80 mb-1">{d.day}</span>
                    <span className="text-xl font-black">{d.date}</span>
                  </motion.button>
                ))}
              </div>
            </section>

            <section>
              {availableSlots.length === 0 ? (
                <div className="rounded-[20px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-5 text-center shadow-inner">
                  <p className="text-[13px] font-bold text-slate-500">Provider is not available for booking on this date.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((t) => (
                    <motion.button 
                      key={t} 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedTime(t);
                        setIsExpress(false);
                      }}
                      className={`rounded-[14px] py-3 px-2 text-[12px] font-bold transition-all border ${
                        selectedTime === t 
                          ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20" 
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-300"
                      }`}
                    >
                      {t}
                    </motion.button>
                  ))}
                </div>
              )}
            </section>
          </motion.div>
        </AnimatePresence>

        {/* Address */}
        <section className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Location</h3>
            <button onClick={() => setShowAddressModal(true)} className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:bg-blue-900/40 transition-colors">Change</button>
          </div>
          {selectedAddress ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-slate-100 dark:bg-slate-800">
                {selectedAddress.icon === "office" ? <Briefcase className="h-6 w-6 text-slate-900 dark:text-white" /> : <Home className="h-6 w-6 text-slate-900 dark:text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white">{selectedAddress.label}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-snug truncate">{selectedAddress.address}</p>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddressModal(true)} className="w-full flex items-center justify-center gap-2 py-4 rounded-[20px] border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800 transition-colors">
              <Plus className="h-5 w-5" /> Add Delivery Address
            </button>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Service Notes / Instructions</h3>
          <textarea placeholder="Any special instructions for the provider..." rows={2} value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)}
            className="w-full rounded-[16px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm font-medium placeholder:text-slate-400 dark:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
        </section>

        <>
          {/* Coupon */}
          <section className="relative rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500"><Tag className="h-3.5 w-3.5 text-emerald-500" /> Apply Promo</h3>
              <button
                onClick={() => navigate("/offers")}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:underline transition-all"
              >
                View Offers
              </button>
            </div>
            <div className="flex gap-2">
              <input type="text" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="ENTER COUPON CODE" disabled={couponApplied}
                className="flex-1 rounded-[14px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-[13px] font-black uppercase tracking-wider placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 transition-all" />
              <motion.button whileTap={{ scale: 0.95 }} onClick={applyCoupon} disabled={couponApplied || !coupon}
                className="rounded-[14px] bg-[#82e2c0] px-6 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-[0_8px_20px_rgba(130,226,192,0.4)] disabled:opacity-50 transition-all hover:bg-[#68d8b1]">
                {couponApplied ? "Applied ✓" : "Apply"}
              </motion.button>
            </div>
          </section>

          {/* Bargain & Save */}
          <section className="relative rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500"><Tag className="h-3.5 w-3.5 text-blue-500" /> Bargain & Save</h3>
              <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded uppercase tracking-wider">Max {maxBargainLimit}% Off</span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
              Have a budget in mind? Make a custom Customer Offer for this service (minimum offer of ₹{minAllowedOffer} allowed).
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-4 flex items-center text-slate-500 font-bold text-sm">₹</span>
                <input
                  type="number"
                  value={customerOffer}
                  onChange={(e) => setCustomerOffer(e.target.value)}
                  placeholder={`Original Price: ₹${subtotal}`}
                  className="w-full rounded-[14px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-4 py-3 text-[13px] font-bold focus:border-blue-500 focus:outline-none transition-all"
                />
              </div>
              {hasCustomOffer && (
                <button
                  onClick={() => setCustomerOffer("")}
                  className="rounded-[14px] bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-white px-4 py-3 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700"
                >
                  Reset
                </button>
              )}
            </div>
            {hasCustomOffer && (
              <div className="text-[11px] font-bold">
                {isOfferTooLow && (
                  <p className="text-red-500">Customer Offer is too low! Minimum allowed offer: ₹{minAllowedOffer}.</p>
                )}
                {isOfferTooHigh && (
                  <p className="text-red-500">Offer cannot exceed ₹{subtotal - couponDiscount} (subtotal after coupon).</p>
                )}
                {isOfferNegative && (
                  <p className="text-red-500">Offer cannot be negative.</p>
                )}
                {!isOfferInvalid && (
                  <p className="text-emerald-500">
                    Offer within rules! You save a custom bargain discount of ₹{bargainDiscount} (Total savings: ₹{totalDiscount}).
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Price Summary */}
          <section className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3">
            <div className="flex justify-between text-sm"><span className="font-semibold text-slate-500 dark:text-slate-400">Subtotal</span><span className="font-black text-slate-900 dark:text-white">₹{subtotal}</span></div>
            {isExpress && <div className="flex justify-between text-sm"><span className="font-semibold flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-amber-500" /> Express Fee</span><span className="font-black text-slate-900 dark:text-white">₹{EXPRESS_FEE}</span></div>}
            {couponApplied && <div className="flex justify-between text-sm text-emerald-500"><span className="font-bold">Coupon Discount</span><span className="font-black">-₹{couponDiscount}</span></div>}
            {bargainDiscount > 0 && <div className="flex justify-between text-sm text-blue-500"><span className="font-bold">Bargain Discount</span><span className="font-black">-₹{bargainDiscount}</span></div>}
            {totalDiscount > 0 && <div className="flex justify-between text-sm text-emerald-600 font-bold"><span className="font-bold">Total Savings</span><span className="font-black">-₹{totalDiscount}</span></div>}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between items-center">
              <span className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total To Pay</span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400">₹{total}</span>
            </div>
          </section>
        </>
      </main>

      {/* Bottom Bar */}
      {(availableSlots.length > 0 || isExpress) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700 p-4 pb-navbar md:pb-4 md:relative md:bg-transparent md:border-0 md:p-0 md:max-w-2xl md:mx-auto">
          <motion.button whileTap={{ scale: 0.98 }} onClick={handleConfirmBooking} disabled={isProcessing}
            className="flex w-full items-center justify-between rounded-[20px] py-4 px-6 shadow-2xl transition-all bg-blue-600 text-white shadow-blue-600/30">
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-wider opacity-80 font-bold">
                Grand Total
              </span>
              <span className="text-xl font-black">
                ₹{total}
              </span>
            </div>
            <div className="flex items-center gap-2 font-black text-lg">
              Send Request <ArrowLeft className="h-4 w-4 rotate-180" />
            </div>
          </motion.button>
        </div>
      )}

      {/* Modals -> Address Select Modal, Add Address Form, OTP Verification... (Kept identical structures, slightly styled up) */}
      {/* ADDRESS SELECT MODAL */}
      <AnimatePresence>
        {showAddressModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/50 backdrop-blur-sm p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-t-[32px] sm:rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5 shrink-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white">Select Address</h3>
                <button onClick={() => { setShowAddressModal(false); setShowNewAddressForm(false); }} className="rounded-full p-2 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-5 space-y-3 overflow-y-auto">
                {addresses.map(addr => (
                  <button key={addr.id} onClick={() => { setSelectedAddress(addr); setShowAddressModal(false); }}
                    className={`w-full flex items-center gap-4 rounded-[20px] border-2 p-4 text-left transition-all ${selectedAddress?.id === addr.id ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-600/5" : "border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800 hover:border-slate-200 dark:border-slate-700/80"
                      }`}>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-slate-100 dark:bg-slate-800">
                      {addr.icon === "office" ? <Briefcase className="h-6 w-6 text-slate-900 dark:text-white" /> : <Home className="h-6 w-6 text-slate-900 dark:text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{addr.label}</p>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate leading-relaxed">{addr.address}</p>
                    </div>
                    {selectedAddress?.id === addr.id && <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-1"><Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" /></div>}
                  </button>
                ))}

                {!showNewAddressForm ? (
                  <button onClick={() => setShowNewAddressForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-[20px] border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 transition-colors mt-2">
                    <Plus className="h-5 w-5" /> Add New Address
                  </button>
                ) : (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5 mt-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">New Address</h4>

                    {isLoaded && (
                      <div className="rounded-[20px] overflow-hidden border border-slate-200 dark:border-slate-700 h-[180px] relative">
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
                      className="w-full rounded-[16px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3.5 text-sm font-bold focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
                    <div className="relative">
                      <textarea rows={2} placeholder={isFetchingLocation ? "Detecting location..." : "Full address"} value={newAddress.address}
                        onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })} disabled={isFetchingLocation}
                        className="w-full rounded-[16px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 pr-12 text-sm font-medium focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all disabled:opacity-70" />
                      <button type="button" onClick={handleDetectLocation}
                        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:bg-blue-900/40 transition-colors" title="Detect location">
                        <Navigation className={`h-4 w-4 ${isFetchingLocation ? "animate-pulse" : ""}`} />
                      </button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setShowNewAddressForm(false)}
                        className="flex-1 rounded-[16px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800 transition-colors">Cancel</button>
                      <button onClick={handleSaveNewAddress}
                        className="flex-1 rounded-[16px] bg-blue-600 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl">Save</button>
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
