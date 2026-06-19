import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, ArrowUpRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const ServiceCard = ({ id, name, category, rating, reviews, distance, price, image, verified, emergency }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (user?.favorites) {
      setIsFavorite(user.favorites.includes(id));
    }
  }, [user, id]);

  const toggleFavorite = async (e) => {
    e.stopPropagation();
    if (!user) {
      alert("Please login to add favorites");
      return;
    }

    try {
      if (isFavorite) {
        await API.delete(`/auth/favorites/${id}`);
        setIsFavorite(false);
      } else {
        await API.post("/auth/favorites", { providerId: id });
        setIsFavorite(true);
      }
    } catch (error) {
      console.error("Failed to update favorite", error);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/shop/${id}`)}
      className="group relative h-52 w-full overflow-hidden rounded-3xl cursor-pointer"
    >
      <img src={image} alt={name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      
      {/* Top Gradient for icons */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

      {/* Favorite Button */}
      <button
        onClick={toggleFavorite}
        className="absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white transition-colors hover:bg-white hover:text-rose-500"
      >
        <Heart className={`h-4 w-4 ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`} />
      </button>

      {/* Action Arrow (Top Right) */}
      <div className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900 opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-lg">
        <ArrowUpRight className="h-4 w-4" />
      </div>

      {/* Bottom Frosted Info Box */}
      <div className="absolute inset-x-2 bottom-2 z-20 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg p-3 shadow-lg border border-white/40 dark:border-white/10 transition-transform duration-300 group-hover:-translate-y-1">
        <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <Zap className="h-3 w-3 text-slate-500 dark:text-slate-400" />
            <span>From ₹{price}</span>
          </div>
          <span className="text-slate-400/50">•</span>
          <span className="text-blue-600 dark:text-blue-400 truncate max-w-[80px]">{category}</span>
        </div>
        <h3 className="text-sm font-black text-slate-900 dark:text-white truncate pr-6">{name}</h3>
        
        {/* Persistent Arrow button inside card bottom */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-slate-700">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
};

export default ServiceCard;
