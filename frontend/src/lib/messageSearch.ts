import type { ChatLine } from "../types/chat";
import { looksLikeRichHtml } from "./richText";

/** Strip tags loosely so rich/HTML bodies can be matched by substring like plain text. */
export function textForMessageSearch(body: string): string {
  if (!body) return "";
  if (looksLikeRichHtml(body)) {
    return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return body;
}

/** Searchable text for in-chat search: message body for text; caption only for image/gif (body is storage path, not user text). */
export function lineTextForSearch(line: ChatLine): string {
  if (line.contentType === "image" || line.contentType === "gif") {
    return line.caption?.trim()
      ? textForMessageSearch(line.caption)
      : "";
  }
  return textForMessageSearch(line.body);
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
