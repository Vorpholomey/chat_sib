import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md";
  label: string;
};

const sizeClasses = {
  sm: "h-[33px] min-w-[33px] px-3 text-sm",
  md: "h-10 min-w-10 px-2.5 text-base",
} as const;

export function IconButton({ size = "md", label, className, children, ...props }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-border-strong text-foreground-muted shadow-sm transition-colors hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
