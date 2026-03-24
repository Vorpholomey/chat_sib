import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChatHeader } from "../components/ChatHeader";
import { ConversationsModal } from "../components/ConversationsModal";
import { MessageInput } from "../components/MessageInput";
import { MessageThread } from "../components/MessageThread";
import { UserSidebar } from "../components/UserSidebar";
import { useChatSocket } from "../hooks/useChatSocket";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import type { ChatLine } from "../types/chat";
import type { SidebarUser } from "../types/chat";

type PrivateMsgApi = {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  message_type: "text" | "image" | "gif";
  is_read: boolean;
  created_at: string;
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
  const setMode = useChatStore((s) => s.setMode);
  const setPeer = useChatStore((s) => s.setPeer);
  const setPrivateLines = useChatStore((s) => s.setPrivateLines);
  const resetChat = useChatStore((s) => s.reset);

  const { sendActive } = useChatSocket();

  const [users, setUsers] = useState<SidebarUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [convOpen, setConvOpen] = useState(false);
  const [peerName, setPeerName] = useState<string | null>(null);

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
      const { data } = await api.get<SidebarUser[]>("/api/users");
      setUsers(data);
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

  const openPrivate = useCallback(
    async (u: SidebarUser) => {
      setMode("private");
      setPeer(u.id);
      setPeerName(u.username);
      if (!user) return;
      try {
        const { data } = await api.get<PrivateMsgApi[]>(
          `/api/private/messages/${u.id}?limit=100`
        );
        const lines: ChatLine[] = data.map((m) => ({
          id: m.id,
          at: m.created_at,
          author: m.sender_id === user.id ? "You" : u.username,
          body: m.content,
          contentType: m.message_type,
          senderId: m.sender_id,
          recipientId: m.recipient_id,
        }));
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
  }, [setMode, setPeer]);

  const onLogout = () => {
    resetChat();
    logout();
    navigate("/login");
  };

  const lines =
    mode === "private" && peerId != null
      ? privateLines[peerId] ?? []
      : globalLines;

  const title =
    mode === "private" && peerName
      ? `Private — ${peerName}`
      : "Global chat";

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
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MessageThread
            lines={lines}
            emptyHint={
              mode === "private"
                ? "No messages yet — say hi!"
                : "No messages yet. Be the first!"
            }
          />
          <MessageInput
            disabled={!accessToken}
            onSendText={(text, contentType) => {
              try {
                sendActive(text, contentType);
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
            void (async () => {
              if (!user) return;
              try {
                const { data } = await api.get<PrivateMsgApi[]>(
                  `/api/private/messages/${id}?limit=100`
                );
                const lines: ChatLine[] = data.map((m) => ({
                  id: m.id,
                  at: m.created_at,
                  author: m.sender_id === user.id ? "You" : username,
                  body: m.content,
                  contentType: m.message_type,
                  senderId: m.sender_id,
                  recipientId: m.recipient_id,
                }));
                setPrivateLines(id, lines);
              } catch {
                toast.error("Could not load messages");
              }
            })();
          }
        }}
      />
    </div>
  );
}
