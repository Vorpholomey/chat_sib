import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getReadState, patchReadState } from "../lib/readState";
import { numericMessageId } from "../lib/messageId";
import type { ChatLine, ChatMode } from "../types/chat";

const SCROLL_PATCH_MIN_MS = 2500;

export type ReadScope = "global" | { peerId: number };

function matchesActiveScope(
  mode: ChatMode,
  peerId: number | null,
  scope: ReadScope
): boolean {
  if (scope === "global") return mode === "global";
  return mode === "private" && peerId === scope.peerId;
}

function maxMessageId(lines: ChatLine[]): number | null {
  let max: number | null = null;
  for (const l of lines) {
    const n = numericMessageId(l.id);
    if (!Number.isFinite(n)) continue;
    if (max == null || n > max) max = n;
  }
  return max;
}

function isOwnLine(line: ChatLine, me?: number): boolean {
  if (line.isOwn === true) return true;
  if (me != null && line.senderId != null && line.senderId === me) return true;
  return false;
}

export type UseReadMessageHistoryArgs = {
  mode: ChatMode;
  peerId: number | null;
  lines: ChatLine[];
  currentUserId?: number;
  /** When false (e.g. global room unavailable), skip all read-state API calls. */
  enabled: boolean;
};

export type UseReadMessageHistoryResult = {
  loaded: boolean;
  /** Effective last-read cursor for divider / read logic; null only before first server value or new-user pre-PATCH. */
  lastReadMessageId: number | null;
  /** Badge on jump-to-newest: only unfocused/away accumulation, not history or focused realtime. */
  awayUnreadBadge: number;
  /** Scroll to this message on first thread fill; null = scroll to bottom (new user or no cursor). */
  initialScrollMessageId: string | number | null;
  /** New user: do not PATCH from scroll until user leaves bottom / first read action. */
  newUserScrollPatchBlocked: boolean;
  /** Call when user scrolls away from bottom (enables scroll-driven PATCH for new users). */
  onLeftBottom: () => void;
  /** Intersection observer: visible sufficiently-read message id. */
  onVisibleReadCandidate: (messageId: number) => void;
  /** After jump-to-newest scroll completes. */
  onJumpToNewest: (newestId: number) => void;
  /** WebSocket added a chat line for the active scope (after store update). */
  onChatMessageAdded: (line: ChatLine, scope: ReadScope) => void;
  flushPendingPatch: () => void;
};

export function useReadMessageHistory(
  args: UseReadMessageHistoryArgs
): UseReadMessageHistoryResult {
  const { mode, peerId, lines, currentUserId, enabled } = args;

  /** When `readParams` is set, becomes true after GET completes (or error). Ignored when there is no read scope. */
  const [fetchReady, setFetchReady] = useState(false);
  const [serverLastRead, setServerLastRead] = useState<number | null>(null);
  const [lastRead, setLastRead] = useState<number | null>(null);
  const [awayUnreadBadge, setAwayUnreadBadge] = useState(0);
  const [initialScrollMessageId, setInitialScrollMessageId] = useState<
    string | number | null
  >(null);
  const [newUserScrollPatchBlocked, setNewUserScrollPatchBlocked] =
    useState(false);

  const global403Ref = useRef(false);
  const scrollPatchEnabledRef = useRef(false);
  const lastPatchAtRef = useRef(0);
  const pendingPatchIdRef = useRef<number | null>(null);
  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReadRef = useRef<number | null>(null);
  const serverLastReadRef = useRef<number | null>(null);
  const linesRef = useRef(lines);
  const prevFocusedRef = useRef(
    typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      document.hasFocus()
  );

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    lastReadRef.current = lastRead;
  }, [lastRead]);
  useEffect(() => {
    serverLastReadRef.current = serverLastRead;
  }, [serverLastRead]);

  const readParams = useMemo(() => {
    if (!enabled) return null;
    if (mode === "private" && peerId != null) {
      return { scope: "private" as const, peerId };
    }
    if (mode === "global") {
      return { scope: "global" as const };
    }
    return null;
  }, [enabled, mode, peerId]);

  const readStateReady = readParams == null || fetchReady;

  const runPatch = useCallback(
    async (id: number, immediate: boolean) => {
      if (!enabled || global403Ref.current) return;
      const params = readParams;
      if (!params) return;
      if (params.scope === "global") {
        await patchReadState({ scope: "global", last_read_message_id: id });
      } else {
        await patchReadState({
          scope: "private",
          peer_id: params.peerId,
          last_read_message_id: id,
        });
      }
      if (immediate) {
        lastPatchAtRef.current = Date.now();
      }
    },
    [enabled, readParams]
  );

  const schedulePatch = useCallback(
    (id: number, immediate: boolean) => {
      if (!enabled || global403Ref.current) return;
      const now = Date.now();
      if (immediate) {
        if (patchTimerRef.current) {
          clearTimeout(patchTimerRef.current);
          patchTimerRef.current = null;
        }
        pendingPatchIdRef.current = null;
        void runPatch(id, true).catch((err) => {
          if (axios.isAxiosError(err) && err.response?.status === 403) {
            global403Ref.current = true;
            return;
          }
          toast.error("Could not update read position");
        });
        return;
      }

      pendingPatchIdRef.current =
        pendingPatchIdRef.current == null
          ? id
          : Math.max(pendingPatchIdRef.current, id);

      const elapsed = now - lastPatchAtRef.current;
      const delay = Math.max(0, SCROLL_PATCH_MIN_MS - elapsed);

      if (patchTimerRef.current) {
        clearTimeout(patchTimerRef.current);
      }
      patchTimerRef.current = window.setTimeout(() => {
        patchTimerRef.current = null;
        const pending = pendingPatchIdRef.current;
        pendingPatchIdRef.current = null;
        if (pending == null) return;
        lastPatchAtRef.current = Date.now();
        void runPatch(pending, false).catch((err) => {
          if (axios.isAxiosError(err) && err.response?.status === 403) {
            global403Ref.current = true;
            return;
          }
          toast.error("Could not update read position");
        });
      }, delay);
    },
    [enabled, runPatch]
  );

  const flushPendingPatch = useCallback(() => {
    if (patchTimerRef.current) {
      clearTimeout(patchTimerRef.current);
      patchTimerRef.current = null;
    }
    const pending = pendingPatchIdRef.current;
    pendingPatchIdRef.current = null;
    if (pending == null) return;
    lastPatchAtRef.current = Date.now();
    void runPatch(pending, false).catch((err) => {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        global403Ref.current = true;
        return;
      }
      toast.error("Could not update read position");
    });
  }, [runPatch]);

  /** Reset client read state when there is no API scope (disabled / no peer). */
  useEffect(() => {
    if (readParams != null) return;
    queueMicrotask(() => {
      setServerLastRead(null);
      setLastRead(null);
      setInitialScrollMessageId(null);
      setNewUserScrollPatchBlocked(false);
      scrollPatchEnabledRef.current = false;
      setAwayUnreadBadge(0);
    });
  }, [readParams]);

  /** Load GET read state when scope changes. */
  useEffect(() => {
    if (!readParams) {
      return;
    }

    let cancelled = false;

    /* Batch-reset when `readParams` changes so the UI does not briefly keep another scope’s cursor. */
    /* eslint-disable react-hooks/set-state-in-effect */
    setFetchReady(false);
    setServerLastRead(null);
    setLastRead(null);
    lastReadRef.current = null;
    serverLastReadRef.current = null;
    setInitialScrollMessageId(null);
    setNewUserScrollPatchBlocked(false);
    scrollPatchEnabledRef.current = false;
    setAwayUnreadBadge(0);
    /* eslint-enable react-hooks/set-state-in-effect */

    (async () => {
      try {
        const data = await getReadState(
          readParams.scope === "global"
            ? { scope: "global" }
            : { scope: "private", peerId: readParams.peerId }
        );
        if (cancelled) return;
        global403Ref.current = false;
        setFetchReady(true);
        const lr = data.last_read_message_id;
        setServerLastRead(lr);
        setLastRead(lr);
        lastReadRef.current = lr;
        serverLastReadRef.current = lr;

        if (lr === null) {
          setInitialScrollMessageId(null);
          setNewUserScrollPatchBlocked(true);
          scrollPatchEnabledRef.current = false;
        } else {
          setInitialScrollMessageId(lr);
          setNewUserScrollPatchBlocked(false);
          scrollPatchEnabledRef.current = true;
        }
        setAwayUnreadBadge(0);
        lastPatchAtRef.current = Date.now();
      } catch (err) {
        if (cancelled) return;
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          if (readParams.scope === "global") {
            global403Ref.current = true;
            setFetchReady(true);
            setServerLastRead(null);
            setLastRead(null);
            setInitialScrollMessageId(null);
            setNewUserScrollPatchBlocked(false);
            return;
          }
        }
        setFetchReady(true);
        setInitialScrollMessageId(null);
        toast.error("Could not load read state");
      }
    })();

    return () => {
      cancelled = true;
      flushPendingPatch();
    };
  }, [readParams, flushPendingPatch]);

  const chatFocused = useCallback((): boolean => {
    return (
      document.visibilityState === "visible" && document.hasFocus()
    );
  }, []);

  /** Bump last_read to at least `id` (local + optional PATCH). */
  const bumpLastRead = useCallback(
    (id: number, patchImmediate: boolean) => {
      setLastRead((prev) => {
        const next = prev == null ? id : Math.max(prev, id);
        lastReadRef.current = next;
        return next;
      });
      if (patchImmediate) {
        schedulePatch(id, true);
      }
    },
    [schedulePatch]
  );

  /** Transition to focused: mark everything read, clear away badge (not on initial mount). */
  useEffect(() => {
    const sync = () => {
      const now =
        document.visibilityState === "visible" && document.hasFocus();
      const prev = prevFocusedRef.current;
      prevFocusedRef.current = now;
      if (!now || prev !== false) return;

      const maxId = maxMessageId(linesRef.current);
      if (maxId == null) {
        setAwayUnreadBadge(0);
        return;
      }
      if (!enabled || global403Ref.current) {
        setAwayUnreadBadge(0);
        return;
      }
      setAwayUnreadBadge(0);
      bumpLastRead(maxId, true);
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
    };
  }, [enabled, bumpLastRead]);

  /** Own messages in the thread always advance read cursor locally. */
  useEffect(() => {
    if (!readStateReady || !enabled) return;
    let maxOwn: number | null = null;
    for (const l of lines) {
      if (!isOwnLine(l, currentUserId)) continue;
      const n = numericMessageId(l.id);
      if (!Number.isFinite(n)) continue;
      maxOwn = maxOwn == null ? n : Math.max(maxOwn, n);
    }
    if (maxOwn == null) return;
    const cur = lastReadRef.current;
    if (cur != null && maxOwn <= cur) return;
    if (cur == null || maxOwn > cur) {
      setLastRead((prev) => {
        const next = prev == null ? maxOwn! : Math.max(prev, maxOwn!);
        lastReadRef.current = next;
        return next;
      });
      schedulePatch(maxOwn, true);
    }
  }, [lines, readStateReady, enabled, currentUserId, schedulePatch]);

  const onLeftBottom = useCallback(() => {
    if (newUserScrollPatchBlocked) {
      scrollPatchEnabledRef.current = true;
      setNewUserScrollPatchBlocked(false);
    }
  }, [newUserScrollPatchBlocked]);

  const onVisibleReadCandidate = useCallback(
    (messageId: number) => {
      if (!enabled || global403Ref.current) return;
      if (!Number.isFinite(messageId)) return;

      const cur = lastReadRef.current;
      if (cur != null && messageId <= cur) return;

      if (serverLastReadRef.current === null && !scrollPatchEnabledRef.current) {
        return;
      }

      setLastRead((prev) => {
        const next = prev == null ? messageId : Math.max(prev, messageId);
        lastReadRef.current = next;
        return next;
      });
      schedulePatch(messageId, false);
    },
    [enabled, schedulePatch]
  );

  const onJumpToNewest = useCallback(
    (newestId: number) => {
      if (!enabled || global403Ref.current) return;
      setAwayUnreadBadge(0);
      bumpLastRead(newestId, true);
    },
    [enabled, bumpLastRead]
  );

  const onChatMessageAdded = useCallback(
    (line: ChatLine, scope: ReadScope) => {
      if (!matchesActiveScope(mode, peerId, scope)) return;
      if (!enabled || global403Ref.current) return;
      if (!readStateReady) return;

      const id = numericMessageId(line.id);
      if (!Number.isFinite(id)) return;

      if (isOwnLine(line, currentUserId)) {
        bumpLastRead(id, true);
        return;
      }

      const focused = chatFocused();
      if (focused) {
        bumpLastRead(id, true);
      } else {
        const lr = lastReadRef.current;
        if (lr == null || id > lr) {
          setAwayUnreadBadge((c) => c + 1);
        }
      }
    },
    [mode, peerId, enabled, readStateReady, currentUserId, bumpLastRead, chatFocused]
  );

  useEffect(() => {
    return () => {
      flushPendingPatch();
    };
  }, [flushPendingPatch]);

  return {
    loaded: readStateReady,
    lastReadMessageId: lastRead,
    awayUnreadBadge,
    initialScrollMessageId,
    newUserScrollPatchBlocked,
    onLeftBottom,
    onVisibleReadCandidate,
    onJumpToNewest,
    onChatMessageAdded,
    flushPendingPatch,
  };
}
