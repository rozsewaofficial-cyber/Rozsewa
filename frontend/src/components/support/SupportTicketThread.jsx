import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, PhoneCall, PhoneOff, CheckCircle2, Clock, XCircle } from "lucide-react";
import API from "@/lib/api";
import { useSocket } from "@/context/SocketContext";
import { useToast } from "@/components/ui/use-toast";

// One support ticket's conversation and call request, shared by the
// partner's Support page and admin's Support Tickets.

export const ticketNumber = (t) => `#${String(t?._id || "").slice(-6).toUpperCase()}`;

/** Who raised a ticket: the partner / customer record, else the contact details given. */
export const ticketOwner = (t) => {
  const p = t?.providerId && typeof t.providerId === "object" ? t.providerId : null;
  const u = t?.userId && typeof t.userId === "object" ? t.userId : null;
  if (p) {
    return {
      kind: p.providerCategory === "sewak" ? "Sewak" : "Partner",
      name: p.ownerName || p.shopName || t.contactInfo?.name || "Partner",
      business: p.shopName && p.shopName !== p.ownerName ? p.shopName : "",
      partnerId: p.vendorCode || "",
      mobile: p.mobile || t.contactInfo?.mobile || "",
    };
  }
  if (u) return { kind: "Customer", name: u.name || "Customer", business: "", partnerId: "", mobile: u.mobile || "" };
  return {
    kind: t?.contactInfo?.role === "customer" ? "Customer" : "Guest",
    name: t?.contactInfo?.name || "Guest",
    business: "",
    partnerId: "",
    mobile: t?.contactInfo?.mobile || "",
  };
};

export const CALL_STATUS = {
  requested: { label: "Requested", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: Clock },
  in_progress: { label: "In Progress", tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300", icon: PhoneCall },
  completed: { label: "Completed", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", tone: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: XCircle },
};

/** Who sent the latest message: "admin", "owner", or null when nobody has replied yet. */
export const lastSpeaker = (t) => {
  const msgs = t?.messages || [];
  if (msgs.length) return msgs[msgs.length - 1].sender === "admin" ? "admin" : "owner";
  return t?.reply ? "admin" : null;
};

export const CALL_TIMES = ["As soon as possible", "Morning (9am - 12pm)", "Afternoon (12pm - 4pm)", "Evening (4pm - 8pm)"];

const fmt = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** The conversation: the issue as first raised, then every message (and an old single reply). */
const conversation = (t) => {
  const items = [{ key: "issue", mine: "owner", name: "Issue raised", text: t.description, at: t.createdAt }];
  for (const m of t.messages || []) {
    items.push({ key: m._id || `${m.createdAt}-${m.text}`, mine: m.sender === "admin" ? "admin" : "owner", name: m.senderName, text: m.text, at: m.createdAt });
  }
  // Tickets answered before chat existed carry their answer in `reply` only.
  if (t.reply && !(t.messages || []).some((m) => m.sender === "admin")) {
    items.push({ key: "legacy-reply", mine: "admin", name: "RozSewa Support", text: t.reply, at: t.updatedAt });
  }
  return items;
};

const SupportTicketThread = ({ ticketId, viewer = "provider", onChange, showCall = true }) => {
  const { toast } = useToast();
  const socketCtx = useSocket();
  const socket = socketCtx?.socket;
  const [ticket, setTicket] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [callTime, setCallTime] = useState(CALL_TIMES[0]);
  const bottomRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const load = useCallback(async () => {
    try {
      const { data } = await API.get(`/support/tickets/${ticketId}`);
      setTicket(data);
      onChangeRef.current?.(data);
    } catch {
      toast({ title: "Couldn't load this ticket", variant: "destructive" });
    }
  }, [ticketId, toast]);

  useEffect(() => { load(); }, [load]);

  // New messages arrive without a reload: the server announces a change on
  // the socket; a slow poll covers a dropped connection.
  useEffect(() => {
    const onUpdate = (data) => { if (data?.ticketId === ticketId) load(); };
    socket?.on("SUPPORT_TICKET_UPDATED", onUpdate);
    const poll = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => { socket?.off("SUPPORT_TICKET_UPDATED", onUpdate); clearInterval(poll); };
  }, [socket, ticketId, load]);

  const count = (ticket?.messages || []).length;
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [count]);

  const apply = (data) => { setTicket(data); onChangeRef.current?.(data); };

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { data } = await API.post(`/support/tickets/${ticketId}/messages`, { text: body });
      setText("");
      apply(data);
    } catch (err) {
      toast({ title: "Message not sent", description: err.response?.data?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const act = async (fn, done) => {
    setBusy(true);
    try {
      const { data } = await fn();
      apply(data);
      if (done) toast({ title: done });
    } catch (err) {
      toast({ title: "Couldn't update", description: err.response?.data?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!ticket) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;
  }

  const call = ticket.callRequest?.status ? ticket.callRequest : null;
  const callOpen = call && ["requested", "in_progress"].includes(call.status);
  const CallIcon = call ? CALL_STATUS[call.status]?.icon || Clock : PhoneCall;
  const owner = ticketOwner(ticket);
  const items = conversation(ticket);

  return (
    <div className="flex flex-col gap-3 text-left">
      {/* Call request */}
      {(showCall || call) && <div className="rounded-2xl border border-border bg-muted/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-foreground">
            <CallIcon className="h-4 w-4 text-sky-600" /> Call request
          </p>
          {call ? (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${CALL_STATUS[call.status]?.tone}`}>{CALL_STATUS[call.status]?.label}</span>
          ) : (
            <span className="text-[10px] font-bold text-muted-foreground">None</span>
          )}
        </div>
        {call && (
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
            {call.preferredTime} · requested {fmt(call.requestedAt)}
            {viewer === "admin" && (call.phone || owner.mobile) && <> · <a href={`tel:${call.phone || owner.mobile}`} className="font-bold text-sky-700 underline">{call.phone || owner.mobile}</a></>}
            {call.note ? <span className="block mt-0.5">“{call.note}”</span> : null}
          </p>
        )}

        {viewer === "admin" && callOpen && (
          <div className="mt-2 flex flex-wrap gap-2">
            {call.status === "requested" && (
              <button disabled={busy} onClick={() => act(() => API.patch(`/support/tickets/${ticketId}/call-request`, { status: "in_progress" }), "Marked in progress")}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700 disabled:opacity-50">Start call</button>
            )}
            <button disabled={busy} onClick={() => act(() => API.patch(`/support/tickets/${ticketId}/call-request`, { status: "completed" }), "Call completed")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Completed</button>
            <button disabled={busy} onClick={() => act(() => API.patch(`/support/tickets/${ticketId}/call-request`, { status: "cancelled" }), "Call request cancelled")}
              className="rounded-lg bg-muted px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted/70 disabled:opacity-50">Cancel</button>
          </div>
        )}

        {viewer !== "admin" && (callOpen ? (
          <button disabled={busy} onClick={() => act(() => API.patch(`/support/tickets/${ticketId}/call-request`, { status: "cancelled" }), "Call request cancelled")}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted/70 disabled:opacity-50">
            <PhoneOff className="h-3.5 w-3.5" /> Cancel request
          </button>
        ) : (
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <select value={callTime} onChange={(e) => setCallTime(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[11px] font-bold">
              {CALL_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button disabled={busy} onClick={() => act(() => API.post(`/support/tickets/${ticketId}/call-request`, { preferredTime: callTime }), "Call requested — our team will call you")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-sky-700 disabled:opacity-50">
              <PhoneCall className="h-3.5 w-3.5" /> Request a call
            </button>
          </div>
        ))}
      </div>}

      {/* Conversation */}
      <div className="max-h-[45vh] min-h-[160px] overflow-y-auto rounded-2xl border border-border bg-background p-3 space-y-2.5" data-ticket-chat>
        {items.map((m) => {
          const mine = (viewer === "admin") === (m.mine === "admin");
          return (
            <div key={m.key} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "bg-emerald-600 text-white rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                <p className={`text-[9px] font-black uppercase tracking-wider ${mine ? "text-emerald-100" : "text-muted-foreground"}`}>{m.name || (m.mine === "admin" ? "RozSewa Support" : owner.name)}</p>
                <p className="text-[13px] leading-snug whitespace-pre-wrap break-words">{m.text}</p>
                <p className={`mt-0.5 text-right text-[9px] font-medium ${mine ? "text-emerald-100" : "text-muted-foreground"}`}>{fmt(m.at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {ticket.status === "closed" && viewer === "admin" ? (
        <p className="text-center text-[11px] font-bold text-muted-foreground">This ticket is closed. Reopen it to reply.</p>
      ) : (
        <form onSubmit={send} className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            maxLength={2000}
            placeholder={viewer === "admin" ? "Reply to the partner..." : "Type your message..."}
            className="min-h-[44px] max-h-32 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      )}
    </div>
  );
};

export default SupportTicketThread;
