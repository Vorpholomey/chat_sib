import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { wsChatUrl } from "../lib/config";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import type { ChatLine, ContentType } from "../types/chat";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseIncoming(data: unknown): ChatLine | "skip" | { error: string } {
  if (!isRecord(data)) return "skip";
  if (typeof data.error === "string") {
    return { error: data.error };
  }
  // Global message
  if (typeof data.user_id === "number" && typeof data.username === "string") {
    const ct = (data.content_type as string) || "text";
    const contentType = (["text", "image", "gif"].includes(ct) ? ct : "text") as ContentType;
    return {
      id: data.id as number,
      at: (data.created_at as string) || new Date().toISOString(),
      author: data.username as string,
      body: (data.text as string) ?? "",
      contentType,
      senderId: data.user_id as number,
    };
  }
  // Private message
  if (
    typeof data.sender_id === "number" &&
    typeof data.recipient_id === "number" &&
    typeof data.content === "string"
  ) {
    const ct = (data.message_type as string) || "text";
    const contentType = (["text", "image", "gif"].includes(ct) ? ct : "text") as ContentType;
    const author =
      (data.username as string | undefined) || `user#${data.sender_id}`;
    return {
      id: data.id as number,
      at: (data.created_at as string) || new Date().toISOString(),
      author,
      body: data.content,
      contentType,
      senderId: data.sender_id,
      recipientId: data.recipient_id,
    };
  }
  return "skip";
}

export function useChatSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const addLine = useChatStore((s) => s.addLine);

  const clearTimer = () => {
    if (reconnectTimer.current != null) {
      window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!token) return;
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
        const parsed = parseIncoming(raw);
        if (parsed === "skip") return;
        if ("error" in parsed) {
          toast.error(parsed.error);
          return;
        }
        const line = parsed;
        // Route private messages to the correct thread (both participants)
        if (line.senderId != null && line.recipientId != null) {
          const me = useAuthStore.getState().user?.id;
          if (!me) return;
          const other =
            line.senderId === me ? line.recipientId : line.senderId;
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
      if (!token) return;
      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;
      const delay = Math.min(1000 * 2 ** Math.min(attempt, 5), 30_000);
      reconnectTimer.current = window.setTimeout(() => connect(), delay);
    };

    ws.onerror = () => {
      /* onclose will reconnect */
    };
  }, [token, addLine]);

  useEffect(() => {
    if (!token) {
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
    (text: string, contentType: ContentType) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        toast.error("Not connected. Retrying…");
        return;
      }
      ws.send(JSON.stringify({ text, content_type: contentType }));
    },
    []
  );

  const sendPrivate = useCallback(
    (recipientId: number, text: string, contentType: ContentType) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        toast.error("Not connected. Retrying…");
        return;
      }
      ws.send(
        JSON.stringify({
          text,
          content_type: contentType,
          recipient_id: recipientId,
        })
      );
    },
    []
  );

  const sendActive = useCallback(
    (text: string, contentType: ContentType) => {
      const mode = useChatStore.getState().mode;
      const p = useChatStore.getState().peerId;
      if (mode === "private" && p != null) {
        sendPrivate(p, text, contentType);
      } else {
        sendGlobal(text, contentType);
      }
    },
    [sendGlobal, sendPrivate]
  );

  return { sendActive, sendGlobal, sendPrivate, wsRef };
}
