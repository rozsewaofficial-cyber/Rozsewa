import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ArrowRight, Loader2, Image as ImageIcon, Briefcase, Heart, Bell, ShoppingBag, Recycle, MessageCircle } from "lucide-react";
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
import { UserCircle, ShieldCheck, Tag, Clock, Siren, Truck, Wrench } from "lucide-react";

const defaultBanners = [
  { id: 1, title: "Summer Mega Sale", subtitle: "Flat 30% OFF on AC Repair", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&q=80", link: "/shops?search=AC" },
  { id: 2, title: "Premium Salon at Home", subtitle: "Expert grooming starting ₹199", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80", link: "/shops?category=Salon" },
];

const Index = () => {
  const navigate = useNavigate();
  const { userLocation, userCity, detectLocation, serviceMode, setServiceMode, user } = useAuth();
  const userName = user ? (user.name || user.ownerName || "Guest").split(" ")[0] : "Guest";
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [banners, setBanners] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [bazaarChats, setBazaarChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const init = async () => {
      const savedCity = localStorage.getItem("rozsewa_user_city");
      if (!userLocation && !savedCity) {
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
  }, [userLocation, userCity]);

  const fetchHomeData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userLocation) {
        params.append("lat", userLocation.lat);
        params.append("lng", userLocation.lng);
        params.append("radius", 15);
      } else if (userCity) {
        params.append("city", userCity);
      }
      const providersEndpoint = `/public/featured-providers?${params.toString()}`;

      const [bannersRes, providersRes] = await Promise.all([
        API.get("/public/banners"),
        API.get(providersEndpoint)
      ]);
      const apiBanners = bannersRes.data?.map((b, i) => {
        let imageUrl = b.imageUrl || b.image;
        if (imageUrl && !imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) {
          imageUrl = `http://localhost:5000/${imageUrl.replace(/^\//, '')}`;
        }
        return {
          id: b._id || b.id || i,
          title: b.title || "",
          subtitle: b.description || b.subtitle || "",
          link: b.ctaLink || b.link || "/shops",
          image: imageUrl || defaultBanners[i % defaultBanners.length].image
        };
      });
      setBanners(apiBanners?.length > 0 ? apiBanners : defaultBanners);

      if (user) {
        try {
          const chatsRes = await API.get('/bazaar/user-offers');
          if (chatsRes.data.success) {
            setBazaarChats(chatsRes.data.data.slice(0, 3)); // Show top 3 recent chats
          }
        } catch (e) {
          console.error("Failed to fetch bazaar chats", e);
        }
      }

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
      setFeatured(mappedProviders.length > 0 ? mappedProviders : []);
    } catch (err) {
      console.error("Home fetch failed:", err);
      setBanners(defaultBanners);
      setFeatured([]);
    } finally {
      setLoading(false);
    }
  };

  const bannerScrollRef = useRef(null);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => {
        const next = (prev + 1) % banners.length;
        if (bannerScrollRef.current) {
          bannerScrollRef.current.scrollTo({
            left: next * bannerScrollRef.current.clientWidth,
            behavior: "smooth"
          });
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const handleBannerScroll = (e) => {
    if (!e.target) return;
    const scrollLeft = e.target.scrollLeft;
    const width = e.target.clientWidth;
    if (width > 0) {
      const index = Math.round(scrollLeft / width);
      if (index !== currentBanner) {
        setCurrentBanner(index);
      }
    }
  };

  const handleSearch = (query, filter) => {
    let url = `/shops?mode=${serviceMode}&`;
    if (query && query.trim()) url += `search=${encodeURIComponent(query)}&`;
    if (filter && filter !== 'all') url += `filter=${encodeURIComponent(filter)}&`;
    url = url.replace(/&$/, '');

    navigate(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 md:pb-8">
      <TopNav />

      {/* New Gradient Header Section */}
      <div className="relative pt-6 pb-4 px-5 sm:px-8 bg-gradient-to-b from-[#e0f2fe] via-[#f0f9ff] to-slate-50 dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-950 rounded-b-[2rem] shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between mb-3">
          <div>
            <h1 className="text-3xl font-outfit font-medium tracking-tight text-slate-900 dark:text-white">
              Hi, <span className="font-bold">{userName}</span>
            </h1>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1">
              You are welcome to RozSewa
            </p>
          </div>
          <button onClick={() => navigate('/notifications')} className="relative h-11 w-11 rounded-full bg-white/80 backdrop-blur-md border border-slate-200/60 dark:bg-slate-800/80 dark:border-slate-700/60 shadow-sm flex items-center justify-center active:scale-95 transition-all text-slate-700 dark:text-slate-300 hover:text-blue-600 hover:shadow-md">
            <Bell className="w-[22px] h-[22px]" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,1)] dark:shadow-[0_0_0_2px_rgba(15,23,42,1)]"></span>
          </button>
        </div>

        <div className="max-w-7xl mx-auto relative z-20">
          <SearchBar onSearch={handleSearch} onFilterClick={() => navigate(`/shops?mode=${serviceMode}&filterOpen=true`)} />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 pt-2 pb-6 space-y-6">

        {/* Active Booking Tracker */}
        <RecentBookingTracker />

        {/* Banner Section */}
        {banners.length > 0 && (
          <div className="relative w-full aspect-[21/9] sm:aspect-[3/1] max-h-[220px] rounded-[20px] sm:rounded-[24px] overflow-hidden shadow-sm group bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
            <div 
              ref={bannerScrollRef}
              onScroll={handleBannerScroll}
              className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              style={{ scrollBehavior: 'smooth' }}
            >
              {banners.map((banner, idx) => (
                <div key={`${banner.id}-${idx}`} className="w-full h-full shrink-0 snap-center snap-always relative">
                  <img
                    src={banner.image}
                    className="w-full h-full object-cover pointer-events-none"
                    alt="Promo Banner"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = defaultBanners[idx % defaultBanners.length].image;
                    }}
                  />
                  {(banner.title || banner.subtitle) && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end pointer-events-none">
                      {banner.title && (
                        <h2 className="text-white text-base sm:text-xl font-black max-w-[80%] leading-tight drop-shadow-md">
                          {banner.title}
                        </h2>
                      )}
                      {banner.subtitle && (
                        <p className="text-white/90 text-[10px] sm:text-sm font-semibold mt-0.5 max-w-[80%] leading-snug drop-shadow-md">
                          {banner.subtitle}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Banner Pagination Dots */}
            <div className="absolute bottom-3 right-4 flex gap-1.5 z-20 bg-black/20 backdrop-blur-md px-2 py-1.5 rounded-full pointer-events-none">
              {banners.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === currentBanner ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Global Service Mode Toggle */}
        <div className="flex flex-col items-center justify-center mt-6 mb-8 px-4">
          <div className="bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md p-1.5 rounded-full flex relative w-full max-w-[320px] border border-slate-200/50 dark:border-slate-800/50 shadow-inner">
            <motion.div
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-blue-50/80 dark:bg-blue-900/40 rounded-full shadow-[0_2px_8px_rgba(59,130,246,0.15)] dark:shadow-[0_2px_8px_rgba(59,130,246,0.3)] border border-blue-200/60 dark:border-blue-700/60"
              initial={false}
              animate={{ x: serviceMode === "partner" ? "6px" : "calc(100% + 6px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
            <button
              onClick={() => setServiceMode("partner")}
              className={`flex-1 relative z-10 py-2.5 text-[13px] font-bold rounded-full transition-colors flex items-center justify-center gap-1.5 ${serviceMode === "partner" ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
            >
              <Briefcase className="w-4 h-4" /> Partner
            </button>
            <button
              onClick={() => setServiceMode("sewak")}
              className={`flex-1 relative z-10 py-2.5 text-[13px] font-bold rounded-full transition-colors flex items-center justify-center gap-1.5 ${serviceMode === "sewak" ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
            >
              <Heart className="w-4 h-4" /> Sewak
            </button>
          </div>
        </div>

        {serviceMode === "partner" ? (
          <div className="space-y-6">
            {/* Categories Section ("Just for you") */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-blue-500 text-2xl leading-none">#</span> Just for you
                </h2>
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="text-[13px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  View all
                </button>
              </div>
              <CategoryGrid showAll={showAllCategories} mode={serviceMode} />
            </section>

            {/* Active Bazaar Chats (If any) */}
            {bazaarChats.length > 0 && (
              <section className="mt-2 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-blue-500" /> Bazaar Chats
                  </h2>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 -mx-5 px-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-x">
                  {bazaarChats.map((chat) => {
                    const isSeller = chat.sellerId?._id?.toString() === user?._id?.toString();
                    const otherPartyName = isSeller ? chat.buyerId?.name : chat.sellerId?.name;
                    return (
                      <Link
                        key={chat._id}
                        to={`/bazaar/${chat.adId?._id}/offer?offerId=${chat._id}`}
                        className="snap-start shrink-0 w-[240px] bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 shadow-sm flex gap-3 items-center active:scale-95 transition-transform"
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          {chat.adId?.images && chat.adId?.images[0] ? (
                            <img src={chat.adId.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">{isSeller ? 'Someone Interested' : 'You Offered'}</p>
                          <p className="text-xs font-black text-slate-800 dark:text-white line-clamp-1">{chat.adId?.title}</p>
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">With: {otherPartyName || 'User'}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Sell Scrap CTA */}
            <section className="space-y-4 pt-2 pb-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 rounded-[24px] border border-blue-100 dark:border-blue-800/50 relative overflow-hidden flex items-center justify-between shadow-sm">
                <div className="relative z-10 w-[70%]">
                  <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight">Got scrap to sell?</h3>
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-1.5 mb-3 leading-relaxed">Schedule a pickup from your home and get the best price for your scrap.</p>
                  <Link to="/scrap/add" className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-blue-200 dark:shadow-none">
                    Sell Scrap Now <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="absolute right-[-10px] top-1/2 -translate-y-1/2 opacity-30">
                  <Recycle className="w-28 h-28 text-blue-500" />
                </div>
              </div>
            </section>

            {/* Featured Professionals */}
            {(loading || featured.length > 0) && (
              <section className="space-y-4 -mt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Explore Our Providers</h2>
                </div>

                <div className="flex overflow-x-auto pb-4 -mx-1 px-1 gap-4 snap-x snap-mandatory scrollbar-hide">
                  {loading ? (
                    [...Array(4)].map((_, i) => <div key={i} className="min-w-[240px] h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse shrink-0"></div>)
                  ) : (
                    featured.map((p, i) => (
                      <motion.div key={p.id} className="snap-start shrink-0 min-w-[240px]" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                        <ServiceCard {...p} />
                      </motion.div>
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Bazaar Promo Section */}
            <section className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="text-teal-500 w-5 h-5" /> Rojsewa Bazaar
                </h2>
                <Link to="/bazaar" className="text-[13px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 transition-colors">
                  Browse All
                </Link>
              </div>
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 p-5 rounded-[24px] border border-teal-100 dark:border-teal-800/50 relative overflow-hidden flex items-center justify-between">
                <div className="relative z-10">
                  <h3 className="font-black text-slate-900 dark:text-white text-lg">Verified Second Hand Goods</h3>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1 max-w-[200px]">Buy and sell scrap/items securely with other users nearby.</p>
                  <Link to="/bazaar" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all">
                    Explore Bazaar <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 opacity-20">
                  <ShoppingBag className="w-32 h-32 text-teal-600" />
                </div>
              </div>
            </section>

            {/* Why Choose Us */}
            <section className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Why RozSewa?</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { title: "Verified Pros", desc: "100% background-checked experts", icon: ShieldCheck, color: "emerald" },
                  { title: "Fixed Pricing", desc: "No hidden costs, transparent rates", icon: Tag, color: "blue" },
                  { title: "On-Time Service", desc: "Punctual & reliable doorstep service", icon: Clock, color: "amber" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                    <div className={`p-3.5 rounded-[18px] shrink-0 ${item.color === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : item.color === 'blue' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-[15px] mb-0.5">{item.title}</h3>
                      <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 leading-snug">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* Sewak Categories Section */
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-blue-500 text-2xl leading-none">#</span> Sewak Categories
                </h2>
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="text-[13px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  View all
                </button>
              </div>
              <CategoryGrid showAll={showAllCategories} mode={serviceMode} />
            </section>
          </div>
        )}

        {/* 24/7 Emergency Banner */}
        <section className="mt-10 mb-4 px-1">
          <Link to="/shops?category=Emergency" className="block relative group rounded-[24px] bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-red-900/50 p-6 text-center shadow-[0_0_20px_rgba(220,38,38,0.15)] hover:shadow-[0_0_30px_rgba(220,38,38,0.25)] transition-all">
            {/* Background glowing effects with overflow hidden to keep it inside borders */}
            <div className="absolute inset-0 rounded-[22px] overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-600/20 via-transparent to-transparent"></div>
            </div>

            {/* Siren Icon - positioned outside the overflow-hidden background */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-slate-900 rounded-full border-2 border-red-900/50 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)] z-20">
              <Siren className="w-8 h-8 text-red-500 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            </div>

            <div className="relative z-10 pt-4">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-300 to-red-500 drop-shadow-sm uppercase">
                24/7 EMERGENCY
              </h2>

              <div className="flex items-center justify-center gap-4 mt-3 mb-4">
                <div className="flex flex-col items-center">
                  <Wrench className="w-5 h-5 text-amber-500/80 mb-1" />
                  <span className="text-[10px] font-bold text-amber-500/80 uppercase">Fix It</span>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div className="flex flex-col justify-center flex-1">
                  <p className="text-[13px] font-medium text-slate-300 leading-tight">
                    Urgent Help (Electrician, Plumber, Ambulance, Locksmith, etc.)
                  </p>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-500/80 flex items-center justify-center">
                    <span className="text-[11px] font-black text-amber-500/80">24/7</span>
                  </div>
                </div>
              </div>

              <div className="inline-block px-4 py-1.5 rounded-full bg-red-950/50 border border-red-900/50">
                <p className="text-[11px] font-black tracking-widest text-red-400 uppercase">
                  Fast Response | Anytime Support
                </p>
              </div>
            </div>
          </Link>
        </section>
      </main>

      <BottomNav mode={serviceMode} />
    </div>
  );
};

export default Index;
