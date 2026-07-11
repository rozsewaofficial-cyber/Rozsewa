import { useState, useEffect } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Wallet, TrendingUp, Download, IndianRupee, History, Gift, Plus, X, ChevronRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const defaultTransactions = [
  { id: "TXN-001", type: "Cashback", title: "Referral Bonus", amount: 100, date: new Date(Date.now() - 86400000 * 2).toISOString(), status: "credited" },
  { id: "TXN-002", type: "Payment", title: "AC Repair Payment", amount: -499, date: new Date(Date.now() - 86400000 * 5).toISOString(), status: "debited" },
  { id: "TXN-003", type: "Refund", title: "Cancelled Booking", amount: 250, date: new Date(Date.now() - 86400000 * 10).toISOString(), status: "credited" },
];

const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const WalletPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useScrollLock(showAddMoney);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWalletData = async () => {
    try {
      const { data } = await API.get("/wallet");
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch (err) {
      console.error("Failed to fetch wallet data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const totalEarned = transactions.filter(t => t.type === "credit").reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalSpent = transactions.filter(t => t.type === "debit").reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const displayTransactions = viewAll 
    ? transactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : transactions.slice(0, 4);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const handleAddMoney = async (e) => {
    e.preventDefault();
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    try {
      const res = await loadRazorpay();
      if (!res) {
        toast({ title: "Razorpay SDK failed to load. Are you online?", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      // 1. Create Order on Backend
      const { data: order } = await API.post("/payment/order", {
        amount: amount,
        currency: "INR"
      });

      // 2. Open Razorpay Checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa",
        description: `Add money to Wallet`,
        order_id: order.id,
        handler: async (response) => {
          try {
            // 3. Verify Payment and Add Money Securely
            const { data: verification } = await API.post("/payment/verify-user-wallet", {
              ...response,
              amount: amount
            });
            
            if (verification.success) {
              toast({ title: "Money Added! 🎉", description: `₹${amount} successfully added to your wallet.` });
              setAddAmount("");
              setShowAddMoney(false);
              fetchWalletData(); // Refresh balance
            }
          } catch (err) {
            toast({ title: "Payment Verification Failed", variant: "destructive" });
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: "User",
        },
        theme: {
          color: "#2563eb", // blue-600 to match wallet theme
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      toast({ title: "Failed to initiate payment", description: err.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  const predefinedAmounts = [500, 1000, 2000, 5000];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 relative">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/profile')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-black text-foreground tracking-tight">Rozsewa Wallet</h1>
        </div>

        {/* Balance Card */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-6 shadow-xl shadow-blue-900/10 text-white border border-white/10">
          <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-white/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-blue-400/30 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black opacity-80 uppercase tracking-widest text-blue-100 mb-0.5">Available Balance</p>
              <h2 className="text-4xl font-black flex items-center gap-1 tracking-tight">₹{Math.max(0, balance).toLocaleString()}</h2>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-md border border-white/20 shadow-inner">
              <Wallet className="h-6 w-6 text-blue-100" />
            </div>
          </div>

          <div className="relative z-10 mt-8 grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAddMoney(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-xs font-black text-blue-700 shadow-md shadow-black/5 hover:bg-blue-50 transition-all hover:scale-[1.02]">
              <Plus className="h-3.5 w-3.5" /> Add Money
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => toast({ title: "Notice", description: "Withdrawal is temporarily disabled for standard accounts." })}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-xs font-black text-white border border-white/20 backdrop-blur-md hover:bg-white/20 transition-all hover:scale-[1.02]">
              Transfer <ChevronRight className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-4 md:p-5 flex flex-col items-start gap-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-900/10 blur-2xl group-hover:bg-blue-100 transition-colors" />
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 relative z-10">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 mt-1 relative z-10">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-80">Total Earned</p>
              <p className="text-xl md:text-2xl font-black text-foreground tracking-tight truncate">₹{totalEarned.toLocaleString()}</p>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-4 md:p-5 flex flex-col items-start gap-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-rose-50 dark:bg-rose-900/10 blur-2xl group-hover:bg-rose-100 transition-colors" />
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800/50 relative z-10">
              <Download className="h-5 w-5 text-rose-600 dark:text-rose-400 rotate-180" />
            </div>
            <div className="min-w-0 mt-1 relative z-10">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-80">Total Spent</p>
              <p className="text-xl md:text-2xl font-black text-foreground tracking-tight truncate">₹{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Recents
            </h3>
            {transactions.length > 4 && (
              <button 
                onClick={() => {
                  if (viewAll) {
                    setViewAll(false);
                    setCurrentPage(1);
                  } else {
                    setViewAll(true);
                  }
                }}
                className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80"
              >
                {viewAll ? "Show Less" : "View All"}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-10 bg-muted/20 border-2 border-dashed border-border rounded-2xl">
                <p className="text-sm font-semibold text-muted-foreground">No transactions yet.</p>
              </div>
            ) : (
              displayTransactions.map((txn, i) => (
                <motion.div key={txn._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="group flex items-center justify-between rounded-[24px] border border-border bg-card p-4 hover:border-primary/30 transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${txn.type === 'credit' ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-900/20' : 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/30 dark:bg-rose-900/20'}`}>
                      {txn.type === 'credit' ? <TrendingUp className="h-5 w-5" /> : <IndianRupee className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground leading-tight">{txn.title}</h4>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{new Date(txn.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} • {txn._id.slice(-6).toUpperCase()}</p>
                    </div>
                  </div>
                  <p className={`font-black text-base tabular-nums ${txn.type === 'credit' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {txn.type === 'credit' ? '+' : '-'}₹{Math.abs(txn.amount).toLocaleString()}
                  </p>
                </motion.div>
              ))
            )}
          </div>
          
          {/* Pagination Controls */}
          {viewAll && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-2 py-4 border-t border-border/50">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed bg-muted/50 rounded-xl"
              >
                Previous
              </button>
              <span className="text-xs font-black text-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed bg-muted/50 rounded-xl"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Money Modal */}
      <AnimatePresence>
        {showAddMoney && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/60 backdrop-blur-sm sm:items-center p-4">
            <motion.div initial={{ y: "100%", scale: 1 }} animate={{ y: 0, scale: 1 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm rounded-[32px] bg-card p-6 shadow-2xl border border-border overflow-hidden relative">

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-foreground tracking-tight">Add Money</h3>
                <button onClick={() => setShowAddMoney(false)} className="rounded-full bg-muted p-2 text-muted-foreground hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
              </div>

              <form onSubmit={handleAddMoney} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2 px-1">Enter Amount</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-muted-foreground">₹</div>
                    <input type="number" min="1" onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }} value={addAmount} onChange={e => setAddAmount(e.target.value)} disabled={isProcessing} placeholder="0" autoFocus
                      className="w-full rounded-2xl border-2 border-border bg-background py-4 pl-10 pr-4 text-3xl font-black text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/30" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {predefinedAmounts.map(amt => (
                    <button key={amt} type="button" disabled={isProcessing} onClick={() => setAddAmount(amt.toString())}
                      className="rounded-xl border border-border bg-muted/50 py-2.5 text-xs font-bold text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all font-mono">
                      +₹{amt}
                    </button>
                  ))}
                </div>

                <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={isProcessing || !addAmount}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-blue-600/20 disabled:opacity-50 transition-all overflow-hidden">
                  {isProcessing ? (
                    <span className="flex items-center gap-2"><div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Processing...</span>
                  ) : (
                    <>
                      Proceed to Pay
                      <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12" />
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
};

export default WalletPage;
