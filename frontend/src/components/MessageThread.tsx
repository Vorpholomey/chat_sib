import { useEffect, useRef } from "react";
import { assetUrl } from "../lib/config";
import { formatTime, lineKey } from "../store/chatStore";
import type { ChatLine } from "../types/chat";

type Props = {
  lines: ChatLine[];
  emptyHint: string;
};

export function MessageThread({ lines, emptyHint }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
      {lines.length === 0 ? (
        <p className="m-auto text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <ul className="space-y-2 pr-1">
          {lines.map((line) => (
            <li key={lineKey(line)} className="text-sm leading-relaxed text-slate-200">
              <span className="font-mono text-xs text-slate-500">
                {formatTime(line.at)}
              </span>{" "}
              <span className="font-semibold text-violet-300">{line.author}:</span>{" "}
              {line.contentType === "text" ? (
                <span className="whitespace-pre-wrap break-words">{line.body}</span>
              ) : (
                <span className="inline-block align-top">
                  <span className="text-slate-400">[image]</span>
                  <img
                    src={assetUrl(line.body)}
                    alt=""
                    className="mt-1 max-h-64 max-w-full rounded border border-slate-700 object-contain"
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
