import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Loader2, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import TopNav from '@/modules/user/components/TopNav';
import BottomNav from '@/modules/user/components/BottomNav';
import { useToast } from '@/components/ui/use-toast';

const MyBazaarAds = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingSoldId, setMarkingSoldId] = useState(null);

  useEffect(() => {
    fetchMyAds();
  }, []);

  const fetchMyAds = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bazaar/my-ads');
      if (res.data.success) {
        setAds(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load my ads:', err);
      toast({ title: "Error", description: "Failed to load ads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'live': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending_review': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'sold': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'deal_locked': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'live': return 'Live';
      case 'pending_review': return 'Under Review';
      case 'rejected': return 'Rejected';
      case 'sold': return 'Sold';
      case 'deal_locked': return 'Deal Locked';
      default: return status;
    }
  };

  const handleMarkSold = async (adId) => {
    if (!window.confirm("Mark this item as sold? It will be removed from Bazaar browsing and can no longer receive offers.")) return;
    setMarkingSoldId(adId);
    try {
      const res = await api.patch(`/bazaar/ads/${adId}/mark-sold`);
      if (res.data.success) {
        toast({ title: "Marked as Sold", description: "This ad is no longer visible to buyers." });
        setAds(prev => prev.map(a => a._id === adId ? { ...a, status: 'sold' } : a));
      }
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to mark as sold", variant: "destructive" });
    } finally {
      setMarkingSoldId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      <TopNav />

      {/* Header */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 px-5 pt-5 pb-16">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white leading-tight">My Bazaar Ads</h1>
                <p className="text-blue-200 text-[11px] font-medium">Manage the products you've posted</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-8 relative z-10">
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-xs font-bold text-blue-100">
            Showing <span className="text-white">{ads.length}</span> ads
          </p>
          <button 
            onClick={() => navigate('/scrap/add')}
            className="text-[11px] font-black text-blue-600 bg-white px-3 py-1.5 rounded-full shadow-sm uppercase tracking-wider"
          >
            Post New Ad
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Loading your ads...</p>
          </div>
        ) : ads.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-base font-black text-slate-600 dark:text-slate-400">No ads posted yet</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-6">Start selling your items on RozSewa Bazaar</p>
            <button 
              onClick={() => navigate('/scrap/add')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg"
            >
              Post an Ad
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {ads.map((ad, i) => (
              <motion.div
                key={ad._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-slate-900 rounded-[20px] overflow-hidden border border-slate-200 dark:border-slate-800 flex gap-4 p-3 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image Section */}
                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-100 dark:bg-slate-800 relative overflow-hidden rounded-2xl shrink-0">
                  {ad.images && ad.images[0] ? (
                    <img src={ad.images[0]} alt={ad.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="flex flex-col flex-1 py-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white line-clamp-1 pr-2">{ad.title}</h3>
                    <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 border ${getStatusColor(ad.status)}`}>
                      {getStatusLabel(ad.status)}
                    </div>
                  </div>
                  <p className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400">₹{ad.price?.toLocaleString('en-IN')}</p>
                  
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <div className="text-[10px] text-slate-500 font-semibold">
                      Posted on {new Date(ad.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                    {/* Add views or other metrics if desired */}
                    <div className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      {ad.metrics?.views || 0} Views
                    </div>
                  </div>

                  {(ad.status === 'live' || ad.status === 'deal_locked') && (
                    <button
                      onClick={() => handleMarkSold(ad._id)}
                      disabled={markingSoldId === ad._id}
                      className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg py-1.5 disabled:opacity-50 transition-colors"
                    >
                      {markingSoldId === ad._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Mark as Sold
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default MyBazaarAds;
