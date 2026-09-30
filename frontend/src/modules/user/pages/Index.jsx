import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ArrowRight, Loader2, Image as ImageIcon, Briefcase, Heart, Bell, ShoppingBag, Recycle, MessageCircle, Gift } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import EmergencyButton from "@/modules/user/components/EmergencyButton";
import SearchBar from "@/modules/user/components/SearchBar";
import CategoryGrid from "@/modules/user/components/CategoryGrid";
import PromoBannerCarousel from "@/modules/user/components/PromoBannerCarousel";
import OfferCard from "@/components/OfferCard";
import ServiceCard from "@/modules/user/components/ServiceCard";
import RecentBookingTracker from "@/modules/user/components/RecentBookingTracker";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";
import { UserCircle, ShieldCheck, Tag, Clock, Siren, Truck, Zap } from "lucide-react";

const defaultBanners = [
  { id: 1, title: "Summer Mega Sale", subtitle: "Flat 30% OFF on AC Repair", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&q=80", link: "/shops?search=AC" },
  { id: 2, title: "Premium Salon at Home", subtitle: "Expert grooming starting ₹199", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80", link: "/shops?category=Salon" },
];

const Index = () => {
  const navigate = useNavigate();
  const { userLocation, userCity, userState, userDistrict, userPincode, detectLocation, serviceMode, setServiceMode, user } = useAuth();
  const userName = user ? (user.name || user.ownerName || "Guest").split(" ")[0] : "Guest";
  const [showAllCategories, setShowAllCategories] = useState(false);
  // The paid partner promotions (1/7/30-day plans, ProviderBanner model) —
  // shown at the top and repeated above Bazaar Chats. Admin promotional
  // banners used to be mixed into the top carousel too, but that meant a
  // paying partner's banner could be pushed out by a free admin one.
  const [partnerBanners, setPartnerBanners] = useState([]);
  // Live offer cards for the home carousel. Failing to load them must never
  // block the rest of the home page, so this is fetched on its own.
  const [homeOffers, setHomeOffers] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [bazaarChats, setBazaarChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0);
  // Insta Work can be switched off, and is off in places it has not launched
  // in yet. Sending someone to a screen that only says "not available" is
  // worse than not offering it, so the card waits to hear that it is on.
  const [instaEnabled, setInstaEnabled] = useState(false);

  useEffect(() => {
    const init = async () => {
      const savedCity = sessionStorage.getItem("rozsewa_user_city");
      const skipped = sessionStorage.getItem("location_gate_skipped") === "true";
      if (!userLocation && !savedCity && !skipped) {
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
  }, [userLocation, userCity, userState, userDistrict, userPincode]);

  // Scroll Restoration Logic
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('homeScrollPosition', window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!loading) {
      const savedPos = sessionStorage.getItem('homeScrollPosition');
      if (savedPos) {
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedPos, 10));
        }, 50);
      }
    }
  }, [loading]);

  const fetchHomeData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userLocation) {
        params.append("lat", userLocation.lat);
        params.append("lng", userLocation.lng);
        params.append("radius", 15);
      } 
      
      if (userCity) params.append("city", userCity);
      if (userState) params.append("state", userState);
      if (userDistrict) params.append("district", userDistrict);
      if (userPincode) params.append("pincode", userPincode);

      const providersEndpoint = `/public/featured-providers?${params.toString()}`;

      const [providerBannersRes, providersRes] = await Promise.all([
        API.get(`/public/provider-banners/active?${params.toString()}`),
        API.get(providersEndpoint)
      ]);

      // Add provider banners
      const pBanners = providerBannersRes.data?.banners?.map((b) => ({
        id: b._id,
        isProviderBanner: true,
        title: "",
        subtitle: "",
        link: `/shop/${b.provider?._id || b.provider}`,
        image: b.imageUrl
      })) || [];

      setPartnerBanners(pBanners);

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
      setFeatured([]);
    } finally {
      setLoading(false);
    }
  };

  // Whether to offer Insta Work here at all. Asked for the city, because it
  // launches city by city. Kept apart from the main home fetch so it runs when
  // the session is ready — folded into that fetch, it only ran if the user had
  // already loaded by the time a location change triggered it, which on a cold
  // load it had not.
  //
  // GET /insta/services is deliberately public ("so the Insta menu can
  // render before login" — instaRoutes.js) — a guard here that skipped the
  // fetch for a signed-out visitor hid the whole CTA from every guest,
  // contradicting that.
  useEffect(() => {
    let cancelled = false;
    API.get(`/insta/services${userCity ? `?city=${encodeURIComponent(userCity)}` : ""}`)
      .then(({ data }) => {
        if (!cancelled) {
          setInstaEnabled(data.enabled !== false && (data.services || []).length > 0);
        }
      })
      .catch(() => { if (!cancelled) setInstaEnabled(false); });
    return () => { cancelled = true; };
  }, [user, userCity]);

  useEffect(() => {
    let cancelled = false;
    API.get("/public/offers?limit=10")
      .then(({ data }) => { if (!cancelled) setHomeOffers(data.offers || []); })
      .catch(() => { /* home page renders fine without offers */ });
    return () => { cancelled = true; };
  }, []);

  const handleSearch = (query, filter) => {
    let url = `/shops?mode=${serviceMode}&`;
    if (query && query.trim()) url += `search=${encodeURIComponent(query)}&`;
    if (filter && filter !== 'all') url += `filter=${encodeURIComponent(filter)}&`;
    url = url.replace(/&$/, '');

    navigate(url);
  };

  const handleBannerClick = async (banner) => {
    if (banner.isProviderBanner) {
      try {
        await API.post(`/public/provider-banners/${banner.id}/click`);
      } catch (e) {
        console.error("Failed to track banner click", e);
      }
    }
    const link = banner.link;
    if (!link) return;
    // External links (admin-set full URLs) need a real browser navigation;
    // react-router's navigate() can't leave the SPA.
    if (/^https?:\/\//i.test(link)) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      navigate(link);
    }
  };

  // Bazaar / Insta Work / Refer & Earn / Sell Scrap used to each be their
  // own full-width card, stacked one after another — four scrolls' worth of
  // near-identical banners. Laid out as a 2x2 grid of compact tiles instead,
  // defined once here so both the Local Expert and Sewak branches stay
  // in sync. Insta Work drops out of the grid entirely when disabled for
  // this city, rather than leaving an empty slot.
  const quickLinksGrid = (
    <section className="grid grid-cols-2 gap-3 pt-2 pb-4">
      <Link
        to="/bazaar"
        className="flex items-start gap-2.5 rounded-[16px] border border-teal-100 dark:border-teal-800/50 bg-teal-50/70 dark:bg-teal-900/20 p-3.5 active:scale-95 transition-all"
      >
        <div className="h-9 w-9 shrink-0 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
          <ShoppingBag className="w-4 h-4 text-teal-600" />
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-slate-900 dark:text-white text-[11px] leading-tight">RozSewa Bazaar</h3>
          <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Buy & sell nearby</p>
        </div>
      </Link>

      {instaEnabled && (
        <Link
          to="/insta-work"
          className="flex items-start gap-2.5 rounded-[16px] border border-amber-100 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-900/20 p-3.5 active:scale-95 transition-all"
        >
          <div className="h-9 w-9 shrink-0 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 dark:text-white text-[11px] leading-tight">Insta Work</h3>
            <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Book by the hour</p>
          </div>
        </Link>
      )}

      <Link
        to="/refer-earn"
        className="flex items-start gap-2.5 rounded-[16px] border border-fuchsia-100 dark:border-fuchsia-800/50 bg-fuchsia-50/70 dark:bg-fuchsia-900/20 p-3.5 active:scale-95 transition-all"
      >
        <div className="h-9 w-9 shrink-0 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
          <Gift className="w-4 h-4 text-fuchsia-600" />
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-slate-900 dark:text-white text-[11px] leading-tight">Refer & Earn</h3>
          <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Earn RozSewa Coins</p>
        </div>
      </Link>

      <Link
        to="/scrap/add"
        className="flex items-start gap-2.5 rounded-[16px] border border-blue-100 dark:border-blue-800/50 bg-blue-50/70 dark:bg-blue-900/20 p-3.5 active:scale-95 transition-all"
      >
        <div className="h-9 w-9 shrink-0 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
          <Recycle className="w-4 h-4 text-blue-600" />
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-slate-900 dark:text-white text-[11px] leading-tight">Sell Scrap</h3>
          <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Get instant pickup</p>
        </div>
      </Link>
    </section>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 md:pb-8">
      {/* Service Mode Selection Modal */}
      {!serviceMode && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 w-full max-w-sm shadow-2xl border border-slate-200/60 dark:border-slate-800/80 text-center relative overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
            
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 dark:border-blue-800/50 relative z-10">
              <UserCircle className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-3 relative z-10">Choose Your Mode</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-8 relative z-10">
              Select the service mode you want to proceed with. You can always change this later.
            </p>
            
            <div className="space-y-3 relative z-10">
              <button 
                onClick={() => setServiceMode('partner')}
                className="w-full h-auto py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 flex flex-col items-center justify-center gap-1"
              >
                <div className="flex items-center justify-center gap-2 font-black tracking-wide text-base">
                  <Briefcase className="w-5 h-5" />
                  Explore as Local Expert
                </div>
                <div className="text-blue-100/90 text-xs font-semibold text-center">
                  Find verified professionals & shops
                </div>
              </button>
              <button 
                onClick={() => setServiceMode('sewak')}
                className="w-full h-auto py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-2xl transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1"
              >
                <div className="flex items-center justify-center gap-2 font-black tracking-wide text-base">
                  <Heart className="w-5 h-5" />
                  Explore as Sewak
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold text-center">
                  Find domestic helpers & daily wagers
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <TopNav />

      {/* New Gradient Header Section */}
      {/* z-30: without an explicit z-index here, this header sits at the
          same "auto" stacking level as the static <main> below it — a
          positioned descendant there (a card's favorite heart, a "Coming
          Soon" badge) painted on top of the search suggestion dropdown
          nested in here, since <main> comes later in the DOM. */}
      <div className="relative z-30 pt-6 pb-4 px-5 sm:px-8 bg-gradient-to-b from-[#e0f2fe] via-[#f0f9ff] to-slate-50 dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-950 rounded-b-[2rem] shadow-sm">
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
          <SearchBar mode={serviceMode} onSearch={handleSearch} onFilterClick={(query) => {
            let url = `/shops?mode=${serviceMode}&filterOpen=true`;
            if (query && query.trim()) url += `&search=${encodeURIComponent(query)}`;
            navigate(url);
          }} />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 pt-2 pb-6 space-y-6">

        {/* Active Booking Tracker */}
        <RecentBookingTracker />

        {/* Banner Section */}
        <PromoBannerCarousel banners={partnerBanners} defaultBanners={defaultBanners} onBannerClick={handleBannerClick} />

        {/* Global Service Mode Toggle */}
        <div className="flex flex-col items-center justify-center mt-6 mb-8 px-4">
          <div className="bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md p-1.5 rounded-full flex relative w-full max-w-[320px] border border-slate-200/50 dark:border-slate-800/50 shadow-inner">
            <motion.div
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-blue-50/80 dark:bg-blue-900/40 rounded-full shadow-[0_2px_8px_rgba(59,130,246,0.15)] dark:shadow-[0_2px_8px_rgba(59,130,246,0.3)] border border-blue-200/60 dark:border-blue-700/60"
              initial={false}
              animate={{ x: (!serviceMode || serviceMode === "partner") ? "6px" : "calc(100% + 6px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
            <button
              onClick={() => setServiceMode("partner")}
              className={`flex-1 relative z-10 py-2.5 text-[13px] font-bold rounded-full transition-colors flex items-center justify-center gap-1.5 ${(!serviceMode || serviceMode === "partner") ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
            >
              <Briefcase className="w-4 h-4" /> Local Expert
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

        {(!serviceMode || serviceMode === "partner") ? (
          <div className="space-y-6">
            {/* Categories Section ("Your Nearby Experts") */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-blue-500 text-2xl leading-none">#</span> Your Nearby Experts
                </h2>
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="text-[13px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  {showAllCategories ? "Show Less" : "View all"}
                </button>
              </div>
              <CategoryGrid showAll={showAllCategories} mode={serviceMode} />
            </section>

            {/* 🎁 Live offers carousel */}
            {homeOffers.length > 0 && (
              <section className="mt-2 mb-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
                    🎁 Offers for you
                  </h2>
                  <button
                    onClick={() => navigate("/offers")}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-none snap-x">
                  {homeOffers.map((offer) => (
                    <div key={offer._id} className="snap-start">
                      <OfferCard offer={offer} compact />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Partner-promoted banners (1/7/30-day plans), repeated above Bazaar Chats for extra visibility — same list as the top carousel */}
            <PromoBannerCarousel banners={partnerBanners} defaultBanners={defaultBanners} onBannerClick={handleBannerClick} />

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

            {/* Featured Professionals */}
            {(loading || featured.length > 0) && (
              <section className="space-y-4 pt-2 pb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Explore Our Providers</h2>
                  <Link to={`/shops?mode=${serviceMode || "partner"}`} className="text-[13px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors">
                    View all
                  </Link>
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

            {quickLinksGrid}

          </div>
        ) : (
          /* Sewak Categories Section */
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-blue-500 text-2xl leading-none">#</span> RozSewa Verified Sewak
                </h2>
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="text-[13px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  {showAllCategories ? "Show Less" : "View all"}
                </button>
              </div>
              <CategoryGrid showAll={showAllCategories} mode={serviceMode} />
            </section>

            {quickLinksGrid}
          </div>
        )}

        {/* 24/7 Emergency Banner */}
        <section className="mt-8 mb-4">
          <Link
            to="/shops?category=Emergency"
            className="block relative overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-900 to-slate-950 border border-red-900/40 p-5 shadow-lg shadow-red-950/10 active:scale-[0.98] transition-all"
          >
            <div className="absolute -right-8 -top-8 w-36 h-36 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex items-start gap-4">
              <div className="shrink-0 h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Siren className="w-7 h-7 text-red-500" />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[17px] font-black text-white tracking-tight">24/7 Emergency Services</h2>
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[9px] font-black tracking-wider text-red-400">LIVE</span>
                </div>
                <p className="text-[12px] font-medium text-slate-400 mt-1.5 leading-relaxed">
                  Electrician, plumber, ambulance & locksmith — help arrives fast, any time of day.
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-4 flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-red-400">Book Emergency Help</span>
              <ArrowRight className="w-4 h-4 text-red-400" />
            </div>
          </Link>
        </section>
        {/* Why Choose Us */}
        <section className="mt-8 space-y-4 pt-2">
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
      </main>

      <BottomNav mode={serviceMode || 'partner'} />
    </div>
  );
};

export default Index;
