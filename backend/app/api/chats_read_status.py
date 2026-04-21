"""REST read cursor under /api/chats/{chat_id}/… (global or DM peer id)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_full_chat_access
from app.db.session import get_db
from app.models.user import User
from app.schemas.read_state import ChatReadStatusResponse, PostChatReadStatusBody
from app.services import read_state_service as rs

router = APIRouter(prefix="/chats", tags=["chats"])


def _snapshot_to_response(s: rs.ReadCursorSnapshot) -> ChatReadStatusResponse:
    return ChatReadStatusResponse(
        last_read_message_id=s.last_read_message_id,
        updated_at=s.updated_at,
    )


@router.get("/{chat_id}/read-status", response_model=ChatReadStatusResponse)
async def get_chat_read_status(
    chat_id: str,
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
) -> ChatReadStatusResponse:
    parsed = rs.parse_chat_path_id(chat_id)
    if isinstance(parsed, rs.GlobalChatRef):
        await rs.require_global_feed(current_user)
        snap = await rs.get_global_read_snapshot(db, current_user.id)
    else:
        await rs.ensure_private_peer(db, current_user, parsed.peer_id)
        snap = await rs.get_private_read_snapshot(db, current_user.id, parsed.peer_id)
    return _snapshot_to_response(snap)


@router.post("/{chat_id}/read-status", response_model=ChatReadStatusResponse)
async def post_chat_read_status(
    chat_id: str,
    body: PostChatReadStatusBody,
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
) -> ChatReadStatusResponse:
    parsed = rs.parse_chat_path_id(chat_id)
    if isinstance(parsed, rs.GlobalChatRef):
        await rs.require_global_feed(current_user)
        await rs.get_global_message_or_404(db, body.last_read_message_id)
        snap = await rs.set_global_read_monotonic(db, current_user.id, body.last_read_message_id)
    else:
        await rs.ensure_private_peer(db, current_user, parsed.peer_id)
        await rs.validate_private_message_for_peer(
            db,
            current_user,
            parsed.peer_id,
            body.last_read_message_id,
        )
        snap = await rs.set_private_read_monotonic(
            db,
            current_user.id,
            parsed.peer_id,
            body.last_read_message_id,
        )
    return _snapshot_to_response(snap)


@router.post("/{chat_id}/mark-all-read", response_model=ChatReadStatusResponse)
async def post_mark_all_read(
    chat_id: str,
    current_user: User = Depends(require_full_chat_access),
    db: AsyncSession = Depends(get_db),
) -> ChatReadStatusResponse:
    parsed = rs.parse_chat_path_id(chat_id)
    if isinstance(parsed, rs.GlobalChatRef):
        await rs.require_global_feed(current_user)
        snap = await rs.mark_global_all_read(db, current_user.id)
    else:
        await rs.ensure_private_peer(db, current_user, parsed.peer_id)
        snap = await rs.mark_private_all_read(db, current_user, parsed.peer_id)
    return _snapshot_to_response(snap)
