import { motion } from "framer-motion";
import { TrendingUp, CalendarDays, BarChart3, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";

const EarningsWidget = () => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  const fetchStats = async () => {
    if (!isAuthenticated || !user) return;
    try {
      const { data } = await API.get("/provider/stats");
      setStats([
        { title: "Today's Income", amount: `₹${Number(data.today || 0).toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
        { title: "This Week", amount: `₹${Number(data.week || 0).toLocaleString("en-IN")}`, icon: CalendarDays, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
        { title: "This Month", amount: `₹${Number(data.month || 0).toLocaleString("en-IN")}`, icon: BarChart3, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/40" },
      ]);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  if (loading) return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted"></div>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="flex items-center rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className={`mr-4 flex h-12 w-12 items-center justify-center rounded-full ${stat.bg}`}>
            <stat.icon className={`h-6 w-6 ${stat.color}`} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</p>
            <h3 className="text-xl font-bold flex items-center text-foreground">
              {stat.amount}
            </h3>
            {/* What the partner earned — not the customers' total bill. */}
            <p className="text-[10px] font-medium text-muted-foreground">After commission, incl. tips</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default EarningsWidget;
