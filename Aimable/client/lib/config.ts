const rawBase = import.meta.env.VITE_API_BASE;

if (!rawBase) {
  throw new Error(
    "VITE_API_BASE is missing. Add it in the frontend environment variables.",
  );
}

// Remove any trailing slash
export const API_BASE = rawBase.replace(/\/+$/, "");

export function api(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export default API_BASE;

