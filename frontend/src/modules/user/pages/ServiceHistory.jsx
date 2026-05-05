import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, MapPin, RotateCcw, ChevronRight, CalendarDays, Package, Receipt, Info, Star, X, Download, AlertTriangle, Calendar } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const demoBookings = [
  { id: "ROJ-A1B2C3", service: "AC Repair & Gas Refill", provider: "CoolTech Services", date: "2026-03-08", time: "10:00 AM", total: 1598, status: "completed", rating: 5, address: "Home - Phase 2, Lucknow" },
  { id: "ROJ-D4E5F6", service: "Men's Haircut + Beard", provider: "Royal Men's Salon", date: "2026-03-25", time: "04:00 PM", total: 350, status: "confirmed", rating: 0, address: "Office - BBD, Lucknow" },
  { id: "ROJ-G7H8I9", service: "Plumbing - Tap Fix", provider: "Quick Fix Plumbers", date: "2026-03-01", time: "11:00 AM", total: 250, status: "cancelled", rating: 0, address: "Other - Station Road" },
];

const statusColors = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-primary/10 text-primary dark:bg-primary/20",
};

const ServiceHistory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const fetchBookings = async () => {
    try {
      const { data } = await API.get("/bookings");
      // Format backend data to match UI needs
      const formatted = data.map(b => ({
        ...b,
        id: b._id,
        service: b.serviceName,
        total: b.totalAmount,
        date: b.bookingDate,
        time: b.bookingTime,
        status: b.status,
      }));
      setBookings(formatted);
    } catch (err) {
      console.error("Failed to fetch bookings", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const filtered = filter === "all" ? bookings : bookings.filter(b => b.status === filter);

  const handleCancel = async () => {
    try {
      await API.put(`/bookings/${selectedBooking.id}`, { status: "cancelled" });
      toast({ title: "Booking Cancelled", variant: "destructive" });
      setShowCancel(false);
      fetchBookings(); // Refresh list
    } catch (err) {
      toast({ title: "Operation Failed", variant: "destructive" });
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!newDate || !newTime) return;
    try {
      await API.put(`/bookings/${selectedBooking.id}`, {
        bookingDate: newDate,
        bookingTime: newTime
      });
      toast({ title: "Booking Rescheduled" });
      setShowReschedule(false);
      fetchBookings();
    } catch (err) {
      toast({ title: "Operation Failed", variant: "destructive" });
    }
  };

  const handleDownloadInvoice = () => {
    toast({ title: "Downloading Invoice", description: "PDF is being generated..." });
    setTimeout(() => {
      // Simulate file download
      const link = document.createElement("a");
      link.href = "data:text/plain;charset=utf-8,RozSewa%20Invoice%0A-----------------%0A..." + encodeURIComponent(`\nBooking ID: ${selectedBooking.id}\nAmount: ₹${selectedBooking.total}`);
      link.download = `Invoice_${selectedBooking.id}.txt`;
      link.click();
    }, 1000);
  };

  const openDetails = (booking) => {
    setSelectedBooking(booking);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Bookings</h1>
            <p className="text-xs text-muted-foreground">{bookings.length} total bookings</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {["all", "confirmed", "completed", "cancelled"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-bold capitalize whitespace-nowrap transition-all ${filter === f ? "bg-primary text-primary-foreground shadow-md" : "border border-border bg-card text-foreground hover:bg-muted"
                }`}>
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-3xl">
              <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No bookings found</p>
            </div>
          )}
          {filtered.map((booking, i) => (
            <motion.div key={booking.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => openDetails(booking)}
              className="group cursor-pointer rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusColors[booking.status]}`}>
                      {booking.status}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground/60">{booking.id}</span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground truncate">{booking.service}</h3>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {booking.address}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black text-foreground">₹{booking.total}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-2.5 text-xs font-semibold text-foreground">
                <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary" /> {booking.date}</div>
                <div className="flex items-center gap-1.5 border-l border-border pl-4"><Clock className="h-3.5 w-3.5 text-emerald-500" /> {booking.time}</div>
              </div>

              {/* Quick Actions */}
              <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                {booking.status === "completed" && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate("/checkout")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all">
                    <RotateCcw className="h-3.5 w-3.5" /> Re-Book
                  </motion.button>
                )}
                {booking.status === "confirmed" && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate("/tracking")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                    Track Service <ChevronRight className="h-3.5 w-3.5" />
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Master Details Modal */}
        <AnimatePresence>
          {selectedBooking && !showCancel && !showReschedule && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedBooking(null)}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} onClick={e => e.stopPropagation()}
                className="w-full max-w-md rounded-t-[32px] sm:rounded-3xl bg-card shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-muted/30 p-5 sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-foreground">Booking Details</h3>
                      <p className="text-[10px] font-mono text-muted-foreground">{selectedBooking.id}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedBooking(null)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-5 space-y-5">
                  <div className="space-y-4 rounded-2xl bg-muted/30 p-4 border border-border/50">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-muted-foreground">Service</span>
                      <span className="text-sm font-black text-foreground text-right">{selectedBooking.service}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-muted-foreground">Provider</span>
                      <span className="text-sm font-bold text-foreground text-right">{selectedBooking.provider}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-muted-foreground">Schedule</span>
                      <div className="text-right">
                        <span className="block text-sm font-bold text-foreground">{selectedBooking.date}</span>
                        <span className="text-xs font-semibold text-emerald-500">{selectedBooking.time}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-muted-foreground">Status</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${statusColors[selectedBooking.status]}`}>
                        {selectedBooking.status}
                      </span>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="rounded-2xl border border-border p-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">Payment Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Service Price</span>
                        <span className="font-semibold">₹{selectedBooking.total - (selectedBooking.extraCharges?.reduce((sum, c) => sum + c.amount, 0) || 0)}</span>
                      </div>
                      
                      {selectedBooking.extraCharges && selectedBooking.extraCharges.length > 0 && (
                        <div className="space-y-1 py-1">
                          {selectedBooking.extraCharges.map((extra, idx) => (
                            <div key={idx} className="flex justify-between text-sm italic text-muted-foreground/80">
                              <span>+ {extra.item}</span>
                              <span>₹{extra.amount}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Taxes & Fee</span><span className="font-semibold">₹0</span></div>
                      <div className="border-t border-border mt-3 pt-3 flex justify-between items-center">
                        <span className="font-black text-foreground">Total Paid</span>
                        <span className="text-xl font-black text-primary">₹{selectedBooking.total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Actions */}
                  {selectedBooking.status === "confirmed" && (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setShowReschedule(true)} className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-xs font-bold hover:bg-muted">
                        <Calendar className="h-4 w-4" /> Reschedule
                      </button>
                      <button onClick={() => setShowCancel(true)} className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 py-3 text-xs font-bold hover:bg-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30">
                        <X className="h-4 w-4" /> Cancel Booking
                      </button>
                    </div>
                  )}

                  <button onClick={() => navigate("/complaint")} className="w-full rounded-xl border border-border py-3 text-xs font-bold hover:bg-muted flex items-center justify-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Report an Issue
                  </button>
                </div>

                {/* Footer Action */}
                <div className="border-t border-border bg-card p-5 sticky bottom-0">
                  {selectedBooking.status === "completed" ? (
                    <button onClick={handleDownloadInvoice} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-extrabold text-primary-foreground shadow-xl shadow-primary/20">
                      <Download className="h-5 w-5" /> Download Invoice
                    </button>
                  ) : (
                    <button onClick={() => setSelectedBooking(null)} className="w-full rounded-2xl border border-border py-4 text-sm font-extrabold hover:bg-muted">Close Details</button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reschedule Modal */}
        <AnimatePresence>
          {showReschedule && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/50 backdrop-blur-sm sm:items-center p-4">
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl">
                <h3 className="text-lg font-black text-foreground mb-1">Reschedule Booking</h3>
                <p className="text-xs text-muted-foreground mb-4">Select a new date and time</p>
                <form onSubmit={handleReschedule} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Date</label>
                    <input type="date" required value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:ring-2 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Time</label>
                    <input type="time" required value={newTime} onChange={e => setNewTime(e.target.value)} className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:ring-2 focus:outline-none" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowReschedule(false)} className="flex-1 rounded-xl border border-border py-3 text-xs font-bold hover:bg-muted">Back</button>
                    <button type="submit" className="flex-1 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground">Confirm</button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cancel Modal */}
        <AnimatePresence>
          {showCancel && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
                  <X className="h-8 w-8 text-rose-600" />
                </div>
                <h3 className="text-lg font-black text-foreground">Cancel Booking?</h3>
                <p className="text-xs text-muted-foreground mt-2 mb-6">Are you sure you want to cancel this booking? A cancellation fee may apply as per policy.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowCancel(false)} className="flex-1 rounded-xl border border-border py-3.5 text-sm font-bold hover:bg-muted">Keep It</button>
                  <button onClick={handleCancel} className="flex-1 rounded-xl bg-rose-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-700">Yes, Cancel</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
};

export default ServiceHistory;
