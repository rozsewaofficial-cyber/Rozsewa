import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Home, ClipboardList, Users, MessageSquare, MoreHorizontal } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "@/lib/api";

const tabs = [
  { icon: Home, label: "Home", path: "/" },
  { icon: ClipboardList, label: "Projects", path: "/my-bookings" },
  { icon: Users, label: "Pros", path: "/shops" },
  { icon: MessageSquare, label: "Inbox", path: "/notifications" },
  { icon: MoreHorizontal, label: "More", path: "/profile" },
];

const BottomNav = ({ mode = "partner" }) => {
  const location = useLocation();
  const navigate = useNavigate();
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

    const handleNewNotif = () => {
      setUnreadCount(prev => prev + 1);
    };

    window.addEventListener('NEW_NOTIFICATION', handleNewNotif);
    window.addEventListener('focus', fetchUnread);
    
    return () => {
      window.removeEventListener('NEW_NOTIFICATION', handleNewNotif);
      window.removeEventListener('focus', fetchUnread);
    };
  }, [location.pathname]);

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-6 left-4 right-4 z-50 md:hidden"
    >
      <div className="flex items-center justify-between rounded-full bg-white dark:bg-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 dark:border-slate-800 px-6 py-4 backdrop-blur-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = location.pathname === tab.path || (tab.path !== "/" && location.pathname.startsWith(tab.path));
          
          let displayLabel = tab.label;
          let displayPath = tab.path;
          if (tab.label === "Pros") {
            displayLabel = mode === "sewak" ? "Sewaks" : "Pros";
            displayPath = mode === "sewak" ? "/shops?mode=sewak" : "/shops";
          }

          return (
            <motion.button
              key={tab.path}
              whileTap={{ scale: 0.85 }}
              onClick={() => navigate(displayPath)}
              className="relative flex flex-col items-center gap-1.5"
            >
              <div className={`relative flex items-center justify-center transition-colors ${active ? "text-blue-600 dark:text-blue-500" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}>
                <Icon className={`h-6 w-6 ${active ? "fill-current" : ""}`} />
                {tab.label === "Inbox" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold transition-colors ${active ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                {displayLabel}
              </span>
              {active && (
                <motion.div
                  layoutId="bottomnav-dot"
                  className="absolute -bottom-2 h-1 w-1 rounded-full bg-blue-600 dark:bg-blue-500"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default BottomNav;
