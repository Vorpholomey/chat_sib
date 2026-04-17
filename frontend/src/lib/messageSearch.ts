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

/** Body plus optional image caption for in-chat search. */
export function lineTextForSearch(line: ChatLine): string {
  const base = textForMessageSearch(line.body);
  const cap = line.caption?.trim()
    ? textForMessageSearch(line.caption)
    : "";
  return cap ? `${base} ${cap}`.trim() : base;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
