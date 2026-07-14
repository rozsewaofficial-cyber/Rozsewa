import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Phone, MessageCircle, X, ArrowLeft, ShoppingBag, Package, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import BottomNav from '@/modules/user/components/BottomNav';
import TopNav from '@/modules/user/components/TopNav';
import { useScrollLock } from '@/lib/scrollLock';

const RojsewaBazaar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [radiusFilter, setRadiusFilter] = useState(0); // 0 means 'All'
  const [selectedItem, setSelectedItem] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const { userLocation, detectLocation } = useAuth(); // for radius calc

  useScrollLock(!!selectedItem);

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

  // Haversine formula for distance
  const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  const filteredItems = items.filter(item => {
    const matchSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchCity =
      !cityFilter ||
      (item.location?.city && item.location.city.toLowerCase().includes(cityFilter.toLowerCase()));
      
    const matchCategory = 
      !categoryFilter || 
      item.category === categoryFilter;

    let matchRadius = true;
    if (radiusFilter > 0 && userLocation?.lat && userLocation?.lng && item.location?.coordinates) {
      const [lng, lat] = item.location.coordinates;
      const dist = getDistanceInKm(userLocation.lat, userLocation.lng, lat, lng);
      matchRadius = dist <= radiusFilter;
    }

    return matchSearch && matchCity && matchCategory && matchRadius;
  });

  const uniqueCities = [...new Set(items.map(i => i.location?.city).filter(Boolean))];
  const uniqueCategories = [...new Set(items.map(i => i.category).filter(Boolean))];

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
              onClick={() => navigate('/')}
              className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white leading-tight">Rozsewa Bazaar</h1>
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
        {/* Filters Section (Sleek Container) */}
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-100 dark:border-slate-800 p-3 space-y-3">
          
          {/* Distance Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
             <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-full">
               <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
               <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Distance</span>
             </div>
             {[0, 5, 10, 20, 50].map(dist => (
               <button
                  key={dist}
                  onClick={() => {
                     setRadiusFilter(dist);
                     if (dist > 0 && !userLocation?.lat) detectLocation();
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0 border
                    ${radiusFilter === dist 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {dist === 0 ? 'Everywhere' : `Upto ${dist} km`}
                </button>
             ))}
          </div>

          {/* Category Filter */}
          {uniqueCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
               <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-full">
                 <Package className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                 <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Product</span>
               </div>
               <button
                  onClick={() => setCategoryFilter('')}
                  className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0 border
                    ${!categoryFilter 
                      ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  All Products
                </button>
               {uniqueCategories.map(cat => (
                 <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shrink-0 border
                      ${categoryFilter === cat 
                        ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    {cat}
                  </button>
               ))}
            </div>
          )}
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Showing <span className="text-slate-900 dark:text-white">{filteredItems.length}</span> items
          </p>
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedItem(item)}
                className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden cursor-pointer active:scale-[0.98] transition-all border border-slate-200 dark:border-slate-800 flex flex-col relative group"
              >
                {/* Image Section */}
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                  {item.images && item.images[0] ? (
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                  )}
                  
                  {/* Clean Tags */}
                  <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10">
                    <div className="bg-white/90 backdrop-blur-sm text-slate-800 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 uppercase">
                      <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                      Verified
                    </div>
                    <div className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                      {item.condition}
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-2 flex flex-col flex-1">
                  <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">₹{item.price}</p>
                  <h3 className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1">{item.title}</h3>
                  
                  <div className="mt-auto pt-2">
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400">
                      <span className="truncate">{item.sellerId?.name || 'Seller'}</span>
                    </div>
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
              <div className="sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl pt-4 pb-2 z-20 rounded-t-[32px]">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-2" />
                <button
                  onClick={() => { setSelectedItem(null); setShowContact(false); }}
                  className="absolute right-4 top-4 w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 pb-32 space-y-6 mt-1">
                {/* Images Gallery */}
                {selectedItem.images && selectedItem.images.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x">
                    {selectedItem.images.map((img, i) => (
                      <div key={i} className="snap-center rounded-[24px] overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800 w-[92%] aspect-[4/3] bg-slate-50 dark:bg-slate-900 shadow-sm relative">
                        <img src={img} alt="" className="w-full h-full object-contain" />
                        <div className="absolute bottom-3 right-3 backdrop-blur-md bg-black/50 text-white text-[10px] font-black px-3 py-1.5 rounded-full">
                          {i + 1} / {selectedItem.images.length}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Title & Price Header */}
                <div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{selectedItem.title}</h2>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">₹{selectedItem.price}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-400 px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Verified
                    </span>
                    <span className="text-[10px] font-black text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 rounded-full uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                      {selectedItem.condition}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {selectedItem.description && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-[20px] p-4 border border-slate-100 dark:border-slate-800">
                    <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">{selectedItem.description}</p>
                  </div>
                )}

                {/* Condition & Seller */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Posted Date */}
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-950 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-base">📅</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Posted</p>
                      <p className="text-[11px] font-black text-slate-800 dark:text-white line-clamp-1 truncate">
                        {new Date(selectedItem.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>

                  {/* Seller Info */}
                  <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-950 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-base font-black text-blue-600">
                        {selectedItem.sellerId?.name?.charAt(0) || 'S'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Seller</p>
                      <p className="text-[11px] font-black text-slate-800 dark:text-white line-clamp-1 truncate">{selectedItem.sellerId?.name || 'User'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Footer for Actions */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-30">
                  {(() => {
                    const currentUserId = user?._id || user?.id || user?.user?._id || user?.user?.id;
                    const sellerIdStr = selectedItem.sellerId?._id?.toString() || selectedItem.sellerId?.toString();
                    const isOwner = !!(currentUserId && sellerIdStr && currentUserId.toString() === sellerIdStr);

                    return isOwner ? (
                      <button
                        disabled
                        className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-black rounded-2xl cursor-not-allowed uppercase tracking-wide text-sm"
                      >
                        Your Advertisement
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          navigate(`/bazaar/${selectedItem._id}/offer`);
                        }}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-[20px] active:scale-[0.98] transition-all shadow-[0_4px_20px_0_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                      >
                        <MessageCircle className="w-5 h-5 fill-white/20" />
                        Make an Offer
                      </button>
                    );
                  })()}
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 text-center font-bold">
                    Direct contact details are hidden until offer is accepted.
                  </p>
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
