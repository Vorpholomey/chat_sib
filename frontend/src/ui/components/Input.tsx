import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
