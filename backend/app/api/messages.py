"""Global and cross-scope message REST (create global, edit/delete with scope, pin)."""

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_moderator_or_admin
from app.db.session import async_session_maker, get_db
from app.models.user import User
from app.models.global_message import MessageType
from app.schemas.message import (
    GlobalMessageCreate,
    GlobalMessageResponse,
    GlobalMessageUpdate,
)
from app.services import permissions
from app.services.message import (
    broadcast_global_deleted,
    broadcast_global_updated,
    broadcast_pin_changed,
    create_global_message,
    delete_global_message,
    CHAT_PAGE_SIZE,
    get_global_messages_before_id,
    get_global_messages_near,
    global_message_to_rest_dict,
    global_message_to_response,
    pin_global_message,
    private_message_to_response,
    private_message_to_rest_dict,
    unpin_global_message,
    update_global_message,
    update_private_message,
    delete_private_message,
    notify_private_event,
)
from app.services.reactions import (
    empty_reactions_dict,
    reactions_dict_global,
    reactions_dict_private,
    reactions_map_global,
)

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/global/history")
async def get_global_history_older(
    before_id: Annotated[int, Query(..., ge=1, description="Load global messages older than this id")],
    limit: int = Query(CHAT_PAGE_SIZE, ge=1, le=100, description="Max messages to return"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Paginated global history: messages strictly before `before_id`, chronological order."""
    if not permissions.can_access_global_feed(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to global chat",
        )
    msgs = await get_global_messages_before_id(db, before_id, limit=limit)
    if not msgs:
        return []
    mids = [m.id for m in msgs]
    rmap = await reactions_map_global(db, mids)
    return [global_message_to_response(m, reactions=rmap.get(m.id)) for m in msgs]


@router.get("/global/context")
async def get_global_message_context(
    message_id: Annotated[int, Query(..., ge=1, description="Anchor global message id")],
    before: int = Query(50, ge=0, le=500, description="Rows before anchor (by id)"),
    after: int = Query(50, ge=0, le=500, description="Rows after anchor (by id)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Load a window of global messages around `message_id` (for jump-to / lazy history)."""
    if not permissions.can_access_global_feed(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to global chat",
        )
    msgs = await get_global_messages_near(db, message_id, before=before, after=after)
    if not msgs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    mids = [m.id for m in msgs]
    rmap = await reactions_map_global(db, mids)
    return [
        global_message_to_response(m, reactions=rmap.get(m.id))
        for m in msgs
    ]


def _http_from_message_exc(exc: Exception) -> HTTPException:
    if isinstance(exc, LookupError):
        if str(exc) == "not_found":
            return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        if str(exc) == "not_pinned":
            return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message is not pinned")
    if isinstance(exc, PermissionError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("", response_model=GlobalMessageResponse)
async def create_global_rest(
    body: GlobalMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not permissions.can_send_global(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Banned from public chat")
    try:
        msg = await create_global_message(
            db,
            current_user.id,
            body.text.strip(),
            body.content_type,
            reply_to_id=body.reply_to_id,
            caption=body.caption,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    await db.commit()
    return GlobalMessageResponse.model_validate(
        global_message_to_rest_dict(msg, reactions=empty_reactions_dict())
    )


@router.put("/{message_id}")
async def update_message(
    message_id: int,
    scope: Annotated[Literal["global", "private"], Query(..., description="global or private")],
    body: GlobalMessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if scope == "global":
        try:
            msg = await update_global_message(
                db,
                message_id,
                current_user,
                body.text.strip(),
                body.content_type,
                new_caption=body.caption,
                apply_caption_change="caption" in body.model_fields_set,
            )
        except (LookupError, PermissionError) as e:
            raise _http_from_message_exc(e) from e
        await db.commit()
        await broadcast_global_updated(msg)
        async with async_session_maker() as s:
            r = await reactions_dict_global(s, msg.id)
            await s.commit()
        return {**global_message_to_rest_dict(msg, reactions=r), "type": "message_updated"}
    try:
        msg = await update_private_message(
            db,
            message_id,
            current_user,
            body.text.strip(),
            body.content_type,
            new_caption=body.caption,
            apply_caption_change="caption" in body.model_fields_set,
        )
    except (LookupError, PermissionError) as e:
        raise _http_from_message_exc(e) from e
    await db.commit()
    async with async_session_maker() as s:
        r = await reactions_dict_private(s, msg.id)
        await s.commit()
    ws_payload = private_message_to_response(
        msg, username=msg.sender.username, message_type="message_updated", reactions=r
    )
    await notify_private_event(ws_payload, [msg.sender_id, msg.recipient_id])
    return {**private_message_to_rest_dict(msg, reactions=r), "type": "message_updated"}


@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    scope: Annotated[Literal["global", "private"], Query(...)],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if scope == "global":
        try:
            await delete_global_message(db, message_id, current_user)
        except (LookupError, PermissionError) as e:
            raise _http_from_message_exc(e) from e
        await db.commit()
        await broadcast_global_deleted(message_id)
        await broadcast_pin_changed(db)
        return {"ok": True, "id": message_id, "scope": "global"}
    try:
        deleted_id, sender_id, recipient_id = await delete_private_message(db, message_id, current_user)
    except (LookupError, PermissionError) as e:
        raise _http_from_message_exc(e) from e
    await db.commit()
    await notify_private_event(
        {"type": "message_deleted", "scope": "private", "id": deleted_id},
        [sender_id, recipient_id],
    )
    return {"ok": True, "id": deleted_id, "scope": "private"}


@router.post("/{message_id}/pin")
async def pin_message(
    message_id: int,
    current_user: User = Depends(require_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        await pin_global_message(db, current_user, message_id)
    except (LookupError, PermissionError) as e:
        raise _http_from_message_exc(e) from e
    await db.commit()
    await broadcast_pin_changed(db)
    return {"ok": True, "pinned_message_id": message_id}


@router.delete("/{message_id}/pin")
async def unpin_message(
    message_id: int,
    current_user: User = Depends(require_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        await unpin_global_message(db, current_user, message_id)
    except (LookupError, PermissionError) as e:
        raise _http_from_message_exc(e) from e
    await db.commit()
    await broadcast_pin_changed(db)
    return {"ok": True, "unpinned_message_id": message_id}
