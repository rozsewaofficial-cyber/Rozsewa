import { Navigate, useLocation } from "react-router-dom";

const STORAGE_KEY = "rozsewa_auth_trainer";

/**
 * Standalone auth gate for the Trainer surface — deliberately not wired into
 * the shared AuthContext/ProtectedRoute (which is tightly coupled to the
 * customer/provider/admin role trio). Keeping Trainer auth self-contained
 * means it can't accidentally widen or destabilize those existing flows.
 */
const TrainerProtectedRoute = ({ children }) => {
  const location = useLocation();
  const raw = localStorage.getItem(STORAGE_KEY);
  const token = raw ? JSON.parse(raw)?.token : null;

  if (!token) {
    return <Navigate to="/trainer/login" state={{ from: location }} replace />;
  }

  return children;
};

export default TrainerProtectedRoute;
export { STORAGE_KEY };
