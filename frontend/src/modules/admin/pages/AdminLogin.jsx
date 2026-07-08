import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";
import { validateEmail, sanitizeEmail } from "@/lib/emailValidation";

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state?.from?.pathname || "/admin") + (location.state?.from?.search || "");
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();

  const isAdminRole = (role) => role === 'admin' || role === 'superadmin' || role === 'supervisor';

  useEffect(() => {
    // Redirect if already logged in via context
    const auth = JSON.parse(localStorage.getItem("rozsewa_auth_admin"));
    if (auth?.token && isAdminRole(auth?.role)) {
      navigate(from);
    }
  }, [navigate, from]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Required", description: "Please enter email and password.", variant: "destructive" });
      return;
    }
    if (!validateEmail(email)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(email, password, 'admin');
      if (res.success) {
        if (!isAdminRole(res.data.role)) {
          toast({ title: "Access Denied", description: "This account is not an admin.", variant: "destructive" });
        } else {
          toast({ title: "Welcome back", description: "Successfully logged in to Admin Panel." });
          navigate(from);
        }
      } else {
        toast({ title: "Invalid Credentials", description: res.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Login Error", description: "Server is unreachable.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] bg-slate-50">
      {/* Left side - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-slate-900 z-0" />
        
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 z-0" />

        <div className="relative z-10">
          <div className="bg-white p-3 rounded-2xl inline-block mb-8">
            <img src="/RozSewa.png" alt="RozSewa" className="h-8 object-contain" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight mb-6">
            Enterprise <br />
            <span className="text-emerald-400">Management</span> Portal
          </h1>
          <p className="text-slate-400 text-lg max-w-md leading-relaxed">
            Secure, centralized control for the RozSewa platform. Oversee providers, manage finances, and orchestrate service delivery with enterprise-grade tools.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-emerald-400/80 text-sm font-medium">
          <ShieldCheck className="h-5 w-5" />
          SOC2 Type II Compliant & End-to-End Encrypted
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 relative">
        <div className="w-full max-w-[420px] space-y-8">
          
          <div className="lg:hidden text-center mb-8">
            <div className="bg-white p-3 rounded-2xl inline-block shadow-sm border border-slate-100 mb-6">
              <img src="/RozSewa.png" alt="RozSewa" className="h-8 object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Admin Login</h2>
            <p className="text-slate-500 mt-2">Sign in to your enterprise dashboard</p>
          </div>

          <div className="hidden lg:block space-y-2 mb-8">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500">Please enter your admin credentials to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                  placeholder="admin@rozsewa.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Password</label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                disabled={isLoading}
                type="submit"
                className="w-full h-12 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Sign In to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>


        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
