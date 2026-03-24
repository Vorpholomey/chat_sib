import { Circle, MessageCircle } from "lucide-react";
import type { SidebarUser } from "../types/chat";

type Props = {
  users: SidebarUser[];
  selectedId: number | null;
  onSelect: (u: SidebarUser) => void;
  loading?: boolean;
};

export function UserSidebar({ users, selectedId, onSelect, loading }: Props) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-800 bg-slate-900/40 pb-3 lg:w-64 lg:border-b-0 lg:border-r lg:pb-0">
      <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <MessageCircle className="h-4 w-4" />
        People
      </h2>
      <div className="max-h-40 overflow-y-auto lg:max-h-none">
        {loading ? (
          <p className="px-1 text-sm text-slate-500">Loading…</p>
        ) : users.length === 0 ? (
          <p className="px-1 text-sm text-slate-500">No other users yet</p>
        ) : (
          <ul className="space-y-1">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onSelect(u)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-800 ${
                    selectedId === u.id ? "bg-slate-800 ring-1 ring-violet-500/50" : ""
                  }`}
                >
                  <Circle
                    className={`h-2.5 w-2.5 shrink-0 ${
                      u.online ? "fill-emerald-400 text-emerald-400" : "fill-slate-600 text-slate-600"
                    }`}
                  />
                  <span className="truncate font-medium text-slate-100">{u.username}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {u.online ? "online" : "offline"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
