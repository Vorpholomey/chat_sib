import { api } from "./api";
import type { ChatMode } from "../types/chat";

/** Backend `chat_id`: literal `global` or decimal string of the DM peer user id. */
export function encodeChatReadId(mode: ChatMode, peerId: number | null): string | null {
  if (mode === "global") return "global";
  if (mode === "private" && peerId != null) return String(peerId);
  return null;
}

export type ChatReadStatusResponse = {
  last_read_message_id: number | null;
  updated_at: string | null;
};

export async function getChatReadStatus(chatId: string): Promise<ChatReadStatusResponse> {
  const { data } = await api.get<ChatReadStatusResponse>(
    `/api/chats/${encodeURIComponent(chatId)}/read-status`
  );
  return data;
}

export async function postChatReadStatus(
  chatId: string,
  last_read_message_id: number
): Promise<ChatReadStatusResponse> {
  const { data } = await api.post<ChatReadStatusResponse>(
    `/api/chats/${encodeURIComponent(chatId)}/read-status`,
    { last_read_message_id }
  );
  return data;
}

export async function postChatMarkAllRead(chatId: string): Promise<ChatReadStatusResponse> {
  const { data } = await api.post<ChatReadStatusResponse>(
    `/api/chats/${encodeURIComponent(chatId)}/mark-all-read`
  );
  return data;
}

// --- Legacy-shaped wrappers (call sites can migrate to chat helpers above) ---

export type ReadStateResponse = {
  last_read_message_id: number | null;
};

export async function getReadState(
  params: { scope: "global" } | { scope: "private"; peerId: number }
): Promise<ReadStateResponse> {
  const chatId =
    params.scope === "global" ? "global" : String(params.peerId);
  return getChatReadStatus(chatId);
}

export type PatchReadStateInput =
  | { scope: "global"; last_read_message_id: number }
  | { scope: "private"; peer_id: number; last_read_message_id: number };

/** @deprecated Use {@link postChatReadStatus}; name kept for minimal churn. */
export async function patchReadState(body: PatchReadStateInput): Promise<ReadStateResponse> {
  const chatId = body.scope === "global" ? "global" : String(body.peer_id);
  return postChatReadStatus(chatId, body.last_read_message_id);
}
