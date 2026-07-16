import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Search, Wrench, Zap, Droplets, Paintbrush, Scissors, Stethoscope, Home, Sparkles, Car, BookOpen } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";

const defaultSubcategories = {
  "AC Repair": [
    { name: "AC Servicing", desc: "Deep cleaning & gas check", price: "₹349", time: "1 hr", icon: Wrench },
    { name: "AC Gas Refill", desc: "R22/R32/R410 gas top-up", price: "₹1,499", time: "1.5 hrs", icon: Wrench },
    { name: "AC Installation", desc: "Split/window AC mounting", price: "₹999", time: "2 hrs", icon: Wrench },
    { name: "AC Uninstallation", desc: "Safe removal & packing", price: "₹599", time: "1 hr", icon: Wrench },
    { name: "AC Repair", desc: "PCB, compressor, fan fix", price: "₹499", time: "1-2 hrs", icon: Wrench },
  ],
  "Electrician": [
    { name: "Wiring & Cabling", desc: "New wiring or repair", price: "₹299", time: "1 hr", icon: Zap },
    { name: "Switch & Socket", desc: "Install/replace switches", price: "₹149", time: "30 min", icon: Zap },
    { name: "Fan Installation", desc: "Ceiling/exhaust fan fitting", price: "₹249", time: "45 min", icon: Zap },
    { name: "MCB/DB Repair", desc: "Circuit breaker fixes", price: "₹399", time: "1 hr", icon: Zap },
    { name: "Inverter Setup", desc: "Install battery & inverter", price: "₹599", time: "2 hrs", icon: Zap },
  ],
  "Plumber": [
    { name: "Tap Repair", desc: "Fix leaky/jammed taps", price: "₹149", time: "30 min", icon: Droplets },
    { name: "Pipe Fitting", desc: "New pipe installation", price: "₹299", time: "1 hr", icon: Droplets },
    { name: "Toilet Repair", desc: "Flush, seat, blockage fix", price: "₹249", time: "45 min", icon: Droplets },
    { name: "Water Tank", desc: "Tank cleaning & repair", price: "₹499", time: "2 hrs", icon: Droplets },
    { name: "Drainage", desc: "Drain cleaning & unclog", price: "₹349", time: "1 hr", icon: Droplets },
  ],
  "Salon": [
    { name: "Haircut", desc: "Men/Women styling & cut", price: "₹149", time: "30 min", icon: Scissors },
    { name: "Beard Trim", desc: "Shaping & grooming", price: "₹99", time: "15 min", icon: Scissors },
    { name: "Facial", desc: "Deep cleansing facial", price: "₹499", time: "45 min", icon: Scissors },
    { name: "Hair Color", desc: "Full/streak coloring", price: "₹799", time: "1.5 hrs", icon: Scissors },
    { name: "Spa & Massage", desc: "Head/body massage", price: "₹599", time: "1 hr", icon: Scissors },
  ],
  "Painter": [
    { name: "Interior Painting", desc: "Walls & ceiling", price: "₹12/sqft", time: "1-3 days", icon: Paintbrush },
    { name: "Exterior Painting", desc: "Weatherproof coating", price: "₹15/sqft", time: "2-5 days", icon: Paintbrush },
    { name: "Waterproofing", desc: "Terrace & wall treatment", price: "₹18/sqft", time: "1-2 days", icon: Paintbrush },
    { name: "Wood Polish", desc: "Door, furniture polish", price: "₹999", time: "1 day", icon: Paintbrush },
    { name: "Texture Painting", desc: "Designer wall textures", price: "₹25/sqft", time: "2-3 days", icon: Paintbrush },
  ],
  "Medical": [
    { name: "General Consultation", desc: "Doctor visit at home", price: "₹499", time: "30 min", icon: Stethoscope },
    { name: "Blood Test", desc: "Sample collection at home", price: "₹299", time: "15 min", icon: Stethoscope },
    { name: "Physiotherapy", desc: "Session at home", price: "₹699", time: "45 min", icon: Stethoscope },
    { name: "Nursing Care", desc: "Post-surgery care", price: "₹999/day", time: "Full day", icon: Stethoscope },
  ],
  "Cleaning": [
    { name: "Full Home Cleaning", desc: "Deep clean all rooms", price: "₹1,999", time: "3-4 hrs", icon: Sparkles },
    { name: "Kitchen Cleaning", desc: "Chimney, slab, sink", price: "₹799", time: "1.5 hrs", icon: Sparkles },
    { name: "Bathroom Cleaning", desc: "Tile, grout, fixtures", price: "₹499", time: "1 hr", icon: Sparkles },
    { name: "Sofa/Carpet Cleaning", desc: "Shampooing & vacuuming", price: "₹599", time: "1.5 hrs", icon: Sparkles },
    { name: "Pest Control", desc: "Cockroach, termite, bed bugs", price: "₹999", time: "2 hrs", icon: Sparkles },
  ],
};

import API from "@/lib/api";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const SubcategoryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryName = searchParams.get("category") || "";
  const [search, setSearch] = useState("");
  const [categoryData, setCategoryData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (categoryName) fetchCategoryDetails();
  }, [categoryName]);

  const fetchCategoryDetails = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/public/categories/${encodeURIComponent(categoryName)}`);
      setCategoryData(data);
    } catch (error) {
      console.error("Error fetching category:", error);
    } finally {
      setLoading(false);
    }
  };

  const services = categoryData?.services || [];
  const filtered = search ? services.filter(s => s.name.toLowerCase().includes(search.toLowerCase())) : services;

  if (loading) {
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-0">
      <TopNav />
      
      {/* Gradient Header */}
      <div className="relative pt-6 pb-12 px-5 sm:px-8 bg-gradient-to-b from-[#e0f2fe] via-[#f0f9ff] to-slate-50 dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-950 rounded-b-[3rem] shadow-sm mb-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{categoryName}</h1>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{filtered.length} services available</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder={`Search in ${categoryName}...`} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border-none bg-white dark:bg-slate-800 py-3.5 pl-12 pr-4 text-[13px] font-bold text-slate-900 dark:text-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 space-y-6">

        {/* Services Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((sub, i) => {
            return (
              <motion.button key={sub._id || sub.name}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/shops?category=${categoryName}&search=${encodeURIComponent(sub.name)}`)}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/20 group">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground truncate">{sub.name}</h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{sub.description || "Expert service at your doorstep"}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-bold text-primary">₹{sub.basePrice || "199"}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">30-60 min</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all shrink-0" />
              </motion.button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No services found for "{search}"</p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default SubcategoryPage;
