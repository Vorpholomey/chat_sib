import { LogOut, MessageSquare, Users } from "lucide-react";
import type { UserRole } from "../types/user";
import { RoleBadge } from "./RoleBadge";

type Props = {
  title: string;
  subtitle?: string;
  username: string;
  userRole?: UserRole;
  onLogout: () => void;
  onOpenConversations: () => void;
  onBackGlobal?: () => void;
  showBack?: boolean;
};

export function ChatHeader({
  title,
  subtitle,
  username,
  userRole,
  onLogout,
  onOpenConversations,
  onBackGlobal,
  showBack,
}: Props) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 pb-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showBack && onBackGlobal && (
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              onClick={onBackGlobal}
            >
              ← Global
            </button>
          )}
          <h1 className="truncate text-lg font-semibold text-white">{title}</h1>
        </div>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-violet-300 hover:bg-slate-800"
        onClick={onOpenConversations}
      >
        <MessageSquare className="h-4 w-4" />
        Dialogues
      </button>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-slate-500" />
        <span className="max-w-[140px] truncate text-sm text-slate-300">{username}</span>
        {userRole && <RoleBadge role={userRole} />}
      </div>
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
        onClick={onLogout}
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </header>
  );
}
