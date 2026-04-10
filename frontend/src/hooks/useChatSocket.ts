import { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { ACCOUNT_PERMANENTLY_BANNED } from "../lib/authErrors";
import { wsChatUrl } from "../lib/config";
import { globalPayloadToLine, privatePayloadToLine } from "../lib/messageMap";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import type { ChatLine, ContentType } from "../types/chat";
import { normalizeReactions } from "../types/reactions";
import type { ReactionKind } from "../types/reactions";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseIncoming(
  data: unknown,
  meId: number | undefined
):
  | ChatLine
  | "skip"
  | { error: string }
  | { kind: "updated"; line: ChatLine; scope: "global" | { peerId: number } }
  | { kind: "deleted"; id: number; scope: "global" | { peerId: number } }
  | { kind: "pin"; lines: ChatLine[] }
  | {
      kind: "reactions_updated";
      messageId: number;
      scope: "global" | { peerId: number };
      reactions: ReturnType<typeof normalizeReactions>;
    } {
  if (!isRecord(data)) return "skip";
  if (typeof data.error === "string") {
    return { error: data.error };
  }

  const t = data.type as string | undefined;

  if (t === "message_updated") {
    const raw = (data.message ?? data.payload ?? data) as Record<string, unknown>;
    if (typeof raw.user_id === "number" && typeof raw.username === "string") {
      return {
        kind: "updated",
        line: globalPayloadToLine(raw, meId),
        scope: "global",
      };
    }
    if (
      typeof raw.sender_id === "number" &&
      typeof raw.recipient_id === "number"
    ) {
      const other =
        meId != null
          ? raw.sender_id === meId
            ? (raw.recipient_id as number)
            : (raw.sender_id as number)
          : (raw.recipient_id as number);
      return {
        kind: "updated",
        line: privatePayloadToLine(raw, meId),
        scope: { peerId: other },
      };
    }
    return "skip";
  }

  if (t === "message_deleted") {
    const id = (data.id ?? data.message_id) as number | undefined;
    if (typeof id !== "number") return "skip";
    const scopeRaw = data.scope as string | undefined;
    if (scopeRaw === "private" || data.recipient_id != null || data.sender_id != null) {
      const sid = data.sender_id as number | undefined;
      const rid = data.recipient_id as number | undefined;
      if (sid != null && rid != null && meId != null) {
        const other = sid === meId ? rid : sid;
        return { kind: "deleted", id, scope: { peerId: other } };
      }
      if (typeof data.peer_id === "number") {
        return { kind: "deleted", id, scope: { peerId: data.peer_id } };
      }
    }
    return { kind: "deleted", id, scope: "global" };
  }

  if (t === "pin_changed") {
    const rawList = data.pinned_messages;
    if (Array.isArray(rawList)) {
      const lines: ChatLine[] = [];
      for (const item of rawList) {
        if (isRecord(item) && typeof item.user_id === "number") {
          lines.push(globalPayloadToLine(item, meId));
        }
      }
      return { kind: "pin", lines };
    }
    const pinned = data.pinned_message ?? data.message ?? null;
    if (pinned == null || pinned === false) {
      return { kind: "pin", lines: [] };
    }
    if (isRecord(pinned) && typeof pinned.user_id === "number") {
      return { kind: "pin", lines: [globalPayloadToLine(pinned, meId)] };
    }
    return { kind: "pin", lines: [] };
  }

  if (t === "reactions_updated") {
    const messageId = data.message_id;
    const scopeRaw = data.scope as string | undefined;
    if (typeof messageId !== "number") return "skip";
    const reactions = normalizeReactions(
      isRecord(data.reactions) ? (data.reactions as Record<string, number[]>) : undefined
    );
    if (scopeRaw === "private") {
      const sid = data.sender_id;
      const rid = data.recipient_id;
      if (typeof sid !== "number" || typeof rid !== "number" || meId == null) {
        return "skip";
      }
      const peerId = meId === sid ? rid : sid;
      return {
        kind: "reactions_updated",
        messageId,
        scope: { peerId },
        reactions,
      };
    }
    return { kind: "reactions_updated", messageId, scope: "global", reactions };
  }

  // New global message (legacy or explicit type)
  if (
    t === undefined ||
    t === "message" ||
    t === "global_message" ||
    t === "chat_message"
  ) {
    if (typeof data.user_id === "number" && typeof data.username === "string") {
      return globalPayloadToLine(data, meId);
    }
  }

  // Private message
  if (
    typeof data.sender_id === "number" &&
    typeof data.recipient_id === "number" &&
    typeof data.content === "string"
  ) {
    return privatePayloadToLine(data, meId);
  }

  // Untyped global (original heuristic)
  if (typeof data.user_id === "number" && typeof data.username === "string") {
    return globalPayloadToLine(data, meId);
  }

  return "skip";
}

export function useChatSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const connectRef = useRef<() => void>(() => {});
  const { addLine, replaceLineById, removeLineById, setPinnedGlobalMessages, updateLineById } =
    useChatStore(
      useShallow((s) => ({
        addLine: s.addLine,
        replaceLineById: s.replaceLineById,
        removeLineById: s.removeLineById,
        setPinnedGlobalMessages: s.setPinnedGlobalMessages,
        updateLineById: s.updateLineById,
      }))
    );

  const clearTimer = () => {
    if (reconnectTimer.current != null) {
      window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!token) return;
    useChatStore.getState().setGlobalHistoryReady(false);
    clearTimer();
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    const ws = new WebSocket(wsChatUrl(token));
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data as string);
        if (isRecord(raw) && raw.type === "global_history_ready") {
          useChatStore.getState().setGlobalHistoryReady(true);
          return;
        }
        const me = useAuthStore.getState().user?.id;
        const parsed = parseIncoming(raw, me);
        if (parsed === "skip") return;
        if ("error" in parsed) {
          toast.error(parsed.error);
          return;
        }
        if ("kind" in parsed) {
          if (parsed.kind === "updated") {
            const list =
              parsed.scope === "global"
                ? useChatStore.getState().globalLines
                : useChatStore.getState().privateLines[parsed.scope.peerId] ?? [];
            const exists = list.some((l) => String(l.id) === String(parsed.line.id));
            if (exists) {
              replaceLineById(parsed.line.id, parsed.scope, parsed.line);
            } else {
              addLine(parsed.line, parsed.scope);
            }
            return;
          }
          if (parsed.kind === "deleted") {
            removeLineById(parsed.id, parsed.scope);
            return;
          }
          if (parsed.kind === "pin") {
            setPinnedGlobalMessages(parsed.lines);
            return;
          }
          if (parsed.kind === "reactions_updated") {
            updateLineById(parsed.messageId, parsed.scope, (l) => ({
              ...l,
              reactions: parsed.reactions,
            }));
            return;
          }
        }

        const line = parsed as ChatLine;
        if (line.senderId != null && line.recipientId != null) {
          const meNow = useAuthStore.getState().user?.id;
          if (!meNow) return;
          const other =
            line.senderId === meNow ? line.recipientId : line.senderId;
          const prev = useChatStore.getState().privateLines[other] ?? [];
          if (prev.some((l) => l.id === line.id)) return;
          addLine(line, { peerId: other });
        } else {
          if (useChatStore.getState().globalLines.some((l) => l.id === line.id))
            return;
          addLine(line, "global");
        }
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = (ev) => {
      if (ev.code === 4001) {
        toast.error("WebSocket: invalid token");
        return;
      }
      if (ev.code === 4003) {
        toast.error(ACCOUNT_PERMANENTLY_BANNED);
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return;
      }
      if (!token) return;
      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;
      const delay = Math.min(1000 * 2 ** Math.min(attempt, 5), 30_000);
      reconnectTimer.current = window.setTimeout(() => connectRef.current(), delay);
    };

    ws.onerror = () => {
      /* onclose will reconnect */
    };
  }, [token, addLine, replaceLineById, removeLineById, setPinnedGlobalMessages, updateLineById]);

  useLayoutEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!token) {
      useChatStore.getState().setGlobalHistoryReady(false);
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
      return;
    }
    connect();
    return () => {
      clearTimer();
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [token, connect]);

  const sendGlobal = useCallback(
    (text: string, contentType: ContentType, replyToId?: number | null) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        toast.error("Not connected. Retrying…");
        return;
      }
      const payload: Record<string, unknown> = {
        text,
        content_type: contentType,
      };
      if (replyToId != null) {
        payload.reply_to_id = replyToId;
      }
      ws.send(JSON.stringify(payload));
    },
    []
  );

  const sendPrivate = useCallback(
    (recipientId: number, text: string, contentType: ContentType, replyToId?: number | null) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        toast.error("Not connected. Retrying…");
        return;
      }
      const payload: Record<string, unknown> = {
        text,
        content_type: contentType,
        recipient_id: recipientId,
      };
      if (replyToId != null) {
        payload.reply_to_id = replyToId;
      }
      ws.send(JSON.stringify(payload));
    },
    []
  );

  const sendActive = useCallback(
    (text: string, contentType: ContentType, replyToId?: number | null) => {
      const mode = useChatStore.getState().mode;
      const p = useChatStore.getState().peerId;
      if (mode === "private" && p != null) {
        sendPrivate(p, text, contentType, replyToId);
      } else {
        sendGlobal(text, contentType, replyToId);
      }
    },
    [sendGlobal, sendPrivate]
  );

  const sendReactionToggle = useCallback((messageId: number, kind: ReactionKind) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error("Not connected. Retrying…");
      return;
    }
    const mode = useChatStore.getState().mode;
    const peerId = useChatStore.getState().peerId;
    const payload: Record<string, unknown> = {
      type: "reaction_toggle",
      message_id: messageId,
      reaction_kind: kind,
      scope: mode === "private" ? "private" : "global",
    };
    if (mode === "private" && peerId != null) {
      payload.peer_id = peerId;
    }
    ws.send(JSON.stringify(payload));
  }, []);

  return useMemo(
    () => ({ sendActive, sendGlobal, sendPrivate, sendReactionToggle, wsRef }),
    [sendActive, sendGlobal, sendPrivate, sendReactionToggle]
  );
}
