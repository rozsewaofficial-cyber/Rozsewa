import { useState, useEffect, useCallback } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  Wallet,
  Tag,
  Clock,
  Plus,
  Home,
  Briefcase,
  X,
  Check,
  ShieldCheck,
  Copy,
  Navigation,
  Zap,
  FileText,
  Radar,
  Trash2,
  Loader2,
  Moon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  Autocomplete,
} from "@react-google-maps/api";
import API from "@/lib/api";

const mapContainerStyle = { width: "100%", height: "200px" };
const center = { lat: 28.6139, lng: 77.209 }; // Delhi

const dates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return {
    day: d.toLocaleDateString("en", { weekday: "short" }),
    date: d.getDate(),
    full: d.toISOString().split("T")[0],
  };
});

const libraries = ["places"];

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, serviceMode, updateUser } = useAuth();

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });
  const providerLabel = serviceMode === "sewak" ? "Sewak" : "Partner";
  const providerLabelLower = serviceMode === "sewak" ? "sewak" : "partner";
  const providerLabelPlural = serviceMode === "sewak" ? "sewaks" : "partners";
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [paymentMode, setPaymentMode] = useState("now");
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [serviceNotes, setServiceNotes] = useState("");
  const [appliedCouponData, setAppliedCouponData] = useState(null);
  const [customerOffer, setCustomerOffer] = useState("");
  const [providerHours, setProviderHours] = useState({
    openingTime: "09:00 AM",
    closingTime: "06:00 PM",
    availability: [],
    bookedSlots: [],
  });
  const [providerDetails, setProviderDetails] = useState(null);
  const [userProposedAmount, setUserProposedAmount] = useState("");
  const [drivingDistanceKm, setDrivingDistanceKm] = useState(null);
  const [serviceLocation, setServiceLocation] = useState("home");
  const [gstPercent, setGstPercent] = useState(0);
  const [platformFee, setPlatformFee] = useState(0);

  const checkoutData = JSON.parse(
    localStorage.getItem("rozsewa_checkout_data"),
  ) || {
    shopName: "Provider",
    category: "General",
    items: [{ name: "Demo Service", price: 499, qty: 1 }],
    total: 499,
  };

  useEffect(() => {
    const fetchProviderHours = async () => {
      if (checkoutData.providerId) {
        try {
          const { data } = await API.get(
            `/public/providers/${checkoutData.providerId}`,
          );
          if (data) {
            const pData = data.data || data;
            setProviderDetails(pData);
            setProviderHours({
              openingTime: pData.openingTime || "09:00 AM",
              closingTime: pData.closingTime || "06:00 PM",
              availability: pData.availability || [],
              bookedSlots: pData.bookedSlots || [],
            });
          }
        } catch (error) {
          console.error("Failed to fetch provider hours:", error);
        }
      }
    };
    fetchProviderHours();
  }, [checkoutData.providerId]);

  useEffect(() => {
    const fetchCategoryFees = async () => {
      if (checkoutData.category && checkoutData.category !== "General") {
        try {
          const { data } = await API.get(`/public/categories/${encodeURIComponent(checkoutData.category)}`);
          if (data) {
            setGstPercent(data.gstPercent || 0);
            setPlatformFee(data.platformFee || 0);
          }
        } catch (error) {
          console.error("Failed to fetch category fees:", error);
        }
      }
    };
    fetchCategoryFees();
  }, [checkoutData.category]);

  const defaultAddresses = [
    {
      id: 1,
      label: "Home",
      address: "123 MG Road, Lucknow, UP 226001",
      icon: "home",
      location: { type: "Point", coordinates: [80.9462, 26.8467] },
    },
    {
      id: 2,
      label: "Office",
      address: "456 Hazratganj, Lucknow, UP 226001",
      icon: "office",
      location: { type: "Point", coordinates: [80.9462, 26.8467] },
    },
  ];

  const generateTimeSlots = () => {
    let startStr = providerHours.openingTime;
    let endStr = providerHours.closingTime;

    if (selectedDate && providerHours.availability?.length > 0) {
      const dateObj = new Date(selectedDate);
      const dayName = dateObj.toLocaleDateString("en", { weekday: "long" });
      const dayAvail = providerHours.availability.find(
        (d) => d.day.toLowerCase() === dayName.toLowerCase(),
      );

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
      const parts = t.split(" ");
      if (parts[0].includes(":")) {
        let [hours, minutes] = parts[0].split(":");
        hours = parseInt(hours, 10);
        if (parts.length > 1) {
          const modifier = parts[1];
          if (hours === 12)
            hours = modifier === "AM" || modifier === "am" ? 0 : 12;
          else if (modifier === "PM" || modifier === "pm") hours += 12;
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
      let ampm = i < 12 ? "AM" : "PM";
      slots.push(`${hour.toString().padStart(2, "0")}:00 ${ampm}`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const availableSlots = timeSlots.filter((t) => {
    // Helper to convert "HH:mm AM/PM" to minutes
    const toMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(" ");
      let [h, m] = parts[0].split(":").map(Number);
      if (parts[1]) {
        const modifier = parts[1].toLowerCase();
        if (modifier === "pm" && h < 12) h += 12;
        if (modifier === "am" && h === 12) h = 0;
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
      const isBooked = providerHours.bookedSlots.some((b) => {
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
  const serviceNames =
    checkoutData.items?.length > 0
      ? checkoutData.items.map((i) => i.name).join(", ")
      : "General Service";

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

  // Auto-geocode legacy addresses that have no coordinates
  useEffect(() => {
    if (
      selectedAddress &&
      selectedAddress.address &&
      (!selectedAddress.location ||
        !selectedAddress.location.coordinates ||
        selectedAddress.location.coordinates.length < 2)
    ) {
      if (
        isLoaded &&
        window.google &&
        window.google.maps &&
        window.google.maps.Geocoder
      ) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { address: selectedAddress.address },
          (results, status) => {
            if (status === "OK" && results && results[0]) {
              const newLocation = {
                type: "Point",
                coordinates: [
                  results[0].geometry.location.lng(),
                  results[0].geometry.location.lat(),
                ],
              };
              setSelectedAddress((prev) => ({
                ...prev,
                location: newLocation,
              }));
            }
          },
        );
      }
    }
  }, [selectedAddress, isLoaded]);

  // Booking Confirmed
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [currentBookingStatus, setCurrentBookingStatus] = useState("pending");
  const [createdBooking, setCreatedBooking] = useState(null);

  useEffect(() => {
    if (user?.addresses) {
      setAddresses(user.addresses);
      if (!selectedAddress && user.addresses.length > 0) {
        setSelectedAddress(user.addresses[0]);
      }
    }
  }, [user]);

  const [distanceChargeConfig, setDistanceChargeConfig] = useState(null);
  const [nightChargeConfig, setNightChargeConfig] = useState(null);

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
        if (data && data.distanceCharge) {
          setDistanceChargeConfig(data.distanceCharge);
        }
        if (data && data.nightCharge) {
          setNightChargeConfig(data.nightCharge);
        }
      } catch (err) {
        console.error("Failed to fetch public config:", err);
      }
    };
    fetchConfig();
  }, []);

  // Calculate true driving distance via Google Maps API
  useEffect(() => {
    if (
      !distanceChargeConfig?.enabled ||
      !providerDetails?.location?.coordinates ||
      !selectedAddress?.location?.coordinates
    ) {
      setDrivingDistanceKm(null);
      return;
    }

    const bLon = Number(selectedAddress.location.coordinates[0]);
    const bLat = Number(selectedAddress.location.coordinates[1]);
    const pLon = Number(providerDetails.location.coordinates[0]);
    const pLat = Number(providerDetails.location.coordinates[1]);

    if (isNaN(bLon) || isNaN(pLon) || isNaN(bLat) || isNaN(pLat)) {
      setDrivingDistanceKm(null);
      return;
    }

    // Fallback: Straight-line (Haversine)
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(pLat - bLat);
    const dLon = toRad(pLon - bLon);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(bLat)) *
      Math.cos(toRad(pLat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const straightDistanceKm =
      6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (
      isLoaded &&
      window.google &&
      window.google.maps &&
      window.google.maps.DistanceMatrixService
    ) {
      const service = new window.google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [{ lat: pLat, lng: pLon }],
          destinations: [{ lat: bLat, lng: bLon }],
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          if (
            status === "OK" &&
            response?.rows?.[0]?.elements?.[0]?.status === "OK"
          ) {
            const distMeters = response.rows[0].elements[0].distance.value;
            setDrivingDistanceKm(distMeters / 1000);
          } else {
            console.warn(
              "DistanceMatrixService failed, using straight-line distance:",
              status,
            );
            setDrivingDistanceKm(straightDistanceKm);
          }
        },
      );
    } else {
      setDrivingDistanceKm(straightDistanceKm);
    }
  }, [selectedAddress, providerDetails, distanceChargeConfig, isLoaded]);

  useEffect(() => {
    let interval;
    if (bookingConfirmed && bookingId) {
      // Prevent hardware back button from going back to checkout form
      window.history.pushState(null, "", window.location.href);
      const handlePopState = () => {
        navigate("/my-bookings", { replace: true });
      };
      window.addEventListener("popstate", handlePopState);

      const handleRejected = (e) => {
        const { bookingId: rejectedId, cancellationReason } = e.detail || {};
        if (rejectedId === bookingId) {
          setCurrentBookingStatus("cancelled");
          toast({
            title: "Booking Cancelled",
            description: cancellationReason
              ? `Reason: "${cancellationReason}"`
              : "The provider has rejected your request.",
            variant: "destructive",
          });
        }
      };
      window.addEventListener("BOOKING_REJECTED", handleRejected);

      const handleScheduleProposed = (e) => {
        const { bookingId: proposedId } = e.detail;
        if (proposedId === bookingId) {
          toast({
            title: "Schedule Proposed",
            description: "The provider proposed a new time for your booking.",
          });
          navigate("/tracking", { replace: true });
        }
      };
      window.addEventListener("SCHEDULE_PROPOSED", handleScheduleProposed);

      const handleCounterOfferReceived = (e) => {
        const { bookingId: counteredId } = e.detail;
        if (counteredId === bookingId) {
          toast({
            title: "Counter-Offer Received",
            description: "The provider proposed a new price for your booking.",
          });
          navigate("/tracking", { replace: true });
        }
      };
      window.addEventListener(
        "COUNTER_OFFER_RECEIVED",
        handleCounterOfferReceived,
      );

      interval = setInterval(async () => {
        try {
          const { data } = await API.get("/bookings");
          const myBooking = data.find((b) => b._id === bookingId);
          if (myBooking) {
            setCurrentBookingStatus(myBooking.status);
            setCreatedBooking(myBooking);

            // Redirect to tracking page if a reschedule or counter-offer has been proposed
            if (
              (myBooking.proposedSchedule &&
                myBooking.proposedSchedule.status === "pending") ||
              myBooking.offerStatus === "countered"
            ) {
              clearInterval(interval);
              navigate("/tracking", { replace: true });
              return;
            }

            if (myBooking.status !== "pending") {
              clearInterval(interval);
            }
          }
        } catch (err) { }
      }, 3000);

      return () => {
        clearInterval(interval);
        window.removeEventListener("popstate", handlePopState);
        window.removeEventListener("BOOKING_REJECTED", handleRejected);
        window.removeEventListener("SCHEDULE_PROPOSED", handleScheduleProposed);
        window.removeEventListener(
          "COUNTER_OFFER_RECEIVED",
          handleCounterOfferReceived,
        );
      };
    }
  }, [bookingConfirmed, bookingId, navigate]);

  const handleCancelBooking = () => {
    if (!bookingId) return;

    toast({
      title: "Cancel Booking",
      description: "Are you sure you want to cancel this booking request?",
      variant: "destructive",
      action: (
        <ToastAction
          altText="Confirm Cancel"
          onClick={async () => {
            try {
              await API.put(`/bookings/${bookingId}`, { status: "cancelled" });
              toast({
                title: "Booking Cancelled",
                description: "Your booking request has been cancelled.",
                variant: "default",
              });
              setCurrentBookingStatus("cancelled");
            } catch (err) {
              toast({
                title: "Failed to cancel booking",
                variant: "destructive",
              });
            }
          }}
        >
          Yes, Cancel
        </ToastAction>
      ),
    });
  };

  const applyCoupon = async () => {
    try {
      const { data } = await API.post("/public/coupons/validate", {
        code: coupon,
        amount: subtotal,
      });

      setAppliedCouponData(data);
      setCouponApplied(true);
      setShowConfetti(true);
      toast({
        title: "Coupon Applied!",
        description: `You saved with ${data.code}`,
      });
      setTimeout(() => setShowConfetti(false), 2000);
    } catch (err) {
      toast({
        title: "Invalid Coupon",
        description:
          err.response?.data?.message || "This code is expired or incorrect.",
        variant: "destructive",
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
      couponDiscount =
        parseInt(appliedCouponData.discount.replace(/[^0-9]/g, "")) || 0;
    }
  }

  // Cap couponDiscount to subtotal
  couponDiscount = Math.min(couponDiscount, subtotal);

  // Parse bargaining customerOffer
  const hasCustomOffer = customerOffer !== "" && !isNaN(Number(customerOffer));
  const parsedCustomerOffer = hasCustomOffer
    ? Number(customerOffer)
    : subtotal - couponDiscount;

  // Calculate bargain discount
  const bargainDiscount = Math.max(
    0,
    subtotal - couponDiscount - parsedCustomerOffer,
  );
  const totalDiscount = couponDiscount + bargainDiscount;

  // Final subtotal price to pay after discounts (before express fees)
  const payableSubtotal = parsedCustomerOffer;

  // Calculate dynamic travel charge if provider is known
  let estimatedTravelCharge = distanceChargeConfig?.enabled
    ? Number(distanceChargeConfig.fallbackCharge || 40)
    : 0;
  let calculatedDistanceKm = drivingDistanceKm;
  let appliedDistanceConfig = distanceChargeConfig;

  if (
    distanceChargeConfig?.enabled &&
    providerDetails &&
    calculatedDistanceKm !== null
  ) {
    let distanceKm = calculatedDistanceKm;

    const categoryId =
      typeof providerDetails.vendorType === "object"
        ? providerDetails.vendorType?._id?.toString()
        : providerDetails.vendorType?.toString();
    let cfg = distanceChargeConfig;
    if (
      categoryId &&
      cfg.categoryOverrides &&
      cfg.categoryOverrides[categoryId]
    ) {
      cfg = { ...cfg, ...cfg.categoryOverrides[categoryId] };
    }
    appliedDistanceConfig = cfg;

    if (cfg.maximumDistance && distanceKm > cfg.maximumDistance) {
      distanceKm = cfg.maximumDistance;
    }

    let charge = 0;
    if (distanceKm <= cfg.baseDistance) {
      charge = cfg.baseFee;
    } else {
      charge =
        cfg.baseFee + (distanceKm - cfg.baseDistance) * cfg.extraFeePerKm;
    }
    if (cfg.maximumCharge && charge > cfg.maximumCharge) {
      charge = cfg.maximumCharge;
    }
    switch (cfg.rounding) {
      case "up":
        charge = Math.ceil(charge);
        break;
      case "down":
        charge = Math.floor(charge);
        break;
      case "none":
        break;
      case "nearest":
      default:
        charge = Math.round(charge);
        break;
    }
    estimatedTravelCharge = charge;
  }

  if (serviceLocation === "shop") {
    estimatedTravelCharge = 0;
  }

  const getNightChargeAmount = () => {
    if (!selectedTime || !nightChargeConfig) return 0;

    // Check if category override is active
    const categoryOverride = providerDetails?.vendorType;
    let isActive = nightChargeConfig.enabled;
    let percentage = nightChargeConfig.defaultPercent || 0;

    if (categoryOverride && categoryOverride.hasNightCharge !== undefined) {
      isActive = categoryOverride.hasNightCharge;
      percentage = categoryOverride.nightChargePercent;
    }

    if (!isActive || percentage <= 0) return 0;

    const timeToMins = (tStr) => {
      if (!tStr) return 0;
      const parts = tStr.split(" ");
      if (!parts[0].includes(":")) return 0;
      let [h, m] = parts[0].split(":").map(Number);
      if (parts.length > 1) {
        if (parts[1].toLowerCase() === "pm" && h < 12) h += 12;
        if (parts[1].toLowerCase() === "am" && h === 12) h = 0;
      }
      return h * 60 + m;
    };

    const selMins = timeToMins(selectedTime);
    const startMins = timeToMins(nightChargeConfig.startTime || "21:00");
    const endMins = timeToMins(nightChargeConfig.endTime || "06:00");

    let isNight = false;
    if (startMins <= endMins) {
      isNight = selMins >= startMins && selMins <= endMins;
    } else {
      isNight = selMins >= startMins || selMins <= endMins;
    }

    if (isNight) {
      return Math.round((subtotal * percentage) / 100);
    }
    return 0;
  };

  const nightChargeAmount = getNightChargeAmount();

  const calculatedGstAmount = Math.round((payableSubtotal * gstPercent) / 100);

  const total =
    payableSubtotal +
    (isExpress ? EXPRESS_FEE : 0) +
    estimatedTravelCharge +
    nightChargeAmount +
    calculatedGstAmount +
    platformFee;

  // Calculate minimum allowed offer (e.g. max 30% discount on subtotal)
  const minAllowedOffer = Math.floor(subtotal * 0.7);

  // Validation flags for custom offer
  const isOfferTooLow = hasCustomOffer && payableSubtotal < minAllowedOffer;
  const isOfferTooHigh =
    hasCustomOffer && payableSubtotal > subtotal - couponDiscount;
  const isOfferNegative = hasCustomOffer && payableSubtotal < 0;
  const isOfferInvalid = isOfferTooLow || isOfferTooHigh || isOfferNegative;

  const handleDetectLocation = () => {
    if ("geolocation" in navigator) {
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (window.google && window.google.maps) {
            const geocoder = new window.google.maps.Geocoder();
            const latlng = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };

            geocoder.geocode({ location: latlng }, (results, status) => {
              if (status === "OK" && results[0]) {
                setNewAddress((prev) => ({
                  ...prev,
                  address: results[0].formatted_address,
                  location: {
                    type: "Point",
                    coordinates: [pos.coords.longitude, pos.coords.latitude],
                  },
                }));
              } else {
                toast({
                  title: "Detection Failed",
                  description: "Could not fetch address.",
                  variant: "destructive",
                });
              }
              setIsFetchingLocation(false);
            });
          } else {
            setIsFetchingLocation(false);
          }
        },
        () => setIsFetchingLocation(false),
      );
    }
  };

  const onMapClick = useCallback((e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setNewAddress((prev) => ({
      ...prev,
      location: { type: "Point", coordinates: [lng, lat] },
    }));

    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          setNewAddress((prev) => ({
            ...prev,
            address: results[0].formatted_address,
          }));
        }
      });
    }
  }, []);

  const [autocomplete, setAutocomplete] = useState(null);

  const onLoadAutocomplete = (autocompleteObj) => {
    setAutocomplete(autocompleteObj);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setNewAddress((prev) => ({
          ...prev,
          address: place.formatted_address,
          location: { type: "Point", coordinates: [lng, lat] },
        }));
      }
    }
  };

  const handleSaveNewAddress = async () => {
    if (!newAddress.label || !newAddress.address) {
      toast({
        title: "Validation Error",
        description: "Please provide both a label and an address.",
        variant: "destructive",
      });
      return;
    }

    let locationToSave = newAddress.location;

    // Fallback Geocoding if user typed an address but didn't drop a map pin
    if (
      !locationToSave &&
      isLoaded &&
      window.google &&
      window.google.maps &&
      window.google.maps.Geocoder
    ) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const results = await new Promise((resolve, reject) => {
          geocoder.geocode({ address: newAddress.address }, (res, status) => {
            if (status === "OK") resolve(res);
            else reject(status);
          });
        });
        if (results && results[0]) {
          locationToSave = {
            type: "Point",
            coordinates: [
              results[0].geometry.location.lng(),
              results[0].geometry.location.lat(),
            ],
          };
        }
      } catch (err) {
        console.warn("Geocoding failed, saving without coordinates", err);
      }
    }

    const updated = [
      ...addresses,
      {
        label: newAddress.label,
        address: newAddress.address,
        icon: "home",
        location: locationToSave,
      },
    ];

    try {
      const { data } = await API.put("/auth/profile", { addresses: updated });
      const savedAddresses = data.addresses || data.user?.addresses || updated;
      toast({ title: "Address Saved" });
      setNewAddress({ label: "", address: "" });
      setShowNewAddressForm(false);
      setShowAddressModal(false);
      setAddresses(savedAddresses);
      setSelectedAddress(savedAddresses[savedAddresses.length - 1]);
      updateUser({ addresses: savedAddresses });
    } catch (err) {
      toast({ title: "Failed to save address", variant: "destructive" });
    }
  };

  const handleDeleteAddress = async (e, addressId) => {
    e.stopPropagation();
    try {
      const updated = addresses.filter((a) => a._id !== addressId);
      await API.put("/auth/profile", { addresses: updated });
      setAddresses(updated);
      toast({ title: "Address deleted" });
      if (selectedAddress?._id === addressId) {
        setSelectedAddress(updated.length > 0 ? updated[0] : null);
      }
      updateUser({ addresses: updated });
    } catch (err) {
      toast({ title: "Failed to delete address", variant: "destructive" });
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
    if (userProposedAmount && Number(userProposedAmount) >= total) {
      toast({
        title: "Invalid Price",
        description:
          "Your proposed price must be less than the actual total amount.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const bookingData = {
        serviceId:
          checkoutData.serviceId || checkoutData.items?.[0]?.id || "DEMO-ID",
        serviceName: serviceNames,
        providerId: checkoutData.providerId || null,
        requiredProviderCategory:
          checkoutData.requiredProviderCategory || "partner",
        bookingDate: isExpress ? "ASAP" : selectedDate,
        bookingTime: isExpress ? "ASAP" : selectedTime,
        totalAmount: total,
        address: selectedAddress
          ? selectedAddress.address
          : serviceLocation === "shop"
            ? "Shop Address (Customer Visits)"
            : "",
        location: selectedAddress
          ? selectedAddress.location
          : serviceLocation === "shop"
            ? { type: "Point", coordinates: [0, 0] }
            : undefined,
        paymentMode: paymentMode,
        couponCode: appliedCouponData?.code || "",
        discountAmount: totalDiscount,
        customerOffer: hasCustomOffer ? payableSubtotal : null,
        items: checkoutData.items || [],
        userProposedAmount: userProposedAmount
          ? Number(userProposedAmount)
          : undefined,
        serviceLocation,
      };

      const { data } = await API.post("/bookings", bookingData);

      setBookingId(data.booking._id);
      setCreatedBooking(data.booking);
      setBookingConfirmed(true);

      // Clear checkout data
      localStorage.removeItem("rozsewa_checkout_data");
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("rozsewa_cart_")) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      setIsProcessing(false);
      toast({
        title: "Booking Failed",
        description:
          err.response?.data?.message ||
          "Failed to create booking request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmBooking = () => {
    if (!isExpress && !selectedDate) {
      toast({
        title: "Select Date",
        description: "Please select a booking date.",
        variant: "destructive",
      });
      return;
    }
    if (!isExpress && !selectedTime) {
      toast({
        title: "Select Time",
        description: "Please select a time slot.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedAddress && serviceLocation !== "shop") {
      toast({
        title: "Select Address",
        description: "Please select a delivery address.",
        variant: "destructive",
      });
      return;
    }
    if (isOfferInvalid) {
      toast({
        title: "Invalid Offer",
        description: "Your customer offer does not meet bargaining rules.",
        variant: "destructive",
      });
      return;
    }

    processBooking();
  };

  const handleRazorpayPayment = async () => {
    const res = await loadRazorpay();

    if (!res) {
      toast({
        title: "Razorpay SDK failed to load. Are you online?",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: order } = await API.post("/payment/order", {
        amount: total,
        currency: "INR",
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
            const { data: verification } = await API.post(
              "/payment/verify",
              response,
            );
            if (verification.success) {
              processBooking();
            }
          } catch (err) {
            toast({
              title: "Payment Verification Failed",
              variant: "destructive",
            });
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
      toast({
        title: "Failed to initiate payment",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // ─── BOOKING CONFIRMED SCREEN ─────────────────────────────────
  if (bookingConfirmed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans flex items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md text-center space-y-6"
        >
          {currentBookingStatus === "pending" ? (
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
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 70%, rgba(16, 185, 129, 0.4) 100%)",
                }}
              />

              {/* Multiple overlapping ripples */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [0.5, 3], opacity: [0.6, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 3,
                    ease: "easeOut",
                    delay: i * 1,
                  }}
                  className="absolute inset-0 m-auto h-16 w-16 bg-emerald-500 rounded-full"
                />
              ))}

              {/* Center Map Pin */}
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 shadow-[0_0_30px_rgba(16,185,129,0.5)] border-4 border-white dark:border-slate-800">
                <MapPin className="h-7 w-7 text-white animate-bounce" />
              </div>
            </div>
          ) : currentBookingStatus === "cancelled" ? (
            <div className="mx-auto flex h-48 w-48 items-center justify-center relative mb-8 mt-4">
              {/* Expanding Outer Ring */}
              <motion.div
                initial={{ scale: 0.8, opacity: 1, borderWidth: "12px" }}
                animate={{ scale: 1.6, opacity: 0, borderWidth: "0px" }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border-rose-500 m-auto h-28 w-28"
              />

              {/* Main Cancel Circle */}
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: [0, 1.2, 1], rotate: 0 }}
                transition={{
                  type: "spring",
                  damping: 12,
                  stiffness: 150,
                  delay: 0.1,
                }}
                className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full bg-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.7)] border-4 border-rose-100 dark:border-rose-900"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                >
                  <X className="h-14 w-14 text-white stroke-[4]" />
                </motion.div>
              </motion.div>
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
                transition={{
                  type: "spring",
                  damping: 12,
                  stiffness: 150,
                  delay: 0.1,
                }}
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
                    y: Math.sin((i * 60 - 30) * (Math.PI / 180)) * 90,
                  }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                  className="absolute m-auto h-3 w-3 bg-emerald-400 rounded-full"
                  style={{
                    left: "50%",
                    top: "50%",
                    marginLeft: "-6px",
                    marginTop: "-6px",
                  }}
                />
              ))}
            </div>
          )}

          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              {currentBookingStatus === "pending"
                ? `Finding Nearby ${providerLabel}...`
                : currentBookingStatus === "cancelled"
                  ? "Booking Cancelled ❌"
                  : `${providerLabel} Assigned! 🎉`}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              {currentBookingStatus === "pending"
                ? `Broadcasting your request to all available ${providerLabelPlural} in your area. Please wait...`
                : currentBookingStatus === "cancelled"
                  ? "This booking request was cancelled by the provider or has expired."
                  : paymentMode === "now"
                    ? `A ${providerLabelLower} has accepted your request! Please check your alerts for a 'Pay Now' notification.`
                    : `A ${providerLabelLower} has accepted your request and is assigned to you.`}
            </p>
          </div>

          <div className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3 text-left shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700/50">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Booking ID
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(bookingId);
                  toast({ title: "Copied!", description: bookingId });
                }}
                className="flex items-center gap-1.5 text-sm font-black text-blue-600 dark:text-blue-400 hover:text-blue-600 dark:text-blue-400/80 transition-colors"
              >
                {bookingId} <Copy className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 mr-4">
                Service
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white text-right line-clamp-2">
                {createdBooking?.serviceName || serviceNames}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 mr-4">
                Location
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-right">
                {createdBooking?.address ||
                  selectedAddress?.address ||
                  "Address unavailable"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Date & Time
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {createdBooking
                  ? createdBooking.bookingDate === "ASAP"
                    ? "ASAP (Within 45m)"
                    : `${createdBooking.bookingDate} • ${createdBooking.bookingTime}`
                  : isExpress
                    ? "ASAP (Within 45m)"
                    : `${selectedDate} • ${selectedTime}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Amount
              </span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                ₹{createdBooking?.totalAmount || total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Payment
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white">
                {createdBooking
                  ? createdBooking.paymentMode === "now"
                    ? "Online (Wait for Acceptance)"
                    : "Pay After Service"
                  : paymentMode === "now"
                    ? "Online (Wait for Acceptance)"
                    : "Pay After Service"}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {currentBookingStatus === "cancelled" ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/home", { replace: true })}
                className="flex-1 rounded-[20px] bg-blue-600 text-white shadow-xl shadow-blue-600/20 hover:shadow-2xl py-4 text-sm font-black transition-all"
              >
                Go to Home
              </motion.button>
            ) : (
              <motion.button
                whileTap={{
                  scale: currentBookingStatus !== "pending" ? 0.97 : 1,
                }}
                onClick={() =>
                  currentBookingStatus !== "pending" &&
                  navigate("/tracking", { replace: true })
                }
                className={`flex-1 rounded-[20px] py-4 text-sm font-black transition-all ${currentBookingStatus !== "pending"
                    ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20 hover:shadow-2xl"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  }`}
              >
                {currentBookingStatus !== "pending"
                  ? "Track Booking"
                  : "Waiting for Provider..."}
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/my-bookings", { replace: true })}
              className="flex-1 rounded-[20px] border-2 border-slate-200 dark:border-slate-700 py-4 text-sm font-extrabold text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800 transition-colors"
            >
              My Bookings
            </motion.button>
          </div>

          {currentBookingStatus === "pending" && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCancelBooking}
              className="w-full mt-3 rounded-[20px] border-2 border-rose-500/20 bg-rose-50 dark:bg-rose-950/20 py-4 text-sm font-black text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" /> Cancel Booking request
            </motion.button>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── MAIN CHECKOUT ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-32 md:pb-12 text-slate-900 dark:text-slate-100">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">

        {/* Header Banner */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-4 md:p-5 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors shadow-sm cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Checkout</h1>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/40 px-2.5 py-0.5 rounded-full">
                  Fast Match
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{serviceNames}</p>
            </div>
          </div>
        </div>

        {/* Service Preference Toggle */}
        {checkoutData.requiredProviderCategory !== 'sewak' && (() => {
          const isHomeVisitDisabled = providerDetails && providerDetails.isHomeVisitAvailable === false;

          return (
            <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-500" /> Where would you like your service?
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  whileTap={{ scale: isHomeVisitDisabled ? 1 : 0.98 }}
                  onClick={() => {
                    if (isHomeVisitDisabled) {
                      toast({
                        title: "Home Visit Unavailable",
                        description: "This provider currently operates for At-Shop visits only.",
                        variant: "destructive"
                      });
                      return;
                    }
                    setServiceLocation("home");
                  }}
                  className={`relative flex flex-col p-4 rounded-2xl border-2 transition-all duration-200 overflow-hidden ${isHomeVisitDisabled
                      ? "opacity-50 border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-100/50 dark:bg-slate-900/30"
                      : serviceLocation === "home"
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-md shadow-emerald-500/10 ring-4 ring-emerald-500/15 cursor-pointer"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer"
                    }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1.5 rounded-xl ${serviceLocation === "home" && !isHomeVisitDisabled ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                      <Home className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white">At Home</h3>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 leading-tight">
                    {isHomeVisitDisabled ? "Not offered by this provider" : "Provider visits your address"}
                  </p>
                </motion.div>

                <motion.div
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setServiceLocation("shop")}
                  className={`relative flex cursor-pointer flex-col p-4 rounded-2xl border-2 transition-all duration-200 overflow-hidden ${serviceLocation === "shop"
                      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-md shadow-emerald-500/10 ring-4 ring-emerald-500/15"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-emerald-300 dark:hover:border-emerald-700"
                    }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1.5 rounded-xl ${serviceLocation === "shop" ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white">At Shop</h3>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 leading-tight">You visit provider shop</p>
                </motion.div>
              </div>
            </section>
          );
        })()}

        {/* Feature Toggles (Express Service Fee) */}
        {EXPRESS_FEE > 0 && (
          <section className="grid grid-cols-2 gap-3">
            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => { setIsExpress(false); }}
              className={`relative flex cursor-pointer flex-col p-4 rounded-3xl border-2 transition-all overflow-hidden ${!isExpress
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-md ring-4 ring-emerald-500/15"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300"
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${!isExpress ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                  <Clock className="h-4 w-4" />
                </div>
                {!isExpress && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />}
              </div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white">Standard Service</h3>
              <p className="text-[10px] font-bold text-slate-500 leading-tight mt-1">Book for scheduled time</p>
            </motion.div>

            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={() => { setIsExpress(true); }}
              className={`relative flex cursor-pointer flex-col p-4 rounded-3xl border-2 transition-all overflow-hidden ${isExpress
                  ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 shadow-md ring-4 ring-amber-500/15"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300"
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${isExpress ? "bg-amber-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                  <Zap className="h-4 w-4" />
                </div>
                {isExpress && <Check className="h-4 w-4 text-amber-600 dark:text-amber-400 stroke-[3]" />}
              </div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white">Express Service</h3>
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-tight mt-1">In 45 mins (+₹{EXPRESS_FEE})</p>
            </motion.div>
          </section>
        )}

        {/* Scheduling Section */}
        <AnimatePresence mode="wait">
          <motion.div key="scheduling" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-5 overflow-hidden">
            <section className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm ${isExpress ? "opacity-40 grayscale-[0.5]" : ""}`}>
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" /> Select Date
                </h2>
                {isExpress && (
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Express Arrival
                  </span>
                )}
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {dates.map((d) => (
                  <motion.button
                    key={d.full}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => {
                      setSelectedDate(d.full);
                      setIsExpress(false);
                    }}
                    className={`flex min-w-[76px] shrink-0 flex-col items-center justify-center rounded-2xl border-2 py-3.5 transition-all duration-150 cursor-pointer ${selectedDate === d.full
                        ? "border-emerald-600 bg-emerald-600 shadow-md shadow-emerald-500/25 text-white"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-700"
                      }`}
                  >
                    <span className="text-[10px] font-bold uppercase opacity-80 mb-1">{d.day}</span>
                    <span className="text-lg font-black">{d.date}</span>
                  </motion.button>
                ))}
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" /> Preferred Time Slot
              </h2>
              {availableSlots.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-center">
                  <p className="text-xs font-bold text-slate-500">No time slots available for this date.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {availableSlots.map((t) => (
                    <motion.button
                      key={t}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedTime(t);
                        setIsExpress(false);
                      }}
                      className={`rounded-2xl py-3 px-2 text-xs font-bold transition-all border cursor-pointer ${selectedTime === t
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-700"
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

        {/* Address Card */}
        <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3.5">
          {serviceLocation === 'shop' ? (
            <div className="text-center py-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-center gap-2">
                <Briefcase className="h-4 w-4 text-emerald-500" /> You will visit the provider's shop
              </h3>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">The provider's full shop address will be shared upon booking confirmation.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-500" /> Service Location
                </h3>
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Change
                </button>
              </div>
              {selectedAddress ? (
                <div className="flex items-center gap-4 pt-1">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                    {selectedAddress.icon === "office" ? <Briefcase className="h-5 w-5" /> : <Home className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedAddress.label}</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-snug truncate">{selectedAddress.address}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Service Address
                </button>
              )}
            </>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Service Notes / Special Instructions</h3>
          <textarea
            placeholder="Any specific directions, landmark notes, or special instructions for your provider..."
            rows={2}
            value={serviceNotes}
            onChange={(e) => setServiceNotes(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 px-4 py-3 text-xs font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 transition-all leading-relaxed"
          />
        </section>

        <>
          {/* Coupon */}
          <section className="relative rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Tag className="h-4 w-4 text-emerald-500" /> Apply Promo Code
              </h3>
              <button
                onClick={() => navigate("/offers")}
                className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:underline transition-all cursor-pointer"
              >
                View Offers
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="ENTER PROMO CODE"
                disabled={couponApplied}
                className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 px-4 py-3 text-xs font-bold uppercase tracking-wider placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 disabled:opacity-50 transition-all"
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={applyCoupon}
                disabled={couponApplied || !coupon}
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {couponApplied ? "Applied ✓" : "Apply"}
              </motion.button>
            </div>
          </section>

          {/* Bargain & Save */}
          <section className="relative rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Tag className="h-4 w-4 text-emerald-500" /> Bargain & Save
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
              Have a budget in mind? Propose a custom customer offer for this service request.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-4 flex items-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  value={customerOffer}
                  onChange={(e) => setCustomerOffer(e.target.value)}
                  placeholder={`Original Price: ₹${subtotal}`}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 pl-8 pr-4 py-3 text-xs font-bold focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 transition-all"
                />
              </div>
              {hasCustomOffer && (
                <button
                  onClick={() => setCustomerOffer("")}
                  className="rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 px-4 py-3 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            {hasCustomOffer && (
              <div className="text-xs font-bold pt-1">
                {isOfferTooLow && (
                  <p className="text-red-500 bg-red-50 dark:bg-red-950/60 px-3 py-2 rounded-xl">Customer Offer is too low! Minimum allowed offer: ₹{minAllowedOffer}.</p>
                )}
                {isOfferTooHigh && (
                  <p className="text-red-500 bg-red-50 dark:bg-red-950/60 px-3 py-2 rounded-xl">Offer cannot exceed ₹{subtotal - couponDiscount} (subtotal after coupon).</p>
                )}
                {isOfferNegative && (
                  <p className="text-red-500 bg-red-50 dark:bg-red-950/60 px-3 py-2 rounded-xl">Offer cannot be negative.</p>
                )}
                {!isOfferInvalid && (
                  <p className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-2 rounded-xl">
                    Offer valid! You save a custom bargain discount of ₹{bargainDiscount} (Total savings: ₹{totalDiscount}).
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Price Summary */}
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              Payment Summary
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal ({checkoutData.items.length} items)</span>
                <span className="font-bold text-slate-900 dark:text-white">₹{subtotal}</span>
              </div>
              {isExpress && (
                <div className="flex justify-between">
                  <span className="font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Zap className="h-3.5 w-3.5" /> Express Fee
                  </span>
                  <span className="font-black text-slate-900 dark:text-white">₹{EXPRESS_FEE}</span>
                </div>
              )}
              {distanceChargeConfig?.enabled && (
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      {providerDetails
                        ? "Travel Charge"
                        : "Estimated Travel Charge (To be finalized by provider)"}
                    </span>
                    {calculatedDistanceKm !== null &&
                      appliedDistanceConfig &&
                      providerDetails && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {calculatedDistanceKm < 0.1 ? "<0.1" : calculatedDistanceKm.toFixed(1)} km
                          {calculatedDistanceKm <=
                            appliedDistanceConfig.baseDistance
                            ? ` (Base fare applied)`
                            : ` (${appliedDistanceConfig.baseDistance}km base + ${(calculatedDistanceKm - appliedDistanceConfig.baseDistance).toFixed(1)}km @ ₹${appliedDistanceConfig.extraFeePerKm}/km)`}
                        </span>
                      )}
                  </div>
                  <span className="font-black text-slate-900 dark:text-white mt-0.5">
                    ₹{estimatedTravelCharge}
                  </span>
                </div>
              )}
              {nightChargeAmount > 0 && (
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold flex items-center gap-1.5 text-indigo-500">
                      <Moon className="h-3.5 w-3.5" /> Night Convenience Charge
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Applied for service timing {nightChargeConfig.startTime} - {nightChargeConfig.endTime}
                    </span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white mt-0.5">
                    ₹{nightChargeAmount}
                  </span>
                </div>
              )}
              {calculatedGstAmount > 0 && (
                <div className="flex justify-between text-sm items-start">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      GST ({gstPercent}%)
                    </span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white mt-0.5">
                    ₹{calculatedGstAmount}
                  </span>
                </div>
              )}
              {platformFee > 0 && (
                <div className="flex justify-between text-sm items-start">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      Platform Fee
                    </span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white mt-0.5">
                    ₹{platformFee}
                  </span>
                </div>
              )}
              {couponApplied && (
                <div className="flex justify-between text-sm text-emerald-500">
                  <span className="font-bold">Coupon Discount</span>
                  <span className="font-black">-₹{couponDiscount}</span>
                </div>
              )}
              {bargainDiscount > 0 && (
                <div className="flex justify-between text-sm text-blue-500">
                  <span className="font-bold">Bargain Discount</span>
                  <span className="font-black">-₹{bargainDiscount}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 font-bold">
                  <span className="font-bold">Total Savings</span>
                  <span className="font-black">-₹{totalDiscount}</span>
                </div>
              )}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between items-center">
                <span className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total To Pay
                </span>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                  ₹{userProposedAmount || total}
                </span>
              </div>
            </div>
          </section>

          {/* Payment Mode Selection */}
          <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Method</h3>
            <div className="flex flex-col gap-3">
              <label className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${paymentMode === 'now'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-4 ring-emerald-500/15'
                  : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-slate-50/40 dark:bg-slate-950/40'
                }`}>
                <input type="radio" name="paymentMode" value="now" checked={paymentMode === 'now'} onChange={() => setPaymentMode('now')} className="hidden" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Pay Online</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Pay securely via UPI / Credit / Debit Cards</p>
                </div>
                {paymentMode === 'now' ? (
                  <div className="h-5 w-5 rounded-full bg-emerald-600 flex items-center justify-center shadow-md">
                    <Check className="h-3 w-3 text-white stroke-[3]" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-700"></div>
                )}
              </label>

              <label className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${paymentMode === 'after'
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-4 ring-emerald-500/15'
                  : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-slate-50/40 dark:bg-slate-950/40'
                }`}>
                <input type="radio" name="paymentMode" value="after" checked={paymentMode === 'after'} onChange={() => setPaymentMode('after')} className="hidden" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Pay After Service</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Pay directly when service is completed</p>
                </div>
                {paymentMode === 'after' ? (
                  <div className="h-5 w-5 rounded-full bg-emerald-600 flex items-center justify-center shadow-md">
                    <Check className="h-3 w-3 text-white stroke-[3]" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-700"></div>
                )}
              </label>
            </div>
          </section>
        </>
      </main>

      {/* Bottom Floating Bar */}
      {(availableSlots.length > 0 || isExpress) && (
        <div className="checkout-bottom-bar fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800 p-4 shadow-2xl md:relative md:bg-transparent md:border-0 md:p-0 md:max-w-2xl md:mx-auto">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleConfirmBooking}
            disabled={isProcessing}
            className={`flex w-full items-center justify-between rounded-2xl py-4 px-6 shadow-xl transition-all duration-200 cursor-pointer ${isProcessing
                ? 'bg-emerald-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-500/25 active:scale-[0.98]'
              }`}
          >
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">
                Total Payable
              </span>
              <span className="text-xl font-black">
                ₹{userProposedAmount || total}
              </span>
            </div>
            <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wider">
              {isProcessing ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Confirm Booking</span>
                  <ArrowLeft className="h-4 w-4 rotate-180 stroke-[2.5]" />
                </>
              )}
            </div>
          </motion.button>
        </div>
      )}

      {/* Modals -> Address Select Modal, Add Address Form, OTP Verification... (Kept identical structures, slightly styled up) */}
      {/* ADDRESS SELECT MODAL */}
      <AnimatePresence>
        {showAddressModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`w-full max-w-md rounded-t-[32px] sm:rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${showNewAddressForm ? "h-full max-h-full sm:max-h-[90vh]" : "max-h-[85vh]"}`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5 shrink-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Select Address
                </h3>
                <button
                  onClick={() => {
                    setShowAddressModal(false);
                    setShowNewAddressForm(false);
                  }}
                  className="rounded-full p-2 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div
                className={`flex-1 min-h-0 p-5 overflow-y-auto ${showNewAddressForm ? "flex flex-col" : "space-y-3"}`}
              >
                {!showNewAddressForm &&
                  addresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => {
                        setSelectedAddress(addr);
                        setShowAddressModal(false);
                      }}
                      className={`w-full flex items-center gap-4 rounded-[20px] border-2 p-4 text-left transition-all ${selectedAddress?.id === addr.id
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 shadow-md shadow-blue-600/5"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800 hover:border-slate-200 dark:border-slate-700/80"
                        }`}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-slate-100 dark:bg-slate-800">
                        {addr.icon === "office" ? (
                          <Briefcase className="h-6 w-6 text-slate-900 dark:text-white" />
                        ) : (
                          <Home className="h-6 w-6 text-slate-900 dark:text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {addr.label}
                        </p>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                          {addr.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedAddress?._id === addr._id && (
                          <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-1">
                            <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          </div>
                        )}
                        <button
                          onClick={(e) => handleDeleteAddress(e, addr._id)}
                          className="p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </button>
                  ))}

                {!showNewAddressForm ? (
                  <button onClick={() => setShowNewAddressForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer mt-2">
                    <Plus className="h-4 w-4" /> Add New Address
                  </button>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col min-h-0 space-y-3.5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 p-4 sm:p-5 mt-0">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">New Address</h4>

                    {isLoaded && (
                      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex-1 relative min-h-[180px]">
                        <GoogleMap
                          mapContainerStyle={{ width: "100%", height: "100%" }}
                          center={
                            newAddress.location
                              ? {
                                lat: newAddress.location.coordinates[1],
                                lng: newAddress.location.coordinates[0],
                              }
                              : center
                          }
                          zoom={15}
                          onClick={onMapClick}
                          options={{
                            disableDefaultUI: true,
                            zoomControl: false,
                          }}
                        >
                          {newAddress.location && (
                            <MarkerF
                              position={{
                                lat: newAddress.location.coordinates[1],
                                lng: newAddress.location.coordinates[0],
                              }}
                            />
                          )}
                        </GoogleMap>
                        <div className="absolute top-2 left-2 right-2">
                          <p className="bg-white/90 dark:bg-slate-900/90 backdrop-blur text-[10px] font-bold text-slate-700 dark:text-slate-200 text-center py-1.5 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-800/50">
                            Tap on map to pin exact service location
                          </p>
                        </div>
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="Label (e.g. Home, Office)"
                      value={newAddress.label}
                      onChange={(e) =>
                        setNewAddress((prev) => ({
                          ...prev,
                          label: e.target.value,
                        }))
                      }
                      className="w-full rounded-[16px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3.5 text-sm font-bold focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                    />
                    <div className="relative">
                      {isLoaded ? (
                        <Autocomplete
                          onLoad={onLoadAutocomplete}
                          onPlaceChanged={onPlaceChanged}
                        >
                          <input
                            type="text"
                            placeholder={
                              isFetchingLocation
                                ? "Detecting location..."
                                : "Search places or type full address"
                            }
                            value={newAddress.address}
                            onChange={(e) =>
                              setNewAddress((prev) => ({
                                ...prev,
                                address: e.target.value,
                              }))
                            }
                            disabled={isFetchingLocation}
                            className="w-full rounded-[16px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 pr-12 text-sm font-medium focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all disabled:opacity-70"
                          />
                        </Autocomplete>
                      ) : (
                        <input
                          type="text"
                          placeholder={
                            isFetchingLocation
                              ? "Detecting location..."
                              : "Search places or type full address"
                          }
                          value={newAddress.address}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              address: e.target.value,
                            }))
                          }
                          disabled={isFetchingLocation}
                          className="w-full rounded-[16px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 pr-12 text-sm font-medium focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all disabled:opacity-70"
                        />
                      )}
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:bg-blue-900/40 transition-colors"
                        title="Detect location"
                      >
                        <Navigation
                          className={`h-4 w-4 ${isFetchingLocation ? "animate-pulse" : ""}`}
                        />
                      </button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setShowNewAddressForm(false)}
                        className="flex-1 rounded-[16px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNewAddress}
                        className="flex-1 rounded-[16px] bg-blue-600 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/20 transition-all hover:shadow-xl"
                      >
                        Save
                      </button>
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
