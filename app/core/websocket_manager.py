"""WebSocket connection manager: track connections by user_id and broadcast or target messages."""

import json
import logging
from typing import Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Stores active WebSocket connections by user_id. Supports global broadcast and per-user send."""

    def __init__(self) -> None:
        # user_id -> list of WebSocket (one user can have multiple tabs/devices)
        self._connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        logger.info("WebSocket connected: user_id=%s, total connections for user=%s", user_id, len(self._connections[user_id]))

    def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        if user_id in self._connections:
            try:
                self._connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info("WebSocket disconnected: user_id=%s", user_id)

    def is_online(self, user_id: int) -> bool:
        return user_id in self._connections and len(self._connections[user_id]) > 0

    async def send_personal(self, user_id: int, message: dict) -> None:
        """Send message to all connections of a specific user."""
        if user_id not in self._connections:
            return
        dead: list[WebSocket] = []
        payload = json.dumps(message)
        for ws in self._connections[user_id]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections[user_id].remove(ws)
        if user_id in self._connections and not self._connections[user_id]:
            del self._connections[user_id]

    async def broadcast(self, message: dict) -> None:
        """Send message to all connected clients (global chat)."""
        payload = json.dumps(message)
        dead: list[tuple[int, WebSocket]] = []
        for uid, sockets in list(self._connections.items()):
            for ws in sockets:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append((uid, ws))
        for uid, ws in dead:
            if uid in self._connections:
                try:
                    self._connections[uid].remove(ws)
                except ValueError:
                    pass
                if not self._connections[uid]:
                    del self._connections[uid]


# Singleton used by WebSocket endpoints
ws_manager = ConnectionManager()
