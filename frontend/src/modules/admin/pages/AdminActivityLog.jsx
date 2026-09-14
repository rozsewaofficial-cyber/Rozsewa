import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Search, Clock, User, Settings, Shield, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import API from "@/lib/api";

const typeConfig = {
  login: { icon: User, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
  approval: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
  settings: { icon: Settings, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
  security: { icon: Shield, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
  warning: { icon: AlertTriangle, color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20" },
};

const AdminActivityLog = () => {
  const { setTitle } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    setTitle("System Logs");
    fetchLogs();
  }, [setTitle]);

  const fetchLogs = async () => {
    try {
      const { data } = await API.get("/admin/activity");
      setLogs(data);
    } catch (err) {
      console.error("Log Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs
    .filter(l => filterType === "all" || l.type === filterType)
    .filter(l => !search || l.action.toLowerCase().includes(search.toLowerCase()));

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Reconstructing Audit Trail...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h1 className="text-2xl font-black text-foreground">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Track all admin actions and events</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search activities..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-1">
          {["all", "login", "approval", "settings", "security", "warning"].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${filterType === t ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center rounded-3xl border-2 border-dashed border-border bg-muted/5">
            <Activity className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">Audit Vault Empty</p>
          </div>
        )}
        {filtered.map((log, i) => {
          const conf = typeConfig[log.type] || typeConfig.login;
          const Icon = conf.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="flex gap-4 py-4 border-b border-border/50 last:border-0 hover:bg-muted/5 px-2 rounded-xl transition-colors group text-left">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105 ${conf.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">{log.action}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{log.user}</span>
                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {timeAgo(log.time)}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminActivityLog;
