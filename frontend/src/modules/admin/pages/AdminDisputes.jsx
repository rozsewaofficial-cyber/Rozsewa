import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, Search, ChevronDown, IndianRupee } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminDisputes = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [activeNote, setActiveNote] = useState({ id: null, text: "" });

  useEffect(() => {
    setTitle("Disputes & Complaints");
    fetchComplaints();
  }, [setTitle]);

  const fetchComplaints = async () => {
    try {
      const res = await API.get('/complaints/admin');
      setComplaints(res.data);
    } catch (err) {
      console.error("Failed to fetch complaints", err);
    }
  };

  const statusColors = {
    open: { bg: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: AlertTriangle },
    "in-review": { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: Clock },
    resolved: { bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await API.put(`/complaints/admin/${id}`, { status });
      const updated = complaints.map(c => c._id === id ? res.data : c);
      setComplaints(updated);
      toast({ title: `Status → ${status.toUpperCase()}` });
    } catch (err) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const saveNote = async (id) => {
    try {
      const res = await API.put(`/complaints/admin/${id}`, { adminNotes: activeNote.text });
      const updated = complaints.map(c => c._id === id ? res.data : c);
      setComplaints(updated);
      toast({ title: "Admin Note Saved" });
      setActiveNote({ id: null, text: "" });
    } catch (err) {
      toast({ title: "Failed to save note", variant: "destructive" });
    }
  };

  const filtered = complaints
    .filter(c => filter === "all" || c.status === filter)
    .filter(c => !search || c._id.toLowerCase().includes(search.toLowerCase()) || c.issueType?.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    all: complaints.length,
    open: complaints.filter(c => c.status === "open").length,
    "in-review": complaints.filter(c => c.status === "in-review").length,
    resolved: complaints.filter(c => c.status === "resolved").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Disputes & Complaints</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage customer complaints and disputes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.all, color: "bg-muted" },
          { label: "Open", value: counts.open, color: "bg-amber-50 dark:bg-amber-900/20" },
          { label: "In Review", value: counts["in-review"], color: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Resolved", value: counts.resolved, color: "bg-emerald-50 dark:bg-emerald-900/20" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.color} p-4 text-center`}>
            <p className="text-2xl font-black text-foreground">{s.value}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search by ID or type..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {["all", "open", "in-review", "resolved"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              {f === "all" ? "All" : f === "in-review" ? "In Review" : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Complaints List */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border-2 border-dashed border-border">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No complaints found</p>
          </div>
        )}
        {filtered.map((c, i) => {
          const statusConf = statusColors[c.status] || statusColors.open;
          const StatusIcon = statusConf.icon;
          return (
            <motion.div key={c._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{c._id.substring(c._id.length - 8).toUpperCase()}</span>
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusConf.bg}`}>
                      <StatusIcon className="h-3 w-3" /> {c.status === "in-review" ? "In Review" : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mt-1">{c.issueType}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Booking: {c.bookingId?.serviceName || "N/A"} • User: {c.userId?.name || "N/A"}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 border border-border/50">{c.description}</p>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {c.status !== "in-review" && c.status !== "resolved" && (
                  <button onClick={() => updateStatus(c._id, "in-review")}
                    className="rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-500/20 transition-all active:scale-95">
                    Start Review
                  </button>
                )}
                {c.status !== "resolved" && (
                  <button onClick={() => updateStatus(c._id, "resolved")}
                    className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 transition-all active:scale-95">
                    Mark Resolved
                  </button>
                )}
                <button onClick={() => setActiveNote({ id: c._id, text: c.adminNotes || "" })}
                  className="rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/80 transition-all active:scale-95">
                  {c.adminNotes ? "Edit Note" : "Add Note"}
                </button>
              </div>

              {/* Note Editor */}
              {activeNote.id === c._id && (
                <div className="space-y-2 border-t border-border pt-3">
                  <textarea rows={2} value={activeNote.text} onChange={e => setActiveNote({ ...activeNote, text: e.target.value })}
                    placeholder="Add admin response or notes..."
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  <div className="flex gap-2">
                    <button onClick={() => saveNote(c._id)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Save</button>
                    <button onClick={() => setActiveNote({ id: null, text: "" })} className="rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-foreground">Cancel</button>
                  </div>
                </div>
              )}

              {c.adminNotes && activeNote.id !== c._id && (
                <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
                  <p className="text-[10px] font-bold text-primary uppercase mb-1">Admin Note</p>
                  <p className="text-xs text-foreground">{c.adminNotes}</p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDisputes;
