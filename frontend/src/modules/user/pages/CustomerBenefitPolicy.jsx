import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Zap, TrendingUp, Users, Headphones, Star, Gift, Crown, Info, Loader2, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const CustomerBenefitPolicy = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [policies, setPolicies] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState(null);

  const icons = { ShieldCheck, Zap, TrendingUp, Users, Headphones, Star, Gift };

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: publicPolicies }, { data: requests }] = await Promise.all([
          API.get("/public/benefit-policies", { params: { audience: "user" } }),
          API.get("/benefit-requests"),
        ]);
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

  const benefits = policies.filter(p => p.type === 'benefit');
  const guidelines = policies.filter(p => p.type === 'policy');

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav />
      <main className="container max-w-4xl px-4 py-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Header */}
        <div className="flex items-center gap-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/profile')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card border border-border text-muted-foreground shadow-sm hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div className="space-y-2 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-200">
              <Crown className="h-3 w-3" /> Exclusive Customer Benefits
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase italic leading-none">Benefit Policy & Guidelines</h1>
            <p className="text-sm font-medium text-muted-foreground">Detailed breakdown of your privileges as a RozSewa customer.</p>
          </div>
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
               <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Platform Policies</h2>
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
          <h3 className="text-2xl font-black tracking-tighter text-white italic uppercase">Enjoy exclusive perks</h3>
          <p className="text-xs font-bold text-gray-400 mt-3 max-w-sm mx-auto leading-relaxed uppercase tracking-widest">Explore your benefits and stay updated with our latest policies.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-8 rounded-2xl bg-white px-10 py-4 text-[10px] font-black uppercase tracking-widest text-black shadow-xl active:scale-95 transition-all"
          >
            Back to Home
          </button>
        </section>

      </main>
      <BottomNav />
    </div>
  );
};

export default CustomerBenefitPolicy;
