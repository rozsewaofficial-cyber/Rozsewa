import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProtectedRoute = ({ children, allowedRoles = ["customer"] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Coming back from a payment that went through a bank page: the server has
  // already credited it (or not), and says so in the address.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("payment");
    if (!result) return;
    params.delete("payment");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
    if (result === "success") {
      toast({ title: "Payment received", description: "Your payment was successful and your account is updated." });
    } else if (result === "pending") {
      toast({ title: "Payment received", description: "We have your payment. It will show in your wallet within a few minutes." });
      API.post("/payment/wallet/reconcile").catch(() => {});
    } else {
      toast({ title: "Payment not completed", description: "No money was taken, or any amount deducted is returned by your bank in a few days.", variant: "destructive" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A restricted partner who paid but never saw the confirmation (the app
  // closed, the network dropped) must not stay locked out of the very screen
  // they would use to find out. Money Razorpay has already captured is
  // credited here, and the screen lifts.
  useEffect(() => {
    if (!user?.debtLimitExceeded) return undefined;
    let live = true;
    API.post("/payment/wallet/reconcile")
      .then(({ data }) => { if (live && data?.credited?.length) window.location.reload(); })
      .catch(() => {});
    return () => { live = false; };
  }, [user?.debtLimitExceeded]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center bg-transparent">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Check if authenticated
  if (!isAuthenticated) {
    const loginPath = location.pathname.startsWith("/provider")
      ? "/provider/login"
      : location.pathname.startsWith("/admin")
        ? "/admin/login"
        : "/login";
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Normalize role: legacy 'user' and undefined both map to 'customer'
  const effectiveRole =
    user?.role === "user" || !user?.role ? "customer" : user.role;

  // Check role-based access (Admins can access everything)
  if (
    user &&
    effectiveRole !== "admin" &&
    effectiveRole !== "superadmin" &&
    !allowedRoles.includes(effectiveRole)
  ) {
    return <Navigate to="/" replace />;
  }

  const isSewak = user?.role === "sewak" || user?.providerCategory === "sewak";
  const isPartner =
    user?.role === "provider" && user?.providerCategory !== "sewak";

  // Mandatory check for Sewaks: Must be kycVerified to access features other than the base dashboard, documents, and support
  if (
    isSewak &&
    !user?.kycVerified &&
    location.pathname !== "/provider" &&
    location.pathname !== "/provider/documents" &&
    location.pathname !== "/provider/support" &&
    // Admin's KYC/document messages arrive while unverified — readable here.
    location.pathname !== "/provider/notifications"
  ) {
    return <Navigate to="/provider" replace />;
  }

  // Mandatory check for other providers: Must be verified to access features other than the base dashboard, documents, and support
  if (
    isPartner &&
    user?.status !== "verified" &&
    location.pathname !== "/provider" &&
    location.pathname !== "/provider/documents" &&
    location.pathname !== "/provider/support" &&
    // Admin's KYC/document messages arrive while unverified — readable here.
    location.pathname !== "/provider/notifications"
  ) {
    return <Navigate to="/provider" replace />;
  }

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // "I already paid": asks the server to credit any payment Razorpay has
  // captured that this app never got to confirm.
  const handleCheckStatus = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      const { data } = await API.post("/payment/wallet/reconcile");
      if (data?.credited?.length) {
        toast({ title: "Payment found", description: "Your dues are cleared. Opening your account…" });
        setTimeout(() => window.location.reload(), 1000);
        return;
      }
      toast({
        title: "No completed payment yet",
        description: "If you paid in the last minute or two, UPI and bank confirmations can take a few minutes. Wait a little and check again. Please do not pay twice.",
      });
    } catch (error) {
      toast({
        title: "Could not check right now",
        description: error.response?.data?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Pays the dues through Razorpay, the same way the Wallet page does. This
  // used to be a stub that showed "Debt cleared" and reloaded without taking
  // any payment, so a restricted partner could never actually get unblocked.
  const handlePayAdmin = async () => {
    if (isProcessing) return;
    const debt = Number(user?.currentDebt) || 0;
    if (debt <= 0) {
      toast({ title: "Nothing to pay", description: "Your dues are already clear.", variant: "default" });
      window.location.reload();
      return;
    }

    setIsProcessing(true);
    const loaded = await loadRazorpay();
    if (!loaded) {
      toast({ title: "Razorpay SDK failed to load. Are you online?", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    try {
      const { data: order } = await API.post("/payment/order", { amount: debt, currency: "INR", purpose: "wallet" });

      const options = {
        key: order.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa Admin Settlement",
        description: "Clearing outstanding dues",
        order_id: order.id,
        // Where Razorpay sends the browser when the payment went through a bank page and
        // this page could not be told (phone WebViews): the server credits it there.
        callback_url: `${API.defaults.baseURL}/payment/callback`,
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast({ title: "Payment cancelled", description: "No money was taken. Your dues are unchanged." });
          },
        },
        handler: async function (response) {
          try {
            // No amount sent: the server credits what the order was paid for.
            await API.post("/payment/verify-wallet", response);
            toast({ title: "Dues cleared", description: "Your account is active again.", variant: "default" });
            setTimeout(() => window.location.reload(), 1200);
          } catch (error) {
            setIsProcessing(false);
            toast({
              title: "Payment verification failed",
              description: error.response?.data?.message || "If money was deducted, it will be credited shortly. Please contact support.",
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.mobile,
        },
        theme: { color: "#e11d48" },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on("payment.failed", function (response) {
        setIsProcessing(false);
        toast({
          title: "Payment failed",
          description: `${response.error?.description || "The payment didn't go through."} Your dues are unchanged.`,
          variant: "destructive",
        });
      });
      paymentObject.open();
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Failed to start payment",
        description: error.response?.data?.message || "Server error. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Check Debt Limit Enforcer for Providers
  if (isPartner && user?.debtLimitExceeded) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-rose-600"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            Account Restricted
          </h2>
          <p className="text-sm font-medium text-slate-500 mb-6">
            You have exceeded your maximum allowed debt limit. You must settle
            your pending dues to continue receiving service requests and
            accessing your dashboard.
          </p>

          <div className="bg-rose-50 rounded-2xl p-5 mb-8 border border-rose-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                Pending Dues
              </span>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                Max Limit
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-3xl font-black text-rose-600">
                ₹{user.currentDebt}
              </span>
              <span className="text-lg font-bold text-rose-500/60">
                ₹{user.allowedLimit}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handlePayAdmin}
              disabled={isProcessing}
              className={`w-full h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/20 ${isProcessing ? "opacity-70 cursor-not-allowed" : "active:scale-95"}`}
            >
              {isProcessing ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" x2="22" y1="10" y2="10" />
                  </svg>
                  Pay Admin Now
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={isChecking || isProcessing}
              className="w-full h-11 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {isChecking ? "Checking…" : "Already paid? Check status"}
            </button>
            <p className="text-[11px] font-medium text-slate-400 leading-snug">
              If the payment window is still processing, please wait and do not press back or pay again.
              Confirmation can take a few minutes; it is credited automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
