import type { UserRole } from "../../types/user";
import { cn } from "../lib/cn";

const roleStyles: Record<UserRole, string> = {
  user: "bg-role-user text-role-user-fg",
  moderator: "bg-role-mod text-role-mod-fg",
  admin: "bg-role-admin text-role-admin-fg",
};

const roleLabels: Record<UserRole, string> = {
  user: "User",
  moderator: "Mod",
  admin: "Admin",
};

type RoleBadgeProps = {
  role: UserRole;
  className?: string;
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        roleStyles[role],
        className,
      )}
    >
      {roleLabels[role]}
    </span>
  );
}

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "warning";
  className?: string;
};

const variantStyles = {
  default: "bg-surface-elevated/80 text-foreground",
  warning: "bg-warning-surface text-warning border border-warning/50",
} as const;

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
