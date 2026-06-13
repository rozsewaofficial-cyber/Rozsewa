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

const CategoryGrid = ({ showAll = true }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await API.get("/public/categories");
      if (data && data.length > 0) {
        setCategories(data);
      } else {
        setCategories(defaultCategories.map((c, i) => ({ ...c, _id: `def-${i}` })));
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setCategories(defaultCategories.map((c, i) => ({ ...c, _id: `def-${i}` })));
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
    { bg: "bg-white/10", icon: "text-emerald-400", shadow: "shadow-emerald-500/20" },
    { bg: "bg-white/10", icon: "text-blue-400", shadow: "shadow-blue-500/20" },
    { bg: "bg-white/10", icon: "text-pink-400", shadow: "shadow-pink-500/20" },
    { bg: "bg-white/10", icon: "text-amber-400", shadow: "shadow-amber-500/20" },
    { bg: "bg-white/10", icon: "text-violet-400", shadow: "shadow-violet-500/20" },
    { bg: "bg-white/10", icon: "text-rose-400", shadow: "shadow-rose-500/20" },
    { bg: "bg-white/10", icon: "text-cyan-400", shadow: "shadow-cyan-500/20" },
    { bg: "bg-white/10", icon: "text-orange-400", shadow: "shadow-orange-500/20" },
    { bg: "bg-white/10", icon: "text-indigo-400", shadow: "shadow-indigo-500/20" },
    { bg: "bg-white/10", icon: "text-teal-400", shadow: "shadow-teal-500/20" },
  ];

  const displayList = showAll ? categories : categories.slice(0, 10);

  if (loading) return (
    <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 gap-x-2 gap-y-6">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-3 animate-pulse">
          <div className="h-16 w-16 bg-white/5 rounded-2xl"></div>
          <div className="h-2 w-12 bg-white/5 rounded"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-8 sm:grid-cols-5 lg:grid-cols-10">
      {displayList.map((cat, i) => {
        const theme = themes[i % themes.length];
        return (
          <motion.button
            key={cat._id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02 }}
            whileHover={!cat.isComingSoon ? { y: -5 } : {}}
            whileTap={!cat.isComingSoon ? { scale: 0.95 } : {}}
            onClick={() => {
              if (!cat.isComingSoon) {
                navigate(`/shops?category=${encodeURIComponent(cat.name)}`);
              }
            }}
            className={`group flex flex-col items-center gap-2 ${cat.isComingSoon ? "cursor-not-allowed opacity-60 grayscale" : ""}`}
          >
            <div className={`
              relative flex h-16 w-16 items-center justify-center rounded-[1.75rem]
              ${cat.image ? "bg-white p-0.5" : `${theme.bg} border border-white/10`}
              transition-all duration-300 shadow-lg ${!cat.isComingSoon ? `group-hover:shadow-2xl ${theme.shadow} group-hover:scale-110` : ""}
              overflow-hidden backdrop-blur-md
            `}>
              {/* Gloss effect overlay */}
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-10" />

              {cat.isComingSoon && (
                <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center backdrop-blur-[1px]">
                  <span className="bg-red-600 text-white text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-xl -rotate-12">
                    Soon
                  </span>
                </div>
              )}

              {cat.image ? (
                <img src={cat.image} alt={cat.name} className={`h-full w-full object-cover rounded-[1.5rem] transition-transform duration-500 ${!cat.isComingSoon ? "group-hover:scale-110" : ""}`} />
              ) : (
                <div className={`${theme.icon} transition-transform duration-300 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] ${!cat.isComingSoon ? "group-hover:scale-125" : ""}`}>
                  {getIcon(cat.icon)}
                </div>
              )}
            </div>

            <span className={`text-[10px] font-black uppercase tracking-tight text-center leading-tight line-clamp-2 px-1 transition-colors ${cat.isComingSoon ? "text-white/50" : "text-white/80 group-hover:text-emerald-400"}`}>
              {cat.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default CategoryGrid;
