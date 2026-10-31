import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Zap, TrendingUp, Users, Headphones, Star, Gift, Crown, Info, Loader2, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const ProviderBenefitPolicy = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [provider, setProvider] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState(null);

  const icons = { ShieldCheck, Zap, TrendingUp, Users, Headphones, Star, Gift };

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: profile }, { data: publicPolicies }, { data: requests }] = await Promise.all([
          API.get("/provider/profile"),
          API.get("/public/benefit-policies", { params: { audience: "provider" } }),
          API.get("/benefit-requests"),
        ]);
        setProvider(profile);
        setPolicies(publicPolicies);
        setMyRequests(requests);
      } catch (err) {
        console.error("Failed to fetch benefit policy data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const requestStatusFor = (policyId) => {
    const req = myRequests.find(r => r.policyId?._id === policyId);
    return req?.status || null;
  };

  const handleRequest = async (policyId) => {
    setRequestingId(policyId);
    try {
      const { data } = await API.post("/benefit-requests", { policyId });
      setMyRequests(prev => [{ ...data, policyId: { _id: policyId } }, ...prev]);
      toast({ title: "Request submitted", description: "Admin will review your request shortly." });
    } catch (err) {
      toast({ title: "Could not submit request", description: err.response?.data?.message || "Please try again.", variant: "destructive" });
    } finally {
      setRequestingId(null);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
    </div>
  );

  // Benefit Policy does not apply to Sewak — only Partner-category providers.
  if (provider?.providerCategory === 'sewak') {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-card rounded-[40px] p-10 shadow-2xl border border-border">
          <div className="h-24 w-24 bg-amber-50 rounded-[32px] flex items-center justify-center mb-8 mx-auto border-2 border-amber-100/50">
            <ShieldCheck className="h-12 w-12 text-amber-500" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight mb-4">Access Restricted</h1>
          <p className="text-muted-foreground font-medium leading-relaxed mb-10">
            This section is only available for Local Experts.
          </p>
          <button onClick={() => navigate('/provider')} className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black h-16 rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const benefits = policies.filter(p => p.type === 'benefit');
  const guidelines = policies.filter(p => p.type === 'policy');

  return (
    <div className="min-h-screen bg-background pb-20">
      <ProviderTopNav showBack />
      <main className="container max-w-4xl px-4 py-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Header */}
        <div className="space-y-2 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-200">
            <Crown className="h-3 w-3" /> Exclusive Local Expert Benefits
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase italic leading-none">Benefit Policy & Guidelines</h1>
          <p className="text-sm font-medium text-muted-foreground">Detailed breakdown of your privileges as a RozSewa Local Expert.</p>
        </div>

        {/* Benefits Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {benefits.length > 0 ? benefits.map((benefit, i) => {
            const Icon = icons[benefit.icon] || ShieldCheck;
            const status = requestStatusFor(benefit._id);
            return (
              <motion.div
                key={benefit._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="flex gap-5">
                  <div className={`h-14 w-14 shrink-0 flex items-center justify-center rounded-2xl ${benefit.bgColor} ${benefit.color} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="text-left space-y-2">
                    <h3 className="font-black text-foreground uppercase tracking-tight text-lg">{benefit.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">{benefit.description}</p>
                  </div>
                </div>
                <div>
                  {status === 'pending' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"><Clock className="h-3 w-3" /> Request Pending</span>
                  )}
                  {status === 'approved' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 className="h-3 w-3" /> Approved</span>
                  )}
                  {status === 'rejected' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"><XCircle className="h-3 w-3" /> Rejected</span>
                  )}
                  {!status && (
                    <button
                      onClick={() => handleRequest(benefit._id)}
                      disabled={requestingId === benefit._id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60"
                    >
                      {requestingId === benefit._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Request This Benefit
                    </button>
                  )}
                </div>
              </motion.div>
            );
          }) : (
            <div className="md:col-span-2 py-12 text-center border-2 border-dashed border-border rounded-3xl">
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No active benefits at the moment.</p>
            </div>
          )}
        </section>

        {/* Terms Section */}
        {guidelines.length > 0 && (
          <section className="space-y-6">
             <div className="flex items-center gap-2 px-2">
               <Info className="h-5 w-5 text-emerald-500" />
               <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Operational Policies</h2>
             </div>
             <div className="space-y-4">
               {guidelines.map((p, i) => (
                 <div key={i} className="rounded-2xl bg-muted/50 p-6 border border-border/50 text-left">
                   <h4 className="font-black text-foreground uppercase tracking-tight text-sm mb-2">{p.title}</h4>
                   <p className="text-xs text-muted-foreground leading-relaxed font-medium">{p.description}</p>
                 </div>
               ))}
             </div>
          </section>
        )}

        {/* Action Call */}
        <section className="rounded-[3rem] bg-slate-900 p-10 text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-64 w-64 bg-emerald-600/10 rounded-full -mr-32 -mt-32 blur-[100px] group-hover:bg-emerald-600/20 transition-all duration-1000" />
          <h3 className="text-2xl font-black tracking-tighter text-white italic uppercase">Ready to maximize earnings?</h3>
          <p className="text-xs font-bold text-gray-400 mt-3 max-w-sm mx-auto leading-relaxed uppercase tracking-widest">Your success is our priority. Follow these policies to maintain your top-tier status.</p>
          <button
            onClick={() => navigate('/provider')}
            className="mt-8 rounded-2xl bg-white px-10 py-4 text-[10px] font-black uppercase tracking-widest text-black shadow-xl active:scale-95 transition-all"
          >
            Back to Card Center
          </button>
        </section>

      </main>
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderBenefitPolicy;
