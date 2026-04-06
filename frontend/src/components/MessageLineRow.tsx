import { memo, useMemo, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { Pin, Reply } from "lucide-react";
import { assetUrl } from "../lib/config";
import { usernameColorFromUser } from "../lib/usernameColor";
import { formatTimeHm } from "../store/chatStore";
import type { ChatLine } from "../types/chat";
import { normalizeReactions, type ReactionKind } from "../types/reactions";
import type { UserRole } from "../types/user";
import { MessageReactionChips, ReactionPickerControl } from "./MessageReactions";
import { MessageRichText } from "./MessageRichText";
import { ReplyQuotePreview } from "./ReplyQuotePreview";
import { RoleBadge } from "./RoleBadge";

function roleRank(r: UserRole | undefined): number {
  if (r === "admin") return 3;
  if (r === "moderator") return 2;
  return 1;
}

export type MessageLineRowProps = {
  line: ChatLine;
  currentUserId?: number;
  globalRoomBanned: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  canMod: boolean;
  isGlobal: boolean;
  pinnedSet: Set<string>;
  highlightMessageId: string | number | null;
  threadRef: RefObject<HTMLDivElement | null>;
  onContextMenu: (line: ChatLine, e: ReactMouseEvent) => void;
  onReply?: (line: ChatLine) => void;
  onEditOwn?: (line: ChatLine) => void;
  onDeleteOwn?: (line: ChatLine) => void;
  onPin?: (line: ChatLine) => void;
  onBanFromMessage?: (userId: number, username: string) => void;
  onReactionToggle?: (messageId: string | number, kind: ReactionKind) => void;
  onOpenPrivateChat?: (userId: number, username: string) => void;
  onJumpToMessage?: (messageId: string | number) => void;
};

function MessageLineRowInner({
  line,
  currentUserId,
  globalRoomBanned,
  isModerator,
  isAdmin,
  canMod,
  isGlobal,
  pinnedSet,
  highlightMessageId,
  threadRef,
  onContextMenu,
  onReply,
  onEditOwn,
  onDeleteOwn,
  onPin,
  onBanFromMessage,
  onReactionToggle,
  onOpenPrivateChat,
  onJumpToMessage,
}: MessageLineRowProps) {
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
  const isPinnedIdRow = pinnedSet.has(String(line.id));
  const showPin = canMod && isGlobal && onPin && !isPinnedIdRow;
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

  const reactions = useMemo(
    () => normalizeReactions(line.reactions),
    [line.reactions]
  );
  const isPinnedRow = isGlobal && isPinnedIdRow;
  const isHighlighted =
    highlightMessageId != null &&
    String(highlightMessageId) === String(line.id);

  const imageSrc =
    line.contentType !== "text" ? assetUrl(line.body) : "";

  return (
    <li
      data-chat-message-id={String(line.id)}
      className="group relative mb-3 text-sm leading-relaxed text-slate-200 last:mb-0"
      onContextMenu={hasMenu ? (e) => onContextMenu(line, e) : undefined}
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
          className={`flex w-max min-w-0 max-w-[66.666%] flex-col gap-1 rounded-xl border px-3 py-2.5 transition-[box-shadow] duration-300 ${
            own
              ? "border-violet-800/35 bg-violet-950/35 text-slate-100"
              : "border-slate-700/80 bg-slate-800/75 text-slate-200"
          } ${isHighlighted ? "ring-2 ring-amber-400/85" : ""}`}
        >
          {line.replyTo && (
            <div className="mb-1 border-l-2 border-slate-600/80 pl-2 text-left text-xs text-slate-500">
              {isGlobal &&
              onOpenPrivateChat &&
              line.replyTo.id !== currentUserId ? (
                <button
                  type="button"
                  className="font-bold hover:underline"
                  style={{
                    color: usernameColorFromUser(
                      line.replyTo.id,
                      line.replyTo.username
                    ),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPrivateChat(line.replyTo!.id, line.replyTo!.username);
                  }}
                >
                  {line.replyTo.username}
                </button>
              ) : (
                <span
                  className="font-bold"
                  style={{
                    color: usernameColorFromUser(
                      line.replyTo.id,
                      line.replyTo.username
                    ),
                  }}
                >
                  {line.replyTo.username}
                </span>
              )}
              <ReplyQuotePreview
                contentType={line.replyTo.contentType}
                text={line.replyTo.text}
              />
            </div>
          )}
          {!own && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-left text-xs text-slate-500">
              {isGlobal &&
              onOpenPrivateChat &&
              line.senderId != null &&
              line.senderId !== currentUserId ? (
                <button
                  type="button"
                  className="font-bold hover:underline"
                  style={{
                    color: usernameColorFromUser(line.senderId, line.author),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPrivateChat(line.senderId!, line.author);
                  }}
                >
                  {line.author}
                </button>
              ) : (
                <span
                  className="font-bold"
                  style={{
                    color: usernameColorFromUser(line.senderId, line.author),
                  }}
                >
                  {line.author}
                </span>
              )}
              {line.authorRole && <RoleBadge role={line.authorRole} />}
              {line.editedAt && <span className="italic">(edited)</span>}
            </div>
          )}
          <div className="min-w-0">
            {line.contentType === "text" ? (
              <MessageRichText body={line.body} />
            ) : (
              <span className="inline-block align-top">
                <span className="text-slate-400">[image]</span>
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt=""
                    className="mt-1 max-h-64 max-w-full rounded border border-slate-700 object-contain"
                  />
                ) : (
                  <span className="mt-1 block text-xs text-slate-500">
                    Unavailable
                  </span>
                )}
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
          <div className="mt-0.5 flex items-center justify-end gap-2 text-right text-xs text-slate-500">
            {isPinnedRow && onJumpToMessage && (
              <button
                type="button"
                className="inline-flex shrink-0 items-center rounded p-0.5 text-amber-400/90 hover:bg-amber-950/40 hover:text-amber-300"
                aria-label="Scroll to pinned message"
                title="Scroll to this message"
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToMessage(line.id);
                }}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
            )}
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
}

export const MessageLineRow = memo(MessageLineRowInner);
