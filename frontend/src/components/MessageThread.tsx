import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, MoreHorizontal, Pencil, Pin, Reply, Trash2 } from "lucide-react";
import { assetUrl } from "../lib/config";
import {
  computeFloatingMenuLeft,
  computeFloatingMenuTopInitial,
  computeFloatingMenuTopRefined,
} from "../lib/floatingMenuPosition";
import { formatTime, lineKey } from "../store/chatStore";
import type { ChatLine, ChatMode } from "../types/chat";
import type { UserRole } from "../types/user";
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
};

/** Matches prior `min-w-[10rem]` so positioning clamps correctly. */
const MESSAGE_MENU_MIN_W = 160;

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
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [menuId, setMenuId] = useState<string | number | null>(null);
  const [menuFixed, setMenuFixed] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);

  const openLine = menuId != null ? lines.find((l) => l.id === menuId) : undefined;

  useLayoutEffect(() => {
    if (menuId === null || !menuFixed) return;
    const btn = triggerRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;
    const rect = btn.getBoundingClientRect();
    const h = menu.offsetHeight;
    const top = computeFloatingMenuTopRefined(rect, h);
    setMenuFixed((prev) => (prev && prev.top !== top ? { ...prev, top } : prev));
    // menuFixed omitted on purpose: only re-measure when menu target line changes
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
      }
    };
    const closeOnScroll = () => {
      setMenuId(null);
      setMenuFixed(null);
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

  const openMenuForLine = (line: ChatLine, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (menuId === line.id) {
      setMenuId(null);
      setMenuFixed(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuFixed({
      left: computeFloatingMenuLeft(rect, MESSAGE_MENU_MIN_W),
      top: computeFloatingMenuTopInitial(rect, 180),
    });
    setMenuId(line.id);
  };

  const closeMenu = () => {
    setMenuId(null);
    setMenuFixed(null);
  };

  /** Menu flags for the line whose menu is open (portal). */
  const menuFlags = openLine
    ? (() => {
        const line = openLine;
        const own =
          currentUserId != null &&
          line.senderId != null &&
          line.senderId === currentUserId;
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
      {lines.length === 0 ? (
        <p className="m-auto text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <ul className="space-y-2 pr-1">
          {lines.map((line) => {
            const own =
              currentUserId != null &&
              line.senderId != null &&
              line.senderId === currentUserId;
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

            const menuOpen = menuId === line.id;

            const hasMenu =
              onReply ||
              allowOwnEdit ||
              allowOwnDelete ||
              showModDelete ||
              showPin ||
              showBan ||
              banLocked;

            return (
              <li
                key={lineKey(line)}
                className="group relative text-sm leading-relaxed text-slate-200"
              >
                {line.replyTo && (
                  <div className="mb-1 ml-2 border-l-2 border-slate-600 pl-2 text-xs text-slate-500">
                    <span className="text-slate-400">{line.replyTo.username}</span>
                    <span className="line-clamp-2 block text-slate-500">
                      {line.replyTo.text}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-xs text-slate-500">
                      {formatTime(line.at)}
                    </span>{" "}
                    <span className="font-semibold text-violet-300">{line.author}</span>
                    {line.authorRole && (
                      <>
                        {" "}
                        <RoleBadge role={line.authorRole} />
                      </>
                    )}
                    {line.editedAt && (
                      <span className="text-xs italic text-slate-500"> (edited)</span>
                    )}
                    <span className="text-slate-500">:</span>{" "}
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
                  {hasMenu && (
                    <div
                      className="relative shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
                      data-message-actions-menu
                    >
                      <button
                        ref={menuOpen ? triggerRef : undefined}
                        type="button"
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        aria-label="Message actions"
                        onClick={(e) => openMenuForLine(line, e)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
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
