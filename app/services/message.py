"""Message services: global and private messages, conversations."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import desc, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.global_message import GlobalMessage, MessageType
from app.models.private_message import PrivateMessage
from app.schemas.message import (
    GlobalMessageResponse,
    PrivateMessageResponse,
    ConversationItem,
    ConversationInterlocutor,
)


GLOBAL_CHAT_LIMIT = 1000


async def get_last_global_messages(db: AsyncSession, limit: int = GLOBAL_CHAT_LIMIT) -> list[GlobalMessage]:
    result = await db.execute(
        select(GlobalMessage)
        .options(selectinload(GlobalMessage.user))
        .order_by(desc(GlobalMessage.created_at))
        .limit(limit)
    )
    messages = list(result.scalars().all())
    messages.reverse()
    return messages


async def create_global_message(
    db: AsyncSession,
    user_id: int,
    content: str,
    message_type: MessageType = MessageType.text,
) -> GlobalMessage:
    msg = GlobalMessage(user_id=user_id, content=content, message_type=message_type)
    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    await db.refresh(msg, ["user"])
    return msg


def global_message_to_response(msg: GlobalMessage) -> dict:
    return {
        "id": msg.id,
        "user_id": msg.user_id,
        "username": msg.user.username,
        "text": msg.content,
        "content_type": msg.message_type.value,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


async def get_conversations(db: AsyncSession, current_user_id: int) -> list[ConversationItem]:
    """Dialogues for current user: interlocutor + last message + time."""
    sent = select(
        PrivateMessage.recipient_id.label("other_id"),
        PrivateMessage.content.label("last_content"),
        PrivateMessage.created_at.label("last_at"),
    ).where(PrivateMessage.sender_id == current_user_id)
    received = select(
        PrivateMessage.sender_id.label("other_id"),
        PrivateMessage.content.label("last_content"),
        PrivateMessage.created_at.label("last_at"),
    ).where(PrivateMessage.recipient_id == current_user_id)
    union = sent.union_all(received).subquery()
    # Order by last_at desc and in Python take first occurrence per other_id
    result = await db.execute(
        select(union).order_by(desc(union.c.last_at))
    )
    rows = result.all()
    seen: set[int] = set()
    by_other: dict[int, tuple[str, datetime]] = {}
    for r in rows:
        if r.other_id not in seen:
            seen.add(r.other_id)
            by_other[r.other_id] = (r.last_content, r.last_at)
    other_ids = list(by_other.keys())
    if not other_ids:
        return []
    users_result = await db.execute(select(User).where(User.id.in_(other_ids)))
    users = {u.id: u for u in users_result.scalars().all()}
    items = []
    for other_id in other_ids:
        u = users.get(other_id)
        if not u or not u.is_active:
            continue
        last_content, last_at = by_other[other_id]
        items.append(
            ConversationItem(
                interlocutor=ConversationInterlocutor(id=u.id, username=u.username),
                last_message=last_content,
                last_message_at=last_at,
            )
        )
    items.sort(key=lambda x: (x.last_message_at or datetime.min.replace(tzinfo=timezone.utc)), reverse=True)
    return items


async def get_private_messages(
    db: AsyncSession,
    current_user_id: int,
    other_user_id: int,
    skip: int = 0,
    limit: int = 50,
) -> list[PrivateMessage]:
    """Messages between current user and other_user, newest first, then paginated."""
    result = await db.execute(
        select(PrivateMessage)
        .where(
            or_(
                and_(PrivateMessage.sender_id == current_user_id, PrivateMessage.recipient_id == other_user_id),
                and_(PrivateMessage.sender_id == other_user_id, PrivateMessage.recipient_id == current_user_id),
            )
        )
        .order_by(desc(PrivateMessage.created_at))
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def create_private_message(
    db: AsyncSession,
    sender_id: int,
    recipient_id: int,
    content: str,
    message_type: MessageType = MessageType.text,
) -> PrivateMessage:
    msg = PrivateMessage(
        sender_id=sender_id,
        recipient_id=recipient_id,
        content=content,
        message_type=message_type,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    await db.refresh(msg, ["sender", "recipient"])
    return msg


def private_message_to_response(msg: PrivateMessage) -> dict:
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "recipient_id": msg.recipient_id,
        "content": msg.content,
        "message_type": msg.message_type.value,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }
