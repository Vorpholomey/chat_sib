import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, Circle, MessageCircle, MoreHorizontal } from "lucide-react";
import type { SidebarUser } from "../types/chat";
import type { UserRole } from "../types/user";
import {
  computeFloatingMenuLeft,
  computeFloatingMenuTopInitial,
  computeFloatingMenuTopRefined,
} from "../lib/floatingMenuPosition";
import { RoleBadge } from "./RoleBadge";

type Props = {
  users: SidebarUser[];
  selectedId: number | null;
  onSelect: (u: SidebarUser) => void;
  loading?: boolean;
  currentUserId?: number;
  isAdmin?: boolean;
  isModerator?: boolean;
  onBanUser?: (u: SidebarUser) => void;
  onSetRole?: (userId: number, role: Exclude<UserRole, "admin">) => void | Promise<void>;
};

const MENU_MIN_W = 176;

/** Online users first; then alphabetical by username. */
function sortPeopleForDisplay(list: SidebarUser[]): SidebarUser[] {
  return [...list].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.username.localeCompare(b.username, undefined, { sensitivity: "base" });
  });
}

function canBanTarget(
  actor: { isAdmin: boolean; isModerator: boolean },
  target: SidebarUser,
  selfId?: number
): boolean {
  if (!actor.isModerator && !actor.isAdmin) return false;
  if (selfId != null && target.id === selfId) return false;
  if (target.role === "admin") return false;
  if (target.role === "moderator" && !actor.isAdmin) return false;
  return true;
}

export function UserSidebar({
  users,
  selectedId,
  onSelect,
  loading,
  currentUserId,
  isAdmin = false,
  isModerator = false,
  onBanUser,
  onSetRole,
}: Props) {
  const [roleSavingId, setRoleSavingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuFixed, setMenuFixed] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const sortedUsers = useMemo(() => sortPeopleForDisplay(users), [users]);

  const openUser = openMenuId != null ? sortedUsers.find((x) => x.id === openMenuId) : undefined;

  useLayoutEffect(() => {
    if (openMenuId === null || !menuFixed) return;
    const btn = triggerRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;
    const rect = btn.getBoundingClientRect();
    const h = menu.offsetHeight;
    const top = computeFloatingMenuTopRefined(rect, h);
    setMenuFixed((prev) => (prev && prev.top !== top ? { ...prev, top } : prev));
    // menuFixed omitted on purpose to avoid a positioning feedback loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMenuId, openUser?.id]);

  useEffect(() => {
    if (openMenuId === null) return;
    const onDocDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && !el.closest("[data-user-actions-menu]")) {
        setOpenMenuId(null);
        setMenuFixed(null);
      }
    };
    const closeOnScroll = () => {
      setOpenMenuId(null);
      setMenuFixed(null);
    };
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [openMenuId]);

  const toggleMenu = (u: SidebarUser, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (openMenuId === u.id) {
      setOpenMenuId(null);
      setMenuFixed(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const left = computeFloatingMenuLeft(rect, MENU_MIN_W);
    const estimatedH = 130;
    const top = computeFloatingMenuTopInitial(rect, estimatedH);
    setMenuFixed({ top, left });
    setOpenMenuId(u.id);
  };

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-800 bg-slate-900/40 pb-3 lg:w-72 lg:border-b-0 lg:border-r lg:pb-0">
      <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <MessageCircle className="h-4 w-4" />
        People
      </h2>
      <div className="max-h-40 overflow-y-auto lg:max-h-none">
        {loading ? (
          <p className="px-1 text-sm text-slate-500">Loading…</p>
        ) : sortedUsers.length === 0 ? (
          <p className="px-1 text-sm text-slate-500">No other users yet</p>
        ) : (
          <ul className="space-y-1">
            {sortedUsers.map((u) => {
              const showBan =
                onBanUser &&
                canBanTarget({ isAdmin, isModerator }, u, currentUserId);
              const showRole =
                isAdmin &&
                onSetRole &&
                currentUserId != null &&
                u.id !== currentUserId &&
                u.role !== "admin";

              const hasActions = showBan || showRole;

              return (
                <li key={u.id}>
                  <div
                    className={`flex w-full items-start gap-1 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-800 ${
                      selectedId === u.id ? "bg-slate-800 ring-1 ring-violet-500/50" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        setMenuFixed(null);
                        onSelect(u);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <Circle
                        className={`h-2.5 w-2.5 shrink-0 ${
                          u.online
                            ? "fill-emerald-400 text-emerald-400"
                            : "fill-slate-600 text-slate-600"
                        }`}
                      />
                      <span className="min-w-0 truncate font-medium text-slate-100">
                        {u.username}
                      </span>
                      {u.role && <RoleBadge role={u.role} className="ml-1" />}
                      <span className="ml-auto shrink-0 text-xs text-slate-500">
                        {u.online ? "online" : "offline"}
                      </span>
                    </button>
                    {hasActions && (
                      <div className="relative shrink-0" data-user-actions-menu>
                        <button
                          ref={openMenuId === u.id ? triggerRef : undefined}
                          type="button"
                          aria-label={`Actions for ${u.username}`}
                          aria-expanded={openMenuId === u.id}
                          aria-haspopup="menu"
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-slate-100"
                          onClick={(e) => toggleMenu(u, e)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {openUser &&
        menuFixed &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            data-user-actions-menu
            style={{
              position: "fixed",
              top: menuFixed.top,
              left: menuFixed.left,
              zIndex: 9999,
              minWidth: MENU_MIN_W,
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl ring-1 ring-black/40"
          >
            {onBanUser &&
              canBanTarget({ isAdmin, isModerator }, openUser, currentUserId) && (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-amber-200 hover:bg-slate-800"
                  onClick={() => {
                    onBanUser(openUser);
                    setOpenMenuId(null);
                    setMenuFixed(null);
                  }}
                >
                  <Ban className="h-3.5 w-3.5 shrink-0" />
                  Ban user
                </button>
              )}
            {isAdmin &&
              onSetRole &&
              currentUserId != null &&
              openUser.id !== currentUserId &&
              openUser.role !== "admin" && (
                <div
                  className="border-t border-slate-800 px-3 py-2"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Role
                  </label>
                  <select
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
                    disabled={roleSavingId === openUser.id}
                    value={openUser.role === "moderator" ? "moderator" : "user"}
                    onChange={async (e) => {
                      const v = e.target.value as Exclude<UserRole, "admin">;
                      setRoleSavingId(openUser.id);
                      try {
                        await onSetRole(openUser.id, v);
                        setOpenMenuId(null);
                        setMenuFixed(null);
                      } finally {
                        setRoleSavingId(null);
                      }
                    }}
                  >
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                  </select>
                </div>
              )}
          </div>,
          document.body
        )}
    </aside>
  );
}
