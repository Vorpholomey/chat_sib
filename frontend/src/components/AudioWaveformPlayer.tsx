import { Pause, Play } from "lucide-react";
import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { VOICE_MESSAGE_TAG } from "../lib/audioMeta";
import { getCachedAudioWaveform } from "../lib/audioWaveform";

const AUDIO_WAVEFORM_PLAY_EVENT = "chat-sib:audio-waveform-play";

/** Handheld mic artwork when no album `coverUrl` is set (`frontend/public/retro-mic.png`, RGBA). */
function RetroMicrophoneImage({ className }: { className?: string }) {
  return (
    <img
      src="/retro-mic.png"
      alt=""
      loading="lazy"
      decoding="async"
      className={["h-10 w-10 shrink-0 rounded object-contain bg-transparent", className].filter(Boolean).join(" ")}
    />
  );
}

type AudioWaveformPlayerProps = {
  src: string;
  title: string;
  artist?: string;
  tag?: string;
  coverUrl?: string;
  onOpenMedia?: () => void;
};

function AudioWaveformPlayerInner({
  src,
  title,
  artist,
  tag,
  coverUrl,
  onOpenMedia,
}: AudioWaveformPlayerProps) {
  const instanceId = useId();
  const isVoiceMessage = tag?.trim().toLowerCase() === VOICE_MESSAGE_TAG.toLowerCase();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [wavePeaks, setWavePeaks] = useState<number[] | null>(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCachedAudioWaveform(src).then((result) => {
      if (cancelled) return;
      if (!result || result.peaks.length === 0) {
        setAnalysisFailed(true);
        return;
      }
      setWavePeaks(result.peaks);
      if (result.durationSeconds > 0) setDurationSeconds(result.durationSeconds);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setDurationSeconds(audio.duration);
    };
    const onTimeUpdate = () => setCurrentSeconds(audio.currentTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  useEffect(() => {
    const onExternalPlay = (event: Event) => {
      const audio = audioRef.current;
      if (!audio) return;
      const customEvent = event as CustomEvent<{ instanceId: string }>;
      if (customEvent.detail?.instanceId === instanceId) return;
      if (!audio.paused) audio.pause();
    };
    window.addEventListener(AUDIO_WAVEFORM_PLAY_EVENT, onExternalPlay as EventListener);
    return () => {
      window.removeEventListener(AUDIO_WAVEFORM_PLAY_EVENT, onExternalPlay as EventListener);
    };
  }, [instanceId]);

  const progress = useMemo(() => {
    if (!durationSeconds || durationSeconds <= 0) return 0;
    return Math.max(0, Math.min(1, currentSeconds / durationSeconds));
  }, [currentSeconds, durationSeconds]);

  const playedBars = useMemo(() => {
    const length = wavePeaks?.length ?? 0;
    if (length <= 0) return 0;
    return Math.min(length, Math.floor(progress * length));
  }, [progress, wavePeaks]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      window.dispatchEvent(
        new CustomEvent(AUDIO_WAVEFORM_PLAY_EVENT, {
          detail: { instanceId },
        })
      );
      void audio.play().catch(() => undefined);
      return;
    }
    audio.pause();
  };

  const seekByEvent = (e: ReactMouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !durationSeconds) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    audio.currentTime = durationSeconds * Math.max(0, Math.min(1, pct));
  };

  return (
    <div className="flex min-w-[260px] max-w-full items-center gap-3 rounded border border-slate-700 bg-slate-800/80 px-3 py-2 text-left">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-10 w-10 rounded object-cover"
        />
      ) : !isVoiceMessage ? (
        <RetroMicrophoneImage />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {isVoiceMessage ? (
              <span className="mt-0.5 inline-flex max-w-full truncate rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200">
                {VOICE_MESSAGE_TAG}
              </span>
            ) : (
              <span className="block truncate text-sm text-slate-200">{title}</span>
            )}
            {tag && !isVoiceMessage && (
              <span className="mt-0.5 inline-flex max-w-full truncate rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200">
                {tag}
              </span>
            )}
            {artist && <span className="block truncate text-xs text-slate-400">{artist}</span>}
          </div>
          {onOpenMedia && (
            <button
              type="button"
              className="shrink-0 rounded px-1.5 py-1 text-xs text-slate-300 hover:bg-slate-700/70 hover:text-slate-100"
              onClick={onOpenMedia}
            >
              Open
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-700 text-white hover:bg-violet-600"
            onClick={togglePlayback}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          {wavePeaks && !analysisFailed ? (
            <div
              role="slider"
              aria-label="Audio progress"
              aria-valuemin={0}
              aria-valuemax={durationSeconds || 0}
              aria-valuenow={currentSeconds}
              tabIndex={0}
              className="flex h-6 min-h-0 min-w-0 flex-1 cursor-pointer items-end justify-between overflow-hidden rounded px-0.5"
              onClick={seekByEvent}
              onKeyDown={(e) => {
                const audio = audioRef.current;
                if (!audio || !durationSeconds) return;
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  audio.currentTime = Math.min(durationSeconds, audio.currentTime + 5);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  audio.currentTime = Math.max(0, audio.currentTime - 5);
                }
              }}
            >
              {wavePeaks.map((peak, idx) => {
                const barH = Math.min(18, Math.max(2, peak * 16));
                return (
                  <span
                    // Indexed list for fixed waveform bars.
                    key={idx}
                    className={`w-px shrink-0 rounded-full ${
                      idx < playedBars ? "bg-violet-300" : "bg-slate-500/80"
                    }`}
                    style={{ height: `${barH}px` }}
                  />
                );
              })}
            </div>
          ) : (
            <div
              className="relative h-2 flex-1 cursor-pointer overflow-hidden rounded-full bg-slate-600/70"
              onClick={seekByEvent}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-violet-300"
                style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
              />
            </div>
          )}
        </div>
        {wavePeaks && !analysisFailed && (
          <span className="mt-1 block text-right font-mono text-[11px] text-slate-400 tabular-nums">
            {formatSeconds(currentSeconds)} / {formatSeconds(durationSeconds)}
          </span>
        )}
        {analysisFailed && (
          <span className="mt-1 block text-[11px] text-slate-400">
            Waveform unavailable. Audio playback still works.
          </span>
        )}
      </div>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
}

function formatSeconds(rawSeconds: number): string {
  const total = Math.max(0, Math.floor(rawSeconds));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export const AudioWaveformPlayer = memo(AudioWaveformPlayerInner);
