import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Store, Clock, CheckCircle, XCircle, Settings, Tag, MessageSquare,
  IndianRupee, Trash2, Eye, ChevronDown, ChevronUp, Search, RefreshCw,
  Plus, Edit2, Save, X, PackageCheck, TrendingUp, Users, ShieldAlert
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const TABS = [
  { id: 'pending', label: 'Pending Review', icon: Clock },
  { id: 'ads', label: 'All Ads', icon: Store },
  { id: 'transactions', label: 'Unlock Revenue', icon: IndianRupee },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'templates', label: 'Chat Templates', icon: MessageSquare },
  { id: 'chat_audit', label: 'Live Chat Audit', icon: Eye },
  { id: 'violations', label: 'PII Violations', icon: ShieldAlert },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const STATUS_COLORS = {
  live: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending_review: 'bg-amber-100 text-amber-700 border-amber-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  sold: 'bg-blue-100 text-blue-700 border-blue-200',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

// ─── Approve / Reject Modal ─────────────────────────────────────────────────
const ReviewModal = ({ ad, onClose, onSubmit, loading }) => {
  const [action, setAction] = useState('approve');
  const [unlockFee, setUnlockFee] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-800">Review Ad</h3>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ad.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Images preview */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ad.images?.slice(0, 5).map((img, i) => (
              <img key={i} src={img} alt="" className="h-20 w-20 rounded-xl object-cover shrink-0 border border-slate-100" />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Price</p>
              <p className="font-black text-slate-800">₹{ad.price?.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Category</p>
              <p className="font-bold text-slate-700">{ad.category}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 col-span-2">
              <p className="text-xs text-slate-500">Seller</p>
              <p className="font-bold text-slate-700">{ad.sellerId?.name} · {ad.sellerId?.mobile}</p>
            </div>
          </div>

          {/* Action Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setAction('approve')}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${action === 'approve' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              ✓ Approve
            </button>
            <button
              onClick={() => setAction('reject')}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${action === 'reject' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              ✗ Reject
            </button>
          </div>

          {action === 'approve' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">
                  Unlock Fee Override (₹) — leave blank to use global default
                </label>
                <input
                  type="number"
                  value={unlockFee}
                  onChange={e => setUnlockFee(e.target.value)}
                  placeholder="e.g. 25 (optional)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-400 transition-colors"
                  min={0}
                />
              </div>
            </div>
          )}

          {action === 'reject' && (
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Misleading description, prohibited item..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>
          )}

          {/* Internal Note */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">Internal Note (not visible to user)</label>
            <input
              type="text"
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              placeholder="Optional internal note..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ action, unlockFee, adminNote, rejectionReason })}
            disabled={loading}
            className={`flex-1 py-3 font-bold rounded-xl text-sm text-white transition-all disabled:opacity-50 ${action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}
          >
            {loading ? 'Processing...' : action === 'approve' ? 'Approve & Publish' : 'Reject Ad'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Pending Ads Tab ─────────────────────────────────────────────────────────
const PendingTab = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewingAd, setReviewingAd] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bazaar/admin/pending');
      if (res.data.success) setAds(res.data.data);
    } catch (e) { toast.error('Failed to load pending ads'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleReview = async ({ action, unlockFee, adminNote, rejectionReason }) => {
    setSubmitting(true);
    try {
      await api.put(`/bazaar/admin/review/${reviewingAd._id}`, {
        action,
        unlockFee: unlockFee !== '' ? parseFloat(unlockFee) : undefined,
        adminNote,
        rejectionReason
      });
      toast.success(action === 'approve' ? '✅ Ad approved and is now live!' : '❌ Ad rejected.');
      setReviewingAd(null);
      fetchPending();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!ads.length) return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <PackageCheck className="w-12 h-12 text-slate-300 mb-3" />
      <p className="font-bold text-slate-500">All clear! No pending ads.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-600">{ads.length} ads waiting for review</p>
        <button onClick={fetchPending} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {ads.map(ad => (
        <div key={ad._id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Card Header */}
          <div className="p-4 flex gap-4">
            <img
              src={ad.images?.[0]}
              alt=""
              className="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-100"
            />
            <div className="flex-1 min-w-0">
              <p className="font-black text-slate-800 line-clamp-1">{ad.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{ad.category} · {ad.condition}</p>
              <p className="text-lg font-black text-blue-600 mt-1">₹{ad.price?.toLocaleString('en-IN')}</p>
              <p className="text-xs text-slate-500 mt-0.5">By: {ad.sellerId?.name} · {ad.sellerId?.mobile}</p>
            </div>
          </div>

          {/* Expand for description */}
          <div className="px-4 pb-2">
            <button
              onClick={() => setExpanded(expanded === ad._id ? null : ad._id)}
              className="flex items-center gap-1 text-xs text-slate-500 font-bold"
            >
              {expanded === ad._id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded === ad._id ? 'Hide' : 'View'} description
            </button>
            {expanded === ad._id && (
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap leading-relaxed">{ad.description}</p>
            )}
          </div>

          {/* Image strip */}
          {ad.images?.length > 1 && (
            <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto">
              {ad.images.slice(1).map((img, i) => (
                <img key={i} src={img} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0 border border-slate-100" />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={() => setReviewingAd(ad)}
              className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="w-4 h-4" /> Review
            </button>
          </div>
        </div>
      ))}

      {reviewingAd && (
        <ReviewModal
          ad={reviewingAd}
          onClose={() => setReviewingAd(null)}
          onSubmit={handleReview}
          loading={submitting}
        />
      )}
    </div>
  );
};

// ─── All Ads Tab ──────────────────────────────────────────────────────────────
const AllAdsTab = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (search) params.append('search', search);
      const res = await api.get(`/bazaar/admin/ads?${params}`);
      if (res.data.success) setAds(res.data.data);
    } catch (e) { toast.error('Failed to load ads'); }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this ad?')) return;
    try {
      await api.delete(`/bazaar/admin/ads/${id}`);
      toast.success('Ad deleted');
      fetchAds();
    } catch (e) { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="live">Live</option>
          <option value="rejected">Rejected</option>
          <option value="sold">Sold</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Ad</th>
                <th className="px-4 py-3 text-left font-bold hidden md:table-cell">Seller</th>
                <th className="px-4 py-3 text-left font-bold">Price</th>
                <th className="px-4 py-3 text-left font-bold">Status</th>
                <th className="px-4 py-3 text-left font-bold hidden md:table-cell">Unlock Fee</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ads.map(ad => (
                <tr key={ad._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={ad.images?.[0]} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate max-w-[160px]">{ad.title}</p>
                        <p className="text-[10px] text-slate-400">{ad.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="font-medium text-slate-700">{ad.sellerId?.name}</p>
                    <p className="text-[10px] text-slate-400">{ad.sellerId?.mobile}</p>
                  </td>
                  <td className="px-4 py-3 font-black text-blue-600">₹{ad.price?.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${STATUS_COLORS[ad.status] || 'bg-slate-100 text-slate-600'}`}>
                      {ad.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-600 font-medium">
                    {ad.unlockFee !== null && ad.unlockFee !== undefined ? `₹${ad.unlockFee}` : 'Global Default'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(ad._id)}
                      className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ads.length && (
            <div className="text-center py-12 text-slate-400 font-medium">No ads found</div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Transactions Tab ─────────────────────────────────────────────────────────
const TransactionsTab = () => {
  const [data, setData] = useState({ transactions: [], totalRevenue: 0, globalFee: 20 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/bazaar/admin/transactions');
        if (res.data.success) {
          setData({
            transactions: res.data.data,
            totalRevenue: res.data.totalRevenue,
            globalFee: res.data.globalFee
          });
        }
      } catch (e) { toast.error('Failed to load transactions'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
          <IndianRupee className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-emerald-600">₹{data.totalRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Unlock Revenue</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
          <TrendingUp className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-blue-600">{data.transactions.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Unlocks</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
          <Users className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-purple-600">₹{data.globalFee}</p>
          <p className="text-xs text-slate-500 mt-0.5">Global Fee</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-slate-600">Buyer</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">Ad</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">Amount</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600 hidden md:table-cell">Mode</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600 hidden md:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.transactions.map(t => (
              <tr key={t._id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-800">{t.buyerId?.name}</p>
                  <p className="text-[10px] text-slate-400">{t.buyerId?.mobile}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700 truncate max-w-[160px]">{t.adId?.title}</p>
                  <p className="text-[10px] text-slate-400">{t.adId?.category}</p>
                </td>
                <td className="px-4 py-3 font-black text-emerald-600">₹{t.amount}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-full capitalize">{t.paymentMode}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                  {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.transactions.length && (
          <div className="text-center py-12 text-slate-400 font-medium">No unlock transactions yet</div>
        )}
      </div>
    </div>
  );
};

// ─── Categories Tab ───────────────────────────────────────────────────────────
const CategoriesTab = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCat, setNewCat] = useState({ name: '', description: '', icon: 'Package', subCategories: '' });
  const [creating, setCreating] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bazaar/categories');
      if (res.data.success) setCategories(res.data.data);
    } catch (e) { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async () => {
    if (!newCat.name.trim()) return toast.error('Category name is required');
    setCreating(true);
    try {
      await api.post('/bazaar/admin/categories', {
        ...newCat,
        subCategories: newCat.subCategories.split(',').map(s => s.trim()).filter(Boolean)
      });
      toast.success('Category created');
      setNewCat({ name: '', description: '', icon: 'Package', subCategories: '' });
      fetchCategories();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.delete(`/bazaar/admin/categories/${id}`);
      toast.success('Deleted');
      fetchCategories();
    } catch (e) { toast.error('Delete failed'); }
  };

  const handleToggle = async (cat) => {
    try {
      await api.put(`/bazaar/admin/categories/${cat._id}`, { isActive: !cat.isActive });
      fetchCategories();
    } catch (e) { toast.error('Toggle failed'); }
  };

  return (
    <div className="space-y-4">
      {/* Create Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h4 className="font-black text-slate-800 flex items-center gap-2"><Plus className="w-4 h-4 text-blue-500" /> Add Category</h4>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Category name *"
            value={newCat.name}
            onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
            className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />
          <input
            type="text"
            placeholder="Icon name (e.g. Package)"
            value={newCat.icon}
            onChange={e => setNewCat(p => ({ ...p, icon: e.target.value }))}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />
          <input
            type="text"
            placeholder="Subcategories (comma-separated)"
            value={newCat.subCategories}
            onChange={e => setNewCat(p => ({ ...p, subCategories: e.target.value }))}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />
          <input
            type="text"
            placeholder="Description"
            value={newCat.description}
            onChange={e => setNewCat(p => ({ ...p, description: e.target.value }))}
            className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating...' : 'Create Category'}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-24"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600 hidden md:table-cell">Subcategories</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map(cat => (
                <tr key={cat._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{cat.name}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{cat.subCategories?.join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(cat)}
                      className={`text-[10px] font-black px-2 py-1 rounded-full border transition-colors ${cat.isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                    >
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(cat._id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Chat Templates Tab ───────────────────────────────────────────────────────
const TemplatesTab = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTpl, setNewTpl] = useState({ text: '', forRole: 'buyer', order: 0 });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      // No role filter = admin gets all
      const res = await api.get('/bazaar/chat-templates');
      if (res.data.success) setTemplates(res.data.data);
    } catch (e) { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreate = async () => {
    if (!newTpl.text.trim()) return toast.error('Template text is required');
    setCreating(true);
    try {
      await api.post('/bazaar/admin/chat-templates', newTpl);
      toast.success('Template created');
      setNewTpl({ text: '', forRole: 'buyer', order: 0 });
      fetchTemplates();
    } catch (e) { toast.error('Create failed'); }
    finally { setCreating(false); }
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/bazaar/admin/chat-templates/${id}`, editData);
      toast.success('Updated');
      setEditingId(null);
      fetchTemplates();
    } catch (e) { toast.error('Update failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/bazaar/admin/chat-templates/${id}`);
      toast.success('Deleted');
      fetchTemplates();
    } catch (e) { toast.error('Delete failed'); }
  };

  const ROLE_LABELS = { buyer: 'Buyer Only', seller: 'Seller Only', both: 'Both' };
  const ROLE_COLORS = {
    buyer: 'bg-blue-100 text-blue-700 border-blue-200',
    seller: 'bg-orange-100 text-orange-700 border-orange-200',
    both: 'bg-purple-100 text-purple-700 border-purple-200'
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
        <p className="font-bold mb-1">How Chat Templates Work</p>
        <ul className="space-y-0.5 text-xs font-medium list-disc list-inside">
          <li><strong>Buyer Only</strong> — Quick reply buttons shown only to buyers in the offer chat</li>
          <li><strong>Seller Only</strong> — Quick reply buttons shown only to sellers when responding to offers</li>
          <li><strong>Both</strong> — Shown to both buyer and seller</li>
        </ul>
      </div>

      {/* Create Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h4 className="font-black text-slate-800 flex items-center gap-2"><Plus className="w-4 h-4 text-blue-500" /> Add Template</h4>
        <input
          type="text"
          placeholder="Template text *"
          value={newTpl.text}
          onChange={e => setNewTpl(p => ({ ...p, text: e.target.value }))}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
        />
        <div className="flex gap-2">
          <select
            value={newTpl.forRole}
            onChange={e => setNewTpl(p => ({ ...p, forRole: e.target.value }))}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
          >
            <option value="buyer">Buyer Only</option>
            <option value="seller">Seller Only</option>
            <option value="both">Both</option>
          </select>
          <input
            type="number"
            placeholder="Order"
            value={newTpl.order}
            onChange={e => setNewTpl(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
            className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating...' : 'Add Template'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-24"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {templates.map(tpl => (
            <div key={tpl._id} className="bg-white rounded-2xl border border-slate-200 p-4">
              {editingId === tpl._id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editData.text ?? tpl.text}
                    onChange={e => setEditData(p => ({ ...p, text: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={editData.forRole ?? tpl.forRole}
                      onChange={e => setEditData(p => ({ ...p, forRole: e.target.value }))}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="buyer">Buyer Only</option>
                      <option value="seller">Seller Only</option>
                      <option value="both">Both</option>
                    </select>
                    <input
                      type="number"
                      value={editData.order ?? tpl.order}
                      onChange={e => setEditData(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(tpl._id)} className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1">
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                    <button onClick={() => { setEditingId(null); setEditData({}); }} className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">{tpl.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${ROLE_COLORS[tpl.forRole]}`}>
                        {ROLE_LABELS[tpl.forRole]}
                      </span>
                      <span className="text-[10px] text-slate-400">Order: {tpl.order}</span>
                      {!tpl.isActive && <span className="text-[10px] font-bold text-red-500">Inactive</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingId(tpl._id); setEditData({ text: tpl.text, forRole: tpl.forRole, order: tpl.order }); }}
                      className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-500 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(tpl._id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!templates.length && <div className="text-center py-8 text-slate-400">No templates yet</div>}
        </div>
      )}
    </div>
  );
};

// ─── Live Chat Audit Tab ───────────────────────────────────────────────────────
const ChatAuditTab = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bazaar/admin/offers');
      if (res.data.success) setOffers(res.data.data);
    } catch (e) { toast.error('Failed to load chat audit'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOffers(); }, []);

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-800">Admin Chat Monitor</h3>
          <p className="text-xs text-slate-500">Read live negotiation transcripts between buyers and sellers</p>
        </div>
        <button onClick={fetchOffers} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Offer Threads List */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
          {offers.map(o => (
            <div
              key={o._id}
              onClick={() => setSelectedOffer(o)}
              className={`p-3 cursor-pointer transition-colors ${selectedOffer?._id === o._id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50'}`}
            >
              <p className="font-bold text-slate-800 text-xs line-clamp-1">{o.adId?.title || 'Ad Deleted'}</p>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                <span>Buyer: {o.buyerId?.name}</span>
                <span className="font-bold text-blue-600">₹{o.currentOfferAmount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full capitalize font-bold text-slate-600">{o.status?.replace('_', ' ')}</span>
                <span className="text-[9px] text-slate-400">{o.offerHistory?.length || 0} msgs</span>
              </div>
            </div>
          ))}
          {!offers.length && <div className="p-6 text-center text-xs text-slate-400">No active offer threads</div>}
        </div>

        {/* Selected Chat Transcript Viewer */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col h-[500px]">
          {selectedOffer ? (
            <>
              <div className="border-b border-slate-100 pb-3 mb-3 flex justify-between items-start">
                <div>
                  <h4 className="font-black text-slate-800 text-sm">{selectedOffer.adId?.title}</h4>
                  <p className="text-xs text-slate-500">
                    Buyer: <strong>{selectedOffer.buyerId?.name}</strong> ({selectedOffer.buyerId?.mobile}) · Seller: <strong>{selectedOffer.sellerId?.name}</strong> ({selectedOffer.sellerId?.mobile})
                  </p>
                </div>
                <span className="text-xs font-black px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full capitalize">{selectedOffer.status?.replace('_', ' ')}</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-50 rounded-xl">
                {selectedOffer.offerHistory?.map((msg, i) => {
                  const isBuyerMsg = msg.senderId === selectedOffer.buyerId?._id;
                  if (msg.actionType === 'system_message') {
                    return (
                      <div key={i} className="text-center my-1">
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full">{msg.predefinedMessage}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className={`flex ${isBuyerMsg ? 'justify-start' : 'justify-end'}`}>
                      <div className={`p-2.5 rounded-xl max-w-[80%] text-xs ${isBuyerMsg ? 'bg-white border border-slate-200 text-slate-800' : 'bg-blue-600 text-white'}`}>
                        <p className="font-bold text-[9px] opacity-75 mb-0.5">{isBuyerMsg ? `Buyer (${selectedOffer.buyerId?.name})` : `Seller (${selectedOffer.sellerId?.name})`}</p>
                        {msg.actionType === 'numeric_offer' && <p className="font-black text-sm">Offer: ₹{msg.numericAmount?.toLocaleString('en-IN')}</p>}
                        {msg.actionType === 'predefined_query' && <p>{msg.predefinedMessage}</p>}
                        <p className="text-[9px] opacity-60 mt-1">{new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400">
              <Eye className="w-8 h-8 mb-2 opacity-50" />
              <p className="font-bold text-sm">Select an offer thread from the left to view transcript</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Violations Tab ────────────────────────────────────────────────────────────
const ViolationsTab = () => {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchViolations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bazaar/admin/violations');
      if (res.data.success) setViolations(res.data.data);
    } catch (e) { toast.error('Failed to load PII violations'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchViolations(); }, []);

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-800">Security Audit: PII Bypass Attempts</h3>
          <p className="text-xs text-slate-500">Log of blocked attempts by users trying to share numbers or addresses directly in chat</p>
        </div>
        <button onClick={fetchViolations} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-slate-600">User</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">Ad</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">Attempted Text</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">Detected Type</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {violations.map(v => (
              <tr key={v._id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-800">{v.userId?.name || 'Unknown User'}</p>
                  <p className="text-[10px] text-slate-400">{v.userId?.mobile}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700 truncate max-w-[150px]">{v.adId?.title || 'Bazaar Ad'}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-red-600 bg-red-50/50 max-w-[200px] truncate">
                  {v.attemptedText}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-black px-2 py-1 bg-red-100 text-red-700 rounded-full border border-red-200 uppercase">
                    {v.detectedType}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(v.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!violations.length && (
          <div className="text-center py-12 text-slate-400 font-medium">No PII bypass attempts recorded</div>
        )}
      </div>
    </div>
  );
};

// ─── Settings Input Field Component ─────────────────────────────────────────────
const SettingField = ({ label, description, value, onChange, prefix, suffix, min = 0, max = 10000, allowBulk = false }) => {
  const inputRef = useRef(null);
  const [localValue, setLocalValue] = useState(value ?? '');

  // Keep local value in sync when parent value updates asynchronously from API
  useEffect(() => {
    setLocalValue(value ?? '');
  }, [value]);

  const handleInputChange = (e) => {
    let rawVal = e.target.value;

    // Filter out non-numeric characters except single decimal point
    rawVal = rawVal.replace(/[^0-9.]/g, '');
    const parts = rawVal.split('.');
    if (parts.length > 2) {
      rawVal = `${parts[0]}.${parts.slice(1).join('')}`;
    }

    // Cap length to 6 characters (e.g. 10000 or 999.99)
    if (rawVal.length > 6) {
      rawVal = rawVal.slice(0, 6);
    }

    setLocalValue(rawVal);

    if (allowBulk) {
      const tokens = e.target.value.split(/[\s,\n\t]+/).filter(Boolean);
      if (tokens.length > 1) {
        const numValues = tokens.map(t => parseFloat(t.replace(/[^0-9.]/g, ''))).filter(n => Number.isFinite(n) && n <= max);
        if (numValues.length > 0) {
          const capped = Math.min(numValues[0], max);
          setLocalValue(capped);
          onChange(capped);
          toast.success(`Bulk input detected! Applied (${capped}). Extracted ${numValues.length} numbers.`);
          return;
        }
      }
    }

    if (rawVal === '') {
      onChange('');
    } else {
      const parsed = parseFloat(rawVal);
      if (Number.isFinite(parsed)) {
        const cappedVal = Math.min(Math.max(parsed, min), max);
        onChange(cappedVal);
      }
    }
  };

  const handleBlur = () => {
    if (localValue === '') {
      onChange(min);
      setLocalValue(min);
    } else {
      const parsed = parseFloat(localValue);
      const validNum = Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : min;
      onChange(validNum);
      setLocalValue(validNum);
    }
  };

  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 transition-colors hover:border-slate-200">
      <label className="text-sm font-black text-slate-800 block mb-0.5 cursor-pointer" onClick={() => inputRef.current?.focus()}>
        {label}
      </label>
      <p className="text-xs text-slate-500 mb-3">{description}</p>
      
      <div
        onClick={() => inputRef.current?.focus()}
        className="relative bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center font-black text-sm text-slate-900 cursor-text focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
      >
        {prefix && <span className="mr-1 text-slate-500 font-bold select-none">{prefix}</span>}
        
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder="0"
          className="w-full bg-transparent border-none outline-none font-black text-slate-900 p-0 text-sm focus:ring-0 focus:outline-none"
        />

        {suffix && (
          <span className="ml-1 text-slate-500 font-black select-none pointer-events-none shrink-0">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Settings Tab ─────────────────────────────────────────────────────────────
const SettingsTab = () => {
  const [settings, setSettings] = useState({ bazaarCommissionFee: 20, minOfferPercentage: 50, maxCounterAttempts: 3, maxChatMessages: 10 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/bazaar/admin/settings');
        if (res.data.success) setSettings(res.data.data);
      } catch (e) { toast.error('Failed to load settings'); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/bazaar/admin/settings', settings);
      toast.success('Settings saved successfully');
    } catch (e) { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const updateSettingField = (field, val) => {
    setSettings(p => ({ ...p, [field]: val }));
  };

  if (loading) return <div className="flex items-center justify-center h-24"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-xl">
      <SettingField
        label="Global Default Unlock Fee"
        description="The fee (₹) a buyer must pay to reveal a seller's contact. Can be overridden per-product during approval."
        value={settings.bazaarCommissionFee}
        onChange={val => updateSettingField('bazaarCommissionFee', val)}
        prefix="₹"
        min={0}
        max={1000}
        allowBulk={true}
      />
      <SettingField
        label="Minimum Offer Percentage"
        description="Buyers cannot offer less than this % of the listed price. Supports values above 100% (e.g. 150%, 250%)."
        value={settings.minOfferPercentage}
        onChange={val => updateSettingField('minOfferPercentage', val)}
        suffix="%"
        min={1}
        max={1000}
        allowBulk={true}
      />
      <SettingField
        label="Max Counter Attempts"
        description="Maximum times a seller can counter-offer on a single negotiation thread."
        value={settings.maxCounterAttempts}
        onChange={val => updateSettingField('maxCounterAttempts', val)}
        min={1}
        max={100}
      />
      <SettingField
        label="Max Chat Messages Per Negotiation"
        description="Maximum quick-reply chat messages allowed per offer thread (prevents endless chatter)."
        value={settings.maxChatMessages}
        onChange={val => updateSettingField('maxChatMessages', val)}
        min={1}
        max={100}
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
};

// ─── Main AdminBazaar Component ───────────────────────────────────────────────
const AdminBazaar = () => {
  const { setTitle } = useOutletContext() || {};
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (setTitle) setTitle('Bazaar Management');
  }, [setTitle]);

  const renderTab = () => {
    switch (activeTab) {
      case 'pending': return <PendingTab />;
      case 'ads': return <AllAdsTab />;
      case 'transactions': return <TransactionsTab />;
      case 'categories': return <CategoriesTab />;
      case 'templates': return <TemplatesTab />;
      case 'chat_audit': return <ChatAuditTab />;
      case 'violations': return <ViolationsTab />;
      case 'settings': return <SettingsTab />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Bazaar Management</h1>
        <p className="text-sm text-slate-500 mt-1">Approve ads, manage unlock revenue, categories, and chat templates.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {renderTab()}
      </div>
    </div>
  );
};

export default AdminBazaar;
