import { assetUrl } from "../lib/config";
import { messagePlainPreview } from "../lib/richText";
import type { ContentType } from "../types/chat";

type Props = {
  contentType: ContentType | undefined;
  /** Quoted snippet: plain/HTML for text, path or URL for image/gif */
  text: string;
};

/** Reply bar / quote row: text snippet or thumbnail for media. */
export function ReplyQuotePreview({ contentType, text }: Props) {
  const ct = contentType ?? "text";
  if (ct === "image" || ct === "gif") {
    const src = assetUrl(text);
    if (!src) {
      return (
        <span className="line-clamp-2 block text-xs text-slate-500">
          Unavailable
        </span>
      );
    }
    return (
      <span className="mt-1 block">
        <img
          src={src}
          alt=""
          className="max-h-20 max-w-full rounded border border-slate-600/80 object-contain"
        />
      </span>
    );
  }
  if (ct === "video") {
    const src = assetUrl(text);
    if (!src) {
      return <span className="line-clamp-2 block text-xs text-slate-500">Unavailable</span>;
    }
    return (
      <span className="mt-1 block">
        <video
          src={src}
          muted
          preload="metadata"
          className="max-h-20 max-w-full rounded border border-slate-600/80 object-contain"
        />
      </span>
    );
  }
  if (ct === "audio") {
    return (
      <span className="mt-1 block rounded border border-slate-600/80 bg-slate-800/60 px-2 py-1 text-xs text-slate-300">
        Audio attachment
      </span>
    );
  }
  return (
    <span className="line-clamp-2 block text-slate-500">
      {messagePlainPreview(text, 500)}
    </span>
  );
}
