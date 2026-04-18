import { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import API from "@/lib/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const getStorageKey = (path) => {
  if (path.startsWith("/provider")) return "rozsewa_auth_provider";
  if (path.startsWith("/admin")) return "rozsewa_auth_admin";
  return "rozsewa_auth";
};

export const AuthProvider = ({ children }) => {
  const location = useLocation();
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem(getStorageKey(window.location.pathname));
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(() => {
    const saved = localStorage.getItem("rozsewa_user_location");
    return saved ? JSON.parse(saved) : null;
  });

  const detectLocation = () => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          localStorage.setItem("rozsewa_user_location", JSON.stringify(loc));
          resolve(loc);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  // Sync auth state when path changes (switching between panels)
  useEffect(() => {
    const checkAuthStatus = async () => {
      const path = location.pathname;
      const expectedRole = path.startsWith("/admin") ? "admin" : path.startsWith("/provider") ? "provider" : "customer";

      // If the current auth doesn't match the panel we are in, re-sync
      if (auth?.role !== expectedRole) {
        const key = getStorageKey(path);
        const saved = localStorage.getItem(key);
        if (saved) {
          setAuth(JSON.parse(saved));
        } else {
          setAuth(null);
        }
      }

      // Perform background profile check if we have a token
      const currentToken = auth?.token || JSON.parse(localStorage.getItem(getStorageKey(path)))?.token;
      if (currentToken) {
        try {
          const endpoint = path.startsWith("/provider") ? "/provider/profile" : "/auth/profile";
          const res = await API.get(endpoint);
          const userData = res.data;
          setAuth(prev => (prev ? { ...prev, ...userData } : null));

          // If no live GPS location, use user's saved location (only if it matches the current selected city context)
          const currentCity = localStorage.getItem("rozsewa_user_city");
          if (!localStorage.getItem("rozsewa_user_location") && userData.location?.coordinates) {
            const [lng, lat] = userData.location.coordinates;
            const isSameCity = !currentCity || currentCity.toLowerCase().includes((userData.city || "").toLowerCase());

            if (lat !== 0 && lng !== 0 && isSameCity) {
              const loc = { lat, lng };
              setUserLocation(loc);
              localStorage.setItem("rozsewa_user_location", JSON.stringify(loc));
            }
          }
        } catch (err) {
          console.error("Auth session expired", err);
          if (auth?.role === expectedRole) logout(); // Only logout if it was the active role
        }
      }
      setLoading(false);
    };
    checkAuthStatus();
  }, [location.pathname]);

  useEffect(() => {
    const key = getStorageKey(location.pathname);
    if (auth) localStorage.setItem(key, JSON.stringify(auth));
    else if (auth === null) localStorage.removeItem(key);
  }, [auth]);

  const login = async (identifier, password, type = 'customer') => {
    try {
      const endpoint = type === 'provider' ? "/provider/login" : "/auth/login";
      const loginData = type === 'provider' ? { mobile: identifier, password } : { identifier, password };

      const { data } = await API.post(endpoint, loginData);
      setAuth({ ...data, role: type }); // Ensure role is updated
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Login failed" };
    }
  };

  const signup = async (userData, type = 'customer') => {
    try {
      const endpoint = type === 'provider' ? "/provider/register" : "/auth/register";
      const { data } = await API.post(endpoint, userData);
      setAuth({ ...data, role: type });
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Registration failed" };
    }
  };

  const logout = () => {
    setAuth(null);
  };

  const value = {
    user: auth,
    isAuthenticated: !!auth,
    role: auth?.role || null,
    userLocation,
    detectLocation,
    loading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
