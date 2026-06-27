import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProtectedRoute = ({ children, allowedRoles = ["customer"] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center bg-transparent">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Check if authenticated
  if (!isAuthenticated) {
    const loginPath = location.pathname.startsWith('/provider') ? "/provider/login" :
      location.pathname.startsWith('/admin') ? "/admin/login" : "/login";
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Check role-based access
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  const isSewak = user?.role === 'sewak' || user?.providerCategory === 'sewak';
  const isPartner = user?.role === 'provider' && user?.providerCategory !== 'sewak';

  // Mandatory check for Sewaks: Must be kycVerified to access features other than the base dashboard, documents, and support
  if (isSewak && !user?.kycVerified && location.pathname !== '/provider' && location.pathname !== '/provider/documents' && location.pathname !== '/provider/support') {
    return <Navigate to="/provider" replace />;
  }

  // Mandatory check for other providers: Must be verified to access features other than the base dashboard, documents, and support
  if (isPartner && user?.status !== 'verified' && location.pathname !== '/provider' && location.pathname !== '/provider/documents' && location.pathname !== '/provider/support') {
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

  const handlePayAdmin = async () => {
    setIsProcessing(true);
    const res = await loadRazorpay();

    if (!res) {
      toast({ title: "Razorpay SDK failed to load. Are you online?", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    try {
      const { data: order } = await API.post("/payment/order", { amount: user.currentDebt, currency: "INR" });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa Admin Settlement",
        description: "Clearing outstanding debt limits",
        order_id: order.id,
        handler: async function (response) {
          try {
            await API.post("/payment/verify-wallet", {
              ...response,
              amount: user.currentDebt
            });
            toast({ title: "Debt cleared successfully! Reloading...", variant: "default" });
            window.location.reload();
          } catch (error) {
            toast({ title: "Payment verification failed", description: error.response?.data?.message || "Please contact support.", variant: "destructive" });
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
      paymentObject.on('payment.failed', function (response) {
        toast({ title: "Payment Failed", description: response.error.description, variant: "destructive" });
      });
      paymentObject.open();
    } catch (error) {
      toast({ title: "Failed to initialize payment", description: error.response?.data?.message || "Server error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Check Debt Limit Enforcer for Providers
  if (isPartner && user?.debtLimitExceeded) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Account Restricted</h2>
          <p className="text-sm font-medium text-slate-500 mb-6">
            You have exceeded your maximum allowed debt limit. You must settle your pending dues to continue receiving service requests and accessing your dashboard.
          </p>
          
          <div className="bg-rose-50 rounded-2xl p-5 mb-8 border border-rose-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Pending Dues</span>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Max Limit</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-3xl font-black text-rose-600">₹{user.currentDebt}</span>
              <span className="text-lg font-bold text-rose-500/60">₹{user.allowedLimit}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handlePayAdmin}
              disabled={isProcessing}
              className={`w-full h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/20 ${isProcessing ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
            >
              {isProcessing ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                  Pay Admin Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
