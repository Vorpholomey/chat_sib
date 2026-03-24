import { create } from "zustand";
import type { ChatLine, ChatMode } from "../types/chat";

type ChatState = {
  mode: ChatMode;
  peerId: number | null;
  globalLines: ChatLine[];
  /** key = other user's id */
  privateLines: Record<number, ChatLine[]>;
  setMode: (m: ChatMode) => void;
  setPeer: (id: number | null) => void;
  addLine: (line: ChatLine, scope: "global" | { peerId: number }) => void;
  setGlobalLines: (lines: ChatLine[]) => void;
  setPrivateLines: (peerId: number, lines: ChatLine[]) => void;
  reset: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  mode: "global",
  peerId: null,
  globalLines: [],
  privateLines: {},

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

  reset: () =>
    set({
      mode: "global",
      peerId: null,
      globalLines: [],
      privateLines: {},
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

export function lineKey(line: ChatLine): string {
  return `${line.id}-${line.at}`;
}
