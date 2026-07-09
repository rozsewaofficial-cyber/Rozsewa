import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, Menu, X, User, UserCheck, Briefcase, ShoppingBag, Shield, Clock, ChevronRight, Loader2, AlertCircle, Landmark } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import API from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// ─── Helpers ────────────────────────────────────────────────────────────────
const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const notifIcon = (type) => {
  if (type === "kyc") return <Shield className="h-4 w-4 text-blue-500" />;
  if (type === "booking") return <Briefcase className="h-4 w-4 text-amber-500" />;
  if (type === "withdrawal") return <Landmark className="h-4 w-4 text-emerald-500" />;
  return <Clock className="h-4 w-4 text-gray-400" />;
};

const searchIcon = (type) => {
  if (type === "user") return <User className="h-3.5 w-3.5 text-violet-500" />;
  if (type === "provider") return <UserCheck className="h-3.5 w-3.5 text-blue-500" />;
  if (type === "sewak") return <Shield className="h-3.5 w-3.5 text-emerald-500" />;
  return <ShoppingBag className="h-3.5 w-3.5 text-amber-500" />;
};

// ─── Component ────────────────────────────────────────────────────────────────
const AdminTopNav = ({ title = "Dashboard", toggleMenu }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifCounts, setNotifCounts] = useState({ pendingKyc: 0, pendingSewaks: 0, pendingBookings: 0, pendingLeads: 0, pendingWithdrawals: 0 });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const notifRef = useRef(null);

  const totalBadge = (notifCounts.pendingKyc || 0) + (notifCounts.pendingSewaks || 0) + (notifCounts.pendingBookings || 0) + (notifCounts.pendingLeads || 0) + (notifCounts.pendingWithdrawals || 0);

  // ── Search debounce ──────────────────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const { data } = await API.get(`/admin/search?q=${encodeURIComponent(q.trim())}`);
      setSearchResults(data);
    } catch {
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(searchQuery), 350);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, doSearch]);

  // ── Keyboard shortcut Ctrl+K ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Close panels on outside click ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch notifications ───────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (force = false) => {
    if (notifLoaded && !force) return;
    setNotifLoading(true);
    try {
      const { data } = await API.get("/admin/notifications");
      setNotifications(data.notifications || []);
      setNotifCounts(data.counts || {});
      setNotifLoaded(true);
    } catch {
      // fail silently
    } finally {
      setNotifLoading(false);
    }
  }, [notifLoaded]);

  // Fetch on mount for badge count
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Listen for socket-driven live notifications to refresh list in real-time
  useEffect(() => {
    const handleLiveNotification = () => {
      fetchNotifications(true);
    };
    window.addEventListener('NEW_NOTIFICATION', handleLiveNotification);
    return () => window.removeEventListener('NEW_NOTIFICATION', handleLiveNotification);
  }, [fetchNotifications]);

  const handleNotifOpen = () => {
    setNotifOpen((prev) => !prev);
    setSearchOpen(false);
    if (!notifLoaded) fetchNotifications();
  };

  const handleSearchOpen = () => {
    setSearchOpen((prev) => !prev);
    setNotifOpen(false);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const navigateTo = (link) => {
    navigate(link);
    setNotifOpen(false);
    setSearchOpen(false);
  };

  // ── Search result counts ──────────────────────────────────────────────────
  const hasResults = searchResults && (
    searchResults.users?.length > 0 ||
    searchResults.providers?.length > 0 ||
    searchResults.sewaks?.length > 0 ||
    searchResults.bookings?.length > 0
  );

  return (
    <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center justify-between border-b border-gray-200 bg-white/90 backdrop-blur-xl px-4 md:px-10 transition-all duration-300 shadow-sm">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleMenu}
          className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors shadow-sm"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-black text-gray-900 tracking-tight hidden sm:block">{title}</h1>
      </div>

      {/* Right: search + bell */}
      <div className="flex flex-1 items-center justify-end gap-3">

        {/* ── Global Search ─────────────────────────────────────────────── */}
        <div className="relative hidden md:block" ref={searchRef}>
          {/* Input bar */}
          <div
            onClick={handleSearchOpen}
            className="flex items-center w-64 lg:w-80 cursor-text bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-3 text-sm font-semibold text-gray-400 outline-none hover:border-blue-400 hover:bg-white transition-all shadow-inner"
          >
            <Search className="absolute left-3.5 h-4 w-4 text-gray-400" />
            <span className="flex-1 select-none">Search across RozSewa...</span>
            <span className="bg-white border border-gray-200 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-400 shadow-sm">
              CTRL+K
            </span>
          </div>

          {/* Search overlay panel */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-14 left-0 w-[480px] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                {/* Input inside panel */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                  <Search className="h-4 w-4 text-gray-400 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users, providers, sewaks, bookings..."
                    className="flex-1 text-sm font-semibold text-gray-800 bg-transparent outline-none placeholder:text-gray-400"
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Results body */}
                <div className="max-h-[440px] overflow-y-auto">
                  {searchLoading && (
                    <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-semibold">Searching...</span>
                    </div>
                  )}

                  {!searchLoading && !searchResults && searchQuery.length >= 2 && (
                    <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
                      <AlertCircle className="h-6 w-6" />
                      <span className="text-sm font-semibold">No results found</span>
                    </div>
                  )}

                  {!searchLoading && !searchQuery && (
                    <div className="py-6 text-center text-gray-400 text-sm font-semibold">
                      Type at least 2 characters to search...
                    </div>
                  )}

                  {!searchLoading && hasResults && (
                    <div className="divide-y divide-gray-50">
                      {/* Users */}
                      {searchResults.users?.length > 0 && (
                        <section className="px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Users</p>
                          {searchResults.users.map((u) => (
                            <Link
                              key={u._id}
                              to="/admin/users"
                              onClick={() => setSearchOpen(false)}
                              className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors group"
                            >
                              {searchIcon("user")}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{u.name}</p>
                                <p className="text-xs text-gray-400 truncate">{u.email || u.mobile}</p>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500" />
                            </Link>
                          ))}
                        </section>
                      )}

                      {/* Providers */}
                      {searchResults.providers?.length > 0 && (
                        <section className="px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Providers</p>
                          {searchResults.providers.map((p) => (
                            <Link
                              key={p._id}
                              to="/admin/providers"
                              onClick={() => setSearchOpen(false)}
                              className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors group"
                            >
                              {searchIcon("provider")}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{p.shopName || p.ownerName}</p>
                                <p className="text-xs text-gray-400 truncate">{p.vendorCode} · {p.mobile}</p>
                              </div>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${p.status === "verified" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                  p.status === "rejected" ? "bg-rose-50 text-rose-600 border-rose-100" :
                                    "bg-amber-50 text-amber-600 border-amber-100"
                                }`}>{p.status}</span>
                            </Link>
                          ))}
                        </section>
                      )}

                      {/* Sewaks */}
                      {searchResults.sewaks?.length > 0 && (
                        <section className="px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Sewaks</p>
                          {searchResults.sewaks.map((s) => (
                            <Link
                              key={s._id}
                              to="/admin/sewaks"
                              onClick={() => setSearchOpen(false)}
                              className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors group"
                            >
                              {searchIcon("sewak")}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{s.ownerName}</p>
                                <p className="text-xs text-gray-400 truncate">{s.vendorCode} · {s.mobile}</p>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500" />
                            </Link>
                          ))}
                        </section>
                      )}

                      {/* Bookings */}
                      {searchResults.bookings?.length > 0 && (
                        <section className="px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Bookings</p>
                          {searchResults.bookings.map((b) => (
                            <Link
                              key={b._id}
                              to="/admin/bookings"
                              onClick={() => setSearchOpen(false)}
                              className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors group"
                            >
                              {searchIcon("booking")}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{b.serviceName}</p>
                                <p className="text-xs text-gray-400 truncate">{b.bookingId} · ₹{b.amount}</p>
                              </div>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${b.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                  b.status === "cancelled" ? "bg-rose-50 text-rose-600 border-rose-100" :
                                    "bg-amber-50 text-amber-600 border-amber-100"
                                }`}>{b.status}</span>
                            </Link>
                          ))}
                        </section>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Press ESC to close</span>
                  {hasResults && (
                    <span className="text-[10px] font-bold text-gray-400">
                      {(searchResults.users?.length || 0) + (searchResults.providers?.length || 0) + (searchResults.sewaks?.length || 0) + (searchResults.bookings?.length || 0)} results
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Notification Bell ─────────────────────────────────────────── */}
        <div className="relative" ref={notifRef}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleNotifOpen}
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm"
          >
            <Bell className="h-5 w-5" />
            {totalBadge > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 ring-2 ring-white text-[9px] font-black text-white">
                {totalBadge > 9 ? "9+" : totalBadge}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-14 right-0 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-black text-gray-900">Notifications</p>
                    {totalBadge > 0 && (
                      <p className="text-[10px] font-bold text-red-500">{totalBadge} pending actions</p>
                    )}
                  </div>
                  <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="max-h-[380px] overflow-y-auto">
                  {notifLoading && (
                    <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-semibold">Loading...</span>
                    </div>
                  )}

                  {!notifLoading && notifications.length === 0 && (
                    <div className="py-10 text-center text-gray-400">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-semibold">No notifications</p>
                    </div>
                  )}

                  {!notifLoading && notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => navigateTo(n.link)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                    >
                      <div className="mt-0.5 h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        {notifIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 leading-tight truncate">{n.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap mt-0.5 shrink-0">{timeAgo(n.time)}</span>
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50">
                  <Link
                    to="/admin/audit-logs"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest"
                  >
                    View All Activity →
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Profile Avatar */}
        <motion.div whileTap={{ scale: 0.9 }} className="md:hidden">
          <Link
            to="/admin/settings"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-700 font-black text-sm shadow-sm overflow-hidden"
          >
            {user?.avatar || user?.profileImage ? (
              <img
                src={user.avatar || user.profileImage}
                alt="Profile"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <span
              className="h-full w-full items-center justify-center font-black text-sm"
              style={{ display: user?.avatar || user?.profileImage ? 'none' : 'flex' }}
            >
              {user?.name ? user.name.substring(0, 2).toUpperCase() : "AD"}
            </span>
          </Link>
        </motion.div>
      </div>
    </header>
  );
};

export default AdminTopNav;
