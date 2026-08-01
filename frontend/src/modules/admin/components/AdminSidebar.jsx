import { Link, useLocation, useNavigate } from "react-router-dom";
import React, { useState } from 'react';
import { useAuth } from "@/context/AuthContext";
import PinModal from "./PinModal";
import { useSocket } from "@/context/SocketContext";
import {
  LayoutDashboard, Users, UserCheck, CalendarDays, IndianRupee, Tag,
  MessageSquare, Briefcase, Settings, Image, ShieldCheck, CreditCard,
  Percent, Landmark, Map, Zap, Wallet, BarChart4, ShieldAlert, TrendingUp,
  HelpCircle, Megaphone, Terminal, ShieldAlert as SuperShield, Lock, LogOut, UserPlus, History, Moon, MapPin, Recycle, FileText, Coins
} from "lucide-react";

export const adminSidebarLinks = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/bazaar", label: "Bazaar Ads", icon: Recycle },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/supervisors", label: "Supervisors", icon: ShieldCheck },
  { path: "/admin/employees", label: "Employees", icon: Users },
  { path: "/admin/providers", label: "Providers", icon: UserCheck },
  { path: "/admin/subscriptions", label: "Subscription Plans", icon: CreditCard },
  { path: "/admin/provider-subscriptions", label: "Provider & Sewak Subscriptions", icon: ShieldCheck },
  { path: "/admin/sewaks", label: "Sewak Management", icon: Users },
  { path: "/admin/sewak-enquiries", label: "Sewak Enquiries", icon: MessageSquare },
  { path: "/admin/verify-sewaks", label: "Verify Sewaks", icon: UserPlus },
  { path: "/admin/verify-employees", label: "Verify Employees", icon: UserPlus },
  { path: "/admin/verify-combos", label: "Verify Combos", icon: UserPlus },
  { path: "/admin/sewak-pricing", label: "Sewak Pricing Management", icon: IndianRupee },
  // { path: "/admin/kyc", label: "KYC Verification", icon: ShieldCheck },
  { path: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { path: "/admin/leads", label: "Leads Management", icon: Briefcase },
  { path: "/admin/dispatch", label: "Job Dispatching", icon: Zap },
  { path: "/admin/emergency", label: "24x7 Emergency", icon: ShieldAlert },
  { path: "/admin/99cards", label: "Registration / 99 Cards", icon: CreditCard },
  { path: "/admin/commission", label: "Settlements", icon: Landmark },
  // { path: "/admin/finance", label: "Finance & GST", icon: Wallet },
  { path: "/admin/earnings", label: "Earnings", icon: IndianRupee },
  { path: "/admin/withdrawals", label: "Withdrawal Requests", icon: Landmark },

  { path: "/admin/coupons", label: "Coupons", icon: Tag },
  { path: "/admin/provider-reports", label: "Provider Reports", icon: ShieldAlert },
  { path: "/admin/reports", label: "User Reports", icon: MessageSquare },
  { path: "/admin/zones", label: "Zones & Cities", icon: Map },

  { path: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { path: "/admin/support", label: "Support Tickets", icon: HelpCircle },
  { path: "/admin/services", label: "Services Catalog", icon: Briefcase },
  { path: "/admin/benefit-policies", label: "Benefit Policies", icon: ShieldCheck },
  { path: "/admin/banners", label: "App Banners", icon: Image },
  { path: "/admin/provider-banners", label: "Provider Banners", icon: Megaphone },
  { path: "/admin/help-training", label: "Help & Training", icon: HelpCircle },
  { path: "/admin/activity-log", label: "System Logs", icon: Terminal },
  { path: "/admin/commission-analytics", label: "Commission Analytics", icon: TrendingUp },
  { path: "/admin/partner-program", label: "Partner Program", icon: ShieldCheck },
  { path: "/admin/settings", label: "Global Settings", icon: Settings },
  { path: "/admin/fee-settings", label: "Fee Settings", icon: Coins },
  { path: "/admin/settings/cash-limits", label: "Cash Limits", icon: CreditCard },
  { path: "/admin/distance-charges", label: "Distance Charges", icon: MapPin },
  { path: "/admin/settings/service-radius", label: "Service Radius", icon: MapPin },
];

const AdminSidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadSosCount, pendingWithdrawalsCount } = useSocket();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter links based on admin permissions
  const filteredLinks = adminSidebarLinks.filter(link => {
    if (user?.role === 'superadmin') return true;
    if (user?.role === 'admin') {
      if (!user.permissions || user.permissions.length === 0) return true;
      return user.permissions.includes(link.path);
    }
    if (user?.role === 'supervisor') {
      if (link.path === "/admin/sewaks") {
        return user?.allowedCreationScope === 'all';
      }
      return link.path === "/admin/employees" || link.path === "/admin";
    }
    if (user?.role === 'employee') {
      return link.path === "/admin";
    }
    return false;
  }).filter(link => link.label.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSuperAdminClick = (e) => {
    e.preventDefault();
    setIsPinModalOpen(true);
  };

    return (
      <>
        {/* Mobile Overlay */}
        {isOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 h-screen w-68 flex flex-col border-r border-slate-800 bg-[#0B1120] py-6 transition-transform duration-300 ease-in-out md:sticky md:top-0 md:translate-x-0 ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
      <div className="px-6 mb-8 mt-2">
        <Link to="/admin" className="flex items-center gap-3 group">
          <div className="relative shrink-0">
            <img src="/RozSewa.png" alt="RozSewa Admin" className="h-10 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform brightness-0 invert opacity-90" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black text-white tracking-tight">RozSewa</span>
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-0.5">Admin Panel</span>
          </div>
        </Link>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search menu..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-1.5 sidebar-scrollbar pr-1">
        {filteredLinks.map((link) => {
          const isActive = location.pathname === link.path;
          const label = (link.path === "/admin/employees" && user?.role === 'supervisor') ? "My Team" : link.label;
          return (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${isActive
                ? "bg-blue-600 text-white shadow-lg border border-transparent"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                }`}
            >
              <div className="flex items-center gap-3">
                <link.icon className={`h-4.5 w-4.5 ${isActive ? "text-white" : "text-slate-500 group-hover:text-white"}`} />
                <span>{label}</span>
              </div>
              {link.path === "/admin/emergency" && unreadSosCount > 0 && (
                <span className="flex h-5 min-w-5 px-1 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white animate-pulse">
                  {unreadSosCount > 9 ? '9+' : unreadSosCount}
                </span>
              )}
              {link.path === "/admin/withdrawals" && pendingWithdrawalsCount > 0 && (
                <span className="flex h-5 min-w-5 px-1 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white">
                  {pendingWithdrawalsCount}
                </span>
              )}
            </Link>
          );
        })}

        {user?.role === 'superadmin' && (
          <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
            <button
              onClick={handleSuperAdminClick}
              className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm font-black transition-all ${location.pathname === "/admin/super"
                ? "bg-amber-500/10 text-amber-500 shadow-sm border border-amber-500/20"
                : "text-amber-500 hover:bg-amber-500/10"
                }`}
            >
              <div className="flex items-center gap-3">
                <SuperShield className={`h-4.5 w-4.5 ${location.pathname === "/admin/super" ? "text-amber-500" : "text-amber-600"}`} />
                Super Admin
              </div>
              <Lock className="h-3.5 w-3.5 opacity-50" />
            </button>
            
            <Link
              to="/admin/audit-logs"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-black transition-all ${location.pathname === "/admin/audit-logs"
                ? "bg-blue-500/10 text-blue-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-blue-400"
                }`}
            >
              <History className={`h-4.5 w-4.5 ${location.pathname === "/admin/audit-logs" ? "text-blue-400" : "text-slate-500"}`} />
              Audit Logs
            </Link>

            <Link
              to="/admin/sewak-incentives"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-black transition-all ${location.pathname === "/admin/sewak-incentives"
                ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-emerald-400"
                }`}
            >
              <Zap className={`h-4.5 w-4.5 ${location.pathname === "/admin/sewak-incentives" ? "text-emerald-400" : "text-slate-500"}`} />
              Sewak Incentives
            </Link>

            <Link
              to="/admin/night-charge"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-black transition-all ${location.pathname === "/admin/night-charge"
                ? "bg-indigo-500/10 text-indigo-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-indigo-400"
                }`}
            >
              <Moon className={`h-4.5 w-4.5 ${location.pathname === "/admin/night-charge" ? "text-indigo-400" : "text-slate-500"}`} />
              Night Charges
            </Link>
          </div>
        )}
      </div>

      <div className="px-6 mt-auto pt-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm overflow-hidden shrink-0 ${user?.role === 'superadmin' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-400'
            }`}>
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
              className="h-full w-full items-center justify-center font-bold text-sm"
              style={{ display: user?.avatar || user?.profileImage ? 'none' : 'flex' }}
            >
              {user?.name?.charAt(0) || 'AD'}
            </span>
          </div>
          <div>
            <p className="text-xs font-black text-white">{user?.name || 'Admin'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
              {user?.role === 'superadmin' ? 'Super Administrator' : 
               user?.role === 'supervisor' ? 'Supervisor' : 
               user?.role === 'employee' ? 'Employee' : 'Administrator'}
            </p>
          </div>
          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to logout?")) {
                await logout();
                window.location.replace("/admin/login");
              }
            }}
            className="ml-auto p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={() => navigate("/admin/super")}
      />
    </aside>
    </>
  );
};

export default AdminSidebar;
