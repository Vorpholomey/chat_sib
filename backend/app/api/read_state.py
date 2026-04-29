"""Persisted last-read message pointers for global and private chats."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_full_chat_access
from app.db.session import get_db
from app.models.user import User
from app.schemas.read_state import (
    PatchGlobalReadStateBody,
    PatchPrivateReadStateBody,
    ReadStateResponse,
)
from app.services import read_state_service as rs

router = APIRouter(prefix="/read-state", tags=["read-state"])


@router.get("/global", response_model=ReadStateResponse)
async def get_global_read_state(
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
) -> ReadStateResponse:
    await rs.require_global_feed(current_user)
    snap = await rs.get_global_read_snapshot(db, current_user.id)
    return ReadStateResponse(last_read_message_id=snap.last_read_message_id)


@router.patch("/global", response_model=ReadStateResponse)
async def patch_global_read_state(
    body: PatchGlobalReadStateBody,
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
) -> ReadStateResponse:
    await rs.require_global_feed(current_user)
    await rs.get_global_message_or_404(db, body.last_read_message_id)
    snap = await rs.set_global_read_unconditional(db, current_user.id, body.last_read_message_id)
    return ReadStateResponse(last_read_message_id=snap.last_read_message_id)


@router.get("/private", response_model=ReadStateResponse)
async def get_private_read_state(
    peer_id: Annotated[int, Query(..., ge=1, description="The other user in the DM")],
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
) -> ReadStateResponse:
    await rs.ensure_private_peer(db, current_user, peer_id)
    snap = await rs.get_private_read_snapshot(db, current_user.id, peer_id)
    return ReadStateResponse(last_read_message_id=snap.last_read_message_id)


@router.patch("/private", response_model=ReadStateResponse)
async def patch_private_read_state(
    body: PatchPrivateReadStateBody,
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
) -> ReadStateResponse:
    await rs.ensure_private_peer(db, current_user, body.peer_id)
    await rs.validate_private_message_for_peer(
        db,
        current_user,
        body.peer_id,
        body.last_read_message_id,
    )
    snap = await rs.set_private_read_unconditional(
        db,
        current_user.id,
        body.peer_id,
        body.last_read_message_id,
    )
    return ReadStateResponse(last_read_message_id=snap.last_read_message_id)
