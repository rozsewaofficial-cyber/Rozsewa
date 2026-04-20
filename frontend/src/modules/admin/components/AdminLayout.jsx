import { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminTopNav from "./AdminTopNav";
import AdminMobileNav from "./AdminMobileNav";
import { useAuth } from "@/context/AuthContext";

const AdminLayout = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [title, setTitle] = useState("Dashboard");

  useEffect(() => {
    const isAdmin = role === 'admin' || role === 'superadmin';
    if (!loading && (!user || !isAdmin)) {
      navigate("/admin/login");
      return;
    }

    // Permission check for regular admins
    if (!loading && role === 'admin' && location.pathname !== '/admin') {
      const currentPath = location.pathname;
      const isAllowed = user.permissions?.some(p => currentPath === p || currentPath.startsWith(`${p}/`));
      if (!isAllowed) {
        navigate("/admin"); // Redirect to dashboard
      }
    }

    // Force light mode for admin module
    document.documentElement.classList.remove("dark");
  }, [navigate, user, role, loading, location.pathname]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f1f7fe] text-gray-900 font-sans light selection:bg-blue-200">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopNav title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <Outlet context={{ setTitle }} />
        </main>
        <AdminMobileNav />
      </div>
    </div>
  );
};

export default AdminLayout;
