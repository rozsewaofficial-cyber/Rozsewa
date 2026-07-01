import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Briefcase, IndianRupee, Percent, TrendingUp, AlertTriangle, 
  CheckCircle2, Clock, Search, ChevronDown, RefreshCcw, 
  MapPin, Calendar, User, Phone, ShieldCheck, XCircle, ShieldAlert,
  Loader2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import API from "@/lib/api";

const AdminLeads = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [leads, setLeads] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    todayLeads: 0,
    unlockedLeadsCount: 0,
    revenue: 0,
    refundAmount: 0,
    conversionRate: 0,
    pendingDisputesCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // 'all', 'pending', 'available', 'unlocked', 'completed', 'expired', 'disputed', 'closed'
  const [search, setSearch] = useState("");

  useEffect(() => {
    setTitle("Leads Management");
    fetchLeadsData();
  }, [setTitle]);

  const fetchLeadsData = async () => {
    setLoading(true);
    try {
      const [leadsRes, disputesRes, statsRes] = await Promise.all([
        API.get("/admin/leads"),
        API.get("/admin/leads/disputes"),
        API.get("/admin/leads/stats")
      ]);
      setLeads(leadsRes.data);
      setDisputes(disputesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to fetch leads data", err);
      toast({ title: "Fetch Failed", description: "Could not sync leads database.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDispute = async (disputeId, decision) => {
    try {
      await API.post(`/admin/leads/disputes/${disputeId}/resolve`, { decision });
      toast({ title: `Dispute ${decision.toUpperCase()}`, description: `Dispute has been successfully marked as ${decision}.` });
      fetchLeadsData();
    } catch (err) {
      toast({ title: "Operation Failed", description: err.response?.data?.message || "Server error.", variant: "destructive" });
    }
  };

  const handleManualClose = async (leadId) => {
    const ok = await confirm("This will mark the lead as closed. Providers will no longer see it.", { title: "Close Lead", confirmLabel: "Close Lead", destructive: true });
    if (!ok) return;
    try {
      await API.post(`/admin/leads/${leadId}/close`);
      toast({ title: "Lead Closed", description: "Lead has been marked closed." });
      fetchLeadsData();
    } catch (err) {
      toast({ title: "Failed to close lead", variant: "destructive" });
    }
  };

  const filteredLeads = useMemo(() => {
    return leads
      .filter(l => filter === "all" || l.status === filter)
      .filter(l => 
        !search || 
        l._id.toLowerCase().includes(search.toLowerCase()) || 
        l.service.toLowerCase().includes(search.toLowerCase()) || 
        l.customer?.name?.toLowerCase().includes(search.toLowerCase())
      );
  }, [leads, filter, search]);

  const statusConfig = {
    pending: { bg: "bg-slate-100 text-slate-700", label: "Pending" },
    available: { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", label: "Available" },
    unlocked: { bg: "bg-blue-50 text-blue-700 border-blue-100", label: "Unlocked" },
    completed: { bg: "bg-green-50 text-green-700 border-green-100", label: "Completed" },
    cancelled: { bg: "bg-rose-50 text-rose-700 border-rose-100", label: "Cancelled" },
    expired: { bg: "bg-orange-50 text-orange-700 border-orange-100", label: "Expired" },
    disputed: { bg: "bg-red-50 text-red-700 border-red-100", label: "Disputed" },
    closed: { bg: "bg-slate-50 text-slate-500 border-slate-100", label: "Closed" }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Leads & Requirements Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Monitor customer intakes, track lead unlocking, and resolve provider disputes.</p>
        </div>
        <button onClick={fetchLeadsData} className="flex h-11 items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/60 px-5 text-[10px] font-black uppercase tracking-widest text-slate-700 shadow-sm transition-all active:scale-95">
          <RefreshCcw className="h-4 w-4" /> Refresh Data
        </button>
      </div>

      {/* Analytics Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: stats.totalLeads, desc: "Cumulative requests", icon: Briefcase, cls: "text-blue-700 bg-blue-50 border-blue-200" },
          { label: "Today's Intake", value: stats.todayLeads, desc: "New submissions", icon: Calendar, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
          { label: "Revenue Unlocks", value: `₹${stats.revenue}`, desc: "Direct / Wallet earnings", icon: IndianRupee, cls: "text-violet-700 bg-violet-50 border-violet-200" },
          { label: "Conversion Rate", value: `${stats.conversionRate}%`, desc: "Unlock Conversion", icon: TrendingUp, cls: "text-amber-700 bg-amber-50 border-amber-200" },
          { label: "Refund Amount", value: `₹${stats.refundAmount}`, desc: "Approved disputes refund", icon: IndianRupee, cls: "text-rose-700 bg-rose-50 border-rose-200" },
          { label: "Pending Disputes", value: stats.pendingDisputesCount, desc: "Action required", icon: AlertTriangle, cls: "text-red-700 bg-red-50 border-red-200" },
        ].map((s, i) => (
          <div key={i} className={`rounded-3xl border p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all ${s.cls}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-80">{s.label}</span>
              <s.icon className="h-4 w-4 opacity-75" />
            </div>
            <div>
              <h3 className="text-3xl font-black tracking-tight">{s.value}</h3>
              <p className="text-[10px] font-semibold opacity-60 mt-1">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by lead ID, customer, service..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" 
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          {["all", "pending", "available", "unlocked", "completed", "expired", "disputed", "closed"].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              className={`rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                filter === f ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-50 text-slate-500 hover:text-slate-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Main Leads Listing */}
      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border border-slate-100">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <Briefcase className="h-12 w-12 text-slate-300 mb-3 animate-bounce" />
            <h3 className="text-lg font-black text-slate-800">No Leads Found</h3>
            <p className="text-sm font-bold text-slate-400 mt-1">There are no leads matching your current criteria.</p>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const conf = statusConfig[lead.status] || statusConfig.pending;
            return (
              <motion.div 
                layout
                key={lead._id}
                className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-3 flex-1 text-left">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-150">ID: {lead._id.substring(lead._id.length - 8).toUpperCase()}</span>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${conf.bg}`}>{conf.label}</span>
                    {lead.disputeStatus !== 'none' && (
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border bg-red-50 text-red-700 border-red-100">Dispute: {lead.disputeStatus}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">{lead.service}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Client: {lead.customer?.name || "Guest"} ({lead.customer?.mobile || "N/A"})</p>
                  </div>
                  <div className="text-xs font-semibold text-slate-600 bg-slate-50/80 border border-slate-200/40 p-4 rounded-2xl">
                    <p className="font-black text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">Requirement Details</p>
                    <p>{lead.requirementForm?.description || "No description provided."}</p>
                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200/50">
                      <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {lead.requirementForm?.preferredDate} at {lead.requirementForm?.preferredTime}</p>
                      <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {lead.requirementForm?.address || "Coordinate Location"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between items-end gap-4 min-w-[200px] border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lead Value</p>
                    <p className="text-2xl font-black text-slate-900">₹{lead.leadPrice}</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Unlocks: {lead.unlockedProviders?.length || 0} / {lead.maxUnlockLimit}</p>
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    {lead.status !== 'closed' && lead.status !== 'completed' && lead.status !== 'expired' && (
                      <button 
                        onClick={() => handleManualClose(lead._id)}
                        className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Force Close
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Disputes Resolution Desk */}
      <div className="space-y-6 pt-6 border-t border-slate-100 text-left">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-500" /> Dispute Resolution Desk</h2>
          <p className="text-xs text-slate-500 mt-0.5">Approve refunds or reject false dispute claims raised by partners.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {disputes.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200/50 p-8 rounded-3xl text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">All Clear! No Pending Disputes</p>
            </div>
          ) : (
            disputes.map((dispute) => (
              <div key={dispute._id} className="bg-white rounded-3xl border border-red-100 p-5 flex flex-col md:flex-row justify-between gap-6 shadow-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100 uppercase tracking-wider">Dispute Open</span>
                    <span className="text-xs font-bold text-slate-400">Lead ID: {dispute.lead?._id?.substring(0, 8).toUpperCase() || dispute.lead?.substring(0, 8).toUpperCase()}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Partner: {dispute.provider?.ownerName || "Unknown Partner"} ({dispute.provider?.shopName})</h4>
                  <p className="text-xs text-slate-600 bg-red-50/20 border border-red-100/50 p-3 rounded-xl">Reason: <strong>{dispute.reason}</strong></p>
                </div>
                {dispute.adminDecision === 'pending' ? (
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button 
                      onClick={() => handleResolveDispute(dispute._id, "rejected")}
                      className="px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-900 text-xs font-bold rounded-xl transition-all active:scale-95"
                    >
                      Reject Dispute
                    </button>
                    <button 
                      onClick={() => handleResolveDispute(dispute._id, "approved")}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-md shadow-red-600/10"
                    >
                      Approve & Refund
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-slate-400 self-center">Decision: {dispute.adminDecision.toUpperCase()} ({dispute.refundStatus})</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default AdminLeads;
