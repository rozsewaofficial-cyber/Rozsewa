import { useState, useEffect } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { motion, AnimatePresence } from "framer-motion";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { LifeBuoy, FileQuestion, MessageSquare, PhoneCall, ChevronRight, Loader2, Send, Plus, X, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProviderSupport = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [isRaisingTicket, setIsRaisingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: "", category: "General", priority: "Low", description: "" });

  useScrollLock(isRaisingTicket);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data } = await API.get("/support/tickets");
      setTickets(data);
    } catch (err) {
      toast({ title: "Sync Error", description: "Failed to load ticket history.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await API.post("/support/tickets", newTicket);
      toast({ title: "Ticket Raised", description: "Our team will look into your issue shortly." });
      setIsRaisingTicket(false);
      setNewTicket({ subject: "", description: "", category: "other", priority: "low" });
      fetchTickets();
    } catch (err) {
      toast({ title: "Error", description: "Could not create ticket. Try again later.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      <main className="container max-w-4xl px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        <div className="flex justify-between items-center">
          <div className="text-left space-y-1">
            <h1 className="text-xl md:text-3xl font-black tracking-tight text-foreground uppercase">RozSewa Support</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Help Center & Service Desk</p>
          </div>
          <button onClick={() => setIsRaisingTicket(true)} className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
            <Plus className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="flex items-center p-6 border border-border bg-card rounded-[24px] shadow-sm hover:shadow-md hover:border-emerald-200 transition-all text-left group">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 mr-4 group-hover:scale-110 transition-all">
              <MessageSquare className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Live Chat</h3>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Connect with an executive instantly</p>
            </div>
          </button>

          <button className="flex items-center p-6 border border-border bg-card rounded-[24px] shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left group">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 mr-4 group-hover:scale-110 transition-all">
              <PhoneCall className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Request a Call</h3>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Direct support callback</p>
            </div>
          </button>
        </div>

        {/* Dynamic Ticket History */}
        <section className="rounded-[32px] border border-border bg-card shadow-sm overflow-hidden text-left">
          <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-emerald-600" /> Ticket History</h3>
            <span className="text-[9px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{tickets.filter(t => t.status === 'pending' || t.status === 'open').length} Active</span>
          </div>
          <div className="divide-y divide-border">
            {tickets.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 mb-4">
                  <FileQuestion className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-xs font-black text-foreground uppercase tracking-tight">No issues found</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-1">Everything seems perfect! If you need help, raise a ticket.</p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <div key={ticket._id} className="p-5 flex items-center justify-between hover:bg-muted/20 transition-all group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${ticket.status === 'resolved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate">{ticket.subject}</h4>
                      <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-2">
                        {ticket.category.toUpperCase()} • {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${ticket.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {ticket.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Training Articles */}
        <section>
          <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-muted-foreground mb-4 text-left">Resources</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { t: "Shop Visit Mastery", c: "Marketing" },
              { t: "Payout Cycle Logic", c: "Finance" },
              { t: "Staff Allocation", c: "Operations" }
            ].map((art, i) => (
              <div key={i} className="flex flex-col rounded-[24px] border border-border bg-card p-5 hover:border-emerald-500/30 transition-all cursor-pointer group shadow-sm text-left">
                <span className="text-[8px] font-black uppercase text-emerald-600 mb-2 tracking-widest">{art.c}</span>
                <h4 className="text-xs font-bold leading-tight mb-4 text-foreground flex-1">{art.t}</h4>
                <div className="flex items-center text-[9px] font-black uppercase text-muted-foreground group-hover:text-emerald-600 transition-colors">
                  Read Guide <ChevronRight className="h-3 w-3 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Raise Ticket Modal */}
      <AnimatePresence>
        {isRaisingTicket && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-lg rounded-[40px] bg-card p-8 border border-border shadow-2xl relative"
            >
              <button onClick={() => setIsRaisingTicket(false)} className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-muted transition-all active:scale-95"><X className="h-5 w-5" /></button>
              <h2 className="text-2xl font-black tracking-tighter mb-1 text-left uppercase">Support Ticket</h2>
              <p className="text-xs text-muted-foreground mb-8 text-left font-medium">Explain your issue and we'll resolve it ASAP.</p>

              <form onSubmit={handleCreateTicket} className="space-y-4 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 mb-2">Category</label>
                    <select
                      value={newTicket.category}
                      onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                      className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 outline-none font-bold text-xs appearance-none"
                    >
                      <option value="payment">Payment Issue</option>
                      <option value="booking">Booking Help</option>
                      <option value="app_issue">App Glitch</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Priority</label>
                    <select
                      value={newTicket.priority}
                      onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                      className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 outline-none font-bold text-xs appearance-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Subject</label>
                  <input
                    required
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                    placeholder="Brief summary of the issue"
                    className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 outline-none font-bold text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Description</label>
                  <textarea
                    required
                    rows={4}
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    placeholder="Tell us exactly what went wrong..."
                    className="w-full p-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 outline-none font-bold text-xs resize-none"
                  />
                </div>

                <button
                  disabled={submitting}
                  type="submit"
                  className="w-full h-16 mt-4 bg-emerald-600 text-white rounded-[24px] font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4" /> Submit Ticket</>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ProviderBottomNav />
    </div>
  );
};

export default ProviderSupport;
