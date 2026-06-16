import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ArrowRight, Loader2, Image as ImageIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import EmergencyButton from "@/modules/user/components/EmergencyButton";
import SearchBar from "@/modules/user/components/SearchBar";
import CategoryGrid from "@/modules/user/components/CategoryGrid";
import ServiceCard from "@/modules/user/components/ServiceCard";
import RecentBookingTracker from "@/modules/user/components/RecentBookingTracker";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const defaultBanners = [
  { id: 1, title: "Summer Mega Sale", subtitle: "Flat 30% OFF on AC Repair", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&q=80", link: "/shops?search=AC" },
  { id: 2, title: "Premium Salon at Home", subtitle: "Expert grooming starting ₹199", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80", link: "/shops?category=Salon" },
];

const defaultFeatured = [
  { id: "DEF-1", name: "CoolTech Services", category: "AC Repair", rating: 4.8, reviews: 189, distance: "2.5 km", price: "349", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80", verified: true, emergency: true },
  { id: "DEF-2", name: "Royal Men's Salon", category: "Salon", rating: 4.9, reviews: 312, distance: "1.2 km", price: "199", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80", verified: true, emergency: false },
];

const Index = () => {
  const navigate = useNavigate();
  const { userLocation, detectLocation } = useAuth();
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [banners, setBanners] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!userLocation) {
        try {
          await detectLocation();
        } catch (err) {
          console.log("Location access denied or failed");
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [userLocation]);

  const fetchHomeData = async () => {
    setLoading(true);
    try {
      const savedCity = localStorage.getItem("rozsewa_user_city");
      const providersEndpoint = userLocation
        ? `/public/featured-providers?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=15`
        : `/public/featured-providers${savedCity ? `?city=${savedCity}` : ""}`;

      const [bannersRes, providersRes] = await Promise.all([
        API.get("/public/banners"),
        API.get(providersEndpoint)
      ]);

      // Set banners from response
      setBanners(bannersRes.data);

      let providersData = providersRes.data;

      const mappedProviders = providersData.map(p => ({
        id: p._id,
        name: p.shopName || p.name,
        category: p.vendorType?.name || "Service",
        rating: p.rating !== undefined ? p.rating : 4.5,
        reviews: p.reviews || 0,
        distance: "Nearby",
        price: "199",
        image: p.profileImage || "https://images.unsplash.com/photo-1521791136064-7986c29596ba?w=800&q=80",
        verified: true,
        emergency: false
      }));
      setFeatured(mappedProviders.length > 0 ? mappedProviders : defaultFeatured);
    } catch (err) {
      console.error("Home fetch failed:", err);
      setBanners(defaultBanners);
      setFeatured(defaultFeatured);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const handleSearch = (query) => {
    if (query.trim()) navigate(`/shops?search=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <TopNav />

      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8">

        {/* Dynamic Banners Slider */}
        {(banners.length > 0 || loading) && (
          <section className="relative h-56 sm:h-72 lg:h-80 w-full overflow-hidden rounded-[2.5rem] bg-muted shadow-lg group border-4 border-white/50 dark:border-white/10">
            <AnimatePresence mode="wait">
              {!loading ? (
                banners.length > 0 ? (
                  <motion.div key={currentBanner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }} className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
                    <img src={banners[currentBanner].imageUrl || banners[currentBanner].image} alt={banners[currentBanner].title} className="h-full w-full object-cover transition-transform duration-[10s] group-hover:scale-105" />

                    <div className="absolute bottom-0 left-0 right-0 z-20 p-8 sm:p-12 text-left">
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2 leading-tight">
                          {banners[currentBanner].title}
                        </h2>
                        <p className="text-sm sm:text-base font-semibold text-white/80 mb-6 max-w-lg line-clamp-2">
                          {banners[currentBanner].description || banners[currentBanner].subtitle}
                        </p>
                        {banners[currentBanner]?.ctaText && (
                          <button
                            onClick={() => navigate(banners[currentBanner].ctaLink || banners[currentBanner].link || "/shops")}
                            className="rounded-full bg-white px-8 py-3.5 text-xs font-black uppercase tracking-widest text-slate-900 hover:bg-emerald-500 hover:text-white transition-colors shadow-lg active:scale-95 flex items-center gap-2 w-fit"
                          >
                            {banners[currentBanner].ctaText} <ArrowRight className="h-4 w-4" />
                          </button>
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                ) : null
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                </div>
              )}
            </AnimatePresence>

            {banners.length > 1 && (
              <div className="absolute bottom-10 right-10 z-30 flex gap-2">
                {banners.map((_, i) => (
                  <button key={i} onClick={() => setCurrentBanner(i)} className={`h-1.5 rounded-full transition-all ${currentBanner === i ? "w-8 bg-emerald-500" : "w-1.5 bg-white/40"}`} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Search & Live Tracking */}
        <section className="-mt-8 relative z-40 px-4 sm:px-12 space-y-4">
          <RecentBookingTracker />
          <SearchBar onSearch={handleSearch} />
        </section>

        <section>
          <EmergencyButton />
        </section>

        {/* Popular Categories - Premium Dark Theme */}
        <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-5 min-[400px]:p-8 sm:p-12 shadow-2xl shadow-emerald-900/10 border border-slate-800 group">
          {/* Animated background glow */}
          <div className="absolute top-0 right-0 h-64 w-64 bg-emerald-500/10 rounded-full blur-[100px] -mr-32 -mt-32 transition-all duration-1000 group-hover:bg-emerald-500/20" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 bg-blue-500/5 rounded-full blur-[120px]" />

          <div className="relative z-10 mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <span className="h-8 w-1.5 bg-emerald-500 rounded-full" />
                Popular Categories
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-4">Verified experts • 100% Secure</p>
            </div>

            <button
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="group/btn flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-full border border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 bg-slate-800/50 backdrop-blur-sm"
            >
              {showAllCategories ? "Minimize" : "Explore All"}
              <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${showAllCategories ? "-rotate-90" : "group-hover/btn:translate-x-1"}`} />
            </button>
          </div>

          <div className="relative z-10 p-1 rounded-[2.5rem]">
            <CategoryGrid showAll={showAllCategories} />
          </div>
        </section>

        {/* Featured Professionals */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-foreground">Featured Experts</h2>
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">Highly reliable professionals near you</p>
            </div>
            <Link to="/shops" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1 group/link">
              View All <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-1">
            {loading ? (
              [...Array(4)].map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-3xl animate-pulse"></div>)
            ) : (
              featured.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <ServiceCard {...p} />
                </motion.div>
              ))
            )}
          </div>
        </section>

        {/* Security Banner */}
        <section className="rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-12 text-center relative overflow-hidden group border border-slate-800 shadow-2xl">
          <div className="absolute top-0 right-0 h-64 w-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-[80px] group-hover:bg-emerald-500/10 transition-all duration-1000"></div>
          <div className="absolute bottom-0 left-0 h-40 w-40 bg-blue-500/5 rounded-full -ml-20 -mb-20 blur-[60px]"></div>
          
          <div className="relative z-10">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-3">
              Rozsewa Guarantee
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
            </h3>
            <p className="text-sm font-medium text-slate-400 mt-4 max-w-xl mx-auto leading-relaxed">
              Every professional is rigorously background-checked and verified to ensure high-quality, secure service delivery right at your doorstep.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5 sm:gap-4 text-white">
              {["Genuine Pro", "Safe Wallet", "Home Care"].map(badge => (
                <div key={badge} className="rounded-full bg-white/5 border border-white/10 px-4 sm:px-6 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold text-slate-300 shadow-sm backdrop-blur-sm hover:bg-white/10 hover:border-emerald-500/30 transition-colors cursor-default whitespace-nowrap">
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
