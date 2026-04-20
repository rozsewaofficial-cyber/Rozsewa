import { Link, useLocation, useNavigate } from "react-router-dom";
import React, { useState } from 'react';
import { useAuth } from "@/context/AuthContext";
import PinModal from "./PinModal";
import {
  LayoutDashboard, Users, UserCheck, CalendarDays, IndianRupee, Tag,
  MessageSquare, Briefcase, Settings, Image, ShieldCheck, CreditCard,
  Percent, Landmark, Map, Zap, Wallet, BarChart4, ShieldAlert,
  Database, HelpCircle, Megaphone, Terminal, ShieldAlert as SuperShield, Lock, LogOut
} from "lucide-react";

export const adminSidebarLinks = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/hrm", label: "HRM & Employees", icon: Briefcase },
  { path: "/admin/providers", label: "Providers", icon: UserCheck },
  { path: "/admin/sewaks", label: "Sewak Management", icon: Users },
  { path: "/admin/kyc", label: "KYC Verification", icon: ShieldCheck },
  { path: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { path: "/admin/dispatch", label: "Job Dispatching", icon: Zap },
  { path: "/admin/emergency", label: "24x7 Emergency", icon: ShieldAlert },
  { path: "/admin/99cards", label: "Vendor Card Sales", icon: CreditCard },
  { path: "/admin/commission", label: "Settlements", icon: Landmark },
  { path: "/admin/finance", label: "Finance & GST", icon: Wallet },
  { path: "/admin/earnings", label: "Earnings", icon: IndianRupee },
  { path: "/admin/offers", label: "Offers Approval", icon: Percent },
  { path: "/admin/coupons", label: "Coupons", icon: Tag },
  { path: "/admin/quality", label: "Quality & Disputes", icon: BarChart4 },
  { path: "/admin/zones", label: "Zones & Cities", icon: Map },
  { path: "/admin/promotions", label: "Global Promotions", icon: Megaphone },
  { path: "/admin/master-data", label: "Master Data", icon: Database },
  { path: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { path: "/admin/services", label: "Services Catalog", icon: Briefcase },
  { path: "/admin/banners", label: "App Banners", icon: Image },
  { path: "/admin/help-training", label: "Help & Training", icon: HelpCircle },
  { path: "/admin/activity-log", label: "System Logs", icon: Terminal },
  { path: "/admin/settings", label: "Global Settings", icon: Settings },
];

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Filter links based on admin permissions
  const filteredLinks = adminSidebarLinks.filter(link => {
    if (user?.role === 'superadmin') return true;
    if (user?.role === 'admin') {
      // If permissions array is empty, maybe allow all by default or strictly filter?
      // Usually, it should be strictly filtered.
      return user.permissions?.includes(link.path);
    }
    return false;
  });

  const handleSuperAdminClick = (e) => {
    e.preventDefault();
    setIsPinModalOpen(true);
  };

  return (
    <aside className="hidden md:flex h-screen w-68 flex-col border-r border-blue-100/50 bg-[#f8fbff] sticky top-0 py-6 transition-colors duration-300">
      <div className="px-6 mb-8">
        <Link to="/admin" className="flex items-center space-x-2 group">
          <div className="relative">
            <img src="/RozSewa.png" alt="RozSewa Admin" className="h-[2rem] w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform" />
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-1.5 scrollbar-hide">
        {filteredLinks.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${isActive
                ? "bg-white text-blue-700 shadow-[0_4px_12px_rgba(59,130,246,0.08)] border border-blue-50"
                : "text-slate-500 hover:bg-white/50 hover:text-blue-600"
                }`}
            >
              <link.icon className={`h-4.5 w-4.5 ${isActive ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"}`} />
              {link.label}
            </Link>
          );
        })}

        {user?.role === 'superadmin' && (
          <div className="pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={handleSuperAdminClick}
              className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm font-black transition-all ${location.pathname === "/admin/super"
                ? "bg-amber-50 text-amber-700 shadow-sm"
                : "text-amber-600 hover:bg-amber-50"
                }`}
            >
              <div className="flex items-center gap-3">
                <SuperShield className={`h-4.5 w-4.5 ${location.pathname === "/admin/super" ? "text-amber-600" : "text-amber-500"}`} />
                Super Admin
              </div>
              <Lock className="h-3.5 w-3.5 opacity-50" />
            </button>
          </div>
        )}
      </div>

      <div className="px-6 mt-auto pt-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm ${user?.role === 'superadmin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
            }`}>
            {user?.name?.charAt(0) || 'AD'}
          </div>
          <div>
            <p className="text-xs font-black text-gray-900">{user?.name || 'Admin'}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
              {user?.role === 'superadmin' ? 'Super Administrator' : 'Administrator'}
            </p>
          </div>
          <button
            onClick={() => {
              logout();
              window.location.replace("/admin/login");
            }}
            className="ml-auto p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
  );
};

export default AdminSidebar;
