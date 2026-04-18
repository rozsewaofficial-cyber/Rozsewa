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
  const [sortBy, setSortBy] = useState("rating");
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

  useEffect(() => {
    fetchProviders();
  }, [category, isEmergency, searchQuery]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const params = { category, search: searchQuery };
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
    rating: p.rating || 4.5,
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
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{isEmergency ? "🚨 Emergency Providers" : category || "All Services"}</h1>
            <p className="text-xs text-muted-foreground">{sorted.length} providers near you</p>
          </div>
        </div>

        <SearchBar onSearch={(val) => setSearchQuery(val)} />

        {/* Sort */}
        <div className="flex gap-2">
          {["rating", "distance", "price"].map((key) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.93 }}
              onClick={() => setSortBy(key)}
              className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${sortBy === key ? "bg-primary text-primary-foreground" : "border border-border bg-card text-card-foreground hover:bg-muted"
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
      <BottomNav />
    </div>
  );
};

export default ShopListing;
