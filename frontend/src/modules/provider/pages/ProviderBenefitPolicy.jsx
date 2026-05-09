import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Zap, TrendingUp, Users, Headphones, Star, Gift, Crown, Info, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import API from "@/lib/api";

const ProviderBenefitPolicy = () => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  const icons = { ShieldCheck, Zap, TrendingUp, Users, Headphones, Star, Gift };

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const { data } = await API.get("/public/benefit-policies");
        setPolicies(data);
      } catch (err) {
        console.error("Failed to fetch policies");
      } finally {
        setLoading(false);
      }
    };
    fetchPolicies();
  }, []);

  const benefits = policies.filter(p => p.type === 'benefit');
  const guidelines = policies.filter(p => p.type === 'policy');

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <ProviderTopNav showBack />
      <main className="container max-w-4xl px-4 py-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header */}
        <div className="space-y-2 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-200">
            <Crown className="h-3 w-3" /> Exclusive Partner Benefits
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase italic leading-none">Benefit Policy & Guidelines</h1>
          <p className="text-sm font-medium text-muted-foreground">Detailed breakdown of your privileges as a RozSewa Partner Provider.</p>
        </div>

        {/* Benefits Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {benefits.length > 0 ? benefits.map((benefit, i) => {
            const Icon = icons[benefit.icon] || ShieldCheck;
            return (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.1 }}
                className="flex gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className={`h-14 w-14 shrink-0 flex items-center justify-center rounded-2xl ${benefit.bgColor} ${benefit.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="h-7 w-7" />
                </div>
                <div className="text-left space-y-2">
                  <h3 className="font-black text-foreground uppercase tracking-tight text-lg">{benefit.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">{benefit.description}</p>
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
            onClick={() => navigate(-1)}
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
