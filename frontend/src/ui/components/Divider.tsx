import { cn } from "../lib/cn";

type Props = {
  label?: string;
  variant?: "default" | "unread";
  className?: string;
};

export function Divider({ label, variant = "default", className }: Props) {
  if (variant === "unread" && label) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-unread",
          className,
        )}
      >
        <span className="h-px flex-1 bg-unread/40" />
        <span>{label}</span>
        <span className="h-px flex-1 bg-unread/40" />
      </div>
    );
  }

  return (
    <hr
      className={cn("border-0 border-t border-border", className)}
      aria-hidden={!label}
    />
  );
}
