import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useScrollLock } from '@/lib/scrollLock';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Clock, User, Briefcase,
  ChevronLeft, ChevronRight, X, MessageSquare
} from 'lucide-react';
import API from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const STATUS_CONFIG = {
  open:        { label: 'Open',      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',         dot: 'bg-amber-500'   },
  'in-review': { label: 'In Review', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',             dot: 'bg-blue-500'    },
  resolved:    { label: 'Resolved',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
};

const ISSUE_ICONS = {
  'Service Quality':    '⭐',
  'Wrong Charges':      '💸',
  'Provider Behaviour': '🚨',
  'Incomplete Work':    '🔧',
  'Damage Caused':      '💥',
  'Other':              '📝',
};

const PAGE_SIZE = 10;

const AdminReports = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [complaints, setComplaints]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeComplaint, setActive]    = useState(null);
  const [saving, setSaving]             = useState(false);
  const [adminNotes, setAdminNotes]     = useState('');
  const [newStatus, setNewStatus]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage]                 = useState(1);

  useScrollLock(!!activeComplaint);

  useEffect(() => {
    setTitle('User Reports');
    fetchComplaints();
  }, []);

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [filterStatus]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/complaints/admin');
      setComplaints(data);
    } catch {
      toast({ title: 'Failed to load complaints', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (c) => {
    setActive(c);
    setAdminNotes(c.adminNotes || '');
    setNewStatus(c.status);
  };

  const handleSave = async () => {
    if (!activeComplaint) return;
    setSaving(true);
    try {
      await API.put(`/complaints/admin/${activeComplaint._id}`, { status: newStatus, adminNotes });
      toast({ title: 'Complaint updated successfully' });
      setActive(null);
      fetchComplaints();
    } catch {
      toast({ title: 'Failed to update complaint', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filtered   = filterStatus === 'all' ? complaints : complaints.filter(c => c.status === filterStatus);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    open:        complaints.filter(c => c.status === 'open').length,
    'in-review': complaints.filter(c => c.status === 'in-review').length,
    resolved:    complaints.filter(c => c.status === 'resolved').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-foreground">User Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complaints submitted by users via "Report an Issue"</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all',       label: `All (${complaints.length})` },
            { key: 'open',      label: `Open (${counts.open})` },
            { key: 'in-review', label: `In Review (${counts['in-review']})` },
            { key: 'resolved',  label: `Resolved (${counts.resolved})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filterStatus === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open',      value: counts.open,         icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20',    filter: 'open'      },
          { label: 'In Review', value: counts['in-review'], icon: Clock,         color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',       filter: 'in-review' },
          { label: 'Resolved',  value: counts.resolved,     icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', filter: 'resolved'  },
        ].map(s => (
          <button key={s.label} onClick={() => setFilterStatus(prev => prev === s.filter ? 'all' : s.filter)}
            className={`${s.bg} rounded-2xl p-4 border transition-all text-left hover:scale-[1.02] active:scale-[0.98] ${filterStatus === s.filter ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
            <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
            <p className="text-2xl font-black text-foreground">{s.value}</p>
            <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* ── List ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-black text-foreground">No Reports Found</h3>
          <p className="text-sm text-muted-foreground mt-1">No complaints match the current filter.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((c, i) => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
              return (
                <motion.button
                  key={c._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => openDetail(c)}
                  className="w-full text-left bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/40 transition-all active:scale-[0.99] cursor-pointer group"
                >
                  <div className="flex items-center gap-3 p-4">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-lg shrink-0">
                      {ISSUE_ICONS[c.issueType] || '📝'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-foreground">{c.issueType}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />{c.userId?.name || 'Unknown'} · {c.userId?.mobile || '—'}
                        </span>
                        {c.bookingId?.serviceName && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Briefcase className="h-3 w-3" />{c.bookingId.serviceName}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.createdAt).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Arrow hint */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* ── Pagination ──────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-bold text-foreground">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="font-bold text-foreground">{filtered.length}</span> reports
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-border hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && arr[idx - 1] !== p - 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 text-muted-foreground text-sm">…</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-all border ${page === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted text-foreground'}`}>
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-border hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Manage Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {activeComplaint && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="text-base font-black text-foreground">Manage Report</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{activeComplaint.userId?.name} · {activeComplaint.issueType}</p>
                </div>
                <button onClick={() => setActive(null)} className="p-2 rounded-full hover:bg-muted transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">User Description</p>
                  <p className="text-sm text-foreground bg-muted/50 rounded-xl p-3 leading-relaxed">{activeComplaint.description}</p>
                </div>
                {activeComplaint.bookingId && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
                    <Briefcase className="h-3.5 w-3.5 shrink-0" />
                    <span>Booking: <strong className="text-foreground">{activeComplaint.bookingId.serviceName}</strong> — {activeComplaint.bookingId.status}</span>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Update Status</p>
                  <div className="flex gap-2">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button key={key} onClick={() => setNewStatus(key)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${newStatus === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Admin Notes</p>
                  <textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes or resolution summary..."
                    className="w-full p-3 rounded-xl border border-border bg-background text-sm resize-none outline-none focus:border-primary transition" />
                </div>
              </div>
              <div className="p-5 border-t border-border flex gap-3">
                <button onClick={() => setActive(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminReports;
