import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MapPin, BadgeCheck, Clock, Heart } from "lucide-react";
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
    e.stopPropagation(); // Prevent card click
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
      className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md flex flex-col relative"
    >
      {/* Image */}
      <div className="relative h-28 sm:h-40 shrink-0 overflow-hidden bg-muted">
        <img src={image} alt={name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        
        {/* Favorite Button */}
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={toggleFavorite}
          className={`absolute right-2 top-2 z-10 flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
            isFavorite ? "bg-rose-500 text-white shadow-lg" : "bg-black/20 text-white hover:bg-black/40"
          }`}
        >
          <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${isFavorite ? "fill-current" : ""}`} />
        </motion.button>

        {emergency && (
          <span className="absolute left-2 top-2 rounded-full bg-secondary px-2 py-0.5 text-[9px] sm:px-3 sm:py-1 sm:text-[10px] font-bold text-secondary-foreground shadow">
            24×7
          </span>
        )}
        
        {verified && (
          <span className={`absolute left-2 flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] sm:px-2.5 sm:py-1 sm:text-[10px] font-bold text-primary-foreground shadow ${emergency ? 'top-8 sm:top-10' : 'top-2'}`}>
            <BadgeCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> <span className="hidden sm:inline">Verified</span>
          </span>
        )}
      </div>
      {/* Info */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <h3 className="text-xs sm:text-sm font-bold text-card-foreground truncate">{name}</h3>
        <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground truncate">{category}</p>
        <div className="mt-1.5 sm:mt-3 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-secondary text-secondary" />
            <span className="text-[10px] sm:text-xs font-bold text-card-foreground">{rating}</span>
            <span className="text-[9px] sm:text-xs text-muted-foreground">({reviews})</span>
          </div>
          <div className="flex items-center gap-0.5 text-[9px] sm:text-xs text-muted-foreground truncate">
            <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" /> <span className="truncate">{distance}</span>
          </div>
        </div>
        <div className="mt-auto pt-1.5 sm:pt-2 flex items-center justify-between">
          <span className="text-xs sm:text-sm font-bold text-primary">₹{price}</span>
          <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] text-muted-foreground shrink-0">
            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> 30 min
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default ServiceCard;
