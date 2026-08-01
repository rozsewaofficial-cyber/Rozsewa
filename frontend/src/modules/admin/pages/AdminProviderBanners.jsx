import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, XCircle, Upload, Eye, Save, Trash2 } from 'lucide-react';
import API from '@/lib/api';

const AdminProviderBanners = () => {
  const { toast } = useToast();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [uploadUrl, setUploadUrl] = useState('');

  const [bannerPlans, setBannerPlans] = useState([
    { id: 'Local', title: 'Local Promotion', desc: 'Show to users in your PIN code', price: 199 },
    { id: 'City', title: 'City Level', desc: 'Promote across your entire city', price: 499 },
    { id: 'District', title: 'District Level', desc: 'Maximum reach in your district', price: 999 },
    { id: 'State', title: 'State Level', desc: 'Dominant state-wide visibility', price: 1999 },
    { id: 'Premium Top', title: 'Premium Top', desc: 'Top featured banner on Home Page', price: 2999 }
  ]);
  const [bannerDuration, setBannerDuration] = useState(7);
  const [savingPlans, setSavingPlans] = useState(false);

  useEffect(() => {
    fetchBanners();
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data } = await API.get('/admin/settings');
      if (data.provider_banner_plans && Array.isArray(data.provider_banner_plans)) {
        setBannerPlans(data.provider_banner_plans);
      }
      if (data.provider_banner_durations && Array.isArray(data.provider_banner_durations)) {
        setBannerDuration(data.provider_banner_durations[0] || 7);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveBannerPlans = async () => {
    setSavingPlans(true);
    try {
      const durationArray = [Number(bannerDuration) || 7];
      await API.post("/admin/settings", { key: "provider_banner_plans", value: bannerPlans });
      await API.post("/admin/settings", { key: "provider_banner_durations", value: durationArray });
      toast({ title: "Updated", description: "Banner plans and duration updated successfully." });
    } catch (err) {
      toast({ title: "Update Failed", description: "Could not save banner settings.", variant: "destructive" });
    } finally {
      setSavingPlans(false);
    }
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/provider-banners');
      setBanners(res.data.banners || []);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch provider banners' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const payload = { status };
      if (status === 'Approved' && uploadUrl) {
        payload.imageUrl = uploadUrl;
      }
      
      await API.put(`/admin/provider-banners/${id}/status`, payload);
      toast({ title: 'Success', description: `Banner marked as ${status}` });
      setSelectedBanner(null);
      setUploadUrl('');
      fetchBanners();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Update failed' });
    }
  };

  const handleDeleteBanner = async (id) => {
    if (!window.confirm("Are you sure you want to delete this banner request?")) return;
    try {
      await API.delete(`/admin/provider-banners/${id}`);
      toast({ title: 'Deleted', description: 'Banner request has been deleted successfully' });
      fetchBanners();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'Could not delete the banner request' });
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-black mb-6">Provider Banner Promotions</h1>
      
      <div className="rounded-3xl border border-gray-100 bg-white p-6 md:p-8 shadow-sm mb-8">
        <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
          <h3 className="text-lg font-bold text-gray-900 border-l-4 border-emerald-500 pl-3 text-left">Banner Promotion Pricing</h3>
          <button onClick={handleSaveBannerPlans} disabled={savingPlans} className="flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-700 transition-colors border border-emerald-200 shadow-sm disabled:opacity-50">
            {savingPlans ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Pricing
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {bannerPlans.map((plan, index) => (
            <div key={plan.id}>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{plan.title} (₹/{bannerDuration || 7} Days)</label>
              <input type="number" min="0" value={plan.price} onChange={e => {
                let val = e.target.value;
                const newPlans = [...bannerPlans];
                newPlans[index].price = val === '' ? '' : Math.max(0, Number(val));
                setBannerPlans(newPlans);
              }} className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-emerald-500" />
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-100">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Banner Duration (Days)</label>
          <input 
            type="number" 
            min="1"
            value={bannerDuration} 
            onChange={e => setBannerDuration(e.target.value)} 
            placeholder="e.g. 7" 
            className="block w-full max-w-md rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-emerald-500" 
          />
          <p className="text-[10px] text-gray-500 mt-2">Enter the specific number of days for the banner promotion.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-4">Provider</th>
              <th className="p-4">Plan & Location</th>
              <th className="p-4">Duration</th>
              <th className="p-4">Dates</th>
              <th className="p-4">Design Source</th>
              <th className="p-4">Status</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {banners.map(banner => (
              <tr key={banner._id} className="hover:bg-slate-50">
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-bold text-sm text-slate-800">{banner.provider?.shopName || 'Unknown Shop'}</p>
                    <p className="text-xs font-semibold text-slate-600">{banner.provider?.ownerName}</p>
                    <p className="text-[10px] text-slate-500 font-medium">📞 +91 {banner.provider?.mobile}</p>
                    <p className="text-[10px] text-slate-400 font-medium">🆔 {banner.provider?.vendorCode}</p>
                  </div>
                </td>
                <td className="p-4">
                  <p className="font-bold text-blue-600">{banner.planType}</p>
                  <p className="text-xs text-slate-500">{banner.locationValue}</p>
                </td>
                <td className="p-4 font-medium">{banner.durationDays} Days</td>
                <td className="p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Requested On</p>
                  <p className="text-xs font-medium text-slate-700">{new Date(banner.createdAt).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</p>
                  
                  {banner.startDate && (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Active Period</p>
                      <p className="text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-1 inline-block">
                        {new Date(banner.startDate).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})} - {new Date(banner.endDate).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})}
                      </p>
                    </div>
                  )}
                </td>
                <td className="p-4 text-xs font-medium">{banner.bannerSource}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest 
                    ${banner.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                      banner.status === 'Pending Approval' || banner.status === 'Banner Design Required' ? 'bg-amber-100 text-amber-700' : 
                      'bg-slate-100 text-slate-600'}`}>
                    {banner.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedBanner(banner)} className="text-blue-600 bg-blue-50 p-2 rounded-lg hover:bg-blue-100 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteBanner(banner._id)} className="text-rose-600 bg-rose-50 p-2 rounded-lg hover:bg-rose-100 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedBanner && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-xl font-black mb-4">Banner Request Details</h2>
            
            <div className="space-y-4 text-sm mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-slate-500 block text-xs">Plan</span><span className="font-bold">{selectedBanner.planType}</span></div>
                <div><span className="text-slate-500 block text-xs">Target Location</span><span className="font-bold">{selectedBanner.locationValue}</span></div>
                <div><span className="text-slate-500 block text-xs">Paid Amount</span><span className="font-bold text-emerald-600">₹{selectedBanner.pricePaid}</span></div>
                <div><span className="text-slate-500 block text-xs">Status</span><span className="font-bold">{selectedBanner.status}</span></div>
              </div>

              {selectedBanner.bannerSource === 'Create Banner by RozSewa' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-widest">Provider's Design Description</p>
                  <p className="text-amber-900 italic">"{selectedBanner.designDescription}"</p>
                  
                  {selectedBanner.status !== 'Active' && selectedBanner.status !== 'Expired' && (
                    <div className="mt-4 pt-4 border-t border-amber-200">
                      <label className="text-xs font-bold text-slate-700 block mb-2">Upload Completed Design URL</label>
                      <input type="text" value={uploadUrl} onChange={e => setUploadUrl(e.target.value)} placeholder="https://..." className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center justify-center min-h-[8rem]">
                  {selectedBanner.imageUrl ? (
                    <img src={selectedBanner.imageUrl} alt="Banner" className="w-full h-32 object-cover rounded-lg bg-slate-100" />
                  ) : (
                    <span className="text-slate-400 font-medium text-sm">No Image Uploaded</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setSelectedBanner(null)} className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100">Close</button>
              
              {selectedBanner.status === 'Pending Approval' || selectedBanner.status === 'Banner Design Required' ? (
                <>
                  <button onClick={() => handleUpdateStatus(selectedBanner._id, 'Rejected')} className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button onClick={() => handleUpdateStatus(selectedBanner._id, 'Approved')} className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Approve & Activate
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProviderBanners;
