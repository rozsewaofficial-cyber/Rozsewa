import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Loader2, LifeBuoy, MessageSquare, PhoneCall, ChevronUp, User, Hash, Phone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { useSocket } from "@/context/SocketContext";
import SupportTicketThread, { ticketNumber, ticketOwner, CALL_STATUS, lastSpeaker } from "@/components/support/SupportTicketThread";

const AdminSupport = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  // The ticket whose Live Chat is open, and the list filter.
  const [chatOpen, setChatOpen] = useState(null);
  const [filter, setFilter] = useState("all");
  const socketCtx = useSocket();
  const socket = socketCtx?.socket;

  useEffect(() => {
    setTitle("Support Tickets");
    fetchTickets();
  }, [setTitle]);

  // A new ticket, message or call request shows up without a reload.
  const refreshTimer = useRef(null);
  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(fetchTickets, 600);
    };
    socket.on("SUPPORT_TICKET_UPDATED", onUpdate);
    return () => { socket.off("SUPPORT_TICKET_UPDATED", onUpdate); clearTimeout(refreshTimer.current); };
  }, [socket]);

  const replaceTicket = (data) => setTickets(prev => prev.map(t => t._id === data._id ? { ...t, ...data } : t));

  const setStatus = async (id, status) => {
    try {
      const { data } = await API.patch(`/support/tickets/${id}/status`, { status });
      replaceTicket(data);
      toast({ title: `Ticket ${status}` });
    } catch (err) {
      toast({ title: "Failed", description: err.response?.data?.message, variant: "destructive" });
    }
  };

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

  const callOpen = (t) => ["requested", "in_progress"].includes(t.callRequest?.status);
  const callCount = tickets.filter(callOpen).length;

  const filteredTickets = tickets.filter(t => {
    if (filter === "calls" && !callOpen(t)) return false;
    if (filter === "open" && !["pending", "open"].includes(t.status)) return false;
    const search = (searchTerm || "").toLowerCase();
    const owner = ticketOwner(t);
    // Searchable by partner name, business, Partner ID, mobile and ticket number too.
    const haystack = [t.subject, t.description, owner.name, owner.business, owner.partnerId, owner.mobile, ticketNumber(t)]
      .join(" ").toLowerCase();
    return haystack.includes(search);
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
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm" placeholder="Search name, Partner ID, mobile, ticket..." />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[["all", "All tickets"], ["open", "Open"], ["calls", `Call requests${callCount ? ` (${callCount})` : ""}`]].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-colors ${filter === key ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"}`}>
            {label}
          </button>
        ))}
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
            const owner = ticketOwner(t);
            const call = t.callRequest?.status ? CALL_STATUS[t.callRequest.status] : null;
            const messageCount = (t.messages || []).length;

            return (
              <div key={t._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row gap-5 items-start">
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${t.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{t.priority}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${t.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{t.status}</span>
                        <span className="text-[10px] font-black text-gray-500">{ticketNumber(t)}</span>
                        {lastSpeaker(t) === "owner" && (t.messages || []).length > 0 && !["resolved", "closed"].includes(t.status) && (
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-rose-100 text-rose-700">{owner.kind} replied</span>
                        )}
                        {call && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${call.tone}`}>
                            <PhoneCall className="h-3 w-3" /> Call {call.label}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-gray-400">{new Date(t.createdAt).toLocaleString()}</span>
                      </div>
                      <h4 className="text-sm font-black text-gray-900">{t.subject}</h4>
                      <p className="text-xs text-gray-600 mt-1">{t.description}</p>
                    </div>
                  </div>

                  {/* Who raised it, from their own partner / customer record */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2" data-ticket-owner>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><User className="h-3 w-3" /> {owner.kind} Name</p>
                      <p className="text-xs font-bold text-slate-800 truncate">{owner.name}</p>
                      {owner.business && <p className="text-[10px] font-medium text-slate-500 truncate">{owner.business}</p>}
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Hash className="h-3 w-3" /> {owner.kind} ID</p>
                      <p className="text-xs font-bold text-slate-800">{owner.partnerId || "Not assigned"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Phone className="h-3 w-3" /> Mobile</p>
                      {owner.mobile
                        ? <a href={`tel:${owner.mobile}`} className="text-xs font-bold text-sky-700 hover:underline">{owner.mobile}</a>
                        : <p className="text-xs font-bold text-slate-800">—</p>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setChatOpen(chatOpen === t._id ? null : t._id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                      {chatOpen === t._id ? <ChevronUp className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                      {chatOpen === t._id ? "Hide chat" : `Live Chat${messageCount ? ` (${messageCount})` : ""}`}
                    </button>
                    {t.status !== "resolved" && t.status !== "closed" && (
                      <button onClick={() => setStatus(t._id, "resolved")} className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg">Mark Resolved</button>
                    )}
                    {t.status !== "closed" && (
                      <button onClick={() => setStatus(t._id, "closed")} className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg">Close</button>
                    )}
                    {(t.status === "resolved" || t.status === "closed") && (
                      <button onClick={() => setStatus(t._id, "open")} className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg">Reopen</button>
                    )}
                  </div>

                  {chatOpen === t._id && (
                    <div className="rounded-2xl border border-emerald-100 bg-white p-3">
                      <SupportTicketThread ticketId={t._id} viewer="admin" onChange={replaceTicket} />
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
