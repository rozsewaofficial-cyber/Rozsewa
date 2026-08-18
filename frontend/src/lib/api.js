import axios from "axios";

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
    headers: {},
});

// Add a request interceptor to attach JWT token
API.interceptors.request.use(
    (config) => {
        // Determine storage key based on current path to avoid session conflicts, with fallbacks for cross-panel access
        let storageKey = "rozsewa_auth";
        const path = window.location.pathname;
        if (path.startsWith("/provider")) {
            storageKey = "rozsewa_auth_provider";
        } else if (path.startsWith("/admin")) {
            storageKey = "rozsewa_auth_admin";
        } else if (path.startsWith("/trainer")) {
            storageKey = "rozsewa_auth_trainer";
        } else {
            // On customer-facing routes, check customer session first, then fall back to provider or admin session
            const hasCustomerToken = JSON.parse(localStorage.getItem("rozsewa_auth") || "null")?.token;
            if (!hasCustomerToken) {
                if (JSON.parse(localStorage.getItem("rozsewa_auth_provider") || "null")?.token) {
                    storageKey = "rozsewa_auth_provider";
                } else if (JSON.parse(localStorage.getItem("rozsewa_auth_admin") || "null")?.token) {
                    storageKey = "rozsewa_auth_admin";
                }
            }
        }

        const authData = JSON.parse(localStorage.getItem(storageKey));
        if (authData?.token) {
            config.headers.Authorization = `Bearer ${authData.token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add a response interceptor to handle token expiration/401 unauthorized errors globally
API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            const path = window.location.pathname;
            // Prevent redirect loop if already on login pages
            if (!path.includes("/login")) {
                localStorage.removeItem("rozsewa_auth");
                localStorage.removeItem("rozsewa_auth_admin");
                localStorage.removeItem("rozsewa_auth_provider");
                localStorage.removeItem("rozsewa_auth_user");
                localStorage.removeItem("rozsewa_auth_trainer");

                let redirectPath = "/login";
                if (path.startsWith("/admin")) {
                    redirectPath = "/admin/login";
                } else if (path.startsWith("/provider")) {
                    redirectPath = "/provider/login";
                } else if (path.startsWith("/trainer")) {
                    redirectPath = "/trainer/login";
                }

                // Force browser redirect to login
                window.location.replace(redirectPath);
            }
        }
        return Promise.reject(error);
    }
);

export default API;
