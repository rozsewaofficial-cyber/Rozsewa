import { motion } from "framer-motion";
import { Bell, UserCircle, Sun, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const ProviderTopNav = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link to="/provider" className="flex items-center gap-3 group">
            <div className="h-10 w-10 flex-shrink-0 bg-white rounded-xl p-1 shadow-sm border border-emerald-100 group-hover:scale-105 transition-transform overflow-hidden">
              <img src="/assets/logo.jpg" alt="RozSewa Logo" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent leading-none">
                RozSewa
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Pro Dashboard
              </span>
            </div>
          </Link>
        </div>

        {user?.status === 'approved' && (
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/provider" className="text-sm font-bold text-muted-foreground hover:text-emerald-600 transition-colors">Dashboard</Link>
            <Link to="/provider/bookings" className="text-sm font-bold text-muted-foreground hover:text-emerald-600 transition-colors">Bookings</Link>
            <Link to="/provider/services" className="text-sm font-bold text-muted-foreground hover:text-emerald-600 transition-colors">Services</Link>
            <Link to="/provider/wallet" className="text-sm font-bold text-muted-foreground hover:text-emerald-600 transition-colors">Wallet</Link>
          </nav>
        )}

        <div className="flex items-center gap-2 md:gap-3">
          <motion.button onClick={toggleTheme} whileTap={{ scale: 0.9 }} className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4 text-emerald-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </motion.button>

          {user && (
            <>
              <motion.div whileTap={{ scale: 0.9 }}>
                <Link to="/provider/notifications" className="relative cursor-pointer rounded-xl bg-muted/50 p-2 hover:bg-muted flex items-center justify-center">
                  <Bell className="h-5 w-5 text-foreground" />
                  <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-destructive"></span>
                </Link>
              </motion.div>

              <motion.div whileTap={{ scale: 0.9 }}>
                <Link to="/provider/profile" className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {user?.profileImage ? (
                    <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle className="h-6 w-6" />
                  )}
                </Link>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default ProviderTopNav;
