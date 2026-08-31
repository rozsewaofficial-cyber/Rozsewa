import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Send, MessageCircle, Users, Loader2, X, Search, History,
  CheckCircle2, XCircle, Megaphone
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import API from '@/lib/api';

const TARGET_OPTIONS = [
  { value: 'all', label: 'Everyone' },
  { value: 'all_customers', label: 'All Customers' },
  { value: 'all_partners', label: 'All Partners' },
  { value: 'all_sewaks', label: 'All Sewaks' },
  { value: 'specific', label: 'Specific People' },
];

const AdminBroadcast = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('notification'); // 'notification' | 'whatsapp'

  const [audienceCounts, setAudienceCounts] = useState({});
  const [targetType, setTargetType] = useState('all');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState([]);

  const [title, setTitleField] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    setTitle('Broadcast');
    fetchAudienceCounts();
    fetchHistory();
  }, [setTitle]);

  const fetchAudienceCounts = async () => {
    try {
      const { data } = await API.get('/admin/broadcast/audience-counts');
      setAudienceCounts(data);
    } catch (err) { /* non-critical */ }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await API.get('/admin/broadcast/history');
      setHistory(data);
    } catch (err) {
      toast({ title: 'Failed to load broadcast history', variant: 'destructive' });
    } finally {
      setLoadingHistory(false);
    }
  };

  const runSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await API.get(`/admin/broadcast/recipients?q=${encodeURIComponent(q)}`);
      setSearchResults(data.filter(r => !selectedRecipients.some(s => s.id === r.id)));
    } catch (err) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [selectedRecipients]);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search, runSearch]);

  const addRecipient = (person) => {
    setSelectedRecipients(prev => [...prev, person]);
    setSearchResults(prev => prev.filter(r => r.id !== person.id));
    setSearch('');
  };

  const removeRecipient = (id) => {
    setSelectedRecipients(prev => prev.filter(r => r.id !== id));
  };

  const audienceCount = targetType === 'specific'
    ? selectedRecipients.length
    : (audienceCounts[targetType] ?? '...');

  const resetComposer = () => {
    setTitleField('');
    setMessage('');
    setTargetType('all');
    setSelectedRecipients([]);
    setSearch('');
  };

  const handleSend = async () => {
    if (activeTab === 'notification' && !title.trim()) {
      return toast({ title: 'Title is required', variant: 'destructive' });
    }
    if (!message.trim()) {
      return toast({ title: 'Message is required', variant: 'destructive' });
    }
    if (targetType === 'specific' && selectedRecipients.length === 0) {
      return toast({ title: 'Select at least one recipient', variant: 'destructive' });
    }

    const confirmMsg = targetType === 'specific'
      ? `Send this ${activeTab === 'whatsapp' ? 'WhatsApp message' : 'notification'} to ${selectedRecipients.length} selected people?`
      : `Send this ${activeTab === 'whatsapp' ? 'WhatsApp message' : 'notification'} to ${audienceCount} recipients (${TARGET_OPTIONS.find(t => t.value === targetType)?.label})? This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setSending(true);
    try {
      const payload = {
        message: message.trim(),
        targetType,
        recipients: targetType === 'specific' ? selectedRecipients.map(r => ({ id: r.id, role: r.role })) : undefined
      };
      if (activeTab === 'notification') payload.title = title.trim();

      const endpoint = activeTab === 'whatsapp' ? '/admin/broadcast/whatsapp' : '/admin/broadcast/notification';
      const { data } = await API.post(endpoint, payload);

      toast({ title: 'Broadcast Sent', description: data.message });
      resetComposer();
      fetchHistory();
    } catch (err) {
      toast({ title: 'Broadcast Failed', description: err.response?.data?.message || 'Server error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-blue-600" /> Broadcast
        </h2>
        <p className="mt-1 text-sm text-gray-500 font-medium">Send a push notification or WhatsApp message to everyone, a segment, or specific people.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        {[
          { id: 'notification', label: 'Push Notification', icon: Send },
          { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 flex items-center gap-1.5 text-sm font-bold border-b-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        {activeTab === 'whatsapp' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs font-semibold text-emerald-700">
            Sent via the configured WhatsApp API. Recipients without a valid mobile number, or if WHATSAPP_API_KEY isn't configured, will be skipped and counted as failed — check the history below after sending.
          </div>
        )}

        {activeTab === 'notification' && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitleField(e.target.value)}
              placeholder="e.g. New Year Offer!"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={activeTab === 'whatsapp' ? 'Write the WhatsApp message...' : 'Write the notification body...'}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
          />
        </div>

        {/* Target selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Send To</label>
          <div className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTargetType(opt.value)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${targetType === opt.value
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
              >
                {opt.label}
                {opt.value !== 'specific' && (
                  <span className={`ml-1.5 ${targetType === opt.value ? 'text-blue-100' : 'text-gray-400'}`}>
                    ({audienceCounts[opt.value] ?? '...'})
                  </span>
                )}
              </button>
            ))}
          </div>

          {targetType === 'specific' && (
            <div className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or mobile number..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
              </div>

              {searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {searchResults.map(r => (
                    <button
                      key={r.id}
                      onClick={() => addRecipient(r)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-blue-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-800">{r.name || 'Unnamed'}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{r.mobile}</p>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{r.role}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedRecipients.map(r => (
                    <span key={r.id} className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-2.5 py-1 text-xs font-bold">
                      {r.name || r.mobile}
                      <button onClick={() => removeRecipient(r.id)} className="hover:text-blue-900">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {audienceCount} recipient{audienceCount === 1 ? '' : 's'}
          </p>
          <button
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : (activeTab === 'whatsapp' ? <MessageCircle className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />)}
            {sending ? 'Sending...' : `Send ${activeTab === 'whatsapp' ? 'WhatsApp' : 'Notification'}`}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 uppercase tracking-widest">
          <History className="h-4 w-4 text-gray-400" /> Recent Broadcasts
        </h3>
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Message</th>
                  <th className="px-5 py-3">Target</th>
                  <th className="px-5 py-3 text-center">Delivered</th>
                  <th className="px-5 py-3">Sent By</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingHistory ? (
                  <tr><td colSpan="6" className="py-14 text-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" /></td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan="6" className="py-14 text-center text-sm text-gray-400 font-medium">No broadcasts sent yet</td></tr>
                ) : history.map(h => (
                  <tr key={h._id} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${h.channel === 'whatsapp' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                        {h.channel === 'whatsapp' ? <MessageCircle className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                        {h.channel}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      {h.title && <p className="text-xs font-bold text-gray-800 truncate">{h.title}</p>}
                      <p className="text-[11px] text-gray-500 truncate">{h.message}</p>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] font-bold text-gray-600">
                      {TARGET_OPTIONS.find(t => t.value === h.targetType)?.label || h.targetType}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> {h.successCount}
                      </span>
                      {h.failCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 ml-2">
                          <XCircle className="h-3 w-3" /> {h.failCount}
                        </span>
                      )}
                      <p className="text-[9px] text-gray-400 font-bold mt-0.5">of {h.recipientCount}</p>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] font-bold text-gray-600">{h.sentBy?.name || 'Admin'}</td>
                    <td className="px-5 py-3.5 text-[11px] text-gray-400 font-medium">
                      {new Date(h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcast;
