import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Ticket, Clock, CheckCircle2, MessageCircle, Send, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const SupportTickets = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await API.get("/support/tickets");
      setTickets(res.data);
    } catch (err) {
      console.error("Failed to fetch tickets", err);
    } finally {
      setLoading(false);
    }
  };

  const statusColors = { open: "bg-blue-100 text-blue-700", closed: "bg-emerald-100 text-emerald-700", pending: "bg-amber-100 text-amber-700" };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!subject || !message) return;
    
    try {
      const res = await API.post("/support/tickets", {
        subject,
        description: message,
        category: "other", // Default category
        priority: "low" // Default priority
      });
      
      const ticket = res.data;
      setTickets([ticket, ...tickets]);
      toast({ title: "Ticket Created", description: `ID: ${ticket._id}` });
      setSubject(""); setMessage(""); setShowCreate(false);
    } catch (err) {
      toast({ title: "Failed to create ticket", description: err.response?.data?.message || "Something went wrong", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <h1 className="text-xl font-bold text-foreground">Support Tickets</h1>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> New Ticket
          </motion.button>
        </div>

        {/* Tickets List */}
        <div className="space-y-4">
          {tickets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Ticket className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No support tickets yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create a ticket to get help from our team</p>
            </div>
          )}
          {tickets.map((t, i) => (
            <motion.div key={t._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-muted-foreground">{t._id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColors[t.status]}`}>{t.status}</span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground truncate">{t.subject}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </div>
                {t.reply && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                    <MessageCircle className="h-3 w-3" /> 1 reply
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Create Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-card border border-border shadow-2xl">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <h3 className="text-lg font-bold text-foreground">Create Ticket</h3>
                  <button onClick={() => setShowCreate(false)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
                </div>
                <form onSubmit={handleCreate} className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Subject</label>
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief summary of your issue..."
                      className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Message</label>
                    <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground" />
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground">
                    <Send className="h-4 w-4" /> Submit Ticket
                  </motion.button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
};

export default SupportTickets;
