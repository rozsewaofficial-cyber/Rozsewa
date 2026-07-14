import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Tag, Copy, Check, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const Offers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState([]);
  const [copiedCode, setCopiedCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const { data } = await API.get("/public/coupons");
        setCoupons(data);
      } catch (err) {
        console.error("Failed to fetch coupons:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCoupons();
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Code Copied!",
      description: `${code} is ready to use at checkout.`,
    });
    setTimeout(() => setCopiedCode(""), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-20 md:pb-8">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-800 hover:bg-slate-100 dark:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5 text-slate-900 dark:text-white" />
          </motion.button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Available Offers</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Save more on every booking</p>
          </div>
        </div>

        {/* Coupons List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Tag className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No active offers right now.</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Check back later for new deals!</p>
            </div>
          ) : (
            coupons.map((coupon, idx) => (
              <motion.div
                key={coupon._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Decorative cutouts */}
                <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"></div>
                <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"></div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Tag className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-lg font-black text-emerald-600 tracking-tight">{coupon.discount} OFF</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white font-mono bg-slate-50 dark:bg-slate-900/50 px-2 py-1 rounded w-fit">{coupon.code}</h3>
                    
                    {coupon.targetCategory ? (
                        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-[10px] font-bold w-max">
                            <Tag className="h-3 w-3" />
                            {coupon.targetCategory.name} Only
                        </div>
                    ) : (
                        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg text-[10px] font-bold w-max">
                            <Tag className="h-3 w-3" />
                            Global (All Categories)
                        </div>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {coupon.description || `Get ${coupon.discount} discount on your order.`}
                    </p>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <Clock className="h-3 w-3" /> Valid Till: {new Date(coupon.expiryDate).toLocaleDateString()}
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCopy(coupon.code)}
                    className={`shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-[16px] px-4 py-3 transition-all ${copiedCode === coupon.code
                      ? "bg-emerald-500 text-white"
                      : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                      }`}
                  >
                    {copiedCode === coupon.code ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {copiedCode === coupon.code ? "COPIED" : "COPY"}
                    </span>
                  </motion.button>
                </div>

                {/* Dashed line */}
                <div className="mt-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800/50 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-[0.2em]">Rozsewa EXCLUSIVE</p>
                  <button
                    onClick={() => {
                      localStorage.setItem("rozsewa_last_copied_coupon", coupon.code);
                      if (window.history.length > 1) {
                        navigate(-1);
                      } else {
                        navigate("/checkout");
                      }
                    }}
                    className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-widest"
                  >
                    Apply Now
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Offers;
