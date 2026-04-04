/**
 * Stable HSL color for a chat participant. Prefer `senderId` when present so
 * renames do not change the color; otherwise hash the display name.
 */
export function usernameColorFromUser(
  senderId: number | undefined,
  displayName: string
): string {
  const seed =
    senderId != null ? `id:${senderId}` : `name:${displayName.toLowerCase().trim()}`;
  return hashSeedToHsl(seed);
}

function hashSeedToHsl(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 62% 70%)`;
}
