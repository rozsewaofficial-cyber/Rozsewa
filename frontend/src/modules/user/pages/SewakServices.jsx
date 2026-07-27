import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Plus, Minus, Package, Activity, Info, Briefcase, Search } from "lucide-react";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import API from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const SewakServices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const categoryName = searchParams.get("category");
  
  const [categoryData, setCategoryData] = useState(null);
  const [servicesList, setServicesList] = useState([]);
  const [combosList, setCombosList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [cart, setCart] = useState(() => {
    try {
      const category = new URLSearchParams(window.location.search).get("category");
      const savedCart = localStorage.getItem(`rozsewa_cart_sewak_${category}`);
      if (savedCart) return JSON.parse(savedCart);
    } catch {}
    try {
      const category = new URLSearchParams(window.location.search).get("category");
      const checkoutData = localStorage.getItem("rozsewa_checkout_data");
      if (checkoutData) {
        const parsed = JSON.parse(checkoutData);
        if (parsed.category === category && parsed.items) {
          const initialCart = {};
          parsed.items.forEach(item => {
            initialCart[item.id] = item.qty;
          });
          return initialCart;
        }
      }
    } catch {}
    return {};
  });

  useEffect(() => {
    if (categoryName) {
      if (Object.keys(cart).length > 0) {
        localStorage.setItem(`rozsewa_cart_sewak_${categoryName}`, JSON.stringify(cart));
      } else {
        localStorage.removeItem(`rozsewa_cart_sewak_${categoryName}`);
      }
    }
  }, [cart, categoryName]);

  const fetchData = useCallback(async () => {
    if (!categoryName) return navigate("/");
    
    setLoading(true);
    try {
      const { data } = await API.get(`/public/categories/${encodeURIComponent(categoryName)}`);
      setCategoryData(data);
      
      if (data.services) {
        setServicesList(data.services.filter(s => Number(s.basePrice || s.price) > 0).map(s => ({
          id: s._id,
          name: s.name,
          price: s.basePrice || s.price,
          description: s.description,
          image: s.image,
          duration: "Varies"
        })));
      }

      if (data.combos) {
        setCombosList(data.combos.map(c => ({
          id: c._id,
          name: c.name,
          description: c.description,
          price: c.sewakPrice,
          image: c.image,
          services: c.services
        })));
      }

      try {
        const subRes = await API.get(`/public/categories/${encodeURIComponent(categoryName)}/subcategories`);
        if (Array.isArray(subRes.data)) {
          setSubcategories(subRes.data);
        }
      } catch (e) {
        console.error("Failed to load subcategories", e);
      }
    } catch (error) {
      console.error("Error loading category details:", error);
      toast({ title: "Error", description: "Failed to load category details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [categoryName, navigate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    const s = servicesList.find(s => s.id === planId);
    if (s) return { serviceName: s.name, planName: "Standard Rate", price: s.price, duration: s.duration, expressPrice: 0 };
    
    const combo = combosList.find(c => c.id === planId);
    if (combo) return { serviceName: combo.name, planName: "Combo Offer", price: combo.price, duration: "Varries", expressPrice: 0 };
    return null;
  };

  const matchServiceToSubcategory = (service, sub) => {
    if (!service || !sub) return false;
    if (service.subcategoryId) {
      const sId = typeof service.subcategoryId === 'object' ? service.subcategoryId._id : service.subcategoryId;
      if (sId && (sId.toString() === sub._id?.toString() || sId.toString() === sub.id?.toString())) return true;
    }
    const subNameLower = (sub.name || "").toLowerCase().trim();
    const serviceSubLower = (service.subcategory || "").toLowerCase().trim();
    if (serviceSubLower) {
      if (serviceSubLower === subNameLower) return true;
      if (serviceSubLower.includes(subNameLower) || subNameLower.includes(serviceSubLower)) return true;
    }
    const serviceText = `${service.name || ""} ${service.description || ""}`.toLowerCase();
    const rawParts = subNameLower.replace(/[()]/g, ' ').split(/[,&/\\-]+/).map(p => p.trim()).filter(p => p.length > 0);
    const tokens = [];
    rawParts.forEach(part => {
      tokens.push(part);
      const words = part.split(/\s+/).filter(w => w.length > 1);
      words.forEach(w => {
        if (!['service', 'services', 'repair', 'repairs', 'all', 'and', 'the', 'system', 'systems', 'water'].includes(w)) {
          tokens.push(w);
        }
      });
    });
    if (subNameLower.includes("air conditioner") || subNameLower.includes("ac")) tokens.push("ac", "air conditioner", "split ac", "window ac", "cassette ac");
    if (subNameLower.includes("ro") || subNameLower.includes("purifier")) tokens.push("ro", "purifier", "water purifier", "filter");
    if (subNameLower.includes("television") || subNameLower.includes("tv")) tokens.push("tv", "television", "led", "lcd", "oled", "smart tv");
    if (subNameLower.includes("geyser") || subNameLower.includes("water heater")) tokens.push("geyser", "heater", "water heater");
    if (subNameLower.includes("refrigerator") || subNameLower.includes("fridge")) tokens.push("refrigerator", "fridge", "freezer", "single door", "double door");
    if (subNameLower.includes("washing machine") || subNameLower.includes("washer")) tokens.push("washing", "washer", "dryer", "laundry", "top load", "front load");
    if (subNameLower.includes("chimney")) tokens.push("chimney", "kitchen chimney", "hood");
    if (subNameLower.includes("microwave") || subNameLower.includes("oven")) tokens.push("microwave", "oven", "otg", "toaster", "griller");
    if (subNameLower.includes("cctv") || subNameLower.includes("security")) tokens.push("cctv", "camera", "dvr", "nvr", "security");
    if (subNameLower.includes("small appliance") || subNameLower.includes("small")) tokens.push("mixer", "grinder", "iron", "kettle", "induction", "juicer", "blender", "sandwich", "fan", "heata");

    return tokens.some(token => {
      if (token.length <= 2) {
        const wordRegex = new RegExp(`\\b${token}\\b`, 'i');
        return wordRegex.test(serviceText);
      }
      return serviceText.includes(token);
    });
  };

  const activeSubObj = selectedSubcategory === 'all' ? null : subcategories.find(s => s._id === selectedSubcategory);

  const filteredServices = (selectedSubcategory === 'all' 
    ? servicesList 
    : servicesList.filter(s => matchServiceToSubcategory(s, activeSubObj || { _id: selectedSubcategory, name: selectedSubcategory })))
    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase())));

  const filteredCombos = (selectedSubcategory === 'all'
    ? combosList
    : combosList.filter(c => matchServiceToSubcategory(c, activeSubObj || { _id: selectedSubcategory, name: selectedSubcategory })))
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase())));

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = getPlanDetails(id);
    return sum + (p?.price || 0) * qty;
  }, 0);

  const handleCheckout = () => {
    const items = Object.entries(cart).map(([id, qty]) => {
      const d = getPlanDetails(id);
      return { id, name: `${d.serviceName} (${d.planName})`, price: d.price, qty, duration: d.duration, expressPrice: d.expressPrice };
    });
    
    localStorage.setItem("rozsewa_checkout_data", JSON.stringify({
      providerId: null,
      requiredProviderCategory: "sewak",
      serviceId: items[0]?.id || "DEMO-ID",
      shopName: "Sewak Broadcast",
      category: categoryName,
      items,
      expressPrice: 0,
      total: cartTotal
    }));
    navigate("/checkout");
  };

  if (loading || !categoryData) {
    return (
      <div className="min-h-screen flex flex-col pt-16">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 md:pb-0 font-sans">
      <TopNav />
      
      {/* Header */}
      <div className="relative pt-6 pb-10 px-5 sm:px-8 bg-gradient-to-b from-blue-50 to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-sm mb-6 rounded-b-[3rem]">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                 Sewak Services
              </h1>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{categoryName}</p>
            </div>
          </div>

          <div className="bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-4 flex gap-3">
             <div className="mt-0.5 shrink-0"><Info className="h-5 w-5 text-blue-600" /></div>
             <p className="text-[13px] text-slate-700 dark:text-slate-300 font-medium">
               Select your services below. Your request will be broadcasted to nearby Sewaks. The first to accept will be assigned to you at these fixed platform rates.
             </p>
          </div>
        </div>
      </div>

      <main className="container max-w-3xl px-4 sm:px-6 pt-2 pb-36 space-y-6">

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder={`Search for services in ${categoryName}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
          />
        </div>

        {selectedSubcategory === null ? (
          // SUBCATEGORY GRID
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
              <Briefcase className="h-4 w-4 text-blue-500" /> Choose a Subcategory
            </h2>
            <div className="flex flex-col gap-3">
              {subcategories.length > 0 ? subcategories.map(sub => (
                <button
                  key={sub._id}
                  onClick={() => setSelectedSubcategory(sub._id)}
                  className="flex items-center gap-4 bg-white dark:bg-[#151c2c] rounded-2xl border border-slate-200 dark:border-slate-800/80 p-3 transition-all hover:border-blue-500/50 active:scale-[0.98] text-left w-full shadow-sm group"
                >
                  <div className="h-12 w-16 bg-blue-50 dark:bg-[#1a2333] rounded-xl flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                    {sub.image ? (
                        <img src={sub.image} alt={sub.name} className="h-full w-full object-cover" />
                    ) : (
                        <Briefcase className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">{sub.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{sub.description || `View Services`}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:border-blue-500 transition-colors mr-1"></div>
                </button>
              )) : (
                <button
                  onClick={() => setSelectedSubcategory('all')}
                  className="flex items-center gap-4 bg-white dark:bg-[#151c2c] rounded-2xl border border-slate-200 dark:border-slate-800/80 p-3 transition-all hover:border-blue-500/50 active:scale-[0.98] text-left w-full shadow-sm group"
                >
                  <div className="h-12 w-16 bg-blue-50 dark:bg-[#1a2333] rounded-xl flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                    <Briefcase className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">View All Services</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">Browse all available services</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:border-blue-500 transition-colors mr-1"></div>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <button 
              onClick={() => setSelectedSubcategory(null)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mb-2"
            >
               <ArrowLeft className="h-3.5 w-3.5" /> Back to Subcategories
            </button>

            {/* Combos Section */}
            {filteredCombos.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest"><Package className="h-4 w-4 text-blue-500" /> Discounted Combos</h2>
                <div className="grid grid-cols-1 gap-3">
                  {filteredCombos.map((combo) => (
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
                  
                  <div className="px-4 pb-3.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Fixed Rate</p>
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
        {filteredServices.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-widest"><Briefcase className="h-4 w-4 text-blue-500" /> Individual Services</h2>

            <div className="grid grid-cols-1 gap-3">
              {filteredServices.map((service) => (
                <div key={service.id} className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm transition-all hover:border-blue-500/30">
                  <div className="p-4 flex flex-row items-center justify-between gap-4">
                    {service.image && (
                      <div className="h-16 w-16 shrink-0 rounded-[12px] overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <img src={service.image} className="h-full w-full object-cover" alt={service.name} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-bold text-slate-900 dark:text-white truncate">{service.name}</h4>
                      {service.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{service.description}</p>}
                      <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-1">₹{service.price}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {cart[service.id] ? (
                        <div className="flex items-center gap-2 rounded-xl border border-blue-500 bg-blue-50 dark:bg-blue-900/30 p-1 shadow-sm">
                          <button onClick={() => removeFromCart(service.id)} className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-4 text-center text-[12px] font-bold text-slate-900 dark:text-white">{cart[service.id]}</span>
                          <button onClick={() => addToCart(service.id)} className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-blue-600 text-white shadow-sm"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(service.id)} className="rounded-[10px] border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-5 py-2 text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                          ADD
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredServices.length === 0 && filteredCombos.length === 0 && (
          <p className="text-center text-sm font-medium text-slate-500 py-10 bg-slate-50 dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800">No services available for this category.</p>
        )}
        </div>
        )}

      </main>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-8 sm:p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
            <div className="container max-w-2xl mx-auto flex items-center justify-between rounded-[20px] bg-slate-900 dark:bg-slate-800 p-3 shadow-xl">
              <div className="pl-3 text-white">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{cartCount} items</p>
                <p className="text-lg font-black leading-tight">₹{cartTotal}</p>
              </div>
              <button onClick={handleCheckout} className="rounded-[14px] bg-blue-600 px-6 py-3 text-[13px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 active:scale-95">
                Continue
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!cartCount && <BottomNav />}
    </div>
  );
};

export default SewakServices;
