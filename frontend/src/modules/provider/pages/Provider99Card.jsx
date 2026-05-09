import { useState, useEffect } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { CreditCard, ShieldCheck, Gift, CheckCircle, Copy, Share2, Award, ArrowUpRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const Provider99Card = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await API.get("/provider/profile");
      setProvider(data);
    } catch (err) {
      toast({ title: "Failed to load plan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const code = provider?.vendorCode || "";
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: "Code Copied!", description: "Vendor referral code copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const code = provider?.vendorCode || "";
    if (navigator.share) {
      navigator.share({
        title: 'Join RozSewa as a Provider!',
        text: `Register on RozSewa using my referral code ${code} and get 3 commission-free bookings!`,
        url: window.location.origin + '/provider/register',
      });
    } else {
      handleCopy();
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
    </div>
  );

  if (provider?.providerCategory === 'sewak') {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-card rounded-[40px] p-10 shadow-2xl border border-border">
          <div className="h-24 w-24 bg-amber-50 rounded-[32px] flex items-center justify-center mb-8 mx-auto border-2 border-amber-100/50">
            <ShieldCheck className="h-12 w-12 text-amber-500" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight mb-4">Access Restricted</h1>
          <p className="text-muted-foreground font-medium leading-relaxed mb-10">
            This section is only available for Partner Providers.
          </p>
          <Link to="/provider" className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-16 rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const vendorCode = provider?.vendorCode || "RSVND----";
  const commissionRemaining = provider?.freeServicesLeft || 0;
  const planExpiry = provider?.subscriptionExpiry ? new Date(provider.subscriptionExpiry).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric"
  }) : "Lifetime";

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      <main className="container max-w-4xl px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        <div className="text-left">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase">RozSewa 99 Card Center</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Manage your active registration and referral benefits.</p>
        </div>

        {/* Card Status */}
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-emerald-600 to-teal-800 p-8 text-white shadow-2xl shadow-emerald-500/20 border border-white/10">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 h-48 w-48 rounded-full bg-white/15 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-12 -mb-12 h-40 w-40 rounded-full bg-black/20 blur-2xl"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-4 text-left">
              <div className="inline-flex items-center rounded-full bg-white/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white border border-white/30 backdrop-blur-md">
                <ShieldCheck className="mr-2 h-4 w-4" /> {provider?.isSubscribed ? `${provider?.planType || 'Pro'} Member` : 'Free Member'}
              </div>
              <div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none">
                  {provider?.isSubscribed ? 'Registration Active' : 'Not Registered'}
                </h2>
                <p className="text-sm text-emerald-100 font-bold mt-3 opacity-90">
                  {provider?.isSubscribed ? `Valid until: ` : 'Upgrade to unlock Elite benefits'} 
                  {provider?.isSubscribed && <span className="text-white font-black bg-white/10 px-2 py-0.5 rounded-lg">{planExpiry}</span>}
                </p>
              </div>
            </div>

            {!provider?.isSubscribed && (
              <button onClick={() => window.location.href='/provider'} className="w-full md:w-auto shrink-0 rounded-2xl bg-white px-8 py-4 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-xl transition-all hover:scale-105 active:scale-95">
                Register Now
              </button>
            )}
          </div>
        </section>

        {/* Referral System */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-[32px] border border-emerald-500/10 bg-emerald-50/30 dark:bg-emerald-900/10 p-6 md:p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600">
                <Gift className="h-7 w-7" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-black text-emerald-900 dark:text-emerald-400 uppercase tracking-tight">Refer & Earn Benefits</h3>
                <p className="text-xs md:text-sm text-emerald-700 dark:text-emerald-500/80 mt-2 font-medium leading-relaxed">
                  Refer another vendor using your code. When they join, you both earn <strong className="text-emerald-800 dark:text-emerald-300 font-black">3 Commission-Free bookings!</strong>
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-emerald-200/50 bg-white dark:bg-card p-5 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
              <div className="text-left w-full sm:w-auto">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground block mb-2 opacity-60">Your Exclusive Code</span>
                <div className="text-2xl font-black font-mono tracking-[0.3em] text-emerald-700 dark:text-emerald-400">{vendorCode}</div>
              </div>
              <div className="flex w-full sm:w-auto gap-3">
                <button onClick={handleCopy} className="flex-1 sm:flex-none h-14 flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted transition-all active:scale-95">
                  {copied ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                </button>
                <button onClick={handleShare} className="flex-1 sm:flex-none h-14 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-border bg-card p-8 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            <div className="mb-4 rounded-3xl bg-blue-50 dark:bg-blue-900/20 p-6 relative group-hover:scale-110 transition-transform duration-500">
              <Award className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white border-2 border-white dark:border-card">{commissionRemaining}</span>
            </div>
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Zero Commission</h3>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Available for next <strong className="text-emerald-600 font-black">{commissionRemaining} bookings!</strong></p>
            <Link to="/provider/benefit-policy" className="mt-6 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 hover:text-blue-700 transition-colors">
              Benefit Policy <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Benefits Breakdown */}
        <section>
          <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-muted-foreground mb-6 text-left opacity-60">Inclusive Privileges</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "Verified Vendor Badge", desc: "Gain customer trust with a verified checkmark." },
              { title: "Priority Visibility", desc: "Rank higher in search results." },
              { title: "24/7 Support", desc: "Direct priority line to RozSewa admin." },
              { title: "Business Tools", desc: "Access to advanced analytics and staff management." }
            ].map((item, i) => (
              <div key={i} className="flex gap-4 rounded-2xl border border-border bg-card p-5 hover:border-emerald-500/30 transition-all group shadow-sm">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 group-hover:scale-110 transition-all">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-black text-foreground uppercase tracking-tight leading-none mb-1.5">{item.title}</h4>
                  <p className="text-[11px] text-muted-foreground font-medium">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <ProviderBottomNav />
    </div>
  );
};

export default Provider99Card;
