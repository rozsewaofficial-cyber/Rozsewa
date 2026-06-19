import { motion } from "framer-motion";
import { Home, ClipboardList, Users, MessageSquare, MoreHorizontal } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

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
              <div className={`flex items-center justify-center transition-colors ${active ? "text-blue-600 dark:text-blue-500" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}>
                <Icon className={`h-6 w-6 ${active ? "fill-current" : ""}`} />
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
