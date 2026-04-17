import { Pin } from "lucide-react";
import { assetUrl } from "../lib/config";
import { formatTime } from "../store/chatStore";
import type { ChatLine } from "../types/chat";
import { MessageRichText } from "./MessageRichText";
import { RoleBadge } from "./RoleBadge";

type Props = {
  line: ChatLine;
  /** 1-based position in the rotation (for “k of n”). */
  previewIndex?: number;
  totalPinned?: number;
  onUnpin?: () => void;
  canUnpin?: boolean;
  /** Scroll the thread to this message and highlight it. */
  onJumpToMessage?: () => void;
};

export function PinnedMessageBar({
  line,
  previewIndex = 1,
  totalPinned = 1,
  onUnpin,
  canUnpin,
  onJumpToMessage,
}: Props) {
  const showCount = totalPinned > 1;

  const previewBody = (
    <div
      key={line.id}
      className="animate-pin-preview-in min-w-0 flex-1 text-left"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-amber-200/80">
        <span className="font-semibold text-amber-100">Pinned</span>
        {showCount && (
          <span
            className="rounded bg-amber-900/55 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-100/90"
            title="Preview position in rotation"
          >
            {previewIndex}/{totalPinned}
          </span>
        )}
        <span className="font-mono text-amber-200/60">{formatTime(line.at)}</span>
        <span className="font-medium text-violet-200">{line.author}</span>
        {line.authorRole && <RoleBadge role={line.authorRole} />}
      </div>
      {line.contentType === "text" ? (
        <div className="mt-1 line-clamp-3 text-slate-100">
          <MessageRichText body={line.body} />
        </div>
      ) : (
        <div className="mt-1 flex min-w-0 max-w-full flex-row items-start gap-2">
          <img
            src={assetUrl(line.body)}
            alt=""
            className="block h-auto max-h-16 shrink-0 rounded border border-slate-700 object-contain"
          />
          {line.caption ? (
            <div className="min-w-0 flex-1 line-clamp-3 text-slate-100">
              <MessageRichText body={line.caption} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  const mainContent = (
    <>
      <Pin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      {previewBody}
    </>
  );

  return (
    <div className="sticky top-0 z-10 mb-2 flex shrink-0 items-start gap-2 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90 shadow-sm backdrop-blur-sm">
      {onJumpToMessage ? (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 rounded-md text-left outline-none ring-amber-400/50 hover:bg-amber-900/25 focus-visible:ring-2"
          onClick={onJumpToMessage}
        >
          {mainContent}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-2">{mainContent}</div>
      )}
      {canUnpin && onUnpin && (
        <button
          type="button"
          className="shrink-0 rounded border border-amber-700/60 px-2 py-1 text-xs text-amber-100 hover:bg-amber-900/50"
          onClick={onUnpin}
        >
          Unpin
        </button>
      )}
    </div>
  );
}
