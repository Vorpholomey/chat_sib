import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Props = HTMLAttributes<HTMLDivElement> & {
  padding?: "none" | "md";
};

export function Card({ padding = "md", className, children, ...props }: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface/80 shadow-xl",
        padding === "md" && "p-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
