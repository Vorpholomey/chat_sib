import type { MessageReactionState } from "./reactions";
import type { UserRole } from "./user";

export type ContentType = "text" | "image" | "gif";

export type ChatMode = "global" | "private";

/** Quote target for replies (matches backend reply_to / reply_to_id) */
export type ReplyRef = {
  id: number;
  username: string;
  /** Short preview of quoted text */
  text: string;
};

/** Normalized row for UI */
export type ChatLine = {
  id: string | number;
  at: string;
  /** Label before colon */
  author: string;
  body: string;
  contentType: ContentType;
  senderId?: number;
  recipientId?: number;
  replyTo?: ReplyRef;
  editedAt?: string;
  /** Set when known (e.g. from WS); UI can also derive from senderId === me */
  isOwn?: boolean;
  /** Author role when API/WS sends it (moderation UI) */
  authorRole?: UserRole;
  /** Server-synced emoji reactions (user ids per kind); merged from WebSocket/API */
  reactions?: MessageReactionState;
};

export type SidebarUser = {
  id: number;
  username: string;
  online: boolean;
  role?: UserRole;
};
