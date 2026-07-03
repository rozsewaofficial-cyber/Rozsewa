import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  ShieldAlert, Search, Download, Filter, CheckCircle2,
  Loader2, RefreshCw, Eye, Calendar, User, IndianRupee,
  AlertTriangle, X, ChevronLeft, ChevronRight, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const STATUS_COLORS = {
  cash_collected:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  online_verified: "bg-blue-50 text-blue-700 border-blue-200",
  staff_verified:  "bg-violet-50 text-violet-700 border-violet-200",
  not_collected:   "bg-amber-50 text-amber-700 border-amber-200",
};

const AuditDrawer = ({ bookingId, onClose }) => {
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) return;
    API.get(`/admin/bookings/${bookingId}/payment-audit`)
      .then(({ data }) => setAudit(data))
      .catch(() => setAudit([]))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const ACTION_LABELS = {
    cash_collected:      { label: "Cash Collected",        color: "bg-emerald-100 text-emerald-700" },
    online_verified:     { label: "Online Verified",       color: "bg-blue-100 text-blue-700" },
    staff_verified:      { label: "Staff Verified",        color: "bg-violet-100 text-violet-700" },
    unauthorized_attempt:{ label: "⚠️ Unauthorized Attempt", color: "bg-red-100 text-red-700" },
    flag_cleared:        { label: "Flag Cleared",          color: "bg-gray-100 text-gray-700" },
    admin_status_update: { label: "Admin Update",          color: "bg-orange-100 text-orange-700" },
    admin_override:      { label: "Admin Override",        color: "bg-purple-100 text-purple-700" },
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Payment Audit Trail</h2>
            <p className="text-xs text-gray-500 mt-0.5">Booking #{bookingId?.slice(-6)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
            </div>
          ) : audit.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Clock size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No audit records found.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100" />
              <div className="space-y-6">
                {audit.map((record, i) => {
                  const cfg = ACTION_LABELS[record.action] || { label: record.action, color: "bg-gray-100 text-gray-700" };
                  return (
                    <div key={i} className="flex gap-4 pl-2">
                      <div className={`relative z-10 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${record.action === 'unauthorized_attempt' ? 'bg-red-500 text-white' : 'bg-indigo-500 text-white'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                          {record.amount && (
                            <span className="text-xs text-gray-500 font-medium">₹{record.amount.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                        {record.note && <p className="text-xs text-gray-600 mb-2">{record.note}</p>}
                        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                          {record.providerId && <span>Partner: {record.providerId.shopName || record.providerId.ownerName}</span>}
                          {record.staffId && <span>Staff: {record.staffId.name}</span>}
                          {record.adminId && <span>Admin: {record.adminId.name}</span>}
                          <span>{new Date(record.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                        {record.previousPaymentStatus && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-gray-400">Status:</span>
                            <span className="font-mono bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">{record.previousPaymentStatus}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-mono bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-700">{record.newPaymentStatus || '—'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const AdminUnauthorizedPayments = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [bookings, setBookings]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [clearing, setClearing]       = useState("");
  const [auditBookingId, setAuditBookingId] = useState(null);

  // Filters
  const [search, setSearch]           = useState("");
  const [startDate, setStartDate]     = useState("");
  const [endDate, setEndDate]         = useState("");
  const [page, setPage]               = useState(1);
  const limit = 20;

  useEffect(() => { setTitle("Unauthorized Payments"); }, [setTitle]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (startDate) params.startDate = startDate;
      if (endDate)   params.endDate   = endDate;
      const { data } = await API.get("/admin/bookings/unauthorized-payments", { params });
      setBookings(data.bookings || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast({ title: "Fetch Failed", description: "Could not load unauthorized payment records.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, startDate, endDate]);

  const handleClearFlag = async (bookingId) => {
    setClearing(bookingId);
    try {
      await API.patch(`/admin/bookings/${bookingId}/clear-payment-flag`, {
        investigationNote: "Cleared via admin panel after investigation."
      });
      toast({ title: "Flag Cleared", description: `Booking #${bookingId.slice(-6)} marked as investigated.` });
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to clear flag.", variant: "destructive" });
    } finally {
      setClearing("");
    }
  };

  const handleExportCSV = () => {
    if (!bookings.length) return;
    const headers = ["Booking ID","Partner","Customer","Amount","Payment Mode","Flag Note","Flagged At","Collection Status"];
    const rows = bookings.map(b => [
      b._id.slice(-6),
      b.unauthorizedAttemptedBy?.shopName || b.unauthorizedAttemptedBy?.ownerName || "—",
      b.userId?.name || "—",
      b.totalAmount,
      b.paymentMode === "now" ? "Online" : "Cash",
      `"${(b.unauthorizedPaymentNote || "").replace(/"/g, "'")}"`,
      b.unauthorizedPaymentAt ? new Date(b.unauthorizedPaymentAt).toLocaleString("en-IN") : "—",
      b.collectionStatus || "—"
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `unauthorized-payments-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings;
    const s = search.toLowerCase();
    return bookings.filter(b =>
      b._id.toLowerCase().includes(s) ||
      (b.userId?.name || "").toLowerCase().includes(s) ||
      (b.unauthorizedAttemptedBy?.shopName || "").toLowerCase().includes(s) ||
      (b.unauthorizedAttemptedBy?.ownerName || "").toLowerCase().includes(s) ||
      (b.serviceName || "").toLowerCase().includes(s)
    );
  }, [bookings, search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <ShieldAlert size={20} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Unauthorized Payments</h1>
            <p className="text-sm text-gray-500">{total} flagged booking{total !== 1 ? "s" : ""} require investigation</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl"
        >
          <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">{total} Unauthorized Payment Attempt{total !== 1 ? "s" : ""} Detected</p>
            <p className="text-xs text-red-600 mt-0.5">
              Partners attempted to manually mark payments as collected. Review each case and clear flags after investigation.
            </p>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Booking ID, Partner, Customer..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-gray-400 flex-shrink-0" />
            <input
              type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }} className="p-2 rounded-lg hover:bg-gray-100">
                <X size={14} className="text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <ShieldAlert size={40} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No unauthorized payment attempts found</p>
            <p className="text-gray-400 text-sm mt-1">All payment activity is compliant.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Booking ID", "Partner", "Customer", "Amount", "Mode", "Flag Reason", "Flagged At", "Collection", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence>
                  {filtered.map((b, i) => (
                    <motion.tr
                      key={b._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-red-50/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">#{b._id.slice(-6)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <User size={12} className="text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-xs leading-tight">
                              {b.unauthorizedAttemptedBy?.shopName || b.unauthorizedAttemptedBy?.ownerName || "Unknown"}
                            </p>
                            <p className="text-gray-400 text-xs">{b.unauthorizedAttemptedBy?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 text-xs font-medium">{b.userId?.name || "—"}</p>
                        <p className="text-gray-400 text-xs">{b.userId?.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <IndianRupee size={11} className="text-gray-400" />
                          <span className="font-semibold text-gray-800">{(b.totalAmount || 0).toLocaleString("en-IN")}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${b.paymentMode === "now" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                          {b.paymentMode === "now" ? "Online" : "Cash"}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-red-600 leading-snug line-clamp-2">{b.unauthorizedPaymentNote || "—"}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs text-gray-600">
                          {b.unauthorizedPaymentAt ? new Date(b.unauthorizedPaymentAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[b.collectionStatus] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {b.collectionStatus?.replace(/_/g, " ") || "not collected"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setAuditBookingId(b._id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                            title="View Audit Trail"
                          >
                            <Eye size={12} />
                            Audit
                          </button>
                          <button
                            onClick={() => handleClearFlag(b._id)}
                            disabled={clearing === b._id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors font-medium disabled:opacity-50"
                            title="Mark as Investigated"
                          >
                            {clearing === b._id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            Clear
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs text-gray-600 px-2">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Drawer */}
      <AnimatePresence>
        {auditBookingId && (
          <AuditDrawer bookingId={auditBookingId} onClose={() => setAuditBookingId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUnauthorizedPayments;
