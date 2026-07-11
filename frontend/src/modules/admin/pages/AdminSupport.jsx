import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Loader2, LifeBuoy, AlertCircle, MessageSquare, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminSupport = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle("Support Tickets");
    fetchTickets();
  }, [setTitle]);

  const fetchTickets = async () => {
    try {
      const { data } = await API.get("/support/admin/tickets");
      setTickets(data);
    } catch (err) {
      toast({ title: "Failed to load", description: "Could not load support tickets.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (id) => {
    if (!replyText.trim()) return;
    setIsSubmitting(true);
    try {
      const { data } = await API.patch(`/support/tickets/${id}/reply`, { reply: replyText });
      setTickets(tickets.map(t => t._id === id ? data : t));
      toast({ title: "Reply Sent", description: "The ticket has been resolved." });
      setReplyingTo(null);
      setReplyText("");
    } catch (err) {
      toast({ title: "Failed", description: "Could not send reply.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const search = (searchTerm || "").toLowerCase();
    const subject = (t.subject || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    const name = (t.contactInfo?.name || t.userId?.name || t.providerId?.name || "").toLowerCase();
    
    return subject.includes(search) || desc.includes(search) || name.includes(search);
  });

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Loading Tickets...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Support Tickets</h2>
          <p className="mt-1 text-sm text-gray-500">Manage user and provider support requests.</p>
        </div>
        <div className="relative w-full md:w-[320px]">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm" placeholder="Search tickets..." />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTickets.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <LifeBuoy className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-sm font-bold text-gray-900">No Tickets Found</h3>
            <p className="text-xs text-gray-500 mt-1">There are no support tickets matching your criteria.</p>
          </div>
        ) : (
          filteredTickets.map((t) => {
            const authorName = t.contactInfo?.name || t.providerId?.name || t.userId?.name || 'Anonymous';
            const authorRole = t.contactInfo?.role || (t.providerId ? 'Provider' : t.userId ? 'User' : 'Public');
            const authorPhone = t.contactInfo?.mobile || "N/A";
            
            return (
              <div key={t._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row gap-5 items-start">
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${t.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{t.priority}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${t.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t.status}</span>
                        <span className="text-[10px] font-bold text-gray-400">{new Date(t.createdAt).toLocaleString()}</span>
                      </div>
                      <h4 className="text-sm font-black text-gray-900">{t.subject}</h4>
                      <p className="text-xs text-gray-600 mt-1">{t.description}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">From: <span className="text-slate-800">{authorName}</span> ({authorRole})</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Contact: <span className="text-slate-800">{authorPhone}</span></p>
                  </div>

                  {t.reply ? (
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                      <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 mb-1"><CheckCircle2 className="h-4 w-4" /> Admin Reply</p>
                      <p className="text-sm text-emerald-700">{t.reply}</p>
                    </div>
                  ) : (
                    <div className="pt-2">
                      {replyingTo === t._id ? (
                        <div className="space-y-3">
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type your resolution here..."
                            className="w-full text-sm p-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            rows="3"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleReply(t._id)} disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                              {isSubmitting ? "Sending..." : "Mark as Resolved"}
                            </button>
                            <button onClick={() => setReplyingTo(null)} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setReplyingTo(t._id); setReplyText(""); }} className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                          <MessageSquare className="h-3.5 w-3.5" /> Reply & Resolve
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminSupport;
