import { motion } from "framer-motion";
import { Home, Calendar, LayoutGrid, Wallet } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const ProviderBottomNav = () => {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: "Home", path: "/provider" },
    { icon: Calendar, label: "Bookings", path: "/provider/bookings" },
    { icon: LayoutGrid, label: "Services", path: "/provider/services" },
    { icon: Wallet, label: "Wallet", path: "/provider/wallet" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:bg-[#212121] dark:border-[#212121] shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path) && (item.path !== "/provider" || location.pathname === "/provider");
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
