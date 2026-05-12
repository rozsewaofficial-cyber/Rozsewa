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
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-black text-foreground tracking-tight">My Favorites</h1>
        </div>

        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center opacity-60">
            <div className="rounded-full bg-muted p-10 mb-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-black text-foreground">No favorites yet</h3>
            <p className="text-xs font-bold text-muted-foreground mt-1 px-8">Save your favorite service providers to find them easily here.</p>
            <button onClick={() => navigate("/shops")} className="mt-8 rounded-2xl bg-primary px-8 py-4 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20">Explore Services</button>
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {favorites.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4 transition-all hover:shadow-2xl shadow-black/5">
                  <div className="flex gap-4">
                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl">
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-black text-foreground truncate">{p.name}</h3>
                          <p className="text-xs font-black text-primary uppercase tracking-wider">{p.category}</p>
                        </div>
                        <button onClick={() => removeFavorite(p.id)} className="text-rose-500 p-2 hover:bg-rose-500/10 rounded-full transition-all">
                          <Heart className="h-6 w-6 fill-current" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] font-black text-muted-foreground">
                        <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-lg"><Star className="h-3.5 w-3.5 fill-secondary text-secondary" /> {p.rating}</span>
                        <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-lg"><MapPin className="h-3.5 w-3.5" /> {p.distance}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm font-black text-foreground">Starting ₹{p.price}</p>
                        <button onClick={() => navigate(`/shop/${p.id}`)}
                          className="rounded-xl bg-primary px-6 py-2.5 text-xs font-black text-primary-foreground shadow-lg shadow-primary/10 hover:shadow-xl transition-all">
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
