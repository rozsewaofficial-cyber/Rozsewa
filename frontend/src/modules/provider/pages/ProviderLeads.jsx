import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Briefcase, MapPin, Calendar, Clock, Lock, Unlock,
  RefreshCcw, AlertTriangle, FileText, ArrowRight,
  Phone, IndianRupee, Wallet, CheckCircle2, Eye,
  Sparkles, Shield, Mail
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { useSocket } from "@/context/SocketContext";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";

// ─── Status Badge Config ──────────────────────────────────────────────────────
const STATUS = {
  available:          { label: 'Available',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partially_unlocked: { label: 'Partially Open', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  fully_unlocked:     { label: 'Fully Taken',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  expired:            { label: 'Expired',        color: 'bg-orange-50 text-orange-700 border-orange-200' },
  closed:             { label: 'Closed',         color: 'bg-slate-50 text-slate-400 border-slate-100' },
  disputed:           { label: 'Disputed',       color: 'bg-red-50 text-red-700 border-red-200' },
};

// ─── Expiry Countdown ─────────────────────────────────────────────────────────
const ExpiryCountdown = ({ expiry }) => {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, new Date(expiry) - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, new Date(expiry) - Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [expiry]);

  if (timeLeft === 0) return <span className="text-[9px] text-rose-500 font-bold">Expired</span>;
  const h = Math.floor(timeLeft / 3600000);
  const m = Math.floor((timeLeft % 3600000) / 60000);
  const label = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  const urgent = timeLeft < 2 * 3600000;
  return <span className={`text-[9px] font-bold flex items-center gap-1 ${urgent ? 'text-rose-500' : 'text-slate-400'}`}><Clock className="h-2.5 w-2.5" />{label}</span>;
};

// ─── Lead Card ────────────────────────────────────────────────────────────────
const LeadCard = ({ lead, onUnlock, onDispute }) => {
  const conf = STATUS[lead.status] || STATUS.available;
  const isUnlocked = lead.isUnlocked;

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      {/* Top section */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">
            #{lead._id?.substring(lead._id.length - 6).toUpperCase()}
          </span>
          <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${conf.color}`}>
            {conf.label}
          </span>
          {lead.distance && (
            <span className="text-[9px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-100 uppercase tracking-widest flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" />{lead.distance}
            </span>
          )}
          {isUnlocked && (
            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-widest flex items-center gap-1">
              <Unlock className="h-2.5 w-2.5" /> Unlocked
            </span>
          )}
          {lead.categoryId?.name && (
            <span className="text-[9px] font-black text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase tracking-widest">
              {lead.categoryId.name}
            </span>
          )}
        </div>

        {/* Title and schedule */}
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
            {lead.requirementTitle || lead.requirementForm?.description?.slice(0, 80) || lead.service || 'Service Request'}
          </h3>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex flex-wrap gap-3 items-center">
              {(lead.preferredDate || lead.requirementForm?.preferredDate) && (
                <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Schedule: {lead.preferredDate || lead.requirementForm?.preferredDate}
                  {(lead.preferredTime || lead.requirementForm?.preferredTime) && ` · ${lead.preferredTime || lead.requirementForm?.preferredTime}`}
                </p>
              )}
              {lead.expiry && ['available', 'partially_unlocked'].includes(lead.status) && (
                <ExpiryCountdown expiry={lead.expiry} />
              )}
            </div>
            {lead.createdAt && (
              <p className="text-[9px] font-black text-violet-600 dark:text-violet-450 flex items-center gap-1 uppercase tracking-wider">
                <Clock className="h-3 w-3" />
                Generated: {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(lead.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
            )}
          </div>
        </div>

        {/* Requirement preview */}
        <div className="bg-slate-50/70 dark:bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700/50">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Requirement
          </p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-3">
            {lead.requirementDesc || lead.requirementForm?.description || 'No description provided.'}
          </p>
        </div>

        {/* Dynamic answers preview (first 2) */}
        {lead.dynamicAnswersPreview?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Key Details</p>
            {lead.dynamicAnswersPreview.map(a => (
              <div key={a.fieldId} className="flex gap-2 items-start">
                <span className="text-[9px] font-bold text-slate-400 w-20 shrink-0 truncate">{a.label}:</span>
                <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 line-clamp-1 flex-1">
                  {Array.isArray(a.value) ? a.value.join(', ') : String(a.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Attachments badge */}
        {lead.attachments?.length > 0 && (
          <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
            📎 {lead.attachments.length} attachment{lead.attachments.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Unlocked customer details */}
        {isUnlocked && (
          <div className="bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl px-4 py-3 space-y-3">
            <p className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Customer Contact Revealed
            </p>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 w-12">Name</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">{lead.customer?.name || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 w-12">Phone</span>
                <a href={`tel:${lead.customer?.mobile}`}
                  className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 hover:underline">
                  <Phone className="h-3.5 w-3.5" />{lead.customer?.mobile}
                </a>
              </div>
              {lead.customer?.email && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-400 w-12">Email</span>
                  <a href={`mailto:${lead.customer?.email}`}
                    className="text-xs font-medium text-violet-600 flex items-center gap-1.5 hover:underline">
                    <Mail className="h-3 w-3" />{lead.customer?.email}
                  </a>
                </div>
              )}
              {(lead.locationDetail?.city || lead.requirementForm?.address) && (
                <div className="flex items-start gap-2 mt-1">
                  <span className="text-[9px] font-black text-slate-400 w-12 mt-0.5">Address</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {[lead.locationDetail?.houseNo, lead.locationDetail?.apartment, lead.locationDetail?.street,
                        lead.locationDetail?.area, lead.locationDetail?.city, lead.locationDetail?.state, lead.locationDetail?.pincode]
                        .filter(Boolean).join(', ') || lead.requirementForm?.address}
                    </p>
                    {lead.location?.coordinates?.length >= 2 && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${lead.location.coordinates[1]},${lead.location.coordinates[0]}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg uppercase tracking-widest mt-1.5 hover:bg-emerald-200 transition-colors">
                        <MapPin className="h-2.5 w-2.5" /> Open in Maps
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom action strip */}
      <div className="px-5 pb-5 flex flex-row items-center justify-between gap-3 border-t border-slate-50 dark:border-slate-800 pt-4">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unlock Fee</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">₹{lead.leadPrice || 0}</p>
          <p className="text-[9px] text-slate-400 font-medium mt-0.5">
            {lead.unlockedProviders?.length || 0} / {lead.maxUnlockLimit} unlocked
          </p>
        </div>

        <div className="flex gap-2">
          {!isUnlocked && ['available', 'partially_unlocked'].includes(lead.status) && (
            <button onClick={() => onUnlock(lead._id, lead.leadPrice)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
              Unlock <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {isUnlocked && lead.disputeStatus === 'none' && (
            <button onClick={() => onDispute(lead._id)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">
              <AlertTriangle className="h-3 w-3" /> Dispute
            </button>
          )}
          {lead.disputeStatus && lead.disputeStatus !== 'none' && (
            <span className="text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl uppercase tracking-widest">
              Dispute: {lead.disputeStatus}
            </span>
          )}
          {isUnlocked && lead.status === 'fully_unlocked' && (
            <span className="text-[9px] font-black text-slate-400 flex items-center gap-1">
              <Lock className="h-3 w-3" /> Lead Closed
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const VALID_TABS = ['available', 'unlocked', 'expired'];

const ProviderLeads = () => {
  const { toast } = useToast();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads,         setLeads]         = useState([]);
  const [totalPages,    setTotalPages]    = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [tabLoading,    setTabLoading]    = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [unlockModal,   setUnlockModal]   = useState(null); // { leadId, price }
  const [unlocking,     setUnlocking]     = useState(false);

  // Derive activeTab and page from URL, with fallback defaults
  const rawTab = searchParams.get('tab');
  const activeTab = VALID_TABS.includes(rawTab) ? rawTab : 'available';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));

  const setActiveTab = (tab) => {
    setSearchParams(prev => { prev.set('tab', tab); prev.set('page', '1'); return prev; });
  };
  const setPage = (p) => {
    const next = typeof p === 'function' ? p(page) : p;
    setSearchParams(prev => { prev.set('page', String(next)); return prev; });
  };

  // Dispute
  const [disputingLeadId,  setDisputingLeadId]  = useState(null);
  const [disputeReason,    setDisputeReason]    = useState('');
  const [disputeError,     setDisputeError]     = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const TABS = [
    { id: 'available', label: 'Available' },
    { id: 'unlocked',  label: 'My Unlocked' },
    { id: 'expired',   label: 'Expired' },
  ];

  const fetchLeadsAndWallet = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setTabLoading(true);
    try {
      const [leadsRes, walletRes] = await Promise.all([
        API.get(`/leads/nearby?page=${page}&limit=10&tab=${activeTab}`),
        API.get('/wallet')
      ]);
      setLeads(leadsRes.data.leads || []);
      setTotalPages(leadsRes.data.pages || 1);
      setWalletBalance(
        walletRes.data.availableBalance !== undefined
          ? walletRes.data.availableBalance
          : (walletRes.data.balance || 0)
      );
    } catch (err) {
      if (!silent) {
        toast({ title: 'Fetch Failed', description: err.response?.data?.message || 'Could not sync leads.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
      setTabLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    // Initial load
    const isInitial = leads.length === 0 && loading;
    fetchLeadsAndWallet(isInitial ? false : true);

    // ── Real-time: socket event when new lead is broadcast ──
    const handleNewLeadSocket = () => {
      fetchLeadsAndWallet(true);
    };

    // ── Fallback: window notification event ──
    const handleNewNotification = (e) => {
      const data = e.detail;
      if (data?.type === 'lead') {
        fetchLeadsAndWallet(true);
      }
    };

    // ── Polling: silent refresh every 30 seconds ──
    const pollInterval = setInterval(() => {
      fetchLeadsAndWallet(true);
    }, 30000);

    if (socket) socket.on('NEW_LEAD_REQUEST', handleNewLeadSocket);
    window.addEventListener('NEW_NOTIFICATION', handleNewNotification);

    return () => {
      if (socket) socket.off('NEW_LEAD_REQUEST', handleNewLeadSocket);
      window.removeEventListener('NEW_NOTIFICATION', handleNewNotification);
      clearInterval(pollInterval);
    };
  }, [fetchLeadsAndWallet, socket]);

  const confirmUnlock = (leadId, price) => setUnlockModal({ leadId, price });

  const handleUnlock = async () => {
    if (!unlockModal) return;
    setUnlocking(true);
    try {
      const { data } = await API.post(`/leads/${unlockModal.leadId}/unlock`);
      if (data.success) {
        toast({ title: 'Lead Unlocked!', description: 'Customer contact details are now visible.' });
        setUnlockModal(null);
        fetchLeadsAndWallet();
        window.dispatchEvent(new CustomEvent('WALLET_UPDATED'));
      }
    } catch (err) {
      setUnlockModal(null);
      if (err.response?.status === 402 && err.response?.data?.paymentRequired) {
        handleRazorpayCheckout(unlockModal.leadId, err.response.data.leadPrice);
      } else {
        toast({ title: 'Unlock Failed', description: err.response?.data?.message || 'Please try again.', variant: 'destructive' });
      }
    } finally {
      setUnlocking(false);
    }
  };

  const handleRazorpayCheckout = async (leadId, amount) => {
    try {
      const { data: orderData } = await API.post('/payment/order', { amount, type: 'lead_unlock', leadId });
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_mock',
        amount: orderData.amount,
        currency: 'INR',
        name: 'RozSewa',
        description: 'Lead Unlock Fee',
        order_id: orderData.id,
        handler: async (response) => {
          try {
            await API.post('/payment/verify-lead-payment', { ...response, leadId });
            toast({ title: 'Payment Successful', description: 'Lead unlocked!' });
            fetchLeadsAndWallet();
          } catch {
            toast({ title: 'Verification Failed', variant: 'destructive' });
          }
        },
        theme: { color: '#7c3aed' }
      };
      if (window.Razorpay) { new window.Razorpay(options).open(); }
      else toast({ title: 'Payment gateway not loaded', variant: 'destructive' });
    } catch (err) {
      toast({ title: 'Payment Failed', description: err.response?.data?.message || 'Try again.', variant: 'destructive' });
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!disputeReason.trim()) {
      setDisputeError('Please describe your reason before submitting a claim.');
      toast({
        title: '⚠️ Reason Required',
        description: 'Please describe why this lead was invalid before submitting.',
        variant: 'destructive',
        duration: 4000,
      });
      return;
    }
    setDisputeError('');
    setSubmittingDispute(true);
    try {
      await API.post(`/leads/${disputingLeadId}/dispute`, { reason: disputeReason });
      toast({ title: '✅ Dispute Raised', description: 'Admin will review your claim within 24 hours.' });
      setDisputingLeadId(null);
      setDisputeReason('');
      setDisputeError('');
      fetchLeadsAndWallet();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Could not submit claim. Try again.';
      setDisputeError(errMsg);
      toast({ title: 'Submission Failed', description: errMsg, variant: 'destructive' });
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24 transition-colors duration-500">
      <ProviderTopNav />

      <main className="container max-w-3xl px-4 py-6 space-y-5 animate-in fade-in duration-500">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Lead Marketplace
            </p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Available Leads</h1>
          </div>
          <button onClick={() => fetchLeadsAndWallet(false)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white dark:bg-slate-900 border border-border shadow-sm hover:shadow-md text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-all active:scale-95">
            <RefreshCcw className={`h-3.5 w-3.5 ${(loading || tabLoading) ? 'animate-spin text-violet-600' : ''}`} /> Refresh
          </button>
        </div>

        {/* Wallet Balance */}
        <div className="bg-white dark:bg-slate-900/50 border border-violet-100 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Available Balance</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">₹{walletBalance.toFixed(2)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Minimum balance required to unlock leads</p>
            </div>
          </div>
          <IndianRupee className="h-8 w-8 text-violet-100 dark:text-violet-900/40 shrink-0" />
        </div>

        {/* Privacy Notice */}
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
          <Shield className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-[10px] font-medium text-amber-800">Customer contact details are masked until you unlock a lead. The platform does not charge any commission.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                  : 'bg-white dark:bg-slate-900 border border-border text-slate-500 hover:text-slate-900'
              }`}>
              {tab.label}
              {tabLoading && activeTab === tab.id && (
                <span className="inline-block ml-1.5 h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Lead Cards */}
        <div className={`space-y-4 transition-opacity duration-200 ${tabLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {loading ? (
            <div className="space-y-4">
              {[1,2].map(i => <div key={i} className="h-64 bg-white dark:bg-slate-900/50 border border-border rounded-2xl animate-pulse" />)}
            </div>
          ) : leads.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-16 flex flex-col items-center gap-3 text-center">
              <div className="h-14 w-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                <Briefcase className="h-7 w-7 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">
                {activeTab === 'available' ? 'No Leads Available' : activeTab === 'unlocked' ? 'No Unlocked Leads' : 'No Expired Leads'}
              </h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs">
                {activeTab === 'available' ? 'No new requests in your area. Stay active to receive notifications!' : 'Nothing here yet.'}
              </p>
            </div>
          ) : (
            leads.map(lead => (
              <LeadCard
                key={lead._id}
                lead={lead}
                onUnlock={confirmUnlock}
                onDispute={setDisputingLeadId}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-3 pt-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-5 py-2.5 rounded-xl border border-border bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 hover:shadow-sm transition-all">
              ← Prev
            </button>
            <span className="flex items-center px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-5 py-2.5 rounded-xl border border-border bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 hover:shadow-sm transition-all">
              Next →
            </button>
          </div>
        )}
      </main>

      {/* Unlock Confirmation Modal */}
      {unlockModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !unlocking && setUnlockModal(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-border">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Unlock className="h-5 w-5 text-emerald-500" /> Confirm Unlock
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You are about to unlock this lead for <strong>₹{unlockModal.price}</strong>. This will deduct from your wallet or subscription credits.
            </p>
            <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
              After unlocking, the customer's name, phone, and address will be visible. The platform charges no further commission.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setUnlockModal(null)} disabled={unlocking}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                Cancel
              </button>
              <button onClick={handleUnlock} disabled={unlocking}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                {unlocking ? 'Unlocking...' : 'Confirm Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputingLeadId && (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center pt-16 p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => { setDisputingLeadId(null); setDisputeError(''); }} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-border">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> Raise Refund Dispute
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Describe why this lead was invalid. False claims may restrict your account.
            </p>
            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <textarea
                  rows={4}
                  value={disputeReason}
                  onChange={e => { setDisputeReason(e.target.value); if (e.target.value.trim()) setDisputeError(''); }}
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-medium focus:ring-2 outline-none text-slate-800 dark:text-white resize-none transition-colors ${
                    disputeError
                      ? 'border-rose-400 focus:ring-rose-500/20 bg-rose-50 dark:bg-rose-900/10'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-rose-500/20'
                  }`}
                  placeholder="e.g. Phone number was incorrect. Customer refused the work immediately." />
                {disputeError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">{disputeError}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setDisputingLeadId(null); setDisputeError(''); }}
                  className="flex-1 py-3 border border-border rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={submittingDispute}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60">
                  {submittingDispute ? 'Submitting...' : 'Submit Claim'}
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
