/** API base for production; in dev Vite proxy uses same-origin relative paths. */
export const API_BASE =
  import.meta.env.DEV ? "" : import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export function assetUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = import.meta.env.DEV
    ? window.location.origin
    : import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function wsChatUrl(token: string): string {
  const enc = encodeURIComponent(token);
  if (import.meta.env.DEV) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws/chat?token=${enc}`;
  }
  const api = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  const u = new URL(api);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws/chat";
  u.search = `?token=${enc}`;
  return u.toString();
}
