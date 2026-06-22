import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ChevronDown, Bell, User, Moon, Sun, Home, Store, ClipboardList, Heart } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const navLinks = [
  { label: "Home", path: "/", icon: Home },
  { label: "Services", path: "/shops", icon: Store },
  { label: "Bookings", path: "/my-bookings", icon: ClipboardList },
  { label: "Favorites", path: "/favorites", icon: Heart },
];

const TopNav = () => {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const { user } = useAuth();
  const [city, setCity] = useState(() => {
    if (user && user.city) return user.city;
    return localStorage.getItem("rozsewa_user_city") || "Lucknow";
  });
  const [dynamicCities, setDynamicCities] = useState(["Lucknow", "Delhi", "Mumbai", "Bangalore", "Pune", "Hyderabad", "Kolkata", "Chennai"]);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/public/zones`);
      const data = await res.json();
      if (data && data.length > 0) {
        setDynamicCities(data.map(z => z.name));
      }
    } catch (err) {
      console.log("Error fetching zones", err);
    }
  };

  // Sync city when user logs in
  useEffect(() => {
    if (user && user.city) {
      setCity(user.city);
      localStorage.setItem("rozsewa_user_city", user.city);
    }
  }, [user]);

  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await API.get('/notifications/unread-count');
        if (data && data.unreadCount !== undefined) {
          setUnreadCount(data.unreadCount);
        }
      } catch (err) {
        console.error("Failed to fetch unread count");
      }
    };
    fetchUnread();

    const handleNewNotif = () => setUnreadCount(prev => prev + 1);
    
    window.addEventListener('NEW_NOTIFICATION', handleNewNotif);
    window.addEventListener('focus', fetchUnread);
    
    return () => {
      window.removeEventListener('NEW_NOTIFICATION', handleNewNotif);
      window.removeEventListener('focus', fetchUnread);
    };
  }, [location.pathname]);

  const handleCitySelect = (selectedCity) => {
    setCity(selectedCity);
    localStorage.setItem("rozsewa_user_city", selectedCity);
    localStorage.removeItem("rozsewa_user_location");
    setShowLocationModal(false);
    window.location.reload(); 
  };

  const handleUseCurrentLocation = () => {
    if ("geolocation" in navigator) {
      toast({ title: "Accessing Location", description: "Fetching your current city..." });
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            const detectedCity = data.address.city || data.address.town || data.address.village || "Unknown City";
            const cityWithLabel = `${detectedCity} (Detected)`;
            handleCitySelect(cityWithLabel);
            toast({ title: "Location Updated", description: `Successfully detected ${detectedCity}.` });
          } catch (err) {
            toast({ title: "Detection Failed", description: "Could not identify your city.", variant: "destructive" });
          }
        },
        () => toast({ title: "Access Denied", description: "Please enable location services.", variant: "destructive" })
      );
    }
  };

  const isActive = (path) => location.pathname === path;

  const handleProfileClick = (e) => {
    e.preventDefault();
    if (user) navigate("/profile");
    else navigate("/login");
  };

  return (
    <>
      <motion.header 
        initial={{ y: -20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        className="sticky top-0 z-50 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm"
      >
        {/* Desktop Navbar */}
        <div className="hidden md:block">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex h-[72px] items-center gap-6">
              <Link to="/" className="flex items-center shrink-0 mr-2">
                <img src="/RozSewa.png" alt="RojSewa" className="h-8 w-auto object-contain" />
              </Link>

              <button 
                onClick={() => setShowLocationModal(true)}
                className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 text-[14px] font-bold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm group"
              >
                <MapPin className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="truncate max-w-[140px]">{city}</span>
                <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
              </button>

              <nav className="flex items-center gap-2 ml-4">
                {navLinks.map((link) => (
                  <Link key={link.path} to={link.path}
                    className={`relative px-4 py-2.5 text-[14px] font-black rounded-full transition-all ${
                      isActive(link.path) 
                      ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10" 
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}>
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="flex-1" />

              <div className="flex items-center gap-3">
                <Link to="/notifications" className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
                  <Bell className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0B1120]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>

                <motion.button 
                  whileTap={{ scale: 0.9 }} 
                  onClick={toggleTheme} 
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                >
                  {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-slate-700" />}
                </motion.button>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                <button 
                  onClick={handleProfileClick} 
                  className="flex items-center gap-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 pl-1.5 pr-5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/20">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none">Account</span>
                    <span className="text-[14px] font-bold text-slate-900 dark:text-white leading-none mt-1">{user ? (user.name || user.ownerName || "User").split(" ")[0] : "Login"}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navbar */}
        <div className={`md:hidden ${location.pathname === '/' ? 'hidden' : ''}`}>
          <div className="px-4 flex h-[68px] items-center justify-between">
            <Link to="/" className="flex items-center shrink-0">
              <img src="/RozSewa.png" alt="RojSewa" className="h-8 w-auto object-contain" />
            </Link>

            <button 
              onClick={() => setShowLocationModal(true)} 
              className="flex items-center justify-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2 text-[13px] font-bold text-slate-900 dark:text-white transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
            >
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="max-w-[90px] truncate">{city}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <motion.button 
                whileTap={{ scale: 0.9 }} 
                onClick={toggleTheme} 
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
              >
                {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-slate-700" />}
              </motion.button>
              <button 
                onClick={handleProfileClick} 
                className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-100 dark:hover:bg-blue-500/30 shadow-sm"
              >
                <User className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Location Selector Modal */}
      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0"
               onClick={() => setShowLocationModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: "100%" }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: "100%" }} 
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Select Location</h3>
                  <p className="text-[12px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Find services near you</p>
                </div>
                <button 
                  onClick={() => setShowLocationModal(false)} 
                  className="rounded-full bg-slate-100 dark:bg-slate-800 p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {dynamicCities.map((c) => (
                  <button key={c} onClick={() => handleCitySelect(c)}
                    className={`flex items-center gap-2.5 rounded-[16px] border-2 px-4 py-3.5 text-[14px] font-bold transition-all ${
                      city.includes(c) 
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" 
                      : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}>
                    <MapPin className={`h-4 w-4 shrink-0 ${city.includes(c) ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} /> 
                    <span className="truncate">{c}</span>
                  </button>
                ))}
              </div>

              <button 
                className="mt-6 w-full rounded-[16px] bg-slate-900 dark:bg-white py-4 text-[14px] font-black tracking-wide text-white dark:text-slate-900 shadow-xl flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-[0.98]"
                onClick={handleUseCurrentLocation}
              >
                <MapPin className="h-4 w-4" />
                <span>Auto-Detect Location</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TopNav;
