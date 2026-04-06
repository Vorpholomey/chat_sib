"""WebSocket connection manager: track connections by user_id and broadcast or target messages."""

import asyncio
import json
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Stores active WebSocket connections by user_id. Supports global broadcast and per-user send."""

    def __init__(self) -> None:
        # user_id -> list of WebSocket (one user can have multiple tabs/devices)
        self._connections: dict[int, list[WebSocket]] = {}
        # user_id -> receive global room broadcasts (False = permanently banned from public feed; still gets DMs)
        self._receive_global: dict[int, bool] = {}

    async def connect(self, websocket: WebSocket, user_id: int, *, receive_global: bool = True) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        self._receive_global[user_id] = receive_global
        logger.info("WebSocket connected: user_id=%s, total connections for user=%s", user_id, len(self._connections[user_id]))

    def disconnect(self, websocket: WebSocket, user_id: int) -> None:
        if user_id in self._connections:
            try:
                self._connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[user_id]:
                del self._connections[user_id]
                self._receive_global.pop(user_id, None)
        logger.info("WebSocket disconnected: user_id=%s", user_id)

    def is_online(self, user_id: int) -> bool:
        return user_id in self._connections and len(self._connections[user_id]) > 0

    async def send_personal(self, user_id: int, message: dict) -> None:
        """Send message to all connections of a specific user."""
        if user_id not in self._connections:
            return
        dead: list[WebSocket] = []
        payload = json.dumps(message)
        sockets = list(self._connections[user_id])

        async def _send(ws: WebSocket) -> None:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)

        if sockets:
            await asyncio.gather(*(_send(ws) for ws in sockets))
        for ws in dead:
            self._connections[user_id].remove(ws)
        if user_id in self._connections and not self._connections[user_id]:
            del self._connections[user_id]

    async def broadcast(self, message: dict) -> None:
        """Send message to all connected clients subscribed to the global room."""
        payload = json.dumps(message)
        dead: list[tuple[int, WebSocket]] = []
        pairs: list[tuple[int, WebSocket]] = [
            (uid, ws)
            for uid, sockets in list(self._connections.items())
            for ws in sockets
            if self._receive_global.get(uid, True)
        ]

        async def _send(uid: int, ws: WebSocket) -> None:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append((uid, ws))

        if pairs:
            await asyncio.gather(*(_send(uid, ws) for uid, ws in pairs))
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
