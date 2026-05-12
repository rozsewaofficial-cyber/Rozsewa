import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, Sparkles, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const CustomerLogin = () => {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("email"); // email | signup
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(""); // Used as identifier (email or phone)
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [coords, setCoords] = useState([0, 0]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError("Fill all fields"); return; }
    setIsVerifying(true);
    setError("");

    const result = await login(email, password);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }
    setIsVerifying(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !phone) { setError("Fill all fields"); return; }
    
    if (!showOtpInput) {
      setIsVerifying(true);
      setError("");
      try {
        // Check if user already exists
        const { data: existData } = await API.post("/auth/check-existence", { mobile: phone });
        if (existData.exists) {
          setError("Mobile number already registered. Please login.");
          setIsVerifying(false);
          return;
        }

        // Send OTP
        await API.post("/auth/send-otp", { mobile: phone });
        setShowOtpInput(true);
        toast.success("OTP sent successfully!");
      } catch (err) {
        setError("Failed to send OTP. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    } else {
      // Verify OTP and Register
      if (!otp) { setError("Please enter OTP"); return; }
      setIsVerifying(true);
      setError("");
      try {
        const { data: verifyData } = await API.post("/auth/verify-otp", { mobile: phone, otp });
        if (verifyData.success) {
          const result = await signup({
            name, email, password, mobile: phone, address, city, state,
            location: { type: 'Point', coordinates: coords }
          });
          if (result.success) {
            navigate("/");
          } else {
            setError(result.error);
          }
        } else {
          setError("Invalid or expired OTP");
        }
      } catch (err) {
        setError("Invalid or expired OTP");
      } finally {
        setIsVerifying(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-emerald-50/30 px-4 py-8 dark:from-background dark:to-background">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md space-y-8">

        {/* Logo + Welcome */}
        <div className="text-center">
          <div className="flex justify-center mb-6 mt-4">
            <img src="/RozSewa.png" alt="RojSewa" className="h-[4.5rem] w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Welcome Back</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">Book trusted services in seconds</p>
        </div>

        {/* Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="overflow-hidden rounded-3xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/5">

          {/* Mode Tabs */}
          <div className="flex border-b border-border">
            {[
              { id: "email", label: "Login", icon: Mail },
              { id: "signup", label: "Sign Up", icon: Sparkles },
            ].map(t => (
              <button key={t.id} onClick={() => { setMode(t.id); setError(""); }}
                className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${mode === t.id ? "border-b-2 border-primary text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
                  }`}>
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {/* SIGN UP */}
              {mode === "signup" && (
                <motion.form key="signup-form" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                  onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Full Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      placeholder="Enter your name" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      placeholder="you@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Mobile Number</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      placeholder="10-digit number" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      placeholder="Create password" />
                  </div>

                  {showOtpInput && (
                    <div>
                      <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Enter OTP</label>
                      <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
                        className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                        placeholder="6-digit OTP" />
                    </div>
                  )}

                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-foreground uppercase tracking-wider">Service Location</label>
                      <button
                        type="button"
                        onClick={async () => {
                          if ("geolocation" in navigator) {
                            navigator.geolocation.getCurrentPosition(async (pos) => {
                              const { latitude, longitude } = pos.coords;
                              setCoords([longitude, latitude]);
                              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                              const data = await res.json();
                              const addr = data.address || {};
                              setAddress(data.display_name || "");
                              setCity(addr.city || addr.town || addr.village || "");
                              setState(addr.state || "");
                            });
                          }
                        }}
                        className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter transition-colors ${coords[0] !== 0 ? 'bg-emerald-500 text-white' : 'text-primary bg-primary/5 hover:bg-primary/10'}`}
                      >
                        {coords[0] !== 0 ? 'Detected ✓' : 'Use Live Location'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 ml-1">State</label>
                        <input type="text" value={state} onChange={(e) => setState(e.target.value)}
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="e.g. Maharashtra" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 ml-1">City</label>
                        <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="e.g. Mumbai" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 ml-1">Detailed Address</label>
                      <textarea
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full rounded-2xl border border-border bg-background p-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground min-h-[80px]"
                        placeholder="Building, Area, Landmark..."
                      />
                    </div>
                  </div>
                  {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
                  <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={isVerifying}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-primary/20">
                    {isVerifying ? "Processing..." : showOtpInput ? "Complete Registration" : "Send OTP"}
                  </motion.button>
                </motion.form>
              )}

              {/* LOGIN (Email or Phone) */}
              {mode === "email" && (
                <motion.form key="email-form" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                  onSubmit={handleEmailLogin} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Email or Mobile Number</label>
                    <input type="text" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      placeholder="Enter email or phone number" autoFocus />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                        className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                        placeholder="Enter password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={isVerifying}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-600 py-4 text-sm font-extrabold text-white shadow-xl shadow-primary/20 disabled:opacity-60">
                    {isVerifying ? "Logging in..." : <>Login <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Social Logins */}
            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-3 font-semibold text-muted-foreground">Or continue with</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setError("Google Login is coming soon! Please use email/password.")}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                  Google
                </button>
                <button
                  onClick={() => setError("Apple Login is coming soon!")}
                  className="relative flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95 overflow-hidden"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                  Apple
                  <span className="absolute -right-7 top-0.5 rotate-45 bg-primary/80 px-7 py-0.5 text-[8px] font-black uppercase text-white">Soon</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">By continuing, you agree to our <button className="font-semibold text-foreground hover:underline">Terms</button> & <button className="font-semibold text-foreground hover:underline">Privacy Policy</button></p>
        </div>
      </motion.div>
    </div>
  );
};

export default CustomerLogin;
