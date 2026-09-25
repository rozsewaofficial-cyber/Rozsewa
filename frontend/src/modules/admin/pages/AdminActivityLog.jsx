import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Search, Clock, User, Settings, Shield, AlertTriangle, CheckCircle2, Loader2, ListFilter, LogIn } from "lucide-react";
import API from "@/lib/api";

const typeConfig = {
  login: { icon: User, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
  approval: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
  settings: { icon: Settings, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
  security: { icon: Shield, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
  warning: { icon: AlertTriangle, color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20" },
};

const ActivityFeedTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => { fetchLogs(); }, []);

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

const LoginReportTab = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [cityFilter, setCityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const hasFilters = cityFilter || dateFrom || dateTo || timeFrom || timeTo;

  useEffect(() => {
    API.get("/admin/login-logs/cities").then(({ data }) => setCities(data || [])).catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...(cityFilter ? { city: cityFilter } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(timeFrom ? { timeFrom } : {}),
        ...(timeTo ? { timeTo } : {}),
        limit: 100
      };
      const res = await API.get("/admin/login-logs", { params });
      setLogs(res.data || []);
      setTotal(Number(res.headers?.["x-total-count"]) || (res.data || []).length);
    } catch (err) {
      console.error("Login report load error:", err);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, dateFrom, dateTo, timeFrom, timeTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary">
          <option value="">All Cities</option>
          {cities.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <div className="flex items-center gap-1.5">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            max={dateTo || undefined}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary" />
          <span className="text-xs font-bold text-muted-foreground">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary" />
        </div>
        <div className="flex items-center gap-1.5">
          <input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary" />
          <span className="text-xs font-bold text-muted-foreground">to</span>
          <input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary" />
        </div>
        {hasFilters && (
          <button onClick={() => { setCityFilter(""); setDateFrom(""); setDateTo(""); setTimeFrom(""); setTimeTo(""); }}
            className="rounded-xl bg-muted px-3 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted/70">
            Clear
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <th className="px-5 py-3">Sr. No.</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">City</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan="6" className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="py-16 text-center text-sm font-bold text-muted-foreground">No logins match these filters</td></tr>
              ) : logs.map((log, i) => {
                const dt = new Date(log.createdAt);
                return (
                  <tr key={log._id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-bold text-muted-foreground">{i + 1}</td>
                    <td className="px-5 py-3 font-bold text-foreground">{log.name}</td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{log.role}</td>
                    <td className="px-5 py-3 text-muted-foreground">{log.city || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-5 py-3 text-muted-foreground">{dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && logs.length > 0 && (
          <div className="border-t border-border bg-muted/20 px-5 py-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Showing {logs.length} of {total} logins
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminActivityLog = () => {
  const { setTitle } = useOutletContext();
  const [tab, setTab] = useState("feed");

  useEffect(() => {
    setTitle("System Logs");
  }, [setTitle]);

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h1 className="text-2xl font-black text-foreground">System Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Track admin actions and audit staff logins</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        {[
          { id: "feed", label: "Activity Feed", icon: ListFilter },
          { id: "logins", label: "Login Report", icon: LogIn },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "feed" ? <ActivityFeedTab /> : <LoginReportTab />}
    </div>
  );
};

export default AdminActivityLog;
