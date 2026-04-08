"""Persisted last-read message pointers for global and private chats."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.global_message import GlobalMessage
from app.models.global_read_state import GlobalReadState
from app.models.private_message import PrivateMessage
from app.models.private_read_state import PrivateReadState
from app.models.user import User
from app.schemas.read_state import (
    PatchGlobalReadStateBody,
    PatchPrivateReadStateBody,
    ReadStateResponse,
)
from app.services import permissions
from app.services.user import get_user_by_id

router = APIRouter(prefix="/read-state", tags=["read-state"])


async def _require_global_feed(user: User) -> None:
    if not permissions.can_access_global_feed(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No access to global chat",
        )


async def _get_global_message_or_404(db: AsyncSession, message_id: int) -> GlobalMessage:
    msg = await db.get(GlobalMessage, message_id)
    if msg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    return msg


async def _validate_private_message_for_peer(
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


@router.get("/global", response_model=ReadStateResponse)
async def get_global_read_state(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadStateResponse:
    await _require_global_feed(current_user)
    row = await db.get(GlobalReadState, current_user.id)
    return ReadStateResponse(
        last_read_message_id=row.last_read_message_id if row else None,
    )


@router.patch("/global", response_model=ReadStateResponse)
async def patch_global_read_state(
    body: PatchGlobalReadStateBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadStateResponse:
    await _require_global_feed(current_user)
    await _get_global_message_or_404(db, body.last_read_message_id)
    row = await db.get(GlobalReadState, current_user.id)
    if row is None:
        row = GlobalReadState(user_id=current_user.id)
        db.add(row)
    row.last_read_message_id = body.last_read_message_id
    await db.flush()
    return ReadStateResponse(last_read_message_id=row.last_read_message_id)


@router.get("/private", response_model=ReadStateResponse)
async def get_private_read_state(
    peer_id: Annotated[int, Query(..., ge=1, description="The other user in the DM")],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadStateResponse:
    if peer_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot use yourself as peer",
        )
    other = await get_user_by_id(db, peer_id)
    if not other or not other.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    result = await db.execute(
        select(PrivateReadState).where(
            PrivateReadState.user_id == current_user.id,
            PrivateReadState.peer_id == peer_id,
        )
    )
    row = result.scalar_one_or_none()
    return ReadStateResponse(
        last_read_message_id=row.last_read_message_id if row else None,
    )


@router.patch("/private", response_model=ReadStateResponse)
async def patch_private_read_state(
    body: PatchPrivateReadStateBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReadStateResponse:
    if body.peer_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot use yourself as peer",
        )
    other = await get_user_by_id(db, body.peer_id)
    if not other or not other.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await _validate_private_message_for_peer(db, current_user, body.peer_id, body.last_read_message_id)
    result = await db.execute(
        select(PrivateReadState).where(
            PrivateReadState.user_id == current_user.id,
            PrivateReadState.peer_id == body.peer_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = PrivateReadState(user_id=current_user.id, peer_id=body.peer_id)
        db.add(row)
    row.last_read_message_id = body.last_read_message_id
    await db.flush()
    return ReadStateResponse(last_read_message_id=row.last_read_message_id)
