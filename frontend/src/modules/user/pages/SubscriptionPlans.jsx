import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Check, Star, Zap, Shield, Clock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";

const plans = [
  {
    id: "basic",
    name: "Basic",
    monthly: 299,
    yearly: 2999,
    color: "from-slate-500 to-slate-700",
    icon: Shield,
    popular: false,
    features: ["2 services/month", "Standard support", "Basic warranty", "10% off add-ons"],
  },
  {
    id: "standard",
    name: "Standard",
    monthly: 599,
    yearly: 5999,
    color: "from-primary to-emerald-600",
    icon: Star,
    popular: true,
    features: ["5 services/month", "Priority support", "Extended warranty", "20% off add-ons", "Free re-service", "Dedicated manager"],
  },
  {
    id: "premium",
    name: "Premium",
    monthly: 999,
    yearly: 9999,
    color: "from-amber-500 to-orange-600",
    icon: Crown,
    popular: false,
    features: ["Unlimited services", "24/7 VIP support", "Full warranty coverage", "40% off add-ons", "Free re-service", "Personal manager", "Early access deals", "Family sharing (4)"],
  },
];

const SubscriptionPlans = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [billing, setBilling] = useState("monthly");
  const [selectedPlan, setSelectedPlan] = useState(null);

  const handleSubscribe = (plan) => {
    setSelectedPlan(plan.id);
    setTimeout(() => {
      toast({ title: "Subscribed! 🎉", description: `You are now on the ${plan.name} plan.` });
      setSelectedPlan(null);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-4xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Subscription Plans</h1>
            <p className="text-xs text-muted-foreground">Save more with monthly or yearly plans</p>
          </div>
        </div>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-600 p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="rounded-2xl bg-white/20 p-4 backdrop-blur-md">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black">Save up to 40% with a plan</h2>
              <p className="mt-1 text-sm font-medium opacity-80">Subscribe now & get priority booking + exclusive discounts</p>
            </div>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="flex items-center gap-1 rounded-2xl bg-muted p-1">
            {[{ id: "monthly", label: "Monthly" }, { id: "yearly", label: "Yearly", badge: "Save 17%" }].map(t => (
              <button key={t.id} onClick={() => setBilling(t.id)}
                className={`relative rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                  billing === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {t.label}
                {t.badge && <span className="absolute -right-1 -top-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-black text-white">{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const price = billing === "monthly" ? plan.monthly : plan.yearly;
            return (
              <motion.div key={plan.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className={`relative rounded-3xl border-2 p-5 sm:p-6 transition-all ${
                  plan.popular ? "border-primary bg-primary/5 shadow-xl shadow-primary/10" : "border-border bg-card"
                }`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase text-white shadow-lg">
                    Most Popular
                  </span>
                )}
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${plan.color} text-white shadow-lg mb-4`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-foreground">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-foreground">₹{price}</span>
                  <span className="text-xs text-muted-foreground">/{billing === "monthly" ? "mo" : "yr"}</span>
                </div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleSubscribe(plan)} disabled={selectedPlan === plan.id}
                  className={`mt-5 w-full rounded-xl py-3 text-sm font-extrabold transition-all ${
                    plan.popular ? "bg-primary text-primary-foreground shadow-lg" : "border-2 border-border text-foreground hover:bg-muted"
                  } disabled:opacity-60`}>
                  {selectedPlan === plan.id ? "Subscribing..." : "Subscribe"}
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {/* FAQ Snippet */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground">Frequently Asked</h3>
          {[
            { q: "Can I cancel anytime?", a: "Yes, cancel your subscription anytime from Profile → Subscriptions." },
            { q: "Do unused services carry forward?", a: "No, monthly services reset each billing cycle." },
            { q: "Can I upgrade mid-plan?", a: "Yes! You only pay the prorated difference." },
          ].map(f => (
            <details key={f.q} className="group">
              <summary className="cursor-pointer text-xs font-semibold text-foreground">{f.q}</summary>
              <p className="mt-1 text-xs text-muted-foreground pl-4">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default SubscriptionPlans;
