"""WebSocket: global chat and private messages. JWT via query param or header."""

import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.core.websocket_manager import ws_manager
from app.db.session import async_session_maker
from app.models.user import User
from app.models.global_message import GlobalMessage, MessageType
from app.models.private_message import PrivateMessage
from app.services.message import (
    get_last_global_messages,
    create_global_message,
    create_private_message,
    global_message_to_response,
    private_message_to_response,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


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
        await db.commit()
    return user


@router.websocket("/ws/chat")
async def websocket_global_chat(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """Single WebSocket for global chat and private messages.
    - Connect: ?token=JWT. On connect we send last 1000 global messages.
    - Incoming message: { "text": "...", "content_type": "text"|"image"|"gif" } for global.
    - For private: { "text": "...", "content_type": "...", "recipient_id": <int> }. Message is saved and sent only to recipient.
    """
    # Prefer token from query (typical for WS); also accept via Sec-WebSocket-Protocol or header in real clients
    auth_token = token
    if not auth_token and websocket.headers.get("authorization"):
        raw = websocket.headers["authorization"]
        if raw.startswith("Bearer "):
            auth_token = raw[7:]
    user = await get_user_from_token(auth_token)
    if not user:
        await websocket.close(code=4001, reason="Invalid or missing token")
        return

    await ws_manager.connect(websocket, user.id)

    try:
        async with async_session_maker() as db:
            try:
                history = await get_last_global_messages(db, limit=1000)
                for msg in history:
                    await websocket.send_text(json.dumps(global_message_to_response(msg)))
            except Exception as e:
                logger.exception("Failed to send history: %s", e)
            await db.commit()

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
                continue

            text = data.get("text") or data.get("content") or ""
            content_type_str = (data.get("content_type") or data.get("message_type") or "text").lower()
            try:
                msg_type = MessageType(content_type_str)
            except ValueError:
                msg_type = MessageType.text
            recipient_id: Optional[int] = data.get("recipient_id")

            if not text.strip():
                await websocket.send_text(json.dumps({"error": "Message text is required"}))
                continue

            async with async_session_maker() as db:
                try:
                    if recipient_id is not None:
                        if recipient_id == user.id:
                            await websocket.send_text(json.dumps({"error": "Cannot send private message to yourself"}))
                            continue
                        msg = await create_private_message(db, user.id, recipient_id, text.strip(), msg_type)
                        await db.commit()
                        payload = private_message_to_response(msg)
                        payload["username"] = user.username
                        await ws_manager.send_personal(recipient_id, payload)
                        await websocket.send_text(json.dumps(payload))
                    else:
                        msg = await create_global_message(db, user.id, text.strip(), msg_type)
                        await db.commit()
                        payload = global_message_to_response(msg)
                        await ws_manager.broadcast(payload)
                except Exception as e:
                    await db.rollback()
                    logger.exception("Error saving message: %s", e)
                    await websocket.send_text(json.dumps({"error": "Failed to save message"}))

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket, user.id)
