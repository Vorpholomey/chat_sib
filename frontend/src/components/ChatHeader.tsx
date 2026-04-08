import { useEffect, useRef } from "react";
import { LogOut, MessageSquare, Search, Users, X } from "lucide-react";
import type { UserRole } from "../types/user";
import { RoleBadge } from "./RoleBadge";

export type ChatMessageSearchControls = {
  open: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onSubmit: () => void;
  hasRun: boolean;
  matchCount: number;
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
};

type Props = {
  title: string;
  subtitle?: string;
  username: string;
  userRole?: UserRole;
  onLogout: () => void;
  onOpenConversations: () => void;
  onBackGlobal?: () => void;
  showBack?: boolean;
  messageSearch?: ChatMessageSearchControls;
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
  messageSearch,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messageSearch?.open) {
      inputRef.current?.focus();
    }
  }, [messageSearch?.open]);

  const ms = messageSearch;

  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-slate-800 pb-3">
      <div className="flex flex-wrap items-center gap-3">
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

        {ms && (
          <button
            type="button"
            className="flex h-[33px] shrink-0 items-center justify-center rounded-lg border border-slate-700 px-3 text-sm text-violet-300 shadow-sm hover:bg-slate-800"
            aria-label={ms.open ? "Search messages (open)" : "Search messages"}
            title="Search messages"
            onClick={() => (ms.open ? inputRef.current?.focus() : ms.onOpen())}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        )}

        <button
          type="button"
          className="flex h-[33px] shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-3 text-sm text-violet-300 shadow-sm hover:bg-slate-800"
          onClick={onOpenConversations}
        >
          <MessageSquare className="h-4 w-4" />
          Dialogues
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          <span className="max-w-[140px] truncate text-sm text-slate-300">{username}</span>
          {userRole && <RoleBadge role={userRole} />}
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>

      {ms?.open && (
        <div className="flex w-full min-w-0 flex-col gap-2">
          <form
            className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch"
            onSubmit={(e) => {
              e.preventDefault();
              ms.onSubmit();
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                ref={inputRef}
                type="search"
                autoComplete="off"
                placeholder="Search messages..."
                value={ms.draft}
                onChange={(e) => ms.onDraftChange(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100 shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              <button
                type="submit"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-violet-300 shadow-sm hover:bg-slate-800"
                title="Search"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Search</span>
              </button>
              <button
                type="button"
                className="flex shrink-0 items-center justify-center rounded-lg border border-slate-700 px-2.5 py-1.5 text-lg leading-none text-slate-400 shadow-sm hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close search"
                onClick={ms.onClose}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </form>

          {ms.hasRun && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              {ms.matchCount === 0 ? (
                <span>No matches found</span>
              ) : (
                <>
                  <span>Found: {ms.matchCount} matches</span>
                  <span className="text-slate-600" aria-hidden>
                    ·
                  </span>
                  <span className="tabular-nums text-slate-300">
                    {ms.activeIndex + 1} of {ms.matchCount}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
                      aria-label="Previous match"
                      onClick={ms.onPrev}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
                      aria-label="Next match"
                      onClick={ms.onNext}
                    >
                      ▼
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
