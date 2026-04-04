"""Message services: global and private messages, conversations, pin, moderation hooks."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import desc, select, or_, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.websocket_manager import ws_manager
from app.db.session import async_session_maker
from app.models.chat_settings import ChatSettings
from app.models.user import User, UserRole
from app.models.global_message import GlobalMessage, MessageType
from app.models.private_message import PrivateMessage
from app.services import permissions
from app.services.audit import log_action
from app.services.reactions import reactions_dict_global, reactions_dict_private
from app.schemas.message import (
    ConversationItem,
    ConversationInterlocutor,
)

GLOBAL_CHAT_LIMIT = 1000

_AUDIT_GLOBAL_EDIT = "global_message_edit"
_AUDIT_GLOBAL_DELETE = "global_message_delete"
_AUDIT_PRIVATE_EDIT = "private_message_edit"
_AUDIT_PRIVATE_DELETE = "private_message_delete"
_AUDIT_PIN_SET = "pin_set"
_AUDIT_PIN_REMOVE = "pin_remove"


async def get_or_create_chat_settings(db: AsyncSession) -> ChatSettings:
    result = await db.execute(select(ChatSettings).where(ChatSettings.id == 1))
    row = result.scalar_one_or_none()
    if row:
        return row
    row = ChatSettings(id=1)
    db.add(row)
    await db.flush()
    return row


async def get_last_global_messages(db: AsyncSession, limit: int = GLOBAL_CHAT_LIMIT) -> list[GlobalMessage]:
    result = await db.execute(
        select(GlobalMessage)
        .options(
            selectinload(GlobalMessage.user),
            selectinload(GlobalMessage.reply_to).selectinload(GlobalMessage.user),
        )
        .order_by(desc(GlobalMessage.created_at))
        .limit(limit)
    )
    messages = list(result.scalars().all())
    messages.reverse()
    return messages


async def get_global_message_by_id(db: AsyncSession, message_id: int) -> Optional[GlobalMessage]:
    result = await db.execute(
        select(GlobalMessage)
        .where(GlobalMessage.id == message_id)
        .options(
            selectinload(GlobalMessage.user),
            selectinload(GlobalMessage.reply_to).selectinload(GlobalMessage.user),
        )
    )
    return result.scalar_one_or_none()


async def get_private_message_by_id(db: AsyncSession, message_id: int) -> Optional[PrivateMessage]:
    result = await db.execute(
        select(PrivateMessage)
        .where(PrivateMessage.id == message_id)
        .options(
            selectinload(PrivateMessage.sender),
            selectinload(PrivateMessage.recipient),
            selectinload(PrivateMessage.reply_to).selectinload(PrivateMessage.sender),
        )
    )
    return result.scalar_one_or_none()


def _reply_preview_global(msg: GlobalMessage) -> Optional[dict[str, Any]]:
    if not msg.reply_to:
        return None
    u = msg.reply_to.user
    return {
        "id": msg.reply_to.id,
        "user_id": msg.reply_to.user_id,
        "username": u.username if u else None,
        "text": (msg.reply_to.content or "")[:500],
        "content_type": msg.reply_to.message_type.value,
    }


def _reply_preview_private(msg: PrivateMessage) -> Optional[dict[str, Any]]:
    if not msg.reply_to:
        return None
    s = msg.reply_to.sender
    return {
        "id": msg.reply_to.id,
        "sender_id": msg.reply_to.sender_id,
        "username": s.username if s else None,
        "text": (msg.reply_to.content or "")[:500],
        "content_type": msg.reply_to.message_type.value,
    }


def global_message_to_rest_dict(
    msg: GlobalMessage, *, reactions: Optional[dict[str, list[int]]] = None
) -> dict[str, Any]:
    """REST-friendly dict with datetimes (not ISO strings)."""
    out: dict[str, Any] = {
        "id": msg.id,
        "user_id": msg.user_id,
        "username": msg.user.username if msg.user else "",
        "text": msg.content,
        "content_type": msg.message_type,
        "created_at": msg.created_at,
        "edited_at": msg.edited_at,
        "reply_to_id": msg.reply_to_id,
        "reply_to": _reply_preview_global(msg),
    }
    if reactions is not None:
        out["reactions"] = reactions
    return out


def private_message_to_rest_dict(
    msg: PrivateMessage, *, reactions: Optional[dict[str, list[int]]] = None
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "recipient_id": msg.recipient_id,
        "content": msg.content,
        "message_type": msg.message_type,
        "is_read": msg.is_read,
        "created_at": msg.created_at,
        "edited_at": msg.edited_at,
        "reply_to_id": msg.reply_to_id,
        "reply_to": _reply_preview_private(msg),
    }
    if reactions is not None:
        out["reactions"] = reactions
    return out


def global_message_to_response(
    msg: GlobalMessage,
    *,
    message_type: str = "message",
    reactions: Optional[dict[str, list[int]]] = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "type": message_type,
        "id": msg.id,
        "user_id": msg.user_id,
        "username": msg.user.username if msg.user else None,
        "text": msg.content,
        "content_type": msg.message_type.value,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "reply_to_id": msg.reply_to_id,
        "reply_to": _reply_preview_global(msg),
    }
    if reactions is not None:
        out["reactions"] = reactions
    return out


def private_message_to_response(
    msg: PrivateMessage,
    *,
    username: Optional[str] = None,
    message_type: str = "message",
    reactions: Optional[dict[str, list[int]]] = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "type": message_type,
        "id": msg.id,
        "sender_id": msg.sender_id,
        "recipient_id": msg.recipient_id,
        "content": msg.content,
        "message_type": msg.message_type.value,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "reply_to_id": msg.reply_to_id,
        "reply_to": _reply_preview_private(msg),
    }
    if username is not None:
        out["username"] = username
    if reactions is not None:
        out["reactions"] = reactions
    return out


async def create_global_message(
    db: AsyncSession,
    user_id: int,
    content: str,
    message_type: MessageType = MessageType.text,
    reply_to_id: Optional[int] = None,
) -> GlobalMessage:
    if reply_to_id is not None:
        parent = await get_global_message_by_id(db, reply_to_id)
        if not parent:
            raise ValueError("reply_to_id not found")
    msg = GlobalMessage(
        user_id=user_id,
        content=content,
        message_type=message_type,
        reply_to_id=reply_to_id,
    )
    db.add(msg)
    await db.flush()
    loaded = await get_global_message_by_id(db, msg.id)
    if not loaded:
        raise RuntimeError("failed to load global message after insert")
    return loaded


async def create_private_message(
    db: AsyncSession,
    sender_id: int,
    recipient_id: int,
    content: str,
    message_type: MessageType = MessageType.text,
    reply_to_id: Optional[int] = None,
) -> PrivateMessage:
    if reply_to_id is not None:
        parent = await get_private_message_by_id(db, reply_to_id)
        if not parent:
            raise ValueError("reply_to_id not found")
        participants = {parent.sender_id, parent.recipient_id}
        if sender_id not in participants or recipient_id not in participants:
            raise ValueError("reply does not belong to this conversation")
    msg = PrivateMessage(
        sender_id=sender_id,
        recipient_id=recipient_id,
        content=content,
        message_type=message_type,
        reply_to_id=reply_to_id,
    )
    db.add(msg)
    await db.flush()
    loaded = await get_private_message_by_id(db, msg.id)
    if not loaded:
        raise RuntimeError("failed to load private message after insert")
    return loaded


async def update_global_message(
    db: AsyncSession,
    message_id: int,
    actor: User,
    new_text: str,
    new_type: MessageType,
) -> GlobalMessage:
    msg = await get_global_message_by_id(db, message_id)
    if not msg:
        raise LookupError("not_found")
    author = msg.user
    if not author:
        raise LookupError("not_found")
    if not permissions.can_edit_global_message(actor, author):
        raise PermissionError("forbidden")

    old_preview = {"content": msg.content[:500], "message_type": msg.message_type.value}
    msg.content = new_text
    msg.message_type = new_type
    msg.edited_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(msg, attribute_names=["user", "reply_to"])
    if msg.reply_to_id and msg.reply_to:
        await db.refresh(msg.reply_to, attribute_names=["user"])

    if actor.id != author.id:
        await log_action(
            db,
            actor_id=actor.id,
            action=_AUDIT_GLOBAL_EDIT,
            target_type="global_message",
            target_id=msg.id,
            metadata={"author_id": author.id, "previous": old_preview},
        )
    return msg


async def delete_global_message(db: AsyncSession, message_id: int, actor: User) -> None:
    msg = await get_global_message_by_id(db, message_id)
    if not msg:
        raise LookupError("not_found")
    author = msg.user
    if not author:
        raise LookupError("not_found")
    if not permissions.can_delete_global_message(actor, author):
        raise PermissionError("forbidden")

    settings = await get_or_create_chat_settings(db)
    if settings.pinned_message_id == msg.id:
        settings.pinned_message_id = None

    if actor.id != author.id:
        await log_action(
            db,
            actor_id=actor.id,
            action=_AUDIT_GLOBAL_DELETE,
            target_type="global_message",
            target_id=msg.id,
            metadata={"author_id": author.id},
        )

    await db.execute(delete(GlobalMessage).where(GlobalMessage.id == message_id))


async def update_private_message(
    db: AsyncSession,
    message_id: int,
    actor: User,
    new_text: str,
    new_type: MessageType,
) -> PrivateMessage:
    msg = await get_private_message_by_id(db, message_id)
    if not msg:
        raise LookupError("not_found")
    sender = msg.sender
    if not sender:
        raise LookupError("not_found")
    if actor.role != UserRole.admin and actor.id not in (msg.sender_id, msg.recipient_id):
        raise PermissionError("forbidden")
    if not permissions.can_edit_private_message(actor, sender):
        raise PermissionError("forbidden")

    old_preview = {"content": msg.content[:500], "message_type": msg.message_type.value}
    msg.content = new_text
    msg.message_type = new_type
    msg.edited_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(msg, attribute_names=["sender", "recipient", "reply_to"])
    if msg.reply_to_id and msg.reply_to:
        await db.refresh(msg.reply_to, attribute_names=["sender"])

    if actor.id != sender.id:
        await log_action(
            db,
            actor_id=actor.id,
            action=_AUDIT_PRIVATE_EDIT,
            target_type="private_message",
            target_id=msg.id,
            metadata={"sender_id": sender.id, "previous": old_preview},
        )
    return msg


async def delete_private_message(db: AsyncSession, message_id: int, actor: User) -> tuple[PrivateMessage, User, User]:
    msg = await get_private_message_by_id(db, message_id)
    if not msg:
        raise LookupError("not_found")
    sender = msg.sender
    recipient = msg.recipient
    if not sender or not recipient:
        raise LookupError("not_found")
    if actor.role != UserRole.admin and actor.id not in (msg.sender_id, msg.recipient_id):
        raise PermissionError("forbidden")
    if not permissions.can_delete_private_message(actor, sender):
        raise PermissionError("forbidden")

    if actor.id != sender.id:
        await log_action(
            db,
            actor_id=actor.id,
            action=_AUDIT_PRIVATE_DELETE,
            target_type="private_message",
            target_id=msg.id,
            metadata={"sender_id": sender.id},
        )

    deleted_id = msg.id
    sender_id = msg.sender_id
    recipient_id = msg.recipient_id
    await db.delete(msg)
    await db.flush()
    return deleted_id, sender_id, recipient_id


async def get_pinned_message_payload(db: AsyncSession) -> dict[str, Any]:
    settings = await get_or_create_chat_settings(db)
    if not settings.pinned_message_id:
        return {"pinned_message_id": None, "pinned_message": None}
    msg = await get_global_message_by_id(db, settings.pinned_message_id)
    if not msg:
        settings.pinned_message_id = None
        await db.flush()
        return {"pinned_message_id": None, "pinned_message": None}
    r = await reactions_dict_global(db, msg.id)
    return {
        "pinned_message_id": msg.id,
        "pinned_message": global_message_to_response(msg, message_type="message", reactions=r),
    }


async def pin_global_message(db: AsyncSession, actor: User, message_id: int) -> GlobalMessage:
    if not permissions.can_pin(actor):
        raise PermissionError("forbidden")
    msg = await get_global_message_by_id(db, message_id)
    if not msg:
        raise LookupError("not_found")
    settings = await get_or_create_chat_settings(db)
    settings.pinned_message_id = msg.id
    await db.flush()
    await log_action(
        db,
        actor_id=actor.id,
        action=_AUDIT_PIN_SET,
        target_type="global_message",
        target_id=msg.id,
        metadata=None,
    )
    return msg


async def unpin_global_message(db: AsyncSession, actor: User, message_id: int) -> None:
    if not permissions.can_pin(actor):
        raise PermissionError("forbidden")
    settings = await get_or_create_chat_settings(db)
    if settings.pinned_message_id != message_id:
        raise LookupError("not_pinned")
    settings.pinned_message_id = None
    await db.flush()
    await log_action(
        db,
        actor_id=actor.id,
        action=_AUDIT_PIN_REMOVE,
        target_type="global_message",
        target_id=message_id,
        metadata=None,
    )


async def broadcast_pin_changed(db: AsyncSession) -> None:
    payload = await get_pinned_message_payload(db)
    payload["type"] = "pin_changed"
    await ws_manager.broadcast(payload)


async def broadcast_global_updated(msg: GlobalMessage) -> None:
    async with async_session_maker() as db:
        r = await reactions_dict_global(db, msg.id)
        await ws_manager.broadcast(
            global_message_to_response(msg, message_type="message_updated", reactions=r)
        )
        await db.commit()


async def broadcast_global_deleted(message_id: int) -> None:
    await ws_manager.broadcast({"type": "message_deleted", "scope": "global", "id": message_id})


async def notify_private_event(payload: dict[str, Any], user_ids: list[int]) -> None:
    for uid in set(user_ids):
        await ws_manager.send_personal(uid, payload)


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
    result = await db.execute(select(union).order_by(desc(union.c.last_at)))
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
        .options(
            selectinload(PrivateMessage.sender),
            selectinload(PrivateMessage.recipient),
            selectinload(PrivateMessage.reply_to).selectinload(PrivateMessage.sender),
        )
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
