import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Phone, MessageCircle, X, ArrowLeft, ShoppingBag, Package, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import BottomNav from '@/modules/user/components/BottomNav';
import TopNav from '@/modules/user/components/TopNav';

const RojsewaBazaar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showContact, setShowContact] = useState(false);

  useEffect(() => {
    fetchBazaarItems();
  }, []);

  const fetchBazaarItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bazaar/live');
      if (res.data.success) {
        setItems(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load bazaar items:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
    const matchCity =
      !cityFilter ||
      (item.address?.city && item.address.city.toLowerCase().includes(cityFilter.toLowerCase()));
    return matchSearch && matchCity;
  });

  const uniqueCities = [...new Set(items.map(i => i.address?.city).filter(Boolean))];

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
              onClick={() => navigate(-1)}
              className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white leading-tight">Rojsewa Bazaar</h1>
                <p className="text-blue-200 text-[11px] font-medium">Verified second-hand items near you</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl text-sm font-medium text-gray-800 placeholder-gray-400 outline-none shadow-lg focus:ring-2 focus:ring-blue-300"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-8 relative z-10">
        {/* Stats card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-100 dark:border-slate-800 p-4 mb-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{items.length}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Items available</p>
          </div>
          {/* City filter chips */}
          <div className="flex gap-2 ml-auto overflow-x-auto">
            <button
              onClick={() => setCityFilter('')}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${!cityFilter ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
            >
              All
            </button>
            {uniqueCities.slice(0, 4).map(city => (
              <button
                key={city}
                onClick={() => setCityFilter(city === cityFilter ? '' : city)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${cityFilter === city ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Loading Bazaar...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-base font-black text-slate-600 dark:text-slate-400">No items found</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Try a different search or city</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item, i) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedItem(item)}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden cursor-pointer active:scale-[0.97] transition-all hover:shadow-md"
              >
                {/* Image */}
                <div className="aspect-square bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                  {item.images && item.images[0] ? (
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                  {/* Verified badge */}
                  <div className="absolute top-2 left-2 bg-blue-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Verified
                  </div>
                </div>

                {/* Details */}
                <div className="p-3">
                  <h3 className="font-black text-slate-900 dark:text-white text-sm leading-tight line-clamp-1">{item.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-black text-blue-600 dark:text-blue-400">₹{item.price}</p>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{item.condition}</span>
                  </div>
                  {item.location?.city && (
                    <div className="flex items-center gap-1 mt-2">
                      <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{item.location.areaName}, {item.location.city}</span>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-800 flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-blue-600 dark:text-blue-400">
                        {item.userId?.name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">{item.userId?.name || 'Seller'}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Item Detail Bottom Sheet */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedItem(null); setShowContact(false); }}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 z-[70] rounded-t-[32px] max-h-[92vh] overflow-y-auto shadow-[0_-10px_40px_rgba(0,0,0,0.1)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="sticky top-0 bg-white dark:bg-slate-950 pt-4 pb-2 z-20 rounded-t-[32px]">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-3" />
                <div className="px-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-1">{selectedItem.title}</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                        ✓ Verified
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {selectedItem.condition}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedItem(null); setShowContact(false); }}
                    className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="px-5 pb-6 space-y-4 mt-2">
                {/* Images Gallery */}
                {selectedItem.images && selectedItem.images.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x">
                    {selectedItem.images.map((img, i) => (
                      <div key={i} className="snap-center rounded-2xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800 w-[85%] aspect-[4/3] bg-slate-50 dark:bg-slate-900 shadow-sm relative">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                          {i + 1} / {selectedItem.images.length}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Description */}
                {selectedItem.description && (
                  <div className="bg-slate-50/80 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{selectedItem.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Location */}
                  {selectedItem.location?.areaName && (
                    <div className="flex flex-col justify-center p-3.5 bg-red-50/50 dark:bg-red-900/10 rounded-2xl border border-red-100/50 dark:border-red-900/20">
                      <div className="w-7 h-7 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mb-2">
                        <MapPin className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Location</p>
                      <p className="text-xs font-black text-slate-800 dark:text-white line-clamp-1">{selectedItem.location.areaName}</p>
                      {selectedItem.location.city && (
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">{selectedItem.location.city}</p>
                      )}
                    </div>
                  )}

                  {/* Seller Info */}
                  <div className="flex flex-col justify-center p-3.5 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-900/20">
                    <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-2">
                      <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                        {selectedItem.sellerId?.name?.charAt(0) || 'S'}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Seller</p>
                    <p className="text-xs font-black text-slate-800 dark:text-white line-clamp-1">{selectedItem.sellerId?.name || 'RozSewa User'}</p>
                    <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 line-clamp-1">
                      {selectedItem.sellerId?.sellerProfile?.isVerifiedSeller ? 'Verified Account' : 'Standard Account'}
                    </p>
                  </div>
                </div>

                {/* Offer Section */}
                <div className="bg-gradient-to-b from-slate-900 to-slate-800 dark:from-slate-100 dark:to-slate-200 p-5 rounded-[24px] text-center shadow-xl border border-slate-800 dark:border-white relative overflow-hidden mt-2">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 dark:bg-black/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                  
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Asking Price</p>
                  <p className="text-3xl font-black text-white dark:text-slate-900 mb-5 tracking-tight">₹{selectedItem.price}</p>
                  
                  {(() => {
                    const currentUserId = user?._id || user?.id || user?.user?._id || user?.user?.id;
                    const sellerIdStr = selectedItem.sellerId?._id?.toString() || selectedItem.sellerId?.toString();
                    const isOwner = !!(currentUserId && sellerIdStr && currentUserId.toString() === sellerIdStr);

                    return isOwner ? (
                      <button
                        disabled
                        className="w-full py-3.5 bg-slate-600/50 text-white font-black rounded-xl cursor-not-allowed opacity-70 flex items-center justify-center gap-2"
                      >
                        You are the seller
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          navigate(`/bazaar/${selectedItem._id}/offer`);
                        }}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl active:scale-[0.98] transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-5 h-5 fill-white/20" />
                        Make an Offer
                      </button>
                    );
                  })()}
                  
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-4 leading-tight font-medium max-w-[200px] mx-auto">
                    Contact details are strictly hidden. They will only be revealed after offer is accepted and lead fee is paid.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
};

export default RojsewaBazaar;
