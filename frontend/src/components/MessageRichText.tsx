import { memo, useMemo, type ReactNode } from "react";
import { escapeRegExp } from "../lib/messageSearch";
import {
  decodePlainMessageEntities,
  highlightSearchInSanitizedHtml,
  looksLikeRichHtml,
  sanitizeMessageHtml,
} from "../lib/richText";

type Props = {
  body: string;
  className?: string;
  /** Case-insensitive substring to wrap with <mark> in visible text. */
  searchHighlight?: string;
};

function highlightPlainSegments(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const r = new RegExp(`(${escapeRegExp(q)})`, "gi");
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = r.exec(text)) !== null) {
    if (m.index > last) {
      out.push(text.slice(last, m.index));
    }
    out.push(
      <mark
        key={`h-${k++}`}
        className="rounded bg-amber-500/35 px-0.5 text-inherit"
      >
        {m[0]}
      </mark>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push(text.slice(last));
  }
  return out.length > 0 ? out : text;
}

/**
 * Renders a message body: legacy plain text with line breaks, or sanitized HTML
 * (bold, italic, links, line breaks) from the rich-text editor.
 */
function MessageRichTextInner({ body, className = "", searchHighlight }: Props) {
  const isRich = looksLikeRichHtml(body);
  const safeHtml = useMemo(
    () => (isRich ? sanitizeMessageHtml(body) : ""),
    [body, isRich]
  );
  const richWithHighlight = useMemo(() => {
    if (!isRich || !searchHighlight?.trim()) return safeHtml;
    return highlightSearchInSanitizedHtml(safeHtml, searchHighlight);
  }, [isRich, safeHtml, searchHighlight]);
  const plainBody = useMemo(
    () => decodePlainMessageEntities(body),
    [body]
  );
  if (!isRich) {
    return (
      <span className={`whitespace-pre-wrap break-words ${className}`}>
        {searchHighlight?.trim()
          ? highlightPlainSegments(plainBody, searchHighlight)
          : plainBody}
      </span>
    );
  }
  return (
    <div
      className={`min-w-0 break-words [&_a]:text-violet-400 [&_a]:underline [&_mark]:rounded [&_mark]:bg-amber-500/35 [&_mark]:px-0.5 [&_p]:my-0 [&_p]:empty:min-h-[1em] ${className}`}
      dangerouslySetInnerHTML={{ __html: richWithHighlight }}
    />
  );
}

export const MessageRichText = memo(MessageRichTextInner);
