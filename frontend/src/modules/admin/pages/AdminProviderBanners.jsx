import React, { useState, useEffect } from 'react';
import TablePager from '@/modules/admin/components/TablePager';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, XCircle, Upload, Eye, Save, Trash2 } from 'lucide-react';
import API from '@/lib/api';

const isAwaitingReview = (b) => !!b && (b.status === 'Pending Approval' || b.status === 'Banner Design Required');

const AdminProviderBanners = () => {
  const { toast } = useToast();
  const [banners, setBanners] = useState([]);
  // The table shows one page of requests; the pager is told how many there
  // are rather than counting the rows it can see.
  const [bannersTotal, setBannersTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [loading, setLoading] = useState(true);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [uploadUrl, setUploadUrl] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const [acting, setActing] = useState(false);

  const [bannerPlans, setBannerPlans] = useState([
    { id: 'Local', title: 'Local Promotion', desc: 'Show to users in your PIN code', price: 199 },
    { id: 'City', title: 'City Level', desc: 'Promote across your entire city', price: 499 },
    { id: 'District', title: 'District Level', desc: 'Maximum reach in your district', price: 999 },
    { id: 'State', title: 'State Level', desc: 'Dominant state-wide visibility', price: 1999 },
    { id: 'Premium Top', title: 'Premium Top', desc: 'Shown first in the partner banners on the Home Page, in every city', price: 2999 }
  ]);
  // Offered durations, e.g. "7, 15, 30". Plan prices are for the first one;
  // the server prices longer ones in proportion.
  const [bannerDurations, setBannerDurations] = useState('7');
  const [savingPlans, setSavingPlans] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  // Turning a page is a request.
  useEffect(() => {
    fetchBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Opening or closing a request always starts from a clean form, so a
  // design link typed for one request can never be applied to another.
  const openBanner = (banner) => {
    setUploadUrl('');
    setRejectReason('');
    setSelectedBanner(banner);
  };
  const closeBanner = () => {
    setUploadUrl('');
    setRejectReason('');
    setSelectedBanner(null);
  };

  const fetchPlans = async () => {
    try {
      const { data } = await API.get('/admin/settings');
      if (data.provider_banner_plans && Array.isArray(data.provider_banner_plans)) {
        setBannerPlans(data.provider_banner_plans);
      }
      if (data.provider_banner_durations && Array.isArray(data.provider_banner_durations)) {
        setBannerDurations(data.provider_banner_durations.join(', ') || '7');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveBannerPlans = async () => {
    const durationArray = [...new Set(
      String(bannerDurations).split(',').map(d => Math.round(Number(d.trim()))).filter(d => d > 0 && d <= 365)
    )];
    if (durationArray.length === 0) {
      toast({ title: "Invalid durations", description: "Enter at least one duration in days, e.g. 7, 15, 30.", variant: "destructive" });
      return;
    }
    if (bannerPlans.some(p => !(Number(p.price) > 0))) {
      toast({ title: "Invalid price", description: "Every plan needs a price above ₹0.", variant: "destructive" });
      return;
    }
    setSavingPlans(true);
    try {
      await API.post("/admin/settings", { key: "provider_banner_plans", value: bannerPlans });
      await API.post("/admin/settings", { key: "provider_banner_durations", value: durationArray });
      setBannerDurations(durationArray.join(', '));
      toast({ title: "Updated", description: "Banner plans and durations updated successfully." });
    } catch (err) {
      toast({ title: "Update Failed", description: "Could not save banner settings.", variant: "destructive" });
    } finally {
      setSavingPlans(false);
    }
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/provider-banners', { params: { page: currentPage, limit: itemsPerPage } });
      setBanners(res.data.banners || []);
      setBannersTotal(res.data.total ?? (res.data.banners || []).length);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch provider banners' });
    } finally {
      setLoading(false);
    }
  };

  const handleDesignUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    setUploadingDesign(true);
    try {
      const res = await API.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadUrl(res.data.url);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Could not upload the design image.' });
    } finally {
      setUploadingDesign(false);
    }
  };

  // approve: goes live now (needs an image) | reject: refunds the partner | stop: ends a running banner
  const handleAction = async (banner, action) => {
    if (action === 'reject' && !window.confirm(`Reject this request? Its verified payment (₹${banner.pricePaid}) is refunded to the partner's wallet.`)) return;
    if (action === 'stop' && !window.confirm('Stop this running banner now? It is not refunded.')) return;
    setActing(true);
    try {
      const payload = { action };
      if (action === 'approve' && uploadUrl) payload.imageUrl = uploadUrl;
      if (action === 'reject') payload.reason = rejectReason;
      const { data } = await API.put(`/admin/provider-banners/${banner._id}/status`, payload);
      const refund = data?.banner?.refund;
      const done = {
        approve: 'approved and live.',
        reject: refund?.status === 'refunded'
          ? `rejected — ₹${refund.amount} refunded to the partner's wallet.`
          : refund?.status === 'manual'
            ? 'rejected. Its payment could not be verified automatically (older request) — check Razorpay and refund manually.'
            : 'rejected.',
        stop: 'stopped.'
      }[action];
      toast({ title: 'Success', description: `Banner ${done}` });
      closeBanner();
      fetchBanners();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.response?.data?.message || 'Please try again.' });
    } finally {
      setActing(false);
    }
  };

  const handleDeleteBanner = async (id) => {
    if (!window.confirm("Are you sure you want to delete this banner request?")) return;
    try {
      await API.delete(`/admin/provider-banners/${id}`);
      toast({ title: 'Deleted', description: 'Banner request has been deleted successfully' });
      fetchBanners();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.response?.data?.message || 'Could not delete the banner request' });
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
  }

  const baseDuration = String(bannerDurations).split(',')[0].trim() || 7;
  const previewImage = selectedBanner ? (uploadUrl || selectedBanner.imageUrl) : '';

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
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{plan.title} (₹ per {baseDuration} days, before GST)</label>
              <input type="number" min="1" value={plan.price} onChange={e => {
                let val = e.target.value;
                const newPlans = [...bannerPlans];
                newPlans[index] = { ...newPlans[index], price: val === '' ? '' : Math.max(0, Number(val)) };
                setBannerPlans(newPlans);
              }} className="block w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-emerald-500" />
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Offered Durations (Days)</label>
          <input
            type="text"
            value={bannerDurations}
            onChange={e => setBannerDurations(e.target.value)}
            placeholder="e.g. 7, 15, 30"
            className="block w-full max-w-md rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 text-sm font-bold focus:border-emerald-500"
          />
          <p className="text-[10px] text-gray-500 mt-2">Comma-separated. Plan prices above are for the first duration; longer ones are charged in proportion (e.g. 30 days = price × 30 ÷ {baseDuration}). 18% GST is added on top.</p>
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
                      isAwaitingReview(banner) ? 'bg-amber-100 text-amber-700' :
                      banner.status === 'Rejected' || banner.status === 'Stopped' ? 'bg-rose-100 text-rose-700' :
                      'bg-slate-100 text-slate-600'}`}>
                    {banner.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button onClick={() => openBanner(banner)} className="text-blue-600 bg-blue-50 p-2 rounded-lg hover:bg-blue-100 transition-colors">
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
        <TablePager
          page={currentPage}
          total={bannersTotal}
          perPage={itemsPerPage}
          onPage={setCurrentPage}
          noun="banner requests"
        />
      </div>

      {selectedBanner && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black mb-4">Banner Request Details</h2>

            <div className="space-y-4 text-sm mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-slate-500 block text-xs">Plan</span><span className="font-bold">{selectedBanner.planType}</span></div>
                <div><span className="text-slate-500 block text-xs">Target Location</span><span className="font-bold">{selectedBanner.locationValue}</span></div>
                <div>
                  <span className="text-slate-500 block text-xs">Paid Amount</span>
                  <span className="font-bold text-emerald-600">₹{selectedBanner.pricePaid}</span>
                  {selectedBanner.gstAmount ? (
                    <span className="block text-[10px] text-slate-500">₹{selectedBanner.basePrice} + ₹{selectedBanner.gstAmount} GST · {selectedBanner.paidVia || 'payment'}</span>
                  ) : null}
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Status</span>
                  <span className="font-bold">{selectedBanner.status}</span>
                  {selectedBanner.refund?.status === 'refunded' && (
                    <span className="block text-[10px] text-emerald-700 font-bold">Refunded ₹{selectedBanner.refund.amount} to wallet</span>
                  )}
                  {selectedBanner.refund?.status === 'manual' && (
                    <span className="block text-[10px] text-amber-700 font-bold">Refund needs manual check (older, unverified payment)</span>
                  )}
                  {selectedBanner.rejectionReason && (
                    <span className="block text-[10px] text-rose-600">Reason: {selectedBanner.rejectionReason}</span>
                  )}
                </div>
              </div>

              {selectedBanner.bannerSource === 'Create Banner by RozSewa' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-widest">Provider's Design Description</p>
                  <p className="text-amber-900 italic">"{selectedBanner.designDescription}"</p>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center justify-center min-h-[8rem]">
                {previewImage ? (
                  <img src={previewImage} alt="Banner" className="w-full h-32 object-cover rounded-lg bg-slate-100" />
                ) : (
                  <span className="text-slate-400 font-medium text-sm text-center">No banner image yet — add the design below to approve.</span>
                )}
              </div>

              {isAwaitingReview(selectedBanner) && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">{selectedBanner.imageUrl ? 'Replace design (optional)' : 'Add the completed design'}</label>
                  <div className="flex gap-2 items-center">
                    <label className="shrink-0 cursor-pointer rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-bold flex items-center gap-1.5">
                      {uploadingDesign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload image
                      <input type="file" accept="image/*" className="hidden" onChange={handleDesignUpload} disabled={uploadingDesign} />
                    </label>
                    <input type="text" value={uploadUrl} onChange={e => setUploadUrl(e.target.value)} placeholder="or paste https://... link" className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
                  </div>
                  <textarea rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason, if rejecting (shown to the partner)" className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 flex-wrap">
              <button onClick={closeBanner} className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100">Close</button>

              {isAwaitingReview(selectedBanner) ? (
                <>
                  <button disabled={acting} onClick={() => handleAction(selectedBanner, 'reject')} className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 flex items-center gap-2 disabled:opacity-50">
                    <XCircle className="w-4 h-4" /> Reject & Refund
                  </button>
                  <button
                    disabled={acting || !previewImage}
                    title={!previewImage ? 'Add the banner design first' : undefined}
                    onClick={() => handleAction(selectedBanner, 'approve')}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <CheckCircle2 className="w-4 h-4" /> Approve & Activate
                  </button>
                </>
              ) : selectedBanner.status === 'Active' ? (
                <button disabled={acting} onClick={() => handleAction(selectedBanner, 'stop')} className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 flex items-center gap-2 disabled:opacity-50">
                  <XCircle className="w-4 h-4" /> Stop Banner
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProviderBanners;
