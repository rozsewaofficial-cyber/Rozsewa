import { motion } from "framer-motion";
import { ArrowLeft, Bell, Sun, Moon, Clock, Wallet, Coins, Zap } from "lucide-react";
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
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletFlash, setWalletFlash] = useState(false);

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

    const fetchWalletBalance = async () => {
      try {
        const { data } = await API.get("/wallet");
        const newBal = data?.availableBalance ?? data?.balance ?? null;
        setWalletBalance(prev => {
          if (prev !== null && prev !== newBal) {
            setWalletFlash(true);
            setTimeout(() => setWalletFlash(false), 800);
          }
          return newBal;
        });
      } catch {}
    };

    fetchUnread();
    fetchWalletBalance();

    const handleNewNotif = () => {
      fetchUnread();
      fetchWalletBalance();
    };
    const handleWalletUpdate = () => {
      fetchWalletBalance();
    };
    const handleFocus = () => { fetchUnread(); fetchWalletBalance(); };
    window.addEventListener('NEW_NOTIFICATION', handleNewNotif);
    window.addEventListener('WALLET_UPDATED', handleWalletUpdate);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('NEW_NOTIFICATION', handleNewNotif);
      window.removeEventListener('WALLET_UPDATED', handleWalletUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, location.pathname]);

  const showFull = !((user?.role === 'sewak' || user?.providerCategory === 'sewak') ? !user?.kycVerified : user?.status !== 'verified');
  // One look for every icon button; each keeps only a touch of colour on its icon.
  const iconBtn = "relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-1 ring-black/5 transition-colors hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/10";
  const initial = (user?.ownerName || user?.name || user?.shopName || "R").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-white/90 backdrop-blur-md dark:border-white/5 dark:bg-slate-950/85">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link to="/provider" className="group shrink-0">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-black/5 transition-transform group-hover:scale-105 dark:ring-white/10">
              {/* The SR monogram alone — the full logo (wordmark + tagline) was
                  unreadable at this size, and the name is written right beside it. */}
              <img src="/assets/logo-mark.png" alt="RozSewa" className="h-full w-full object-contain" />
            </div>
          </Link>

          {showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/provider')}
              className={iconBtn}
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </motion.button>
          )}

          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[15px] font-black tracking-tight text-slate-900 dark:text-white">
              Roz<span className="text-emerald-600 dark:text-emerald-400">Sewa</span>
            </span>
            <span className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {title || "Pro Dashboard"}
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500 ring-1 ring-black/5 dark:bg-white/[0.06] dark:text-slate-400 dark:ring-white/10">
          <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>{currentTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {currentTime.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <motion.button onClick={toggleTheme} whileTap={{ scale: 0.9 }} className={iconBtn} aria-label="Switch theme" title="Switch theme">
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </motion.button>

          {user && (
            <>
              {walletBalance !== null && (
                <Link
                  to="/provider/wallet"
                  className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black ring-1 transition-all duration-300 ${
                    walletFlash ? 'scale-105 ring-2 ring-emerald-400' : 'scale-100'
                  } ${
                    walletBalance < 0
                      ? 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:ring-rose-800'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800'
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>{walletBalance < 0 ? `Dues ₹${Math.abs(walletBalance).toLocaleString('en-IN')}` : `₹${walletBalance.toLocaleString('en-IN')}`}</span>
                </Link>
              )}

              {showFull && (
                <Link to="/provider/insta-work" title="Insta Work" aria-label="Insta Work" className={iconBtn}>
                  <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                </Link>
              )}

              {showFull && (
                <Link to="/provider/coins" title="RozSewa Coins" aria-label="RozSewa Coins" className={iconBtn}>
                  <Coins className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                </Link>
              )}

              {/* Always shown: admin's KYC/document messages come before approval. */}
              <Link to="/provider/notifications" title="Notifications" aria-label="Notifications" className={iconBtn}>
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-950">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                to="/provider/profile"
                title="Profile"
                aria-label="Profile"
                className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white ring-2 ring-emerald-500/30 transition-transform hover:scale-105"
              >
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default ProviderTopNav;
