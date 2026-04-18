"""Private messaging REST: conversations list and message history."""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_full_chat_access
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.schemas.message import (
    ConversationItem,
    ConversationList,
    PrivateMessageCreate,
    PrivateMessageResponse,
)
from app.services.message import (
    CHAT_PAGE_SIZE,
    create_private_message,
    get_conversations,
    get_private_messages,
    get_private_messages_before_id,
    get_private_messages_near,
    notify_private_event,
    private_message_to_response,
    private_message_to_rest_dict,
    search_private_message_ids,
)
from app.services.reactions import empty_reactions_dict, reactions_map_private
from app.services.user import get_user_by_id

router = APIRouter(prefix="/api/private", tags=["private"])


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Current user profile. Private message history is at GET /api/private/conversations."""
    return UserResponse.model_validate(current_user)


@router.get("/conversations", response_model=ConversationList)
async def list_conversations(
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
):
    """List dialogues for current user with last message and time."""
    conversations = await get_conversations(db, current_user.id)
    return ConversationList(conversations=conversations)


@router.post("/messages", response_model=PrivateMessageResponse)
async def create_private_message_rest(
    body: PrivateMessageCreate,
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
):
    """Create a private message (same rules as WebSocket; public-ban does not block DMs)."""
    if body.recipient_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot send a message to yourself")
    other = await get_user_by_id(db, body.recipient_id)
    if not other or not other.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    try:
        msg = await create_private_message(
            db,
            current_user.id,
            body.recipient_id,
            body.text.strip(),
            body.content_type,
            reply_to_id=body.reply_to_id,
            caption=body.caption,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    await db.commit()
    ws_payload = private_message_to_response(
        msg,
        username=msg.sender.username if msg.sender else current_user.username,
        reactions=empty_reactions_dict(),
    )
    await notify_private_event(ws_payload, [msg.sender_id, msg.recipient_id])
    return PrivateMessageResponse.model_validate(
        private_message_to_rest_dict(msg, reactions=empty_reactions_dict())
    )


@router.get("/messages/{user_id}/search", response_model=dict[str, list[int]])
async def search_messages_with_user(
    user_id: int,
    q: Annotated[str, Query(..., min_length=1, max_length=200, description="Substring to match")],
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
):
    """Full thread search (message ids only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot search messages with yourself")
    other = await get_user_by_id(db, user_id)
    if not other:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    ids = await search_private_message_ids(db, current_user.id, user_id, q.strip())
    return {"ids": ids}


@router.get("/messages/{user_id}/context", response_model=list[PrivateMessageResponse])
async def get_private_message_context(
    user_id: int,
    message_id: Annotated[int, Query(..., ge=1, description="Anchor message id")],
    before: Annotated[int, Query(ge=0, le=500)] = 50,
    after: Annotated[int, Query(ge=0, le=500)] = 50,
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
):
    """Load a window of private messages around `message_id` (jump-to / search navigation)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot load context with yourself")
    other = await get_user_by_id(db, user_id)
    if not other:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    msgs = await get_private_messages_near(
        db, current_user.id, user_id, message_id, before=before, after=after
    )
    if not msgs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    ids = [m.id for m in msgs]
    rmap = await reactions_map_private(db, ids)
    return [
        PrivateMessageResponse.model_validate(
            private_message_to_rest_dict(m, reactions=rmap.get(m.id))
        )
        for m in msgs
    ]


@router.get("/messages/{user_id}", response_model=list[PrivateMessageResponse])
async def get_messages_with_user(
    user_id: int,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = CHAT_PAGE_SIZE,
    before_id: Annotated[Optional[int], Query(ge=1, description="Load only messages older than this id")] = None,
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
):
    """Message history with a specific user: chronological order, newest page by default or older via `before_id`."""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot get messages with yourself")
    other = await get_user_by_id(db, user_id)
    if not other:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if before_id is not None:
        messages = await get_private_messages_before_id(
            db, current_user.id, user_id, before_id, limit=limit
        )
    else:
        messages = await get_private_messages(db, current_user.id, user_id, skip=skip, limit=limit)
    ids = [m.id for m in messages]
    rmap = await reactions_map_private(db, ids)
    return [
        PrivateMessageResponse.model_validate(
            private_message_to_rest_dict(m, reactions=rmap.get(m.id))
        )
        for m in reversed(messages)
    ]
