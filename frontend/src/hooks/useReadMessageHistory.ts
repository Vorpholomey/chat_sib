import axios from "axios";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  encodeChatReadId,
  getChatReadStatus,
  postChatMarkAllRead,
  postChatReadStatus,
} from "../lib/readState";
import { numericMessageId } from "../lib/messageId";
import type { ChatLine, ChatMode } from "../types/chat";

/** Debounced read cursor POST interval (treb.rtf block 3: ~2–3s). */
const READ_POST_DEBOUNCE_MS = 2500;

/**
 * Persist last-read per chat for snappy reloads. Merge policy: **server wins** —
 * after every successful GET we overwrite this key with the server snapshot; any
 * optimistic local advance is replaced when the response arrives.
 */
const LS_KEY_PREFIX = "chatReadCursor:v1:";

function lsKey(chatId: string, userId: number | undefined): string {
  const who = userId != null && Number.isFinite(userId) ? String(userId) : "anon";
  return `${LS_KEY_PREFIX}${who}:${chatId}`;
}

function readCachedLastRead(
  chatId: string,
  userId: number | undefined
): number | null | undefined {
  try {
    const raw = localStorage.getItem(lsKey(chatId, userId));
    if (raw == null) return undefined;
    const v = JSON.parse(raw) as { last_read_message_id?: unknown };
    if (v.last_read_message_id == null) return null;
    if (typeof v.last_read_message_id !== "number" || !Number.isFinite(v.last_read_message_id)) {
      return undefined;
    }
    return v.last_read_message_id;
  } catch {
    return undefined;
  }
}

function writeCachedLastRead(
  chatId: string,
  userId: number | undefined,
  last_read_message_id: number | null
): void {
  try {
    localStorage.setItem(
      lsKey(chatId, userId),
      JSON.stringify({ last_read_message_id })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export type ReadScope = "global" | { peerId: number };

function matchesActiveScope(
  mode: ChatMode,
  peerId: number | null,
  scope: ReadScope
): boolean {
  if (scope === "global") return mode === "global";
  return mode === "private" && peerId === scope.peerId;
}

function isOwnLine(line: ChatLine, me?: number): boolean {
  if (line.isOwn === true) return true;
  if (me != null && line.senderId != null && line.senderId === me) return true;
  return false;
}

/** Index of first line with numeric id > lastRead; `null` if none / nothing unread. */
export function firstUnreadLineIndex(lines: ChatLine[], lastRead: number | null): number | null {
  if (lastRead == null) return null;
  for (let i = 0; i < lines.length; i++) {
    const n = numericMessageId(lines[i]!.id);
    if (!Number.isFinite(n)) continue;
    if (n > lastRead) return i;
  }
  return null;
}

export function unreadCountFromLines(lines: ChatLine[], lastRead: number | null): number {
  const first = firstUnreadLineIndex(lines, lastRead);
  if (first == null) return 0;
  return lines.length - first;
}

/** Row index for a message id, or null if absent (e.g. deleted). */
export function lineIndexForMessageId(
  lines: ChatLine[],
  messageId: number
): number | null {
  for (let i = 0; i < lines.length; i++) {
    const n = numericMessageId(lines[i]!.id);
    if (Number.isFinite(n) && n === messageId) return i;
  }
  return null;
}

/** Smallest numeric message id in the loaded list (chronological first row). */
export function minLoadedNumericId(lines: ChatLine[]): number | null {
  let min: number | null = null;
  for (const l of lines) {
    const n = numericMessageId(l.id);
    if (!Number.isFinite(n)) continue;
    min = min == null ? n : Math.min(min, n);
  }
  return min;
}

export type UseReadMessageHistoryArgs = {
  mode: ChatMode;
  peerId: number | null;
  lines: ChatLine[];
  currentUserId?: number;
  /** When false (e.g. global room unavailable), skip all read-state API calls. */
  enabled: boolean;
  /**
   * True when older pages can be loaded (scroll-up). Used with oldest loaded id vs
   * `last_read` to detect a pagination gap (WS tail without middle history).
   */
  hasMoreOlder?: boolean;
};

export type UseReadMessageHistoryResult = {
  loaded: boolean;
  /** Effective last-read cursor; null before server or explicit “no cursor”. */
  lastReadMessageId: number | null;
  /** Messages after server cursor (list indices; ids may gap). */
  unreadCount: number;
  /** True when oldest loaded id &gt; last_read+1 (more unread exist above the window). */
  unreadBadgeAtLeast: boolean;
  /** Insert “New messages” divider immediately before this line index; `null` = none. */
  unreadDividerBeforeIndex: number | null;
  /** Scroll to this message on first thread fill; `null` = scroll to last message. */
  initialScrollMessageId: string | number | null;
  /** New user: do not POST from scroll until user leaves bottom / first read action. */
  newUserScrollPatchBlocked: boolean;
  onLeftBottom: () => void;
  onVisibleReadCandidate: (messageId: number) => void;
  /** After jump-to-newest control: mark all read on server + local cursor. */
  onJumpToNewest: () => void;
  /** WebSocket added a chat line for the active scope (after store update). */
  onChatMessageAdded: (line: ChatLine, scope: ReadScope) => void;
  flushPendingPatch: () => void;
};

export function useReadMessageHistory(
  args: UseReadMessageHistoryArgs
): UseReadMessageHistoryResult {
  const { mode, peerId, lines, currentUserId, enabled, hasMoreOlder = false } = args;

  const [fetchReady, setFetchReady] = useState(false);
  const [serverLastRead, setServerLastRead] = useState<number | null>(null);
  const [lastRead, setLastRead] = useState<number | null>(null);
  const [initialScrollMessageId, setInitialScrollMessageId] = useState<
    string | number | null
  >(null);
  const [newUserScrollPatchBlocked, setNewUserScrollPatchBlocked] = useState(false);
  /** First unread message id when unread count went 0 → &gt;0; divider stays until count is 0. */
  const [dividerBatchStartMessageId, setDividerBatchStartMessageId] = useState<
    number | null
  >(null);

  const global403Ref = useRef(false);
  const scrollPatchEnabledRef = useRef(false);
  const lastPostAtRef = useRef(0);
  const pendingPostIdRef = useRef<number | null>(null);
  const postTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReadRef = useRef<number | null>(null);
  const serverLastReadRef = useRef<number | null>(null);
  const linesRef = useRef(lines);
  const prevVisibleRef = useRef(
    typeof document !== "undefined" && document.visibilityState === "visible"
  );
  const chatIdRef = useRef<string | null>(null);
  const prevUnreadCountRef = useRef(0);
  const userIdRef = useRef(currentUserId);
  /** After snapshot with a cursor, ignore intersection-driven read bumps until this time (layout/IO noise). */
  const readCursorIoGateUntilRef = useRef(0);
  const lastDocHiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    userIdRef.current = currentUserId;
  }, [currentUserId]);

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
    const chatId = encodeChatReadId(mode, peerId);
    if (chatId == null) return null;
    if (mode === "private" && peerId == null) return null;
    return { chatId, mode, peerId } as const;
  }, [enabled, mode, peerId]);

  useEffect(() => {
    chatIdRef.current = readParams?.chatId ?? null;
  }, [readParams]);

  const readStateReady = readParams == null || fetchReady;

  const unreadCount = useMemo(
    () => unreadCountFromLines(lines, lastRead),
    [lines, lastRead]
  );

  /** Unread messages exist above the loaded window (pagination / initial WS batch). */
  const hasUnreadBeyondLoaded = useMemo(() => {
    if (lastRead == null) return false;
    const min = minLoadedNumericId(lines);
    return min != null && min > lastRead + 1;
  }, [lines, lastRead]);

  /** Badge “N+” when we know there are more unreads than fit in `lines`. */
  const unreadBadgeAtLeast = hasUnreadBeyondLoaded && hasMoreOlder;

  /* eslint-disable react-hooks/set-state-in-effect -- batch divider anchor on unread 0→N transitions */
  useLayoutEffect(() => {
    if (!readStateReady || !enabled) return;

    if (unreadCount === 0) {
      setDividerBatchStartMessageId(null);
      prevUnreadCountRef.current = 0;
      return;
    }

    const prev = prevUnreadCountRef.current;
    prevUnreadCountRef.current = unreadCount;

    if (prev === 0 && unreadCount > 0) {
      const idx = firstUnreadLineIndex(lines, lastRead);
      if (idx != null) {
        const id = numericMessageId(lines[idx]!.id);
        if (Number.isFinite(id)) setDividerBatchStartMessageId(id);
      }
    }
  }, [unreadCount, lines, lastRead, readStateReady, enabled]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const unreadDividerBeforeIndex = useMemo(() => {
    if (!readStateReady || !enabled || unreadCount === 0) return null;
    if (dividerBatchStartMessageId != null) {
      const at = lineIndexForMessageId(lines, dividerBatchStartMessageId);
      if (at != null) return at;
    }
    return firstUnreadLineIndex(lines, lastRead);
  }, [
    readStateReady,
    enabled,
    unreadCount,
    lines,
    lastRead,
    dividerBatchStartMessageId,
  ]);

  const clearPostTimer = useCallback(() => {
    if (postTimerRef.current) {
      clearTimeout(postTimerRef.current);
      postTimerRef.current = null;
    }
  }, []);

  const runPost = useCallback(
    async (id: number, immediate: boolean) => {
      if (!enabled || global403Ref.current) return;
      const chatId = chatIdRef.current;
      if (!chatId) return;
      await postChatReadStatus(chatId, id);
      if (immediate) {
        lastPostAtRef.current = Date.now();
      }
      writeCachedLastRead(chatId, userIdRef.current, id);
    },
    [enabled]
  );

  const schedulePost = useCallback(
    (id: number, immediate: boolean) => {
      if (!enabled || global403Ref.current) return;
      const now = Date.now();
      if (immediate) {
        clearPostTimer();
        pendingPostIdRef.current = null;
        void runPost(id, true).catch((err) => {
          if (axios.isAxiosError(err) && err.response?.status === 403) {
            global403Ref.current = true;
            return;
          }
          toast.error("Could not update read position");
        });
        return;
      }

      pendingPostIdRef.current =
        pendingPostIdRef.current == null
          ? id
          : Math.max(pendingPostIdRef.current, id);

      const elapsed = now - lastPostAtRef.current;
      const delay = Math.max(0, READ_POST_DEBOUNCE_MS - elapsed);

      clearPostTimer();
      postTimerRef.current = window.setTimeout(() => {
        postTimerRef.current = null;
        const pending = pendingPostIdRef.current;
        pendingPostIdRef.current = null;
        if (pending == null) return;
        lastPostAtRef.current = Date.now();
        void runPost(pending, false).catch((err) => {
          if (axios.isAxiosError(err) && err.response?.status === 403) {
            global403Ref.current = true;
            return;
          }
          toast.error("Could not update read position");
        });
      }, delay);
    },
    [enabled, runPost, clearPostTimer]
  );

  const flushPendingPatch = useCallback(() => {
    clearPostTimer();
    const pending = pendingPostIdRef.current;
    pendingPostIdRef.current = null;
    if (pending == null) return;
    lastPostAtRef.current = Date.now();
    void runPost(pending, false).catch((err) => {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        global403Ref.current = true;
        return;
      }
      toast.error("Could not update read position");
    });
  }, [runPost, clearPostTimer]);

  useEffect(() => {
    if (readParams != null) return;
    queueMicrotask(() => {
      setServerLastRead(null);
      setLastRead(null);
      setInitialScrollMessageId(null);
      setNewUserScrollPatchBlocked(false);
      scrollPatchEnabledRef.current = false;
      setDividerBatchStartMessageId(null);
      prevUnreadCountRef.current = 0;
    });
  }, [readParams]);

  useEffect(() => {
    if (!readParams) {
      return;
    }

    let cancelled = false;

    /* eslint-disable react-hooks/set-state-in-effect */
    setFetchReady(false);
    setServerLastRead(null);
    setLastRead(null);
    lastReadRef.current = null;
    serverLastReadRef.current = null;
    setInitialScrollMessageId(null);
    setNewUserScrollPatchBlocked(false);
    scrollPatchEnabledRef.current = false;
    setDividerBatchStartMessageId(null);
    prevUnreadCountRef.current = 0;
    readCursorIoGateUntilRef.current = 0;
    /* eslint-enable react-hooks/set-state-in-effect */

    const { chatId } = readParams;
    const cached = readCachedLastRead(chatId, userIdRef.current);
    if (cached !== undefined) {
      setLastRead(cached);
      lastReadRef.current = cached;
    }

    (async () => {
      try {
        const data = await getChatReadStatus(chatId);
        if (cancelled) return;
        global403Ref.current = false;
        setFetchReady(true);
        const lr = data.last_read_message_id;
        setServerLastRead(lr);
        setLastRead(lr);
        lastReadRef.current = lr;
        serverLastReadRef.current = lr;
        writeCachedLastRead(chatId, userIdRef.current, lr);

        if (lr === null) {
          setInitialScrollMessageId(null);
          setNewUserScrollPatchBlocked(true);
          scrollPatchEnabledRef.current = false;
          readCursorIoGateUntilRef.current = 0;
        } else {
          setInitialScrollMessageId(lr);
          setNewUserScrollPatchBlocked(false);
          scrollPatchEnabledRef.current = true;
          readCursorIoGateUntilRef.current = Date.now() + 1200;
        }
        lastPostAtRef.current = Date.now();
      } catch (err) {
        if (cancelled) return;
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          if (readParams.mode === "global") {
            global403Ref.current = true;
            setFetchReady(true);
            setServerLastRead(null);
            setLastRead(null);
            setInitialScrollMessageId(null);
            setNewUserScrollPatchBlocked(false);
            readCursorIoGateUntilRef.current = 0;
            return;
          }
        }
        setFetchReady(true);
        setInitialScrollMessageId(null);
        readCursorIoGateUntilRef.current = 0;
        toast.error("Could not load read state");
      }
    })();

    return () => {
      cancelled = true;
      flushPendingPatch();
    };
  }, [readParams, flushPendingPatch]);

  const bumpLastRead = useCallback(
    (id: number, postImmediate: boolean) => {
      setLastRead((prev) => {
        const next = prev == null ? id : Math.max(prev, id);
        lastReadRef.current = next;
        const cid = chatIdRef.current;
        if (cid) writeCachedLastRead(cid, userIdRef.current, next);
        return next;
      });
      if (postImmediate) {
        schedulePost(id, true);
      }
    },
    [schedulePost]
  );

  const applyMarkAllReadSnapshot = useCallback((lr: number | null) => {
    setServerLastRead(lr);
    setLastRead(lr);
    lastReadRef.current = lr;
    serverLastReadRef.current = lr;
    const cid = chatIdRef.current;
    if (cid) writeCachedLastRead(cid, userIdRef.current, lr);
    if (lr === null) {
      setNewUserScrollPatchBlocked(true);
      scrollPatchEnabledRef.current = false;
    } else {
      setNewUserScrollPatchBlocked(false);
      scrollPatchEnabledRef.current = true;
    }
  }, []);

  const markAllReadRemote = useCallback(async () => {
    if (!enabled || global403Ref.current) return;
    const chatId = chatIdRef.current;
    if (!chatId) return;
    clearPostTimer();
    pendingPostIdRef.current = null;
    const snap = await postChatMarkAllRead(chatId);
    applyMarkAllReadSnapshot(snap.last_read_message_id);
    lastPostAtRef.current = Date.now();
  }, [enabled, clearPostTimer, applyMarkAllReadSnapshot]);

  /** Tab visible again: only mark-all-read when list-derived unread > 0 (treb block 8). */
  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      if (!visible) {
        lastDocHiddenAtRef.current = Date.now();
        prevVisibleRef.current = false;
        return;
      }
      const wasVisible = prevVisibleRef.current;
      prevVisibleRef.current = true;
      if (wasVisible) return;

      const hiddenAt = lastDocHiddenAtRef.current;
      const hiddenMs = hiddenAt != null ? Date.now() - hiddenAt : 0;
      if (hiddenMs < 800) return;

      if (!enabled || global403Ref.current || !readStateReady) return;

      const lr = lastReadRef.current;
      const list = linesRef.current;
      const first = firstUnreadLineIndex(list, lr);
      const unread = first == null ? 0 : list.length - first;
      if (unread <= 0) return;

      const minL = minLoadedNumericId(list);
      if (lr != null && minL != null && minL > lr + 1) {
        return;
      }

      void markAllReadRemote().catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          global403Ref.current = true;
          return;
        }
        toast.error("Could not mark messages read");
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, readStateReady, markAllReadRemote]);

  const onLeftBottom = useCallback(() => {
    readCursorIoGateUntilRef.current = 0;
    if (newUserScrollPatchBlocked) {
      scrollPatchEnabledRef.current = true;
      setNewUserScrollPatchBlocked(false);
    }
  }, [newUserScrollPatchBlocked]);

  const onVisibleReadCandidate = useCallback(
    (messageId: number) => {
      if (!enabled || global403Ref.current) return;
      if (!Number.isFinite(messageId)) return;
      if (Date.now() < readCursorIoGateUntilRef.current) return;

      const lr0 = lastReadRef.current;
      const min0 = minLoadedNumericId(linesRef.current);
      if (
        lr0 != null &&
        min0 != null &&
        min0 > lr0 + 1
      ) {
        return;
      }

      const cur = lastReadRef.current;
      if (cur != null && messageId <= cur) return;

      if (serverLastReadRef.current === null && !scrollPatchEnabledRef.current) {
        return;
      }

      setLastRead((prev) => {
        const next = prev == null ? messageId : Math.max(prev, messageId);
        lastReadRef.current = next;
        const cid = chatIdRef.current;
        if (cid) writeCachedLastRead(cid, userIdRef.current, next);
        return next;
      });
      schedulePost(messageId, false);
    },
    [enabled, schedulePost]
  );

  const onJumpToNewest = useCallback(() => {
    if (!enabled || global403Ref.current) return;
    void markAllReadRemote().catch((err) => {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        global403Ref.current = true;
        return;
      }
      toast.error("Could not mark messages read");
    });
  }, [enabled, markAllReadRemote]);

  const onChatMessageAdded = useCallback(
    (line: ChatLine, scope: ReadScope) => {
      if (!matchesActiveScope(mode, peerId, scope)) return;
      if (!enabled || global403Ref.current) return;
      if (!readStateReady) return;

      const id = numericMessageId(line.id);
      if (!Number.isFinite(id)) return;

      const tabVisible = document.visibilityState === "visible";

      if (isOwnLine(line, currentUserId)) {
        bumpLastRead(id, true);
        return;
      }

      if (tabVisible) {
        if (Date.now() < readCursorIoGateUntilRef.current) return;
        const lr0 = lastReadRef.current;
        const min0 = minLoadedNumericId(linesRef.current);
        if (lr0 != null && min0 != null && min0 > lr0 + 1) return;
        bumpLastRead(id, true);
      }
    },
    [mode, peerId, enabled, readStateReady, currentUserId, bumpLastRead]
  );

  useEffect(() => {
    return () => {
      flushPendingPatch();
    };
  }, [flushPendingPatch]);

  return useMemo(
    () => ({
      loaded: readStateReady,
      lastReadMessageId: lastRead,
      unreadCount,
      unreadBadgeAtLeast,
      unreadDividerBeforeIndex,
      initialScrollMessageId,
      newUserScrollPatchBlocked,
      onLeftBottom,
      onVisibleReadCandidate,
      onJumpToNewest,
      onChatMessageAdded,
      flushPendingPatch,
    }),
    [
      readStateReady,
      lastRead,
      unreadCount,
      unreadBadgeAtLeast,
      unreadDividerBeforeIndex,
      initialScrollMessageId,
      newUserScrollPatchBlocked,
      onLeftBottom,
      onVisibleReadCandidate,
      onJumpToNewest,
      onChatMessageAdded,
      flushPendingPatch,
    ]
  );
}
