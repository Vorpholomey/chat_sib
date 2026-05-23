/**
 * Semantic color tokens → Tailwind utility classes.
 * Raw palette values live in `index.css` `@theme`; use these keys in components.
 */
export const colorTokens = {
  background: "bg-background",
  surface: "bg-surface",
  surfaceElevated: "bg-surface-elevated",
  foreground: "text-foreground",
  foregroundMuted: "text-foreground-muted",
  foregroundOnPrimary: "text-foreground-on-primary",
  border: "border-border",
  borderStrong: "border-border-strong",
  primary: "bg-primary",
  primaryHover: "hover:bg-primary-hover",
  primaryForeground: "text-primary",
  accent: "text-accent",
  link: "text-link",
  warning: "text-warning",
  warningSurface: "bg-warning-surface",
  unread: "text-unread",
  unreadBorder: "border-unread",
  danger: "text-danger",
  dangerBg: "bg-danger",
  success: "text-success",
  roleUser: "bg-role-user text-role-user-fg",
  roleMod: "bg-role-mod text-role-mod-fg",
  roleAdmin: "bg-role-admin text-role-admin-fg",
} as const;

export type ColorTokenKey = keyof typeof colorTokens;
