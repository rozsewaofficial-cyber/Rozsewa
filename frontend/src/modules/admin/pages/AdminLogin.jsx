import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ShieldCheck, Mail, Lock, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  useEffect(() => {
    // Redirect if already logged in via context
    const auth = JSON.parse(localStorage.getItem("rozsewa_auth_admin"));
    if (auth?.token && auth?.role === 'admin') {
      navigate("/admin");
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Required", description: "Please enter email and password.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(email, password, 'admin');
      if (res.success) {
        if (res.data.role !== 'admin') {
          toast({ title: "Access Denied", description: "This account is not an admin.", variant: "destructive" });
        } else {
          toast({ title: "Welcome back", description: "Successfully logged in to Admin Panel." });
          navigate("/admin");
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#fdfdfd] px-4 py-8 md:py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto flex h-20 w-40 items-center justify-center rounded-2xl bg-white p-3 shadow-xl shadow-emerald-500/5 border border-slate-50"
          >
            <img src="/RozSewa.png" alt="RozSewa Logo" className="h-full w-full object-contain" />
          </motion.div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Admin Terminal</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Authorized Access Only</p>
          </div>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative rounded-[2rem] border border-slate-100 bg-white p-8 md:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] overflow-hidden"
        >
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Email Terminal</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-300"
                    placeholder="admin@rozsewa.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1">Secure Key</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-5 font-semibold text-sm text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none placeholder:text-slate-300"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={isLoading}
                type="submit"
                className="w-full h-14 rounded-xl bg-slate-950 text-white font-bold transition-all hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-slate-900/10 flex items-center justify-center gap-3 group"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Initialize Admin Session
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </motion.button>
            </div>
          </form>

          <div className="mt-8 border-t border-slate-50 pt-6">
            <div className="flex flex-col items-center gap-1.5 opacity-40">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                RozSewa Infrastructure v3.0<br />End-to-End Encryption Enabled
              </p>
            </div>
          </div>
        </motion.div>

        <p className="text-center">
          <Link to="/provider/login" className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-emerald-600 transition-colors">
            Switch to Provider Portal
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
