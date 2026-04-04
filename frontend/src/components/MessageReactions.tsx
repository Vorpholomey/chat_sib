import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { positionPanelAboveAnchorInBounds } from "../lib/floatingMenuPosition";
import {
  hasAnyReactions,
  REACTION_KINDS,
  type MessageReactionState,
  type ReactionKind,
} from "../types/reactions";

const META: Record<ReactionKind, { emoji: string; label: string }> = {
  thumbs_up: { emoji: "\u{1F44D}", label: "Thumbs up" },
  thumbs_down: { emoji: "\u{1F44E}", label: "Thumbs down" },
  heart: { emoji: "\u{2764}\u{FE0F}", label: "Red heart" },
  fire: { emoji: "\u{1F525}", label: "Fire" },
  joy: { emoji: "\u{1F602}", label: "Laughing to tears" },
};

/** Picker trigger: heart emoji only opens the menu — it does not add a reaction. */
const PICKER_TRIGGER_EMOJI = "\u{2764}\u{FE0F}";

export type MessageReactionChipsProps = {
  reactions: MessageReactionState;
  currentUserId?: number;
  own: boolean;
  onToggle: (kind: ReactionKind) => void;
};

/** Non-zero reaction counts only; renders nothing if there are no reactions. */
export function MessageReactionChips({
  reactions,
  currentUserId,
  own,
  onToggle,
}: MessageReactionChipsProps) {
  const [popKind, setPopKind] = useState<ReactionKind | null>(null);

  const pulse = useCallback((kind: ReactionKind) => {
    setPopKind(kind);
    window.setTimeout(() => setPopKind((k) => (k === kind ? null : k)), 220);
  }, []);

  const chipClass = (active: boolean) =>
    own
      ? active
        ? "border-violet-500/50 bg-violet-600/25 text-violet-100"
        : "border-violet-800/30 bg-slate-900/40 text-slate-300 hover:border-violet-600/50"
      : active
        ? "border-sky-500/45 bg-sky-900/35 text-sky-100"
        : "border-slate-600/60 bg-slate-900/50 text-slate-300 hover:border-slate-500";

  if (!hasAnyReactions(reactions)) return null;

  const kindsWithCounts = REACTION_KINDS.filter(
    (k) => (reactions[k]?.length ?? 0) > 0
  );
  const canInteract = currentUserId != null;

  const handleChipClick = (kind: ReactionKind) => {
    if (currentUserId == null) return;
    pulse(kind);
    onToggle(kind);
  };

  return (
    <div
      className="mt-1.5 flex flex-wrap gap-1.5"
      role="toolbar"
      aria-label="Message reactions"
    >
      {kindsWithCounts.map((kind) => {
        const users = reactions[kind] ?? [];
        const count = users.length;
        const active = currentUserId != null && users.includes(currentUserId);
        const { emoji, label } = META[kind];
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            aria-label={`${label}, ${count} ${count === 1 ? "reaction" : "reactions"}`}
            disabled={!canInteract}
            onClick={() => handleChipClick(kind)}
            className={[
              "inline-flex min-h-8 select-none items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums transition-transform duration-150",
              "enabled:cursor-pointer enabled:hover:scale-105 enabled:active:scale-95",
              "disabled:cursor-not-allowed disabled:opacity-60",
              popKind === kind ? "motion-safe:scale-110" : "",
              chipClass(active),
            ].join(" ")}
          >
            <span className="text-base leading-none" aria-hidden>
              {emoji}
            </span>
            <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export type ReactionPickerControlProps = {
  reactions: MessageReactionState;
  currentUserId?: number;
  own: boolean;
  onToggle: (kind: ReactionKind) => void;
  /** Where to align the popover relative to the heart button (`left` = own-message column). */
  panelAlign: "left" | "right";
  /** Clamps the popover inside this element (e.g. chat thread) so it does not overflow. */
  boundsRef: RefObject<HTMLElement | null>;
};

export function ReactionPickerControl({
  reactions,
  currentUserId,
  own,
  onToggle,
  panelAlign,
  boundsRef,
}: ReactionPickerControlProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [popKind, setPopKind] = useState<ReactionKind | null>(null);
  const [panelFixed, setPanelFixed] = useState<{ left: number; top: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const pulse = useCallback((kind: ReactionKind) => {
    setPopKind(kind);
    window.setTimeout(() => setPopKind((k) => (k === kind ? null : k)), 220);
  }, []);

  const canInteract = currentUserId != null;

  useLayoutEffect(() => {
    if (!pickerOpen || !canInteract) return;
    const update = () => {
      const bounds = boundsRef.current?.getBoundingClientRect();
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!bounds || !trigger || !panel) return;
      const anchor = trigger.getBoundingClientRect();
      const { left, top } = positionPanelAboveAnchorInBounds(
        anchor,
        panel.offsetWidth,
        panel.offsetHeight,
        bounds,
        panelAlign
      );
      setPanelFixed((prev) =>
        prev && prev.left === left && prev.top === top ? prev : { left, top }
      );
    };
    update();
    const scrollRoot = boundsRef.current;
    scrollRoot?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scrollRoot?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pickerOpen, canInteract, panelAlign, boundsRef]);

  useEffect(() => {
    if (!pickerOpen) {
      setPanelFixed(null);
      return;
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && rootRef.current?.contains(t)) return;
      setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  const handlePickerPick = (kind: ReactionKind) => {
    if (currentUserId == null) return;
    pulse(kind);
    onToggle(kind);
    setPickerOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0" data-reaction-picker-root>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        aria-label="Add reaction"
        disabled={!canInteract}
        onClick={() => canInteract && setPickerOpen((o) => !o)}
        className={[
          "flex h-8 w-8 items-center justify-center rounded-full border text-base leading-none transition-transform duration-150",
          "enabled:cursor-pointer enabled:hover:scale-110 enabled:active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-50",
          own
            ? "border-violet-800/40 bg-slate-950/40 text-violet-200/90 hover:border-violet-600/50"
            : "border-slate-600/70 bg-slate-950/40 text-rose-200/90 hover:border-slate-500",
          pickerOpen ? "ring-2 ring-violet-500/40" : "",
        ].join(" ")}
      >
        <span aria-hidden>{PICKER_TRIGGER_EMOJI}</span>
      </button>

      {pickerOpen && canInteract && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose a reaction"
          style={
            panelFixed
              ? {
                  position: "fixed",
                  left: panelFixed.left,
                  top: panelFixed.top,
                  zIndex: 100,
                }
              : {
                  position: "fixed",
                  left: 0,
                  top: 0,
                  visibility: "hidden",
                  zIndex: 100,
                }
          }
          className="flex gap-0.5 rounded-lg border border-slate-600 bg-slate-900 px-1.5 py-1 shadow-lg"
        >
          {REACTION_KINDS.map((kind) => {
            const users = reactions[kind] ?? [];
            const active = currentUserId != null && users.includes(currentUserId);
            const { emoji, label } = META[kind];
            return (
              <button
                key={kind}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                onClick={() => handlePickerPick(kind)}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-md text-lg transition-transform duration-150",
                  "hover:scale-110 hover:bg-slate-800 active:scale-95",
                  active ? "bg-slate-700/90" : "bg-transparent",
                  popKind === kind ? "motion-safe:scale-110" : "",
                ].join(" ")}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
