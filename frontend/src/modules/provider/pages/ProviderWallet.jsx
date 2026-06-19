import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { Wallet, ArrowDownRight, ArrowUpRight, History, Download, Link as LinkIcon, Building2, CheckCircle, Loader2, Landmark } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProviderWallet = () => {
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawals = async () => {
    try {
      const { data } = await API.get('/provider/withdrawals');
      setWithdrawals(data);
    } catch (err) {
      console.error("Failed to fetch withdrawals", err);
    }
  };

  useEffect(() => {
    fetchWallet();
    fetchProfile();
    fetchWithdrawals();
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
  const [bankData, setBankData] = useState({ accountHolderName: "", accountNumber: "", bankName: "", ifscCode: "" });
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");

  const handleWithdraw = async () => {
    if (balance <= 0) {
      toast({ title: "Insufficient Balance", description: "You need a positive balance to request a withdrawal.", variant: "destructive" });
      return;
    }

    if (!provider?.kycVerified) {
      toast({ title: "KYC Required", description: "Withdrawal feature will be active after KYC verification.", variant: "destructive" });
      return;
    }

    if (!provider?.bankDetails?.accountNumber) {
      toast({ title: "Bank Account Required", description: "Please link your bank account first.", variant: "destructive" });
      return;
    }

    setIsWithdrawing(true);
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayAdmin = async () => {
    if (balance >= 0) return;
    const debtAmount = Math.abs(balance);
    
    setIsProcessing(true);
    const res = await loadRazorpay();

    if (!res) {
      toast({ title: "Razorpay SDK failed to load. Are you online?", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    try {
      const { data: order } = await API.post("/payment/order", { amount: debtAmount, currency: "INR" });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa Admin Settlement",
        description: "Clearing outstanding debt limits",
        order_id: order.id,
        handler: async function (response) {
          try {
            await API.post("/payment/verify-wallet", {
              ...response,
              amount: debtAmount
            });
            toast({ title: "Debt cleared successfully!", variant: "default" });
            fetchWallet();
          } catch (error) {
            toast({ title: "Payment verification failed", description: error.response?.data?.message || "Please contact support.", variant: "destructive" });
          }
        },
        prefill: {
          name: provider?.ownerName,
          email: provider?.email,
          contact: provider?.mobile,
        },
        theme: { color: "#059669" }, // Emerald color
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', function (response) {
        toast({ title: "Payment Failed", description: response.error.description, variant: "destructive" });
      });
      paymentObject.open();
    } catch (error) {
      toast({ title: "Failed to initialize payment", description: error.response?.data?.message || "Server error", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const submitWithdrawal = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError("Please enter a valid amount.");
      return;
    }
    if (amount > balance) {
      setWithdrawError(`Amount cannot exceed your balance of ₹${balance}.`);
      return;
    }
    setWithdrawError("");
    try {
      await API.post("/provider/withdraw", { amount });
      toast({ title: "Withdrawal Requested", description: "Your request has been submitted successfully." });
      setIsWithdrawing(false);
      setWithdrawAmount("");
      fetchWallet();
    } catch (err) {
      setWithdrawError(err.response?.data?.message || "Failed to submit request. Try again.");
    }
  };

  const saveBank = async (e) => {
    e.preventDefault();
    try {
      await API.put('/provider/profile', { bankDetails: bankData });
      toast({ title: "Bank Details Saved", description: "Your payout information has been updated successfully." });
      setIsAddingBank(false);
      fetchProfile();
    } catch (err) {
      toast({ title: "Failed to save bank details", variant: "destructive" });
    }
  };

  const handleEditBank = () => {
    setBankData({
      accountHolderName: provider?.bankDetails?.accountHolderName || "",
      accountNumber: provider?.bankDetails?.accountNumber || "",
      bankName: provider?.bankDetails?.bankName || "",
      ifscCode: provider?.bankDetails?.ifscCode || ""
    });
    setIsAddingBank(true);
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

          {/* Two Cards: Balance + Cash Limit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Earnings & Withdrawal Card */}
            <section className="rounded-2xl md:rounded-3xl bg-emerald-600 dark:bg-emerald-900/40 p-5 md:p-6 text-white shadow-lg relative border border-emerald-500/20 overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 h-32 w-32 -mr-10 -mt-10 rounded-full bg-white/10 blur-2xl"></div>
              <div className="relative z-10 flex-1 flex flex-col">
                <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-[0.2em] mb-0.5">Available Balance</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black tracking-tighter">₹{balance > 0 ? balance.toLocaleString() : '0'}</span>
                  <span className="text-emerald-300 text-xs font-bold">.00</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-200/80 font-semibold mb-2">
                  <CheckCircle className="h-3 w-3" />
                  {balance > 0 ? 'Net earnings after commission' : 'No earnings yet'}
                </div>
                {balance > 0 && (
                  <div className="bg-white/10 rounded-xl px-3 py-2 mb-3">
                    <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">Wallet Balance</p>
                    <p className="text-sm font-black text-white">₹{balance.toLocaleString()} ready to withdraw</p>
                  </div>
                )}
                <div className="mt-auto">
                  <button
                    onClick={handleWithdraw}
                    disabled={balance <= 0}
                    className={`w-full py-2.5 md:py-3 rounded-xl font-black text-xs transition-all ${balance <= 0 ? 'bg-white/20 text-emerald-100/50 cursor-not-allowed' : 'bg-white text-emerald-900 shadow-md hover:bg-emerald-50 active:scale-95'}`}
                  >
                    Request Withdrawal
                  </button>
                </div>
              </div>
            </section>

            {/* Cash Limit / Debt Card */}
            <section className={`rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-lg relative overflow-hidden border flex flex-col ${balance < 0 ? 'bg-rose-600 border-rose-500/20 text-white' : 'bg-slate-800 border-slate-700/20 text-white'}`}>
              <div className="absolute top-0 right-0 h-32 w-32 -mr-10 -mt-10 rounded-full bg-white/5 blur-2xl"></div>
              <div className="relative z-10 flex-1 flex flex-col">
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.2em] mb-0.5">Cash Commission Dues</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black tracking-tighter">
                    ₹{balance < 0 ? Math.abs(balance).toLocaleString() : '0'}
                  </span>
                  <span className="text-white/40 text-xs font-bold">.00</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/60 font-semibold mb-2">
                  {balance < 0
                    ? <><span className="text-rose-200">⚠ Commission owed to admin</span></>
                    : <><CheckCircle className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">No dues pending</span></>
                  }
                </div>
                {balance < 0 && (
                  <div className="bg-white/10 rounded-xl px-3 py-2 mb-3 border border-white/20">
                    <p className="text-[10px] font-black text-rose-200 uppercase tracking-widest">⚠ Action Required</p>
                    <p className="text-sm font-black text-white">Pay ₹{Math.abs(balance).toLocaleString()} to unlock bookings</p>
                  </div>
                )}
                <div className="mt-auto">
                  <button
                    onClick={balance < 0 ? handlePayAdmin : undefined}
                    disabled={balance >= 0 || isProcessing}
                    className={`w-full py-2.5 md:py-3 rounded-xl font-black text-xs transition-all ${
                      balance < 0
                        ? 'bg-white text-rose-700 shadow-md hover:bg-rose-50 active:scale-95'
                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? 'Processing...' : balance < 0 ? 'Pay Admin Now' : 'All Clear'}
                  </button>
                </div>
              </div>
            </section>

          </div>

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
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">
                        Primary
                      </span>
                      <button onClick={handleEditBank} className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 transition-colors">
                        Edit
                      </button>
                    </div>
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

          {/* Withdrawal Status Section */}
          {withdrawals.length > 0 && (
            <section className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Landmark className="h-3.5 w-3.5" /> Withdrawal Requests
                </h3>
              </div>
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border mb-6">
                {withdrawals.map((req) => (
                  <div key={req._id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                          req.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                            'bg-amber-50 text-amber-600'
                        }`}>
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground">Withdrawal Request</p>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              req.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                            {req.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{new Date(req.createdAt).toLocaleDateString()} • {req._id.slice(-6).toUpperCase()}</p>
                        {req.reason && <p className="text-[9px] text-rose-600 mt-1 italic">Reason: {req.reason}</p>}
                      </div>
                    </div>
                    <div className={`font-black text-sm text-right text-rose-600`}>
                      - ₹{req.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

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
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-foreground">{txn.title}</p>
                        {(() => {
                          const t = txn.title || '';
                          const d = txn.description || '';
                          if (t.includes('Cash Collected')) return <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">💵 Cash</span>;
                          if (t.includes('Commission Deducted')) return <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">🏛 Commission</span>;
                          if (t.includes('Service Earnings')) return <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">💳 Online</span>;
                          if (d.includes('Free') || t.includes('Free')) return <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">Free Service</span>;
                          if (t.includes('Penalty')) return <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Penalty</span>;
                          if (t.includes('Bonus')) return <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Bonus</span>;
                          return null;
                        })()}
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
                <input required value={bankData.accountHolderName} onChange={e => setBankData({ ...bankData, accountHolderName: e.target.value })} className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Account Number</label>
                <input required value={bankData.accountNumber} onChange={e => setBankData({ ...bankData, accountNumber: e.target.value })} className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="0000 0000 0000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">IFSC Code</label>
                  <input required value={bankData.ifscCode} onChange={e => setBankData({ ...bankData, ifscCode: e.target.value })} className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="HDFC0001234" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Bank Name</label>
                  <input required value={bankData.bankName} onChange={e => setBankData({ ...bankData, bankName: e.target.value })} className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="HDFC Bank" />
                </div>
              </div>
              <button type="submit" className="w-full h-16 mt-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-[1.01] active:scale-95 transition-all">Save Bank Details</button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {isWithdrawing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-[40px] bg-card p-8 border border-border shadow-2xl relative">
            <button onClick={() => setIsWithdrawing(false)} className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"><ArrowDownRight className="h-5 w-5 rotate-45" /></button>
            <h2 className="text-2xl font-black tracking-tighter mb-1">Request Withdrawal</h2>
            <p className="text-sm text-muted-foreground mb-8">Enter the amount you want to withdraw.</p>

            <form onSubmit={submitWithdrawal} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Amount (Max: ₹{balance})</label>
                <input required type="number" min="1" value={withdrawAmount}
                  onChange={e => { const v = e.target.value; if (v === "" || parseFloat(v) > 0) { setWithdrawAmount(v); setWithdrawError(""); } }}
                  onKeyDown={e => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                  className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="500" />

                {withdrawError && (
                  <p className="text-[11px] font-bold text-rose-500 px-1 mt-1">{withdrawError}</p>
                )}
                {/* Quick Presets */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button type="button" onClick={() => setWithdrawAmount("500")} className="h-10 rounded-xl bg-muted hover:bg-accent font-bold text-xs transition-colors">₹500</button>
                  <button type="button" onClick={() => setWithdrawAmount("1000")} className="h-10 rounded-xl bg-muted hover:bg-accent font-bold text-xs transition-colors">₹1000</button>
                  <button type="button" onClick={() => setWithdrawAmount(balance.toString())} className="h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 font-bold text-xs transition-colors">All</button>
                </div>
              </div>
              <button type="submit" className="w-full h-16 mt-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-[1.01] active:scale-95 transition-all">Submit Request</button>
            </form>
          </motion.div>
        </div>
      )}

      <ProviderBottomNav />
    </div>
  );
};

export default ProviderWallet;
