const rawBase = (import.meta.env.VITE_API_BASE as string) ?? "http://127.0.0.1:8000";
// normalize: remove trailing slash(es)
export const API_BASE: string = rawBase.replace(/\/+$|(?=^$)/, "");

export function api(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export default API_BASE;
