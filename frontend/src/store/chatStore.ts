import { create } from "zustand";
import type { ChatLine, ChatMode } from "../types/chat";

type ChatState = {
  mode: ChatMode;
  peerId: number | null;
  globalLines: ChatLine[];
  /** key = other user's id */
  privateLines: Record<number, ChatLine[]>;
  /** Pinned global message (room-level); shown in sticky bar */
  pinnedGlobalMessage: ChatLine | null;
  setMode: (m: ChatMode) => void;
  setPeer: (id: number | null) => void;
  addLine: (line: ChatLine, scope: "global" | { peerId: number }) => void;
  setGlobalLines: (lines: ChatLine[]) => void;
  setPrivateLines: (peerId: number, lines: ChatLine[]) => void;
  setPinnedGlobalMessage: (line: ChatLine | null) => void;
  updateLineById: (
    id: string | number,
    scope: "global" | { peerId: number },
    updater: (prev: ChatLine) => ChatLine
  ) => void;
  replaceLineById: (
    id: string | number,
    scope: "global" | { peerId: number },
    line: ChatLine
  ) => void;
  removeLineById: (id: string | number, scope: "global" | { peerId: number }) => void;
  reset: () => void;
};

function sameId(a: string | number, b: string | number): boolean {
  return String(a) === String(b);
}

export const useChatStore = create<ChatState>((set) => ({
  mode: "global",
  peerId: null,
  globalLines: [],
  privateLines: {},
  pinnedGlobalMessage: null,

  setMode: (mode) => set({ mode }),
  setPeer: (peerId) => set({ peerId }),

  addLine: (line, scope) =>
    set((s) => {
      if (scope === "global") {
        return { globalLines: [...s.globalLines, line] };
      }
      const pid = scope.peerId;
      const prev = s.privateLines[pid] ?? [];
      return { privateLines: { ...s.privateLines, [pid]: [...prev, line] } };
    }),

  setGlobalLines: (globalLines) => set({ globalLines }),

  setPrivateLines: (peerId, lines) =>
    set((s) => ({
      privateLines: { ...s.privateLines, [peerId]: lines },
    })),

  setPinnedGlobalMessage: (pinnedGlobalMessage) => set({ pinnedGlobalMessage }),

  updateLineById: (id, scope, updater) =>
    set((s) => {
      if (scope === "global") {
        return {
          globalLines: s.globalLines.map((l) =>
            sameId(l.id, id) ? updater(l) : l
          ),
        };
      }
      const pid = scope.peerId;
      const prev = s.privateLines[pid] ?? [];
      return {
        privateLines: {
          ...s.privateLines,
          [pid]: prev.map((l) => (sameId(l.id, id) ? updater(l) : l)),
        },
      };
    }),

  replaceLineById: (id, scope, line) =>
    set((s) => {
      if (scope === "global") {
        return {
          globalLines: s.globalLines.map((l) => (sameId(l.id, id) ? line : l)),
        };
      }
      const pid = scope.peerId;
      const prev = s.privateLines[pid] ?? [];
      return {
        privateLines: {
          ...s.privateLines,
          [pid]: prev.map((l) => (sameId(l.id, id) ? line : l)),
        },
      };
    }),

  removeLineById: (id, scope) =>
    set((s) => {
      if (scope === "global") {
        return {
          globalLines: s.globalLines.filter((l) => !sameId(l.id, id)),
        };
      }
      const pid = scope.peerId;
      const prev = s.privateLines[pid] ?? [];
      return {
        privateLines: {
          ...s.privateLines,
          [pid]: prev.filter((l) => !sameId(l.id, id)),
        },
      };
    }),

  reset: () =>
    set({
      mode: "global",
      peerId: null,
      globalLines: [],
      privateLines: {},
      pinnedGlobalMessage: null,
    }),
}));

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Hours and minutes only, e.g. "14:30", "09:33". */
export function formatTimeHm(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function lineKey(line: ChatLine): string {
  return `${line.id}-${line.at}`;
}
