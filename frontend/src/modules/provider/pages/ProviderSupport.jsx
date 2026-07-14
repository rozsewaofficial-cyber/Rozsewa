import { useState, useEffect } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { LifeBuoy, FileQuestion, MessageSquare, PhoneCall, ChevronRight, Loader2, Send, Plus, X, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProviderSupport = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [guides, setGuides] = useState([]);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [isRaisingTicket, setIsRaisingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: "",
    category: "payment",
    priority: "low",
    description: "",
    name: "",
    mobile: "",
    email: "",
    role: "provider"
  });

  const [currentPage, setCurrentPage] = useState(1);
  const ticketsPerPage = 5;

  useScrollLock(isRaisingTicket || selectedGuide);
  const [submitting, setSubmitting] = useState(false);

  const getAuthProviderToken = () => {
    try {
      const auth = JSON.parse(localStorage.getItem("rozsewa_auth_provider"));
      return auth?.token;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const token = getAuthProviderToken();
    if (token) {
      fetchTickets();
    } else {
      setLoading(false);
    }
    fetchGuides();
  }, []);

  const fetchGuides = async () => {
    try {
      const { data } = await API.get("/guides");
      setGuides(data);
    } catch (err) {
      console.error("Failed to load guides");
    }
  };

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
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast({ title: "Validation Error", description: "Subject and Description are required.", variant: "destructive" });
      return;
    }
    const token = getAuthProviderToken();
    if (!token && (!newTicket.name.trim() || !newTicket.mobile?.trim())) {
      toast({ title: "Validation Error", description: "Name and Phone number are required for guests.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      if (token) {
        await API.post("/support/tickets", {
          subject: newTicket.subject,
          description: newTicket.description,
          category: newTicket.category,
          priority: newTicket.priority
        });
      } else {
        await API.post("/support/public-tickets", newTicket);
      }
      toast({ title: "Ticket Raised ✓", description: "Our team will look into your issue shortly." });
      setIsRaisingTicket(false);
      setNewTicket({
        subject: "",
        description: "",
        category: "other",
        priority: "low",
        name: "",
        mobile: "",
        email: "",
        role: "provider"
      });
      if (token) fetchTickets();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || "Could not create ticket. Try again later.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      <main className="container max-w-4xl px-4 py-6 md:py-8 space-y-6 md:space-y-8 mx-auto">
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
          <button onClick={() => toast({ title: 'Live Chat Support', description: 'Connecting you to our next available executive. Please wait...', duration: 4000 })} className="flex items-center p-6 border border-border bg-card rounded-[24px] shadow-sm hover:shadow-md hover:border-emerald-200 transition-all text-left group">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 mr-4 group-hover:scale-110 transition-all">
              <MessageSquare className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Live Chat</h3>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Connect with an executive instantly</p>
            </div>
          </button>

          <button onClick={() => toast({ title: 'Call Requested', description: 'Our support team will call you back within 2-4 hours.', duration: 5000 })} className="flex items-center p-6 border border-border bg-card rounded-[24px] shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left group">
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
            <span className="text-[9px] font-black uppercase tracking-tighter bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {getAuthProviderToken() ? `${tickets.filter(t => t.status === 'pending' || t.status === 'open').length} Active` : 'Login Required'}
            </span>
          </div>
          <div className="divide-y divide-border">
            {!getAuthProviderToken() ? (
              <div className="p-10 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 dark:bg-slate-800">
                  <LifeBuoy className="h-8 w-8 text-emerald-600 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground uppercase tracking-tight">Access Ticket History</p>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">Please login to view your raised tickets, active resolutions, and chat history with support specialists.</p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <Link to="/provider/login" className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase shadow-md shadow-emerald-600/10 hover:bg-emerald-700 transition-all">
                    Login
                  </Link>
                  <Link to="/provider/register" className="px-5 py-2.5 rounded-xl border border-border bg-card text-foreground font-black text-xs uppercase hover:bg-muted transition-all">
                    Register
                  </Link>
                </div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 mb-4">
                  <FileQuestion className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-xs font-black text-foreground uppercase tracking-tight">No issues found</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-1">Everything seems perfect! If you need help, raise a ticket.</p>
              </div>
            ) : (
              <>
                {tickets.slice((currentPage - 1) * ticketsPerPage, currentPage * ticketsPerPage).map((ticket) => (
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
                ))}
                
                {Math.ceil(tickets.length / ticketsPerPage) > 1 && (
                  <div className="p-4 flex items-center justify-center gap-4 border-t border-border">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 disabled:hover:bg-muted disabled:hover:text-muted-foreground transition-colors"
                    >
                      Prev
                    </button>
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      {currentPage} / {Math.ceil(tickets.length / ticketsPerPage)}
                    </span>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(tickets.length / ticketsPerPage)))}
                      disabled={currentPage === Math.ceil(tickets.length / ticketsPerPage)}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 disabled:hover:bg-muted disabled:hover:text-muted-foreground transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Training Articles */}
        <section>
          <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-muted-foreground mb-4 text-left">Resources</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {guides.length === 0 ? (
              <div onClick={() => toast({ title: 'Resources', description: 'Training materials and guides will be available soon.', duration: 3000 })} className="col-span-1 sm:col-span-3 p-6 text-center text-sm text-gray-500 border border-dashed rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">No Guides Available.</div>
            ) : guides.map((art) => (
              <div key={art._id} onClick={() => setSelectedGuide(art)} className="flex flex-col rounded-[24px] border border-border bg-card p-5 hover:border-emerald-500/30 transition-all cursor-pointer group shadow-sm text-left">
                <span className="text-[8px] font-black uppercase text-emerald-600 mb-2 tracking-widest">{art.category}</span>
                <h4 className="text-xs font-bold leading-tight mb-4 text-foreground flex-1">{art.title}</h4>
                <div className="flex items-center text-[9px] font-black uppercase text-muted-foreground group-hover:text-emerald-600 transition-colors">
                  {art.readTime} <ChevronRight className="h-3 w-3 ml-1" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isRaisingTicket && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-lg rounded-[40px] bg-card p-8 border border-border shadow-2xl relative overflow-y-auto max-h-[90vh]"
            >
              <button onClick={() => setIsRaisingTicket(false)} className="absolute top-6 right-6 h-10 w-10 flex items-center justify-center rounded-full bg-muted transition-all active:scale-95"><X className="h-5 w-5" /></button>
              <h2 className="text-2xl font-black tracking-tighter mb-1 text-left uppercase">Support Ticket</h2>
              <p className="text-xs text-muted-foreground mb-8 text-left font-medium">Explain your issue and we'll resolve it ASAP.</p>

              <form onSubmit={handleCreateTicket} className="space-y-4 text-left">
                {!getAuthProviderToken() && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">You Are A</label>
                        <select
                          required
                          value={newTicket.role}
                          onChange={(e) => setNewTicket({ ...newTicket, role: e.target.value })}
                          className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 outline-none font-bold text-xs appearance-none"
                        >
                          <option value="provider">Partner (Provider)</option>
                          <option value="sewak">Sewak</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Full Name / Shop Name</label>
                        <input
                          required
                          value={newTicket.name}
                          onChange={(e) => setNewTicket({ ...newTicket, name: e.target.value })}
                          placeholder="Enter your name"
                          className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 outline-none font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Mobile Number</label>
                        <input
                          required
                          type="tel"
                          pattern="[0-9]{10}"
                          value={newTicket.mobile}
                          onChange={(e) => setNewTicket({ ...newTicket, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                          placeholder="10-digit number"
                          className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 outline-none font-bold text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Email Address</label>
                        <input
                          type="email"
                          value={newTicket.email}
                          onChange={(e) => setNewTicket({ ...newTicket, email: e.target.value })}
                          placeholder="name@example.com (optional)"
                          className="w-full h-14 px-5 rounded-2xl bg-muted border-transparent focus:border-emerald-500/50 outline-none font-bold text-xs"
                        />
                      </div>
                    </div>
                  </>
                )}

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

        {/* Guide Reader Modal */}
        {selectedGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedGuide(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="flex w-full h-[90dvh] sm:h-[80vh] sm:max-w-2xl flex-col overflow-hidden rounded-[32px] bg-white dark:bg-slate-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5 sticky top-0 z-10">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white pr-4 leading-tight">{selectedGuide.title}</h3>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">{selectedGuide.category} • {selectedGuide.readTime}</p>
                </div>
                <button onClick={() => setSelectedGuide(null)} className="rounded-full p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 transition-colors self-start shrink-0">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-black prose-emerald">
                  {/* Render newlines as paragraphs for simple markdown support */}
                  {selectedGuide.content.split('\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4 text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{paragraph}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {getAuthProviderToken() && <ProviderBottomNav />}
    </div>
  );
};

export default ProviderSupport;
