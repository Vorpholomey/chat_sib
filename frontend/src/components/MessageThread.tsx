import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, Pencil, Pin, Reply, Trash2 } from "lucide-react";
import { assetUrl } from "../lib/config";
import { usernameColorFromUser } from "../lib/usernameColor";
import { positionMenuNearPointInBounds } from "../lib/floatingMenuPosition";
import { formatTimeHm, lineKey } from "../store/chatStore";
import type { ChatLine, ChatMode } from "../types/chat";
import { normalizeReactions, type ReactionKind } from "../types/reactions";
import type { UserRole } from "../types/user";
import { MessageReactionChips, ReactionPickerControl } from "./MessageReactions";
import { RoleBadge } from "./RoleBadge";

type Props = {
  lines: ChatLine[];
  emptyHint: string;
  mode: ChatMode;
  currentUserId?: number;
  /** When true, own global edit/delete are disabled (public room ban) */
  globalRoomBanned?: boolean;
  isModerator?: boolean;
  isAdmin?: boolean;
  pinnedMessageId?: string | number | null;
  onReply?: (line: ChatLine) => void;
  onEditOwn?: (line: ChatLine) => void;
  onDeleteOwn?: (line: ChatLine) => void;
  onModDelete?: (line: ChatLine) => void;
  onPin?: (line: ChatLine) => void;
  onBanFromMessage?: (userId: number, username: string) => void;
  onReactionToggle?: (messageId: string | number, kind: ReactionKind) => void;
};

/** Matches prior `min-w-[10rem]` so positioning clamps correctly. */
const MESSAGE_MENU_MIN_W = 160;
const ESTIMATED_MENU_H = 180;

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
  pinnedMessageId,
  onReply,
  onEditOwn,
  onDeleteOwn,
  onModDelete,
  onPin,
  onBanFromMessage,
  onReactionToggle,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const menuAnchorRef = useRef<DOMRect | null>(null);
  const [menuId, setMenuId] = useState<string | number | null>(null);
  const [menuFixed, setMenuFixed] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

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

  const openContextMenu = (line: ChatLine, e: React.MouseEvent) => {
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
  };

  const closeMenu = () => {
    setMenuId(null);
    setMenuFixed(null);
    menuAnchorRef.current = null;
  };

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
        const showPin =
          canMod && isGlobal && onPin && String(line.id) !== String(pinnedMessageId ?? "");
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
    <div
      ref={threadRef}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
    >
      {lines.length === 0 ? (
        <p className="m-auto text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <ul className="pr-1">
          {lines.map((line) => {
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
            const showPin =
              canMod && isGlobal && onPin && String(line.id) !== String(pinnedMessageId ?? "");
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

            const hasMenu =
              onReply ||
              allowOwnEdit ||
              allowOwnDelete ||
              showModDelete ||
              showPin ||
              showBan ||
              banLocked;

            const reactions = normalizeReactions(line.reactions);

            return (
              <li
                key={lineKey(line)}
                className="group relative mb-3 text-sm leading-relaxed text-slate-200 last:mb-0"
                onContextMenu={hasMenu ? (e) => openContextMenu(line, e) : undefined}
              >
                <div
                  className={`flex w-full min-w-0 items-center gap-2 ${
                    own ? "justify-end" : "justify-start"
                  }`}
                >
                  {onReply && own && (
                    <div
                      className="relative order-first flex shrink-0 flex-col items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
                    >
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
                        aria-label="Reply"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReply(line);
                        }}
                      >
                        <Reply className="h-4 w-4" />
                      </button>
                      <ReactionPickerControl
                        reactions={reactions}
                        currentUserId={currentUserId}
                        own={own}
                        panelAlign="left"
                        boundsRef={threadRef}
                        onToggle={(kind) => onReactionToggle?.(line.id, kind)}
                      />
                    </div>
                  )}
                  <div
                    className={`flex w-max min-w-0 max-w-[66.666%] flex-col gap-1 rounded-xl border px-3 py-2.5 ${
                      own
                        ? "border-violet-800/35 bg-violet-950/35 text-slate-100"
                        : "border-slate-700/80 bg-slate-800/75 text-slate-200"
                    }`}
                  >
                    {line.replyTo && (
                      <div className="mb-1 border-l-2 border-slate-600/80 pl-2 text-left text-xs text-slate-500">
                        <span
                          className="font-bold"
                          style={{
                            color: usernameColorFromUser(line.replyTo.id, line.replyTo.username),
                          }}
                        >
                          {line.replyTo.username}
                        </span>
                        <span className="line-clamp-2 block text-slate-500">
                          {line.replyTo.text}
                        </span>
                      </div>
                    )}
                    {!own && (
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-left text-xs text-slate-500">
                        <span
                          className="font-bold"
                          style={{
                            color: usernameColorFromUser(line.senderId, line.author),
                          }}
                        >
                          {line.author}
                        </span>
                        {line.authorRole && <RoleBadge role={line.authorRole} />}
                        {line.editedAt && <span className="italic">(edited)</span>}
                      </div>
                    )}
                    <div className="min-w-0">
                      {line.contentType === "text" ? (
                        <span className="whitespace-pre-wrap break-words">{line.body}</span>
                      ) : (
                        <span className="inline-block align-top">
                          <span className="text-slate-400">[image]</span>
                          <img
                            src={assetUrl(line.body)}
                            alt=""
                            className="mt-1 max-h-64 max-w-full rounded border border-slate-700 object-contain"
                          />
                        </span>
                      )}
                    </div>
                    <MessageReactionChips
                      reactions={reactions}
                      currentUserId={currentUserId}
                      own={own}
                      onToggle={(kind) => onReactionToggle?.(line.id, kind)}
                    />
                    {!onReply && (
                      <div className="mt-1.5 flex justify-end">
                        <ReactionPickerControl
                          reactions={reactions}
                          currentUserId={currentUserId}
                          own={own}
                          panelAlign="right"
                          boundsRef={threadRef}
                          onToggle={(kind) => onReactionToggle?.(line.id, kind)}
                        />
                      </div>
                    )}
                    <div className="mt-0.5 text-right text-xs text-slate-500">
                      <span className="font-mono tabular-nums">{formatTimeHm(line.at)}</span>
                      {own && line.editedAt && (
                        <span className="ml-1.5 italic">· edited</span>
                      )}
                    </div>
                  </div>
                  {onReply && !own && (
                    <div className="relative flex shrink-0 flex-col items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
                        aria-label="Reply"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReply(line);
                        }}
                      >
                        <Reply className="h-4 w-4" />
                      </button>
                      <ReactionPickerControl
                        reactions={reactions}
                        currentUserId={currentUserId}
                        own={own}
                        panelAlign="right"
                        boundsRef={threadRef}
                        onToggle={(kind) => onReactionToggle?.(line.id, kind)}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={bottomRef} />

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
