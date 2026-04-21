import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ChatHeader } from "../components/ChatHeader";
import { ConversationsModal } from "../components/ConversationsModal";
import { MessageInput } from "../components/MessageInput";
import { MessageThread } from "../components/MessageThread";
import { PinnedMessageBar } from "../components/PinnedMessageBar";
import { UserSidebar } from "../components/UserSidebar";
import { useChatSocket } from "../hooks/useChatSocket";
import {
  useReadMessageHistory,
  type ReadScope,
} from "../hooks/useReadMessageHistory";
import {
  api,
  banUser,
  CHAT_PAGE_SIZE,
  deleteMessage,
  fetchGlobalHistoryBefore,
  fetchGlobalMessageContext,
  fetchPrivateMessageContext,
  pinGlobalMessage,
  putMessage,
  setUserRole,
  searchGlobalMessages,
  searchPrivateMessages,
  unpinGlobalMessage,
  type BanDuration,
} from "../lib/api";
import { isRichTextEmpty } from "../lib/richText";
import { numericMessageId } from "../lib/messageId";
import { globalPayloadToLine, privateApiToLine } from "../lib/messageMap";
import { isAdmin, isModerator, isPublicRoomBanned } from "../lib/roles";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import type { ChatLine, SidebarUser } from "../types/chat";
import type { ReactionKind } from "../types/reactions";
import type { UserRole } from "../types/user";

type PrivateMsgApi = {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  message_type: "text" | "image" | "gif";
  caption?: string | null;
  is_read: boolean;
  created_at: string;
  edited_at?: string;
  reply_to?: unknown;
  author_role?: unknown;
};

type UserApiRow = {
  id: number;
  username: string;
  online: boolean;
  role?: UserRole;
};

export function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);

  const mode = useChatStore((s) => s.mode);
  const peerId = useChatStore((s) => s.peerId);
  const globalLines = useChatStore((s) => s.globalLines);
  const privateLines = useChatStore((s) => s.privateLines);
  const pinnedGlobalMessages = useChatStore((s) => s.pinnedGlobalMessages);
  const setMode = useChatStore((s) => s.setMode);
  const setPeer = useChatStore((s) => s.setPeer);
  const setPrivateLines = useChatStore((s) => s.setPrivateLines);
  const setGlobalLines = useChatStore((s) => s.setGlobalLines);
  const setPinnedGlobalMessages = useChatStore((s) => s.setPinnedGlobalMessages);
  const resetChat = useChatStore((s) => s.reset);
  const replaceLineById = useChatStore((s) => s.replaceLineById);
  const removeLineById = useChatStore((s) => s.removeLineById);
  const mergeGlobalLines = useChatStore((s) => s.mergeGlobalLines);
  const mergePrivateLines = useChatStore((s) => s.mergePrivateLines);
  const globalHistoryReady = useChatStore((s) => s.globalHistoryReady);

  const { sendActive, sendReactionToggle } = useChatSocket();

  const [users, setUsers] = useState<SidebarUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [convOpen, setConvOpen] = useState(false);
  const [usersOverlayOpen, setUsersOverlayOpen] = useState(false);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatLine | null>(null);
  const [editingLine, setEditingLine] = useState<ChatLine | null>(null);
  const [banTarget, setBanTarget] = useState<{ id: number; username: string } | null>(null);
  const [banDuration, setBanDuration] = useState<BanDuration>("1h");
  const [scrollToMessageId, setScrollToMessageId] = useState<string | number | null>(null);
  /** Incremented after login/register navigation so the thread scrolls to the latest message once history is present. */
  const [scrollToBottomNonce, setScrollToBottomNonce] = useState(0);
  /** Which pinned preview is shown (index in server order: newest message first); cycles after each jump-to-message. */
  const [pinnedPreviewIndex, setPinnedPreviewIndex] = useState(0);

  const [msgSearchOpen, setMsgSearchOpen] = useState(false);
  const [msgSearchDraft, setMsgSearchDraft] = useState("");
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [msgSearchHasRun, setMsgSearchHasRun] = useState(false);
  const [msgSearchMatchIds, setMsgSearchMatchIds] = useState<(string | number)[]>([]);
  const [msgSearchActiveIdx, setMsgSearchActiveIdx] = useState(0);
  const [msgSearchScrollToId, setMsgSearchScrollToId] = useState<string | number | null>(null);
  const [msgSearchLoading, setMsgSearchLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [globalHasMoreOlder, setGlobalHasMoreOlder] = useState(true);
  const [privateHasMoreOlder, setPrivateHasMoreOlder] = useState(false);

  const mod = isModerator(user);
  const admin = isAdmin(user);
  const globalBanned = isPublicRoomBanned(user);
  const permanentGlobalBan = user?.public_ban_permanent === true;

  useEffect(() => {
    if (!permanentGlobalBan) return;
    setGlobalLines([]);
    setPinnedGlobalMessages([]);
  }, [permanentGlobalBan, setGlobalLines, setPinnedGlobalMessages]);

  useEffect(() => {
    if (accessToken && !user) {
      fetchMe().catch(() => {
        logout();
        navigate("/login");
      });
    }
  }, [accessToken, user, fetchMe, logout, navigate]);

  useEffect(() => {
    const st = location.state as { scrollChatToBottom?: boolean } | null;
    if (!st?.scrollChatToBottom) return;
    setScrollToBottomNonce((n) => n + 1);
    navigate(location.pathname, { replace: true });
  }, [location, navigate]);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get<UserApiRow[]>("/api/users");
      setUsers(
        data.map((r) => ({
          id: r.id,
          username: r.username,
          online: r.online,
          role: r.role,
        }))
      );
    } catch {
      toast.error("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    const id = window.setInterval(loadUsers, 15_000);
    return () => window.clearInterval(id);
  }, [loadUsers]);

  const pinIdsKey = pinnedGlobalMessages.map((l) => l.id).join(",");
  useEffect(() => {
    setPinnedPreviewIndex(0);
  }, [pinIdsKey]);

  useEffect(() => {
    setMsgSearchOpen(false);
    setMsgSearchDraft("");
    setMsgSearchQuery("");
    setMsgSearchHasRun(false);
    setMsgSearchMatchIds([]);
    setMsgSearchActiveIdx(0);
    setMsgSearchScrollToId(null);
  }, [mode, peerId]);

  useEffect(() => {
    if (!globalHistoryReady || permanentGlobalBan || mode !== "global") return;
    setGlobalHasMoreOlder(
      useChatStore.getState().globalLines.length >= CHAT_PAGE_SIZE
    );
  }, [globalHistoryReady, mode, permanentGlobalBan]);

  const scope = (): "global" | { peerId: number } =>
    mode === "private" && peerId != null ? { peerId } : "global";

  const openPrivateChatById = useCallback(
    async (id: number, username: string) => {
      setMode("private");
      setPeer(id);
      setPeerName(username);
      setReplyTo(null);
      setEditingLine(null);
      if (!user) return;
      try {
        const { data } = await api.get<PrivateMsgApi[]>(
          `/api/private/messages/${id}`,
          { params: { limit: CHAT_PAGE_SIZE } }
        );
        const lines: ChatLine[] = data.map((m) =>
          privateApiToLine(m, user.id, username)
        );
        setPrivateLines(id, lines);
        setPrivateHasMoreOlder(data.length === CHAT_PAGE_SIZE);
      } catch {
        toast.error("Could not load message history");
      }
    },
    [setMode, setPeer, setPrivateLines, user]
  );

  const openPrivate = useCallback(
    (u: SidebarUser) => {
      void openPrivateChatById(u.id, u.username);
    },
    [openPrivateChatById]
  );

  const backGlobal = useCallback(() => {
    if (permanentGlobalBan) {
      toast.error("You no longer have access to global chat");
      return;
    }
    setMode("global");
    setPeer(null);
    setPeerName(null);
    setReplyTo(null);
    setEditingLine(null);
  }, [permanentGlobalBan, setMode, setPeer]);

  const onLogout = () => {
    resetChat();
    logout();
    navigate("/login");
  };

  const lines = useMemo(
    () =>
      permanentGlobalBan && mode === "global"
        ? []
        : mode === "private" && peerId != null
          ? privateLines[peerId] ?? []
          : globalLines,
    [permanentGlobalBan, mode, peerId, privateLines, globalLines]
  );

  const oldestLoadedLineId = lines.length > 0 ? lines[0]!.id : null;

  const readEnabled =
    Boolean(accessToken && user) &&
    !(permanentGlobalBan && mode === "global") &&
    !(mode === "private" && peerId == null);

  const hasMoreOlder =
    mode === "private" && peerId != null
      ? privateHasMoreOlder
      : mode === "global" && !permanentGlobalBan
        ? globalHasMoreOlder && globalHistoryReady
        : false;

  const read = useReadMessageHistory({
    mode,
    peerId,
    lines,
    currentUserId: user?.id,
    enabled: readEnabled,
    hasMoreOlder,
  });

  const lastSeenTailIdRef = useRef<string | number | null>(null);
  const onChatMessageAddedRef = useRef(read.onChatMessageAdded);
  onChatMessageAddedRef.current = read.onChatMessageAdded;

  useEffect(() => {
    lastSeenTailIdRef.current = null;
  }, [mode, peerId]);

  useEffect(() => {
    if (!read.loaded) return;
    const last = lines[lines.length - 1];
    if (!last) {
      lastSeenTailIdRef.current = null;
      return;
    }
    const prev = lastSeenTailIdRef.current;
    lastSeenTailIdRef.current = last.id;
    if (prev === null) return;
    if (prev !== last.id) {
      const scope: ReadScope =
        mode === "private" && peerId != null ? { peerId } : "global";
      onChatMessageAddedRef.current(last, scope);
    }
  }, [lines, read.loaded, mode, peerId]);

  /** Load a window around `messageId` so search jump / prev-next can scroll to it. */
  const ensureMessageInThreadForSearch = useCallback(
    async (messageId: string | number) => {
      const sid = String(messageId);
      if (mode === "private") {
        if (peerId == null || !user) return;
        const list = privateLines[peerId] ?? [];
        if (list.some((l) => String(l.id) === sid)) return;
        const data = await fetchPrivateMessageContext(peerId, messageId);
        const peerLabel = peerName ?? "…";
        const mapped: ChatLine[] = data.map((m) =>
          privateApiToLine(m as PrivateMsgApi, user.id, peerLabel)
        );
        mergePrivateLines(peerId, mapped);
        return;
      }
      if (permanentGlobalBan) return;
      if (globalLines.some((l) => String(l.id) === sid)) return;
      const data = await fetchGlobalMessageContext(messageId);
      const mapped: ChatLine[] = data.map((raw) =>
        globalPayloadToLine(raw as Record<string, unknown>, user?.id)
      );
      mergeGlobalLines(mapped);
    },
    [
      mode,
      peerId,
      user,
      peerName,
      privateLines,
      globalLines,
      permanentGlobalBan,
      mergePrivateLines,
      mergeGlobalLines,
    ]
  );

  const runMessageSearch = useCallback(async () => {
    setMsgSearchHasRun(true);
    const q = msgSearchDraft.trim();
    setMsgSearchQuery(q);
    if (!q) {
      setMsgSearchMatchIds([]);
      setMsgSearchActiveIdx(0);
      setMsgSearchScrollToId(null);
      setMsgSearchLoading(false);
      return;
    }
    if (mode === "global" && permanentGlobalBan) {
      setMsgSearchMatchIds([]);
      setMsgSearchActiveIdx(0);
      setMsgSearchScrollToId(null);
      return;
    }
    if (mode === "private" && peerId == null) {
      setMsgSearchMatchIds([]);
      setMsgSearchActiveIdx(0);
      setMsgSearchScrollToId(null);
      return;
    }
    setMsgSearchLoading(true);
    try {
      const ids =
        mode === "private" && peerId != null
          ? await searchPrivateMessages(peerId, q)
          : await searchGlobalMessages(q);
      setMsgSearchMatchIds(ids);
      setMsgSearchActiveIdx(0);
      if (ids.length > 0 && ids[0] != null) {
        await ensureMessageInThreadForSearch(ids[0]);
        setMsgSearchScrollToId(ids[0]);
      } else {
        setMsgSearchScrollToId(null);
      }
    } catch {
      setMsgSearchMatchIds([]);
      setMsgSearchActiveIdx(0);
      setMsgSearchScrollToId(null);
    } finally {
      setMsgSearchLoading(false);
    }
  }, [
    msgSearchDraft,
    mode,
    peerId,
    permanentGlobalBan,
    ensureMessageInThreadForSearch,
  ]);

  const closeMessageSearch = useCallback(() => {
    setMsgSearchOpen(false);
    setMsgSearchDraft("");
    setMsgSearchQuery("");
    setMsgSearchHasRun(false);
    setMsgSearchMatchIds([]);
    setMsgSearchActiveIdx(0);
    setMsgSearchScrollToId(null);
    setMsgSearchLoading(false);
  }, []);

  useEffect(() => {
    if (!msgSearchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMessageSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [msgSearchOpen, closeMessageSearch]);

  const msgSearchGoNext = useCallback(async () => {
    if (msgSearchMatchIds.length === 0 || msgSearchLoading) return;
    const next = (msgSearchActiveIdx + 1) % msgSearchMatchIds.length;
    const id = msgSearchMatchIds[next]!;
    setMsgSearchLoading(true);
    try {
      await ensureMessageInThreadForSearch(id);
      setMsgSearchActiveIdx(next);
      setMsgSearchScrollToId(id);
    } catch {
      /* toast from api */
    } finally {
      setMsgSearchLoading(false);
    }
  }, [
    msgSearchMatchIds,
    msgSearchActiveIdx,
    msgSearchLoading,
    ensureMessageInThreadForSearch,
  ]);

  const msgSearchGoPrev = useCallback(async () => {
    if (msgSearchMatchIds.length === 0 || msgSearchLoading) return;
    const prev =
      (msgSearchActiveIdx - 1 + msgSearchMatchIds.length) %
      msgSearchMatchIds.length;
    const id = msgSearchMatchIds[prev]!;
    setMsgSearchLoading(true);
    try {
      await ensureMessageInThreadForSearch(id);
      setMsgSearchActiveIdx(prev);
      setMsgSearchScrollToId(id);
    } catch {
      /* toast from api */
    } finally {
      setMsgSearchLoading(false);
    }
  }, [
    msgSearchMatchIds,
    msgSearchActiveIdx,
    msgSearchLoading,
    ensureMessageInThreadForSearch,
  ]);

  const msgSearchActiveId =
    msgSearchOpen &&
    msgSearchHasRun &&
    msgSearchMatchIds.length > 0 &&
    msgSearchMatchIds[msgSearchActiveIdx] != null
      ? msgSearchMatchIds[msgSearchActiveIdx]!
      : null;

  const msgSearchHighlightQuery =
    msgSearchOpen && msgSearchHasRun && msgSearchQuery.trim()
      ? msgSearchQuery
      : null;

  const title =
    mode === "private" && peerName ? `Private — ${peerName}` : "Global chat";

  const messageScope = (): "global" | "private" =>
    mode === "private" && peerId != null ? "private" : "global";

  const pinnedMessageIds = useMemo(
    () => pinnedGlobalMessages.map((l) => l.id),
    [pinnedGlobalMessages]
  );

  const handleDeleteLine = useCallback(
    async (line: ChatLine) => {
      const sc =
        mode === "private" && peerId != null ? { peerId } : "global";
      await deleteMessage(
        line.id,
        mode === "private" && peerId != null ? "private" : "global"
      );
      removeLineById(line.id, sc);
    },
    [mode, peerId, removeLineById]
  );

  const handleModDelete = useCallback(
    async (line: ChatLine) => {
      if (mode !== "global") return;
      await deleteMessage(line.id, "global");
      removeLineById(line.id, "global");
    },
    [mode, removeLineById]
  );

  const handlePin = useCallback(async (line: ChatLine) => {
    await pinGlobalMessage(line.id);
  }, []);

  const onReplyLine = useCallback((line: ChatLine) => {
    setEditingLine(null);
    setReplyTo(line);
  }, []);

  const onEditOwnLine = useCallback((line: ChatLine) => {
    setReplyTo(null);
    setEditingLine(line);
  }, []);

  const onBanFromMessage = useCallback((userId: number, username: string) => {
    setBanTarget({ id: userId, username });
  }, []);

  const onReactionToggleLine = useCallback(
    (messageId: string | number, kind: ReactionKind) => {
      if (!accessToken) return;
      const id = typeof messageId === "number" ? messageId : Number(messageId);
      if (!Number.isFinite(id)) return;
      sendReactionToggle(id, kind);
    },
    [accessToken, sendReactionToggle]
  );

  const onOpenPrivateChatFromThread = useCallback(
    (userId: number, username: string) => {
      void openPrivateChatById(userId, username);
    },
    [openPrivateChatById]
  );

  const onSelectSidebarUser = useCallback(
    (u: SidebarUser) => {
      void openPrivate(u);
      setUsersOverlayOpen(false);
    },
    [openPrivate]
  );

  useEffect(() => {
    if (!usersOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUsersOverlayOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [usersOverlayOpen]);

  useEffect(() => {
    if (!usersOverlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [usersOverlayOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setUsersOverlayOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const onBanUserFromSidebar = useCallback((u: SidebarUser) => {
    setBanTarget({ id: u.id, username: u.username });
  }, []);

  const handleSubmitEdit = async (messageId: string | number, text: string) => {
    const sc = scope();
    const list =
      sc === "global" ? globalLines : privateLines[sc.peerId] ?? [];
    const prev = list.find((l) => String(l.id) === String(messageId));
    if (!prev) return;
    const scopeArg = messageScope();
    if (prev.contentType === "text") {
      await putMessage(
        messageId,
        { text, content_type: "text" },
        scopeArg
      );
      replaceLineById(messageId, sc, {
        ...prev,
        body: text,
        editedAt: new Date().toISOString(),
      });
      return;
    }
    const captionVal = isRichTextEmpty(text) ? null : text;
    await putMessage(
      messageId,
      {
        text: prev.body,
        content_type: prev.contentType,
        caption: captionVal,
      },
      scopeArg
    );
    replaceLineById(messageId, sc, {
      ...prev,
      caption: captionVal ?? undefined,
      editedAt: new Date().toISOString(),
    });
  };

  const activePinnedLine = pinnedGlobalMessages[pinnedPreviewIndex] ?? null;

  const handleUnpin = async () => {
    if (!activePinnedLine) return;
    await unpinGlobalMessage(activePinnedLine.id);
  };

  const clearScrollToMessage = useCallback(() => {
    setScrollToMessageId(null);
    setPinnedPreviewIndex((i) => {
      const n = pinnedGlobalMessages.length;
      if (n <= 1) return 0;
      return (i + 1) % n;
    });
  }, [pinnedGlobalMessages.length]);

  const goToPinnedMessage = useCallback(
    async (messageId: string | number) => {
      if (mode !== "global") return;
      const inList = globalLines.some((l) => String(l.id) === String(messageId));
      if (!inList) {
        try {
          const data = await fetchGlobalMessageContext(messageId);
          const mapped: ChatLine[] = data.map((raw) =>
            globalPayloadToLine(raw as Record<string, unknown>, user?.id)
          );
          mergeGlobalLines(mapped);
        } catch {
          return;
        }
      }
      setScrollToMessageId(messageId);
    },
    [mode, globalLines, user?.id, mergeGlobalLines]
  );

  const onJumpToPinnedMessage = useCallback(
    (id: string | number) => {
      void goToPinnedMessage(id);
    },
    [goToPinnedMessage]
  );

  const confirmBan = async () => {
    if (!banTarget) return;
    try {
      await banUser(banTarget.id, banDuration);
      toast.success(`Banned ${banTarget.username}`);
      setBanTarget(null);
    } catch {
      /* toast in api */
    }
  };

  const onSetRole = async (userId: number, role: Exclude<UserRole, "admin">) => {
    try {
      await setUserRole(userId, role);
      toast.success("Role updated");
      await loadUsers();
    } catch {
      /* toast in api */
    }
  };

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder) return;
    const currentLines =
      permanentGlobalBan && mode === "global"
        ? []
        : mode === "private" && peerId != null
          ? privateLines[peerId] ?? []
          : globalLines;
    if (currentLines.length === 0) return;
    const oldestId = currentLines[0].id;

    if (mode === "private") {
      if (peerId == null || !user) return;
      setLoadingOlder(true);
      try {
        const { data } = await api.get<PrivateMsgApi[]>(
          `/api/private/messages/${peerId}`,
          { params: { limit: CHAT_PAGE_SIZE, before_id: oldestId } }
        );
        const peerLabel = peerName ?? "…";
        const batch: ChatLine[] = data.map((m) =>
          privateApiToLine(m, user.id, peerLabel)
        );
        mergePrivateLines(peerId, batch);
        setPrivateHasMoreOlder(data.length === CHAT_PAGE_SIZE);
      } catch {
        toast.error("Could not load older messages");
      } finally {
        setLoadingOlder(false);
      }
      return;
    }

    if (mode === "global" && !permanentGlobalBan) {
      setLoadingOlder(true);
      try {
        const raw = await fetchGlobalHistoryBefore(oldestId, CHAT_PAGE_SIZE);
        const batch: ChatLine[] = raw.map((row) =>
          globalPayloadToLine(row as Record<string, unknown>, user?.id)
        );
        mergeGlobalLines(batch);
        setGlobalHasMoreOlder(batch.length === CHAT_PAGE_SIZE);
      } catch {
        /* toast in fetchGlobalHistoryBefore */
      } finally {
        setLoadingOlder(false);
      }
    }
  }, [
    loadingOlder,
    permanentGlobalBan,
    mode,
    peerId,
    peerName,
    privateLines,
    globalLines,
    user,
    mergePrivateLines,
    mergeGlobalLines,
  ]);

  const loadOlderMessagesRef = useRef(loadOlderMessages);
  loadOlderMessagesRef.current = loadOlderMessages;
  const globalHasMoreRef = useRef(globalHasMoreOlder);
  globalHasMoreRef.current = globalHasMoreOlder;
  const privateHasMoreRef = useRef(privateHasMoreOlder);
  privateHasMoreRef.current = privateHasMoreOlder;

  /** Bridge WS tail + read cursor when the oldest loaded id is still newer than `last_read+1`. */
  useEffect(() => {
    if (!read.loaded || read.lastReadMessageId == null) return;
    if (oldestLoadedLineId == null) return;
    const lr = read.lastReadMessageId;
    const oldest = numericMessageId(oldestLoadedLineId);
    if (!Number.isFinite(oldest) || !Number.isFinite(lr)) return;
    if (oldest <= lr + 1) return;
    if (!hasMoreOlder) return;

    let cancelled = false;

    const run = async () => {
      if (mode === "global" && permanentGlobalBan) return;
      if (mode === "private" && (peerId == null || !user)) return;

      if (mode === "global") {
        try {
          const { data } = await api.get<unknown[]>("/api/messages/global/context", {
            params: { message_id: lr, before: 3, after: 500 },
          });
          if (cancelled) return;
          const mapped = data.map((raw) =>
            globalPayloadToLine(raw as Record<string, unknown>, user?.id)
          );
          mergeGlobalLines(mapped);
        } catch (e) {
          if (cancelled) return;
          if (!axios.isAxiosError(e) || e.response?.status !== 404) {
            return;
          }
        }
        for (let i = 0; i < 60; i++) {
          if (cancelled) return;
          const gl = useChatStore.getState().globalLines;
          if (gl.length === 0) return;
          const o = numericMessageId(gl[0]!.id);
          if (!Number.isFinite(o) || o <= lr + 1) return;
          if (!globalHasMoreRef.current) return;
          await loadOlderMessagesRef.current();
        }
        return;
      }

      if (mode === "private" && peerId != null && user) {
        try {
          const { data } = await api.get<unknown[]>(
            `/api/private/messages/${peerId}/context`,
            { params: { message_id: lr, before: 3, after: 500 } }
          );
          if (cancelled) return;
          const peerLabel = peerName ?? "…";
          const mapped: ChatLine[] = data.map((m) =>
            privateApiToLine(m as PrivateMsgApi, user.id, peerLabel)
          );
          mergePrivateLines(peerId, mapped);
        } catch (e) {
          if (cancelled) return;
          if (!axios.isAxiosError(e) || e.response?.status !== 404) {
            return;
          }
        }
        for (let j = 0; j < 60; j++) {
          if (cancelled) return;
          const pl = useChatStore.getState().privateLines[peerId] ?? [];
          if (pl.length === 0) return;
          const o = numericMessageId(pl[0]!.id);
          if (!Number.isFinite(o) || o <= lr + 1) return;
          if (!privateHasMoreRef.current) return;
          await loadOlderMessagesRef.current();
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    read.loaded,
    read.lastReadMessageId,
    oldestLoadedLineId,
    hasMoreOlder,
    mode,
    peerId,
    permanentGlobalBan,
    user,
    peerName,
    mergeGlobalLines,
    mergePrivateLines,
  ]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <ChatHeader
        title={title}
        subtitle={
          mode === "private"
            ? "Messages are end-to-end stored on the server"
            : permanentGlobalBan
              ? "Global chat is not available for your account"
              : "Everyone sees this room"
        }
        username={user?.username ?? "…"}
        userRole={user?.role}
        onLogout={onLogout}
        onOpenConversations={() => setConvOpen(true)}
        onOpenUsers={() => setUsersOverlayOpen(true)}
        showBack={mode === "private"}
        onBackGlobal={backGlobal}
        messageSearch={{
          open: msgSearchOpen,
          draft: msgSearchDraft,
          onDraftChange: setMsgSearchDraft,
          onOpen: () => setMsgSearchOpen(true),
          onClose: closeMessageSearch,
          onSubmit: () => void runMessageSearch(),
          hasRun: msgSearchHasRun,
          loading: msgSearchLoading,
          matchCount: msgSearchMatchIds.length,
          activeIndex: msgSearchActiveIdx,
          onPrev: () => void msgSearchGoPrev(),
          onNext: () => void msgSearchGoNext(),
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3 md:flex-row">
        <div className="hidden h-full min-h-0 w-full max-h-full shrink-0 overflow-hidden md:flex md:h-full md:max-h-full md:w-72 md:flex-col">
          <UserSidebar
            users={users}
            selectedId={mode === "private" ? peerId : null}
            onSelect={onSelectSidebarUser}
            loading={usersLoading}
            currentUserId={user?.id}
            isAdmin={admin}
            isModerator={mod}
            onBanUser={onBanUserFromSidebar}
            onSetRole={admin ? onSetRole : undefined}
          />
        </div>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {mode === "global" &&
            !permanentGlobalBan &&
            activePinnedLine &&
            pinnedGlobalMessages.length > 0 && (
            <PinnedMessageBar
              line={activePinnedLine}
              previewIndex={pinnedPreviewIndex + 1}
              totalPinned={pinnedGlobalMessages.length}
              canUnpin={mod}
              onUnpin={() => void handleUnpin()}
              onJumpToMessage={() => void goToPinnedMessage(activePinnedLine.id)}
            />
          )}
          <MessageThread
            key={`mt-${mode}-${peerId ?? "g"}`}
            lines={lines}
            readControl={
              readEnabled
                ? {
                    loaded: read.loaded,
                    anchorMessageId: read.initialScrollMessageId,
                  }
                : undefined
            }
            readTrackEnabled={readEnabled && read.loaded}
            onReadVisibleMessage={read.onVisibleReadCandidate}
            unreadDividerBeforeIndex={read.unreadDividerBeforeIndex}
            jumpToLatestUnreadCount={read.unreadCount}
            jumpToLatestUnreadAtLeast={read.unreadBadgeAtLeast}
            onJumpToNewestMarkRead={read.onJumpToNewest}
            onThreadLeftBottom={read.onLeftBottom}
            hasMoreOlder={hasMoreOlder}
            loadingOlder={loadingOlder}
            onLoadOlder={accessToken ? loadOlderMessages : undefined}
            scrollToBottomNonce={scrollToBottomNonce}
            searchScrollToMessageId={msgSearchScrollToId}
            searchActiveMessageId={msgSearchActiveId}
            searchHighlightQuery={msgSearchHighlightQuery}
            emptyHint={
              mode === "private"
                ? "No messages yet — say hi!"
                : permanentGlobalBan
                  ? "You no longer have access to global chat. Use private messages from the conversations menu."
                  : "No messages yet. Be the first!"
            }
            mode={mode}
            currentUserId={user?.id}
            globalRoomBanned={globalBanned}
            isModerator={mod}
            isAdmin={admin}
            pinnedMessageIds={pinnedMessageIds}
            scrollToMessageId={mode === "global" ? scrollToMessageId : null}
            onScrollToMessageDone={clearScrollToMessage}
            onJumpToMessage={
              mode === "global" ? onJumpToPinnedMessage : undefined
            }
            onReply={onReplyLine}
            onEditOwn={onEditOwnLine}
            onDeleteOwn={handleDeleteLine}
            onModDelete={handleModDelete}
            onPin={mode === "global" && mod ? handlePin : undefined}
            onBanFromMessage={onBanFromMessage}
            onReactionToggle={accessToken ? onReactionToggleLine : undefined}
            onOpenPrivateChat={
              mode === "global" && accessToken
                ? onOpenPrivateChatFromThread
                : undefined
            }
          />
          <MessageInput
            key={
              editingLine
                ? `edit-${editingLine.id}-${editingLine.contentType}`
                : `compose-${mode}-${peerId ?? "g"}`
            }
            disabled={!accessToken || (mode === "global" && globalBanned)}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            editingLine={editingLine}
            onCancelEdit={() => setEditingLine(null)}
            onSubmitEdit={handleSubmitEdit}
            onSendText={(text, contentType, replyToId, caption) => {
              try {
                sendActive(text, contentType, replyToId, caption);
                setReplyTo(null);
                setScrollToBottomNonce((n) => n + 1);
              } catch {
                toast.error("Send failed");
              }
            }}
          />
        </section>
      </div>

      <ConversationsModal
        open={convOpen}
        onClose={() => setConvOpen(false)}
        onOpenChat={(id, username) => void openPrivateChatById(id, username)}
      />

      {usersOverlayOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-slate-950 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-users-overlay-title"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-3 py-3">
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 active:bg-slate-800"
              onClick={() => setUsersOverlayOpen(false)}
            >
              ← Global
            </button>
            <span id="mobile-users-overlay-title" className="sr-only">
              People in chat
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-1 pb-3 pt-2">
            <UserSidebar
              layout="fullscreen"
              users={users}
              selectedId={mode === "private" ? peerId : null}
              onSelect={onSelectSidebarUser}
              loading={usersLoading}
              currentUserId={user?.id}
              isAdmin={admin}
              isModerator={mod}
              onBanUser={onBanUserFromSidebar}
              onSetRole={admin ? onSetRole : undefined}
            />
          </div>
        </div>
      )}

      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-labelledby="ban-title"
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
          >
            <h3 id="ban-title" className="text-lg font-semibold text-white">
              Ban {banTarget.username}
            </h3>
            <p className="mt-2 text-sm text-slate-400">Duration</p>
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={banDuration}
              onChange={(e) => setBanDuration(e.target.value as BanDuration)}
            >
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="forever">Forever</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                onClick={() => setBanTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
                onClick={() => void confirmBan()}
              >
                Ban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
