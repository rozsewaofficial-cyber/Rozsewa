import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as LucideIcons from "lucide-react";
import {
  Store, User, Phone, MapPin, Briefcase, ArrowRight, ArrowLeft, Loader2,
  ShieldCheck, CreditCard, Gift, CheckCircle, Navigation, Clock,
  Car, Building, GraduationCap, Home, Utensils, HardHat, Truck, Wrench, Star, FileText, Camera, Image as ImageIcon, ChevronRight, X, Building2,
  Layers, Sparkles, Map, Heart, Smartphone, Lock
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const businessModels = [
  { id: 'shop', label: 'Retail & Shops', icon: Store, description: 'Traditional brick & mortar outlets' },
  { id: 'service_provider', label: 'Service Expert', icon: Sparkles, description: 'Independent professionals' },
  { id: 'taxi', label: 'Logistics / Taxi', icon: Car, description: 'Fleet and transport services' },
  { id: 'hotel', label: 'Hospitality', icon: Building, description: 'Hotels, PG and long stays' },
  { id: 'tutor_doc', label: 'Medical / Tutor', icon: GraduationCap, description: 'Professional consultations' },
  { id: 'property_dealer', label: 'Real Estate', icon: Home, description: 'Brokers and dealers' },
  { id: 'food', label: 'Dining / Food', icon: Utensils, description: 'Cafes and home kitchens' },
  { id: 'labour', label: 'Skilled Labour', icon: HardHat, description: 'Contractors and teams' },
  { id: 'delivery', label: 'Direct Delivery', icon: Truck, description: 'Local courier experts' },
];

const ProviderRegister = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signup } = useAuth();
  const [step, setStep] = useState(1);
  const [coords, setCoords] = useState([0, 0]);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const [categories, setCategories] = useState([]);
  const [fetchingCats, setFetchingCats] = useState(false);

  const [formData, setFormData] = useState({
    mobile: "",
    otp: "",
    businessType: "",
    vendorType: "", // Category ID
    subServices: [],
    ownerName: "",
    shopName: "",
    gst: "",
    kycAadhaar: "",
    kycAadhaarPhoto: "",
    kycAadhaarBackPhoto: "",
    kycPanNumber: "",
    kycPanPhoto: "",
    profileImage: "",
    serviceRadius: "5",
    registrationType: "individual",
    referredBy: "",
    address: "",
    city: "",
    state: "",
    password: "",
    bankDetails: {
      accountNumber: "",
      ifscCode: "",
      bankName: "",
      accountHolderName: "",
    }
  });

  const formDataRef = useRef(formData);
  const coordsRef = useRef(coords);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  const [referredByName, setReferredByName] = useState("");
  const [verifyingReferral, setVerifyingReferral] = useState(false);

  useEffect(() => {
    const verifyCode = async () => {
      if (formData.referredBy && formData.referredBy.length >= 5) {
        setVerifyingReferral(true);
        try {
          const { data } = await API.get(`/public/verify-referral/${formData.referredBy}`);
          setReferredByName(data.name);
        } catch (err) {
          setReferredByName("");
        } finally {
          setVerifyingReferral(false);
        }
      } else {
        setReferredByName("");
      }
    };

    const timer = setTimeout(verifyCode, 600);
    return () => clearTimeout(timer);
  }, [formData.referredBy]);

  const [generatedCode, setGeneratedCode] = useState("");
  const [cardConfig, setCardConfig] = useState({ enabled: true, price: 99 });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await API.get("/public/config");
        if (data.registrationPrice) {
          setCardConfig(prev => ({ ...prev, price: data.registrationPrice }));
        }
      } catch (err) {
        console.error("Failed to fetch register config:", err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setFetchingCats(true);
    try {
      const { data } = await API.get("/provider/categories");
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setFetchingCats(false);
    }
  };

  const fetchLocation = () => {
    if ("geolocation" in navigator) {
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await response.json();
            if (data && data.display_name) {
              const addr = data.address || {};
              setCoords([longitude, latitude]);
              setFormData(prev => ({
                ...prev,
                address: data.display_name,
                city: addr.city || addr.town || addr.village || "",
                state: addr.state || ""
              }));
            }
          } catch (err) {
            console.error("Error fetching address:", err);
          } finally {
            setIsFetchingLocation(false);
          }
        },
        () => {
          setIsFetchingLocation(false);
          toast({ title: "Location Error", description: "Enable location permissions.", variant: "destructive" });
        }
      );
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const upData = new FormData();
    upData.append("image", file);
    setIsUploading(true);
    try {
      const { data } = await API.post("/upload", upData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setFormData({ ...formData, [type]: data.url });
      toast({ title: "Photo Uploaded" });
    } catch { toast({ title: "Upload Failed", variant: "destructive" }); }
    finally { setIsUploading(false); }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!formData.mobile || formData.mobile.length < 10) {
      toast({ title: "Invalid Number", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await API.post("/provider/check-existence", { mobile: formData.mobile });
      if (data.exists) {
        toast({ title: "Already Registered", description: "Use another number or login.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      setOtpSent(true);
      toast({ title: "OTP Sent" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const currentCategory = categories.find(c => c._id === formData.vendorType);

  const toggleSubService = (service) => {
    setFormData(prev => ({
      ...prev,
      subServices: prev.subServices.includes(service)
        ? prev.subServices.filter(s => s !== service)
        : [...prev.subServices, service]
    }));
  };

  const handleSignupComplete = async (response) => {
    try {
      setIsLoading(true);
      const { data: verifyRes } = await API.post("/payment/verify", response);
      if (verifyRes.success) {
        const finalData = {
          ...formDataRef.current,
          location: { type: 'Point', coordinates: coordsRef.current }
        };
        const signupRes = await signup(finalData, 'provider');
        if (signupRes.success) {
          setGeneratedCode(signupRes.data.vendorCode);
          setStep(10);
        } else {
          toast({
            title: "Signup Failed",
            description: `${signupRes.error} (Data: ${formDataRef.current.city}, ${formDataRef.current.state})`,
            variant: "destructive"
          });
        }
      } else {
        toast({ title: "Payment Failed", description: "Verification mismatch.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBankSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await API.put("/provider/profile", { bankDetails: formData.bankDetails });
      toast({ title: "Bank Details Saved", description: "You are all set!" });
      setStep(10);
    } catch (err) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!window.Razorpay) return;

    // Last minute validation
    if (!formData.city || !formData.state || !formData.address) {
      toast({ title: "Details Missing", description: "Please go back and fill your address details.", variant: "destructive" });
      setStep(5);
      return;
    }

    setIsLoading(true);
    try {
      const { data: order } = await API.post("/payment/order", { amount: cardConfig.price });
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa",
        order_id: order.id,
        handler: handleSignupComplete,
        prefill: { contact: formData.mobile },
        theme: { color: "#059669" },
        modal: { ondismiss: () => setIsLoading(false) }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast({ title: "Payment Error", variant: "destructive" });
      setIsLoading(false);
    }
  };

  const stepTitles = [
    "Verify Mobile", "Business Type", "Select Industry", "Add Services",
    "Business Profile", "Identity Photo", "Referral", "Bank Details", "Pro Account", "Success"
  ];

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f0f9f6] relative overflow-hidden px-4 py-4 md:py-8">
      {/* Decorative Accents */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-100/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50%] h-[50%] bg-teal-100/30 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto flex h-20 w-40 items-center justify-center rounded-[24px] bg-white p-3 shadow-xl shadow-emerald-500/5 border border-slate-50"
          >
            <img
              src="/RozSewa.png"
              alt="RozSewa Logo"
              className="h-full w-full object-contain"
            />
          </motion.div>

          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">{stepTitles[step - 1]}</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full">
                {step < 10 ? `Step ${step} of 9` : 'Completed'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="max-w-[240px] mx-auto h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(step / 10) * 100}%` }}
              className="h-full bg-emerald-500 rounded-full"
            />
          </div>
        </div>

        <motion.div
          layout
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative rounded-[2rem] border border-slate-100 bg-white p-6 md:p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-800">Verify your mobile</h3>
                  <p className="text-sm text-slate-500">We will send a code to confirm your registration.</p>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">Mobile Number</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <input
                        type="tel"
                        required
                        value={formData.mobile}
                        onChange={e => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '') })}
                        maxLength="10"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 font-semibold text-base tracking-widest text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-300"
                        placeholder="00000 00000"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full group mt-4 h-12 rounded-lg bg-slate-900 text-white font-bold transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 overflow-hidden relative"
                  >
                    <AnimatePresence mode="wait">
                      {isLoading ? (
                        <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </motion.div>
                      ) : (
                        <motion.div key="text" className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <span>Send Code</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </form>

                {otpSent && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    onSubmit={e => { e.preventDefault(); setStep(2); }}
                    className="space-y-6 pt-8 border-t border-slate-100"
                  >
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-700 text-center block uppercase tracking-wider">Authentication Code</label>
                      <input
                        type="text"
                        required
                        value={formData.otp}
                        onChange={e => setFormData({ ...formData, otp: e.target.value })}
                        maxLength="6"
                        className="w-full text-center tracking-[0.4em] rounded-lg border border-emerald-500 bg-white py-2.5 text-xl font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-slate-200"
                        placeholder="••••••"
                      />
                    </div>
                    <button type="submit" className="w-full h-12 rounded-lg border-2 border-emerald-500 text-emerald-600 font-bold hover:bg-emerald-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                      <Lock className="h-5 w-5" />
                      Verify Security Code
                    </button>
                  </motion.form>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-800">Business Model</h3>
                  <p className="text-sm text-slate-500">How would you like to operate your business?</p>
                  <div className="space-y-4">
                    <div className="flex border border-slate-100 rounded-lg p-1 bg-slate-50/50">
                      {['Individual', 'Business'].map(type => (
                        <button
                          key={type}
                          onClick={() => setFormData({ ...formData, type: type.toLowerCase(), shopName: type === 'Individual' ? "" : formData.shopName })}
                          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${formData.type === type.toLowerCase() ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {businessModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setFormData({ ...formData, businessType: m.id }); setStep(3); }}
                      className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/5 transition-all text-left group"
                    >
                      <div className="h-12 w-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all shadow-sm">
                        <m.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800 tracking-tight">{m.label}</p>
                        <p className="text-[11px] font-medium text-slate-500 group-hover:text-emerald-700/70 transition-colors uppercase tracking-wide mt-0.5">{m.description}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="w-full py-4 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-[0.2em] transition-colors"
                >
                  Back to Identification
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep(2)} className="p-3 bg-slate-50 border border-slate-100 rounded-lg hover:bg-white hover:border-emerald-500 transition-all text-slate-500">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="space-y-0.5">
                    <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Select Industry</h3>
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Target Market</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar pb-4">
                  {fetchingCats ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-500 opacity-20" />
                      <p className="text-xs font-bold text-slate-400 animate-pulse">Synchronizing Markets...</p>
                    </div>
                  ) : categories.map(c => (
                    <button
                      key={c._id}
                      onClick={() => { setFormData({ ...formData, vendorType: c._id, subServices: [] }); setStep(4); }}
                      className="flex flex-col items-center p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden h-full"
                    >
                      <div className="h-12 w-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center mb-3 text-emerald-600 shadow-sm group-hover:scale-110 transition-transform relative overflow-hidden">
                        {c.image ? (
                          <img src={c.image} alt={c.name} className="h-full w-full object-cover" />
                        ) : (
                          (() => {
                            const Icon = LucideIcons[c.icon] || LucideIcons.Layers;
                            return <Icon className="h-6 w-6" />;
                          })()
                        )}
                        <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors" />
                      </div>
                      <span className="text-[10px] font-bold uppercase text-center leading-tight tracking-tight text-slate-600 px-1 group-hover:text-slate-900 line-clamp-2">{c.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep(3)} className="p-3 bg-slate-50 border border-slate-100 rounded-lg hover:bg-white hover:border-emerald-500 transition-all text-slate-500">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="space-y-0.5">
                    <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Add Services</h3>
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">{currentCategory?.name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {currentCategory?.services.map(s => (
                    <button
                      key={s.name}
                      onClick={() => toggleSubService(s.name)}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${formData.subServices.includes(s.name)
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-inner'
                        : 'border-slate-100 bg-slate-50/30 hover:border-emerald-200 hover:bg-white'
                        }`}
                    >
                      <div className="flex flex-col items-start space-y-1">
                        <span className={`text-[13px] font-bold tracking-tight ${formData.subServices.includes(s.name) ? 'text-emerald-900' : 'text-slate-800'}`}>
                          {s.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Starting ₹{s.basePrice}
                          </span>
                        </div>
                      </div>
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all shadow-sm ${formData.subServices.includes(s.name)
                        ? 'bg-emerald-600 text-white scale-110'
                        : 'bg-white text-slate-300'
                        }`}>
                        {formData.subServices.includes(s.name) ? <CheckCircle className="h-5 w-5" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />}
                      </div>
                    </button>
                  ))}
                  {(!currentCategory?.services || currentCategory.services.length === 0) && (
                    <div className="py-20 text-center space-y-4">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl inline-block">
                        <Star className="h-8 w-8 text-slate-200" />
                      </div>
                      <p className="text-sm font-medium text-slate-400 italic">No services listed for this category yet.</p>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => setStep(5)}
                    disabled={formData.subServices.length === 0}
                    className="w-full h-12 rounded-lg bg-slate-900 text-white font-bold transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10"
                  >
                    Continue to Profile
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-center text-[10px] font-medium text-slate-400 mt-4 uppercase tracking-[0.2em]">Select at least one expertise</p>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.form
                key="s5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={e => {
                  e.preventDefault();
                  if (formData.kycAadhaarPhoto && formData.kycAadhaarBackPhoto && formData.kycPanPhoto) setStep(6);
                  else toast({ title: "Documents Required", description: "Please upload Aadhaar (Front & Back) and PAN photos.", variant: "destructive" });
                }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Owner Full Name</label>
                      <input required value={formData.ownerName} onChange={e => setFormData({ ...formData, ownerName: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none placeholder:text-slate-300" placeholder="e.g. John Doe" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Business Name</label>
                      <input required value={formData.shopName} onChange={e => setFormData({ ...formData, shopName: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none placeholder:text-slate-300" placeholder="e.g. Sharma Experts" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Aadhaar Number</label>
                      <input required value={formData.kycAadhaar} onChange={e => setFormData({ ...formData, kycAadhaar: e.target.value.toUpperCase() })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none placeholder:text-slate-300" placeholder="12-Digit Aadhaar No" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">PAN Number</label>
                      <input required value={formData.kycPanNumber} onChange={e => setFormData({ ...formData, kycPanNumber: e.target.value.toUpperCase() })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none uppercase placeholder:text-slate-300" placeholder="PAN Number" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">GST Number (Opt)</label>
                      <input value={formData.gst} onChange={e => setFormData({ ...formData, gst: e.target.value.toUpperCase() })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none uppercase placeholder:text-slate-300" placeholder="GST" />
                    </div>
                  </div>

                  <div className="space-y-1.5 group">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Create Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                      <input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 font-bold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none placeholder:text-slate-300" placeholder="Enter a strong password" />
                    </div>
                  </div>

                  <div className="pt-2 space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Document Evidence</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {['kycAadhaarPhoto', 'kycAadhaarBackPhoto', 'kycPanPhoto'].map(type => (
                        <label key={type} className={`relative group flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden ${formData[type] ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50 hover:border-emerald-200'}`}>
                          <input type="file" className="hidden" onChange={e => handleFileUpload(e, type)} />
                          {formData[type] ? (
                            <img src={formData[type]} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center space-y-2 text-center p-2">
                              {isUploading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-500" /> : <Camera className="h-6 w-6 text-slate-300 group-hover:text-emerald-500 transition-colors" />}
                              <span className="text-[8px] font-bold uppercase text-slate-400 group-hover:text-emerald-600 transition-colors">
                                {type === 'kycAadhaarPhoto' ? 'Aadh-Front' : type === 'kycAadhaarBackPhoto' ? 'Aadh-Back' : 'PAN Card'}
                              </span>
                            </div>
                          )}
                          {formData[type] && !isUploading && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Business Address</label>
                      <button type="button" onClick={fetchLocation} className="text-[10px] font-bold text-emerald-600 uppercase hover:underline flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Auto-Locate
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" placeholder="State" value={formData.state} onChange={e => setFormData(prev => ({ ...prev, state: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-xs text-slate-900 placeholder:text-slate-300" />
                      <input type="text" placeholder="City" value={formData.city} onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-xs text-slate-900 placeholder:text-slate-300" />
                    </div>
                    <textarea
                      required
                      value={formData.address}
                      onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-xs text-slate-900 min-h-[80px] outline-none focus:bg-white focus:border-emerald-500 transition-all placeholder:text-slate-300"
                      placeholder="Full physical address..."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <button type="submit" disabled={isUploading} className="w-full h-12 rounded-lg bg-slate-900 text-white font-bold transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-slate-900/10 uppercase tracking-widest text-xs">
                    {isUploading ? 'Securing Media...' : 'Finalize Profile'}
                  </button>
                  <button type="button" onClick={() => setStep(4)} className="w-full text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Previous Step</button>
                </div>
              </motion.form>
            )}

            {step === 6 && (
              <motion.div
                key="s6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center space-y-8 py-4"
              >
                <div className="relative mx-auto w-40 h-40">
                  <motion.div
                    initial={{ rotate: 10 }}
                    animate={{ rotate: 0 }}
                    className={`w-full h-full rounded-2xl border-4 border-dashed flex items-center justify-center bg-slate-50 overflow-hidden relative shadow-inner ${formData.profileImage ? 'border-emerald-500 bg-white' : 'border-slate-200'}`}
                  >
                    {formData.profileImage ? (
                      <img src={formData.profileImage} className="w-full h-full object-cover scale-110" />
                    ) : (
                      <div className="flex flex-col items-center space-y-3">
                        <User className="h-16 w-16 text-slate-200" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Selfie</span>
                      </div>
                    )}
                  </motion.div>
                  <label className="absolute -bottom-4 -right-4 h-14 w-14 bg-slate-950 rounded-xl flex items-center justify-center text-white cursor-pointer shadow-2xl border-4 border-white transition-all hover:scale-110 active:scale-90 active:rotate-12 group">
                    <input type="file" className="hidden" onChange={e => handleFileUpload(e, 'profileImage')} />
                    {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6 group-hover:text-emerald-400 transition-colors" />}
                  </label>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Final Verification Photo</h3>
                  <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">Please capture a clear portrait. This helps build trust with your future customers.</p>
                </div>

                <div className="space-y-4 pt-6">
                  <button
                    onClick={() => setStep(7)}
                    disabled={!formData.profileImage}
                    className="w-full h-12 rounded-lg bg-slate-900 text-white font-bold transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-slate-900/10 uppercase tracking-widest text-xs"
                  >
                    Save & Continue
                  </button>
                  <button onClick={() => setStep(5)} className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Information Review</button>
                </div>
              </motion.div>
            )}

            {step === 7 && (
              <motion.div
                key="s7"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Referral Program</h3>
                  <p className="text-sm text-slate-500">Were you invited by someone or a member of our team?</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'individual', label: 'Self Registration', icon: User, tag: 'Direct' },
                    { id: 'vendor_referral', label: 'Partner Referral', icon: Store, tag: 'Via Vendor' },
                    { id: 'employee', label: 'Expert Assisted', icon: Briefcase, tag: 'RozSewa Agent' }
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setFormData({ ...formData, registrationType: type.id, referredBy: "" })}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${formData.registrationType === type.id
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                        : 'border-slate-100 bg-slate-50/30 hover:bg-white hover:border-emerald-200'
                        }`}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${formData.registrationType === type.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-slate-300 border border-slate-100'
                        }`}>
                        <type.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold tracking-tight ${formData.registrationType === type.id ? 'text-emerald-900' : 'text-slate-700'}`}>{type.label}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{type.tag}</p>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${formData.registrationType === type.id ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200'
                        }`}>
                        {formData.registrationType === type.id && <CheckCircle className="h-3 w-3" />}
                      </div>
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {formData.registrationType !== 'individual' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-slate-900 rounded-2xl p-6 text-white space-y-4 shadow-2xl"
                    >
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Identification Code</h4>
                        <p className="text-[11px] text-slate-400 italic">Enter the referral or employee ID provided to you.</p>
                      </div>

                      <div className="relative">
                        <input
                          required
                          value={formData.referredBy || ""}
                          onChange={e => setFormData({ ...formData, referredBy: e.target.value.toUpperCase() })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 py-3 px-4 font-black text-xl text-center tracking-[0.3em] text-emerald-400 focus:bg-white/10 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-white/10"
                          placeholder="RS____"
                        />
                        {verifyingReferral && (
                          <div className="absolute right-5 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                          </div>
                        )}
                      </div>

                      {referredByName && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                          <span className="text-[10px] font-bold text-emerald-50 uppercase">Verified: {referredByName}</span>
                        </motion.div>
                      )}

                      <div className="pt-2 flex items-center gap-2 opacity-60">
                        <Gift className="h-3 w-3 text-emerald-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wide">3 Services Commission-Free Applied</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4 pt-4">
                  <button
                    onClick={() => {
                      if (formData.registrationType !== 'individual' && !formData.referredBy) {
                        toast({ title: "Incomplete", description: "Please enter the required code.", variant: "destructive" });
                        return;
                      }
                      setStep(8);
                    }}
                    className="w-full h-12 rounded-lg bg-slate-900 text-white font-bold transition-all hover:bg-slate-800 active:scale-[0.98] shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3"
                  >
                    Proceed to Bank Details
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button onClick={() => setStep(6)} className="w-full text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Previous Step</button>
                </div>
              </motion.div>
            )}

            {step === 8 && (
              <motion.div
                key="s8"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Standard Settlement Bank</h3>
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Payout Details</p>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); setStep(9); }} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Account Holder Name</label>
                    <input required value={formData.bankDetails.accountHolderName} onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, accountHolderName: e.target.value } })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none" placeholder="As per bank records" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Account Number</label>
                    <input required value={formData.bankDetails.accountNumber} onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, accountNumber: e.target.value } })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none" placeholder="Bank Account Number" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">IFSC Code</label>
                      <input required value={formData.bankDetails.ifscCode} onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, ifscCode: e.target.value.toUpperCase() } })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none uppercase" placeholder="IFSC" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Bank Name</label>
                      <input required value={formData.bankDetails.bankName} onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, bankName: e.target.value } })} className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 transition-all outline-none" placeholder="Bank Name" />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                    <div className="h-10 w-10 flex-shrink-0 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <p className="text-[10px] font-medium text-slate-500 leading-relaxed uppercase tracking-widest">Double check your details. Settlements will be sent to this account weekly.</p>
                  </div>

                  <button
                    type="submit"
                    className="w-full h-14 rounded-xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs transition-all hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    Continue to Payment <ArrowRight className="h-4 w-4" />
                  </button>
                  <div className="flex flex-col items-center gap-2">
                    <button type="button" onClick={() => setStep(9)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600 transition-colors">Skip for now</button>
                    <button type="button" onClick={() => setStep(7)} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors">Previous</button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 9 && (
              <motion.form
                key="s9"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handlePayment}
                className="space-y-6 py-2"
              >
                <div className="relative rounded-2xl bg-slate-950 p-8 text-white shadow-2xl overflow-hidden border border-white/5">
                  <div className="absolute -top-12 -right-12 h-32 w-32 bg-emerald-500 rounded-full blur-[80px] opacity-20"></div>
                  <div className="absolute -bottom-12 -left-12 h-32 w-32 bg-emerald-500 rounded-full blur-[60px] opacity-10"></div>

                  <div className="relative space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1 flex items-center gap-1.5">
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Security Verified</span>
                      </div>
                      <div className="h-10 w-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-white/40" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold tracking-tight">Expert Partner <span className="text-emerald-500">Tier</span></h3>
                      <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Activation Subscription</p>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black italic">₹{cardConfig.price}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">One-Time Fee</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 bg-white/5 rounded-2xl p-5 border border-white/10">
                      {[
                        { text: "Permanent Expert Badge", color: "emerald-400" },
                        { text: "Priority Business Queue", color: "emerald-400" },
                        { text: "24/7 Premium Support", color: "emerald-400" }
                      ].map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <CheckCircle className={`h-3 w-3 text-${f.color}`} />
                          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-tight">{f.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 rounded-lg bg-emerald-600 text-white font-bold transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 relative overflow-hidden group"
                  >
                    <AnimatePresence mode="wait">
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <motion.div key="pay-text" className="flex items-center gap-3">
                          <span>Activate My Account</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                  <div className="flex flex-col items-center gap-4">
                    <button type="button" onClick={() => setStep(8)} className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Previous</button>
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Lock className="h-3 w-3" /> Encrypted Payment Gateway
                    </p>
                  </div>
                </div>
              </motion.form>
            )}

            {step === 10 && (
              <motion.div
                key="s10"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8 py-6 text-center"
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="h-24 w-24 bg-emerald-50 rounded-[2.5rem] flex items-center justify-center shadow-lg shadow-emerald-100 border border-emerald-100">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 12 }}
                    >
                      <CheckCircle className="h-12 w-12 text-emerald-500" />
                    </motion.div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Application Sent</h3>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Verification in progress</p>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden text-left shadow-2xl">
                  <div className="absolute -top-10 -right-10 h-24 w-24 bg-emerald-500 rounded-full blur-[60px] opacity-20"></div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 opacity-60">Partner Identity Code</p>
                  <p className="text-4xl font-black font-mono tracking-widest text-emerald-400">{generatedCode}</p>
                  <p className="text-[9px] text-slate-400 italic mt-4">Save this code for your initial login and support inquiries.</p>
                </div>

                <div className="space-y-4">
                  <Link to="/provider/login" className="flex h-14 w-full items-center justify-center gap-3 bg-slate-100 text-slate-800 rounded-xl font-bold hover:bg-slate-900 hover:text-white transition-all active:scale-[0.98] group">
                    Enter Expert Dashboard
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <p className="text-[10px] text-slate-400 leading-relaxed max-w-[280px] mx-auto uppercase font-bold tracking-wider">Our team will verify your credentials within 24 hours.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #10b981; border-radius: 10px; }
      `}} />
    </div >
  );
};

export default ProviderRegister;
