"""User service: get by id, list for conversations, bans, roles."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.services.audit import log_action
from app.services.permissions import can_ban, can_change_role, utc_now


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def apply_public_ban(db: AsyncSession, actor: User, target: User, duration: str) -> User:
    if not can_ban(actor, target):
        raise PermissionError("forbidden")
    now = utc_now()
    if duration == "1h":
        target.public_ban_until = now + timedelta(hours=1)
        target.public_ban_permanent = False
    elif duration == "24h":
        target.public_ban_until = now + timedelta(hours=24)
        target.public_ban_permanent = False
    elif duration == "forever":
        target.public_ban_permanent = True
        target.public_ban_until = None
    else:
        raise ValueError("invalid_duration")
    await db.flush()
    await log_action(
        db,
        actor_id=actor.id,
        action="user_ban",
        target_type="user",
        target_id=target.id,
        metadata={"duration": duration},
    )
    return target


async def set_user_role(db: AsyncSession, actor: User, target: User, new_role: UserRole) -> User:
    if not can_change_role(actor, target, new_role):
        raise PermissionError("forbidden")
    old = target.role
    target.role = new_role
    await db.flush()
    await log_action(
        db,
        actor_id=actor.id,
        action="role_change",
        target_type="user",
        target_id=target.id,
        metadata={"old_role": old.value, "new_role": new_role.value},
    )
    return target
