"""Private messaging REST: conversations list and message history."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.schemas.message import (
    ConversationItem,
    ConversationList,
    PrivateMessageResponse,
)
from app.services.message import get_conversations, get_private_messages
from app.services.user import get_user_by_id

router = APIRouter(prefix="/api/private", tags=["private"])


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Current user profile. Private message history is at GET /api/private/conversations."""
    return UserResponse.model_validate(current_user)


@router.get("/conversations", response_model=ConversationList)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List dialogues for current user with last message and time."""
    conversations = await get_conversations(db, current_user.id)
    return ConversationList(conversations=conversations)


@router.get("/messages/{user_id}", response_model=list[PrivateMessageResponse])
async def get_messages_with_user(
    user_id: int,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Message history with a specific user (pagination, newest first)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot get messages with yourself")
    other = await get_user_by_id(db, user_id)
    if not other:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    messages = await get_private_messages(db, current_user.id, user_id, skip=skip, limit=limit)
    return [PrivateMessageResponse.model_validate(m) for m in reversed(messages)]
