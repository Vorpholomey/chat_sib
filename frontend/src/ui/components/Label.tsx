import type { LabelHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { typography } from "../tokens/typography";

type Props = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: Props) {
  return <label className={cn("mb-1 block", typography.label, className)} {...props} />;
}
