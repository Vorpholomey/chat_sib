import { looksLikeRichHtml } from "./richText";

/** Strip tags loosely so rich/HTML bodies can be matched by substring like plain text. */
export function textForMessageSearch(body: string): string {
  if (!body) return "";
  if (looksLikeRichHtml(body)) {
    return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return body;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
