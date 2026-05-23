/** Merge optional class names (no tailwind-merge — keep kit dependency-free). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
