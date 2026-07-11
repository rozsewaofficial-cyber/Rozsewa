import { motion } from "framer-motion";
import { ArrowLeft, Gift, Share2, Copy, Users, Wallet, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";

const ReferEarn = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const referCode = "SAGARROJ100";

  const handleCopy = () => {
    navigator.clipboard.writeText(referCode);
    toast({ title: "Code Copied!", description: "Share this code with your friends." });
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/profile')} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-bold text-foreground">Refer & Earn</h1>
        </div>

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white shadow-xl">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/10 blur-3xl"
          />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="rounded-2xl bg-white/20 p-4 backdrop-blur-md mb-6">
              <Gift className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-wider">Earn ₹100 for every friend</h2>
            <p className="mt-2 text-sm font-bold opacity-80">Your friend gets ₹50 on sign up and you get ₹100 on their first completed service.</p>
          </div>
        </div>

        {/* Referral Code */}
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Your Referral Code</p>
          <div className="flex items-center justify-center gap-4">
             <span className="text-2xl font-black text-foreground tracking-tighter">{referCode}</span>
             <motion.button 
               whileTap={{ scale: 0.9 }}
               onClick={handleCopy}
               className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
             >
               <Copy className="h-5 w-5" />
             </motion.button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
           {[
             { label: "Friends Joined", value: "12", icon: Users, color: "text-blue-500" },
             { label: "Total Earned", value: "₹1,200", icon: Wallet, color: "text-emerald-500" },
             { label: "Level", value: "Pro", icon: Trophy, color: "text-amber-500" },
           ].map((stat) => (
             <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center text-center gap-1">
               <stat.icon className={`h-5 w-5 ${stat.color} mb-1`} />
               <p className="text-lg font-black text-foreground">{stat.value}</p>
               <p className="text-[10px] font-bold text-muted-foreground">{stat.label}</p>
             </div>
           ))}
        </div>

        {/* How it works */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">How it works</h3>
          <div className="space-y-4">
             {[
               { step: 1, title: "Share your code", desc: "Invite friends via WhatsApp, SMS or Email." },
               { step: 2, title: "They sign up", desc: "Your friend joins using your referral link." },
               { step: 3, title: "They book a service", desc: "Once they complete their first booking, you get ₹100." },
             ].map((s) => (
               <div key={s.step} className="flex gap-4">
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-black text-foreground border border-border">{s.step}</div>
                 <div>
                   <h4 className="text-sm font-bold text-foreground">{s.title}</h4>
                   <p className="text-xs text-muted-foreground">{s.desc}</p>
                 </div>
               </div>
             ))}
          </div>
        </div>

        <motion.button 
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-4 text-sm font-extrabold text-white shadow-xl shadow-emerald-500/20"
        >
          <Share2 className="h-5 w-5" /> Share with Friends
        </motion.button>
      </main>
      <BottomNav />
    </div>
  );
};

export default ReferEarn;
