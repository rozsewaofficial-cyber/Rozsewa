import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Star, BadgeCheck, MapPin, Phone, MessageCircle, Plus, Minus, ShoppingCart, ShieldCheck, Camera, CheckCircle2, ChevronDown, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";

const defaultProviderFallback = {
  id: "default",
  name: "RojSewa Expert",
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
          rating: found.rating || 4.5,
          reviews: found.reviewCount || 0,
          verified: found.status === "verified",
          address: found.address || "Lucknow, India",
          phone: found.mobile || "+91 0000000000",
          image: found.profileImage || defaultProviderFallback.image,
          about: found.about || defaultProviderFallback.about,
          qualifications: found.qualifications?.length > 0 ? found.qualifications : defaultProviderFallback.qualifications,
          warranty: found.warranty || defaultProviderFallback.warranty,
          isOnline: found.isOnline !== undefined ? found.isOnline : true
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
        expressPrice: s.pricing?.express || 0,
        plans: [
          { id: `${s._id}-basic`, name: "Basic", price: s.pricing?.basic || 299, desc: "Standard service" },
          ...(s.pricing?.standard ? [{ id: `${s._id}-standard`, name: "Standard", price: s.pricing.standard, desc: "Enhanced service" }] : []),
          ...(s.pricing?.premium ? [{ id: `${s._id}-premium`, name: "Premium", price: s.pricing.premium, desc: "Premium quality service" }] : []),
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
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <TopNav />
      {/* Hero Banner */}
      <div className="relative h-56 sm:h-72 w-full bg-muted">
        <img src={provider.image} alt={provider.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30">
          <ArrowLeft className="h-5 w-5" />
        </motion.button>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{provider.name}</h1>
                {provider.verified && <BadgeCheck className="h-6 w-6 text-primary" />}
              </div>
              <div className="mt-1.5 flex items-center gap-4 text-xs font-semibold text-white/90">
                <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-amber-300 backdrop-blur-md"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {provider.rating} ({provider.reviews})</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 opacity-70" /> {provider.address}</span>
                {!provider.isOnline && (
                  <span className="flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1 text-[10px] font-black uppercase text-white shadow-lg shadow-rose-500/20">
                    <X className="h-3 w-3" /> Offline
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleCall} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 backdrop-blur-md text-primary-foreground hover:bg-primary/40"><Phone className="h-4 w-4" /></motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleChat} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 backdrop-blur-md text-emerald-400 hover:bg-emerald-500/40"><MessageCircle className="h-4 w-4" /></motion.button>
            </div>
          </div>
        </div>
      </div>

      <main className="container max-w-2xl px-4 py-6 space-y-6">
        {/* Trust Badges */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {provider.warranty && (
            <div className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-900/10 px-3 py-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" /> {provider.warranty}
            </div>
          )}
          {provider.qualifications.map(q => (
            <div key={q} className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {q}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-muted p-1">
          {[{ id: "services", label: "Services" }, { id: "reviews", label: "Reviews" }, { id: "about", label: "About" }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {tab === "services" && (
            <motion.div key="services" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">

              {combosList.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black italic tracking-tight text-slate-800 uppercase">Combo Deals <span className="text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-full not-italic">SAVE BIG</span></h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {combosList.map((combo) => (
                      <motion.div key={combo.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        className="relative rounded-3xl border border-emerald-500/20 bg-emerald-50/30 overflow-hidden flex flex-col sm:flex-row shadow-sm">
                        {combo.image && (
                          <div className="h-32 sm:h-auto sm:w-32 shrink-0">
                            <img src={combo.image} className="h-full w-full object-cover" alt={combo.name} />
                          </div>
                        )}
                        <div className="p-4 flex-1">
                          <h3 className="text-sm font-black text-slate-900 leading-tight">{combo.name}</h3>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {combo.services.map(s => (
                              <span key={s._id} className="text-[9px] font-bold text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-md">+ {s.name}</span>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-base font-black text-emerald-600">₹{combo.price}</span>
                            <div className="shrink-0">
                              {cart[combo.id] ? (
                                <div className="flex items-center gap-2 bg-white rounded-xl p-1 border border-emerald-500 shadow-sm">
                                  <button onClick={() => removeFromCart(combo.id)} className="h-6 w-6 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Minus className="h-3 w-3" /></button>
                                  <span className="w-4 text-center text-xs font-bold">{cart[combo.id]}</span>
                                  <button onClick={() => addToCart(combo.id)} className="h-6 w-6 flex items-center justify-center rounded-lg bg-emerald-600 text-white"><Plus className="h-3 w-3" /></button>
                                </div>
                              ) : (
                                <button onClick={() => addToCart(combo.id)} className="px-5 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20">ADD BUNDLE</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex bg-muted p-1 rounded-xl text-xs font-bold mb-4">
                <button onClick={() => setServiceFilter('all')} className={`flex-1 py-2 rounded-lg transition-all ${serviceFilter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>All Services</button>
                <button onClick={() => setServiceFilter('home')} className={`flex-1 py-2 rounded-lg transition-all ${serviceFilter === 'home' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Home Visit</button>
                <button onClick={() => setServiceFilter('24x7')} className={`flex-1 py-2 rounded-lg transition-all ${serviceFilter === '24x7' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>24x7 Emergency</button>
              </div>

              {servicesList.filter(s => serviceFilter === 'all' || s.serviceType === serviceFilter || s.serviceType === 'both').length === 0 ? (
                <p className="text-center text-sm font-semibold text-muted-foreground py-8">No services found for this filter.</p>
              ) : (
                servicesList.filter(s => serviceFilter === 'all' || s.serviceType === serviceFilter || s.serviceType === 'both').map((service, idx) => (
                  <div key={service.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="p-4" onClick={() => setExpandedPlan(expandedPlan === service.id ? null : service.id)}>
                      <div className="flex items-start justify-between gap-4 cursor-pointer">
                        <div className="flex flex-col sm:flex-row gap-4 flex-1">
                          {(service.image || "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=100&h=100&fit=crop") && (
                            <img src={service.image || "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=100&h=100&fit=crop"} alt={service.name} className="h-16 w-32 sm:h-20 sm:w-24 shrink-0 rounded-xl object-cover border border-border bg-muted shadow-sm" />
                          )}
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                              {service.name}
                              {service.serviceType !== 'home' && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-widest ${service.serviceType === '24x7' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>
                                  {service.serviceType}
                                </span>
                              )}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{service.duration}</span>
                              <span className="text-[10px] text-primary font-bold">{service.plans.length} Options</span>
                            </div>
                            {service.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{service.description}</p>}
                          </div>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedPlan === service.id ? "rotate-180" : ""}`} />
                      </div>
                    </div>

                    <AnimatePresence>
                      {(expandedPlan === service.id || servicesList.length === 1) && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border bg-muted/20">
                          {service.plans.map((plan, i) => (
                            <div key={plan.id} className={`p-4 flex items-center justify-between gap-4 ${i !== service.plans.length - 1 ? "border-b border-border/50" : ""}`}>
                              <div className="flex-1">
                                <h4 className="text-sm font-bold text-foreground">{plan.name}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">{plan.desc}</p>
                                <p className="text-sm font-black text-primary mt-1">₹{plan.price}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {cart[plan.id] ? (
                                  <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-1">
                                    <button onClick={() => removeFromCart(plan.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-background shadow-sm"><Minus className="h-3.5 w-3.5 text-primary" /></button>
                                    <span className="w-4 text-center text-sm font-bold">{cart[plan.id]}</span>
                                    <button onClick={() => addToCart(plan.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Plus className="h-3.5 w-3.5" /></button>
                                  </div>
                                ) : (
                                  <button onClick={() => addToCart(plan.id)} className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all">
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
            </motion.div>
          )}

          {tab === "reviews" && (
            <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
                <div className="text-center w-20">
                  <p className="text-4xl font-black text-foreground">{provider.rating}</p>
                  <div className="flex justify-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`h-3 w-3 ${s <= Math.round(provider.rating) ? "fill-amber-400 text-amber-400" : "text-border"}`} />)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{provider.reviews} ratings</p>
                </div>
                <div className="flex-1 space-y-1.5 border-l border-border pl-4">
                  {[5, 4, 3, 2, 1].map((n, i) => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold w-2">{n}</span><Star className="h-2 w-2 text-muted-foreground" />
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${100 - i * 20}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {fakeReviews.map(r => (
                  <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{r.user.substring(0, 2)}</div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{r.user}</p>
                          <p className="text-[10px] text-muted-foreground">{r.date}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(s => <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-border"}`} />)}</div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "about" && (
            <motion.div key="about" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-bold text-foreground mb-2">About Provider</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{provider.about}</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Previous Work</h3>
                <div className="grid grid-cols-2 gap-3">
                  {fakePortfolio.map(p => (
                    <div key={p.id} className="group relative rounded-2xl overflow-hidden aspect-video border border-border">
                      <img src={p.after} className="w-full h-full object-cover" alt="Portfolio" />
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest border border-white/50 px-2 py-1 rounded-full backdrop-blur-sm">After</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Cart Float */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-20 left-0 right-0 z-40 p-4 md:bottom-4 flex justify-center pointer-events-none">
            <div className="w-full max-w-2xl pointer-events-auto">
              <div className="flex w-full items-center justify-between rounded-2xl bg-foreground px-6 py-4 shadow-2xl shadow-black/20 group">
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-background/70">{cartCount} items selected</span>
                  <span className="text-lg font-black text-background">₹{cartTotal}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={!provider.isOnline}
                  className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all ${!provider.isOnline ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed' : 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95'}`}
                >
                  {!provider.isOnline ? 'Currently Offline' : 'Next'} <ArrowRight className="h-4 w-4" />
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
