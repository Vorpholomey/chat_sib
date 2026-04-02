import type { ChatLine, ContentType, ReplyRef } from "../types/chat";
import type { UserRole } from "../types/user";

function asContentType(v: unknown): ContentType {
  const ct = typeof v === "string" ? v : "text";
  return (["text", "image", "gif"].includes(ct) ? ct : "text") as ContentType;
}

function parseReplyTo(raw: unknown): ReplyRef | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const id = o.id;
  if (typeof id !== "number") return undefined;
  const username = typeof o.username === "string" ? o.username : "…";
  const snippet =
    (typeof o.text_snippet === "string" && o.text_snippet) ||
    (typeof o.snippet === "string" && o.snippet) ||
    (typeof o.text === "string" && o.text) ||
    "";
  return { id, username, text: snippet };
}

function parseAuthorRole(raw: unknown): UserRole | undefined {
  if (raw === "admin" || raw === "moderator" || raw === "user") return raw;
  return undefined;
}

export function globalPayloadToLine(
  data: Record<string, unknown>,
  meId?: number
): ChatLine {
  const ct = asContentType(data.content_type ?? data.contentType);
  const uid = data.user_id as number | undefined;
  const editedAt =
    typeof data.edited_at === "string"
      ? data.edited_at
      : typeof data.updated_at === "string"
        ? data.updated_at
        : undefined;
  return {
    id: data.id as number,
    at: (data.created_at as string) || new Date().toISOString(),
    author: (data.username as string) ?? "",
    body: (data.text as string) ?? "",
    contentType: ct,
    senderId: uid,
    replyTo: parseReplyTo(data.reply_to),
    editedAt,
    isOwn: meId != null && uid === meId,
    authorRole: parseAuthorRole(data.author_role),
  };
}

/** REST shape for `/api/private/messages/:peerId` history */
export function privateApiToLine(
  m: {
    id: number;
    sender_id: number;
    recipient_id: number;
    content: string;
    message_type: ContentType;
    created_at: string;
    edited_at?: string;
    reply_to?: unknown;
    author_role?: unknown;
  },
  meId: number,
  peerUsername: string
): ChatLine {
  const line = privatePayloadToLine(
    {
      id: m.id,
      sender_id: m.sender_id,
      recipient_id: m.recipient_id,
      content: m.content,
      message_type: m.message_type,
      created_at: m.created_at,
      edited_at: m.edited_at,
      reply_to: m.reply_to,
      author_role: m.author_role,
      username: m.sender_id === meId ? "You" : peerUsername,
    },
    meId,
    peerUsername
  );
  if (m.sender_id === meId) {
    return { ...line, author: "You" };
  }
  return line;
}

export function privatePayloadToLine(
  data: Record<string, unknown>,
  meId?: number,
  fallbackAuthor?: string
): ChatLine {
  const ct = asContentType(data.message_type ?? data.content_type);
  const sid = data.sender_id as number | undefined;
  const rid = data.recipient_id as number | undefined;
  const author =
    (data.username as string | undefined) ??
    (sid != null ? `user#${sid}` : fallbackAuthor ?? "…");
  const editedAt =
    typeof data.edited_at === "string"
      ? data.edited_at
      : typeof data.updated_at === "string"
        ? data.updated_at
        : undefined;
  return {
    id: data.id as number,
    at: (data.created_at as string) || new Date().toISOString(),
    author,
    body: (data.content as string) ?? (data.text as string) ?? "",
    contentType: ct,
    senderId: sid,
    recipientId: rid,
    replyTo: parseReplyTo(data.reply_to),
    editedAt,
    isOwn: meId != null && sid === meId,
    authorRole: parseAuthorRole(data.author_role),
  };
}
