import { useState, useEffect } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { Link, useNavigate, Navigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Store, Phone, ShieldCheck, ArrowLeft, ArrowRight, Loader2, Eye, EyeOff, X } from "lucide-react";
import logoImg from "@/assets/RozSewa.png";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";
import { validateEmail, sanitizeEmail } from "@/lib/emailValidation";
import { validatePhone, sanitizePhone } from "@/lib/phoneValidation";
import { validateName, sanitizeName, sanitizeNameOnChange } from "@/lib/nameValidation";

const ProviderLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state?.from?.pathname || "/provider") + (location.state?.from?.search || "");
  const [isLoading, setIsLoading] = useState(false);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({ name: '', phone: '', email: '' });
  const [enquiry, setEnquiry] = useState({ name: "", phone: "", service: "", message: "" });

  useScrollLock(showEnquiryModal);
  const [isSubmittingEnquiry, setIsSubmittingEnquiry] = useState(false);

  // Initialize state from sessionStorage if available
  const [mobile, setMobile] = useState(() => sessionStorage.getItem("providerLoginMobile") || "");
  const [password, setPassword] = useState(() => sessionStorage.getItem("providerLoginPassword") || "");
  const [loginType, setLoginType] = useState(() => sessionStorage.getItem("providerLoginType") || 'provider');
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { login, loginWithOTP, user, isAuthenticated, loading } = useAuth();

  // Save to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem("providerLoginMobile", mobile);
    sessionStorage.setItem("providerLoginPassword", password);
    sessionStorage.setItem("providerLoginType", loginType);
  }, [mobile, password, loginType]);

  const [showOtpError, setShowOtpError] = useState(false);

  // If already logged in as provider, redirect to dashboard
  if (!loading && isAuthenticated && user?.role === 'provider') {
    return <Navigate to="/provider" replace />;
  }
  if (!loading && isAuthenticated && user?.role === 'sewak') {
    return <Navigate to="/provider" replace />;
  }

  const handleVerifyLogin = async (e) => {
    e.preventDefault();
    if (!mobile) {
      toast({ title: "Error", description: "Mobile number is required", variant: "destructive" });
      return;
    }
    const phoneValidation = validatePhone(mobile);
    if (!phoneValidation.isValid) {
      toast({ title: "Validation Error", description: phoneValidation.message, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(mobile, password, loginType);

      if (result.success) {
        toast({
          title: "Login Successful",
          description: `Welcome back to the ${loginType === 'sewak' ? 'Sewak' : 'Provider'} Portal!`,
        });

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              await API.put(`/provider/profile`, {
                location: { type: 'Point', coordinates: [longitude, latitude] }
              }, {
                headers: { Authorization: `Bearer ${result.data.token}` }
              });
            } catch (err) { console.error("Location sync failed", err); }
            navigate(from, { replace: true });
          }, () => {
            navigate(from, { replace: true });
          });
        } else {
          navigate(from, { replace: true });
        }
      } else {
        throw new Error(result.error || "Login failed");
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error.response?.data?.message || error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    if (!enquiryForm.name || !enquiryForm.phone || !enquiryForm.email) {
      toast({ title: "Validation Error", description: "All fields are required", variant: "destructive" });
      return;
    }
    const sanitizedName = sanitizeName(enquiryForm.name);
    const nameValidation = validateName(sanitizedName);
    if (!nameValidation.isValid) {
      toast({ title: "Validation Error", description: nameValidation.message, variant: "destructive" });
      return;
    }
    const sanitizedForm = { ...enquiryForm, name: sanitizedName };

    if (!validateEmail(sanitizedForm.email)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    const phoneValidation = validatePhone(sanitizedForm.phone);
    if (!phoneValidation.isValid) {
      toast({ title: "Validation Error", description: phoneValidation.message, variant: "destructive" });
      return;
    }

    setIsSubmittingEnquiry(true);
    try {
      const { data } = await API.post("/public/sewak-enquiry", sanitizedForm);
      if (data.success) {
        toast({
          title: "Enquiry Submitted",
          description: data.message || "We will contact you soon.",
        });
        setShowEnquiryModal(false);
        setEnquiryForm({ name: '', phone: '', email: '' });
      }
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: error.response?.data?.message || "Failed to submit enquiry",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingEnquiry(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f0f9f6] relative overflow-hidden px-4 py-4 md:py-8 font-sans">
      {/* Decorative Accents */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-emerald-100/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50%] h-[50%] bg-teal-100/30 rounded-full blur-[120px] pointer-events-none" />

      {/* Back Button */}
      <button 
        onClick={() => navigate('/')} 
        className="absolute top-6 left-6 h-10 w-10 flex items-center justify-center rounded-full bg-white/50 border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900 shadow-sm transition-all z-10"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto flex h-16 w-36 items-center justify-center rounded-2xl bg-white p-3 shadow-xl shadow-emerald-500/5 border border-slate-50"
          >
            <img
              src={logoImg}
              alt="RozSewa Logo"
              className="h-full w-full object-contain"
            />
          </motion.div>
          <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-900 uppercase">
            {loginType === 'sewak' ? 'Sewak Portal' : 'Partner Portal'}
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
            Enter Credentials
          </p>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-[2.5rem] bg-white p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100"
        >
          <div className="flex bg-slate-100/50 p-1.5 rounded-2xl mb-8 border border-slate-100">
            <button
              onClick={() => setLoginType('provider')}
              className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all tracking-widest ${loginType === 'provider' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ROZSEWA PARTNER
            </button>
            <button
              onClick={() => setLoginType('sewak')}
              className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all tracking-widest ${loginType === 'sewak' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ROZSEWA SEWAK
            </button>
          </div>

          <form className="space-y-6" onSubmit={handleVerifyLogin}>
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                    Mobile Number
                  </label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <span className={`text-sm font-bold transition-colors ${loginType === 'sewak' ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-emerald-500'} text-slate-400`}>+91</span>
                    </div>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(sanitizePhone(e.target.value))}
                      maxLength="10"
                      required
                      className={`block w-full rounded-2xl border border-slate-200 bg-slate-50/30 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 transition-all outline-none focus:ring-4 ${loginType === 'sewak' ? 'focus:border-blue-500 focus:ring-blue-500/10' : 'focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                      placeholder="Enter 10-digit number"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Password
                    </label>
                    {loginType !== 'sewak' && (
                      <Link to={`/provider/forgot-password?type=${loginType}`} className={`text-[10px] font-black hover:underline text-emerald-500`}>
                        FORGOT PASSWORD?
                      </Link>
                    )}
                  </div>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <ShieldCheck className={`h-4 w-4 transition-colors ${loginType === 'sewak' ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-emerald-500'} text-slate-300`} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      maxLength="24"
                      className={`block w-full rounded-2xl border border-slate-200 bg-slate-50/30 py-4 pl-12 pr-12 text-sm font-bold text-slate-900 transition-all outline-none focus:ring-4 ${loginType === 'sewak' ? 'focus:border-blue-500 focus:ring-blue-500/10' : 'focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative flex w-full justify-center items-center overflow-hidden rounded-2xl h-[58px] text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-70 shadow-xl ${loginType === 'sewak' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Account Login</span>
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>

            {loginType === 'sewak' && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs font-bold text-slate-500 mb-2">Want to become a Sewak?</p>
                <button
                  type="button"
                  onClick={() => setShowEnquiryModal(true)}
                  className="text-sm font-black text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Send Enquiry
                </button>
              </div>
            )}
          </form>

          {loginType === 'provider' && (
            <div className="mt-8 text-center pt-6 border-t border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                New to Rozsewa?{" "}
                <Link to="/provider/register" className="text-emerald-600 font-black hover:underline underline-offset-4">
                  Register Store
                </Link>
              </p>
            </div>
          )}

          <div className="mt-6 text-center space-y-2">
            <p className="text-[11px] font-bold text-slate-400">
              Having trouble logging in?{" "}
              <Link to="/provider/support" className={`${loginType === 'sewak' ? 'text-blue-600 hover:text-blue-700' : 'text-emerald-600 hover:text-emerald-700'} font-black hover:underline transition-all`}>
                Contact Support
              </Link>
            </p>
            <p className="text-[10px] font-bold text-slate-400">
              By continuing, you agree to our{" "}
              <Link to="/provider/profile/terms" className="text-slate-600 hover:text-emerald-600 hover:underline transition-colors">Terms & Conditions</Link>
              {" "}and{" "}
              <Link to="/provider/profile/privacy" className="text-slate-600 hover:text-emerald-600 hover:underline transition-colors">Privacy Policy</Link>
            </p>
          </div>
        </motion.div>

        <div className="mt-8 flex items-center justify-center gap-6 opacity-40 grayscale pointer-events-none">
          <img src={logoImg} alt="Security" className="h-4 w-auto brightness-0" />
          <div className="h-3 w-[1px] bg-slate-400" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Secure Dashboard</p>
        </div>
      </div>

      <AnimatePresence>
        {showEnquiryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <button
                  onClick={() => setShowEnquiryModal(false)}
                  className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="mb-6">
                  <h3 className="text-xl font-black text-slate-900">Apply for Sewak</h3>
                  <p className="text-sm text-slate-500 font-medium">Fill out the form and our team will contact you.</p>
                </div>

                <form onSubmit={handleEnquirySubmit} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-black tracking-widest text-slate-400">FULL NAME</label>
                    <input
                      type="text"
                      required
                      value={enquiryForm.name}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, name: sanitizeNameOnChange(e.target.value) })}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black tracking-widest text-slate-400">PHONE NUMBER</label>
                    <input
                      type="tel"
                      required
                      value={enquiryForm.phone}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: sanitizePhone(e.target.value) })}
                      maxLength="10"
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="99999 00000"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black tracking-widest text-slate-400">EMAIL ADDRESS</label>
                    <input
                      type="email"
                      required
                      value={enquiryForm.email}
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, email: sanitizeEmail(e.target.value) })}
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="john@example.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingEnquiry}
                    className="mt-6 w-full rounded-2xl bg-blue-600 py-4 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-70 transition-colors"
                  >
                    {isSubmittingEnquiry ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Submit Enquiry"}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProviderLogin;
