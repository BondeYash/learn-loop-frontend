import axios from "axios";
const configuredUrl = import.meta.env?.VITE_API_URL;
export const API_BASE = configuredUrl && /^(\/|https?:\/\/)/.test(configuredUrl) ? configuredUrl.replace(/\/$/, "") : "/api";
const axiosInstance = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 30_000, headers: { "Content-Type": "application/json" } });
axiosInstance.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !error.config?.url?.startsWith("/auth/")) window.dispatchEvent(new Event("lms-session-expired"));
  return Promise.reject(error);
});
export const errorMessage = (error) => error.response?.data?.errors?.[0]?.msg || error.response?.data?.message || (error.code === "ECONNABORTED" ? "The request timed out. Please retry." : error.message) || "Something went wrong. Please retry.";
export default axiosInstance;
