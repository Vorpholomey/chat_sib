"""Append-only moderation audit log."""

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.moderation_audit_log import ModerationAuditLog


async def log_action(
    db: AsyncSession,
    *,
    actor_id: int,
    action: str,
    target_type: str,
    target_id: int,
    metadata: Optional[dict[str, Any]] = None,
) -> ModerationAuditLog:
    row = ModerationAuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        audit_metadata=metadata,
    )
    db.add(row)
    await db.flush()
    return row
