/** API base for production; in dev Vite proxy uses same-origin relative paths. */
export const API_BASE =
  import.meta.env.DEV ? "" : import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/**
 * Resolves upload/media paths for <img src>. Rejects protocol-relative URLs,
 * non-http(s) absolute URLs, and strings that look like `javascript:` / `data:` schemes.
 */
export function assetUrl(path: string): string {
  if (!path) return "";
  const t = path.trim();
  if (t.startsWith("//")) return "";
  if (t.startsWith("http://") || t.startsWith("https://")) {
    try {
      const u = new URL(t);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.href;
    } catch {
      return "";
    }
  }
  const head = t.split(/[/\\?#]/)[0] ?? "";
  if (/^[a-z][a-z0-9+.-]*:$/i.test(head) || /^[a-z][a-z0-9+.-]*:/i.test(t)) {
    return "";
  }
  const base = import.meta.env.DEV
    ? window.location.origin
    : import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  return `${base.replace(/\/$/, "")}${t.startsWith("/") ? t : `/${t}`}`;
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
