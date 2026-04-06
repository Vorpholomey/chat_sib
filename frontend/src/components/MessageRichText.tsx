import { memo, useMemo } from "react";
import { looksLikeRichHtml, sanitizeMessageHtml } from "../lib/richText";

type Props = {
  body: string;
  className?: string;
};

/**
 * Renders a message body: legacy plain text with line breaks, or sanitized HTML
 * (bold, italic, links, line breaks) from the rich-text editor.
 */
function MessageRichTextInner({ body, className = "" }: Props) {
  const isRich = looksLikeRichHtml(body);
  const safeHtml = useMemo(
    () => (isRich ? sanitizeMessageHtml(body) : ""),
    [body, isRich]
  );
  if (!isRich) {
    return (
      <span className={`whitespace-pre-wrap break-words ${className}`}>{body}</span>
    );
  }
  return (
    <div
      className={`min-w-0 break-words [&_a]:text-violet-400 [&_a]:underline [&_p]:my-0 [&_p]:empty:min-h-[1em] ${className}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

export const MessageRichText = memo(MessageRichTextInner);
