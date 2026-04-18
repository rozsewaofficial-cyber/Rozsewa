import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Download, CalendarDays, IndianRupee, MapPin, Loader2, Clock, CheckCircle, XCircle, Image } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  active: "bg-blue-50 text-blue-700 border-blue-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-red-50 text-red-700 border-red-100",
};

const AdminBookings = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setTitle("Platform Bookings");
    fetchBookings();
  }, [setTitle]);

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

  const handleExport = () => {
    const headers = ["Booking ID", "Date", "Customer", "Provider", "Service", "Amount", "Status"];
    const rows = filteredBookings.map(b => [
      b.bookingId || b._id,
      new Date(b.createdAt).toLocaleDateString(),
      b.userId?.name || 'Customer',
      b.providerId?.shopName || 'Provider',
      b.serviceName,
      b.totalAmount,
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
    const shopName = (b.providerId?.shopName || "").toLowerCase();
    const bId = (b.bookingId || b._id || "").toLowerCase();

    const matchesSearch = userName.includes(searchLow) ||
      shopName.includes(searchLow) ||
      bId.includes(searchLow);
    const matchesFilter = filter === "all" || b.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      <p className="text-sm font-bold text-gray-500">Syncing with Bookings Ledger...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Recent Bookings</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium tracking-tight">Track every service fulfillment and transaction status.</p>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-700 hover:bg-gray-50 transition-all shadow-sm active:scale-95"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="flex rounded-xl bg-gray-100 p-1 w-full lg:w-auto shadow-inner overflow-hidden">
          {["all", "pending", "active", "completed", "cancelled"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 lg:flex-none rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:min-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
            placeholder="Search IDs, Names, or Shops..."
          />
        </div>
      </div>

      {/* Bookings Table */}
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-400 uppercase tracking-widest text-[9px] font-black">
              <tr>
                <th className="py-5 px-6">Tracking Details</th>
                <th className="py-5 px-6">Customer</th>
                <th className="py-5 px-6">Assigned Provider</th>
                <th className="py-5 px-6">Work Proof</th>
                <th className="py-5 px-6">Total Payout</th>
                <th className="py-5 px-6">Flow Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <CalendarDays className="h-10 w-10 text-gray-200 mx-auto" />
                    <p className="mt-2 text-gray-400 font-bold text-sm">No transaction records found.</p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <motion.tr key={booking._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-emerald-50/10 transition-colors group">
                    <td className="py-4 px-6">
                      <p className="font-mono font-black text-emerald-700 tracking-tighter text-xs uppercase">{booking.bookingId || booking._id.toString().slice(-8).toUpperCase()}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                        < Clock className="h-3 w-3" /> {new Date(booking.createdAt).toLocaleDateString()} at {new Date(booking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-extrabold text-gray-900 tracking-tight">{booking.userId?.name || 'Guest User'}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5 tracking-tight">{booking.userId?.mobile || 'No Mobile'}</p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit items-center rounded-lg bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 border border-emerald-100">
                          {booking.serviceName}
                        </span>
                        <p className="text-[10px] font-bold text-gray-500 tracking-tight truncate max-w-[200px]">via {booking.providerId?.shopName || 'Assigned Vendor'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        {/* Before Image */}
                        {(booking.beforeImage || booking.workProof?.before) ? (
                          <div className="group/img relative h-10 w-10 overflow-hidden rounded-lg border border-gray-200 shadow-sm cursor-zoom-in">
                            <img
                              src={booking.beforeImage || booking.workProof?.before}
                              alt="Before"
                              className="h-full w-full object-cover transition-transform group-hover/img:scale-125"
                              onClick={() => window.open(booking.beforeImage || booking.workProof?.before, '_blank')}
                            />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] font-black text-white text-center py-0.5">BEFORE</span>
                          </div>
                        ) : (
                          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-gray-50 border border-dashed border-gray-200 text-gray-300">
                            <Image className="h-4 w-4" />
                          </div>
                        )}

                        {/* After Image */}
                        {(booking.afterImage || booking.workProof?.after) ? (
                          <div className="group/img relative h-10 w-10 overflow-hidden rounded-lg border border-gray-200 shadow-sm cursor-zoom-in">
                            <img
                              src={booking.afterImage || booking.workProof?.after}
                              alt="After"
                              className="h-full w-full object-cover transition-transform group-hover/img:scale-125"
                              onClick={() => window.open(booking.afterImage || booking.workProof?.after, '_blank')}
                            />
                            <span className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 text-[8px] font-black text-white text-center py-0.5">AFTER</span>
                          </div>
                        ) : (
                          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-gray-50 border border-dashed border-gray-200 text-gray-300">
                            <Image className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="flex items-center gap-0.5 font-black text-gray-900 text-base">
                        <IndianRupee className="h-3.5 w-3.5" /> {booking.totalAmount}
                      </p>
                      <p className="text-[9px] font-bold text-emerald-600 tracking-widest uppercase">Prepaid Full</p>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] border ${statusStyles[booking.status]}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${booking.status === 'completed' ? 'bg-emerald-500' :
                          booking.status === 'cancelled' ? 'bg-red-500' : 'bg-blue-500'
                          }`}></span>
                        {booking.status}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBookings;
