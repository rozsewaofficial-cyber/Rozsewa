import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, Star, MapPin, ChevronRight, MessageCircle, Phone, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

// Dummy data for visual representation - In a real app we'd fetch actual provider details
const dummyProviders = [
  { id: "65f1234567890abcdef00001", name: "CoolTech Services", category: "AC Repair", rating: 4.6, reviews: 189, distance: "2.5 km", price: "349", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop", verified: true },
  { id: "65f1234567890abcdef00002", name: "Royal Men's Salon", category: "Salon", rating: 4.8, reviews: 312, distance: "1.2 km", price: "199", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=300&fit=crop", verified: true },
];

const Favorites = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const { data } = await API.get("/auth/favorites");
        setFavorites(data);
      } catch (err) {
        console.error("Failed to fetch favorites", err);
      }
    };
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const removeFavorite = async (id) => {
    try {
      await API.delete(`/auth/favorites/${id}`);
      setFavorites(favorites.filter(f => f.id !== id));
      toast({ title: "Removed from favorites" });
    } catch (err) {
      toast({ title: "Operation failed", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-28 md:pb-0 font-sans">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none">My Favorites</h1>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Saved Providers</p>
          </div>
        </div>

        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-rose-500/20 blur-2xl rounded-full"></div>
              <div className="relative h-24 w-24 rounded-[32px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl flex items-center justify-center">
                <Heart className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">No favorites yet</h3>
            <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 mt-2 max-w-[250px]">Save your favorite service providers to find them easily here.</p>
            <button onClick={() => navigate("/shops")} className="mt-8 rounded-full bg-blue-600 px-8 py-3.5 text-[14px] font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95">
              Explore Services
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {favorites.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 transition-all hover:shadow-xl hover:border-blue-500/30">
                  <div className="flex gap-4">
                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[20px] bg-slate-100 dark:bg-slate-800">
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-[16px] font-black text-slate-900 dark:text-white truncate">{p.name}</h3>
                            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-0.5">{p.category}</p>
                          </div>
                          <button onClick={() => removeFavorite(p.id)} className="shrink-0 rounded-full p-2 text-rose-500 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">
                            <Heart className="h-5 w-5 fill-current" />
                          </button>
                        </div>
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 px-2 py-1 rounded-lg text-[11px] font-black text-amber-600 dark:text-amber-400">
                            <Star className="h-3.5 w-3.5 fill-current" /> {p.rating}
                          </span>
                          <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" /> {p.distance}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                          Starts at <span className="text-[15px] font-black text-slate-900 dark:text-white">₹{p.price}</span>
                        </p>
                        <button onClick={() => navigate(`/shop/${p.id}`)}
                          className="rounded-[14px] bg-slate-900 dark:bg-white px-5 py-2.5 text-[12px] font-black text-white dark:text-slate-900 shadow-md hover:shadow-lg transition-all active:scale-95">
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Favorites;
