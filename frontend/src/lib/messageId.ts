/** Coerce a chat line id (API may send number or string) to a number for ordering / read cursor math. */
export function numericMessageId(id: string | number): number {
  return typeof id === "number" ? id : Number(id);
}
