import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { MapPin, Navigation, AlertTriangle, Loader2 } from "lucide-react";

const LocationGate = () => {
  const { userLocation, detectLocation } = useAuth();
  const [status, setStatus] = useState("checking"); // 'checking' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState("");

  const performDetection = async (isSilent = false) => {
    if (!isSilent) {
      setStatus("checking");
    }
    setErrorMsg("");
    try {
      await detectLocation();
      localStorage.setItem("location_gate_passed", "true");
      setStatus("success");
    } catch (err) {
      console.error("Location detection error:", err);
      let msg = "Could not fetch your location.";
      if (err.code === 1) {
        msg = "Location permission denied. Please allow location access in your browser/device settings to use RozSewa.";
      } else if (err.code === 2) {
        msg = "Location unavailable. Please make sure your GPS is turned on and your device has a clear signal.";
      } else if (err.code === 3) {
        msg = "Location request timed out. Please try again.";
      }
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  useEffect(() => {
    const savedCity = sessionStorage.getItem("rozsewa_user_city");
    const savedLoc = sessionStorage.getItem("rozsewa_user_location");
    if (sessionStorage.getItem("location_gate_passed") === "true" || userLocation || savedLoc || savedCity) {
      if ((userLocation || savedLoc || savedCity) && sessionStorage.getItem("location_gate_passed") !== "true") {
        sessionStorage.setItem("location_gate_passed", "true");
      }
      setStatus("success");
      performDetection(true); // Fetch live location in the background
    } else {
      performDetection(false);
    }
  }, []); // Empty dependency array prevents infinite loop

  if (status === "success") {
    return <Outlet />;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 py-12">
      {/* Background Decorative Blur */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-[32px] p-8 shadow-2xl text-center flex flex-col items-center">
        {status === "checking" ? (
          <>
            <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
              {/* Radar Pulsing Rings */}
              <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping duration-1000" />
              <div className="absolute inset-2 bg-blue-500/20 rounded-full animate-pulse duration-700" />
              <div className="relative w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Navigation className="w-8 h-8 text-white animate-bounce" />
              </div>
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              Detecting Live Location
            </h2>
            <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-6">
              Setting up your experience
            </p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-6 max-w-xs">
              We are finding your current coordinates to match you with the nearest and best service partners.
            </p>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-4 mb-6 border border-blue-100 dark:border-blue-900/30 w-full">
              <p className="text-xs font-bold text-blue-800 dark:text-blue-300 leading-relaxed">
                हमें आपके आस-पास की सेवाएं दिखाने के लिए आपकी लोकेशन की आवश्यकता है। कृपया लोकेशन एक्सेस की अनुमति दें।
              </p>
            </div>

            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Please allow location permission...
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center mb-6 border border-rose-100 dark:border-rose-900/30">
              <AlertTriangle className="w-10 h-10 text-rose-500" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Location Access Required
            </h2>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed mb-6 max-w-sm">
              {errorMsg}
            </p>

            <div className="bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl p-4 mb-6 border border-rose-100/50 dark:border-rose-900/20 w-full text-left text-xs font-medium text-slate-500 dark:text-slate-400">
              <p className="font-bold text-rose-800 dark:text-rose-400 mb-1">How to enable permission:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Click the lock/settings icon next to the URL in your browser's address bar.</li>
                <li>Change the Location permission to <strong>Allow</strong>.</li>
                <li>Reload the page or click "Try Again" below.</li>
              </ul>
            </div>

            <button
              onClick={performDetection}
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black tracking-wide flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
            >
              <Navigation className="w-4 h-4" />
              Try Again / पुनः प्रयास करें
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LocationGate;
