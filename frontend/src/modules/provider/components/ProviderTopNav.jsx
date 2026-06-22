import { motion } from "framer-motion";
import { ArrowLeft, Bell, UserCircle, Sun, Moon, Clock } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useState, useEffect } from "react";
import API from "@/lib/api";

const ProviderTopNav = ({ title, showBack = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const { data } = await API.get("/notifications/unread-count");
        setUnreadCount(data?.unreadCount || 0);
      } catch {}
    };
    fetchUnread();

    const handleNewNotif = () => setUnreadCount(prev => prev + 1);
    window.addEventListener('NEW_NOTIFICATION', handleNewNotif);
    window.addEventListener('focus', fetchUnread);
    return () => {
      window.removeEventListener('NEW_NOTIFICATION', handleNewNotif);
      window.removeEventListener('focus', fetchUnread);
    };
  }, [user, location.pathname]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/10 bg-white dark:bg-slate-950/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between px-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Link to="/provider" className="flex items-center gap-2 group">
            <div className="h-9 w-9 flex-shrink-0 bg-white rounded-xl p-1 shadow-sm border border-emerald-100 group-hover:scale-105 transition-transform overflow-hidden flex items-center justify-center">
              <img src="/assets/logo.jpg" alt="Logo" className="h-full w-full object-contain" />
            </div>
          </Link>

          {showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </motion.button>
          )}

          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 leading-none mb-0.5">
              RozSewa
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-white leading-none">
              {title || "Pro Dashboard"}
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg border border-border/50">
          <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>{currentTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {currentTime.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
        </div>

        <div className="flex items-center gap-2">
          <motion.button onClick={toggleTheme} whileTap={{ scale: 0.9 }} className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 transition-colors">
            {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
          </motion.button>

          {user && (
            <div className="flex items-center gap-2 border-l border-border pl-2">
              {!((user?.role === 'sewak' || user?.providerCategory === 'sewak') ? !user?.kycVerified : user?.status !== 'verified') && (
                <Link to="/provider/notifications" className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <Bell className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              )}

              <Link to="/provider/profile" className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-emerald-100 ring-1 ring-emerald-200">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <UserCircle className="h-5 w-5 text-emerald-600" />
                )}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default ProviderTopNav;
