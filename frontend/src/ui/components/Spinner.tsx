import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

type Props = {
  label?: string;
  className?: string;
};

export function Spinner({ label = "Loading…", className }: Props) {
  return (
    <div className={cn("flex items-center justify-center gap-2 text-sm text-foreground-muted", className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
