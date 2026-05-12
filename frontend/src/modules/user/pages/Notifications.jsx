import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bell, BellRing, PackageCheck, Tag, Info, Trash2, CheckCircle2, DollarSign, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const Notifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await API.get("/notifications");
        setNotifications(data);
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    };
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await API.patch("/notifications/read-all");
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      toast({ title: "All Marked as Read" });
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const handleClearAll = () => {
    // Local clear for now
    setNotifications([]);
    toast({ title: "Notifications Cleared!" });
  };

  const deleteNotification = async (id) => {
    try {
      await API.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n._id !== id));
      toast({ title: "Notification Removed" });
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const getIconConfig = (type) => {
    switch(type) {
      case 'booking': return { icon: PackageCheck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", outline: "border-blue-200 dark:border-blue-800" };
      case 'promo': return { icon: Tag, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", outline: "border-emerald-200 dark:border-emerald-800" };
      case 'payment': return { icon: DollarSign, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", outline: "border-amber-200 dark:border-amber-800" };
      case 'alert': return { icon: AlertCircle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30", outline: "border-rose-200 dark:border-rose-800" };
      default: return { icon: Info, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", outline: "border-purple-200 dark:border-purple-800" };
    }
  };

  const groupByCategory = (notifs) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    return notifs.reduce((acc, notif) => {
      const dateStr = new Date(notif.createdAt).toDateString();
      let group = "Older";
      if (dateStr === today) group = "Today";
      else if (dateStr === yesterday) group = "Yesterday";
      
      if (!acc[group]) acc[group] = [];
      acc[group].push(notif);
      return acc;
    }, {});
  };

  const grouped = groupByCategory(notifications);
  const groups = ["Today", "Yesterday", "Older"].filter(g => grouped[g] && grouped[g].length > 0);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </motion.button>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">Notifications</h1>
              <p className="text-xs font-semibold text-muted-foreground">{unreadCount} unread message{unreadCount !== 1 && "s"}</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllAsRead} className="flex h-10 items-center gap-2 rounded-full bg-primary/10 px-4 text-xs font-bold text-primary hover:bg-primary/20 transition-colors">
              <CheckCircle2 className="h-4 w-4" /> Mark All Read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border-2 border-dashed border-border bg-muted/10">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-6">
              <BellRing className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h2 className="text-xl font-black text-foreground tracking-tight">You're all caught up!</h2>
            <p className="text-sm font-medium text-muted-foreground mt-2 px-8 leading-relaxed">No new notifications right now. We'll let you know when there's an update.</p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group}>
                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-3">
                  {group} <div className="h-px flex-1 bg-border/50" />
                </h3>
                <div className="space-y-3">
                  <AnimatePresence>
                    {grouped[group].map((notif, index) => {
                      const conf = getIconConfig(notif.type);
                      const Icon = conf.icon;
                      
                      return (
                        <motion.div key={notif._id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: index * 0.05 }}
                          onClick={() => !notif.isRead && handleMarkAsRead(notif._id)}
                          className={`group relative flex items-start gap-4 rounded-[24px] border border-border p-4 transition-all cursor-pointer overflow-hidden ${
                            notif.isRead ? "bg-card hover:bg-muted/50" : "bg-primary/5 border-primary/20 shadow-lg shadow-primary/5"
                          }`}>
                          
                          {/* Unread indicator line */}
                          {!notif.isRead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                          
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${conf.outline} ${conf.bg}`}>
                            <Icon className={`h-5 w-5 ${conf.color}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0 pr-6">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className={`text-sm font-bold truncate ${notif.isRead ? "text-foreground" : "text-foreground"}`}>{notif.title}</h3>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 shrink-0 mt-0.5">
                                {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className={`mt-1 text-xs leading-relaxed ${notif.isRead ? "text-muted-foreground" : "font-medium text-foreground/80 font-bold"}`}>{notif.message}</p>
                          </div>

                          <button onClick={(e) => { e.stopPropagation(); deleteNotification(notif._id); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 transition-all dark:bg-rose-900/30">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}

        {notifications.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-8">
            <button onClick={handleClearAll} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-200 py-4 text-xs font-black uppercase tracking-widest text-rose-500 hover:border-rose-300 hover:bg-rose-50 transition-colors dark:border-rose-900/40 dark:hover:bg-rose-900/10">
              <Trash2 className="h-4 w-4" /> Clear All Notifications
            </button>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Notifications;
