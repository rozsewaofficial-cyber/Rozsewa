import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, Sparkles, Eye, EyeOff, MapPin } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { appleClientId, signInWithApple } from "@/lib/appleSignIn";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";
import { getPendingReferral, savePendingReferral } from "@/lib/referral";
import { toast } from "sonner";
import { validateEmail, sanitizeEmail } from "@/lib/emailValidation";
import { validatePhone, sanitizePhone } from "@/lib/phoneValidation";
import {
  validateName,
  sanitizeName,
  sanitizeNameOnChange,
} from "@/lib/nameValidation";

// Google's own button is an iframe that can't be restyled (it left-aligns and
// truncates "Continue with Google" in a half-width cell). So draw a tile that
// matches the Apple one, and lay Google's real, invisible button over it — the
// click still goes to Google's sign-in, which hands back the same credential.
//
// `redirect` ({ loginUri, nonce }) switches Google to redirect mode — see
// useGoogleRedirect below. Google only reads its settings when the button is
// first drawn, so the button is redrawn (keyed) whenever the nonce changes.
const GoogleSignInTile = ({ onSuccess, onError, redirect }) => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const measure = () => ref.current && setWidth(Math.min(400, Math.floor(ref.current.offsetWidth)));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return (
    <div
      ref={ref}
      className="relative flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl border border-border bg-card text-xs font-bold text-foreground"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
      Google
      {width > 0 && (!redirect || redirect.nonce) && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 [&>div]:!w-full">
          <GoogleLogin
            key={redirect?.nonce || "popup"}
            onSuccess={onSuccess}
            onError={onError}
            theme="outline"
            size="large"
            text="continue_with"
            width={String(width)}
            {...(redirect ? { ux_mode: "redirect", login_uri: redirect.loginUri, nonce: redirect.nonce } : {})}
          />
        </div>
      )}
    </div>
  );
};

// On iPhone/iPad (and in the app added to a home screen) Google's sign-in
// popup never hands its result back to the page, so the sign-in went nowhere.
// There the whole page goes to Google instead; Google posts the result to our
// server, which sends the browser back here with a one-time code.
const GOOGLE_NONCE_KEY = "rozsewa_google_nonce";
const GOOGLE_FROM_KEY = "rozsewa_google_from";
const NONCE_REFRESH_MS = 8 * 60 * 1000; // the server keeps a nonce for 10 minutes

const needsGoogleRedirect = () => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    navigator.standalone === true;
  return iOS || standalone;
};

const storageGet = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const storageSet = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage blocked: the sign-in just has to be retried */ }
};

const useGoogleRedirect = (enabled, from) => {
  const [nonce, setNonce] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const start = async () => {
      try {
        const { data } = await API.post("/auth/google/start", { returnOrigin: window.location.origin });
        if (cancelled || !data?.nonce) return;
        storageSet(GOOGLE_NONCE_KEY, data.nonce);
        setNonce(data.nonce);
      } catch {
        if (!cancelled) setNonce(null);
      }
    };
    start();
    const timer = setInterval(start, NONCE_REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [enabled]);
  // Where to go after signing in, kept across the trip to Google.
  useEffect(() => {
    if (enabled && nonce) storageSet(GOOGLE_FROM_KEY, from);
  }, [enabled, nonce, from]);
  if (!enabled) return null;
  return { nonce, loginUri: `${API.defaults.baseURL.replace(/\/$/, "")}/auth/google/redirect` };
};

const CustomerLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state?.from?.pathname || "/") +
    (location.state?.from?.search || "");
  const { login, signup, loginWithOTP, loginWithGoogle, loginWithGoogleCode, loginWithApple, detectLocation, isAuthenticated, updateUser } =
    useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const draft = JSON.parse(
    sessionStorage.getItem("customer-signup-draft") || "{}",
  );

  // An invite link (?ref=CODE) opens straight on Sign Up with the code filled in.
  const invitedWith = new URLSearchParams(location.search).get("ref");
  const [mode, setMode] = useState(invitedWith ? "signup" : (draft.mode || "email")); // email | signup
  const [referralCode, setReferralCode] = useState(() => getPendingReferral());
  const [loginMethod, setLoginMethod] = useState(
    draft.loginMethod || "password",
  ); // password | otp
  const [countdown, setCountdown] = useState(0);
  const [name, setName] = useState(draft.name || "");
  const [phone, setPhone] = useState(draft.phone || "");
  const [email, setEmail] = useState(draft.email || ""); // Used as identifier (email or phone)
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState(draft.address || "");
  const [city, setCity] = useState(draft.city || "");
  const [state, setState] = useState(draft.state || "");
  const [coords, setCoords] = useState([0, 0]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState("");
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [profileMobile, setProfileMobile] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !needsProfileCompletion) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    sessionStorage.setItem(
      "customer-signup-draft",
      JSON.stringify({
        mode,
        loginMethod,
        name,
        phone,
        email,
        address,
        city,
        state,
      }),
    );
  }, [mode, loginMethod, name, phone, email, address, city, state]);

  const clearDraftAndNavigate = (to = from) => {
    sessionStorage.removeItem("customer-signup-draft");
    navigate(to, { replace: true });
  };

  const googleRedirect = useGoogleRedirect(!!googleClientId && needsGoogleRedirect(), from);

  // Back from Google in redirect mode: swap the one-time code for the session.
  const googleReturnHandled = useRef(false);
  useEffect(() => {
    if (googleReturnHandled.current) return;
    const params = new URLSearchParams(location.search);
    const code = params.get("google_code");
    const failure = params.get("google_error");
    if (!code && !failure) return;
    googleReturnHandled.current = true;
    navigate({ pathname: location.pathname, search: "" }, { replace: true, state: location.state });
    if (failure) {
      setError(failure);
      return;
    }
    const nonce = storageGet(GOOGLE_NONCE_KEY);
    const target = storageGet(GOOGLE_FROM_KEY) || from;
    storageSet(GOOGLE_NONCE_KEY, null);
    storageSet(GOOGLE_FROM_KEY, null);
    if (!nonce) {
      setError("Google Sign-In could not be completed. Please try again.");
      return;
    }
    (async () => {
      setIsVerifying(true);
      setError("");
      const result = await loginWithGoogleCode(code, nonce);
      setIsVerifying(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.needsProfileCompletion) {
        setNeedsProfileCompletion(true);
      } else {
        clearDraftAndNavigate(target.startsWith("/") ? target : "/");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleResendOtp = async () => {
    const mobileNo = mode === "signup" ? phone : email;
    if (!mobileNo) return;
    try {
      await API.post("/auth/send-otp", { mobile: mobileNo });
      setCountdown(30);
      toast.success("OTP resent successfully!");
    } catch (err) {
      toast.error("Failed to resend OTP.");
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Fill all fields");
      return;
    }
    if (email.includes("@") && !validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setIsVerifying(true);
    setError("");

    const result = await login(email, password);
    if (result.success) {
      try {
        const loc = await detectLocation();
        if (loc && result.data?.token) {
          await API.put(
            "/auth/profile",
            { location: { type: "Point", coordinates: [loc.lng, loc.lat] } },
            { headers: { Authorization: `Bearer ${result.data.token}` } },
          );
        }
      } catch (err) {
        console.log("Location not granted during login", err);
      }
      clearDraftAndNavigate();
    } else {
      setError(result.error);
    }
    setIsVerifying(false);
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Enter mobile number");
      return;
    }

    if (!showOtpInput) {
      const phoneValidation = validatePhone(email);
      if (!phoneValidation.isValid) {
        setError(phoneValidation.message);
        return;
      }
      setIsVerifying(true);
      setError("");
      try {
        await API.post("/auth/send-otp", { mobile: email });
        setShowOtpInput(true);
        setCountdown(30);
        toast.success("OTP sent successfully!");
      } catch (err) {
        setError(err.response?.data?.message || "Failed to send OTP.");
      } finally {
        setIsVerifying(false);
      }
    } else {
      if (!otp) {
        setError("Please enter OTP");
        return;
      }
      setIsVerifying(true);
      setError("");
      const result = await loginWithOTP(email, otp, "customer");
      if (result.success) {
        try {
          const loc = await detectLocation();
          if (loc && result.data?.token) {
            await API.put(
              "/auth/profile",
              { location: { type: "Point", coordinates: [loc.lng, loc.lat] } },
              { headers: { Authorization: `Bearer ${result.data.token}` } },
            );
          }
        } catch (err) {
          console.log("Location not granted during login", err);
        }
        clearDraftAndNavigate();
      } else {
        setError(result.error);
      }
      setIsVerifying(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name || !password || !phone) {
      setError("Fill all fields");
      return;
    }
    if (!address || address.trim().length < 8) {
      setError(
        "Please enter a valid detailed address (at least 8 characters).",
      );
      return;
    }

    const nameSanitized = sanitizeName(name);
    setName(nameSanitized);
    const nameValidation = validateName(nameSanitized);
    if (!nameValidation.isValid) {
      setError(nameValidation.message);
      return;
    }

    if (email && !validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.message);
      return;
    }

    if (!showOtpInput) {
      setIsVerifying(true);
      setError("");
      try {
        // Check if user already exists
        const { data: existData } = await API.post("/auth/check-existence", {
          mobile: phone,
        });
        if (existData.exists) {
          setError("Mobile number already registered. Please login.");
          setIsVerifying(false);
          return;
        }

        // Send OTP
        await API.post("/auth/send-otp", { mobile: phone });
        setShowOtpInput(true);
        setCountdown(30);
        toast.success("OTP sent successfully!");
      } catch (err) {
        setError("Failed to send OTP. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    } else {
      // Verify OTP and Register
      if (!otp) {
        setError("Please enter OTP");
        return;
      }
      setIsVerifying(true);
      setError("");
      try {
        const { data: verifyData } = await API.post("/auth/verify-otp", {
          mobile: phone,
          otp,
        });
        if (verifyData.success) {
          let currentCoords = coords;
          try {
            const loc = await detectLocation();
            if (loc) currentCoords = [loc.lng, loc.lat];
          } catch (err) {
            console.log("Location not granted during signup", err);
          }

          const result = await signup({
            name,
            email,
            password,
            mobile: phone,
            address,
            city,
            state,
            location: { type: "Point", coordinates: currentCoords },
          });
          if (result.success) {
            clearDraftAndNavigate();
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

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError("Google Sign-In failed. Please try again.");
      return;
    }
    setIsVerifying(true);
    setError("");
    const result = await loginWithGoogle(credentialResponse.credential);
    setIsVerifying(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (result.needsProfileCompletion) {
      setNeedsProfileCompletion(true);
    } else {
      clearDraftAndNavigate();
    }
  };

  const handleAppleClick = async () => {
    if (!appleClientId) {
      setError("Apple Sign-In is not configured yet.");
      return;
    }
    setError("");
    try {
      const apple = await signInWithApple();
      if (apple.cancelled) return;
      setIsVerifying(true);
      const result = await loginWithApple(apple.identityToken, apple.name);
      setIsVerifying(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.needsProfileCompletion) {
        setNeedsProfileCompletion(true);
      } else {
        clearDraftAndNavigate();
      }
    } catch (err) {
      setIsVerifying(false);
      setError("Apple Sign-In failed. Please try again.");
    }
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    const phoneValidation = validatePhone(profileMobile);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.message);
      return;
    }
    if (!profileCity.trim() || !profileState.trim()) {
      setError("Please enter your city and state.");
      return;
    }
    if (!profileAddress.trim() || profileAddress.trim().length < 8) {
      setError("Please enter a valid detailed address (at least 8 characters).");
      return;
    }

    setIsCompletingProfile(true);
    setError("");
    try {
      let currentCoords = coords;
      try {
        const loc = await detectLocation();
        if (loc) currentCoords = [loc.lng, loc.lat];
      } catch (err) {
        console.log("Location not granted during profile completion", err);
      }

      const { data } = await API.put("/auth/profile", {
        mobile: profileMobile,
        city: profileCity,
        state: profileState,
        address: profileAddress,
        location: { type: "Point", coordinates: currentCoords },
      });

      updateUser({
        mobile: data.mobile,
        city: data.city,
        state: profileState,
        address: data.address,
      });
      setNeedsProfileCompletion(false);
      clearDraftAndNavigate();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your details. Please try again.");
    } finally {
      setIsCompletingProfile(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-gradient-to-br from-primary/5 via-background to-emerald-50/30 px-4 py-8 dark:from-background dark:to-background">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md space-y-8 my-auto"
      >
        {/* Logo + Welcome */}
        <div className="text-center">
          <div className="flex justify-center mb-6 mt-4">
            <img
              src="/RozSewa.png"
              alt="RojSewa"
              className="h-[4.5rem] w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Book trusted services in seconds
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="overflow-hidden rounded-3xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/5"
        >
          {needsProfileCompletion ? (
            <div className="p-6 sm:p-8 space-y-5">
              <div className="text-center">
                <h2 className="text-lg font-black text-foreground">Complete Your Profile</h2>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Just a few more details to start booking services.
                </p>
              </div>
              <form onSubmit={handleCompleteProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={profileMobile}
                    onChange={(e) => setProfileMobile(sanitizePhone(e.target.value))}
                    maxLength="10"
                    inputMode="numeric"
                    className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                    placeholder="10-digit number"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                    Service Location
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if ("geolocation" in navigator) {
                        navigator.geolocation.getCurrentPosition(async (pos) => {
                          const { latitude, longitude } = pos.coords;
                          setCoords([longitude, latitude]);
                          const res = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                          );
                          const data = await res.json();
                          const addr = data.address || {};
                          setProfileAddress(data.display_name || "");
                          setProfileCity(addr.city || addr.town || addr.village || "");
                          setProfileState(addr.state || "");
                        });
                      }
                    }}
                    className={`flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter transition-colors ${coords[0] !== 0 ? "bg-emerald-500 text-white" : "text-primary bg-primary/5 hover:bg-primary/10"}`}
                  >
                    <MapPin className="h-3 w-3" /> {coords[0] !== 0 ? "Detected ✓" : "Use Live Location"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 ml-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={profileState}
                      onChange={(e) => setProfileState(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. Maharashtra"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 ml-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={profileCity}
                      onChange={(e) => setProfileCity(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. Mumbai"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 ml-1">
                    Detailed Address
                  </label>
                  <textarea
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-background p-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground min-h-[80px]"
                    placeholder="Building, Area, Landmark..."
                  />
                </div>
                {error && (
                  <p className="text-xs font-semibold text-destructive">{error}</p>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={isCompletingProfile}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-primary/20 disabled:opacity-60"
                >
                  {isCompletingProfile ? "Saving..." : "Continue"}
                </motion.button>
              </form>
            </div>
          ) : (
          <>
          {/* Mode Tabs */}
          <div className="flex border-b border-border">
            {[
              { id: "email", label: "Login", icon: Mail },
              { id: "signup", label: "Sign Up", icon: Sparkles },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id);
                  setError("");
                }}
                className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${
                  mode === t.id
                    ? "border-b-2 border-primary text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {/* SIGN UP */}
              {mode === "signup" && (
                <motion.form
                  key="signup-form"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  onSubmit={handleSignup}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const val = sanitizeNameOnChange(e.target.value);
                        setName(val);
                        e.target.value = val;
                      }}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                      Email <span className="normal-case font-medium text-muted-foreground">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                      maxLength="10"
                      inputMode="numeric"
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      placeholder="10-digit number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 w-full rounded-xl border border-border bg-background px-4 pr-12 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                        placeholder="Create password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {showOtpInput && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                        Authentication Code
                      </label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) =>
                          setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        maxLength="6"
                        inputMode="numeric"
                        className="w-full text-center tracking-[0.4em] rounded-xl border border-primary bg-background py-3 text-xl font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-muted-foreground/30"
                        placeholder="••••••"
                      />
                      <div className="flex justify-between items-center px-1 mt-2">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Didn't receive the code?
                        </span>
                        <button
                          type="button"
                          disabled={countdown > 0}
                          onClick={handleResendOtp}
                          className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 disabled:text-muted-foreground transition-colors hover:underline"
                        >
                          {countdown > 0
                            ? `Resend in ${countdown}s`
                            : "Resend OTP"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                        Service Location
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          if ("geolocation" in navigator) {
                            navigator.geolocation.getCurrentPosition(
                              async (pos) => {
                                const { latitude, longitude } = pos.coords;
                                setCoords([longitude, latitude]);
                                const res = await fetch(
                                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                                );
                                const data = await res.json();
                                const addr = data.address || {};
                                setAddress(data.display_name || "");
                                setCity(
                                  addr.city || addr.town || addr.village || "",
                                );
                                setState(addr.state || "");
                              },
                            );
                          }
                        }}
                        className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter transition-colors ${coords[0] !== 0 ? "bg-emerald-500 text-white" : "text-primary bg-primary/5 hover:bg-primary/10"}`}
                      >
                        {coords[0] !== 0 ? "Detected ✓" : "Use Live Location"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 ml-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={state}
                          onChange={(e) => {
                            const val = e.target.value.replace(
                              /[^a-zA-Z\s]/g,
                              "",
                            );
                            setState(val);
                            e.target.value = val;
                          }}
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="e.g. Maharashtra"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 ml-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => {
                            const val = e.target.value.replace(
                              /[^a-zA-Z\s]/g,
                              "",
                            );
                            setCity(val);
                            e.target.value = val;
                          }}
                          className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="e.g. Mumbai"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 ml-1">
                        Detailed Address
                      </label>
                      <textarea
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full rounded-2xl border border-border bg-background p-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground min-h-[80px]"
                        placeholder="Building, Area, Landmark..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                      Referral Code <span className="font-semibold normal-case text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(savePendingReferral(e.target.value))}
                      maxLength={20}
                      autoCapitalize="characters"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-bold uppercase tracking-wider focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground placeholder:normal-case placeholder:tracking-normal placeholder:font-semibold"
                      placeholder="Friend's code, if you were invited"
                    />
                  </div>
                  {error && (
                    <p className="text-xs font-semibold text-destructive">
                      {error}
                    </p>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={isVerifying}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-600 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-primary/20"
                  >
                    {isVerifying
                      ? "Processing..."
                      : showOtpInput
                        ? "Complete Registration"
                        : "Send OTP"}
                  </motion.button>
                </motion.form>
              )}

              {/* LOGIN (Email or Phone) */}
              {mode === "email" && (
                <motion.form
                  key="email-form"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  onSubmit={
                    loginMethod === "password"
                      ? handleEmailLogin
                      : handleOtpLogin
                  }
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEmail(val.includes("@") ? sanitizeEmail(val) : val);
                      }}
                      className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                      placeholder="Enter phone number"
                      autoFocus
                    />
                  </div>

                  {loginMethod === "password" ? (
                    <div>
                      <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-sm font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                          placeholder="Enter password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    showOtpInput && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                          Authentication Code
                        </label>
                        <input
                          type="text"
                          value={otp}
                          onChange={(e) =>
                            setOtp(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          maxLength="6"
                          inputMode="numeric"
                          className="w-full text-center tracking-[0.4em] rounded-xl border border-primary bg-background py-3 text-xl font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-muted-foreground/30"
                          placeholder="••••••"
                        />
                        <div className="flex justify-between items-center px-1 mt-2">
                          <span className="text-[10px] font-bold text-muted-foreground">
                            Didn't receive the code?
                          </span>
                          <button
                            type="button"
                            disabled={countdown > 0}
                            onClick={handleResendOtp}
                            className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 disabled:text-muted-foreground transition-colors hover:underline"
                          >
                            {countdown > 0
                              ? `Resend in ${countdown}s`
                              : "Resend OTP"}
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {error && (
                    <p className="mt-2 text-xs font-semibold text-destructive">
                      {error}
                    </p>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={isVerifying}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-600 py-4 text-sm font-extrabold text-white shadow-xl shadow-primary/20 disabled:opacity-60"
                  >
                    {isVerifying ? (
                      "Processing..."
                    ) : loginMethod === "password" ? (
                      <>
                        Login{" "}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    ) : showOtpInput ? (
                      "Verify & Login"
                    ) : (
                      "Send OTP"
                    )}
                  </motion.button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod(
                          loginMethod === "password" ? "otp" : "password",
                        );
                        setShowOtpInput(false);
                        setError("");
                      }}
                      className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      {loginMethod === "password"
                        ? "Login with OTP instead"
                        : "Login with Password instead"}
                    </button>
                  </div>
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
                {googleClientId ? (
                  <GoogleOAuthProvider clientId={googleClientId}>
                    <GoogleSignInTile
                      redirect={googleRedirect}
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError("Google Sign-In failed. Please try again.")}
                    />
                  </GoogleOAuthProvider>
                ) : (
                  <button
                    type="button"
                    onClick={() => setError("Google Sign-In is not configured yet.")}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                    Google
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAppleClick}
                  className="relative flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95 overflow-hidden"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                  Apple
                  {!appleClientId && (
                    <span className="absolute -right-7 top-0.5 rotate-45 bg-primary/80 px-7 py-0.5 text-[8px] font-black uppercase text-white">Soon</span>
                  )}
                </button>
              </div>
            </div>
          </div>
          </>
          )}
        </motion.div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to our{" "}
            <button
              onClick={() => {
                window.scrollTo(0, 0);
                navigate("/terms");
              }}
              className="font-semibold text-foreground hover:underline"
            >
              Terms & Conditions
            </button>{" "}
            &{" "}
            <button
              onClick={() => {
                window.scrollTo(0, 0);
                navigate("/privacy");
              }}
              className="font-semibold text-foreground hover:underline"
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default CustomerLogin;
