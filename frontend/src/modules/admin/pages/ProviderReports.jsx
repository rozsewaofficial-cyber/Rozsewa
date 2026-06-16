import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle, Ban, AlertTriangle, User, UserCog, Calendar, IndianRupee } from 'lucide-react';
import API from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const ProviderReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [blockUser, setBlockUser] = useState(false);
  const { toast } = useToast();

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/admin/provider-reports');
      setReports(data);
    } catch (err) {
      toast({ title: 'Failed to load reports', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleResolve = async () => {
    try {
      await API.patch(`/admin/provider-reports/${activeReport._id}/resolve`, {
        actionTaken: blockUser ? 'Blocked User' : 'Resolved Dispute',
        notes: resolutionNotes,
        blockUser
      });
      toast({ title: 'Report Resolved Successfully' });
      setActiveReport(null);
      setResolutionNotes('');
      setBlockUser(false);
      fetchReports();
    } catch (err) {
      toast({ title: 'Resolution Failed', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Provider Reports</h1>
          <p className="text-sm font-bold text-muted-foreground mt-1">Manage disputes raised by providers against customers</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 shadow-inner">
          <ShieldAlert className="h-6 w-6" />
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
            <CheckCircle className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-black text-foreground">No Pending Reports</h3>
          <p className="text-sm font-medium text-muted-foreground mt-1">All provider disputes have been resolved.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <motion.div
              key={report._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-lg flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Issue Reported</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {new Date(report.adminRequest.requestedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-rose-50/50 dark:bg-rose-950/10 rounded-xl p-3 mb-4 border border-rose-100 dark:border-rose-900/30">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-400">"{report.adminRequest.reason}"</p>
              </div>

              <div className="space-y-3 flex-1">
                <div className="flex items-center justify-between text-xs font-medium border-b border-border pb-2">
                  <span className="text-muted-foreground flex items-center gap-1"><UserCog className="h-3.5 w-3.5" /> Provider</span>
                  <span className="font-bold text-foreground">{report.providerId?.shopName || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium border-b border-border pb-2">
                  <span className="text-muted-foreground flex items-center gap-1"><User className="h-3.5 w-3.5" /> Customer</span>
                  <span className="font-bold text-foreground">{report.userId?.name || 'Unknown'} ({report.userId?.mobile})</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium border-b border-border pb-2">
                  <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Service</span>
                  <span className="font-bold text-foreground">{report.serviceName}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground flex items-center gap-1"><IndianRupee className="h-3.5 w-3.5" /> Amount</span>
                  <span className="font-black text-emerald-600">₹{report.totalAmount}</span>
                </div>
              </div>

              <button
                onClick={() => setActiveReport(report)}
                className="mt-5 w-full rounded-xl bg-primary py-2.5 text-xs font-black text-white shadow-md hover:bg-primary/90 transition-all uppercase tracking-widest"
              >
                Take Action
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* ACTION MODAL */}
      <AnimatePresence>
        {activeReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-[32px] bg-card p-8 border border-border shadow-2xl">
              <h3 className="text-lg font-black text-center mb-1 text-foreground">Resolve Dispute</h3>
              <p className="text-[10px] text-muted-foreground text-center mb-6 font-bold uppercase tracking-widest">
                Action against {activeReport.userId?.name}
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Admin Notes / Resolution</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Enter details about how this was resolved..."
                    className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                  />
                </div>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-rose-200 bg-rose-50 cursor-pointer hover:bg-rose-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={blockUser}
                    onChange={(e) => setBlockUser(e.target.checked)}
                    className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-rose-700 flex items-center gap-1">
                      <Ban className="h-4 w-4" /> Block Customer Account
                    </span>
                    <span className="text-[10px] font-bold text-rose-600/70 uppercase">Customer will no longer be able to login</span>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setActiveReport(null); setBlockUser(false); setResolutionNotes(''); }}
                  className="flex-1 rounded-xl bg-muted py-3 text-xs font-bold text-muted-foreground hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={!resolutionNotes.trim()}
                  className="flex-1 rounded-xl bg-primary py-3 text-xs font-black text-white hover:bg-primary/90 shadow-lg shadow-primary/20 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Resolution
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProviderReports;
