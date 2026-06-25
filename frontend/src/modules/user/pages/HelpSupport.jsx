import { useState, useEffect } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MessageSquare, Phone, Mail, HelpCircle, ChevronRight, Search, Zap, ExternalLink, X, Ticket, ChevronDown, Headset } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import API from "@/lib/api";

const HelpSupport = () => {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState(null);

  useScrollLock(!!selectedPolicy);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const { data } = await API.get("/faqs");
        setFaqs(data);
      } catch (err) {
        console.error("Failed to fetch FAQs", err);
      }
    };
    fetchFaqs();
  }, []);

  const policies = JSON.parse(localStorage.getItem("rozsewa_policy_settings") || JSON.stringify({
    terms: "Welcome to RozSewa. By using our services, you agree to our terms...",
    privacy: "Your privacy is important to us. We collect data to improve your experience...",
    cancellation: "Cancellations made 24 hours before the service are fully refundable..."
  }));

  const legalLinks = [
    { label: "Terms of Service", content:policies.terms },
    { label: "Privacy Policy", content:policies.privacy },
    { label: "Cancellation & Refund", content:policies.cancellation },
  ];

  const filteredFaqs = faqs.filter(f => 
    (f.question && f.question.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (f.answer && f.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] pb-24 md:pb-8 font-sans selection:bg-blue-500/30">
      <TopNav />
      
      <main className="container max-w-2xl px-4 py-6 space-y-8 mx-auto">
        {/* Header Section */}
        <div className="flex items-center gap-4">
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            onClick={() => navigate(-1)} 
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
             <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Help & Support</h1>
             <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">We're here 24/7 to assist you</p>
          </div>
        </div>

        {/* Contact Methods */}
        <div className="grid grid-cols-3 gap-3">
           {[
             { label: "WhatsApp", icon: MessageSquare, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20" },
             { label: "Call Us", icon: Phone, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20" },
             { label: "Email Us", icon: Mail, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20" },
           ].map((opt) => (
             <motion.button 
                key={opt.label} 
                whileTap={{ scale: 0.95 }} 
                className={`flex flex-col items-center gap-3 rounded-[24px] border ${opt.bg} p-4 transition-all hover:shadow-md group bg-white dark:bg-slate-800`}
             >
               <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-white/40 dark:border-slate-700/50 shadow-sm group-hover:scale-110 transition-transform`}>
                 <opt.icon className={`h-6 w-6 ${opt.color}`} />
               </div>
               <span className="text-[11px] font-black uppercase text-slate-900 dark:text-white text-center tracking-wider">{opt.label}</span>
             </motion.button>
           ))}
        </div>

        {/* FAQ Search */}
        <div className="space-y-4">
           <h3 className="text-[13px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
             <HelpCircle className="h-4 w-4 text-blue-500" /> Frequently Asked Questions
           </h3>
           <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics (e.g. Refund, Cancel)..."
                className="w-full h-14 rounded-[20px] border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pl-12 pr-4 text-[14px] font-bold text-slate-900 dark:text-white placeholder:font-medium placeholder:text-slate-400 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none transition-all shadow-sm"
              />
           </div>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-3 pb-6 border-b-2 border-slate-100 dark:border-slate-800">
           {filteredFaqs.length === 0 ? (
             <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                  <Headset className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-[14px] font-bold text-slate-900 dark:text-white">No matching questions found</p>
                <p className="text-[12px] font-medium text-slate-500 mt-1">Try searching with a different keyword</p>
             </div>
           ) : filteredFaqs.map((f, i) => (
             <div key={f._id || i} className="rounded-[20px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all hover:border-blue-300 dark:hover:border-blue-700/50 group shadow-sm">
               <button 
                 onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} 
                 className="flex w-full items-center justify-between p-4 sm:p-5 text-left"
               >
                 <span className="text-[14px] font-bold text-slate-900 dark:text-white pr-4 leading-snug">{f.question}</span>
                 <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${expandedFaq === i ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-slate-800 group-hover:text-blue-500"}`}>
                   <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ${expandedFaq === i ? "rotate-180" : ""}`} />
                 </div>
               </button>
               <AnimatePresence>
                 {expandedFaq === i && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }} 
                     animate={{ height: "auto", opacity: 1 }} 
                     exit={{ height: 0, opacity: 0 }} 
                     className="bg-slate-50/50 dark:bg-slate-800/20"
                   >
                     <p className="p-4 sm:p-5 pt-0 sm:pt-0 text-[13px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">{f.answer}</p>
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
           ))}
        </div>

        {/* Legal Links */}
        <div className="space-y-4">
           <h3 className="text-[13px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Legal Help</h3>
           <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-sm">
             {legalLinks.map((link, i) => (
               <button 
                 key={link.label} 
                 onClick={() => setSelectedPolicy(link)}
                 className={`flex w-full items-center justify-between p-4 text-[13px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:text-blue-600 transition-all rounded-[16px] group ${i !== legalLinks.length - 1 ? "border-b border-slate-100 dark:border-slate-800/50 rounded-b-none pb-4 mb-1" : "" }`}
               >
                 {link.label}
                 <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
               </button>
             ))}
           </div>
        </div>
      </main>

      {/* Policy Modal */}
      <AnimatePresence>
        {selectedPolicy && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
               onClick={() => setSelectedPolicy(null)}
            />
            <motion.div 
              initial={{ opacity: 0, y: "100%" }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: "100%" }} 
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
                <h3 className="text-[18px] font-black text-slate-900 dark:text-white tracking-tight">{selectedPolicy.label}</h3>
                <button 
                  onClick={() => setSelectedPolicy(null)} 
                  className="rounded-full bg-white dark:bg-slate-800 p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-medium">
                  {selectedPolicy.content}
                </p>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shrink-0">
                <button 
                  className="w-full rounded-[16px] bg-blue-600 py-4 text-[14px] font-black tracking-wide text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
                  onClick={() => setSelectedPolicy(null)}
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <BottomNav />
    </div>
  );
};

export default HelpSupport;
