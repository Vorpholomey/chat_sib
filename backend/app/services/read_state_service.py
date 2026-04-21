"""Shared read-cursor persistence and validation for global and private chats."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Union

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.global_message import GlobalMessage
from app.models.global_read_state import GlobalReadState
from app.models.private_message import PrivateMessage
from app.models.private_read_state import PrivateReadState
from app.models.user import User
from app.services import permissions
from app.services.user import get_user_by_id


@dataclass(frozen=True)
class ReadCursorSnapshot:
    """Persisted read cursor; null ``last_read_message_id`` means no cursor yet (new user)."""

    last_read_message_id: Optional[int]
    updated_at: Optional[datetime]


@dataclass(frozen=True)
class GlobalChatRef:
    """Path ``chat_id`` == ``global``."""


@dataclass(frozen=True)
class PrivateChatRef:
    """Path ``chat_id`` is the decimal string peer user id for a DM."""

    peer_id: int


ChatPathRef = Union[GlobalChatRef, PrivateChatRef]


def parse_chat_path_id(chat_id: str) -> ChatPathRef:
    """Decode `chat_id` path segment: literal ``global`` or a positive int (DM peer user id)."""
    if chat_id == "global":
        return GlobalChatRef()
    if not chat_id or not chat_id.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid chat_id: expected 'global' or a positive integer peer id",
        )
    peer_id = int(chat_id)
    if peer_id < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid chat_id: peer id must be a positive integer",
        )
    return PrivateChatRef(peer_id=peer_id)


async def require_global_feed(user: User) -> None:
    if not permissions.can_access_global_feed(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to global chat",
        )


async def get_global_message_or_404(db: AsyncSession, message_id: int) -> GlobalMessage:
    msg = await db.get(GlobalMessage, message_id)
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return msg


async def validate_private_message_for_peer(
    db: AsyncSession,
    current_user: User,
    peer_id: int,
    message_id: int,
) -> PrivateMessage:
    msg = await db.get(PrivateMessage, message_id)
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if current_user.id not in (msg.sender_id, msg.recipient_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    other = msg.recipient_id if msg.sender_id == current_user.id else msg.sender_id
    if other != peer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message does not belong to this conversation",
        )
    return msg


async def ensure_private_peer(
    db: AsyncSession,
    current_user: User,
    peer_id: int,
) -> User:
    if peer_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot use yourself as peer",
        )
    other = await get_user_by_id(db, peer_id)
    if not other or not other.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return other


async def _global_row(db: AsyncSession, user_id: int) -> Optional[GlobalReadState]:
    return await db.get(GlobalReadState, user_id)


async def _private_row(db: AsyncSession, user_id: int, peer_id: int) -> Optional[PrivateReadState]:
    result = await db.execute(
        select(PrivateReadState).where(
            PrivateReadState.user_id == user_id,
            PrivateReadState.peer_id == peer_id,
        )
    )
    return result.scalar_one_or_none()


async def get_global_read_snapshot(db: AsyncSession, user_id: int) -> ReadCursorSnapshot:
    row = await _global_row(db, user_id)
    if row is None:
        return ReadCursorSnapshot(last_read_message_id=None, updated_at=None)
    return ReadCursorSnapshot(
        last_read_message_id=row.last_read_message_id,
        updated_at=row.updated_at,
    )


async def get_private_read_snapshot(db: AsyncSession, user_id: int, peer_id: int) -> ReadCursorSnapshot:
    row = await _private_row(db, user_id, peer_id)
    if row is None:
        return ReadCursorSnapshot(last_read_message_id=None, updated_at=None)
    return ReadCursorSnapshot(
        last_read_message_id=row.last_read_message_id,
        updated_at=row.updated_at,
    )


async def set_global_read_unconditional(db: AsyncSession, user_id: int, message_id: int) -> ReadCursorSnapshot:
    row = await _global_row(db, user_id)
    if row is None:
        row = GlobalReadState(user_id=user_id)
        db.add(row)
    row.last_read_message_id = message_id
    await db.flush()
    await db.refresh(row, attribute_names=["updated_at", "last_read_message_id"])
    return ReadCursorSnapshot(last_read_message_id=row.last_read_message_id, updated_at=row.updated_at)


async def set_private_read_unconditional(
    db: AsyncSession,
    user_id: int,
    peer_id: int,
    message_id: int,
) -> ReadCursorSnapshot:
    row = await _private_row(db, user_id, peer_id)
    if row is None:
        row = PrivateReadState(user_id=user_id, peer_id=peer_id)
        db.add(row)
    row.last_read_message_id = message_id
    await db.flush()
    await db.refresh(row, attribute_names=["updated_at", "last_read_message_id"])
    return ReadCursorSnapshot(last_read_message_id=row.last_read_message_id, updated_at=row.updated_at)


async def set_global_read_monotonic(db: AsyncSession, user_id: int, message_id: int) -> ReadCursorSnapshot:
    row = await _global_row(db, user_id)
    if row is not None:
        stored = row.last_read_message_id
        if stored is not None and message_id <= stored:
            await db.refresh(row, attribute_names=["updated_at", "last_read_message_id"])
            return ReadCursorSnapshot(
                last_read_message_id=row.last_read_message_id,
                updated_at=row.updated_at,
            )
    return await set_global_read_unconditional(db, user_id, message_id)


async def set_private_read_monotonic(
    db: AsyncSession,
    user_id: int,
    peer_id: int,
    message_id: int,
) -> ReadCursorSnapshot:
    row = await _private_row(db, user_id, peer_id)
    if row is not None:
        stored = row.last_read_message_id
        if stored is not None and message_id <= stored:
            await db.refresh(row, attribute_names=["updated_at", "last_read_message_id"])
            return ReadCursorSnapshot(
                last_read_message_id=row.last_read_message_id,
                updated_at=row.updated_at,
            )
    return await set_private_read_unconditional(db, user_id, peer_id, message_id)


async def max_global_message_id(db: AsyncSession) -> Optional[int]:
    result = await db.execute(select(func.max(GlobalMessage.id)))
    return result.scalar_one()


async def max_private_message_id_for_pair(db: AsyncSession, user_id: int, peer_id: int) -> Optional[int]:
    result = await db.execute(
        select(func.max(PrivateMessage.id)).where(
            or_(
                (PrivateMessage.sender_id == user_id) & (PrivateMessage.recipient_id == peer_id),
                (PrivateMessage.sender_id == peer_id) & (PrivateMessage.recipient_id == user_id),
            )
        )
    )
    return result.scalar_one()


async def mark_global_all_read(db: AsyncSession, user_id: int) -> ReadCursorSnapshot:
    max_id = await max_global_message_id(db)
    if max_id is None:
        return await get_global_read_snapshot(db, user_id)
    await get_global_message_or_404(db, max_id)
    return await set_global_read_unconditional(db, user_id, max_id)


async def mark_private_all_read(
    db: AsyncSession,
    current_user: User,
    peer_id: int,
) -> ReadCursorSnapshot:
    max_id = await max_private_message_id_for_pair(db, current_user.id, peer_id)
    if max_id is None:
        return await get_private_read_snapshot(db, current_user.id, peer_id)
    await validate_private_message_for_peer(db, current_user, peer_id, max_id)
    return await set_private_read_unconditional(db, current_user.id, peer_id, max_id)