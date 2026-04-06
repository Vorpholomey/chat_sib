import DOMPurify from "dompurify";

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName === "A" && node instanceof HTMLAnchorElement) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

const PURIFY = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "a"],
  ALLOWED_ATTR: ["href"] as string[],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeMessageHtml(html: string): string {
  return String(DOMPurify.sanitize(html, PURIFY));
}

/** Heuristic: stored rich text uses HTML tags (not plain "hello <3"). */
export function looksLikeRichHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s.trim());
}

export function plainTextToEditableHtml(plain: string): string {
  const div = document.createElement("div");
  div.textContent = plain;
  return div.innerHTML.replace(/\n/g, "<br>");
}

export function isRichTextEmpty(html: string): boolean {
  const clean = sanitizeMessageHtml(html);
  const tmp = document.createElement("div");
  tmp.innerHTML = clean;
  const t = (tmp.textContent || "").replace(/\u00a0/g, " ").trim();
  return !t;
}

export function htmlToPlainPreview(html: string, maxLen = 160): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = sanitizeMessageHtml(html);
  const text = (tmp.textContent || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

/** Short plain snippet for reply rows (strips HTML when present). */
export function messagePlainPreview(body: string, maxLen = 500): string {
  if (!looksLikeRichHtml(body)) {
    const t = body.trim();
    if (t.length > maxLen) return `${t.slice(0, maxLen)}…`;
    return t;
  }
  return htmlToPlainPreview(body, maxLen);
}
