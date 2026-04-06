import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { htmlToPlainPreview } from "../lib/richText";
import { formatTime } from "../store/chatStore";

type Conv = {
  interlocutor: { id: number; username: string };
  last_message: string | null;
  last_message_at: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenChat: (userId: number, username: string) => void;
};

export function ConversationsModal({ open, onClose, onOpenChat }: Props) {
  const [list, setList] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<{ conversations: Conv[] }>(
          "/api/private/conversations"
        );
        if (!cancelled) setList(data.conversations);
      } catch {
        toast.error("Could not load conversations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="text-lg font-semibold text-white">Your conversations</h3>
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Loading…</p>
          ) : list.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No private chats yet</p>
          ) : (
            <ul className="space-y-1">
              {list.map((c) => (
                <li key={c.interlocutor.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-800"
                    onClick={() => {
                      onOpenChat(c.interlocutor.id, c.interlocutor.username);
                      onClose();
                    }}
                  >
                    <div className="font-medium text-violet-300">
                      {c.interlocutor.username}
                    </div>
                    {c.last_message_at && (
                      <div className="text-xs text-slate-500">
                        {formatTime(c.last_message_at)}
                      </div>
                    )}
                    {c.last_message && (
                      <div className="truncate text-slate-400">
                        {htmlToPlainPreview(c.last_message)}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
