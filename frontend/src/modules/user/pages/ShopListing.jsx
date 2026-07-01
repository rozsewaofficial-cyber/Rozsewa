import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MapPin, BadgeCheck, ArrowLeft, Filter, SortAsc, X, CheckCircle2, ChevronRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import SearchBar from "@/modules/user/components/SearchBar";
import ServiceCard from "@/modules/user/components/ServiceCard";
import API from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import CategoryGrid from "@/modules/user/components/CategoryGrid";

const ShopListing = () => {
  const navigate = useNavigate();
  const { userLocation } = useAuth();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "";
  const isEmergency = searchParams.get("emergency") === "true";
  const filterParam = searchParams.get("filter");
  const initialSort = filterParam === 'nearby' ? 'distance' : 'rating';

  // Filters State
  const [sortBy, setSortBy] = useState(initialSort);
  const [minRating, setMinRating] = useState("");
  const [homeVisit, setHomeVisit] = useState(false);
  const [is24x7, setIs24x7] = useState(false);
  const [hasCombo, setHasCombo] = useState(false);
  const [radius, setRadius] = useState(15);

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const mode = searchParams.get("mode") || "partner";
  const filterOpenParam = searchParams.get("filterOpen") === "true";

  const [isFilterOpen, setIsFilterOpen] = useState(filterOpenParam);
  const [activeFilterTab, setActiveFilterTab] = useState("sort");

  useEffect(() => {
    const checkCategoryModel = async () => {
      if (!category) return;
      try {
        const { data } = await API.get("/public/categories");
        const found = data.find(c => c.name.toLowerCase() === category.toLowerCase() || c._id === category);
        if (found && found.businessModel === 'lead') {
          navigate(`/submit-lead?category=${found._id}&name=${encodeURIComponent(found.name)}`, { replace: true });
        }
      } catch (err) {
        console.error("Error checking category business model", err);
      }
    };
    checkCategoryModel();
  }, [category, navigate]);

  useEffect(() => {
    if (filterOpenParam) {
      setIsFilterOpen(true);
      // Clean up the URL so it doesn't re-trigger on reload
      searchParams.delete("filterOpen");
      navigate(`?${searchParams.toString()}`, { replace: true });
    }
  }, [filterOpenParam, navigate, searchParams]);

  useEffect(() => {
    if (mode !== "sewak") {
      fetchProviders();
    } else {
      setLoading(false);
    }
  }, [category, isEmergency, searchQuery, mode, minRating, homeVisit, is24x7, hasCombo, radius]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const params = { 
        category, 
        search: searchQuery, 
        emergency: isEmergency, 
        mode,
        minRating,
        homeVisit: homeVisit ? "true" : "",
        is24x7: is24x7 ? "true" : "",
        hasCombo: hasCombo ? "true" : "",
        radius
      };
      if (userLocation) {
        params.lat = userLocation.lat;
        params.lng = userLocation.lng;
      } else {
        const savedCity = localStorage.getItem("rozsewa_user_city");
        if (savedCity) params.city = savedCity;
      }
      let { data } = await API.get(`/public/providers`, { params });
      setProviders(data);
    } catch (error) {
      console.error("Error fetching providers:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };

  const allProvidersList = providers.map(p => {
    let distanceStr = "N/A";
    let numericDistance = 999;
    if (userLocation && p.location && p.location.coordinates && p.location.coordinates.length === 2) {
      const dist = calculateDistance(userLocation.lat, userLocation.lng, p.location.coordinates[1], p.location.coordinates[0]);
      if (dist) {
        distanceStr = `${dist} km`;
        numericDistance = parseFloat(dist);
      }
    }

    return {
      id: p._id,
      name: p.shopName || p.name,
      category: p.vendorType?.name || category,
      rating: p.rating !== undefined ? p.rating : 4.5,
      reviews: p.reviewCount || 0,
      distance: distanceStr,
      numericDistance,
      price: p.startingPrice || 199,
      image: p.profileImage || `https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop`,
      verified: p.status === "verified",
      emergency: p.isEmergencyEnabled || false
    };
  });

  const filtered = allProvidersList.filter((p) => {
    const sQuery = searchQuery.toLowerCase();
    const pName = p.name.toLowerCase();
    const pCat = p.category.toLowerCase();
    return pName.includes(sQuery) || pCat.includes(sQuery);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "price_low") return a.price - b.price;
    if (sortBy === "price_high") return b.price - a.price;
    return a.numericDistance - b.numericDistance;
  });

  const activeFiltersCount = (minRating ? 1 : 0) + (homeVisit ? 1 : 0) + (is24x7 ? 1 : 0) + (hasCombo ? 1 : 0) + (radius !== 15 ? 1 : 0) + (sortBy !== 'distance' ? 1 : 0);

  const clearFilters = () => {
    setSortBy('distance');
    setMinRating("");
    setHomeVisit(false);
    setIs24x7(false);
    setHasCombo(false);
    setRadius(15);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-0">
      <TopNav />
      
      {/* Header */}
      <div className="relative pt-6 pb-4 px-5 sm:px-8 bg-gradient-to-b from-[#e0f2fe] via-[#f0f9ff] to-slate-50 dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-950 rounded-b-[2rem] shadow-sm mb-2 z-10">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <ArrowLeft className="h-5 w-5" />
              </motion.button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white line-clamp-1">
                  {mode === "sewak" ? "Select a Service Category" : (isEmergency ? "🚨 Emergency Providers" : category || "All Services")}
                </h1>
                {mode !== "sewak" && (
                  <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{sorted.length} providers found</p>
                )}
              </div>
            </div>
            
            {/* Filter Toggle Button */}
            {mode !== "sewak" && (
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsFilterOpen(true)}
                className="relative flex h-10 items-center gap-2 rounded-full bg-white dark:bg-slate-800 px-4 shadow-sm border border-slate-200 dark:border-slate-700"
              >
                <Filter className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300 hidden sm:inline">Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                    {activeFiltersCount}
                  </span>
                )}
              </motion.button>
            )}
          </div>
          
          <SearchBar onSearch={(val) => {
            setSearchQuery(val);
          }} onFilterClick={() => setIsFilterOpen(true)} hideFilterIcon={true} />
          
          {/* Active Filter Chips */}
          {activeFiltersCount > 0 && mode !== "sewak" && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide pt-1">
              {sortBy !== 'distance' && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-400">
                  <span>Sort: {sortBy === 'price_low' ? 'Price (Low)' : sortBy === 'price_high' ? 'Price (High)' : 'Rating'}</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSortBy('distance')} />
                </div>
              )}
              {minRating && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-400">
                  <span>{minRating}+ Stars</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setMinRating("")} />
                </div>
              )}
              {homeVisit && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-400">
                  <span>Home Visit</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setHomeVisit(false)} />
                </div>
              )}
              {is24x7 && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-400">
                  <span>24/7 Service</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setIs24x7(false)} />
                </div>
              )}
              {hasCombo && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-400">
                  <span>Offers</span>
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setHasCombo(false)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="container max-w-6xl px-5 sm:px-8 space-y-6 pt-2">
        {mode === "sewak" ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Sewak Categories</h2>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
              <CategoryGrid showAll={true} mode={mode} searchQuery={searchQuery} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {sorted.map((p) => (
              <ServiceCard key={p.id} {...p} />
            ))}
            {sorted.length === 0 && !loading && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center">
                <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Filter className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">No providers match your exact filters.</p>
                <button onClick={clearFilters} className="mt-4 text-blue-600 font-bold hover:underline">Clear all filters</button>
              </div>
            )}
          </div>
        )}
      </main>
      
      <BottomNav mode={mode} />

      {/* Modern Filter Bottom Sheet */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-50 flex h-[80vh] max-h-[600px] flex-col rounded-t-[2rem] bg-white dark:bg-slate-900 shadow-2xl"
            >
              {/* Handle Bar */}
              <div className="flex w-full justify-center pt-3 pb-2">
                <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
              
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 pb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Filters</h2>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters} className="text-sm font-bold text-red-500 hover:text-red-600">Clear All</button>
                )}
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-1/3 min-w-[120px] max-w-[160px] bg-slate-50 dark:bg-slate-800/50 overflow-y-auto">
                  <div className="flex flex-col">
                    <button onClick={() => setActiveFilterTab("sort")} className={`flex items-center justify-between px-4 py-5 text-left text-sm font-bold transition-colors ${activeFilterTab === "sort" ? "bg-white dark:bg-slate-900 text-blue-600 border-l-4 border-blue-600" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-l-4 border-transparent"}`}>
                      Sort
                      {activeFilterTab === "sort" && <ChevronRight className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setActiveFilterTab("services")} className={`flex items-center justify-between px-4 py-5 text-left text-sm font-bold transition-colors ${activeFilterTab === "services" ? "bg-white dark:bg-slate-900 text-blue-600 border-l-4 border-blue-600" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-l-4 border-transparent"}`}>
                      Services
                      {activeFilterTab === "services" && <ChevronRight className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setActiveFilterTab("offers")} className={`flex items-center justify-between px-4 py-5 text-left text-sm font-bold transition-colors ${activeFilterTab === "offers" ? "bg-white dark:bg-slate-900 text-blue-600 border-l-4 border-blue-600" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-l-4 border-transparent"}`}>
                      Offers
                      {activeFilterTab === "offers" && <ChevronRight className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setActiveFilterTab("rating")} className={`flex items-center justify-between px-4 py-5 text-left text-sm font-bold transition-colors ${activeFilterTab === "rating" ? "bg-white dark:bg-slate-900 text-blue-600 border-l-4 border-blue-600" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-l-4 border-transparent"}`}>
                      Rating
                      {activeFilterTab === "rating" && <ChevronRight className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setActiveFilterTab("area")} className={`flex items-center justify-between px-4 py-5 text-left text-sm font-bold transition-colors ${activeFilterTab === "area" ? "bg-white dark:bg-slate-900 text-blue-600 border-l-4 border-blue-600" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-l-4 border-transparent"}`}>
                      Area
                      {activeFilterTab === "area" && <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Right Content */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 p-6">
                  {activeFilterTab === "sort" && (
                    <div className="flex flex-col gap-5">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${sortBy === 'distance' ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                          {sortBy === 'distance' && <div className="h-3 w-3 rounded-full bg-blue-500" />}
                        </div>
                        <span className={`text-[15px] font-medium ${sortBy === 'distance' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-400'}`}>Distance (Nearest first)</span>
                        <input type="radio" name="sort" checked={sortBy === 'distance'} onChange={() => setSortBy('distance')} className="hidden" />
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${sortBy === 'rating' ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                          {sortBy === 'rating' && <div className="h-3 w-3 rounded-full bg-blue-500" />}
                        </div>
                        <span className={`text-[15px] font-medium ${sortBy === 'rating' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-400'}`}>Rating (High to Low)</span>
                        <input type="radio" name="sort" checked={sortBy === 'rating'} onChange={() => setSortBy('rating')} className="hidden" />
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${sortBy === 'price_low' ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                          {sortBy === 'price_low' && <div className="h-3 w-3 rounded-full bg-blue-500" />}
                        </div>
                        <span className={`text-[15px] font-medium ${sortBy === 'price_low' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-400'}`}>Cost: Low to High</span>
                        <input type="radio" name="sort" checked={sortBy === 'price_low'} onChange={() => setSortBy('price_low')} className="hidden" />
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${sortBy === 'price_high' ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                          {sortBy === 'price_high' && <div className="h-3 w-3 rounded-full bg-blue-500" />}
                        </div>
                        <span className={`text-[15px] font-medium ${sortBy === 'price_high' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-400'}`}>Cost: High to Low</span>
                        <input type="radio" name="sort" checked={sortBy === 'price_high'} onChange={() => setSortBy('price_high')} className="hidden" />
                      </label>
                    </div>
                  )}

                  {activeFilterTab === "services" && (
                    <div className="flex flex-col gap-5">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${homeVisit ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                          {homeVisit && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <span className={`text-[15px] font-medium ${homeVisit ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-400'}`}>Home Visit</span>
                        <input type="checkbox" checked={homeVisit} onChange={() => setHomeVisit(!homeVisit)} className="hidden" />
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${is24x7 ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                          {is24x7 && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <span className={`text-[15px] font-medium ${is24x7 ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-400'}`}>24/7 Services</span>
                        <input type="checkbox" checked={is24x7} onChange={() => setIs24x7(!is24x7)} className="hidden" />
                      </label>
                    </div>
                  )}

                  {activeFilterTab === "offers" && (
                    <div className="flex flex-col gap-5">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${hasCombo ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                          {hasCombo && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <span className={`text-[15px] font-medium ${hasCombo ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-400'}`}>Special Offer / Combo</span>
                        <input type="checkbox" checked={hasCombo} onChange={() => setHasCombo(!hasCombo)} className="hidden" />
                      </label>
                    </div>
                  )}

                  {activeFilterTab === "rating" && (
                    <div className="flex flex-col gap-5">
                      {["4.5", "4.0", "3.5", "3.0"].map((r) => (
                        <label key={r} className="flex items-center gap-3 cursor-pointer group">
                          <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${minRating === r ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                            {minRating === r && <div className="h-3 w-3 rounded-full bg-blue-500" />}
                          </div>
                          <span className={`text-[15px] font-medium ${minRating === r ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-600 dark:text-slate-400'}`}>{r} & Above</span>
                          <input type="radio" name="rating" checked={minRating === r} onChange={() => setMinRating(r)} className="hidden" />
                        </label>
                      ))}
                    </div>
                  )}

                  {activeFilterTab === "area" && (
                    <div className="flex flex-col gap-6 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800 dark:text-white">Search Radius</span>
                        <span className="text-sm font-black text-blue-600">{radius} km</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="50" 
                        step="1" 
                        value={radius} 
                        onChange={(e) => setRadius(parseInt(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                      <div className="flex justify-between text-xs text-slate-400 font-medium">
                        <span>1 km</span>
                        <span>50 km</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Apply Button */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
                <button 
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShopListing;
