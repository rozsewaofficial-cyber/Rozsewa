import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Loader2, Eye, EyeOff } from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const STORAGE_KEY = "rozsewa_auth_trainer";

const TrainerLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(mobile)) {
      return toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
    }
    if (!password) {
      return toast({ title: "Enter your password", variant: "destructive" });
    }

    setLoading(true);
    try {
      const { data } = await API.post("/trainer/login", { mobile, password });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token, trainer: data }));
      toast({ title: `Welcome, ${data.name}` });
      navigate("/trainer/sessions", { replace: true });
    } catch (err) {
      toast({
        title: "Login failed",
        description: err.response?.data?.message || "Could not sign in.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50">
          <GraduationCap className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="text-center text-xl font-black text-slate-900 dark:text-white">Trainer Login</h1>
        <p className="mt-1 text-center text-xs text-slate-500">
          RozSewa Skill Sessions — sign in with the mobile number and password admin gave you.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Mobile Number
            </label>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
              maxLength={10}
              inputMode="numeric"
              autoFocus
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
              placeholder="10-digit number"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 pr-11 text-sm font-bold outline-none focus:border-emerald-500"
                placeholder="••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign In
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default TrainerLogin;
export { STORAGE_KEY };
