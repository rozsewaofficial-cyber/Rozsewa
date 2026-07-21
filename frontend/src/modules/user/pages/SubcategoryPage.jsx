import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Search, Sparkles, Loader2, ChevronRight, Layers } from "lucide-react";
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
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [services, setServices] = useState([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);

  useEffect(() => {
    fetchSubcategories();
  }, [categoryId, categoryName]);

  const fetchSubcategories = async () => {
    setLoadingSubcategories(true);
    try {
      const param = categoryId || encodeURIComponent(categoryName);
      const { data } = await API.get(`/public/categories/${param}/subcategories`);
      if (Array.isArray(data) && data.length > 0) {
        setSubcategories(data);
        setSelectedSubcategory(data[0]);
      } else {
        setSubcategories([]);
        setSelectedSubcategory(null);
      }
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      setSubcategories([]);
    } finally {
      setLoadingSubcategories(false);
    }
  };

  useEffect(() => {
    if (selectedSubcategory?._id) {
      fetchServices(selectedSubcategory._id);
    } else {
      setServices([]);
    }
  }, [selectedSubcategory]);

  const fetchServices = async (subId) => {
    setLoadingServices(true);
    try {
      const { data } = await API.get(`/public/subcategories/${subId}/services`);
      setServices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching services:", error);
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleBookNow = (service) => {
    navigate(`/shops?category=${encodeURIComponent(categoryName)}&search=${encodeURIComponent(service.name)}&mode=${mode}`);
  };

  const filteredServices = search
    ? services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.description && s.description.toLowerCase().includes(search.toLowerCase())))
    : services;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-8">
      <TopNav />

      {/* Header Banner */}
      <div className="relative pt-6 pb-8 px-5 sm:px-8 bg-gradient-to-b from-[#e0f2fe] via-[#f0f9ff] to-slate-50 dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-950 rounded-b-[2.5rem] shadow-sm mb-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Partner Services</span>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white truncate">{categoryName}</h1>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search services in ${categoryName}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border-none bg-white dark:bg-slate-800 py-3.5 pl-12 pr-4 text-xs font-bold text-slate-900 dark:text-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 space-y-6">

        {/* Subcategories Horizontal Filter Bar */}
        {loadingSubcategories ? (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse shrink-0"></div>
            ))}
          </div>
        ) : subcategories.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Subcategory</h2>
              <span className="text-[11px] text-slate-500">{subcategories.length} available</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {subcategories.map((sub) => {
                const isSelected = selectedSubcategory?._id === sub._id;
                return (
                  <button
                    key={sub._id}
                    onClick={() => setSelectedSubcategory(sub)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${isSelected ? "text-white" : "text-emerald-500"}`} />
                    <span>{sub.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 text-center">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">No subcategories created yet for {categoryName}.</p>
          </div>
        )}

        {/* Services List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {selectedSubcategory ? selectedSubcategory.name : "Available Services"}
            </h2>
            <span className="text-xs text-slate-500">{filteredServices.length} Services</span>
          </div>

          {loadingServices ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
              <p className="text-xs text-slate-500">Loading services...</p>
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="space-y-4">
              {filteredServices.map((service) => (
                <HierarchicalServiceCard
                  key={service._id}
                  service={service}
                  onBookNow={handleBookNow}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <Layers className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No services found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                {search ? `No results matching "${search}"` : "There are currently no listed services in this subcategory."}
              </p>
            </div>
          )}
        </div>

      </main>

      <BottomNav />
    </div>
  );
};

export default SubcategoryPage;
