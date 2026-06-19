import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MapPin, BadgeCheck, ArrowLeft, Filter, SortAsc } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import SearchBar from "@/modules/user/components/SearchBar";
import ServiceCard from "@/modules/user/components/ServiceCard";

const defaultProviders = [
  { id: "PRO-1", shopName: "CoolTech Services", owner: "Ramesh Kumar", category: "AC Repair", status: "approved", rating: 4.6, reviews: 189, distance: "2.5 km", price: "349", image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop", verified: true, emergency: true },
  { id: "PRO-2", shopName: "Royal Men's Salon", owner: "Vikas Plumbing", category: "Salon", status: "approved", rating: 4.8, reviews: 312, distance: "1.2 km", price: "199", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=300&fit=crop", verified: true, emergency: false },
  { id: "PRO-3", shopName: "Glow Beauty Parlour", owner: "Priya Singh", category: "Salon", status: "approved", rating: 4.7, reviews: 445, distance: "1.8 km", price: "299", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop", verified: true, emergency: false },
  { id: "PRO-4", shopName: "Electric Bros", owner: "Rahul Sharma", category: "Electrician", status: "approved", rating: 4.5, reviews: 89, distance: "3.1 km", price: "249", image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop", verified: false, emergency: true },
];

import API from "@/lib/api";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const ShopListing = () => {
  const navigate = useNavigate();
  const { userLocation } = useAuth();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "";
  const isEmergency = searchParams.get("emergency") === "true";
  const filterParam = searchParams.get("filter");
  const initialSort = filterParam === 'nearby' ? 'distance' : 'rating';

  const [sortBy, setSortBy] = useState(initialSort);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const mode = searchParams.get("mode") || "partner";

  useEffect(() => {
    fetchProviders();
  }, [category, isEmergency, searchQuery]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const params = { category, search: searchQuery, emergency: isEmergency, mode: mode };
      if (userLocation) {
        params.lat = userLocation.lat;
        params.lng = userLocation.lng;
        params.radius = 15;
      } else {
        const savedCity = localStorage.getItem("rozsewa_user_city");
        if (savedCity) params.city = savedCity;
      }
      let { data } = await API.get(`/public/providers`, { params });
      setProviders(data);
    } catch (error) {
      console.error("Error fetching providers:", error);
    } finally {
      setLoading(false);
    }
  };

  const allProvidersList = providers.map(p => ({
    id: p._id,
    name: p.shopName || p.name,
    category: p.vendorType?.name || category,
    rating: p.rating !== undefined ? p.rating : 4.5,
    reviews: p.reviewCount || 0,
    distance: "2.5 km",
    price: "Starts ₹199",
    image: p.profileImage || `https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop`,
    verified: p.status === "verified",
    emergency: (p.vendorType?.name || "").toLowerCase().includes("ac") || (p.vendorType?.name || "").toLowerCase().includes("electric")
  }));

  const filtered = allProvidersList.filter((p) => {
    const sQuery = searchQuery.toLowerCase();
    const pName = p.name.toLowerCase();
    const pCat = p.category.toLowerCase();
    return pName.includes(sQuery) || pCat.includes(sQuery);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "price") return parseInt(String(a.price).replace(/\D/g, '')) - parseInt(String(b.price).replace(/\D/g, ''));
    return parseFloat(a.distance) - parseFloat(b.distance);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 md:pb-0">
      <TopNav />
      
      {/* New Gradient Header */}
      <div className="relative pt-6 pb-12 px-5 sm:px-8 bg-gradient-to-b from-[#e0f2fe] via-[#f0f9ff] to-slate-50 dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-950 rounded-b-[3rem] shadow-sm mb-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{isEmergency ? "🚨 Emergency Providers" : category || "All Services"}</h1>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{sorted.length} providers near you</p>
            </div>
          </div>
          
          <SearchBar onSearch={(val, filter) => {
            setSearchQuery(val);
            if (filter === 'nearby') setSortBy('distance');
            if (filter === 'top-rated') setSortBy('rating');
          }} />
        </div>
      </div>

      <main className="container max-w-6xl px-5 sm:px-8 space-y-6">
        {/* Sort */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {["rating", "distance", "price"].map((key) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.93 }}
              onClick={() => setSortBy(key)}
              className={`shrink-0 rounded-full px-5 py-2 text-[13px] font-bold capitalize transition-colors ${sortBy === key ? "bg-blue-600 text-white shadow-md border border-blue-500" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
            >
              {key}
            </motion.button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {sorted.map((p) => (
            <ServiceCard key={p.id} {...p} />
          ))}
        </div>
      </main>
      <BottomNav mode={mode} />
    </div>
  );
};

export default ShopListing;
