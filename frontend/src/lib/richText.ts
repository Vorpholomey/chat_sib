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

/**
 * Browsers often append NBSP in contenteditable; serialization can leave `&nbsp;`
 * in the string. Without tags, messages look "plain" but show literal "&nbsp;".
 * Strip trailing whitespace / NBSP from the sanitized DOM tree.
 */
function normalizeTrailingWhitespaceInSanitizedHtml(html: string): string {
  if (typeof document === "undefined" || !html.trim()) return html;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const stripFrom = (node: ParentNode): void => {
    while (node.lastChild) {
      const last = node.lastChild;
      if (last.nodeType === Node.TEXT_NODE) {
        const text = last as Text;
        const next = text.data.replace(/[\s\u00a0]+$/u, "");
        if (next.length === 0) {
          node.removeChild(last);
          continue;
        }
        if (next !== text.data) text.data = next;
        return;
      }
      if (last instanceof Element) {
        stripFrom(last);
        if (last.childNodes.length === 0) {
          node.removeChild(last);
          continue;
        }
        return;
      }
      return;
    }
  };

  stripFrom(tmp);
  return tmp.innerHTML;
}

/** Decode nbsp-related HTML references so plain (non-rich) bodies never show "&nbsp;". */
export function decodePlainMessageEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*160;/g, " ")
    .replace(/&#x0*A0;/gi, " ");
}

export function sanitizeMessageHtml(html: string): string {
  const clean = String(DOMPurify.sanitize(html, PURIFY));
  return normalizeTrailingWhitespaceInSanitizedHtml(clean);
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

export type PlainLinkifySegment =
  | { kind: "text"; text: string }
  | { kind: "link"; href: string; label: string };

/** Parse `http(s)://` and `www.` tokens; trim trailing punctuation until URL() accepts. */
export function tryHttpUrlFromPlainToken(raw: string): string | null {
  const candidate = raw.startsWith("www.") ? `https://${raw}` : raw;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Split plain message text into runs of plain text and safe http(s) links.
 * Used when the body is not stored as rich HTML.
 */
export function splitPlainTextForLinkify(plain: string): PlainLinkifySegment[] {
  if (!plain) {
    return [{ kind: "text", text: "" }];
  }
  const re = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
  const matches = [...plain.matchAll(re)];
  const out: PlainLinkifySegment[] = [];
  let last = 0;
  for (const m of matches) {
    const mi = m.index ?? 0;
    if (mi > last) {
      out.push({ kind: "text", text: plain.slice(last, mi) });
    }
    const full = m[0];
    let raw = full;
    let href: string | null = null;
    while (raw.length > 0) {
      href = tryHttpUrlFromPlainToken(raw);
      if (href) break;
      raw = raw.slice(0, -1);
    }
    if (href && raw.length > 0) {
      out.push({ kind: "link", href, label: raw });
      last = mi + raw.length;
    } else {
      out.push({ kind: "text", text: full });
      last = mi + full.length;
    }
  }
  if (last < plain.length) {
    out.push({ kind: "text", text: plain.slice(last) });
  }
  return out;
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
    const t = decodePlainMessageEntities(body).trim();
    if (t.length > maxLen) return `${t.slice(0, maxLen)}…`;
    return t;
  }
  return htmlToPlainPreview(body, maxLen);
}
