import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles = ["customer"] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center bg-transparent">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Check if authenticated
  if (!isAuthenticated) {
    const loginPath = location.pathname.startsWith('/provider') ? "/provider/login" :
      location.pathname.startsWith('/admin') ? "/admin/login" : "/login";
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Check role-based access
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Mandatory check for providers: Must be approved to access features other than the base dashboard
  if (user?.role === 'provider' && user?.status !== 'approved' && location.pathname !== '/provider') {
    return <Navigate to="/provider" replace />;
  }

  return children;
};

export default ProtectedRoute;
