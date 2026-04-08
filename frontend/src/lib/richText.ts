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

/** After search-highlight injection into already-sanitized HTML. */
const PURIFY_WITH_MARK = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "a", "mark"],
  ALLOWED_ATTR: ["href"] as string[],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeMessageHtml(html: string): string {
  return String(DOMPurify.sanitize(html, PURIFY));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wrap case-insensitive matches in `<mark>` for text nodes only (tags from split preserved).
 * Input must already be sanitized (e.g. sanitizeMessageHtml output).
 */
export function highlightSearchInSanitizedHtml(safeHtml: string, query: string): string {
  const q = query.trim();
  if (!q) return safeHtml;
  const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
  const parts = safeHtml.split(/(<[^>]+>)/g);
  const joined = parts
    .map((part) => (part.startsWith("<") ? part : part.replace(re, "<mark>$1</mark>")))
    .join("");
  return String(DOMPurify.sanitize(joined, PURIFY_WITH_MARK));
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
