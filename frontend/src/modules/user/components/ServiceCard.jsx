import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, ArrowUpRight, Zap, Star, ShieldCheck } from "lucide-react";
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
      className="group relative h-44 w-full overflow-hidden rounded-3xl cursor-pointer"
    >
      <img src={image} alt={name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      
      {/* Top Gradient for icons */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

      {/* Favorite Button */}
      <button
        onClick={toggleFavorite}
        className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white transition-colors hover:bg-white hover:text-rose-500"
      >
        <Heart className={`h-4 w-4 ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`} />
      </button>

      {/* Verified Badge (Top Right) — the same real estate a duplicate,
          hover-only arrow used to sit in, which was redundant with the
          persistent arrow below and never showed on touch anyway. */}
      {verified && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white/90 dark:bg-slate-900/80 backdrop-blur-md px-2 py-1 shadow-sm">
          <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[9px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Verified</span>
        </div>
      )}

      {/* Bottom Frosted Info Box */}
      <div className="absolute inset-x-2 bottom-2 z-20 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-2 shadow-lg border border-white/40 dark:border-white/10 transition-transform duration-300 group-hover:-translate-y-1">
        <div className="pr-9">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1 min-w-0 text-[10px] font-bold text-slate-600 dark:text-slate-300">
              <Zap className="h-3 w-3 shrink-0 text-slate-500 dark:text-slate-400" />
              <span className="truncate">From ₹{price}</span>
            </div>
            {rating > 0 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-200">{Number(rating).toFixed(1)}</span>
                {reviews > 0 && <span className="text-[9px] font-medium text-slate-400">({reviews})</span>}
              </div>
            )}
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">{name}</h3>
          <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 truncate">{category}</p>
        </div>

        {/* Persistent Arrow button inside card bottom */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-slate-700 transition-colors group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
};

export default ServiceCard;
