import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Star, BadgeCheck, MapPin, Phone, MessageCircle, Plus, Minus, ShoppingCart, ShieldCheck, Camera, CheckCircle2, ChevronDown, X, Package } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";

const defaultProviderFallback = {
  id: "default",
  name: "Rozsewa Expert",
  category: "General",
  rating: 4.8,
  reviews: 156,
  verified: true,
  address: "Lucknow, India",
  phone: "+91 9999999999",
  about: "Professional service provider with 5+ years of experience in delivering high-quality results.",
  qualifications: ["Background Verified", "Trained Professional", "5+ Years Exp", "COVID Vaccinated"],
  warranty: "30-Day Service Warranty",
  image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&h=400&fit=crop"
};

const fakePortfolio = [
  { id: 1, before: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=300&fit=crop", after: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=400&h=300&fit=crop" },
  { id: 2, before: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=300&fit=crop", after: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop" },
];

const fakeReviews = [
  { id: 1, user: "Amit K.", rating: 5, date: "2 days ago", text: "Excellent service! Very professional and on time." },
  { id: 2, user: "Priya S.", rating: 4, date: "1 week ago", text: "Good work, but arrived 10 mins late. Overall satisfied." },
  { id: 3, user: "Rahul M.", rating: 5, date: "2 weeks ago", text: "Saved my day! Fixed the issue in no time." },
];

import API from "@/lib/api";
import { useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";

const ShopDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tab, setTab] = useState("services"); // services | reviews | about
  const [cart, setCart] = useState({});
  const { toast } = useToast();
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [provider, setProvider] = useState(null);
  const [servicesList, setServicesList] = useState([]);
  const [combosList, setCombosList] = useState([]);
  const [reviewsList, setReviewsList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Provider directly by ID
      const { data: found } = await API.get(`/public/providers/${id}`);

      if (found) {
        setProvider({
          ...defaultProviderFallback,
          id: found._id,
          name: found.shopName || found.ownerName || found.name,
          category: found.vendorType?.name || "General",
          rating: found.rating !== undefined ? found.rating : 4.5,
          reviews: found.reviewCount || 0,
          verified: found.status === "verified",
          address: found.address || "Lucknow, India",
          phone: found.mobile || "+91 0000000000",
          image: found.profileImage || defaultProviderFallback.image,
          about: found.about || defaultProviderFallback.about,
          qualifications: found.qualifications?.length > 0 ? found.qualifications : defaultProviderFallback.qualifications,
          warranty: found.warranty || defaultProviderFallback.warranty,
          isOnline: found.isOnline !== undefined ? found.isOnline : true,
          portfolio: found.portfolio || [],
          openingTime: found.openingTime || "09:00 AM",
          closingTime: found.closingTime || "06:00 PM"
        });
      }

      // 2. Fetch services for this provider
      const { data } = await API.get(`/public/services/${id}`);
      const services = data.services || [];
      const combos = data.combos || [];

      const mappedServices = services.map(s => ({
        id: s._id,
        name: s.name,
        description: s.description,
        duration: s.duration || "30 min",
        image: s.image,
        serviceType: s.serviceType || "home",
        expressPrice: 0,
        plans: [
          { id: s._id, name: "Standard Service", price: s.price || 299, desc: "Standard service" }
        ]
      }));
      setServicesList(mappedServices);

      const mappedCombos = combos.map(c => ({
        id: c._id,
        name: c.name,
        description: c.description,
        price: c.price,
        image: c.image,
        services: c.services
      }));
      setCombosList(mappedCombos);

      // 3. Fetch reviews
      const { data: reviewsData } = await API.get(`/public/providers/${id}/reviews`);
      setReviewsList(reviewsData || []);

    } catch (error) {
      console.error("Error loading shop detail:", error);
      toast({ title: "Error", description: "Failed to load shop details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCall = () => { if (provider) window.location.href = `tel:${provider.phone}`; };
  const handleChat = () => { if (provider) window.location.href = `https://wa.me/${provider.phone.replace(/[^0-9]/g, '')}?text=Hi, I want to book a service.`; };

  const addToCart = (planId) => { setCart((prev) => ({ ...prev, [planId]: (prev[planId] || 0) + 1 })); };
  const removeFromCart = (planId) => {
    setCart((prev) => {
      const newCart = { ...prev };
      if (newCart[planId] > 1) newCart[planId]--;
      else delete newCart[planId];
      return newCart;
    });
  };

  const getPlanDetails = (planId) => {
    // Check individual services
    for (const s of servicesList) {
      const p = s.plans.find(pl => pl.id === planId);
      if (p) return { serviceName: s.name, planName: p.name, price: p.price, duration: s.duration, expressPrice: s.expressPrice };
    }
    // Check combos
    const combo = combosList.find(c => c.id === planId);
    if (combo) return { serviceName: combo.name, planName: "Combo Offer", price: combo.price, duration: "Varries", expressPrice: 0 };
    return null;
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = getPlanDetails(id);
    return sum + (p?.price || 0) * qty;
  }, 0);

  const handleCheckout = () => {
    let maxExpress = 0;
    const items = Object.entries(cart).map(([id, qty]) => {
      const d = getPlanDetails(id);
      if (d.expressPrice > maxExpress) maxExpress = d.expressPrice;
      return { id, name: `${d.serviceName} (${d.planName})`, price: d.price, qty, duration: d.duration, expressPrice: d.expressPrice };
    });
    localStorage.setItem("rozsewa_checkout_data", JSON.stringify({
      providerId: provider?.id,
      shopName: provider?.name,
      category: provider?.category,
      items,
      expressPrice: maxExpress,
      total: cartTotal
    }));
    navigate("/checkout");
  };

  if (loading || !provider) {
    return (
      <div className="min-h-screen flex flex-col pt-16">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-28 md:pb-0 font-sans">
      <TopNav />
      {/* Hero Banner */}
      <div className="relative h-72 sm:h-80 w-full bg-slate-900 rounded-b-[3rem] shadow-sm overflow-hidden mb-6">
        <img src={provider.image} alt={provider.name} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
        
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
          className="absolute left-4 sm:left-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/40 shadow-sm transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </motion.button>

        {/* Floating Info Box */}
        <div className="absolute inset-x-4 sm:inset-x-8 bottom-6 z-20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{provider.name}</h1>
                {provider.verified && <BadgeCheck className="h-6 w-6 text-blue-400" />}
              </div>
              
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] font-bold text-slate-300">
                <span className="flex items-center gap-1 rounded-[10px] bg-amber-500/20 px-3 py-1 text-amber-400 backdrop-blur-sm border border-amber-500/30">
                  <Star className="h-3.5 w-3.5 fill-current" /> {provider.rating} ({provider.reviews})
                </span>
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-emerald-400" /> {provider.address}</span>
                {!provider.isOnline && (
                  <span className="flex items-center gap-1 rounded-[10px] bg-rose-500/80 backdrop-blur-sm px-3 py-1 text-[11px] font-black uppercase text-white shadow-sm border border-rose-400/50">
                    <X className="h-3.5 w-3.5" /> Offline
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col sm:flex-row gap-2">
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleCall} className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-600/90 backdrop-blur-md border border-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-600/30 transition-all"><Phone className="h-5 w-5" /></motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleChat} className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-emerald-600/90 backdrop-blur-md border border-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-600/30 transition-all"><MessageCircle className="h-5 w-5" /></motion.button>
            </div>
          </div>
        </div>
      </div>

      <main className="container max-w-2xl px-4 sm:px-6 py-2 space-y-6">
        {/* Trust Badges */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
          {provider.warranty && (
            <div className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest shadow-sm">
              <ShieldCheck className="h-4 w-4" /> {provider.warranty}
            </div>
          )}
          {provider.qualifications.map(q => (
            <div key={q} className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-blue-500" /> {q}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex rounded-[20px] bg-white dark:bg-slate-800 p-1.5 shadow-sm border border-slate-200 dark:border-slate-700">
          {[{ id: "services", label: "Services" }, { id: "reviews", label: "Reviews" }, { id: "about", label: "About" }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 rounded-[16px] py-3.5 text-[13px] font-black transition-all ${tab === t.id ? "bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {tab === "services" && (
            <motion.div key="services" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">

              {/* Service Filter Tabs */}
              <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm text-[13px] font-bold mb-2">
                <button onClick={() => setServiceFilter('all')} className={`flex-1 py-2.5 rounded-full transition-all ${serviceFilter === 'all' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>All Services</button>
                <button onClick={() => setServiceFilter('home')} className={`flex-1 py-2.5 rounded-full transition-all ${serviceFilter === 'home' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Home Visit</button>
                <button onClick={() => setServiceFilter('24x7')} className={`flex-1 py-2.5 rounded-full transition-all ${serviceFilter === '24x7' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>24x7 Emergency</button>
              </div>

              {/* Combos Section */}
              {serviceFilter === 'all' && combosList.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest"><Package className="h-4 w-4 text-blue-500" /> Discounted Combos</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {combosList.map((combo) => (
                      <motion.div key={combo.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="relative rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div className="p-3.5 flex gap-3.5">
                          {combo.image && (
                            <div className="h-20 w-20 shrink-0 rounded-[14px] overflow-hidden bg-slate-100 dark:bg-slate-900">
                              <img src={combo.image} className="h-full w-full object-cover" alt={combo.name} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[14px] font-black text-slate-900 dark:text-white leading-tight truncate">{combo.name}</h3>
                            {combo.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{combo.description}</p>}
                            
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {combo.services && combo.services.length > 0 && combo.services.map((svc, i) => (
                                <span key={i} className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800/50 px-2 py-0.5 rounded-[6px] uppercase tracking-widest">
                                  + {svc.name || svc}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="px-4 pb-3.5 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Combo Price</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white leading-none">₹{combo.price}</p>
                          </div>
                          <div className="shrink-0">
                            {cart[combo.id] ? (
                              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl p-1 border border-blue-200 dark:border-blue-800 shadow-sm">
                                <button onClick={() => removeFromCart(combo.id)} className="h-7 w-7 flex items-center justify-center rounded-[8px] bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400"><Minus className="h-3.5 w-3.5" /></button>
                                <span className="w-4 text-center text-[12px] font-bold text-slate-900 dark:text-white">{cart[combo.id]}</span>
                                <button onClick={() => addToCart(combo.id)} className="h-7 w-7 flex items-center justify-center rounded-[8px] bg-blue-600 text-white"><Plus className="h-3.5 w-3.5" /></button>
                              </div>
                            ) : (
                              <button onClick={() => addToCart(combo.id)} className="px-5 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">ADD</button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Services Section */}
              <div className="space-y-3">
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Individual Services</h2>

                {servicesList.filter(s => serviceFilter === 'all' || s.serviceType === serviceFilter || s.serviceType === 'both').length === 0 ? (
                  <p className="text-center text-sm font-medium text-slate-500 py-10 bg-slate-50 dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800">No services found for this filter.</p>
                ) : (
                  servicesList.filter(s => serviceFilter === 'all' || s.serviceType === serviceFilter || s.serviceType === 'both').map((service, idx) => (
                    <div key={service.id} className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm transition-all hover:border-blue-500/30">
                      <div className="p-3.5" onClick={() => setExpandedPlan(expandedPlan === service.id ? null : service.id)}>
                        <div className="flex items-start justify-between gap-3 cursor-pointer">
                          <div className="flex gap-3 flex-1 min-w-0">
                            {(service.image || "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=100&h=100&fit=crop") && (
                              <img src={service.image || "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=100&h=100&fit=crop"} alt={service.name} className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-[14px] object-cover shadow-sm bg-slate-100 dark:bg-slate-900" />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-[14px] font-bold text-slate-900 dark:text-white truncate">
                                {service.name}
                              </h3>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-[6px] tracking-widest uppercase">{service.duration}</span>
                                {service.serviceType !== 'home' && (
                                  <span className={`text-[9px] px-2 py-0.5 rounded-[6px] uppercase tracking-widest font-black ${service.serviceType === '24x7' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}>
                                    {service.serviceType}
                                  </span>
                                )}
                              </div>
                              {service.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{service.description}</p>}
                            </div>
                          </div>
                          <div className={`shrink-0 h-7 w-7 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center transition-transform ${expandedPlan === service.id ? "rotate-180 bg-blue-50 dark:bg-blue-900/30 text-blue-600" : "text-slate-400"}`}>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {(expandedPlan === service.id || servicesList.length === 1) && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                            {service.plans.map((plan, i) => (
                              <div key={plan.id} className={`p-4 flex flex-row items-center justify-between gap-4 ${i !== service.plans.length - 1 ? "border-b border-slate-100 dark:border-slate-700" : ""}`}>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-[14px] font-bold text-slate-900 dark:text-white truncate">{plan.name}</h4>
                                  <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">₹{plan.price}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {cart[plan.id] ? (
                                    <div className="flex items-center gap-2 rounded-xl border border-blue-500 bg-blue-50 dark:bg-blue-900/30 p-1 shadow-sm">
                                      <button onClick={() => removeFromCart(plan.id)} className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"><Minus className="h-3.5 w-3.5" /></button>
                                      <span className="w-4 text-center text-[12px] font-bold text-slate-900 dark:text-white">{cart[plan.id]}</span>
                                      <button onClick={() => addToCart(plan.id)} className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-blue-600 text-white shadow-sm"><Plus className="h-3.5 w-3.5" /></button>
                                    </div>
                                  ) : (
                                    <button onClick={() => addToCart(plan.id)} className="rounded-[10px] border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-5 py-2 text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                                      ADD
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {tab === "reviews" && (
            <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              {(() => {
                const totalReviews = reviewsList.length;
                const avgRating = totalReviews > 0
                  ? (reviewsList.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
                  : "0.0";

                return (
                  <div className="flex flex-col sm:flex-row items-center gap-6 rounded-[24px] border border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900 p-6 shadow-sm">
                    <div className="text-center w-full sm:w-32 shrink-0 border-b sm:border-b-0 sm:border-r border-amber-200/50 dark:border-amber-900/50 pb-4 sm:pb-0 sm:pr-6">
                      <p className="text-5xl font-black text-amber-500">{avgRating}</p>
                      <div className="flex justify-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`h-4 w-4 ${s <= Math.round(parseFloat(avgRating)) ? "fill-amber-400 text-amber-400" : "text-amber-200 dark:text-slate-700"}`} />)}
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600/70 mt-2">{totalReviews} ratings</p>
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      {[5, 4, 3, 2, 1].map((n) => {
                        const starCount = reviewsList.filter(r => Math.round(r.rating) === n).length;
                        const percentage = totalReviews > 0 ? (starCount / totalReviews) * 100 : 0;
                        return (
                          <div key={n} className="flex items-center gap-3">
                            <div className="flex items-center gap-1 w-8 shrink-0">
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{n}</span><Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                            </div>
                            <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Customer Reviews</h3>
                {reviewsList.length === 0 ? (
                  <p className="text-center text-sm font-medium text-slate-500 py-10 bg-slate-50 dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800">No reviews yet.</p>
                ) : reviewsList.map(r => (
                  <div key={r._id} className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-sm font-bold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">{r.user.substring(0, 2)}</div>
                        <div>
                          <p className="text-[14px] font-bold text-slate-900 dark:text-white">{r.user}</p>
                          <p className="text-[11px] font-medium text-slate-500">{new Date(r.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(s => <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"}`} />)}</div>
                    </div>
                    <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{r.review}</p>
                    {r.service && <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mt-3 inline-block bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">Service: {r.service}</p>}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "about" && (
            <motion.div key="about" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-3">About Provider</h3>
                <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">{provider.about}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Camera className="h-5 w-5 text-blue-500" /> Previous Work</h3>
                <div className="grid grid-cols-2 gap-4">
                  {provider.portfolio?.length > 0 ? (
                    provider.portfolio.map((p, i) => (
                      <div key={i} className="col-span-2 grid grid-cols-2 gap-4">
                        {p.before && (
                          <div className="group relative rounded-2xl overflow-hidden aspect-video border border-slate-200 dark:border-slate-800 shadow-sm">
                            <img src={p.before} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Before" />
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[10px] font-bold text-white uppercase tracking-widest border border-white/50 px-3 py-1.5 rounded-full backdrop-blur-sm">Before</span>
                            </div>
                          </div>
                        )}
                        {p.after && (
                          <div className="group relative rounded-2xl overflow-hidden aspect-video border border-slate-200 dark:border-slate-800 shadow-sm">
                            <img src={p.after} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="After" />
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[10px] font-bold text-white uppercase tracking-widest border border-white/50 px-3 py-1.5 rounded-full backdrop-blur-sm">After</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] font-medium text-slate-500 col-span-2 text-center py-6">No previous work uploaded yet.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Cart Float */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-24 left-0 right-0 z-40 p-4 flex justify-center pointer-events-none">
            <div className="w-full max-w-sm pointer-events-auto">
              <div className="flex w-full items-center justify-between rounded-full bg-slate-900 px-6 py-3 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] border border-slate-700/50">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cartCount} item{cartCount > 1 ? 's' : ''}</span>
                  <span className="text-base font-black text-white leading-tight">₹{cartTotal}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={!provider.isOnline}
                  className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-bold tracking-wide transition-all ${!provider.isOnline ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}`}
                >
                  {!provider.isOnline ? 'Offline' : 'Continue'} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <BottomNav />
    </div>
  );
};

export default ShopDetail;
