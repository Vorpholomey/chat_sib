import { Pin } from "lucide-react";
import { assetUrl } from "../lib/config";
import { formatTime } from "../store/chatStore";
import type { ChatLine } from "../types/chat";
import { RoleBadge } from "./RoleBadge";

type Props = {
  line: ChatLine;
  onUnpin?: () => void;
  canUnpin?: boolean;
};

export function PinnedMessageBar({ line, onUnpin, canUnpin }: Props) {
  return (
    <div className="sticky top-0 z-10 mb-2 flex shrink-0 items-start gap-2 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90 shadow-sm backdrop-blur-sm">
      <Pin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-200/80">
          <span className="font-semibold text-amber-100">Pinned</span>
          <span className="font-mono text-amber-200/60">{formatTime(line.at)}</span>
          <span className="font-medium text-violet-200">{line.author}</span>
          {line.authorRole && <RoleBadge role={line.authorRole} />}
        </div>
        {line.contentType === "text" ? (
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-slate-100">
            {line.body}
          </p>
        ) : (
          <div className="mt-1">
            <img
              src={assetUrl(line.body)}
              alt=""
              className="max-h-32 max-w-full rounded border border-slate-700 object-contain"
            />
          </div>
        )}
      </div>
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
