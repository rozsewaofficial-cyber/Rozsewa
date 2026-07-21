import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { useNavigate } from "react-router-dom";
import API from "@/lib/api";

const defaultCategories = [
  { name: "Salon", icon: "Scissors", color: "bg-pink-50 text-pink-600" },
  { name: "AC Repair", icon: "Wrench", color: "bg-blue-50 text-blue-600" },
  { name: "Electrician", icon: "Zap", color: "bg-yellow-50 text-yellow-700" },
  { name: "Plumber", icon: "Droplets", color: "bg-cyan-50 text-cyan-600" },
  { name: "Painter", icon: "Paintbrush", color: "bg-purple-50 text-purple-600" },
  { name: "Home Maint.", icon: "Home", color: "bg-green-50 text-green-600" },
  { name: "Medical", icon: "Stethoscope", color: "bg-red-50 text-red-600" },
  { name: "Mechanic", icon: "Car", color: "bg-orange-50 text-orange-600" },
  { name: "Decoration", icon: "Flower2", color: "bg-rose-50 text-rose-600" },
  { name: "Pandit", icon: "BookOpen", color: "bg-amber-50 text-amber-700" },
];

const CategoryGrid = ({ showAll = true, mode = "partner", searchQuery = "" }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await API.get("/public/categories");
      if (data && Array.isArray(data)) {
        setCategories(data);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName) => {
    // Dynamically get Lucide icon or fallback to Layers
    const Icon = LucideIcons[iconName] || LucideIcons.Layers;
    return <Icon className="h-6 w-6" />;
  };

  // Premium Glass Palette for Dark Theme
  const themes = [
    { bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "text-emerald-400", shadow: "shadow-emerald-500/20" },
    { bg: "bg-blue-500/10", border: "border-blue-500/20", icon: "text-blue-400", shadow: "shadow-blue-500/20" },
    { bg: "bg-pink-500/10", border: "border-pink-500/20", icon: "text-pink-400", shadow: "shadow-pink-500/20" },
    { bg: "bg-amber-500/10", border: "border-amber-500/20", icon: "text-amber-400", shadow: "shadow-amber-500/20" },
    { bg: "bg-violet-500/10", border: "border-violet-500/20", icon: "text-violet-400", shadow: "shadow-violet-500/20" },
    { bg: "bg-rose-500/10", border: "border-rose-500/20", icon: "text-rose-400", shadow: "shadow-rose-500/20" },
    { bg: "bg-cyan-500/10", border: "border-cyan-500/20", icon: "text-cyan-400", shadow: "shadow-cyan-500/20" },
    { bg: "bg-orange-500/10", border: "border-orange-500/20", icon: "text-orange-400", shadow: "shadow-orange-500/20" },
    { bg: "bg-indigo-500/10", border: "border-indigo-500/20", icon: "text-indigo-400", shadow: "shadow-indigo-500/20" },
    { bg: "bg-teal-500/10", border: "border-teal-500/20", icon: "text-teal-400", shadow: "shadow-teal-500/20" },
  ];

  const filteredCategories = categories.filter(cat => 
    !searchQuery || cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayList = showAll ? filteredCategories : filteredCategories.slice(0, 6);

  if (loading) return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 pb-4 items-stretch">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 w-full">
          <div className="w-[85%] aspect-square bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse mx-auto"></div>
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse mt-1"></div>
        </div>
      ))}
    </div>
  );

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
          <LucideIcons.Layers className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No services available yet</p>
        <p className="text-xs text-slate-500 mt-1">Check back later for new updates.</p>
      </div>
    );
  }

  const renderCategory = (cat, i, isGrid = true) => {
    return (
      <motion.button
        key={cat._id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        whileTap={!cat.isComingSoon ? { scale: 0.95 } : {}}
        onClick={() => {
          if (!cat.isComingSoon) {
            if (cat.businessModel === 'lead') {
              navigate(`/submit-lead?category=${cat._id}&name=${encodeURIComponent(cat.name)}`);
            } else if (mode === "sewak") {
              navigate(`/sewak-services?category=${encodeURIComponent(cat.name)}`);
            } else {
              navigate(`/subcategory?categoryId=${cat._id}&category=${encodeURIComponent(cat.name)}&mode=partner`);
            }
          }
        }}
        className={`group flex flex-col items-center text-center w-full h-full bg-white dark:bg-slate-900 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-none border border-slate-100 dark:border-slate-800 p-2 sm:p-3 transition-all ${cat.isComingSoon ? "cursor-not-allowed opacity-60 grayscale" : "hover:shadow-md hover:border-slate-200"}`}
      >
        <div className={`relative flex items-center justify-center w-[90%] sm:w-[85%] aspect-square rounded-full bg-[#006e33] dark:bg-emerald-800 mb-2 sm:mb-3 transition-transform duration-300 group-hover:scale-105 mx-auto overflow-hidden shrink-0`}>
          {cat.image ? (
            <img src={cat.image} alt={cat.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className={`[&>svg]:w-7 [&>svg]:h-7 text-white relative z-10`}>
              {getIcon(cat.icon)}
            </div>
          )}
        </div>

        <div className={`flex-1 flex items-center justify-center w-full px-1 pb-1`}>
          <span className={`text-[11px] sm:text-[12px] font-semibold leading-[1.2] line-clamp-3 ${cat.isComingSoon ? "text-slate-500" : "text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white"}`}>
            {cat.name}
          </span>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 pb-4 items-stretch">
      {displayList.map((cat, i) => (
        <div className="flex w-full h-full" key={cat._id}>
          {renderCategory(cat, i, true)}
        </div>
      ))}
    </div>
  );
};

export default CategoryGrid;
