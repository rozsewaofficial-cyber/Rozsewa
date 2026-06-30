import { useState, useEffect } from 'react';
import { Trash2, ShoppingBag, CheckCircle, XCircle, Plus, Tag, Image as ImageIcon, Loader2, X } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const AdminBazaarPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'live', or 'categories'
  
  const [ads, setAds] = useState([]);
  const [liveAds, setLiveAds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatOrder, setNewCatOrder] = useState(0);
  const [newCatIcon, setNewCatIcon] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingAds();
    } else if (activeTab === 'live') {
      fetchLiveAdsAdmin();
    } else {
      fetchCategories();
    }
  }, [activeTab]);

  const fetchPendingAds = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bazaar/admin/pending');
      if (res.data.success) {
        setAds(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to fetch pending ads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveAdsAdmin = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bazaar/admin/ads');
      if (res.data.success) {
        setLiveAds(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to fetch all ads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bazaar/categories');
      if (res.data.success) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to fetch categories', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, action) => {
    const isApprove = action === 'approve';
    const msg = isApprove ? 'Approve this ad and make it live on Bazaar?' : 'Reject this ad?';
    if (!window.confirm(msg)) return;
    
    let rejectionReason = '';
    if (!isApprove) {
      rejectionReason = window.prompt("Enter reason for rejection:");
      if (!rejectionReason) return; // Cancelled
    }

    try {
      const res = await api.put(`/bazaar/admin/review/${id}`, { action, rejectionReason });
      if (res.data.success) {
        toast({ title: isApprove ? 'Ad Approved!' : 'Ad Rejected' });
        fetchPendingAds();
      }
    } catch (err) {
      toast({ title: err.response?.data?.message || 'Failed to review ad', variant: 'destructive' });
    }
  };

  const handleDeleteAd = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this ad?')) return;
    try {
      const res = await api.delete(`/bazaar/admin/ads/${id}`);
      if (res.data.success) {
        toast({ title: 'Ad deleted successfully' });
        fetchLiveAdsAdmin();
      }
    } catch (err) {
      toast({ title: err.response?.data?.message || 'Failed to delete ad', variant: 'destructive' });
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName) return;

    try {
      setIsUploading(true);
      let iconUrl = '';

      if (newCatIcon) {
        const uploadData = new FormData();
        uploadData.append('image', newCatIcon);
        const uploadRes = await api.post('/upload', uploadData);
        if (uploadRes.data.url) {
          iconUrl = uploadRes.data.url;
        }
      }

      const res = await api.post('/bazaar/categories', { name: newCatName, order: newCatOrder, icon: iconUrl });
      if (res.data.success) {
        toast({ title: 'Category added' });
        setNewCatName('');
        setNewCatOrder(0);
        setNewCatIcon(null);
        fetchCategories();
      }
    } catch (err) {
      toast({ title: err.response?.data?.message || 'Failed to add category', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      const res = await api.delete(`/bazaar/categories/${id}`);
      if (res.data.success) {
        toast({ title: 'Category deleted' });
        fetchCategories();
      }
    } catch (err) {
      toast({ title: err.response?.data?.message || 'Failed to delete category', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'pending' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Pending Ads Review
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'live' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Manage All Ads
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'categories' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Manage Categories
        </button>
      </div>

      {activeTab === 'pending' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
             <h2 className="text-sm font-black text-gray-800">Pending Bazaar Ads Review Queue</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Item Details</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Seller Info</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Price & Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Masked Location</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-xs text-gray-500 font-medium">Loading items...</td></tr>
                ) : ads.length === 0 ? (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-xs text-gray-500 font-medium">No ads pending review.</td></tr>
                ) : (
                  ads.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {item.images && item.images[0] ? (
                            <img src={item.images[0]} alt="" className="w-12 h-12 rounded object-cover border border-gray-100 shrink-0" />
                          ) : (
                             <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center shrink-0">No Img</div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-gray-900">{item.title}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                            <div className="flex items-center gap-1 mt-1">
                               <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">{item.category}</span>
                               <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{item.condition}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-gray-900">{item.sellerId?.name}</p>
                        <p className="text-[10px] text-gray-500">{item.contactDetails?.phone || item.sellerId?.mobile}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-teal-600">₹{item.price}</p>
                        <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider bg-yellow-100 text-yellow-700 mt-1`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-gray-800">{item.location?.areaName}, {item.location?.city}</p>
                        <p className="text-[10px] text-red-500 font-medium line-clamp-1" title="Hidden from public">
                           Hidden: {item.location?.exactAddress}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(item._id, 'approve')}
                            className="px-2 py-1.5 bg-green-600 text-white text-[10px] font-bold rounded uppercase tracking-wider hover:bg-green-700 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => handleReview(item._id, 'reject')}
                            className="px-2 py-1.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase tracking-wider hover:bg-red-700 transition-colors flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
             <h2 className="text-sm font-black text-gray-800">All Live/Processed Ads</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Item Details</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Seller Info</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Price & Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Metrics</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-xs text-gray-500 font-medium">Loading items...</td></tr>
                ) : liveAds.length === 0 ? (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-xs text-gray-500 font-medium">No ads found.</td></tr>
                ) : (
                  liveAds.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {item.images && item.images[0] ? (
                            <img src={item.images[0]} alt="" className="w-12 h-12 rounded object-cover border border-gray-100 shrink-0" />
                          ) : (
                             <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center shrink-0">No Img</div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-gray-900">{item.title}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{item.location?.city}, {item.location?.state}</p>
                            <div className="flex items-center gap-1 mt-1">
                               <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">{item.category}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-gray-900">{item.sellerId?.name}</p>
                        <p className="text-[10px] text-gray-500">{item.contactDetails?.phone || item.sellerId?.mobile}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-teal-600">₹{item.price}</p>
                        <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider mt-1 ${item.status === 'live' ? 'bg-green-100 text-green-700' : item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[10px] text-gray-600">
                           <p>Views: <span className="font-bold">{item.metrics?.views || 0}</span></p>
                           <p>Offers: <span className="font-bold">{item.metrics?.offersCount || 0}</span></p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteAd(item._id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                          title="Delete Ad"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Add Category Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-fit">
            <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-blue-600" /> Add New Category
            </h2>
            <form onSubmit={handleAddCategory} className="space-y-4">
              {/* Image Upload UI */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Category Icon (Optional)</label>
                <div className="flex items-center gap-3">
                  {newCatIcon ? (
                    <div className="relative w-16 h-16 rounded-xl border border-gray-200 overflow-hidden">
                      <img src={URL.createObjectURL(newCatIcon)} alt="Preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setNewCatIcon(null)} className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center">
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <div onClick={() => document.getElementById('cat-icon-upload')?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-gray-50 transition-colors">
                      <ImageIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-[8px] font-bold text-gray-500 uppercase">Upload</span>
                    </div>
                  )}
                  <input id="cat-icon-upload" type="file" className="hidden" accept="image/*" onChange={(e) => { if(e.target.files[0]) setNewCatIcon(e.target.files[0]) }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Mobile Phones"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Display Order</label>
                <input
                  type="number"
                  min="0"
                  value={newCatOrder}
                  onChange={e => setNewCatOrder(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-2.5 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Category'}
              </button>
            </form>
          </div>

          {/* Category List */}
          <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
               <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
                 <Tag className="w-4 h-4 text-blue-600" /> Existing Categories
               </h2>
             </div>
             <div className="p-4">
               {loading ? (
                 <p className="text-sm text-gray-500">Loading categories...</p>
               ) : categories.length === 0 ? (
                 <p className="text-sm text-gray-500">No categories found. Add one to get started.</p>
               ) : (
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                   {categories.map(cat => (
                     <div key={cat._id} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                       {cat.icon && cat.icon.startsWith('http') ? (
                         <img src={cat.icon} alt={cat.name} className="w-10 h-10 rounded-lg object-cover bg-white shadow-sm shrink-0" />
                       ) : (
                         <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                            <Tag className="w-4 h-4 text-gray-400" />
                         </div>
                       )}
                       <div className="flex-1 min-w-0">
                         <p className="text-sm font-bold text-gray-800 truncate">{cat.name}</p>
                         <p className="text-[10px] text-gray-500 font-medium">Order: {cat.order}</p>
                       </div>
                       <button
                         onClick={() => handleDeleteCategory(cat._id)}
                         className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBazaarPage;
