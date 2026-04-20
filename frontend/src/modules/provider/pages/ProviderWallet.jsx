import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { Wallet, ArrowDownRight, ArrowUpRight, History, Download, Link as LinkIcon, Building2, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProviderWallet = () => {
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWallet();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await API.get("/provider/profile");
      setProvider(data);
    } catch (err) {
      console.error("Failed to load profile");
    }
  };

  const fetchWallet = async () => {
    try {
      const { data } = await API.get("/wallet");
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch (err) {
      toast({ title: "Failed to load wallet", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const [isAddingBank, setIsAddingBank] = useState(false);
  const [bankData, setBankData] = useState({ holderName: "", accountNumber: "", bankName: "", ifsc: "" });

  const handleWithdraw = () => {
    toast({ title: "Withdrawal Requested", description: "Withdrawal feature will be active after KYC verification." });
  };

  const saveBank = (e) => {
    e.preventDefault();
    toast({ title: "Bank Details Saved", description: "Your payout information has been updated successfully." });
    setIsAddingBank(false);
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-emerald-600" /></div>
      ) : (
        <main className="container max-w-4xl px-4 py-6 md:py-8 space-y-6 md:space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">Wallet</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase font-bold tracking-widest mt-1">Earnings & Payouts</p>
            </div>
            <button className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors"><Download className="h-4 w-4 text-foreground" /></button>
          </div>

          {/* Compact Balance Card */}
          <section className="rounded-3xl bg-emerald-600 dark:bg-emerald-900/40 p-6 text-white shadow-xl relative border border-emerald-500/20 overflow-hidden">
            <div className="absolute top-0 right-0 h-32 w-32 -mr-10 -mt-10 rounded-full bg-white/10 blur-2xl"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-[0.2em] mb-1">Available Balance</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl md:text-4xl font-black tracking-tighter">₹{balance.toLocaleString()}</span>
                  <span className="text-emerald-300 text-xs font-bold">.00</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-200/80 font-semibold mt-2">
                  <CheckCircle className="h-3 w-3" /> Auto-payout Active
                </div>
              </div>
              <button onClick={handleWithdraw} className="px-5 py-2.5 bg-white text-emerald-900 rounded-xl font-black text-xs hover:bg-emerald-50 transition-all shadow-lg active:scale-95">
                Withdraw
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Dynamic Bank Card */}
            {provider?.bankDetails?.accountNumber ? (
              <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4 transition-all shadow-sm">
                <div className="flex h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-foreground truncate">
                      {provider.bankDetails.bankName} •••• {provider.bankDetails.accountNumber.slice(-4)}
                    </h4>
                    <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium truncate uppercase tracking-widest">
                    {provider.bankDetails.verified ? 'Verified Account • Rozsewa' : 'Verification Pending'}
                  </p>
                </div>
              </div>
            ) : (
              <motion.div
                whileHover={{ scale: 0.99 }}
                onClick={() => setIsAddingBank(true)}
                className="rounded-2xl border-2 border-dashed border-border p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-all group"
              >
                <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <LinkIcon className="h-5 w-5 text-muted-foreground group-hover:text-emerald-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm text-muted-foreground group-hover:text-foreground">Add Bank Account</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Link your payout method</p>
                </div>
              </motion.div>
            )}
          </div>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <History className="h-3.5 w-3.5" /> History
              </h3>
            </div>
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-40 italic">No Activity Yet</div>
              ) : transactions.map((txn) => (
                <div key={txn._id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${txn.type === 'credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {txn.type === 'credit' ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-foreground">{txn.title}</p>
                        {txn.description && (
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${txn.description.includes('Free') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40'}`}>
                            {txn.description.includes('Free') ? 'Free Service' : 'Commission Applied'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{new Date(txn.createdAt).toLocaleDateString()} • {txn._id.slice(-6).toUpperCase()}</p>
                      {txn.description && <p className="text-[9px] text-muted-foreground mt-1 italic">{txn.description}</p>}
                    </div>
                  </div>
                  <div className={`font-black text-sm text-right ${txn.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {txn.type === 'credit' ? '+' : '-'} ₹{txn.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* Add Bank Modal */}
      {isAddingBank && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-[40px] bg-card p-8 border border-border shadow-2xl relative">
            <button onClick={() => setIsAddingBank(false)} className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"><ArrowDownRight className="h-5 w-5 rotate-45" /></button>
            <h2 className="text-2xl font-black tracking-tighter mb-1">Add Bank Account</h2>
            <p className="text-sm text-muted-foreground mb-8">Payouts will be sent to this account securely.</p>

            <form onSubmit={saveBank} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Account Holder Name</label>
                <input required className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Account Number</label>
                <input required className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="0000 0000 0000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">IFSC Code</label>
                  <input required className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="HDFC0001234" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Bank Name</label>
                  <input required className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="HDFC Bank" />
                </div>
              </div>
              <button type="submit" className="w-full h-16 mt-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-[1.01] active:scale-95 transition-all">Save Bank Details</button>
            </form>
          </motion.div>
        </div>
      )}

      <ProviderBottomNav />
    </div>
  );
};

export default ProviderWallet;
