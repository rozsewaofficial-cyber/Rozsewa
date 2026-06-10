import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Store, Phone, ShieldCheck, ArrowRight, Loader2, Eye, EyeOff, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import API from "@/lib/api";

const ProviderLogin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({ name: '', phone: '', email: '' });
  const [isSubmittingEnquiry, setIsSubmittingEnquiry] = useState(false);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState('partner');
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { login, loginWithOTP } = useAuth();

  const [step, setStep] = useState(1);
  const [userOtp, setUserOtp] = useState("");
  const [showOtpError, setShowOtpError] = useState(false);

  const handleVerifyLogin = async (e) => {
    e.preventDefault();
    if (!mobile) {
      toast({ title: "Error", description: "Mobile number is required", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      if (step === 1) {
        // Step 1: Verify Password first
        const { data: verifyRes } = await API.post("/auth/verify-credentials", { mobile, password, type: "provider" });

        if (verifyRes.success) {
          // Credentials OK, now Send actual OTP
          const { data } = await API.post("/auth/send-otp", { mobile });
          if (data.success) {
            setStep(2);
            toast({ title: "OTP Sent", description: "Credentials verified. Please enter the code sent to your mobile." });
          } else {
             toast({ title: "Error", description: data.message || "Failed to send OTP", variant: "destructive" });
          }
        }
      } else if (step === 2) {
        if (!userOtp) {
          toast({ title: "Error", description: "Please enter the OTP.", variant: "destructive" });
          setIsLoading(false);
          return;
        }

        const { data } = await API.post("/auth/verify-otp", {
          mobile,
          otp: userOtp,
          role: loginType
        });

        if (data.success) {
          login(data.data.user, data.data.token);
          
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
                });
              } catch (err) { console.error("Location sync failed", err); }
              navigate("/provider", { replace: true });
            }, () => {
              navigate("/provider", { replace: true });
            });
          } else {
            navigate("/provider", { replace: true });
          }
        }
      }
    } catch (error) {
      if (step === 2) setShowOtpError(true);
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

    setIsSubmittingEnquiry(true);
    try {
      const { data } = await API.post("/public/sewak-enquiry", enquiryForm);
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

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto flex h-16 w-36 items-center justify-center rounded-2xl bg-white p-3 shadow-xl shadow-emerald-500/5 border border-slate-50"
          >
            <img
              src="/RozSewa.png"
              alt="RozSewa Logo"
              className="h-full w-full object-contain"
            />
          </motion.div>
          <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-900 uppercase">
            {loginType === 'sewak' ? 'Sewak Portal' : 'Partner Portal'}
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
            {step === 1 ? 'Enter Credentials' : 'Verify Identity'}
          </p>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-[2.5rem] bg-white p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100"
        >
          {step === 1 && (
            <div className="flex bg-slate-100/50 p-1.5 rounded-2xl mb-8 border border-slate-100">
              <button
                onClick={() => setLoginType('partner')}
                className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all tracking-widest ${loginType === 'partner' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
          )}

          <form className="space-y-6" onSubmit={handleVerifyLogin}>
            {step === 1 ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Registered Mobile</label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Phone className={`h-4 w-4 transition-colors ${loginType === 'sewak' ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-emerald-500'} text-slate-300`} />
                    </div>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                      maxLength="10"
                      className={`block w-full rounded-2xl border border-slate-200 bg-slate-50/30 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 transition-all outline-none focus:ring-4 ${loginType === 'sewak' ? 'focus:border-blue-500 focus:ring-blue-500/10' : 'focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                      placeholder="99999 00000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Secret Password</label>
                    <Link to="/provider/forgot-password" className={`text-[10px] font-bold ${loginType === 'sewak' ? 'text-blue-500 hover:text-blue-600' : 'text-emerald-500 hover:text-emerald-600'} hover:underline tracking-wider`}>
                      FORGOT PASSWORD?
                    </Link>
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
            ) : (
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <Phone className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Verify OTP</h3>
                  <p className="text-xs font-bold text-slate-400">Sent to +91 {mobile.slice(0, 5)} {mobile.slice(5)}</p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={userOtp}
                    onChange={(e) => {
                      setUserOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setShowOtpError(false);
                    }}
                    className={`block w-full rounded-2xl border ${showOtpError ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-200'} bg-slate-50/30 py-5 text-center text-2xl font-semibold ${userOtp ? 'tracking-[0.5em]' : 'tracking-normal'} text-slate-900 transition-all outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10`}
                    placeholder="000000"
                  />
                  {showOtpError && <p className="text-[10px] text-red-500 font-bold mt-2 text-center">Incorrect OTP. Please try again.</p>}
                </div>
              </motion.div>
            )}

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
                    <span>{step === 1 ? 'Account Login' : 'Complete Verification'}</span>
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-black text-slate-400 hover:text-slate-600 py-2 transition-colors"
                >
                  Change Mobile or Password
                </button>
              )}
            </div>

            {loginType === 'sewak' && step === 1 && (
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

          {loginType === 'partner' && step === 1 && (
            <div className="mt-8 text-center pt-6 border-t border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                New to Rozsewa?{" "}
                <Link to="/provider/register" className="text-emerald-600 font-black hover:underline underline-offset-4">
                  Register Store
                </Link>
              </p>
            </div>
          )}
        </motion.div>

        <div className="mt-8 flex items-center justify-center gap-6 opacity-40 grayscale pointer-events-none">
          <img src="/RozSewa.png" alt="Security" className="h-4 w-auto brightness-0" />
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
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, name: e.target.value })}
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
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
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
                      onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
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
