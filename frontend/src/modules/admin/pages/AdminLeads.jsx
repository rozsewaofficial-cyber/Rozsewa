import { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Briefcase, IndianRupee, Percent, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, Search, ChevronDown, ChevronUp, RefreshCcw,
  MapPin, Calendar, User, Phone, Mail, Eye, ShieldCheck, XCircle, ShieldAlert,
  Loader2, Settings, ChevronLeft, ChevronRight
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import API from "@/lib/api";

const AdminLeads = () => {
  const { setTitle } = useOutletContext();
  const navigate = useNavigate();
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
  const [expandedLeads, setExpandedLeads] = useState({});
  const [filter, setFilter] = useState("all"); // 'all', 'pending', 'available', 'unlocked', 'completed', 'expired', 'disputed', 'closed'
  const [search, setSearch] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  const todayDate = new Date().toLocaleDateString("en-CA");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search, filterCity, filterFromDate, filterToDate]);

  useEffect(() => {
    setTitle("Leads Management");
    fetchLeadsData();

    const handleNewNotification = (e) => {
      const data = e.detail;
      if (data?.type === 'lead') {
        fetchLeadsData(true);
      }
    };

    window.addEventListener('NEW_NOTIFICATION', handleNewNotification);
    return () => window.removeEventListener('NEW_NOTIFICATION', handleNewNotification);
  }, [setTitle]);

  const fetchLeadsData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [leadsRes, disputesRes, statsRes] = await Promise.all([
        API.get("/admin/leads"),
        API.get("/admin/leads/disputes"),
        API.get("/admin/leads/stats")
      ]);
      setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : (leadsRes.data.leads || []));
      setDisputes(disputesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to fetch leads data", err);
      if (!silent) {
        toast({ title: "Fetch Failed", description: "Could not sync leads database.", variant: "destructive" });
      }
    } finally {
      if (!silent) setLoading(false);
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
    return (leads || [])
      .filter(l => {
        if (filter === "all") return true;
        if (filter === "available") return l.status === "available" || l.status === "partially_unlocked";
        if (filter === "unlocked") return l.status === "partially_unlocked" || l.status === "fully_unlocked";
        return l.status === filter;
      })
      .filter(l => {
        const searchLower = search.toLowerCase();
        const serviceName = l.service || l.requirementTitle || l.categoryId?.name || '';

        // Search text
        if (search && !l._id.toLowerCase().includes(searchLower) && !serviceName.toLowerCase().includes(searchLower) && !(l.customer?.name || '').toLowerCase().includes(searchLower)) {
          return false;
        }

        // City / Address filter
        if (filterCity) {
          const addr = [
            l.locationDetail?.houseNo, l.locationDetail?.apartment, l.locationDetail?.street,
            l.locationDetail?.landmark, l.locationDetail?.area, l.locationDetail?.city,
            l.locationDetail?.state, l.locationDetail?.pincode
          ].filter(Boolean).join(', ') + ' ' + (l.requirementForm?.address || '');

          if (!addr.toLowerCase().includes(filterCity.toLowerCase())) {
            return false;
          }
        }

        // Date filter
        if (filterFromDate || filterToDate) {
          if (!l.createdAt) return false;
          const bDate = new Date(l.createdAt);
          if (filterFromDate) {
            const fDate = new Date(filterFromDate);
            fDate.setHours(0, 0, 0, 0);
            if (bDate < fDate) return false;
          }
          if (filterToDate) {
            const tDate = new Date(filterToDate);
            tDate.setHours(23, 59, 59, 999);
            if (bDate > tDate) return false;
          }
        }

        return true;
      });
  }, [leads, filter, search, filterCity, filterFromDate, filterToDate]);

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = useMemo(() => {
    return filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredLeads, currentPage]);

  const statusConfig = {
    pending: { bg: "bg-slate-100 text-slate-700", label: "Pending" },
    available: { bg: "bg-emerald-50 text-emerald-700 border-emerald-100", label: "Available" },
    partially_unlocked: { bg: "bg-blue-50 text-blue-700 border-blue-100", label: "Partially Open" },
    fully_unlocked: { bg: "bg-slate-100 text-slate-600 border-slate-200", label: "Fully Taken" },
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
        <div className="flex items-center gap-2">
          <button onClick={() => fetchLeadsData(false)} disabled={loading} className="flex h-11 items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/60 px-5 text-[10px] font-black uppercase tracking-widest text-slate-700 shadow-sm transition-all active:scale-95 disabled:opacity-50">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>
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
      <div className="flex flex-col gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-[2]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by lead ID, customer, service..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            />
          </div>

          <div className="flex-1">
            <input
              type="text"
              placeholder="City / Address..."
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            />
          </div>
          <div className="flex-1">
            <input
              type="date"
              value={filterFromDate}
              onChange={e => setFilterFromDate(e.target.value)}
              onBlur={e => {
                const val = e.target.value;
                if (val && val > todayDate) {
                  setFilterFromDate(todayDate);
                }
              }}
              max={todayDate}
              title="From Date"
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-slate-500"
            />
          </div>
          <div className="flex-1">
            <input
              type="date"
              value={filterToDate}
              onChange={e => setFilterToDate(e.target.value)}
              onBlur={e => {
                const val = e.target.value;
                if (val && val > todayDate) {
                  setFilterToDate(todayDate);
                } else if (val && filterFromDate && val < filterFromDate) {
                  setFilterToDate(filterFromDate);
                }
              }}
              min={filterFromDate || undefined}
              max={todayDate}
              title="To Date"
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-slate-500"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1">
            {["all", "pending", "available", "unlocked", "completed", "expired", "disputed", "closed"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${filter === f ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-50 text-slate-500 hover:text-slate-900"
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
          {(search || filterCity || filterFromDate || filterToDate || filter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterCity("");
                setFilterFromDate("");
                setFilterToDate("");
                setFilter("all");
              }}
              className="text-xs font-black text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 px-4 py-3 rounded-2xl flex items-center gap-1.5 uppercase tracking-widest active:scale-95 transition-all self-end sm:self-auto shrink-0"
            >
              Clear Filters
            </button>
          )}
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
          paginatedLeads.map((lead) => {
            const conf = statusConfig[lead.status] || statusConfig.pending;
            return (
              <motion.div
                layout
                key={lead._id}
                className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all flex flex-col gap-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
                  <div className="space-y-3 flex-1 text-left">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-150">ID: {lead._id.substring(lead._id.length - 8).toUpperCase()}</span>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${conf.bg}`}>{conf.label}</span>
                      {lead.categoryId?.name && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border bg-slate-50 text-slate-500 border-slate-150">{lead.categoryId.name}</span>
                      )}
                      {lead.disputeStatus !== 'none' && (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border bg-red-50 text-red-700 border-red-100">Dispute: {lead.disputeStatus}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 leading-tight">
                        {lead.requirementTitle || lead.service || lead.categoryId?.name || 'Service Request'}
                      </h3>
                      <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Client: {lead.customer?.name || "Guest"} ({lead.customer?.mobile || "N/A"})</p>
                    </div>
                    <div className="text-xs font-semibold text-slate-600 bg-slate-50/80 border border-slate-200/40 p-4 rounded-2xl">
                      <p className="font-black text-[9px] text-slate-400 uppercase tracking-widest mb-1.5">Requirement Details</p>
                      <p>{lead.requirementDesc || lead.requirementForm?.description || "No description provided."}</p>
                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200/50">
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {lead.preferredDate || lead.requirementForm?.preferredDate || 'N/A'}
                          {(lead.preferredTime || lead.requirementForm?.preferredTime) ? ` at ${lead.preferredTime || lead.requirementForm?.preferredTime}` : ''}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {[lead.locationDetail?.houseNo, lead.locationDetail?.street, lead.locationDetail?.city].filter(Boolean).join(', ') || lead.requirementForm?.address || "Coordinate Location"}
                        </p>
                        {lead.createdAt && (
                          <p className="flex items-center gap-1.5 text-violet-600 font-bold col-span-2 mt-1.5 border-t border-slate-200/40 pt-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Generated: {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(lead.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                        )}
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
                      <button
                        onClick={() => setExpandedLeads(prev => ({ ...prev, [lead._id]: !prev[lead._id] }))}
                        className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {expandedLeads[lead._id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {expandedLeads[lead._id] ? 'Hide Details' : 'View Details'}
                      </button>
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
                </div>

                {expandedLeads[lead._id] && (
                  <div className="border-t border-slate-100 pt-5 mt-2 text-left space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Client contact info details */}
                      <div className="bg-emerald-50/60 border border-emerald-100 p-5 rounded-2xl space-y-3">
                        <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Customer Contact Revealed
                        </p>
                        <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-2.5 text-xs font-semibold text-slate-700">
                          <span className="text-slate-400 font-bold">Name</span>
                          <span className="font-black text-slate-800">{lead.customer?.name || "Guest"}</span>

                          <span className="text-slate-400 font-bold">Phone</span>
                          <span className="font-black text-emerald-700 flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" /> {lead.customer?.mobile || "N/A"}
                          </span>

                          <span className="text-slate-400 font-bold">Email</span>
                          <span className="font-black text-violet-700 flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" /> {lead.customer?.email || "N/A"}
                          </span>

                          <span className="text-slate-400 font-bold">Address</span>
                          <span className="font-bold text-slate-850">
                            {lead.requirementForm?.address || [lead.locationDetail?.houseNo, lead.locationDetail?.apartment, lead.locationDetail?.street, lead.locationDetail?.landmark, lead.locationDetail?.area, lead.locationDetail?.city, lead.locationDetail?.state, lead.locationDetail?.pincode].filter(Boolean).join(', ') || 'N/A'}
                          </span>
                        </div>
                        {lead.location?.coordinates && (
                          <div className="pt-2">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${lead.location.coordinates[1]},${lead.location.coordinates[0]}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                            >
                              <MapPin className="h-3 w-3" /> Open in Maps
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Questionnaire dynamic answers */}
                      <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Questionnaire & Details</h4>
                        {lead.dynamicAnswers && lead.dynamicAnswers.length > 0 ? (
                          <div className="space-y-2 text-xs leading-relaxed max-h-[160px] overflow-y-auto pr-2">
                            {lead.dynamicAnswers.map((a, i) => (
                              <div key={i} className="flex gap-2 items-start py-1 border-b border-slate-100 last:border-0">
                                <span className="font-black text-slate-500 min-w-[100px] max-w-[140px] truncate">{a.label || a.question}:</span>
                                <span className="text-slate-800 font-bold">{Array.isArray(a.value) ? a.value.join(', ') : String(a.value)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 font-bold italic py-4">No custom questionnaire answers provided for this lead.</p>
                        )}
                      </div>
                    </div>

                    {/* Media Attachments & Unlocked Providers row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Media Attachments */}
                      <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Attached Photos</h4>
                        {lead.attachments?.length > 0 || lead.requirementForm?.images?.length > 0 ? (
                          <div className="flex flex-wrap gap-3 pt-1">
                            {(lead.attachments || []).map((att, idx) => (
                              <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="block border border-slate-200 hover:border-blue-500 rounded-xl overflow-hidden hover:opacity-90 hover:scale-105 transition-all shadow-sm">
                                <img src={att.url} alt="Attachment" className="h-16 w-16 object-cover" />
                              </a>
                            ))}
                            {(lead.requirementForm?.images || []).map((imgUrl, idx) => (
                              <a key={idx} href={imgUrl} target="_blank" rel="noreferrer" className="block border border-slate-200 hover:border-blue-500 rounded-xl overflow-hidden hover:opacity-90 hover:scale-105 transition-all shadow-sm">
                                <img src={imgUrl} alt="Attachment" className="h-16 w-16 object-cover" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 font-bold italic py-4">No photos or files attached to this lead.</p>
                        )}
                      </div>

                      {/* Unlocked Partners */}
                      <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Unlocked Partners ({lead.unlockedProviders?.length || 0})</h4>
                        {lead.unlockedProviders && lead.unlockedProviders.length > 0 ? (
                          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2">
                            {lead.unlockedProviders.map((p, idx) => (
                              <div key={idx} className="bg-white border border-slate-150 p-3 rounded-xl text-xs space-y-1 shadow-sm text-left">
                                <p className="font-black text-slate-800">{p.shopName || p.ownerName} <span className="text-[10px] text-slate-400 font-semibold">({p.ownerName})</span></p>
                                <p className="text-slate-500 font-bold flex items-center gap-2">
                                  <span className="font-mono">📞 {p.mobile}</span>
                                  {p.email && <span className="font-mono">| ✉️ {p.email}</span>}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 font-bold italic py-4">No partners have unlocked this lead yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm mt-2">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
            Showing <span className="text-gray-900 font-black">{((currentPage - 1) * itemsPerPage) + 1}</span> to{" "}
            <span className="text-gray-900 font-black">
              {Math.min(currentPage * itemsPerPage, filteredLeads.length)}
            </span>{" "}
            of <span className="text-gray-900 font-black">{filteredLeads.length}</span> leads
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Only show 5 pages max around current page
              if (totalPages > 5 && Math.abs(page - currentPage) > 2 && page !== 1 && page !== totalPages) {
                if (page === 2 || page === totalPages - 1) return <span key={page} className="px-1 text-slate-400">...</span>;
                return null;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 min-w-8 px-2.5 flex items-center justify-center rounded-lg text-[10px] font-black transition-all shadow-sm ${page === currentPage
                      ? "bg-blue-600 text-white border border-blue-600"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
