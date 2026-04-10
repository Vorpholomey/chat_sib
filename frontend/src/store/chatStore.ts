import { create } from "zustand";
import type { ChatLine, ChatMode } from "../types/chat";

type ChatState = {
  mode: ChatMode;
  peerId: number | null;
  globalLines: ChatLine[];
  /** key = other user's id */
  privateLines: Record<number, ChatLine[]>;
  /** Global room pins, server-ordered by message time (newest first). */
  pinnedGlobalMessages: ChatLine[];
  setMode: (m: ChatMode) => void;
  setPeer: (id: number | null) => void;
  addLine: (line: ChatLine, scope: "global" | { peerId: number }) => void;
  setGlobalLines: (lines: ChatLine[]) => void;
  /** Merge into global lines by id (for jump-to / loaded window around a message). */
  mergeGlobalLines: (lines: ChatLine[]) => void;
  /** Merge into private lines for a peer (prepend older pages). */
  mergePrivateLines: (peerId: number, lines: ChatLine[]) => void;
  setPrivateLines: (peerId: number, lines: ChatLine[]) => void;
  globalHistoryReady: boolean;
  setGlobalHistoryReady: (ready: boolean) => void;
  setPinnedGlobalMessages: (lines: ChatLine[]) => void;
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
  pinnedGlobalMessages: [],
  globalHistoryReady: false,

  setGlobalHistoryReady: (ready) => set({ globalHistoryReady: ready }),

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

  mergeGlobalLines: (incoming) =>
    set((s) => {
      const byId = new Map<string | number, ChatLine>();
      for (const l of s.globalLines) {
        byId.set(l.id, l);
      }
      for (const l of incoming) {
        byId.set(l.id, l);
      }
      const merged = Array.from(byId.values());
      merged.sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
      );
      return { globalLines: merged };
    }),

  mergePrivateLines: (peerId, incoming) =>
    set((s) => {
      const prev = s.privateLines[peerId] ?? [];
      const byId = new Map<string | number, ChatLine>();
      for (const l of prev) {
        byId.set(l.id, l);
      }
      for (const l of incoming) {
        byId.set(l.id, l);
      }
      const merged = Array.from(byId.values());
      merged.sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
      );
      return { privateLines: { ...s.privateLines, [peerId]: merged } };
    }),

  setPrivateLines: (peerId, lines) =>
    set((s) => ({
      privateLines: { ...s.privateLines, [peerId]: lines },
    })),

  setPinnedGlobalMessages: (pinnedGlobalMessages) => set({ pinnedGlobalMessages }),

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
      pinnedGlobalMessages: [],
      globalHistoryReady: false,
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
