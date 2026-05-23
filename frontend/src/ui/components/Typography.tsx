import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { typography } from "../tokens/typography";

type Props = HTMLAttributes<HTMLElement>;

export function Heading({ className, ...props }: Props) {
  return <h1 className={cn(typography.heading, className)} {...props} />;
}

export function HeadingLg({ className, ...props }: Props) {
  return <h2 className={cn(typography.headingLg, className)} {...props} />;
}

export function Text({ className, ...props }: Props) {
  return <p className={cn(typography.bodySm, className)} {...props} />;
}

export function Muted({ className, ...props }: Props) {
  return <p className={cn(typography.muted, className)} {...props} />;
}

export function MonoTime({ className, ...props }: Props) {
  return <time className={cn(typography.monoTime, className)} {...props} />;
}
