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
        rating: p.rating || 4.5,
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
          <section className="relative h-56 sm:h-72 lg:h-80 w-full overflow-hidden rounded-[40px] bg-muted shadow-2xl group border-8 border-white">
            <AnimatePresence mode="wait">
              {!loading ? (
                banners.length > 0 ? (
                  <motion.div key={currentBanner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1 }} className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                    <img src={banners[currentBanner].imageUrl || banners[currentBanner].image} alt={banners[currentBanner].title} className="h-full w-full object-cover" />

                    <div className="absolute bottom-0 left-0 right-0 z-20 p-8 sm:p-12 text-left">
                      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2 leading-tight italic">
                          {banners[currentBanner].title}
                        </h2>
                        <p className="text-sm sm:text-base font-bold text-white/70 mb-6 max-w-lg line-clamp-2">
                          {banners[currentBanner].description || banners[currentBanner].subtitle}
                        </p>
                        {banners[currentBanner]?.ctaText && (
                          <button
                            onClick={() => navigate(banners[currentBanner].ctaLink || banners[currentBanner].link || "/shops")}
                            className="rounded-2xl bg-white px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-black hover:bg-emerald-500 hover:text-white transition-all shadow-xl active:scale-95 flex items-center gap-3 w-fit"
                          >
                            {banners[currentBanner].ctaText} <ArrowRight className="h-4 w-4" />
                          </button>
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                ) : null
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
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

        {/* Popular Categories - Premium Dark Glass Theme */}
        <section className="relative overflow-hidden rounded-[3.5rem] bg-gradient-to-br from-gray-900 via-emerald-950 to-black p-8 sm:p-12 shadow-2xl border border-white/5 group">
          {/* Animated background glow */}
          <div className="absolute top-0 right-0 h-64 w-64 bg-emerald-500/20 rounded-full blur-[100px] -mr-32 -mt-32 transition-all duration-1000 group-hover:bg-emerald-500/30" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 bg-blue-500/10 rounded-full blur-[120px]" />

          <div className="relative z-10 mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black tracking-tighter text-white uppercase italic flex items-center gap-3">
                <span className="h-10 w-1.5 bg-emerald-500 rounded-full" />
                Popular Categories
              </h2>
              <p className="text-[10px] font-black text-emerald-400/80 uppercase tracking-[0.2em] mt-2">Verified experts • 100% Secure • Doorstep Service</p>
            </div>

            <button
              onClick={() => setShowAllCategories(!showAllCategories)}
              className="group/btn flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-white/10 hover:bg-emerald-500 transition-all px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10"
            >
              {showAllCategories ? "Minimize" : "Explore All"}
              <ChevronRight className={`h-4 w-4 transition-transform duration-500 ${showAllCategories ? "-rotate-90" : "group-hover/btn:translate-x-1"}`} />
            </button>
          </div>

          <div className="relative z-10 p-1 rounded-[2.5rem]">
            <CategoryGrid showAll={showAllCategories} />
          </div>
        </section>

        {/* Featured Professionals */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-gray-900 uppercase italic">Featured Experts</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Highly reliable professionals near you</p>
            </div>
            <Link to="/shops" className="text-[11px] font-black uppercase tracking-widest text-emerald-600 hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3.5 w-3.5" />
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
        <section className="rounded-[3rem] bg-gray-900 p-12 text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-64 w-64 bg-emerald-600/10 rounded-full -mr-32 -mt-32 blur-[100px] group-hover:bg-emerald-600/20 transition-all duration-1000"></div>
          <h3 className="text-3xl font-black tracking-tighter text-white italic">RojSewa Guarantee</h3>
          <p className="text-sm font-bold text-gray-400 mt-4 max-w-xl mx-auto leading-relaxed">Every professional is background checked and verified to ensure high-quality, secure service delivery at your doorstep.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-white">
            {["Genuine Pro", "Safe Wallet", "Home Care"].map(badge => (
              <div key={badge} className="rounded-2xl bg-white/5 border border-white/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                {badge}
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
