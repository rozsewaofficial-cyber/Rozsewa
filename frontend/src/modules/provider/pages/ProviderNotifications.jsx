import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { Bell, CheckCircle, Info, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const ProviderNotifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const { data } = await API.get("/notifications");
      setNotifications(data || []);
    } catch (err) {
      // Silently fail, show empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleNewNotification = (e) => {
        const newNotif = e.detail;
        setNotifications(prev => [newNotif, ...prev]);
    };

    window.addEventListener('NEW_NOTIFICATION', handleNewNotification);
    return () => window.removeEventListener('NEW_NOTIFICATION', handleNewNotification);
  }, []);

  const markAllRead = async () => {
    try {
      await API.patch("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast({ title: "All notifications marked as read" });
    } catch (err) {
      toast({ title: "Failed to mark notifications", variant: "destructive" });
    }
  };

  const clearAllNotifications = async () => {
    try {
      await API.delete("/notifications");
      setNotifications([]);
      toast({ title: "All notifications cleared" });
    } catch (err) {
      toast({ title: "Failed to clear notifications", variant: "destructive" });
    }
  };

  const deleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      await API.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => (n._id || n.id) !== id));
      toast({ title: "Notification deleted" });
    } catch (err) {
      toast({ title: "Failed to delete notification", variant: "destructive" });
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await API.patch(`/notifications/${notif._id || notif.id}/read`);
        setNotifications(prev => prev.map(n => (n._id === notif._id || n.id === notif.id) ? { ...n, isRead: true } : n));
      } catch (err) {
        console.error("Failed to mark notification as read", err);
      }
    }

    let targetLink = "";
    if (notif.type === "booking" || notif.bookingId) {
      targetLink = `/provider/bookings`;
    } else if (notif.type === "lead" || notif.leadId) {
      targetLink = `/provider/leads`;
    } else if (notif.type === "payment") {
      targetLink = `/provider/wallet`;
    }

    if (targetLink) {
      navigate(targetLink);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "success": return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const formatTime = (createdAt) => {
    if (!createdAt) return "";
    const date = new Date(createdAt);
    return `${date.toLocaleDateString("en-IN")} · ${date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`;
  };

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      <main className="container max-w-4xl px-0 sm:px-4 py-4 md:py-8">
        <div className="px-4 sm:px-0 mb-4 md:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end items-start gap-4 sm:gap-0">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">Notifications</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">Stay updated with your business activities.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {hasUnread && (
              <button onClick={markAllRead} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAllNotifications} className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Clear All
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="bg-card sm:rounded-2xl border-y sm:border-x border-border shadow-sm divide-y divide-border">
            {notifications.map(n => (
              <div key={n._id || n.id} 
                onClick={() => handleNotificationClick(n)}
                className={`group p-4 md:p-6 flex gap-4 hover:bg-muted/20 transition-colors cursor-pointer ${!n.isRead ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}
              >
                <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${n.type === 'success' ? 'bg-emerald-50' : n.type === 'warning' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                  {getIcon(n.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      {n.title}
                      {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block shrink-0"></span>}
                    </h3>
                    <span className="text-[10px] whitespace-nowrap text-muted-foreground font-semibold ml-2">{formatTime(n.createdAt)}</span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{n.desc || n.message}</p>
                </div>
                <button 
                  onClick={(e) => deleteNotification(n._id || n.id, e)} 
                  className="shrink-0 self-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 rounded-full"
                  title="Delete Notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderNotifications;
