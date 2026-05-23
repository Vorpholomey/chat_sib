import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

const variants = {
  primary:
    "bg-primary text-foreground-on-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50",
  secondary:
    "border border-border-strong text-foreground hover:bg-surface-elevated disabled:opacity-50",
  ghost: "text-accent hover:bg-surface-elevated disabled:opacity-50",
  danger: "text-danger hover:bg-surface-elevated disabled:opacity-50",
} as const;

export type ButtonVariant = keyof typeof variants;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
