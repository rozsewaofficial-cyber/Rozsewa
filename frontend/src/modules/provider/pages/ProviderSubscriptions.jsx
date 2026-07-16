import { useState, useEffect } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { 
  CreditCard, ShieldCheck, Crown, Calendar, Sparkles, Check, 
  History, Loader2, ArrowRight, RefreshCw, AlertCircle, X,
  Wallet, Link as LinkIcon
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ProviderSubscriptions = () => {
  const { toast } = useToast();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [activeTab, setActiveTab] = useState("compare"); // "active", "compare", "history"
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, previewRes, historyRes, walletRes] = await Promise.all([
        API.get("/provider/subscription-plans"),
        API.get("/v2/provider/commission-preview"),
        API.get("/v2/provider/subscription/history"),
        API.get("/wallet")
      ]);
      setPlans(plansRes.data || []);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      setWallet(walletRes.data || null);

      if (previewRes.data?.activeSubscription) {
        setActivePlan(previewRes.data.activeSubscription);
      } else {
        setActivePlan(null);
      }
    } catch (err) {
      toast({ title: "Failed to load subscriptions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const [paymentModalPlan, setPaymentModalPlan] = useState(null);
  const [isProcessingOnline, setIsProcessingOnline] = useState(false);

  const handlePurchaseClick = (plan) => {
    setPaymentModalPlan(plan);
  };

  const handleWalletPurchase = async () => {
    const plan = paymentModalPlan;
    if (!wallet || wallet.availableBalance < plan.price) {
      toast({ 
        title: "Insufficient Available Balance", 
        description: `Your wallet available balance is ₹${wallet?.availableBalance || 0}. Please recharge your wallet with at least ₹${plan.price} first or use online payment.`, 
        variant: "destructive" 
      });
      return;
    }

    setPurchasing(true);
    try {
      await API.post("/v2/provider/subscription/purchase", { planId: plan._id });
      toast({ title: "Subscription Active!", description: `Successfully purchased ${plan.name} plan.` });
      setPaymentModalPlan(null);
      updateUser({ isSubscribed: true });
      await fetchData();
      setActiveTab("active");
    } catch (err) {
      toast({ 
        title: "Purchase Failed", 
        description: err.response?.data?.message || "Internal server error", 
        variant: "destructive" 
      });
    } finally {
      setPurchasing(false);
    }
  };

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

  const handleOnlinePurchase = async () => {
    toast({ title: "Subscription Active", description: "Your subscription was activated successfully (Simulated).", variant: "default" });
    return;
    /*
    const plan = paymentModalPlan;
    setIsProcessingOnline(true);
    
    const res = await loadRazorpay();
    if (!res) {
      toast({ title: "Razorpay SDK failed to load. Are you online?", variant: "destructive" });
      setIsProcessingOnline(false);
      return;
    }

    try {
      const { data: order } = await API.post("/payment/order", { amount: plan.price, currency: "INR" });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa Subscription",
        description: `Purchase ${plan.name} Plan`,
        order_id: order.id,
        handler: async function (response) {
          try {
            await API.post("/payment/verify-subscription", {
              ...response,
              planId: plan._id
            });
            toast({ title: "Subscription Active!", description: `Successfully purchased ${plan.name} plan.` });
            setPaymentModalPlan(null);
            updateUser({ isSubscribed: true });
            await fetchData();
            setActiveTab("active");
          } catch (error) {
            toast({ title: "Payment verification failed", description: error.response?.data?.message || "Please contact support.", variant: "destructive" });
          }
        },
        theme: { color: "#059669" },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', function (response) {
        toast({ title: "Payment Failed", description: response.error.description, variant: "destructive" });
      });
      paymentObject.open();
    } catch (error) {
      toast({ title: "Failed to initialize payment", description: error.response?.data?.message || "Server error", variant: "destructive" });
    } finally {
      setIsProcessingOnline(false);
    }
    */
  };

  const handleRenew = async () => {
    if (!activePlan) return;
    const plan = plans.find(p => (p.commissionRate || p.offeredCommissionRate) === activePlan.rate) || plans[0];
    if (!plan) return;

    setPaymentModalPlan(plan); // Let user choose payment method for renewal too
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      <main className="container max-w-5xl px-4 py-6 md:py-8 space-y-6 md:space-y-8 text-left">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase">Subscription Hub</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Upgrade your tier, lower commission rates, and audit purchase logs.</p>
          </div>
          {wallet && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl px-4 py-2 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              <div>
                <span className="text-[8px] font-black text-slate-400 block uppercase">Wallet Available Balance</span>
                <span className="text-sm font-black text-emerald-600">₹{wallet.availableBalance.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-border gap-4">
          {[
            { id: "compare", label: "Compare Plans", icon: Crown },
            { id: "active", label: "Active Plan", icon: ShieldCheck },
            { id: "history", label: "Billing History", icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === tab.id ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Compare & Purchase */}
        {activeTab === "compare" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-12 text-center text-slate-400">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold">No active plans are currently available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const isCurrent = activePlan && activePlan.planId === plan._id;
                  return (
                    <div 
                      key={plan._id} 
                      className={`relative flex flex-col justify-between rounded-[2rem] border bg-card p-6 md:p-8 transition-all hover:shadow-xl ${
                        isCurrent 
                          ? "border-emerald-500 ring-2 ring-emerald-500/10 shadow-emerald-500/5 shadow-2xl" 
                          : "border-border"
                      }`}
                    >
                      {plan.featuredBadge && (
                        <div className="absolute top-0 right-6 -translate-y-1/2 rounded-full bg-emerald-600 text-white px-3 py-1 text-[8px] font-black uppercase tracking-wider shadow">
                          Popular
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-black text-foreground uppercase tracking-tight">{plan.name}</h3>
                          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{plan.description}</p>
                        </div>

                        <div className="py-4 border-y border-border/60 space-y-1">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-foreground">₹{plan.price}</span>
                            <span className="text-xs text-muted-foreground font-bold">/{plan.duration} Days</span>
                          </div>
                          <div className="text-xs font-black text-emerald-600">
                            Commission drops to {plan.commissionRate || plan.offeredCommissionRate}%
                          </div>
                        </div>

                        {plan.features && plan.features.length > 0 && (
                          <div className="space-y-2.5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/80 block">Included Privileges:</span>
                            <ul className="space-y-2">
                              {plan.features.map((feat, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <span>{feat}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="mt-8">
                        {isCurrent ? (
                          <div className="w-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl py-3 text-center text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1">
                            <ShieldCheck className="h-4 w-4" /> Active Plan
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePurchaseClick(plan)}
                            disabled={purchasing}
                            className="w-full h-12 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Purchase Now <ArrowRight className="h-4 w-4" /></>}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Active Plan Status */}
        {activeTab === "active" && (
          <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
            {activePlan ? (
              <div className="rounded-[2.5rem] border border-border bg-card p-6 md:p-8 space-y-6 shadow-xl">
                <div className="flex items-center gap-4 border-b border-border/60 pb-6">
                  <div className="h-16 w-16 rounded-2xl bg-emerald-505/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                    <Crown className="h-8 w-8 fill-emerald-505/20" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full uppercase tracking-widest">Active Plan</span>
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1 uppercase tracking-tight">
                      {activePlan.planName} Member
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Commission Rate</span>
                    <span className="text-lg font-black text-emerald-600">{activePlan.rate}%</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Days Remaining</span>
                    <span className="text-lg font-black text-slate-800 dark:text-slate-100">{activePlan.daysRemaining} Days</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200/50">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Expiration Date</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {new Date(activePlan.expiry).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>

                {activePlan.benefits && activePlan.benefits.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Active Privileges</span>
                    <ul className="space-y-2">
                      {activePlan.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRenew}
                  disabled={purchasing}
                  className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4" /> Extend / Renew Subscription</>}
                </button>
              </div>
            ) : (
              <div className="rounded-[2.5rem] border border-dashed border-border bg-card p-10 text-center space-y-4">
                <div className="h-16 w-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-border shadow-sm mx-auto">
                  <Crown className="h-8 w-8 text-slate-300" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">No Active Subscription</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">You are currently subject to category commission default slabs. Purchase a subscription plan to reduce platform commission cuts.</p>
                </div>
                <button
                  onClick={() => setActiveTab("compare")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest px-6 h-12 rounded-xl transition shadow shadow-emerald-600/10"
                >
                  View Available Plans
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Purchase History */}
        {activeTab === "history" && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden animate-in fade-in duration-300">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4">Subscription Billing History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Plan</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Price</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Start Date</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">End Date</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-slate-400 font-bold">
                        No purchase invoices found.
                      </td>
                    </tr>
                  ) : (
                    history.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3.5 font-black text-slate-800 dark:text-slate-200">
                          {item.subscription?.name || "Premium Plan"}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-950 dark:text-white">
                          ₹{item.pricePaid ?? item.subscription?.price ?? 0}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-500">
                          {new Date(item.startDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-500">
                          {new Date(item.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            item.status === 'active' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : (item.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200')
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <ProviderBottomNav />

      {/* Payment Method Selection Modal */}
      {paymentModalPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPaymentModalPlan(null)}>
          <div className="w-full max-w-md rounded-[40px] bg-card p-8 border border-border shadow-2xl relative animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setPaymentModalPlan(null)} 
              className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-2xl font-black tracking-tighter mb-1 uppercase">Choose Payment Method</h2>
            <p className="text-sm text-muted-foreground mb-8">How would you like to pay for the <strong>{paymentModalPlan.name}</strong> plan (₹{paymentModalPlan.price})?</p>
            
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleWalletPurchase}
                disabled={purchasing || isProcessingOnline}
                className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <div className="text-left">
                    <div className="font-black uppercase text-sm">Pay via Wallet</div>
                    <div className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Available: ₹{wallet?.availableBalance || 0}</div>
                  </div>
                </div>
                {purchasing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-border"></div>
                <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">OR</div>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              <button
                type="button"
                onClick={handleOnlinePurchase}
                disabled={purchasing || isProcessingOnline}
                className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                    <LinkIcon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
                  </div>
                  <div className="text-left">
                    <div className="font-black uppercase text-sm">Pay Online</div>
                    <div className="text-[10px] font-bold opacity-80 uppercase tracking-widest">UPI, Cards, Netbanking</div>
                  </div>
                </div>
                {isProcessingOnline ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ProviderSubscriptions;
