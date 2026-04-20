import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Phone, ShieldCheck, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

const ProviderLogin = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState('partner');
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();

  const [step, setStep] = useState(1);
  const [userOtp, setUserOtp] = useState("");
  const [showOtpError, setShowOtpError] = useState(false);

  const handleVerifyLogin = async (e) => {
    e.preventDefault();
    if (!mobile || !password) {
      toast({ title: "Error", description: "Mobile and password are required", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      if (loginType === 'sewak' && step === 1) {
        // Pre-verify credentials
        const { data } = await API.post("/provider/verify-credentials", { mobile, password });
        if (data.success) {
          setStep(2);
          toast({ title: "OTP Sent", description: "Use 123456 for testing." });
        }
      } else if (loginType === 'sewak' && step === 2) {
        // Verify OTP
        if (userOtp === "123456") {
          const res = await login(mobile, password, "provider");
          if (res.success) {
            toast({ title: "Login Successful", description: `Welcome back!` });
            navigate("/provider");
          } else {
            toast({ title: "Login Failed", description: res.error, variant: "destructive" });
          }
        } else {
          setShowOtpError(true);
          toast({ title: "Invalid OTP", description: "Please enter the correct OTP.", variant: "destructive" });
        }
      } else {
        // Regular Partner Login
        const res = await login(mobile, password, "provider");
        if (res.success) {
          toast({ title: "Login Successful", description: `Welcome back!` });
          navigate("/provider");
        } else {
          toast({ title: "Login Failed", description: res.error, variant: "destructive" });
        }
      }
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || "Verification failed", variant: "destructive" });
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
                    placeholder="Enter 6-digit OTP"
                    className={`block w-full rounded-2xl border ${showOtpError ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-200'} bg-slate-50/30 py-5 text-center text-2xl font-black tracking-[0.5em] text-slate-900 transition-all outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10`}
                  />
                  {showOtpError && <p className="text-[10px] text-red-500 font-bold mt-2 text-center">Incorrect OTP. Please try again.</p>}
                </div>

                <div className="flex items-center justify-center gap-4">
                  <p className="text-xs font-bold text-slate-400">Didn't receive?</p>
                  <button type="button" className="text-xs font-black text-blue-600 hover:underline">Resend OTP</button>
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
    </div>
  );
};

export default ProviderLogin;
