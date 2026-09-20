/**
 * Central API Configuration for Local & Cloud Deployments (Railway, Render, Vercel)
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "https://trado-production-0011.up.railway.app";

export const apiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
};
