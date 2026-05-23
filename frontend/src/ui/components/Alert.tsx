import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

const variants = {
  warning: "border-warning/50 bg-warning-surface text-warning",
  info: "border-border-strong bg-surface/60 text-foreground-muted",
} as const;

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof variants;
};

export function Alert({ variant = "info", className, children, ...props }: Props) {
  return (
    <div
      role="status"
      className={cn("rounded-lg border px-3 py-2 text-sm", variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
