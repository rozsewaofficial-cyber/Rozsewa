import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, AlertTriangle, MessageSquareWarning, Clock, CheckCircle2, Send, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ComplaintForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("new"); // new | history
  const [selectedBooking, setSelectedBooking] = useState("");
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const complaintsRes = await API.get('/complaints');
        setComplaints(complaintsRes.data);

        const bookingsRes = await API.get('/bookings');
        setBookings(bookingsRes.data);
      } catch (err) {
        console.error("Failed to fetch complaints or bookings", err);
      }
    };
    fetchData();
  }, []);

  const statusColors = {
    open: "bg-amber-100 text-amber-700",
    "in-review": "bg-blue-100 text-blue-700",
    resolved: "bg-emerald-100 text-emerald-700",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBooking || !issueType || !description) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    try {
      const res = await API.post('/complaints', {
        bookingId: selectedBooking,
        issueType,
        description
      });
      
      setComplaints([res.data, ...complaints]);
      toast({ title: "Complaint Submitted", description: `ID: ${res.data._id.substring(res.data._id.length - 8).toUpperCase()}` });
      setSelectedBooking("");
      setIssueType("");
      setDescription("");
      setActiveTab("history");
    } catch (err) {
      toast({ title: "Failed to submit complaint", description: err.response?.data?.message || err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-bold text-foreground">Report an Issue</h1>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-muted p-1">
          {[{ id: "new", label: "New Complaint" }, { id: "history", label: "My Complaints" }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${activeTab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "new" && (
            <motion.form key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 dark:bg-amber-900/10 dark:border-amber-700/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Please provide accurate details. Our team will review and respond within 24 hours.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Select Booking</label>
                <div className="relative">
                  <select value={selectedBooking} onChange={(e) => setSelectedBooking(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-border bg-background py-3 px-4 pr-10 text-sm font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">Choose a booking...</option>
                    {bookings.map(b => (<option key={b._id} value={b._id}>{b._id.substring(b._id.length - 8).toUpperCase()} — {b.serviceName} ({b.status})</option>))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Issue Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Service Quality", "Wrong Charges", "Provider Behaviour", "Incomplete Work", "Damage Caused", "Other"].map(t => (
                    <button key={t} type="button" onClick={() => setIssueType(t)}
                      className={`rounded-xl py-2.5 text-xs font-bold transition-all ${issueType === t ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-muted"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Describe the Issue</label>
                <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain what happened in detail..."
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
              </div>

              <motion.button whileTap={{ scale: 0.97 }} type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-extrabold text-primary-foreground shadow-xl">
                <Send className="h-4 w-4" /> Submit Complaint
              </motion.button>
            </motion.form>
          )}

          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {complaints.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquareWarning className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">No complaints yet</p>
                </div>
              ) : (
                complaints.map((c, i) => (
                  <motion.div key={c._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-muted-foreground">{c._id.substring(c._id.length - 8).toUpperCase()}</span>
                        <h3 className="text-sm font-bold text-foreground mt-0.5">{c.issueType}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Booking: {c.bookingId?.serviceName || "N/A"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColors[c.status] || "bg-muted text-muted-foreground"}`}>
                        {c.status === "in-review" ? "In Review" : c.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    {c.adminNotes && (
                      <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
                        <p className="text-[10px] font-bold text-primary uppercase mb-1">Admin Response</p>
                        <p className="text-xs text-foreground">{c.adminNotes}</p>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
};

export default ComplaintForm;
