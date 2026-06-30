import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Clock, CheckCircle, Bell, ArrowLeft, Trash2, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '../../components/BottomNav'; // Assuming BottomNav exists here or similar

const themeColors = {
  brand: { teal: '#347989', yellow: '#D68F35', orange: '#BB5F36' },
  primary: '#347989',
  button: '#347989'
};

const NotificationBell = () => (
    <button className="relative p-2 text-gray-600">
        <Bell className="w-6 h-6" />
    </button>
);
const UserScrapPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [scraps, setScraps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScrap, setSelectedScrap] = useState(null);

  useEffect(() => {
    fetchMyScrap();
  }, []);

  const fetchMyScrap = async () => {
    try {
      setLoading(true);
      const res = await api.get('/scrap/my');
      if (res.data.success) {
        setScraps(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to load scrap items', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };



  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevent opening modal
    if (!window.confirm('Are you sure you want to delete this listing?')) return;

    try {
      const res = await api.delete(`/scrap/${id}`);
      if (res.data.success) {
        toast({ title: 'Listing deleted successfully' });
        setSelectedScrap(null);
        fetchMyScrap();
      }
    } catch (err) {
      console.error(err);
      toast({ title: err.response?.data?.message || 'Failed to delete listing', variant: 'destructive' });
    }
  };


  const activeScraps = scraps.filter(s => s.status === 'pending' || s.status === 'accepted');
  const historyScraps = scraps.filter(s => s.status === 'completed' || s.status === 'cancelled');

  // Inside return:
  return (
    <div className="min-h-screen pb-20 relative bg-white">
      {/* Refined Brand Mesh Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(at 0% 0%, ${themeColors?.brand?.teal || '#347989'}25 0%, transparent 70%),
              radial-gradient(at 100% 0%, ${themeColors?.brand?.yellow || '#D68F35'}20 0%, transparent 70%),
              radial-gradient(at 100% 100%, ${themeColors?.brand?.orange || '#BB5F36'}15 0%, transparent 75%),
              radial-gradient(at 0% 100%, ${themeColors?.brand?.teal || '#347989'}10 0%, transparent 70%),
              radial-gradient(at 50% 50%, ${themeColors?.brand?.teal || '#347989'}03 0%, transparent 100%),
              #FFFFFF
            `
          }}
        />
        {/* Elegant Dot Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(${themeColors?.brand?.teal || '#347989'} 0.8px, transparent 0.8px)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Modern Glassmorphism Header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/40 border-b border-black/[0.03] px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-black/[0.02]"
            >
              <ArrowLeft className="w-5 h-5 text-gray-800" />
            </button>
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5" style={{ color: themeColors.button }} />
              <h1 className="text-xl font-extrabold text-gray-900">Sell Scrap</h1>
            </div>
          </div>
          <NotificationBell />
        </header>

        {/* Tabs */}
        <div className="flex bg-white border-b border-gray-200 mt-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'active'
              ? `border-[${themeColors.primary}] text-[${themeColors.primary}]`
              : 'border-transparent text-gray-500'
              }`}
            style={{ borderColor: activeTab === 'active' ? themeColors.button : 'transparent', color: activeTab === 'active' ? themeColors.button : undefined }}
          >
            Active Listings
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 ${activeTab === 'history'
              ? `border-[${themeColors.primary}] text-[${themeColors.primary}]`
              : 'border-transparent text-gray-500'
              }`}
            style={{ borderColor: activeTab === 'history' ? themeColors.button : 'transparent', color: activeTab === 'history' ? themeColors.button : undefined }}
          >
            History
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 animate-pulse">
                  <div className="flex justify-between items-start mb-3">
                    <div className="space-y-2">
                      <div className="h-4 w-20 bg-gray-200 rounded"></div>
                      <div className="h-5 w-40 bg-gray-200 rounded"></div>
                      <div className="h-3 w-32 bg-gray-200 rounded"></div>
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded"></div>
                  </div>
                  <div className="pt-3 border-t border-gray-50 flex justify-between">
                    <div className="h-4 w-24 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (activeTab === 'active' ? activeScraps : historyScraps).length === 0 ? (
            <div className="text-center py-20">
              <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No items found</p>
              <p className="text-sm text-gray-400 mt-1">Add items to start selling</p>
            </div>
          ) : (
            (activeTab === 'active' ? activeScraps : historyScraps).map(item => (
              <div
                key={item._id}
                className="bg-white rounded-[24px] shadow-sm p-4 border border-gray-100 active:scale-[0.98] transition-all cursor-pointer overflow-hidden relative"
                onClick={() => setSelectedScrap(item)}
              >
                <div className="flex gap-4">
                  {item.images && item.images.length > 0 && (
                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-gray-50 bg-gray-50/50">
                      <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-extrabold text-gray-900 leading-tight line-clamp-1">{item.title}</h3>
                        <p className="text-xs font-medium text-gray-500 mt-1 line-clamp-1">{item.description}</p>
                      </div>
                      <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border
                        ${item.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : ''}
                        ${item.status === 'accepted' ? 'bg-green-50 text-green-600 border-green-100' : ''}
                        ${item.status === 'completed' ? 'bg-gray-100 text-gray-600 border-gray-200' : ''}
                        ${item.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' : ''}
                      `}>
                        {item.status}
                      </div>
                      {(item.status === 'pending' || item.status === 'cancelled') && (
                        <button
                          onClick={(e) => handleDelete(e, item._id)}
                          className="p-2 ml-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          title="Delete Listing"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-[11px] font-bold text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Listed on {new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  {item.status === 'accepted' && (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Pickup Confirmed</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => navigate('/scrap/add')}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform active:scale-95"
          style={{ backgroundColor: themeColors.button }}
        >
          <Plus className="w-7 h-7" />
        </button>

        {/* Add Modal */}


        {/* User Scrap Details Modal */}
        <AnimatePresence>
          {selectedScrap && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedScrap(null)}
                className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-md"
              />
              <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
                className="fixed bottom-20 left-4 right-4 bg-white rounded-[32px] z-[70] max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-100 flex flex-col"
                onClick={e => e.stopPropagation()}
                style={{
                  boxShadow: '0 -25px 50px -12px rgba(0,0,0,0.5)'
                }}
              >
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
                  <div className="flex flex-col">
                    <h2 className="text-xl font-black text-gray-900 leading-tight">{selectedScrap.title}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedScrap(null)}
                    className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-90 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Images */}
                  {selectedScrap.images && selectedScrap.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedScrap.images.map((img, i) => (
                        <div key={i} className={`rounded-3xl overflow-hidden border border-gray-100 ${i === 0 && selectedScrap.images.length % 2 !== 0 ? 'col-span-2 aspect-video' : 'aspect-square'}`}>
                          <img src={img} alt="Scrap" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}



                  {/* Status Badge */}
                  <div className={`p-4 rounded-3xl border text-center font-black uppercase tracking-widest text-xs
                    ${selectedScrap.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : ''}
                    ${selectedScrap.status === 'accepted' ? 'bg-green-50 text-green-600 border-green-100' : ''}
                    ${selectedScrap.status === 'completed' ? 'bg-gray-50 text-gray-500 border-gray-200' : ''}
                  `}>
                    Status: {selectedScrap.status}
                  </div>

                  {/* Description */}
                  {selectedScrap.description && (
                    <div className="bg-blue-50/30 p-5 rounded-3xl border border-blue-100/30 italic">
                      <p className="text-gray-600 font-medium leading-relaxed">"{selectedScrap.description}"</p>
                    </div>
                  )}

                  {/* Location */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                      <MapPin className="text-red-500" /> Pickup Address
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                      <p className="font-bold text-gray-800">{selectedScrap.address?.addressLine1}</p>
                      <p className="text-xs text-gray-400 mt-1 uppercase font-bold">{selectedScrap.address?.city}, {selectedScrap.address?.state}</p>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-[10px] font-black uppercase text-gray-400 tracking-wider">
                     <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Posted {new Date(selectedScrap.createdAt).toLocaleDateString()}</span>
                    {selectedScrap.status === 'accepted' && <span className="text-green-600">Vendor Assigned</span>}
                  </div>
                </div>

                <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex gap-3">
                  <button
                    onClick={() => setSelectedScrap(null)}
                    className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                  >
                    Back to Listings
                  </button>
                  {(selectedScrap.status === 'pending' || selectedScrap.status === 'cancelled') && (
                    <button
                      onClick={(e) => handleDelete(e, selectedScrap._id)}
                      className="px-6 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Trash2 />
                      Delete
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Hide bottom nav when modal is open to prevent z-index issues / clutter */}
      </div>


    </div >
  );
};

export default UserScrapPage;
