import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Home, Calendar, LayoutGrid, Wallet, Briefcase } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const ProviderBottomNav = () => {
  const location = useLocation();
  const { user, loading } = useAuth();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setIsKeyboardOpen(false);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // During initial loading, read from localStorage so nav doesn't flash empty
  const effectiveUser = user || (() => {
    try {
      const saved = localStorage.getItem("rozsewa_auth_provider");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })();

  // Only restrict AFTER auth is confirmed (not during the brief loading window)
  const isRestricted = loading
    ? false // Show all items while loading to prevent flash
    : (effectiveUser?.role === 'sewak' || effectiveUser?.providerCategory === 'sewak')
        ? !effectiveUser?.kycVerified
        : effectiveUser?.status !== 'verified';

  const navItems = [
    { icon: Home, label: "Home", path: "/provider" },
    ...(!isRestricted ? [
      { icon: Calendar, label: "Bookings", path: "/provider/bookings" },
      { icon: Briefcase, label: "Leads", path: "/provider/leads" },
      { icon: LayoutGrid, label: "Services", path: "/provider/services" },
      { icon: Wallet, label: "Wallet", path: "/provider/wallet" },
    ] : [])
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:bg-[#212121] dark:border-[#212121] shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:hidden transition-all duration-300 ${isKeyboardOpen ? 'translate-y-32 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path) && 
                           (item.path !== "/provider" || location.pathname === "/provider" || location.pathname === "/provider/");
          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center gap-1 p-2">
              <motion.div
                whileTap={{ scale: 0.9 }}
                animate={{
                  color: isActive ? "#059669" : "var(--muted-foreground)",
                  y: isActive ? -2 : 0
                }}
              >
                <item.icon className={`h-6 w-6 ${isActive ? 'fill-emerald-100/50' : ''}`} />
              </motion.div>
              <span className={`text-[10px] font-semibold ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default ProviderBottomNav;
