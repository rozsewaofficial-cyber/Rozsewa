import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase, Clock, CheckCircle2, XCircle, AlertTriangle, Lock,
  Unlock, RefreshCcw, Plus, ChevronRight, Eye, Calendar,
  MapPin, Edit3, Sparkles, Filter, X
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:              { label: 'Draft',            color: 'bg-slate-100 text-slate-600 border-slate-200',     icon: Edit3 },
  available:          { label: 'Live',             color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Sparkles },
  partially_unlocked: { label: 'Unlocked',         color: 'bg-blue-50 text-blue-700 border-blue-200',         icon: Unlock },
  fully_unlocked:     { label: 'Fully Unlocked',   color: 'bg-violet-50 text-violet-700 border-violet-200',   icon: CheckCircle2 },
  expired:            { label: 'Expired',          color: 'bg-orange-50 text-orange-700 border-orange-200',   icon: Clock },
  cancelled:          { label: 'Cancelled',        color: 'bg-rose-50 text-rose-700 border-rose-200',         icon: XCircle },
  disputed:           { label: 'Disputed',         color: 'bg-red-50 text-red-700 border-red-200',            icon: AlertTriangle },
  refunded:           { label: 'Refunded',         color: 'bg-teal-50 text-teal-700 border-teal-200',         icon: CheckCircle2 },
  closed:             { label: 'Closed',           color: 'bg-slate-50 text-slate-500 border-slate-100',      icon: Lock },
};

// ─── Countdown Timer ──────────────────────────────────────────────────────────
const CountdownTimer = ({ expiry }) => {
  const [remaining, setRemaining] = useState('');
  const [isUrgent, setIsUrgent]   = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiry) - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`);
      setIsUrgent(diff < 2 * 3600000); // < 2h
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [expiry]);

  return (
    <span className={`text-[10px] font-bold flex items-center gap-1 ${isUrgent ? 'text-rose-600' : 'text-slate-400'}`}>
      <Clock className="h-3 w-3" />{remaining}
    </span>
  );
};

// ─── Lead Card ─────────────────────────────────────────────────────────────────
const LeadCard = ({ lead, onEdit, onView }) => {
  const navigate = useNavigate();
  const conf     = STATUS_CONFIG[lead.status] || STATUS_CONFIG.closed;
  const StatusIcon = conf.icon;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${conf.color}`}>
              <StatusIcon className="h-2.5 w-2.5" />
              {conf.label}
            </span>
            {lead.categoryId?.name && (
              <span className="text-[9px] font-black text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                {lead.categoryId.name}
              </span>
            )}
            {lead.isEditLocked && (
              <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            )}
          </div>
          <h3 className="text-sm font-black text-slate-900 leading-tight line-clamp-1">
            {lead.requirementTitle || lead.requirementForm?.description?.slice(0, 60) || 'Untitled Request'}
          </h3>
          {lead.requirementDesc && (
            <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-2">
              {lead.requirementDesc}
            </p>
          )}
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="px-5 pb-3 grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-slate-50 rounded-xl">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unlocks</p>
          <p className="text-sm font-black text-slate-900">{lead.unlockCount || 0} / {lead.maxUnlockLimit || 1}</p>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-xl">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Views</p>
          <p className="text-sm font-black text-slate-900">{lead.viewCount || 0}</p>
        </div>
        <div className="text-center p-2 bg-slate-50 rounded-xl">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Price</p>
          <p className="text-sm font-black text-slate-900">₹{lead.leadPrice || 0}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between gap-3 border-t border-slate-50 pt-3">
        <div className="space-y-0.5">
          <p className="text-[9px] font-medium text-slate-400">
            Submitted {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          {lead.expiry && ['available', 'partially_unlocked'].includes(lead.status) && (
            <CountdownTimer expiry={lead.expiry} />
          )}
          {lead.expiry && ['expired', 'closed'].includes(lead.status) && (
            <p className="text-[9px] text-slate-400 font-medium">
              Expired {new Date(lead.expiry).toLocaleDateString('en-IN')}
            </p>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {lead.isDraft && (
            <button onClick={() => onEdit(lead)}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95">
              <Edit3 className="h-3 w-3" /> Continue
            </button>
          )}
          {lead.canEdit && !lead.isDraft && (
            <button onClick={() => onEdit(lead)}
              className="flex items-center gap-1.5 px-3 py-2 border border-violet-200 bg-violet-50 text-violet-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all hover:bg-violet-100 active:scale-95">
              <Edit3 className="h-3 w-3" /> Edit
            </button>
          )}
          <button onClick={() => onView(lead)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all hover:bg-slate-50 active:scale-95">
            <Eye className="h-3 w-3" /> View
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const MyLeads = () => {
  const navigate   = useNavigate();
  const { toast }  = useToast();

  const [leads,      setLeads]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab,  setActiveTab]  = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);

  const TABS = [
    { id: 'all',      label: 'All' },
    { id: 'draft',    label: 'Drafts' },
    { id: 'available', label: 'Active' },
    { id: 'partially_unlocked', label: 'Unlocked' },
    { id: 'expired',  label: 'Expired' },
    { id: 'closed',   label: 'Closed' },
  ];

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = activeTab === 'all' ? '' : `&status=${activeTab}`;
      const { data } = await API.get(`/leads/my?page=${page}&limit=10${statusParam}`);
      setLeads(data.leads || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      toast({ title: 'Failed to load requests', description: err.response?.data?.message || 'Try again later', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleEdit = (lead) => {
    navigate(`/submit-lead?category=${lead.categoryId?._id || lead.categoryId}&name=${encodeURIComponent(lead.categoryId?.name || '')}&draftId=${lead._id}`);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-24">
      <TopNav title="My Requests" />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Requests</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track all your service requests and their status.</p>
          </div>
          <button onClick={() => navigate('/home')}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-violet-500/20 transition-all active:scale-95">
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                  : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'
              }`}>
              {tab.label}
            </button>
          ))}
          <button onClick={fetchLeads} className="shrink-0 px-3 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-all">
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-violet-500' : ''}`} />
          </button>
        </div>

        {/* Lead Cards */}
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-44 bg-white border border-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-violet-50 flex items-center justify-center">
              <Briefcase className="h-8 w-8 text-violet-300" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">No Requests Found</h3>
              <p className="text-sm text-slate-400 mt-1">
                {activeTab === 'all' ? "You haven't submitted any service requests yet." : `No ${activeTab} requests.`}
              </p>
            </div>
            <button onClick={() => navigate('/home')}
              className="px-6 py-3 bg-violet-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-violet-500/20 transition-all active:scale-95 hover:bg-violet-700">
              Post a New Request
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map(lead => (
              <LeadCard key={lead._id} lead={lead} onEdit={handleEdit} onView={setSelectedLead} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-3 pt-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 hover:shadow-sm transition-all">
              ← Prev
            </button>
            <span className="flex items-center px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {page} / {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 disabled:opacity-30 hover:shadow-sm transition-all">
              Next →
            </button>
          </div>
        )}
      </main>

      <BottomNav />

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[selectedLead.status]?.color || STATUS_CONFIG.closed.color}`}>
                  {STATUS_CONFIG[selectedLead.status]?.label || 'Closed'}
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-1">Request Details</h3>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-1 text-left">
              {/* Category & Title */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {selectedLead.categoryId?.name && (
                    <span className="text-[9px] font-black text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                      {selectedLead.categoryId.name}
                    </span>
                  )}
                  <span className="text-[9px] font-medium text-slate-400">
                    ID: #{selectedLead._id?.slice(-8)}
                  </span>
                </div>
                <h2 className="text-base font-black text-slate-900">
                  {selectedLead.requirementTitle || 'Untitled Request'}
                </h2>
                {selectedLead.requirementDesc ? (
                  <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                    {selectedLead.requirementDesc}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No description provided.</p>
                )}
              </div>

              {/* Schedule Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Preferred Date</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                    {selectedLead.preferredDate ? new Date(selectedLead.preferredDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Flexible'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Preferred Time</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                    {selectedLead.preferredTime || 'Flexible'}
                  </p>
                </div>
              </div>

              {/* Dynamic Answers */}
              {selectedLead.dynamicAnswers && selectedLead.dynamicAnswers.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requirement Answers</h4>
                  <div className="space-y-2">
                    {selectedLead.dynamicAnswers.map((ans, idx) => (
                      <div key={idx} className="p-3 border border-slate-100 rounded-xl space-y-1">
                        <p className="text-[10px] font-bold text-slate-500">{ans.label}</p>
                        <p className="text-xs font-black text-slate-800">{String(ans.value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Location Details */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location Info</h4>
                <div className="p-4 border border-slate-100 rounded-2xl bg-white space-y-3">
                  <div className="flex gap-2 items-start">
                    <MapPin className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {[
                          selectedLead.locationDetail?.houseNo,
                          selectedLead.locationDetail?.apartment,
                          selectedLead.locationDetail?.street,
                          selectedLead.locationDetail?.landmark,
                          selectedLead.locationDetail?.area,
                          selectedLead.locationDetail?.city,
                          selectedLead.locationDetail?.state,
                          selectedLead.locationDetail?.pincode
                        ].filter(Boolean).join(', ') || 'No address details provided.'}
                      </p>
                    </div>
                  </div>

                  {selectedLead.location?.coordinates && (
                    <div className="rounded-2xl overflow-hidden border border-slate-100 h-32 mt-2">
                      <iframe
                        title="modal-map"
                        className="w-full h-full"
                        src={`https://maps.google.com/maps?q=${selectedLead.location.coordinates[1]},${selectedLead.location.coordinates[0]}&z=14&output=embed`}
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics Strip */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Price</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">₹{selectedLead.leadPrice || 0}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unlocks</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{selectedLead.unlockCount || 0} / {selectedLead.maxUnlockLimit || 1}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Views</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{selectedLead.viewCount || 0}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50/50 rounded-b-3xl">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLeads;
