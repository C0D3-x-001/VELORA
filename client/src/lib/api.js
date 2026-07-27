import axios from "axios";

const rawBase = import.meta.env.VITE_API_URL || "";
const baseURL = rawBase ? rawBase.replace(/\/+$/, "") : "/api/v1";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 60000,
});

api.interceptors.request.use(async (config) => {
  if (window.Clerk?.session) {
    try {
      const token = await window.Clerk.session.getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      console.warn("[API] Failed to get auth token:", err.message);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message || "Something went wrong";
    const err = new Error(message);
    err.status = error.response?.status;
    err.data = error.response?.data;
    return Promise.reject(err);
  }
);

export default api;
