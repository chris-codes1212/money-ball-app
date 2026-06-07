from fastapi import WebSocket
from collections import defaultdict
import json

class ConnectionManager:
    def __init__(self):
        # connections is a dict mapping game_id to a set of WebSocket connections for that game_id
        # what I need is a way to track authenticated users and their associated game_ids,
        # so I can broadcast messages to the authenticated users for a specific game_id when there is a new pitch
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

        # Most recent payload broadcast for each game. Lets a client that joins
        # mid-at-bat get the current odds immediately instead of staring at a
        # blank "Waiting for odds..." until the next pitch state-change fires.
        self._last_payload: dict[int, dict] = {}

        #self._authenticated_connections: dict[int, int, set[WebSocket]] = defaultdict(set)

    async def connect(self, game_id: int, websocket: WebSocket):
        await websocket.accept()
        self._connections[game_id].add(websocket)
        # Send the latest known snapshot right away, if we have one.
        last = self._last_payload.get(game_id)
        if last is not None:
            await websocket.send_text(json.dumps(last))

    def disconnect(self, game_id: int, websocket: WebSocket):
        self._connections[game_id].remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, game_id: int, payload: dict):
        # Cache as the latest snapshot so future joiners get it on connect.
        self._last_payload[game_id] = payload
        dead = set()
        for ws in self._connections.get(game_id, set()):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections[game_id].discard(ws)

    # async def broadcast(self, game_id: int, message: str):
        # for connection in self._connections[game_id]:
        #     await connection.send_text(message)


manager = ConnectionManager()