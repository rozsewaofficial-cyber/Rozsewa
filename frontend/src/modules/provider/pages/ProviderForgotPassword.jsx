import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ShieldCheck, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProviderForgotPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginType, setLoginType] = useState('partner');
  const [step, setStep] = useState(1); // 1: Mobile, 2: OTP & Password, 3: Success
  const [showOtpError, setShowOtpError] = useState(false);
  const { toast } = useToast();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!mobile || mobile.length !== 10) {
      toast({ title: "Invalid Mobile", description: "Please enter a valid 10-digit mobile number.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Check if user exists
      const { data: existData } = await API.post("/auth/check-existence", { mobile });
      
      if (!existData.exists) {
        toast({ title: "Account Not Found", description: "No account is registered with this number.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // 2. Send OTP
      const { data: otpData } = await API.post("/auth/send-otp", { mobile });
      if (otpData.success) {
        setStep(2);
        toast({ title: "OTP Sent", description: "A verification code has been sent to your mobile." });
      }
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to send OTP", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setShowOtpError(true);
      toast({ title: "Invalid OTP", description: "Please enter a valid 6-digit OTP.", variant: "destructive" });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Weak Password", description: "Password must be at least 6 characters long.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await API.post("/auth/forgot-password", {
        mobile,
        otp,
        newPassword,
        type: "provider" // Since this is the provider portal
      });

      if (data.success) {
        setStep(3);
      }
    } catch (err) {
      toast({ title: "Reset Failed", description: err.response?.data?.message || "Invalid OTP. Please try again.", variant: "destructive" });
      setShowOtpError(true);
    } finally {
      setIsLoading(false);
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
            Reset Password
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60">
            {step === 1 && 'Enter Mobile Number'}
            {step === 2 && 'Verify OTP & Reset'}
            {step === 3 && 'Success'}
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

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6" 
                onSubmit={handleSendOTP}
              >
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
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                        className={`block w-full rounded-2xl border border-slate-200 bg-slate-50/30 py-4 pl-12 pr-4 text-sm font-bold text-slate-900 transition-all outline-none focus:ring-4 ${loginType === 'sewak' ? 'focus:border-blue-500 focus:ring-blue-500/10' : 'focus:border-emerald-500 focus:ring-emerald-500/10'}`}
                        placeholder="99999 00000"
                      />
                    </div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <p className="text-[11px] text-slate-400 font-bold px-1 leading-relaxed">
                      We will send a 6-digit verification code to this number to verify your identity.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`group relative flex w-full justify-center items-center overflow-hidden rounded-2xl h-[58px] text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-70 shadow-xl ${loginType === 'sewak' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <span>Send OTP</span>
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {step === 2 && (
              <motion.form 
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
                onSubmit={handleResetPassword}
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
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setShowOtpError(false);
                    }}
                    required
                    className={`block w-full rounded-2xl border ${showOtpError ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-200'} bg-slate-50/30 py-5 text-center text-2xl font-semibold ${otp ? 'tracking-[0.5em]' : 'tracking-normal'} text-slate-900 transition-all outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10`}
                    placeholder="000000"
                  />
                  {showOtpError && <p className="text-[10px] text-red-500 font-bold mt-2 text-center">Incorrect OTP. Please try again.</p>}
                </div>

                <div className="space-y-2 mt-6">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Secret Password</label>
                  <div className="relative group">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <ShieldCheck className={`h-4 w-4 transition-colors ${loginType === 'sewak' ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-emerald-500'} text-slate-300`} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength="6"
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

                <div className="flex flex-col gap-3 mt-8">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`group relative flex w-full justify-center items-center overflow-hidden rounded-2xl h-[58px] text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-70 shadow-xl ${loginType === 'sewak' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-black text-slate-400 hover:text-slate-600 py-2 transition-colors"
                  >
                    Change Mobile Number
                  </button>
                </div>
              </motion.form>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-4"
              >
                <div className="mx-auto w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Password Reset Successfully!</h3>
                  <p className="text-sm font-bold text-slate-500">Your account is now secure with the new password.</p>
                </div>

                <button
                  onClick={() => navigate('/provider/login')}
                  className="mt-8 group relative flex w-full justify-center items-center overflow-hidden rounded-2xl h-[58px] text-sm font-black text-white transition-all active:scale-[0.98] shadow-xl bg-slate-900 hover:bg-slate-800 shadow-slate-200"
                >
                  <span>Back to Login</span>
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {step === 1 && (
            <div className="mt-8 text-center pt-6 border-t border-slate-50">
              <Link to="/provider/login" className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                Back to Login
              </Link>
            </div>
          )}
        </motion.div>

        <div className="mt-8 flex items-center justify-center gap-6 opacity-40 grayscale pointer-events-none">
          <img src="/RozSewa.png" alt="Security" className="h-4 w-auto brightness-0" />
          <div className="h-3 w-[1px] bg-slate-400" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Secure Dashboard</p>
        </div>
      </div>
    </div>
  );
};

export default ProviderForgotPassword;
