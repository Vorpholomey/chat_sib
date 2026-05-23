import type { ColorTokenKey } from "./colors";

export type ElementColorPart = {
  token: ColorTokenKey | "dynamic" | "thirdParty";
  /** Human-readable color (hex / name) for the gallery table */
  swatch: string;
  /** Tailwind classes applied to that part */
  classes: string;
};

/**
 * Maps UI elements (and their parts) to semantic tokens and resolved classes.
 * Used by UiKitPage for documentation and as the single reference for migrations.
 */
export const elementColors = {
  appBackground: {
    background: {
      token: "background",
      swatch: "#020617 (slate-950)",
      classes: "bg-background",
    },
    foreground: {
      token: "foreground",
      swatch: "#f1f5f9 (slate-100)",
      classes: "text-foreground",
    },
  },
  buttonPrimary: {
    background: {
      token: "primary",
      swatch: "#7c3aed (violet-600)",
      classes: "bg-primary hover:bg-primary-hover",
    },
    foreground: {
      token: "foregroundOnPrimary",
      swatch: "#ffffff",
      classes: "text-foreground-on-primary",
    },
    focusRing: {
      token: "primary",
      swatch: "violet-500 @ 50%",
      classes: "focus-visible:ring-primary/50",
    },
  },
  buttonSecondary: {
    border: {
      token: "borderStrong",
      swatch: "#475569 (slate-600)",
      classes: "border-border-strong",
    },
    foreground: {
      token: "foreground",
      swatch: "#e2e8f0 (slate-200)",
      classes: "text-foreground",
    },
    backgroundHover: {
      token: "surfaceElevated",
      swatch: "#1e293b (slate-800)",
      classes: "hover:bg-surface-elevated",
    },
  },
  buttonGhost: {
    foreground: {
      token: "accent",
      swatch: "#c4b5fd (violet-300)",
      classes: "text-accent",
    },
    backgroundHover: {
      token: "surfaceElevated",
      swatch: "#1e293b (slate-800)",
      classes: "hover:bg-surface-elevated",
    },
  },
  buttonDanger: {
    foreground: {
      token: "danger",
      swatch: "#fca5a5 (red-300)",
      classes: "text-danger",
    },
    backgroundHover: {
      token: "surfaceElevated",
      swatch: "#1e293b (slate-800)",
      classes: "hover:bg-surface-elevated",
    },
  },
  inputDefault: {
    background: {
      token: "background",
      swatch: "#020617 (slate-950)",
      classes: "bg-background",
    },
    border: {
      token: "borderStrong",
      swatch: "#334155 (slate-700)",
      classes: "border-border-strong",
    },
    foreground: {
      token: "foreground",
      swatch: "#f1f5f9 (slate-100)",
      classes: "text-foreground",
    },
    placeholder: {
      token: "foregroundMuted",
      swatch: "#64748b (slate-500)",
      classes: "placeholder:text-foreground-muted",
    },
    focusRing: {
      token: "primary",
      swatch: "violet-500 @ 50%",
      classes: "focus:ring-primary/50",
    },
  },
  cardDefault: {
    background: {
      token: "surface",
      swatch: "#0f172a @ 80% (slate-900)",
      classes: "bg-surface/80",
    },
    border: {
      token: "border",
      swatch: "#1e293b (slate-800)",
      classes: "border-border",
    },
  },
  modalOverlay: {
    background: {
      token: "dynamic",
      swatch: "#000000 @ 60%",
      classes: "bg-black/60",
    },
  },
  modalPanel: {
    background: {
      token: "surface",
      swatch: "#0f172a (slate-900)",
      classes: "bg-surface",
    },
    border: {
      token: "border",
      swatch: "#1e293b (slate-800)",
      classes: "border-border",
    },
  },
  linkDefault: {
    foreground: {
      token: "link",
      swatch: "#a78bfa (violet-400)",
      classes: "text-link hover:underline",
    },
  },
  badgeRoleUser: {
    background: {
      token: "roleUser",
      swatch: "#334155 @ 80% (slate-700)",
      classes: "bg-role-user",
    },
    foreground: {
      token: "roleUser",
      swatch: "#e2e8f0 (slate-200)",
      classes: "text-role-user-fg",
    },
  },
  badgeRoleModerator: {
    background: {
      token: "roleMod",
      swatch: "#78350f @ 60% (amber-900)",
      classes: "bg-role-mod",
    },
    foreground: {
      token: "roleMod",
      swatch: "#fde68a (amber-200)",
      classes: "text-role-mod-fg",
    },
  },
  badgeRoleAdmin: {
    background: {
      token: "roleAdmin",
      swatch: "#881337 @ 50% (rose-900)",
      classes: "bg-role-admin",
    },
    foreground: {
      token: "roleAdmin",
      swatch: "#fecdd3 (rose-200)",
      classes: "text-role-admin-fg",
    },
  },
  alertWarning: {
    background: {
      token: "warningSurface",
      swatch: "#451a03 @ 40% (amber-950)",
      classes: "bg-warning-surface",
    },
    border: {
      token: "warning",
      swatch: "#b45309 (amber-700)",
      classes: "border-warning/50",
    },
    foreground: {
      token: "warning",
      swatch: "#fef3c7 (amber-100)",
      classes: "text-warning",
    },
  },
  dividerUnread: {
    line: {
      token: "unread",
      swatch: "#0ea5e9 @ 40% (sky-500)",
      classes: "bg-unread/40",
    },
    label: {
      token: "unread",
      swatch: "#38bdf8 (sky-400)",
      classes: "text-unread",
    },
  },
  messageBubbleOwn: {
    background: {
      token: "dynamic",
      swatch: "violet-950 @ 35%",
      classes: "bg-violet-950/35",
    },
    border: {
      token: "dynamic",
      swatch: "violet-800 @ 35%",
      classes: "border-violet-800/35",
    },
  },
  messageBubbleOther: {
    background: {
      token: "surfaceElevated",
      swatch: "slate-800 @ 75%",
      classes: "bg-slate-800/75",
    },
    border: {
      token: "borderStrong",
      swatch: "slate-700 @ 80%",
      classes: "border-slate-700/80",
    },
  },
  pinnedBar: {
    background: {
      token: "warningSurface",
      swatch: "amber-950 @ 40%",
      classes: "bg-amber-950/40",
    },
    border: {
      token: "warning",
      swatch: "amber-700 @ 50%",
      classes: "border-amber-700/50",
    },
    foreground: {
      token: "warning",
      swatch: "amber-100 @ 90%",
      classes: "text-amber-100/90",
    },
  },
  chatHeaderAction: {
    border: {
      token: "borderStrong",
      swatch: "#334155 (slate-700)",
      classes: "border-border-strong",
    },
    foreground: {
      token: "accent",
      swatch: "#c4b5fd (violet-300)",
      classes: "text-accent",
    },
    backgroundHover: {
      token: "surfaceElevated",
      swatch: "#1e293b (slate-800)",
      classes: "hover:bg-surface-elevated",
    },
  },
  jumpToUnreadFab: {
    background: {
      token: "surfaceElevated",
      swatch: "slate-800 @ 95%",
      classes: "bg-slate-800/95",
    },
    focusRing: {
      token: "unread",
      swatch: "#0ea5e9 (sky-500)",
      classes: "focus-visible:ring-unread",
    },
  },
  usernameInChat: {
    foreground: {
      token: "dynamic",
      swatch: "HSL per user (usernameColor.ts)",
      classes: "inline style color",
    },
  },
  replyQuoteInBubble: {
    border: {
      token: "borderStrong",
      swatch: "slate-600 @ 80%",
      classes: "border-slate-600/80",
    },
    foreground: {
      token: "foregroundMuted",
      swatch: "#64748b (slate-500)",
      classes: "text-slate-500",
    },
    background: {
      token: "surface",
      swatch: "slate-900 @ 50%",
      classes: "bg-surface/50",
    },
  },
  messageEditedLabel: {
    foreground: {
      token: "foregroundMuted",
      swatch: "#64748b (slate-500)",
      classes: "text-slate-500 italic",
    },
  },
  messageSearchActive: {
    border: {
      token: "dynamic",
      swatch: "amber-400 @ 85%",
      classes: "ring-2 ring-amber-400/85",
    },
  },
  messageSearchHighlight: {
    background: {
      token: "dynamic",
      swatch: "amber-500 @ 35%",
      classes: "[&_mark]:bg-amber-500/35",
    },
  },
  messageReactionChipOwn: {
    borderActive: {
      token: "dynamic",
      swatch: "violet-500 @ 50%",
      classes: "border-violet-500/50",
    },
    backgroundActive: {
      token: "dynamic",
      swatch: "violet-600 @ 25%",
      classes: "bg-violet-600/25",
    },
    borderInactive: {
      token: "dynamic",
      swatch: "violet-800 @ 30%",
      classes: "border-violet-800/30",
    },
    backgroundInactive: {
      token: "dynamic",
      swatch: "slate-900 @ 40%",
      classes: "bg-slate-900/40",
    },
    foregroundActive: {
      token: "dynamic",
      swatch: "#ede9fe (violet-100)",
      classes: "text-violet-100",
    },
    foregroundInactive: {
      token: "foregroundMuted",
      swatch: "#cbd5e1 (slate-300)",
      classes: "text-slate-300",
    },
  },
  messageReactionChipOther: {
    borderActive: {
      token: "dynamic",
      swatch: "sky-500 @ 45%",
      classes: "border-sky-500/45",
    },
    backgroundActive: {
      token: "dynamic",
      swatch: "sky-900 @ 35%",
      classes: "bg-sky-900/35",
    },
    borderInactive: {
      token: "dynamic",
      swatch: "slate-600 @ 60%",
      classes: "border-slate-600/60",
    },
    backgroundInactive: {
      token: "dynamic",
      swatch: "slate-900 @ 50%",
      classes: "bg-slate-900/50",
    },
    foreground: {
      token: "foregroundMuted",
      swatch: "#cbd5e1 (slate-300)",
      classes: "text-slate-300",
    },
  },
  connectionBadge: {
    connected: {
      token: "primary",
      swatch: "#7c3aed (violet-600)",
      classes: "text-primary",
    },
    connecting: {
      token: "accent",
      swatch: "#c4b5fd (violet-300)",
      classes: "text-accent",
    },
    disconnected: {
      token: "danger",
      swatch: "#fca5a5 (red-300)",
      classes: "text-danger",
    },
  },
  composerStatusError: {
    foreground: {
      token: "danger",
      swatch: "#fca5a5 (red-300)",
      classes: "text-danger",
    },
  },
  statusMessageSuccess: {
    foreground: {
      token: "success",
      swatch: "#34d399 (emerald-400)",
      classes: "text-success",
    },
  },
  statusMessageError: {
    foreground: {
      token: "danger",
      swatch: "#fca5a5 (red-300)",
      classes: "text-danger",
    },
  },
  richTextFormatMenu: {
    background: {
      token: "surfaceElevated",
      swatch: "#1e293b (slate-800)",
      classes: "bg-surface-elevated",
    },
  },
  drawerSheet: {
    background: {
      token: "surface",
      swatch: "#0f172a (slate-900)",
      classes: "bg-surface",
    },
  },
  toastSonner: {
    note: {
      token: "thirdParty",
      swatch: "Sonner richColors palette",
      classes: "sonner — not themed via kit",
    },
  },
} as const satisfies Record<string, Record<string, ElementColorPart>>;

export type ElementColorKey = keyof typeof elementColors;
