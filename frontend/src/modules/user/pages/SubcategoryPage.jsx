import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Sparkles, Loader2, Layers, X, Grid, SlidersHorizontal,
  ChevronRight, Check
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import HierarchicalServiceCard from "@/modules/user/components/HierarchicalServiceCard";
import API from "@/lib/api";

const SubcategoryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get("categoryId") || "";
  const categoryName = searchParams.get("category") || "Category Services";
  const mode = searchParams.get("mode") || "partner";

  const [search, setSearch] = useState("");
  const [subFilterSearch, setSubFilterSearch] = useState("");
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [services, setServices] = useState([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  useEffect(() => {
    fetchSubcategories();
  }, [categoryId, categoryName]);

  useEffect(() => {
    if (showSubModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showSubModal]);

  const fetchSubcategories = async () => {
    setLoadingSubcategories(true);
    try {
      const param = categoryId || encodeURIComponent(categoryName);
      const { data } = await API.get(`/public/categories/${param}/subcategories`);
      if (Array.isArray(data)) {
        setSubcategories(data);
      } else {
        setSubcategories([]);
      }
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      setSubcategories([]);
    } finally {
      setLoadingSubcategories(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [categoryId, categoryName]);

  const fetchServices = async () => {
    setLoadingServices(true);
    try {
      const url = `/public/subcategories/all/services?categoryId=${categoryId}&category=${encodeURIComponent(categoryName)}&includeZeroPrice=true`;
      const { data } = await API.get(url);
      setServices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching services:", error);
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleBookNow = (service) => {
    navigate(`/shops?category=${encodeURIComponent(categoryName)}&serviceName=${encodeURIComponent(service.name)}&serviceId=${service._id || service.id}&mode=${mode}`);
  };

  // Smart subcategory matcher to handle acronyms (AC, RO, TV), brand variations, and descriptions
  // Helper to strip emojis and non-alphanumeric symbols
  const stripEmojis = (str) => {
    if (!str) return '';
    return str
      .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])/g, '')
      .replace(/[^\w\s&,/\\-]/gi, ' ')
      .trim();
  };

  // Smart subcategory matcher to handle acronyms, emojis, and descriptions
  const matchServiceToSubcategory = (service, sub) => {
    if (!service || !sub) return false;

    // 1. Direct ID Match — this is the authoritative admin-assigned mapping
    // (set via the admin "Add Service under Subcategory" flow). If a service
    // is explicitly tagged with a subcategoryId, trust it exclusively and
    // never fall through to fuzzy text matching — otherwise a service
    // correctly tagged to e.g. "Washing Machine" could still get grouped
    // into an unrelated "RO Water Purifier" section just because its name
    // shares a keyword, duplicating/misplacing it across sections.
    if (service.subcategoryId) {
      const sId = typeof service.subcategoryId === 'object' ? service.subcategoryId._id : service.subcategoryId;
      return !!(sId && (sId.toString() === sub._id?.toString() || sId.toString() === sub.id?.toString()));
    }

    // 2. Direct Subcategory Name Match (Stripped of emojis) — for legacy
    // services that only carry a free-text `subcategory` string instead of
    // a proper `subcategoryId` reference.
    const cleanSubName = stripEmojis(sub.name || '').toLowerCase();
    const cleanServiceSub = stripEmojis(service.subcategory || '').toLowerCase();

    if (cleanServiceSub) {
      if (cleanServiceSub === cleanSubName) return true;
      if (cleanServiceSub.includes(cleanSubName) || cleanSubName.includes(cleanServiceSub)) return true;
      // Has a subcategory string but it doesn't match this one — don't fall
      // through to fuzzy keyword matching against a subcategory it's already
      // explicitly (if loosely) assigned away from.
      return false;
    }

    // 3. Text Token Match (Name & Description against clean Subcategory tokens)
    const serviceText = `${service.name || ""} ${service.description || ""}`.toLowerCase();

    const rawParts = cleanSubName
      .replace(/[()]/g, ' ')
      .split(/[,&/\\-]+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const tokens = [];
    rawParts.forEach(part => {
      if (part.length > 1) tokens.push(part);
      const words = part.split(/\s+/).filter(w => w.length > 1);
      words.forEach(w => {
        if (!['service', 'services', 'repair', 'repairs', 'all', 'and', 'the', 'system', 'systems', 'water', 'care', 'pack', 'package', 'packages', 'styling', 'grooming'].includes(w)) {
          tokens.push(w);
        }
      });
    });

    // Industry Synonym/Keyword mappings
    if (cleanSubName.includes("makeup") || cleanSubName.includes("grooming")) {
      tokens.push("makeup", "draping", "outfit", "saree draping", "outfit draping", "bridal", "cosmetics", "face makeup", "beauty", "party makeup", "threading", "waxing", "bleach", "glow");
    }
    if (cleanSubName.includes("hair")) {
      tokens.push("hair", "haircut", "hair styling", "cut", "hair color", "highlights", "keratin", "hair spa", "blowdry", "hair trim", "smoothing", "straightening");
    }
    if (cleanSubName.includes("skin") || cleanSubName.includes("facial")) {
      tokens.push("skin", "facial", "cleanup", "bleach", "glow", "detan", "face", "scrub", "mask");
    }
    if (cleanSubName.includes("mehendi") || cleanSubName.includes("henna")) {
      tokens.push("mehendi", "henna", "arabic", "bridal mehendi");
    }
    if (cleanSubName.includes("hand") || cleanSubName.includes("foot") || cleanSubName.includes("pedicure") || cleanSubName.includes("manicure")) {
      tokens.push("hand", "foot", "pedicure", "manicure", "nail", "polish", "feet");
    }
    if (cleanSubName.includes("body") || cleanSubName.includes("spa") || cleanSubName.includes("massage")) {
      tokens.push("body", "spa", "massage", "scrub", "waxing", "detan", "therapy", "relax");
    }
    if (cleanSubName.includes("nail")) {
      tokens.push("nail", "extensions", "gel", "art", "acrylic", "polish");
    }
    if (cleanSubName.includes("beard") || cleanSubName.includes("shave") || cleanSubName.includes("mustache")) {
      tokens.push("beard", "shave", "mustache", "stubble", "beard styling", "mustache styling", "beard trim", "shaving");
    }
    if (cleanSubName.includes("air conditioner") || cleanSubName.includes("ac")) {
      tokens.push("ac", "air conditioner", "split ac", "window ac", "cassette ac", "ac gas", "ac service", "ac repair", "ac installation");
    }
    if (cleanSubName.includes("ro") || cleanSubName.includes("purifier")) {
      tokens.push("ro", "purifier", "water purifier", "filter");
    }
    if (cleanSubName.includes("television") || cleanSubName.includes("tv")) {
      tokens.push("tv", "television", "led", "lcd", "oled", "smart tv");
    }
    if (cleanSubName.includes("geyser") || cleanSubName.includes("water heater")) {
      tokens.push("geyser", "heater", "water heater");
    }
    if (cleanSubName.includes("refrigerator") || cleanSubName.includes("fridge")) {
      tokens.push("refrigerator", "fridge", "freezer", "single door", "double door");
    }
    if (cleanSubName.includes("washing machine") || cleanSubName.includes("washer")) {
      tokens.push("washing", "washer", "dryer", "laundry", "top load", "front load");
    }
    if (cleanSubName.includes("small") || cleanSubName.includes("appliance")) {
      tokens.push("small", "appliance", "appliances", "toaster", "mixer", "grinder", "iron", "kettle", "induction", "juicer", "blender", "sandwich", "fan", "heater", "stabilizer", "inverter");
    }
    if (cleanSubName.includes("cooler") || cleanSubName.includes("air cooler")) {
      tokens.push("cooler", "air cooler", "desert cooler", "personal cooler");
    }
    if (cleanSubName.includes("chimney")) {
      tokens.push("chimney", "kitchen chimney", "hood");
    }
    if (cleanSubName.includes("laptop") || cleanSubName.includes("computer")) {
      tokens.push("laptop", "computer", "pc", "desktop", "macbook", "ram", "software");
    }
    if (cleanSubName.includes("cctv") || cleanSubName.includes("camera") || cleanSubName.includes("security")) {
      tokens.push("cctv", "camera", "dvr", "nvr", "security", "surveillance");
    }

    // Helper to escape regex special characters
    const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Only match against serviceName, not description
    return tokens.some(token => {
      if (!token || token.length < 2) return false;
      const escapedToken = escapeRegex(token);
      const wordRegex = new RegExp(`\\b${escapedToken}\\b`, 'i');
      return wordRegex.test(serviceText);
    });
  };

  const filteredServices = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase();
    return services.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q)) ||
      (s.subcategory && s.subcategory.toLowerCase().includes(q))
    );
  }, [services, search]);

  // Compute count for each subcategory
  const subcategoryCounts = useMemo(() => {
    const counts = { all: services.length };
    subcategories.forEach(sub => {
      const count = services.filter(s => matchServiceToSubcategory(s, sub)).length;
      counts[sub._id] = count;
    });
    return counts;
  }, [services, subcategories]);

  // Group services by subcategory when "all" is selected
  const groupedSections = useMemo(() => {
    if (subcategories.length === 0) {
      return [{ id: "all", name: "All Services", services: filteredServices }];
    }

    const groups = [];
    const matchedServiceIds = new Set();

    subcategories.forEach(sub => {
      const matched = filteredServices.filter(s => matchServiceToSubcategory(s, sub));

      if (matched.length > 0) {
        matched.forEach(m => matchedServiceIds.add(m._id || m.name));
        groups.push({
          id: sub._id,
          name: sub.name,
          services: matched
        });
      }
    });

    const remaining = filteredServices.filter(s => !matchedServiceIds.has(s._id || s.name));
    if (remaining.length > 0) {
      groups.push({
        id: "other",
        name: "General Services",
        services: remaining
      });
    }

    return groups;
  }, [filteredServices, subcategories]);

  // Filtered subcategories for the sidebar search
  const filteredSubcategoriesForSidebar = useMemo(() => {
    if (!subFilterSearch.trim()) return subcategories;
    return subcategories.filter(sub => sub.name.toLowerCase().includes(subFilterSearch.toLowerCase()));
  }, [subcategories, subFilterSearch]);

  const activeSubcategoryObj = typeof selectedSubcategory === 'object' ? selectedSubcategory : subcategories.find(s => s._id === selectedSubcategory);

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950 pb-24 md:pb-12">
      <TopNav />

      {/* Header Banner */}
      <div className="relative pt-6 px-4 sm:px-8 bg-gradient-to-b from-emerald-950/10 via-emerald-500/5 to-transparent dark:from-emerald-950/50 dark:via-slate-900/60 dark:to-slate-950 border-b border-slate-200/60 dark:border-slate-800/80 pb-4 mb-3">
        <div className="max-w-7xl mx-auto flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (selectedSubcategory !== null) {
                    setSelectedSubcategory(null);
                  } else {
                    navigate(-1);
                  }
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 shadow-md shadow-slate-900/5 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50"
              >
                <ArrowLeft className="h-5 w-5" />
              </motion.button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    Local Expert Services
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {services.length} Services
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
                  {categoryName}
                </h1>
                {selectedSubcategory === null && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                      Choose a Subcategory
                    </h2>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">

          {/* DESKTOP SIDEBAR: Subcategories Filter */}
          <aside className="hidden lg:block lg:col-span-1 sticky top-24 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-900/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Subcategories</h2>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  {subcategories.length}
                </span>
              </div>

              {/* Subcategories Filter Input */}
              {subcategories.length > 5 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter subcategories..."
                    value={subFilterSearch}
                    onChange={(e) => setSubFilterSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-2 pl-9 pr-3 text-[11px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Subcategory List Buttons */}
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                {/* Subcategories Overview option */}
                <button
                  onClick={() => setSelectedSubcategory(null)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-black transition-all ${selectedSubcategory === null
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                      : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className={`h-4 w-4 ${selectedSubcategory === null ? "text-white" : "text-emerald-500"}`} />
                    <span>View Subcategories</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedSubcategory === null ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>
                    {subcategories.length}
                  </span>
                </button>

                {/* All Services option */}
                <button
                  onClick={() => setSelectedSubcategory("all")}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-black transition-all ${selectedSubcategory === "all"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                      : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Grid className={`h-4 w-4 ${selectedSubcategory === "all" ? "text-white" : "text-emerald-500"}`} />
                    <span>All Services</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedSubcategory === "all" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>
                    {services.length}
                  </span>
                </button>

                {/* Subcategories */}
                {filteredSubcategoriesForSidebar.map(sub => {
                  const isSelected = (selectedSubcategory === sub._id) || (typeof selectedSubcategory === 'object' && selectedSubcategory?._id === sub._id);
                  const count = subcategoryCounts[sub._id] || 0;

                  return (
                    <button
                      key={sub._id}
                      onClick={() => setSelectedSubcategory(sub._id)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all ${isSelected
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <Sparkles className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-white" : "text-emerald-500"}`} />
                        <span className="truncate text-left">{sub.name}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isSelected ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>


          {/* RIGHT MAIN CONTENT AREA: Grouped Services or Filtered Subcategory Services */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder={`Search for services in ${categoryName}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
              />
            </div>

            {loadingServices ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Loading services...</p>
              </div>
            ) : selectedSubcategory === null ? (
              // GRID OF SUBCATEGORIES
              <div className="space-y-4">
                <div className="flex flex-col gap-3">
                  {subcategories.length > 0 ? subcategories.map(sub => (
                    <button
                      key={sub._id}
                      onClick={() => setSelectedSubcategory(sub._id)}
                      className="flex items-center gap-4 bg-white dark:bg-[#151c2c] rounded-2xl border border-slate-200 dark:border-slate-800/80 p-3 transition-all hover:border-emerald-500/50 active:scale-[0.98] text-left w-full shadow-sm group"
                    >
                      <div className="h-12 w-16 bg-slate-50 dark:bg-[#1a2333] rounded-xl flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                        {sub.image ? (
                          <img src={sub.image} alt={sub.name} className="h-full w-full object-cover" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">{sub.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{sub.description || `${subcategoryCounts[sub._id] || 0} Services`}</p>
                      </div>
                      <div className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:border-emerald-500 transition-colors mr-1"></div>
                    </button>
                  )) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
                      <Layers className="w-12 h-12 mb-3 opacity-20" />
                      <p className="font-bold text-sm">No subcategories found.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedSubcategory === "all" ? (
              // ALL SERVICES MODE: Grouped by Subcategory Sections
              <div className="space-y-10">
                {groupedSections.length > 0 ? (
                  groupedSections.map((section) => (
                    <section key={section.id} id={`sub-${section.id}`} className="space-y-4">
                      {/* Section Header */}
                      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                            {section.name}
                          </h2>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 px-3 py-1 rounded-full">
                          {section.services.length} {section.services.length === 1 ? 'Service' : 'Services'}
                        </span>
                      </div>

                      {/* Section Services Grid */}
                      <div className="space-y-4">
                        {section.services.map((service) => (
                          <HierarchicalServiceCard
                            key={service._id}
                            service={service}
                            onBookNow={handleBookNow}
                          />
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
                    <Layers className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-base font-black text-slate-900 dark:text-white">No Services Found</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      {search ? `No services matching "${search}"` : "There are currently no listed services in this category."}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // SINGLE SUBCATEGORY MODE
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      {activeSubcategoryObj?.name || "Selected Subcategory"}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedSubcategory("all")}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    View All Categories <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Filter services for single subcategory */}
                {(() => {
                  const singleSubId = activeSubcategoryObj?._id || selectedSubcategory;
                  const singleSubName = activeSubcategoryObj?.name || "";

                  const singleSubServices = filteredServices.filter(s => matchServiceToSubcategory(s, activeSubcategoryObj || { _id: singleSubId, name: singleSubName }));

                  return singleSubServices.length > 0 ? (
                    <div className="space-y-4">
                      {singleSubServices.map((service) => (
                        <HierarchicalServiceCard
                          key={service._id}
                          service={service}
                          onBookNow={handleBookNow}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
                      <Layers className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
                      <p className="text-base font-black text-slate-900 dark:text-white">No Services Found</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs">
                        No listed services found under {singleSubName}. Tap "View All Categories" to see available options.
                      </p>
                      <button
                        onClick={() => setSelectedSubcategory("all")}
                        className="mt-4 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition-all"
                      >
                        Show All Services ({services.length})
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* MOBILE SUBCATEGORIES GRID MODAL */}
      <AnimatePresence>
        {showSubModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">All Subcategories</h3>
                  <p className="text-xs text-slate-500">Select a subcategory to filter services</p>
                </div>
                <button
                  onClick={() => setShowSubModal(false)}
                  className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="py-4 overflow-y-auto flex-1 grid grid-cols-2 gap-3 custom-scrollbar">
                <button
                  onClick={() => {
                    setSelectedSubcategory(null);
                    setShowSubModal(false);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${selectedSubcategory === null
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    }`}
                >
                  <Layers className="h-5 w-5 mb-2" />
                  <div>
                    <p className="text-xs font-black">Subcategories</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{subcategories.length} Categories</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setSelectedSubcategory("all");
                    setShowSubModal(false);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${selectedSubcategory === "all"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    }`}
                >
                  <Grid className="h-5 w-5 mb-2" />
                  <div>
                    <p className="text-xs font-black">All Services</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{services.length} Total Services</p>
                  </div>
                </button>

                {subcategories.map((sub) => {
                  const isSelected = selectedSubcategory === sub._id;
                  const count = subcategoryCounts[sub._id] || 0;
                  return (
                    <button
                      key={sub._id}
                      onClick={() => {
                        setSelectedSubcategory(sub._id);
                        setShowSubModal(false);
                      }}
                      className={`flex items-center gap-4 p-3 rounded-2xl border text-left transition-all active:scale-[0.98] w-full ${isSelected
                          ? "bg-emerald-50 dark:bg-[#151c2c] border-emerald-500"
                          : "bg-white dark:bg-[#151c2c] border-slate-200 dark:border-slate-800/80 hover:border-emerald-500/50"
                        }`}
                    >
                      <div className="h-12 w-16 bg-slate-50 dark:bg-[#1a2333] rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                        {sub.image ? (
                          <img src={sub.image} alt={sub.name} className="h-full w-full object-cover" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{sub.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sub.description || `${count} Services`}</p>
                      </div>
                      {isSelected ? (
                        <div className="shrink-0 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center mr-1">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      ) : (
                        <div className="shrink-0 h-5 w-5 rounded-full border border-slate-200 dark:border-slate-700 mr-1"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showSubModal && <BottomNav />}
    </div>
  );
};

export default SubcategoryPage;
