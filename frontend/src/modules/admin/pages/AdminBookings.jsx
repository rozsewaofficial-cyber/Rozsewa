import { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate, useLocation } from "react-router-dom";
import { Search, Download, CalendarDays, IndianRupee, Loader2, Clock, Image, Filter, Users, TrendingUp, XCircle, CheckCircle2, Truck, Play, AlertCircle, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import API from "@/lib/api";

const STATUS_CONFIG = {
  pending:    { label: "Pending",    color: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500",   icon: AlertCircle },
  confirmed:  { label: "Confirmed",  color: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500",  icon: CheckCircle2 },
  on_the_way: { label: "On the Way", color: "bg-cyan-50 text-cyan-700 border-cyan-200",       dot: "bg-cyan-500",    icon: Truck },
  started:    { label: "Started",    color: "bg-blue-50 text-blue-700 border-blue-200",       dot: "bg-blue-500",    icon: Play },
  completed:  { label: "Completed",  color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  color: "bg-red-50 text-red-700 border-red-200",          dot: "bg-red-500",     icon: XCircle },
};

const PAYMENT_LABELS = {
  now: "Prepaid",
  after: "Pay After",
};

const AdminBookings = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter]);

  useEffect(() => {
    setTitle("All Bookings");
    fetchBookings();
    if (location.state?.searchId) {
      setSearchTerm(location.state.searchId.toString().slice(-6).toUpperCase());
    }
  }, [setTitle, location.state]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/admin/bookings");
      setBookings(data);
    } catch (err) {
      toast({ title: "Fetch Failed", description: "Could not load bookings history.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBooking = async (id) => {
    const ok = await confirm("This will permanently delete the booking record.", { title: "Delete Booking", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    try {
      const { data } = await API.delete(`/admin/bookings/${id}`);
      if (data.success) {
        toast({ title: "Deleted", description: "Booking removed successfully" });
        setBookings(bookings.filter(b => b._id !== id));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete booking",
        variant: "destructive"
      });
    }
  };

  // Stats
  const stats = useMemo(() => {
    const all = bookings || [];
    const total = all.length;
    const completed = all.filter(b => b.status === 'completed').length;
    const active = all.filter(b => ['pending', 'confirmed', 'on_the_way', 'started'].includes(b.status)).length;
    const cancelled = all.filter(b => b.status === 'cancelled').length;
    const revenue = all.filter(b => b.status === 'completed').reduce((s, b) => s + (b.totalAmount || 0), 0);
    const unauthorized = all.filter(b => b.unauthorizedPaymentFlag).length;
    return { total, completed, active, cancelled, revenue, unauthorized };
  }, [bookings]);

  // Status counts for filter tabs
  const statusCounts = useMemo(() => {
    const counts = { all: (bookings || []).length };
    (bookings || []).forEach(b => { counts[b.status] = (counts[b.status] || 0) + 1; });
    return counts;
  }, [bookings]);

  const handleExport = () => {
    const headers = ["Booking ID", "Date", "Time", "Customer", "Mobile", "Provider", "Service", "Amount", "Payment", "Status"];
    const rows = filteredBookings.map(b => [
      b._id?.toString().slice(-8).toUpperCase(),
      b.bookingDate,
      b.bookingTime,
      b.userId?.name || 'Customer',
      b.userId?.mobile || '',
      b.providerId?.shopName || 'Provider',
      b.serviceName,
      b.totalAmount,
      b.paymentMode === 'after' ? 'COD' : 'Prepaid',
      b.status
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rozsewa_bookings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast({ title: "Export Started", description: "CSV file is downloading." });
  };

  const filteredBookings = (bookings || []).filter(b => {
    const searchLow = (searchTerm || "").toLowerCase();
    const userName = (b.userId?.name || "").toLowerCase();
    const userMobile = (b.userId?.mobile || "").toLowerCase();
    const shopName = (b.providerId?.shopName || "").toLowerCase();
    const serviceName = (b.serviceName || "").toLowerCase();
    const bId = (b._id || "").toString().toLowerCase();

    const matchesSearch = userName.includes(searchLow) ||
      userMobile.includes(searchLow) ||
      shopName.includes(searchLow) ||
      serviceName.includes(searchLow) ||
      bId.includes(searchLow);
    const matchesFilter = filter === "all" || b.status === filter ||
      (filter === "unauthorized" && b.unauthorizedPaymentFlag);
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBookings = filteredBookings.slice(startIndex, startIndex + itemsPerPage);

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      <p className="text-sm font-bold text-gray-500">Loading bookings...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">All Bookings</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">{stats.total} total bookings across all statuses</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchBookings}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm active:scale-95"
          >
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Total", value: stats.total, icon: CalendarDays, cls: "text-gray-700 bg-gray-50 border-gray-200" },
          { label: "Active", value: stats.active, icon: Truck, cls: "text-blue-700 bg-blue-50 border-blue-200" },
          { label: "Completed", value: stats.completed, icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
          { label: "Cancelled", value: stats.cancelled, icon: XCircle, cls: "text-red-700 bg-red-50 border-red-200" },
          { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: TrendingUp, cls: "text-violet-700 bg-violet-50 border-violet-200" },
          { label: "⚠️ Flagged", value: stats.unauthorized, icon: ShieldAlert, cls: stats.unauthorized > 0 ? "text-red-700 bg-red-50 border-red-300 ring-1 ring-red-300" : "text-gray-500 bg-gray-50 border-gray-200", onClick: () => navigate("/admin/unauthorized-payments") },
        ].map((s, i) => (
          <div key={i} className={`rounded-xl border p-4 ${s.cls} ${s.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={s.onClick}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <s.icon className="h-3.5 w-3.5 opacity-70" />
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{s.label}</p>
            </div>
            <h3 className="text-xl font-black">{s.value}</h3>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
        <div className="flex flex-wrap gap-1.5">
          {["all", "pending", "confirmed", "on_the_way", "started", "completed", "cancelled", "unauthorized"].map((f) => {
            const cfg = STATUS_CONFIG[f];
            const count = f === "unauthorized" ? stats.unauthorized : (statusCounts[f] || 0);
            const isUnauth = f === "unauthorized";
            return (
              <button
                key={f}
                onClick={() => f === "unauthorized" ? navigate("/admin/unauthorized-payments") : setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  filter === f
                    ? "bg-gray-900 text-white shadow-sm"
                    : isUnauth && count > 0
                    ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                }`}
              >
                {isUnauth ? <><ShieldAlert size={10} /> Flagged</> : (f === 'all' ? 'All' : cfg?.label || f)}
                <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-black ${
                  filter === f ? 'bg-white/20 text-white' :
                  isUnauth && count > 0 ? 'bg-red-500 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
            placeholder="Search by name, mobile, service..."
          />
        </div>
      </div>

      {/* Bookings Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                <th className="py-4 px-5">Booking ID</th>
                <th className="py-4 px-5">Schedule</th>
                <th className="py-4 px-5">Customer</th>
                <th className="py-4 px-5">Provider</th>
                <th className="py-4 px-5">Service</th>
                <th className="py-4 px-5">Work Proof</th>
                <th className="py-4 px-5 text-right">Amount</th>
                <th className="py-4 px-5 text-center">Payment</th>
                <th className="py-4 px-5 text-center">Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-20 text-center">
                    <CalendarDays className="h-10 w-10 text-gray-200 mx-auto" />
                    <p className="mt-3 text-gray-400 font-bold text-sm">No bookings found</p>
                    <p className="text-xs text-gray-300 mt-1">Try adjusting your search or filter</p>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {paginatedBookings.map((booking, idx) => {
                    const sc = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                    return (
                      <motion.tr
                        key={booking._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-gray-50/80 transition-colors group"
                      >
                        {/* Booking ID */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-1.5">
                            <p className="font-mono font-black text-emerald-700 text-xs">
                              #{(booking._id || '').toString().slice(-6).toUpperCase()}
                            </p>
                            {booking.unauthorizedPaymentFlag && (
                              <span title="Unauthorized payment attempt detected" className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                                <ShieldAlert size={9} /> FLAG
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(booking.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </p>
                        </td>

                        {/* Schedule */}
                        <td className="py-3.5 px-5">
                          <p className="text-xs font-bold text-gray-800">{booking.bookingDate}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{booking.bookingTime}</p>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-5">
                          <p className="text-xs font-bold text-gray-900">{booking.userId?.name || 'Guest'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{booking.userId?.mobile || '-'}</p>
                        </td>

                        {/* Provider */}
                        <td className="py-3.5 px-5">
                          <p className="text-xs font-bold text-gray-800 truncate max-w-[130px]">{booking.providerId?.shopName || 'Unassigned'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[130px]">{booking.providerId?.ownerName || ''}</p>
                        </td>

                        {/* Service */}
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100 truncate max-w-[180px]">
                            {booking.serviceName}
                          </span>
                        </td>

                        {/* Work Proof */}
                        <td className="py-3.5 px-5">
                          <div className="flex gap-1.5">
                            {booking.beforeImage ? (
                              <div className="group/img relative h-9 w-9 overflow-hidden rounded-lg border border-gray-200 shadow-sm cursor-zoom-in" onClick={() => window.open(booking.beforeImage, '_blank')}>
                                <img src={booking.beforeImage} alt="Before" className="h-full w-full object-cover transition-transform group-hover/img:scale-110" />
                                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] font-black text-white text-center leading-tight py-px">BEFORE</span>
                              </div>
                            ) : (
                              <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-50 border border-dashed border-gray-200 text-gray-300">
                                <Image className="h-3.5 w-3.5" />
                              </div>
                            )}
                            {booking.afterImage ? (
                              <div className="group/img relative h-9 w-9 overflow-hidden rounded-lg border border-gray-200 shadow-sm cursor-zoom-in" onClick={() => window.open(booking.afterImage, '_blank')}>
                                <img src={booking.afterImage} alt="After" className="h-full w-full object-cover transition-transform group-hover/img:scale-110" />
                                <span className="absolute bottom-0 inset-x-0 bg-emerald-600/80 text-[7px] font-black text-white text-center leading-tight py-px">AFTER</span>
                              </div>
                            ) : (
                              <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-50 border border-dashed border-gray-200 text-gray-300">
                                <Image className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-5 text-right">
                          <p className="text-sm font-black text-gray-900">₹{(booking.totalAmount || 0).toLocaleString()}</p>
                          {booking.discountAmount > 0 && (
                            <p className="text-[10px] text-red-500 font-bold mt-0.5">-₹{booking.discountAmount} off</p>
                          )}
                        </td>

                        {/* Payment */}
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            booking.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            booking.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus === 'refunded' ? 'Refunded' : PAYMENT_LABELS[booking.paymentMode] || 'Pending'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider border ${sc.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`}></span>
                            {sc.label}
                          </span>
                          {booking.status === 'cancelled' && booking.cancellationReason && (
                            <p className="mt-1.5 text-[9px] font-bold text-red-600 max-w-[120px] mx-auto truncate" title={booking.cancellationReason}>
                              {booking.cancelledBy === 'provider' ? 'Provider:' : 'Reason:'} {booking.cancellationReason}
                            </p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => handleDeleteBooking(booking._id)}
                            className="h-8 px-3 rounded-lg bg-red-50 border border-red-100 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 transition-colors"
                            title="Delete Booking"
                          >
                            Delete
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filteredBookings.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredBookings.length)} of {filteredBookings.length} bookings
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-gray-600">Page {currentPage} of {totalPages || 1}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden sm:block">
              Total Value: ₹{filteredBookings.reduce((s, b) => s + (b.totalAmount || 0), 0).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBookings;
