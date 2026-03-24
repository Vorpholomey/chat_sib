import axios from "axios";
import { toast } from "sonner";
import { API_BASE } from "./config";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser set multipart boundary for file uploads (JSON default breaks POST /upload)
  if (config.data instanceof FormData) {
    delete (config.headers as Record<string, unknown>)["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      toast.error("Session expired. Please sign in again.");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
