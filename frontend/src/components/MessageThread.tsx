import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Ban, ChevronDown, Loader2, Pencil, Pin, Reply, Trash2 } from "lucide-react";
import { positionMenuNearPointInBounds } from "../lib/floatingMenuPosition";
import { lineKey } from "../store/chatStore";
import type { ChatLine, ChatMode } from "../types/chat";
import type { ReactionKind } from "../types/reactions";
import type { UserRole } from "../types/user";
import { MessageLineRow } from "./MessageLineRow";

type Props = {
  lines: ChatLine[];
  emptyHint: string;
  mode: ChatMode;
  currentUserId?: number;
  /** When true, own global edit/delete are disabled (public room ban) */
  globalRoomBanned?: boolean;
  isModerator?: boolean;
  isAdmin?: boolean;
  /** Global message ids that are pinned (for pin marker / hide Pin in menu). */
  pinnedMessageIds?: (string | number)[];
  /** When set, scroll to this message (smooth, center), then highlight briefly. */
  scrollToMessageId?: string | number | null;
  onScrollToMessageDone?: () => void;
  /** In-chat search: scroll to this message instantly (center). */
  searchScrollToMessageId?: string | number | null;
  /** In-chat search: highlighted message id (yellow ring). */
  searchActiveMessageId?: string | number | null;
  /** In-chat search: substring for inline highlights on matching lines. */
  searchHighlightQuery?: string | null;
  /** Incremented (e.g. after login) to scroll to the newest message once lines are available. */
  scrollToBottomNonce?: number;
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => Promise<void>;
  /** Jump to a message in the thread (e.g. pinned marker click). */
  onJumpToMessage?: (messageId: string | number) => void;
  onReply?: (line: ChatLine) => void;
  onEditOwn?: (line: ChatLine) => void;
  onDeleteOwn?: (line: ChatLine) => void;
  onModDelete?: (line: ChatLine) => void;
  onPin?: (line: ChatLine) => void;
  onBanFromMessage?: (userId: number, username: string) => void;
  onReactionToggle?: (messageId: string | number, kind: ReactionKind) => void;
  /** Global chat only: open private chat with the user whose name was clicked */
  onOpenPrivateChat?: (userId: number, username: string) => void;
};

/** Matches prior `min-w-[10rem]` so positioning clamps correctly. */
const MESSAGE_MENU_MIN_W = 160;
const ESTIMATED_MENU_H = 180;
/** When within this many px of the top, fetch older messages. */
const SCROLL_LOAD_OLDER_PX = 120;

function roleRank(r: UserRole | undefined): number {
  if (r === "admin") return 3;
  if (r === "moderator") return 2;
  return 1;
}

export function MessageThread({
  lines,
  emptyHint,
  mode,
  currentUserId,
  globalRoomBanned = false,
  isModerator = false,
  isAdmin = false,
  pinnedMessageIds,
  scrollToMessageId = null,
  onScrollToMessageDone,
  searchScrollToMessageId = null,
  searchActiveMessageId = null,
  searchHighlightQuery = null,
  scrollToBottomNonce = 0,
  hasMoreOlder = false,
  loadingOlder = false,
  onLoadOlder,
  onJumpToMessage,
  onReply,
  onEditOwn,
  onDeleteOwn,
  onModDelete,
  onPin,
  onBanFromMessage,
  onReactionToggle,
  onOpenPrivateChat,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  /** When true, new incoming messages should keep the view pinned to the bottom. */
  const atBottomRef = useRef(true);
  const prevLastLineIdRef = useRef<string | number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | number | null>(
    null
  );
  const menuAnchorRef = useRef<DOMRect | null>(null);
  const [menuId, setMenuId] = useState<string | number | null>(null);
  const [menuFixed, setMenuFixed] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lastHandledBottomNonceRef = useRef(0);
  const scrollRestoreSnapRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(
    null
  );
  const loadOlderInFlightRef = useRef(false);

  const updateScrollPinnedState = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    const thresholdPx = 80;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom <= thresholdPx;
    atBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom && lines.length > 0);
  }, [lines.length]);

  const pinnedSet = useMemo(() => {
    if (!pinnedMessageIds?.length) return new Set<string>();
    return new Set(pinnedMessageIds.map((p) => String(p)));
  }, [pinnedMessageIds]);

  const openLine = menuId != null ? lines.find((l) => l.id === menuId) : undefined;

  useLayoutEffect(() => {
    if (menuId === null || !menuFixed) return;
    const menu = menuRef.current;
    const bounds = threadRef.current?.getBoundingClientRect();
    const anchor = menuAnchorRef.current;
    if (!menu || !bounds || !anchor) return;
    const { left, top } = positionMenuNearPointInBounds(
      anchor.x,
      anchor.y,
      menu.offsetWidth,
      menu.offsetHeight,
      bounds
    );
    setMenuFixed((prev) => {
      if (!prev || (prev.left === left && prev.top === top)) return prev;
      return { left, top };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId, openLine?.id]);

  /** New lines increase scrollHeight before scrollTop moves; measuring "at bottom" before scrolling falsely clears stickiness. Read stickiness first, scroll, then measure. */
  useLayoutEffect(() => {
    if (lines.length === 0) {
      prevLastLineIdRef.current = null;
      atBottomRef.current = true;
      setShowScrollToBottom(false);
      return;
    }
    const lastId = lines[lines.length - 1]!.id;
    if (prevLastLineIdRef.current === null) {
      prevLastLineIdRef.current = lastId;
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      atBottomRef.current = true;
      setShowScrollToBottom(false);
      updateScrollPinnedState();
      return;
    }
    if (prevLastLineIdRef.current !== lastId) {
      const shouldStickToBottom = atBottomRef.current;
      prevLastLineIdRef.current = lastId;
      if (shouldStickToBottom) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        atBottomRef.current = true;
        setShowScrollToBottom(false);
      }
    }
    updateScrollPinnedState();
  }, [lines, updateScrollPinnedState]);

  useLayoutEffect(() => {
    const snap = scrollRestoreSnapRef.current;
    if (!snap || !threadRef.current) return;
    scrollRestoreSnapRef.current = null;
    const el = threadRef.current;
    const dh = el.scrollHeight - snap.scrollHeight;
    if (dh > 0) {
      el.scrollTop = snap.scrollTop + dh;
    }
  }, [lines]);

  /** After login/register, ensure we end at the newest message once history has loaded (WS may stream many frames). */
  useLayoutEffect(() => {
    if (!scrollToBottomNonce) return;
    if (lines.length === 0) return;
    if (lastHandledBottomNonceRef.current === scrollToBottomNonce) return;
    lastHandledBottomNonceRef.current = scrollToBottomNonce;
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
    atBottomRef.current = true;
    setShowScrollToBottom(false);
    prevLastLineIdRef.current = lines[lines.length - 1]!.id;
    updateScrollPinnedState();
  }, [scrollToBottomNonce, lines, updateScrollPinnedState]);

  const scrollThreadToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    atBottomRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  const handleThreadScroll = useCallback(() => {
    updateScrollPinnedState();
    const el = threadRef.current;
    if (!el || !onLoadOlder || !hasMoreOlder || loadingOlder) return;
    if (el.scrollTop > SCROLL_LOAD_OLDER_PX) return;
    if (loadOlderInFlightRef.current) return;
    loadOlderInFlightRef.current = true;
    scrollRestoreSnapRef.current = {
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
    };
    void (async () => {
      try {
        await onLoadOlder();
      } finally {
        loadOlderInFlightRef.current = false;
      }
    })();
  }, [updateScrollPinnedState, onLoadOlder, hasMoreOlder, loadingOlder]);

  useLayoutEffect(() => {
    if (scrollToMessageId == null) return;
    const el = threadRef.current?.querySelector<HTMLElement>(
      `[data-chat-message-id="${String(scrollToMessageId)}"]`
    );
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightMessageId(scrollToMessageId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightMessageId(null);
      highlightTimerRef.current = null;
    }, 2000);
    onScrollToMessageDone?.();
  }, [scrollToMessageId, lines, onScrollToMessageDone]);

  useLayoutEffect(() => {
    if (searchScrollToMessageId == null) return;
    const el = threadRef.current?.querySelector<HTMLElement>(
      `[data-chat-message-id="${String(searchScrollToMessageId)}"]`
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "auto", block: "center" });
  }, [searchScrollToMessageId, lines]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (menuId === null) return;
    const onDocDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && !el.closest("[data-message-actions-menu]")) {
        setMenuId(null);
        setMenuFixed(null);
        menuAnchorRef.current = null;
      }
    };
    const closeOnScroll = () => {
      setMenuId(null);
      setMenuFixed(null);
      menuAnchorRef.current = null;
    };
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [menuId]);

  const canMod = isModerator || isAdmin;
  const isGlobal = mode === "global";

  const openContextMenu = useCallback(
    (line: ChatLine, e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const bounds = threadRef.current?.getBoundingClientRect();
      if (!bounds) return;
      if (menuId === line.id) {
        setMenuId(null);
        setMenuFixed(null);
        menuAnchorRef.current = null;
        return;
      }
      menuAnchorRef.current = new DOMRect(e.clientX, e.clientY, 0, 0);
      const { left, top } = positionMenuNearPointInBounds(
        e.clientX,
        e.clientY,
        MESSAGE_MENU_MIN_W,
        ESTIMATED_MENU_H,
        bounds
      );
      setMenuFixed({ left, top });
      setMenuId(line.id);
    },
    [menuId]
  );

  const closeMenu = useCallback(() => {
    setMenuId(null);
    setMenuFixed(null);
    menuAnchorRef.current = null;
  }, []);

  /** Menu flags for the line whose menu is open (portal). */
  const menuFlags = openLine
    ? (() => {
        const line = openLine;
        const own =
          line.isOwn === true ||
          (currentUserId != null &&
            line.senderId != null &&
            line.senderId === currentUserId);
        const authorIsElevated = roleRank(line.authorRole) >= 2;
        const showModDelete =
          canMod &&
          isGlobal &&
          !own &&
          line.authorRole !== "admin" &&
          line.senderId != null;
        const isPinnedId = pinnedSet.has(String(line.id));
        const showPin = canMod && isGlobal && onPin && !isPinnedId;
        const showBan =
          canMod &&
          isGlobal &&
          onBanFromMessage &&
          line.senderId != null &&
          line.senderId !== currentUserId &&
          !authorIsElevated;
        const banLocked = isModerator && !isAdmin && authorIsElevated;
        const allowOwnEdit =
          own &&
          line.contentType === "text" &&
          (!isGlobal || !globalRoomBanned) &&
          onEditOwn;
        const allowOwnDelete =
          own && (!isGlobal || !globalRoomBanned) && onDeleteOwn;
        return {
          own,
          showModDelete,
          showPin,
          showBan,
          banLocked,
          allowOwnEdit,
          allowOwnDelete,
        };
      })()
    : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={threadRef}
        onScroll={handleThreadScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
      >
        {lines.length === 0 ? (
          <p className="m-auto text-center text-sm text-slate-500">{emptyHint}</p>
        ) : (
          <ul className="pr-1">
            {lines.map((line) => (
              <MessageLineRow
                key={lineKey(line)}
                line={line}
                currentUserId={currentUserId}
                globalRoomBanned={globalRoomBanned}
                isModerator={isModerator}
                isAdmin={isAdmin}
                canMod={canMod}
                isGlobal={isGlobal}
                pinnedSet={pinnedSet}
                highlightMessageId={highlightMessageId}
                searchActiveMessageId={searchActiveMessageId}
                searchHighlightQuery={searchHighlightQuery}
                threadRef={threadRef}
                onContextMenu={openContextMenu}
                onReply={onReply}
                onEditOwn={onEditOwn}
                onDeleteOwn={onDeleteOwn}
                onPin={onPin}
                onBanFromMessage={onBanFromMessage}
                onReactionToggle={onReactionToggle}
                onOpenPrivateChat={onOpenPrivateChat}
                onJumpToMessage={onJumpToMessage}
              />
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {loadingOlder && (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-center gap-2 rounded-t-lg border-b border-slate-700/80 bg-slate-950/90 py-1.5 text-xs text-slate-400 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>Loading older messages…</span>
        </div>
      )}

      {showScrollToBottom && (
        <button
          type="button"
          aria-label="Scroll to latest messages"
          className="absolute bottom-3 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-800/95 text-slate-200 shadow-lg backdrop-blur-sm transition hover:bg-slate-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          onClick={scrollThreadToBottom}
        >
          <ChevronDown className="h-5 w-5" aria-hidden />
        </button>
      )}

      {openLine &&
        menuFixed &&
        menuFlags &&
        createPortal(
          <ul
            ref={menuRef}
            role="menu"
            data-message-actions-menu
            style={{
              position: "fixed",
              top: menuFixed.top,
              left: menuFixed.left,
              zIndex: 9999,
              minWidth: MESSAGE_MENU_MIN_W,
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg"
          >
            {onReply && (
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    onReply(openLine);
                    closeMenu();
                  }}
                >
                  <Reply className="h-3.5 w-3.5" />
                  Reply
                </button>
              </li>
            )}
            {menuFlags.allowOwnEdit && (
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    onEditOwn?.(openLine);
                    closeMenu();
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </li>
            )}
            {menuFlags.allowOwnDelete && (
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-300 hover:bg-slate-800"
                  onClick={() => {
                    onDeleteOwn?.(openLine);
                    closeMenu();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </li>
            )}
            {menuFlags.showModDelete && onModDelete && (
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-300 hover:bg-slate-800"
                  onClick={() => {
                    onModDelete(openLine);
                    closeMenu();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete (mod)
                </button>
              </li>
            )}
            {menuFlags.showPin && onPin && (
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    onPin(openLine);
                    closeMenu();
                  }}
                >
                  <Pin className="h-3.5 w-3.5" />
                  Pin
                </button>
              </li>
            )}
            {menuFlags.showBan && onBanFromMessage && !menuFlags.banLocked && (
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-amber-200 hover:bg-slate-800"
                  onClick={() => {
                    onBanFromMessage(openLine.senderId!, openLine.author);
                    closeMenu();
                  }}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Ban user
                </button>
              </li>
            )}
            {menuFlags.banLocked && (
              <li className="px-3 py-2 text-xs text-slate-500">
                Cannot ban moderators or admins
              </li>
            )}
          </ul>,
          document.body
        )}
    </div>
  );
}
