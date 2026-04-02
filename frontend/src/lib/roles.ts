import type { User } from "../store/authStore";

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === "admin";
}

/** Admin includes moderator capabilities in the UI */
export function isModerator(user: User | null | undefined): boolean {
  const r = user?.role;
  return r === "moderator" || r === "admin";
}

export function isPublicRoomBanned(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.is_public_banned === true) return true;
  if (user.public_ban_until) {
    const t = Date.parse(user.public_ban_until);
    if (!Number.isNaN(t) && t > Date.now()) return true;
  }
  return false;
}
