"""Centralized permission checks for chat moderation (server is source of truth)."""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.user import User, UserRole


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_public_banned(user: User, now: datetime | None = None) -> bool:
    """Banned from public chat: cannot send global messages or edit/delete own global messages."""
    if user.public_ban_permanent:
        return True
    t = now or utc_now()
    if user.public_ban_until is not None and user.public_ban_until > t:
        return True
    return False


def can_access_global_feed(user: User) -> bool:
    """Permanent public ban removes access to global room content and sidebar presence (DMs unchanged)."""
    return not user.public_ban_permanent


def can_send_global(user: User, now: datetime | None = None) -> bool:
    return not is_public_banned(user, now)


def can_edit_own_global(user: User, now: datetime | None = None) -> bool:
    return not is_public_banned(user, now)


def can_delete_own_global(user: User, now: datetime | None = None) -> bool:
    return not is_public_banned(user, now)


def can_edit_global_message(actor: User, author: User, *, now: datetime | None = None) -> bool:
    """Edit global message: author (unless public-banned), admin any, mod only if author is user."""
    if actor.id == author.id:
        return can_edit_own_global(actor, now)
    if actor.role == UserRole.admin:
        return True
    if actor.role == UserRole.moderator:
        if author.role == UserRole.admin:
            return False
        if author.role in (UserRole.moderator, UserRole.admin):
            return False
        return author.role == UserRole.user
    return False


def can_delete_global_message(actor: User, author: User, *, now: datetime | None = None) -> bool:
    """Delete global: author (unless banned from public); admin any; mod any except author admin."""
    if actor.id == author.id:
        return can_delete_own_global(actor, now)
    if actor.role == UserRole.admin:
        return True
    if actor.role == UserRole.moderator:
        return author.role != UserRole.admin
    return False


def can_edit_private_message(actor: User, sender: User) -> bool:
    """DM edit: author always; admin can edit any. Moderators cannot edit others' DMs."""
    if actor.id == sender.id:
        return True
    if actor.role == UserRole.admin:
        return True
    return False


def can_delete_private_message(actor: User, sender: User) -> bool:
    """DM delete: author always; admin can delete any. Moderators cannot delete others' DMs."""
    if actor.id == sender.id:
        return True
    if actor.role == UserRole.admin:
        return True
    return False


def can_pin(actor: User) -> bool:
    return actor.role in (UserRole.moderator, UserRole.admin)


def can_ban(actor: User, target: User) -> bool:
    if actor.role not in (UserRole.moderator, UserRole.admin):
        return False
    if actor.id == target.id:
        return False
    if target.role in (UserRole.moderator, UserRole.admin):
        return False
    return True


def can_change_role(actor: User, target: User, new_role: UserRole) -> bool:
    if actor.role != UserRole.admin:
        return False
    if actor.id == target.id:
        return False
    if target.role == UserRole.admin:
        return False
    if new_role == UserRole.admin:
        return False
    if new_role not in (UserRole.user, UserRole.moderator):
        return False
    return True


def require_moderator_or_admin(role: UserRole) -> bool:
    return role in (UserRole.moderator, UserRole.admin)
