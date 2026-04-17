"""WebSocket: global chat and private messages. JWT via query param or header."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.core.websocket_manager import ws_manager
from app.db.session import async_session_maker
from app.models.user import User
from app.models.global_message import MessageType
from app.services import permissions
from app.services.message import (
    CHAT_PAGE_SIZE,
    get_last_global_messages,
    create_global_message,
    create_private_message,
    get_private_message_by_id,
    global_message_to_response,
    private_message_to_response,
    get_pinned_message_payload,
)
from app.services.reactions import (
    reactions_dict_global,
    reactions_dict_private,
    reactions_map_global,
    toggle_global_reaction,
    toggle_private_reaction,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


def _ws_value_error_client_message(exc: ValueError) -> str:
    """Avoid leaking internal validation details to WebSocket clients."""
    msg = str(exc)
    if any(
        msg.startswith(p)
        for p in (
            "Message ",
            "reply_to_id",
            "reply does not",
            "invalid reaction",
            "Image URL",
            "Caption",
        )
    ):
        return msg
    return "Invalid request"


async def _load_active_user(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    return result.scalar_one_or_none()


async def get_user_from_token(token: Optional[str]) -> Optional[User]:
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access" or "sub" not in payload:
        return None
    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        return None
    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
        user = result.scalar_one_or_none()
    return user


@router.websocket("/ws/chat")
async def websocket_global_chat(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """Single WebSocket for global chat and private messages.
    - Connect: ?token=JWT. Permanently banned accounts cannot connect. Pin state + global history after connect.
    - Global: { "text", "content_type"?, "reply_to_id"? } — blocked if public-banned.
    - Private: { "text", "content_type"?, "recipient_id", "reply_to_id"? }.
    - Outgoing events use a `type` field: message, message_updated, message_deleted, pin_changed.
    """
    auth_token = token
    if not auth_token and websocket.headers.get("authorization"):
        raw = websocket.headers["authorization"]
        if raw.startswith("Bearer "):
            auth_token = raw[7:]
    user = await get_user_from_token(auth_token)
    if not user:
        await websocket.close(code=4001, reason="Invalid or missing token")
        return
    if user.public_ban_permanent:
        await websocket.close(code=4003, reason="Account permanently banned")
        return

    receive_global = permissions.can_access_global_feed(user)
    await ws_manager.connect(websocket, user.id, receive_global=receive_global)

    try:
        if receive_global:
            async with async_session_maker() as db:
                try:
                    pin_payload = await get_pinned_message_payload(db)
                    pin_payload["type"] = "pin_changed"
                    await websocket.send_text(json.dumps(pin_payload))
                    history = await get_last_global_messages(db, limit=CHAT_PAGE_SIZE)
                    mids = [m.id for m in history]
                    rmap = await reactions_map_global(db, mids)
                    for msg in history:
                        r = rmap.get(msg.id)
                        await websocket.send_text(
                            json.dumps(global_message_to_response(msg, reactions=r))
                        )
                except Exception as e:
                    logger.exception("Failed to send pin/history: %s", e)
                await db.commit()

        try:
            await websocket.send_text(json.dumps({"type": "global_history_ready"}))
        except Exception:
            logger.exception("Failed to send global_history_ready")

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
                continue

            msg_type = data.get("type")
            if msg_type == "reaction_toggle":
                message_id = data.get("message_id")
                reaction_kind = data.get("reaction_kind")
                scope = (data.get("scope") or "global").lower()
                if not isinstance(message_id, int):
                    await websocket.send_text(json.dumps({"error": "message_id required"}))
                    continue
                if not isinstance(reaction_kind, str):
                    await websocket.send_text(json.dumps({"error": "reaction_kind required"}))
                    continue
                async with async_session_maker() as db:
                    try:
                        db_user = await _load_active_user(db, user.id)
                        if not db_user:
                            await websocket.send_text(json.dumps({"error": "Unauthorized"}))
                            continue
                        if scope == "private":
                            peer_id = data.get("peer_id")
                            if not isinstance(peer_id, int):
                                await websocket.send_text(json.dumps({"error": "peer_id required for private"}))
                                continue
                            if peer_id == db_user.id:
                                await websocket.send_text(json.dumps({"error": "Invalid peer"}))
                                continue
                            pm = await get_private_message_by_id(db, message_id)
                            if not pm:
                                await websocket.send_text(json.dumps({"error": "Message not found"}))
                                continue
                            if db_user.id not in (pm.sender_id, pm.recipient_id):
                                await websocket.send_text(json.dumps({"error": "Forbidden"}))
                                continue
                            other = pm.sender_id if db_user.id == pm.recipient_id else pm.recipient_id
                            if peer_id != other:
                                await websocket.send_text(json.dumps({"error": "Forbidden"}))
                                continue
                            try:
                                rd, sid, rid = await toggle_private_reaction(
                                    db, db_user.id, message_id, reaction_kind
                                )
                            except ValueError as ve:
                                await websocket.send_text(
                                    json.dumps({"error": _ws_value_error_client_message(ve)})
                                )
                                continue
                            except LookupError:
                                await websocket.send_text(json.dumps({"error": "Message not found"}))
                                continue
                            except PermissionError:
                                await websocket.send_text(json.dumps({"error": "Forbidden"}))
                                continue
                            await db.commit()
                            payload = {
                                "type": "reactions_updated",
                                "scope": "private",
                                "message_id": message_id,
                                "sender_id": sid,
                                "recipient_id": rid,
                                "reactions": rd,
                            }
                            await ws_manager.send_personal(sid, payload)
                            await ws_manager.send_personal(rid, payload)
                        else:
                            if not permissions.can_access_global_feed(db_user):
                                await websocket.send_text(
                                    json.dumps({"error": "No access to global chat"})
                                )
                                continue
                            try:
                                rd = await toggle_global_reaction(db, db_user.id, message_id, reaction_kind)
                            except ValueError as ve:
                                await websocket.send_text(
                                    json.dumps({"error": _ws_value_error_client_message(ve)})
                                )
                                continue
                            except LookupError:
                                await websocket.send_text(json.dumps({"error": "Message not found"}))
                                continue
                            await db.commit()
                            payload = {
                                "type": "reactions_updated",
                                "scope": "global",
                                "message_id": message_id,
                                "reactions": rd,
                            }
                            await ws_manager.broadcast(payload)
                    except Exception as e:
                        await db.rollback()
                        logger.exception("reaction_toggle: %s", e)
                        await websocket.send_text(json.dumps({"error": "Failed to toggle reaction"}))
                continue

            text = data.get("text") or data.get("content") or ""
            content_type_str = (data.get("content_type") or data.get("message_type") or "text").lower()
            try:
                msg_type = MessageType(content_type_str)
            except ValueError:
                msg_type = MessageType.text
            recipient_id: Optional[int] = data.get("recipient_id")
            reply_to_id: Optional[int] = data.get("reply_to_id")
            caption_raw = data.get("caption")
            caption: Optional[str] = caption_raw if isinstance(caption_raw, str) else None

            async with async_session_maker() as db:
                try:
                    db_user = await _load_active_user(db, user.id)
                    if not db_user:
                        await websocket.send_text(json.dumps({"error": "Unauthorized"}))
                        continue
                    if recipient_id is not None:
                        if recipient_id == db_user.id:
                            await websocket.send_text(json.dumps({"error": "Cannot send private message to yourself"}))
                            continue
                        try:
                            msg = await create_private_message(
                                db,
                                db_user.id,
                                recipient_id,
                                text,
                                msg_type,
                                reply_to_id=reply_to_id,
                                caption=caption,
                            )
                        except ValueError as ve:
                            await websocket.send_text(
                                json.dumps({"error": _ws_value_error_client_message(ve)})
                            )
                            continue
                        r_priv = await reactions_dict_private(db, msg.id)
                        await db.commit()
                        payload = private_message_to_response(
                            msg, username=db_user.username, reactions=r_priv
                        )
                        await ws_manager.send_personal(recipient_id, payload)
                        await websocket.send_text(json.dumps(payload))
                    else:
                        if not permissions.can_send_global(db_user):
                            await websocket.send_text(json.dumps({"error": "Banned from public chat"}))
                            continue
                        try:
                            msg = await create_global_message(
                                db,
                                db_user.id,
                                text,
                                msg_type,
                                reply_to_id=reply_to_id,
                                caption=caption,
                            )
                        except ValueError as ve:
                            await websocket.send_text(
                                json.dumps({"error": _ws_value_error_client_message(ve)})
                            )
                            continue
                        r_glob = await reactions_dict_global(db, msg.id)
                        await db.commit()
                        payload = global_message_to_response(msg, reactions=r_glob)
                        await ws_manager.broadcast(payload)
                except Exception as e:
                    await db.rollback()
                    logger.exception("Error saving message: %s", e)
                    await websocket.send_text(json.dumps({"error": "Failed to save message"}))

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket, user.id)
