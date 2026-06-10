import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const DigilockerCallback = () => {
  useEffect(() => {
    // 1. URL se query parameters read karein (jaise CGPEY API jo bhejegi)
    const urlParams = new URLSearchParams(window.location.search);
    const paramsData = Object.fromEntries(urlParams.entries());

    // Yahan hum simply check kar sakte hain ki success aaya hai ya nahi.
    // CGPEY ki API structure ke hisaab se params me error hai toh error manenge.
    const isError = urlParams.has("error") || urlParams.get("status") === "failed" || urlParams.get("success") === "false";

    // 2. Parent window (jisne popup open kiya tha) ko message bhejein
    if (window.opener && !window.opener.closed) {
      if (isError) {
        window.opener.postMessage(
          { type: "DIGILOCKER_ERROR", data: paramsData },
          window.location.origin
        );
      } else {
        window.opener.postMessage(
          { type: "DIGILOCKER_SUCCESS", data: paramsData },
          window.location.origin
        );
      }

      // 3. Popup window automatically close kar dein
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      console.warn("Parent window not found. This page should be opened in a popup.");
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
        <h2 className="text-xl font-bold text-slate-800">Verifying DigiLocker</h2>
        <p className="text-sm text-slate-500">Please wait while we process your Aadhaar verification...</p>
        <p className="text-[10px] text-slate-400 mt-2">This window will close automatically.</p>
      </div>
    </div>
  );
};

export default DigilockerCallback;
