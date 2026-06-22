import { useState, useEffect } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { Bell, CheckCircle, Info, AlertTriangle, Loader2 } from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const ProviderNotifications = () => {
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

  const getIcon = (type) => {
    switch (type) {
      case "success": return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      <main className="container max-w-4xl px-0 sm:px-4 py-4 md:py-8">
        <div className="px-4 sm:px-0 mb-4 md:mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">Notifications</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">Stay updated with your business activities.</p>
          </div>
          {hasUnread && (
            <button onClick={markAllRead} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              Mark all read
            </button>
          )}
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
              <div key={n._id || n.id} className={`p-4 md:p-6 flex gap-4 hover:bg-muted/20 transition-colors ${!n.isRead ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
                <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${n.type === 'success' ? 'bg-emerald-50' : n.type === 'warning' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                  {getIcon(n.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      {n.title}
                      {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block shrink-0"></span>}
                    </h3>
                    <span className="text-[10px] whitespace-nowrap text-muted-foreground font-semibold ml-2">{n.time || new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{n.desc || n.message}</p>
                </div>
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
