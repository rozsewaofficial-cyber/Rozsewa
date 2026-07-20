import { createContext, useContext, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => {
    const key = getStorageKey(window.location.pathname);
    let saved = localStorage.getItem(key);
    if (!saved && key === "rozsewa_auth") {
      saved = localStorage.getItem("rozsewa_auth_provider") || localStorage.getItem("rozsewa_auth_admin");
    }
    return saved ? JSON.parse(saved) : null;
  });

  const [prevPath, setPrevPath] = useState(location.pathname);

  // Sync auth state synchronously during render if pathname changes
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);

    const path = location.pathname;
    const isPageAdmin = path.startsWith("/admin");
    const isPageProvider = path.startsWith("/provider");

    const isCustomerPanelMatch = auth && !isPageProvider && !isPageAdmin;
    const isProviderPanelMatch = (auth?.role === 'provider' || auth?.role === 'sewak') && isPageProvider;
    const isAdminPanelMatch = (auth?.role === 'admin' || auth?.role === 'superadmin' || auth?.role === 'supervisor') && isPageAdmin;

    const isMatch = isCustomerPanelMatch || isProviderPanelMatch || isAdminPanelMatch;

    if (!isMatch && auth) {
      const key = getStorageKey(path);
      let saved = localStorage.getItem(key);
      if (!saved && key === "rozsewa_auth") {
        saved = localStorage.getItem("rozsewa_auth_provider") || localStorage.getItem("rozsewa_auth_admin");
      }
      if (saved) {
        setAuth(JSON.parse(saved));
      } else {
        setAuth(null);
      }
    } else if (!auth) {
      const key = getStorageKey(path);
      let saved = localStorage.getItem(key);
      if (!saved && key === "rozsewa_auth") {
        saved = localStorage.getItem("rozsewa_auth_provider") || localStorage.getItem("rozsewa_auth_admin");
      }
      if (saved) {
        setAuth(JSON.parse(saved));
      }
    }
  }

  const [loading, setLoading] = useState(!auth); // Only block UI on first mount if no cached auth
  const [userLocation, setUserLocation] = useState(() => {
    const saved = sessionStorage.getItem("rozsewa_user_location");
    return saved ? JSON.parse(saved) : null;
  });
  const [userCity, setUserCity] = useState(() => {
    return sessionStorage.getItem("rozsewa_user_city") || "";
  });

  const [serviceMode, setServiceMode] = useState(() => {
    return localStorage.getItem("rozsewa_service_mode") || "partner";
  });

  useEffect(() => {
    localStorage.setItem("rozsewa_service_mode", serviceMode);
  }, [serviceMode]);

  const detectLocation = () => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          sessionStorage.setItem("rozsewa_user_location", JSON.stringify(loc));

          try {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            
            if (apiKey) {
              // Google Maps Reverse Geocoding
              const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}&key=${apiKey}`);
              const data = await res.json();
              
              if (data.results && data.results.length > 0) {
                const addressComponents = data.results[0].address_components;
                const cityComponent = addressComponents.find(c => c.types.includes('locality')) || 
                                      addressComponents.find(c => c.types.includes('administrative_area_level_2'));
                
                if (cityComponent) {
                  sessionStorage.setItem("rozsewa_user_city", cityComponent.long_name);
                  setUserCity(cityComponent.long_name);
                }
              }
            } else {
              // Fallback to OpenStreetMap if no Google API key is set
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}`);
              const data = await res.json();
              const detectedCity = data.address?.city || data.address?.town || data.address?.village || "";
              if (detectedCity) {
                sessionStorage.setItem("rozsewa_user_city", detectedCity);
                setUserCity(detectedCity);
              }
            }
          } catch (e) {
            console.error("Reverse geocoding failed on startup:", e);
          }

          resolve(loc);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  // Sync panel body classes when path changes
  useEffect(() => {
    const isPageProvider = location.pathname.startsWith("/provider");
    if (isPageProvider) {
      document.body.classList.add('provider-panel');
    } else {
      document.body.classList.remove('provider-panel');
    }
  }, [location.pathname]);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const path = location.pathname;
      const isPageAdmin = path.startsWith("/admin");
      const isPageProvider = path.startsWith("/provider");

      let expectedRole = "customer";
      if (isPageAdmin) {
        expectedRole = (auth?.role === 'superadmin' || auth?.role === 'supervisor') ? auth.role : "admin";
      } else if (isPageProvider) {
        expectedRole = "provider";
      }

      // Check if current auth role is valid for the current panel
      const isCustomerPanelMatch = (auth?.role === 'customer' || auth?.role === 'user') && !isPageProvider && !isPageAdmin;
      const isProviderPanelMatch = (auth?.role === 'provider' || auth?.role === 'sewak') && isPageProvider;
      const isAdminPanelMatch = (auth?.role === 'admin' || auth?.role === 'superadmin' || auth?.role === 'supervisor') && isPageAdmin;

      const isMatch = isCustomerPanelMatch || isProviderPanelMatch || isAdminPanelMatch;

      // If the current auth doesn't match the panel we are in, re-sync from localStorage
      if (!isMatch && auth) {
        const key = getStorageKey(path);
        const saved = localStorage.getItem(key);
        if (saved) {
          setAuth(JSON.parse(saved));
        }
      } else if (!auth) {
        const key = getStorageKey(path);
        const saved = localStorage.getItem(key);
        if (saved) {
          setAuth(JSON.parse(saved));
        }
      }

      // Perform background profile check if we have a token
      const currentToken = auth?.token || JSON.parse(localStorage.getItem(getStorageKey(path)))?.token;
      if (currentToken) {
        try {
          const endpoint = path.startsWith("/provider") ? "/provider/profile" : "/auth/profile";
          const res = await API.get(endpoint);
          const userData = res.data;

          setAuth(prev => {
            if (prev) return { ...prev, ...userData, role: userData.role || prev.role };
            const saved = JSON.parse(localStorage.getItem(getStorageKey(path)) || "{}");
            return { ...saved, ...userData, token: currentToken, role: userData.role || saved.role };
          });

          // If no live GPS location, use user's saved location
          const currentCity = sessionStorage.getItem("rozsewa_user_city");
          if (!sessionStorage.getItem("rozsewa_user_location") && userData.location?.coordinates) {
            const [lng, lat] = userData.location.coordinates;
            const isSameCity = !currentCity || currentCity.toLowerCase().includes((userData.city || "").toLowerCase());

            if (lat !== 0 && lng !== 0 && isSameCity) {
              const loc = { lat, lng };
              setUserLocation(loc);
              sessionStorage.setItem("rozsewa_user_location", JSON.stringify(loc));
            }
          }
        } catch (err) {
          console.error("Profile check failed:", err);
        }
      }
      setLoading(false);
    };

    checkAuthStatus();
  }, [location.pathname]);

  useEffect(() => {
    if (auth) {
      const role = auth.role;
      let key = "rozsewa_auth";
      if (role === 'provider' || role === 'sewak') key = "rozsewa_auth_provider";
      else if (role === 'admin' || role === 'superadmin' || role === 'supervisor') key = "rozsewa_auth_admin";
      localStorage.setItem(key, JSON.stringify(auth));
    } else if (auth === null) {
      const key = getStorageKey(location.pathname);
      localStorage.removeItem(key);
    }
  }, [auth, location.pathname]);

  // Foreground Notification Listener
  useEffect(() => {
    let unsubscribe;
    const setup = async () => {
      try {
        const { onMessage } = await import("firebase/messaging");
        const { messaging, requestForToken } = await import("@/lib/firebase");

        // Sync token on startup if logged in
        if (auth && auth.token && Notification.permission === 'granted') {
          try {
            const fcmToken = await requestForToken();
            if (fcmToken) {
              await API.post("/notifications/fcm-tokens/save",
                { token: fcmToken, platform: 'web' },
                { headers: { Authorization: `Bearer ${auth.token}` } }
              );
            }
          } catch (e) {
            console.error("Error syncing FCM token on load:", e);
          }
        }

        unsubscribe = onMessage(messaging, (payload) => {
          console.log('Foreground message received:', payload);

          if (Notification.permission === 'granted') {
            const notif = new Notification(payload.notification.title, {
              body: payload.notification.body,
              icon: '/RozSewa.png',
              data: payload.data
            });

            notif.onclick = (event) => {
              event.preventDefault();
              window.focus();

              const data = notif.data || payload.data;
              if (data) {
                const targetLink = data.link || data.url || 
                  (data.type === 'booking' ? (data.userRole === 'provider' ? '/provider/bookings' : '/tracking') : 
                   (data.type === 'lead' || data.leadId) ? (
                     data.userRole === 'admin' ? '/admin/leads' :
                     data.userRole === 'provider' ? '/provider/leads' : '/my-leads'
                   ) : '');
                if (targetLink) {
                  navigate(targetLink);
                }
              }
            };
          }
        });
      } catch (err) {
        console.error("Error setting up foreground listener:", err);
      }
    };

    setup();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [navigate]);

  // Sync FCM token with backend when authenticated on startup/reload
  useEffect(() => {
    if (auth && auth.token) {
      const syncFCMToken = async () => {
        try {
          const { requestForToken } = await import("@/lib/firebase");
          const token = await requestForToken();
          if (token) {
            await API.post("/notifications/fcm-tokens/save", 
              { token, platform: 'web' },
              { headers: { Authorization: `Bearer ${auth.token}` } }
            );
            localStorage.setItem("rozsewa_last_fcm_token", token);
            console.log("FCM Token successfully synced with backend.");
          }
        } catch (err) {
          console.error("Error syncing FCM token:", err);
        }
      };

      // Delay execution slightly to ensure it doesn't block critical page load
      const timer = setTimeout(syncFCMToken, 2000);
      return () => clearTimeout(timer);
    }
  }, [auth]);

  const login = async (identifier, password, type = 'customer') => {
    try {
      const isProviderOrSewak = type === 'provider' || type === 'sewak';
      const endpoint = isProviderOrSewak ? "/provider/login" : "/auth/login";
      const loginData = isProviderOrSewak ? { mobile: identifier, password } : { identifier, password };

      const { data: apiResponse } = await API.post(endpoint, loginData);

      const authData = apiResponse.data?.user || apiResponse;
      const isActuallySewak = authData.providerCategory === 'sewak' || authData.role === 'sewak' || authData.vendorType === 'sewak' || (authData.vendorCode && (authData.vendorCode.startsWith('RSSEW') || authData.vendorCode.startsWith('RSSEWK')));

      if (type === 'sewak' && !isActuallySewak) throw new Error("This account is not registered as a Sewak.");
      if (type === 'provider' && isActuallySewak) throw new Error("Please login through the Sewak portal.");

      const token = apiResponse.data?.token || apiResponse.token;
      const sessionData = { ...authData, token, role: authData.role || type };
      setAuth(sessionData);

      try {
        const { requestForToken } = await import("@/lib/firebase");
        const fcmToken = await requestForToken();
        if (fcmToken) {
          await API.post("/notifications/fcm-tokens/save",
            { token: fcmToken, platform: 'web' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch (err) {
        console.error("Error saving FCM token on login", err);
      }

      return { success: true, data: sessionData };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Login failed" };
    }
  };

  const loginWithOTP = async (mobile, otp, type = 'customer') => {
    try {
      const { data: apiResponse } = await API.post("/auth/login-otp", { mobile, otp, type });

      const authData = apiResponse.data?.user || apiResponse;
      const token = apiResponse.data?.token || apiResponse.token;

      const sessionData = { ...authData, token, role: type };
      setAuth(sessionData);

      try {
        const { requestForToken } = await import("@/lib/firebase");
        const fcmToken = await requestForToken();
        if (fcmToken) {
          await API.post("/notifications/fcm-tokens/save",
            { token: fcmToken, platform: 'web' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          localStorage.setItem("rozsewa_last_fcm_token", fcmToken);
        }
      } catch (err) {
        console.error("Error saving FCM token on OTP login", err);
      }

      return { success: true, data: sessionData };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "OTP Verification failed" };
    }
  };

  const signup = async (userData, type = 'customer') => {
    try {
      const endpoint = type === 'provider' ? "/provider/register" : "/auth/register";
      const { data } = await API.post(endpoint, userData);
      setAuth({ ...data, role: type });

      try {
        const { requestForToken } = await import("@/lib/firebase");
        const token = await requestForToken();
        if (token) {
          await API.post("/notifications/fcm-tokens/save",
            { token, platform: 'web' },
            { headers: { Authorization: `Bearer ${data.token}` } }
          );
        }
      } catch (err) {
        console.error("Error saving FCM token on signup", err);
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Registration failed" };
    }
  };

  const logout = async () => {
    try {
      const lastToken = localStorage.getItem("rozsewa_last_fcm_token");
      if (lastToken && auth?.token) {
        // Send request to backend to delete token
        await API.delete("/notifications/fcm-tokens/remove", { 
          data: { token: lastToken },
          headers: { Authorization: `Bearer ${auth.token}` }
        });
      }
    } catch (err) {
      console.error("Error removing FCM token on logout:", err);
    }
    localStorage.removeItem("rozsewa_auth_user");
    localStorage.removeItem("rozsewa_auth_admin");
    localStorage.removeItem("rozsewa_auth_provider");
    localStorage.removeItem("rozsewa_auth");
    localStorage.removeItem("rozsewa_last_fcm_token");
    setAuth(null);
  };

  const updateUser = (newData) => {
    setAuth(prev => {
      if (!prev) return null;
      return { ...prev, ...newData };
    });
  };

  const value = {
    user: auth,
    isAuthenticated: !!auth,
    role: auth?.role || null,
    userLocation,
    userCity,
    setUserCity,
    detectLocation,
    loading,
    login,
    loginWithOTP,
    signup,
    logout,
    updateUser,
    serviceMode,
    setServiceMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
