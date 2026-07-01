import { useState, useEffect } from "react";
import { 
  Briefcase, MapPin, Calendar, Lock, 
  Unlock, RefreshCcw, AlertTriangle,
  FileText, ArrowRight, Phone, IndianRupee, Wallet
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";

const ProviderLeads = () => {
  const { toast } = useToast();
  
  const [leads, setLeads] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);

  // Dispute state
  const [disputingLeadId, setDisputingLeadId] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  useEffect(() => {
    fetchLeadsAndWallet();
  }, [page]);

  const fetchLeadsAndWallet = async () => {
    setLoading(true);
    try {
      const [leadsRes, walletRes] = await Promise.all([
        API.get(`/leads/nearby?page=${page}&limit=10`),
        API.get("/wallet")
      ]);
      setLeads(leadsRes.data.leads || []);
      setTotalPages(leadsRes.data.pages || 1);
      setWalletBalance(walletRes.data.availableBalance !== undefined ? walletRes.data.availableBalance : (walletRes.data.balance || 0));
    } catch (err) {
      console.error(err);
      toast({ title: "Fetch Failed", description: err.response?.data?.message || "Could not sync leads data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (leadId) => {
    try {
      const { data } = await API.post(`/leads/${leadId}/unlock`);
      if (data.success) {
        toast({ title: "Unlock Success!", description: "Customer contact details are now revealed." });
        fetchLeadsAndWallet();
      }
    } catch (err) {
      if (err.response?.status === 402 && err.response?.data?.paymentRequired) {
        const leadPrice = err.response.data.leadPrice;
        handleRazorpayDirectCheckout(leadId, leadPrice);
      } else {
        toast({ title: "Unlock Failed", description: err.response?.data?.message || "Could not unlock lead.", variant: "destructive" });
      }
    }
  };

  const handleRazorpayDirectCheckout = async (leadId, amount) => {
    try {
      const { data: orderData } = await API.post("/payment/order", { amount, type: "lead_unlock", leadId });
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_mock",
        amount: orderData.amount,
        currency: "INR",
        name: "RozSewa",
        description: `Unlock Lead fee`,
        order_id: orderData.id,
        handler: async (response) => {
          try {
            await API.post("/payment/verify-lead-payment", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              leadId
            });
            toast({ title: "Payment Verified", description: "Lead unlocked successfully!" });
            fetchLeadsAndWallet();
          } catch {
            toast({ title: "Verification Failed", variant: "destructive" });
          }
        },
        theme: { color: "#059669" }
      };
      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast({ title: "Payment gateway not loaded", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Payment Init Failed", description: err.response?.data?.message || "Try again.", variant: "destructive" });
    }
  };

  const handleRaiseDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!disputeReason.trim()) return;
    setSubmittingDispute(true);
    try {
      await API.post(`/leads/${disputingLeadId}/dispute`, { reason: disputeReason });
      toast({ title: "Dispute Raised", description: "Admin desk will inspect this claim." });
      setDisputingLeadId(null);
      setDisputeReason("");
      fetchLeadsAndWallet();
    } catch (err) {
      toast({ title: "Failed to raise dispute", description: err.response?.data?.message || "Error", variant: "destructive" });
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24 relative transition-colors duration-500">
      <ProviderTopNav />

      <main className="container max-w-6xl px-4 py-6 space-y-6 animate-in fade-in duration-700">

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Leads Broadcast
            </p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Available Leads
            </h1>
          </div>
          <button
            onClick={fetchLeadsAndWallet}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white dark:bg-slate-900 border border-border shadow-sm hover:shadow-md text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-all active:scale-95"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} /> Refresh
          </button>
        </div>

        {/* Wallet Balance Card — matching dashboard card style */}
        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-emerald-100 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm shadow-emerald-900/5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Available Balance
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                ₹{walletBalance.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Minimum balance required to view &amp; unlock leads
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <IndianRupee className="h-8 w-8 text-emerald-100 dark:text-emerald-900/40" />
          </div>
        </div>

        {/* Lead Cards */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white dark:bg-slate-900/50 border border-border rounded-2xl p-16 flex flex-col items-center gap-3">
              <RefreshCcw className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Syncing nearest opportunities...
              </p>
            </div>
          ) : leads.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-16 flex flex-col items-center gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-1">
                <Briefcase className="h-7 w-7 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">No Nearby Leads</h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs">
                No new requests in your service area right now. Keep your status active to receive notifications!
              </p>
            </div>
          ) : (
            leads.map((lead) => (
              <div
                key={lead._id}
                className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-border dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
              >
                {/* Card Top Row */}
                <div className="px-5 pt-5 pb-4 flex flex-col md:flex-row justify-between items-start gap-4">

                  {/* Left: Info */}
                  <div className="flex-grow space-y-3 min-w-0">
                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                        #{lead._id.substring(lead._id.length - 6).toUpperCase()}
                      </span>
                      <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/30 uppercase tracking-widest">
                        {lead.distance || "Nearby"}
                      </span>
                      {lead.isUnlocked ? (
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30 uppercase tracking-widest flex items-center gap-1">
                          <Unlock className="h-2.5 w-2.5" /> Unlocked
                        </span>
                      ) : (
                        <span className="text-[9px] font-black text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 uppercase tracking-widest flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" /> Locked
                        </span>
                      )}
                      {lead.category?.name && (
                        <span className="text-[9px] font-black text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded border border-violet-100 dark:border-violet-900/30 uppercase tracking-widest">
                          {lead.category.name}
                        </span>
                      )}
                      {lead.disputeStatus && lead.disputeStatus !== 'none' && (
                        <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase tracking-widest">
                          Dispute: {lead.disputeStatus}
                        </span>
                      )}
                    </div>

                    {/* Service + Date */}
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">{lead.service}</h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {lead.requirementForm?.preferredDate} · {lead.requirementForm?.preferredTime}
                      </p>
                    </div>

                    {/* Description */}
                    <div className="bg-slate-50/70 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Requirement
                      </p>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {lead.requirementForm?.description || "No description specified."}
                      </p>
                    </div>

                    {/* Unlocked Details */}
                    {lead.isUnlocked && (
                      <div className="bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl px-4 py-3 space-y-3">
                        <p className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                          Customer Details
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Name</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                              {lead.customer?.name || "Guest User"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Mobile</p>
                            <a
                              href={`tel:${lead.customer?.mobile}`}
                              className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 hover:underline"
                            >
                              <Phone className="h-3.5 w-3.5" /> {lead.customer?.mobile}
                            </a>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Address</p>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                              {lead.requirementForm?.address || "Coordinate Pin Locked Location"}
                            </p>
                            {lead.location?.coordinates && lead.location.coordinates.length >= 2 && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${lead.location.coordinates[1]},${lead.location.coordinates[0]}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg uppercase tracking-widest mt-2 hover:bg-emerald-200 transition-colors"
                              >
                                <MapPin className="h-3 w-3" /> Open in Google Maps
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Price + CTA */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 w-full md:w-auto md:min-w-[140px] border-t md:border-t-0 pt-4 md:pt-0 border-border">
                    <div className="text-left md:text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unlock Fee</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">₹{lead.leadPrice}</p>
                    </div>

                    {!lead.isUnlocked ? (
                      <button
                        onClick={() => handleUnlock(lead._id)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20 whitespace-nowrap"
                      >
                        Unlock <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      lead.disputeStatus === 'none' && (
                        <button
                          onClick={() => setDisputingLeadId(lead._id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
                        >
                          <AlertTriangle className="h-3 w-3" /> Dispute
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-3 pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-5 py-2.5 rounded-xl border border-border bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:shadow-sm transition-all"
            >
              ← Prev
            </button>
            <span className="flex items-center px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-5 py-2.5 rounded-xl border border-border bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:shadow-sm transition-all"
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {/* Dispute Modal */}
      {disputingLeadId && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setDisputingLeadId(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-border">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> Raise Refund Dispute
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide a brief explanation of why this lead is invalid. Fake claims will lead to account restrictions.
            </p>
            <form onSubmit={handleRaiseDisputeSubmit} className="space-y-4">
              <textarea
                required
                rows={4}
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none text-slate-800 dark:text-white"
                placeholder="e.g. Number was incorrect, or customer rejected the work immediately on call."
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDisputingLeadId(null)}
                  className="flex-1 py-3 border border-border rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  {submittingDispute ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ProviderBottomNav />
    </div>
  );
};

export default ProviderLeads;
