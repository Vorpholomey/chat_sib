export type UserRole = "user" | "moderator" | "admin";

/**
 * When backend exposes public-room ban on profile/me, wire these fields.
 * TODO: align names with backend if they differ.
 */
export type PublicBanFields = {
  public_ban_until?: string | null;
  is_public_banned?: boolean;
};
