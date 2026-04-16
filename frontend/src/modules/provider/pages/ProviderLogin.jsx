import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Phone, ShieldCheck, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

const ProviderLogin = () => {
  const navigate = useNavigate();
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();

  const handleVerifyLogin = async (e) => {
    e.preventDefault();
    if (!mobile || !password) {
      toast({ title: "Error", description: "Mobile and password are required", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const res = await login(mobile, password, "provider");
    setIsLoading(false);

    if (res.success) {
      toast({ title: "Login Successful", description: `Welcome back, ${res.data.ownerName}!` });
      navigate("/provider");
    } else {
      toast({ title: "Login Failed", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200"
          >
            <Store className="h-8 w-8 text-white" />
          </motion.div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
            Provider Portal
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Sign in to manage your Rozsewa store
          </p>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-3xl bg-white p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100"
        >
          <form className="space-y-6" onSubmit={handleVerifyLogin}>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 ml-1">Registered Mobile</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                    maxLength="10"
                    className="block w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm font-medium transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                    placeholder="Enter mobile number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-semibold text-slate-700">Secret Password</label>
                  <Link to="#" className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">Forgot?</Link>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-11 text-sm font-medium transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                    placeholder="Enter password"
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

            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center items-center overflow-hidden rounded-xl bg-slate-900 px-4 py-4 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-slate-200"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm font-medium text-slate-500">
              Don't have a business account?{" "}
              <Link to="/provider/register" className="text-emerald-600 font-bold hover:underline underline-offset-4">
                Register Now
              </Link>
            </p>
          </div>
        </motion.div>
        
        <p className="mt-8 text-center text-[11px] text-slate-400 font-medium">
          Protected by Rozsewa Security. Terms apply.
        </p>
      </div>
    </div>
  );
};

export default ProviderLogin;
