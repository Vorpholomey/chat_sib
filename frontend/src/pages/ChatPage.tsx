import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChatHeader } from "../components/ChatHeader";
import { ConversationsModal } from "../components/ConversationsModal";
import { MessageInput } from "../components/MessageInput";
import { MessageThread } from "../components/MessageThread";
import { PinnedMessageBar } from "../components/PinnedMessageBar";
import { UserSidebar } from "../components/UserSidebar";
import { useChatSocket } from "../hooks/useChatSocket";
import {
  api,
  banUser,
  deleteMessage,
  pinGlobalMessage,
  putMessage,
  setUserRole,
  unpinGlobalMessage,
  type BanDuration,
} from "../lib/api";
import { privateApiToLine } from "../lib/messageMap";
import { isAdmin, isModerator, isPublicRoomBanned } from "../lib/roles";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import type { ChatLine, SidebarUser } from "../types/chat";
import type { UserRole } from "../types/user";

type PrivateMsgApi = {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  message_type: "text" | "image" | "gif";
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
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);

  const mode = useChatStore((s) => s.mode);
  const peerId = useChatStore((s) => s.peerId);
  const globalLines = useChatStore((s) => s.globalLines);
  const privateLines = useChatStore((s) => s.privateLines);
  const pinnedGlobalMessage = useChatStore((s) => s.pinnedGlobalMessage);
  const setMode = useChatStore((s) => s.setMode);
  const setPeer = useChatStore((s) => s.setPeer);
  const setPrivateLines = useChatStore((s) => s.setPrivateLines);
  const resetChat = useChatStore((s) => s.reset);
  const replaceLineById = useChatStore((s) => s.replaceLineById);
  const removeLineById = useChatStore((s) => s.removeLineById);
  const setPinnedGlobalMessage = useChatStore((s) => s.setPinnedGlobalMessage);

  const { sendActive } = useChatSocket();

  const [users, setUsers] = useState<SidebarUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [convOpen, setConvOpen] = useState(false);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatLine | null>(null);
  const [editingLine, setEditingLine] = useState<ChatLine | null>(null);
  const [banTarget, setBanTarget] = useState<{ id: number; username: string } | null>(null);
  const [banDuration, setBanDuration] = useState<BanDuration>("1h");

  const mod = isModerator(user);
  const admin = isAdmin(user);
  const globalBanned = isPublicRoomBanned(user);

  useEffect(() => {
    if (accessToken && !user) {
      fetchMe().catch(() => {
        logout();
        navigate("/login");
      });
    }
  }, [accessToken, user, fetchMe, logout, navigate]);

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

  const scope = (): "global" | { peerId: number } =>
    mode === "private" && peerId != null ? { peerId } : "global";

  const openPrivate = useCallback(
    async (u: SidebarUser) => {
      setMode("private");
      setPeer(u.id);
      setPeerName(u.username);
      setReplyTo(null);
      setEditingLine(null);
      if (!user) return;
      try {
        const { data } = await api.get<PrivateMsgApi[]>(
          `/api/private/messages/${u.id}?limit=100`
        );
        const lines: ChatLine[] = data.map((m) =>
          privateApiToLine(m, user.id, u.username)
        );
        setPrivateLines(u.id, lines);
      } catch {
        toast.error("Could not load message history");
      }
    },
    [setMode, setPeer, setPrivateLines, user]
  );

  const backGlobal = useCallback(() => {
    setMode("global");
    setPeer(null);
    setPeerName(null);
    setReplyTo(null);
    setEditingLine(null);
  }, [setMode, setPeer]);

  const onLogout = () => {
    resetChat();
    logout();
    navigate("/login");
  };

  const lines =
    mode === "private" && peerId != null ? privateLines[peerId] ?? [] : globalLines;

  const title =
    mode === "private" && peerName ? `Private — ${peerName}` : "Global chat";

  const messageScope = (): "global" | "private" =>
    mode === "private" && peerId != null ? "private" : "global";

  const handleSubmitEdit = async (messageId: string | number, text: string) => {
    const sc = scope();
    const list =
      sc === "global" ? globalLines : privateLines[sc.peerId] ?? [];
    const prev = list.find((l) => String(l.id) === String(messageId));
    const contentType = prev?.contentType ?? "text";
    await putMessage(
      messageId,
      { text, content_type: contentType },
      messageScope()
    );
    if (prev) {
      replaceLineById(messageId, sc, {
        ...prev,
        body: text,
        editedAt: new Date().toISOString(),
      });
    }
  };

  const handleDeleteLine = async (line: ChatLine) => {
    const sc = scope();
    await deleteMessage(line.id, messageScope());
    removeLineById(line.id, sc);
    if (
      sc === "global" &&
      pinnedGlobalMessage &&
      String(pinnedGlobalMessage.id) === String(line.id)
    ) {
      setPinnedGlobalMessage(null);
    }
  };

  const handleModDelete = async (line: ChatLine) => {
    if (mode !== "global") return;
    await deleteMessage(line.id, "global");
    removeLineById(line.id, "global");
    if (
      pinnedGlobalMessage &&
      String(pinnedGlobalMessage.id) === String(line.id)
    ) {
      setPinnedGlobalMessage(null);
    }
  };

  const handlePin = async (line: ChatLine) => {
    await pinGlobalMessage(line.id);
    setPinnedGlobalMessage(line);
  };

  const handleUnpin = async () => {
    if (!pinnedGlobalMessage) return;
    await unpinGlobalMessage(pinnedGlobalMessage.id);
    setPinnedGlobalMessage(null);
  };

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        title={title}
        subtitle={
          mode === "private"
            ? "Messages are end-to-end stored on the server"
            : "Everyone sees this room"
        }
        username={user?.username ?? "…"}
        userRole={user?.role}
        onLogout={onLogout}
        onOpenConversations={() => setConvOpen(true)}
        showBack={mode === "private"}
        onBackGlobal={backGlobal}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3 lg:flex-row">
        <UserSidebar
          users={users}
          selectedId={mode === "private" ? peerId : null}
          onSelect={(u) => void openPrivate(u)}
          loading={usersLoading}
          currentUserId={user?.id}
          isAdmin={admin}
          isModerator={mod}
          onBanUser={(u) => setBanTarget({ id: u.id, username: u.username })}
          onSetRole={admin ? onSetRole : undefined}
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {mode === "global" && pinnedGlobalMessage && (
            <PinnedMessageBar
              line={pinnedGlobalMessage}
              canUnpin={mod}
              onUnpin={() => void handleUnpin()}
            />
          )}
          <MessageThread
            lines={lines}
            emptyHint={
              mode === "private"
                ? "No messages yet — say hi!"
                : "No messages yet. Be the first!"
            }
            mode={mode}
            currentUserId={user?.id}
            globalRoomBanned={globalBanned}
            isModerator={mod}
            isAdmin={admin}
            pinnedMessageId={pinnedGlobalMessage?.id ?? null}
            onReply={(line) => {
              setEditingLine(null);
              setReplyTo(line);
            }}
            onEditOwn={(line) => {
              setReplyTo(null);
              setEditingLine(line);
            }}
            onDeleteOwn={(line) => void handleDeleteLine(line)}
            onModDelete={(line) => void handleModDelete(line)}
            onPin={mode === "global" && mod ? (line) => void handlePin(line) : undefined}
            onBanFromMessage={(userId, username) =>
              setBanTarget({ id: userId, username })
            }
          />
          <MessageInput
            key={editingLine ? `edit-${editingLine.id}` : `compose-${mode}-${peerId ?? "g"}`}
            disabled={!accessToken || (mode === "global" && globalBanned)}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            editingLine={editingLine}
            onCancelEdit={() => setEditingLine(null)}
            onSubmitEdit={handleSubmitEdit}
            onSendText={(text, contentType, replyToId) => {
              try {
                sendActive(text, contentType, replyToId);
                setReplyTo(null);
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
        onOpenChat={(id, username) => {
          const su = users.find((x) => x.id === id);
          if (su) void openPrivate(su);
          else {
            setMode("private");
            setPeer(id);
            setPeerName(username);
            setReplyTo(null);
            setEditingLine(null);
            void (async () => {
              if (!user) return;
              try {
                const { data } = await api.get<PrivateMsgApi[]>(
                  `/api/private/messages/${id}?limit=100`
                );
                const mapped: ChatLine[] = data.map((m) =>
                  privateApiToLine(m, user.id, username)
                );
                setPrivateLines(id, mapped);
              } catch {
                toast.error("Could not load messages");
              }
            })();
          }
        }}
      />

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
