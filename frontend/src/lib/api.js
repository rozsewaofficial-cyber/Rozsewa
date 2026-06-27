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

export default API;
