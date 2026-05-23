import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Card } from "./Card";

type Props = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
};

export function Modal({
  open,
  onClose,
  titleId,
  title,
  children,
  className,
  closeOnBackdrop = true,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("w-full max-w-sm bg-surface", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </Card>
    </div>
  );
}
