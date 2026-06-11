import { useState, useEffect } from "react";
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

const WalletPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
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

  const handleAddMoney = async (e) => {
    e.preventDefault();
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid amount.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    try {
      await API.post("/wallet/add", {
        amount: amount,
        title: "Added Money to Wallet"
      });

      toast({ title: "Money Added! 🎉", description: `₹${amount} added to your wallet.` });
      setAddAmount("");
      setShowAddMoney(false);
      fetchWalletData(); // Refresh balance
    } catch (err) {
      toast({ title: "Transaction Failed", description: "Payment processing error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const predefinedAmounts = [500, 1000, 2000, 5000];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 relative">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-black text-foreground tracking-tight">Rozsewa Wallet</h1>
        </div>

        {/* Balance Card */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 p-8 shadow-2xl shadow-emerald-900/20 text-white">
          <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black opacity-80 uppercase tracking-widest text-emerald-100 mb-1">Available Balance</p>
              <h2 className="text-5xl font-black flex items-center gap-1 tracking-tight">₹{balance.toLocaleString()}</h2>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-md border border-white/20 shadow-inner">
              <Wallet className="h-8 w-8 text-emerald-100" />
            </div>
          </div>

          <div className="relative z-10 mt-10 grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAddMoney(true)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-black text-emerald-700 shadow-xl shadow-black/10 hover:bg-emerald-50 transition-colors">
              <Plus className="h-4 w-4" /> Add Money
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => toast({ title: "Notice", description: "Withdrawal is temporarily disabled for standard accounts." })}
              className="flex items-center justify-center gap-2 rounded-2xl bg-black/20 py-3.5 text-sm font-black text-white border border-white/20 backdrop-blur-md hover:bg-black/30 transition-colors">
              Transfer <ChevronRight className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Total Earned</p>
              <p className="text-lg font-black text-foreground tracking-tight">₹{totalEarned.toLocaleString()}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400 rotate-180" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Total Spent</p>
              <p className="text-lg font-black text-foreground tracking-tight">₹{totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Recents
            </h3>
            <button className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80">View All</button>
          </div>

          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-10 bg-muted/20 border-2 border-dashed border-border rounded-2xl">
                <p className="text-sm font-semibold text-muted-foreground">No transactions yet.</p>
              </div>
            ) : (
              transactions.map((txn, i) => (
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
                    <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} disabled={isProcessing} placeholder="0" autoFocus
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
                  className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-emerald-500/20 disabled:opacity-50 transition-all overflow-hidden">
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
