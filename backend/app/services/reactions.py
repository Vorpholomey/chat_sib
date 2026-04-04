"""Toggle and aggregate message reactions (global + private)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message_reaction import GlobalMessageReaction, PrivateMessageReaction
from app.models.private_message import PrivateMessage

REACTION_KINDS = frozenset({"thumbs_up", "thumbs_down", "heart", "fire", "joy"})
REACTION_KINDS_ORDER = ("thumbs_up", "thumbs_down", "heart", "fire", "joy")


def empty_reactions_dict() -> dict[str, list[int]]:
    return {k: [] for k in REACTION_KINDS_ORDER}


async def reactions_dict_global(db: AsyncSession, message_id: int) -> dict[str, list[int]]:
    result = await db.execute(
        select(GlobalMessageReaction.user_id, GlobalMessageReaction.reaction_kind).where(
            GlobalMessageReaction.message_id == message_id
        )
    )
    out = empty_reactions_dict()
    for uid, kind in result.all():
        if kind in out:
            out[kind].append(uid)
    for k in out:
        out[k] = sorted(set(out[k]))
    return out


async def reactions_dict_private(db: AsyncSession, message_id: int) -> dict[str, list[int]]:
    result = await db.execute(
        select(PrivateMessageReaction.user_id, PrivateMessageReaction.reaction_kind).where(
            PrivateMessageReaction.message_id == message_id
        )
    )
    out = empty_reactions_dict()
    for uid, kind in result.all():
        if kind in out:
            out[kind].append(uid)
    for k in out:
        out[k] = sorted(set(out[k]))
    return out


async def reactions_map_global(db: AsyncSession, message_ids: list[int]) -> dict[int, dict[str, list[int]]]:
    if not message_ids:
        return {}
    result = await db.execute(
        select(
            GlobalMessageReaction.message_id,
            GlobalMessageReaction.user_id,
            GlobalMessageReaction.reaction_kind,
        ).where(GlobalMessageReaction.message_id.in_(message_ids))
    )
    by_mid: dict[int, dict[str, list[int]]] = {mid: empty_reactions_dict() for mid in message_ids}
    for mid, uid, kind in result.all():
        if mid in by_mid and kind in by_mid[mid]:
            by_mid[mid][kind].append(uid)
    for mid in by_mid:
        for k in by_mid[mid]:
            by_mid[mid][k] = sorted(set(by_mid[mid][k]))
    return by_mid


async def reactions_map_private(db: AsyncSession, message_ids: list[int]) -> dict[int, dict[str, list[int]]]:
    if not message_ids:
        return {}
    result = await db.execute(
        select(
            PrivateMessageReaction.message_id,
            PrivateMessageReaction.user_id,
            PrivateMessageReaction.reaction_kind,
        ).where(PrivateMessageReaction.message_id.in_(message_ids))
    )
    by_mid: dict[int, dict[str, list[int]]] = {mid: empty_reactions_dict() for mid in message_ids}
    for mid, uid, kind in result.all():
        if mid in by_mid and kind in by_mid[mid]:
            by_mid[mid][kind].append(uid)
    for mid in by_mid:
        for k in by_mid[mid]:
            by_mid[mid][k] = sorted(set(by_mid[mid][k]))
    return by_mid


async def toggle_global_reaction(
    db: AsyncSession, user_id: int, message_id: int, kind: str
) -> dict[str, list[int]]:
    if kind not in REACTION_KINDS:
        raise ValueError("invalid reaction kind")
    from app.models.global_message import GlobalMessage

    gid = await db.execute(select(GlobalMessage.id).where(GlobalMessage.id == message_id))
    if gid.scalar_one_or_none() is None:
        raise LookupError("not_found")
    result = await db.execute(
        select(GlobalMessageReaction).where(
            GlobalMessageReaction.message_id == message_id,
            GlobalMessageReaction.user_id == user_id,
            GlobalMessageReaction.reaction_kind == kind,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
    else:
        db.add(GlobalMessageReaction(message_id=message_id, user_id=user_id, reaction_kind=kind))
    await db.flush()
    return await reactions_dict_global(db, message_id)


async def toggle_private_reaction(
    db: AsyncSession, user_id: int, message_id: int, kind: str
) -> tuple[dict[str, list[int]], int, int]:
    if kind not in REACTION_KINDS:
        raise ValueError("invalid reaction kind")
    msg_result = await db.execute(select(PrivateMessage).where(PrivateMessage.id == message_id))
    msg = msg_result.scalar_one_or_none()
    if not msg:
        raise LookupError("not_found")
    if user_id not in (msg.sender_id, msg.recipient_id):
        raise PermissionError("forbidden")
    result = await db.execute(
        select(PrivateMessageReaction).where(
            PrivateMessageReaction.message_id == message_id,
            PrivateMessageReaction.user_id == user_id,
            PrivateMessageReaction.reaction_kind == kind,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
    else:
        db.add(PrivateMessageReaction(message_id=message_id, user_id=user_id, reaction_kind=kind))
    await db.flush()
    rd = await reactions_dict_private(db, message_id)
    return rd, msg.sender_id, msg.recipient_id
