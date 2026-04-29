import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { AlertCircle, ChevronLeft, ChevronRight, Download, Pause, Play, Share2, X } from "lucide-react";
import { useMediaQuickNavigation } from "../hooks/useMediaQuickNavigation";

export type QuickMediaItem = {
  id: string | number;
  kind: "image" | "gif" | "video" | "audio";
  src: string;
  fileName?: string;
  audioTitle?: string;
  audioArtist?: string;
  audioCoverUrl?: string;
};

type Props = {
  media: QuickMediaItem[];
  index: number;
  onClose: () => void;
  ariaLabel?: string;
};

const FOCUSABLE = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function absoluteUrl(src: string): string {
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
}

export function QuickMediaViewer({
  media,
  index,
  onClose,
  ariaLabel = "Quick media viewer",
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(index);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [gifPaused, setGifPaused] = useState(false);
  const [pausedGifFrame, setPausedGifFrame] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const allowSwipeRef = useRef(true);
  // Prevents iOS/Android click-after-touch from immediately closing the modal
  // after a swipe navigation.
  const suppressNextClickRef = useRef(false);

  const safeIndex = useMemo(() => {
    if (media.length <= 0) return 0;
    return ((currentIndex % media.length) + media.length) % media.length;
  }, [currentIndex, media.length]);
  const item = media[safeIndex];

  const { prev, next, indicator, onKeyDown } = useMediaQuickNavigation({
    length: media.length,
    index: safeIndex,
    onChange: setCurrentIndex,
  });

  useEffect(() => {
    setCurrentIndex(index);
  }, [index]);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setGifPaused(false);
    setPausedGifFrame(null);
  }, [safeIndex]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!item) return;
    const neighbors = [media[(safeIndex - 1 + media.length) % media.length], media[(safeIndex + 1) % media.length]];
    neighbors.forEach((neighbor) => {
      if (!neighbor?.src) return;
      if (neighbor.kind === "image" || neighbor.kind === "gif") {
        const img = new Image();
        img.src = neighbor.src;
      } else {
        const el = document.createElement(neighbor.kind);
        el.preload = "metadata";
        el.src = neighbor.src;
      }
    });
  }, [item, media, safeIndex]);

  useEffect(() => {
    if (!item || (item.kind !== "video" && item.kind !== "audio")) return;
    const mediaEl = item.kind === "video" ? videoRef.current : audioRef.current;
    if (!mediaEl) return;
    const maybePromise = mediaEl.play();
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => {
        // Ignore autoplay rejection; user can press play manually.
      });
    }
  }, [item, safeIndex]);

  const handleShare = useCallback(async () => {
    if (!item?.src) return;
    const url = absoluteUrl(item.src);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }
    window.prompt("Copy media link", url);
  }, [item]);

  const captureGifFrame = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPausedGifFrame(canvas.toDataURL("image/png"));
    } catch {
      setPausedGifFrame(null);
    }
  }, []);

  const toggleGifPause = useCallback(() => {
    if (!item || item.kind !== "gif") return;
    if (!gifPaused) captureGifFrame();
    setGifPaused((v) => !v);
  }, [captureGifFrame, gifPaused, item]);

  useEffect(() => {
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      onKeyDown(event);
    };
    window.addEventListener("keydown", onDocKeyDown);
    return () => window.removeEventListener("keydown", onDocKeyDown);
  }, [onClose, onKeyDown]);

  if (!item) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 px-2 py-2 sm:px-6 sm:py-6"
      onClick={(e) => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        const target = e.target as HTMLElement | null;
        const startedOnInteractive = Boolean(
          target?.closest("audio, video, button, a, input, select, textarea, [role='button']")
        );
        allowSwipeRef.current = !startedOnInteractive;
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const startX = touchStartXRef.current;
        const endX = e.changedTouches[0]?.clientX ?? null;
        touchStartXRef.current = null;
        if (!allowSwipeRef.current) {
          allowSwipeRef.current = true;
          return;
        }
        if (startX == null || endX == null) return;
        const delta = startX - endX;
        if (Math.abs(delta) < 40) return;
        suppressNextClickRef.current = true;
        if (delta > 0) next();
        else prev();
      }}
      onTouchCancel={() => {
        touchStartXRef.current = null;
        allowSwipeRef.current = true;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="relative flex h-full w-full max-w-6xl flex-col rounded-xl border border-white/10 bg-slate-950/75 p-2 sm:p-4"
      >
        <div className="mb-2 flex items-center justify-between gap-2 text-sm text-slate-200">
          <span className="font-medium">{indicator}</span>
          <div className="flex items-center gap-1 sm:gap-2">
            <a
              href={item.src}
              download={item.fileName}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 px-3 text-slate-100 hover:bg-slate-800"
              aria-label="Download original media"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </a>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 px-3 text-slate-100 hover:bg-slate-800"
              aria-label="Copy share link"
              title="Share"
              onClick={() => void handleShare()}
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              ref={closeRef}
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 px-3 text-slate-100 hover:bg-slate-800"
              aria-label="Close media viewer"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Previous media"
            className="absolute left-0 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-900/85 text-slate-100 hover:bg-slate-800"
            onClick={prev}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="relative flex h-full min-h-0 w-full items-center justify-center px-10 overflow-hidden">
            {loading && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                Loading media...
              </div>
            )}
            {error ? (
              <div className="flex flex-col items-center gap-2 text-slate-300" role="status" aria-live="polite">
                <AlertCircle className="h-8 w-8 text-red-300" />
                <p>Failed to load this media.</p>
              </div>
            ) : item.kind === "image" ? (
              <img
                src={item.src}
                alt={item.fileName ?? "Image"}
                className="max-h-full max-w-full object-contain"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            ) : item.kind === "gif" ? (
              <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
                <img
                  ref={imgRef}
                  src={gifPaused && pausedGifFrame ? pausedGifFrame : item.src}
                  alt={item.fileName ?? "Animated GIF"}
                  className="max-h-full max-w-full object-contain"
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setError(true);
                  }}
                />
                <button
                  type="button"
                  onClick={toggleGifPause}
                  className="absolute bottom-3 right-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-900/85 text-slate-100 hover:bg-slate-800"
                  aria-label={gifPaused ? "Play GIF" : "Pause GIF"}
                >
                  {gifPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                </button>
              </div>
            ) : item.kind === "video" ? (
              <video
                ref={videoRef}
                src={item.src}
                autoPlay
                controls
                playsInline
                className="max-h-full max-w-full rounded object-contain"
                onLoadedData={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            ) : (
              <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900/80 p-6 text-slate-100">
                <div className="mb-4 flex items-center gap-3">
                  {item.audioCoverUrl ? (
                    <img
                      src={item.audioCoverUrl}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-slate-700/80" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-200">
                      {item.audioTitle ?? item.fileName ?? "Audio file"}
                    </div>
                    {item.audioArtist && (
                      <div className="truncate text-xs text-slate-400">{item.audioArtist}</div>
                    )}
                  </div>
                </div>
                <audio
                  ref={audioRef}
                  src={item.src}
                  autoPlay
                  controls
                  className="w-full"
                  onLoadedData={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setError(true);
                  }}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Next media"
            className="absolute right-0 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-900/85 text-slate-100 hover:bg-slate-800"
            onClick={next}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
