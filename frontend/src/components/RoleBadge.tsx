import type { UserRole } from "../types/user";

const styles: Record<UserRole, string> = {
  user: "bg-slate-700/80 text-slate-200",
  moderator: "bg-amber-900/60 text-amber-200",
  admin: "bg-rose-900/50 text-rose-200",
};

const labels: Record<UserRole, string> = {
  user: "User",
  moderator: "Mod",
  admin: "Admin",
};

type Props = {
  role: UserRole;
  className?: string;
};

export function RoleBadge({ role, className = "" }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[role]} ${className}`}
    >
      {labels[role]}
    </span>
  );
}
