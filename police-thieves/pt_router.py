"""FastAPI router for the Police-Thieves game mode.

Mount this router in main.py.  Because the package directory is named
``police-thieves`` (with a hyphen), Python's normal import machinery cannot
load it directly.  Use the ``importlib`` approach shown in ``main.py`` to
load the router at startup, then register it with::

    app.include_router(pt_router)

WebSocket endpoint: ``/pt/ws/{room_id}``
Room info endpoint: ``GET /pt/room/{room_id}/info``

Client handshake
----------------
After the WS connection is opened, the client must send the first message::

    { "type": "join", "name": "<player name>" }

The server responds with::

    { "type": "connected", "player": <id>, "team": "" }

Teams are assigned when the host sends ``start_game``.

Client → Server messages
------------------------
``start_game``   – host starts the game::

    { "type": "start_game", "rounds": 5, "time": 70 }

``draw``         – freehand drawing data (relayed to all players)::

    { "type": "draw", "x": 120, "y": 80, "fromX": 118, "fromY": 79,
      "color": "#ff0000", "size": 4, "tool": "pen" }

``fill``         – flood fill::

    { "type": "fill", "x": 50, "y": 50, "color": "#00ff00" }

``end``          – pen lifted::

    { "type": "end" }

``clear``        – clear the canvas::

    { "type": "clear" }

``chat``         – chat message / guess::

    { "type": "chat", "text": "rope" }

Server → Client messages
------------------------
``connected``        – connection confirmed
``player_joined``    – updated player list
``teams_assigned``   – team assignments after start_game
``round_start``      – new round begins (thieves get "word", police get "mask")
``correct_guess``    – a police player guessed correctly
``hint``             – a letter in the masked word is revealed
``timer``            – countdown tick
``round_over``       – round ended (word reveal + scores)
``game_over``        – final scores and winning team
``game_state``       – full state snapshot for reconnecting players
``draw`` / ``fill`` / ``end`` / ``clear`` / ``chat`` – relayed canvas events
``error``            – validation error
"""

import asyncio
import json
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .pt_room_manager import PTRoomManager, TEAM_THIEF

router = APIRouter(prefix="/pt", tags=["police-thieves"])

_manager = PTRoomManager()

ALLOWED_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# ── Validation ─────────────────────────────────────────────────────────────

VALID_DRAW_TOOLS = {
    "pen", "neon", "rainbow", "spray", "mirror",
    "glitter", "chalk", "fire", "bubble", "zigzag",
    "kaleidoscope", "lightning", "fur", "splatter",
    "ribbon", "confetti", "watercolor", "mosaic",
    "fill", "star", "heart", "circle", "eraser",
}


def _validate_draw(data: dict) -> dict | None:
    if "x" not in data or "y" not in data:
        return None
    try:
        out: dict = {"type": "draw", "x": float(data["x"]), "y": float(data["y"])}
        if "fromX" in data:
            out["fromX"] = float(data["fromX"])
        if "fromY" in data:
            out["fromY"] = float(data["fromY"])
        if "color" in data:
            out["color"] = str(data["color"])[:20]
        if "size" in data:
            s = float(data["size"])
            if s < 1 or s > 100:
                return None
            out["size"] = s
        if "tool" in data:
            t = str(data["tool"])
            if t in VALID_DRAW_TOOLS:
                out["tool"] = t
        if "hue" in data:
            out["hue"] = float(data["hue"]) % 360
        if "lineStart" in data:
            out["lineStart"] = bool(data["lineStart"])
        return out
    except (ValueError, TypeError):
        return None


# ── HTTP endpoint ──────────────────────────────────────────────────────────

@router.get("/room/{room_id}/info")
def room_info(room_id: str) -> dict:
    """Return basic room info (player count, capacity)."""
    if not _manager.room_exists(room_id):
        return {"room_id": room_id, "players": 0, "full": False}
    count = _manager.player_count(room_id)
    return {
        "room_id": room_id,
        "players": count,
        "full": _manager.is_full(room_id),
    }


# ── WebSocket endpoint ─────────────────────────────────────────────────────

@router.websocket("/ws/{room_id}")
async def pt_websocket(websocket: WebSocket, room_id: str) -> None:
    """Main WebSocket handler for the Police-Thieves game mode."""

    # Origin check
    if "*" not in ALLOWED_ORIGINS:
        origin = websocket.headers.get("origin")
        if origin and origin not in ALLOWED_ORIGINS:
            await websocket.close(code=1008)
            return

    await websocket.accept()

    # First message: join with name
    try:
        first_raw = await websocket.receive_text()
        first_data = json.loads(first_raw)
        player_name = str(first_data.get("name", "Player"))[:40].strip() or "Player"
    except Exception:
        player_name = "Player"

    player = _manager.connect(room_id, websocket, player_name)
    if not player:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Room is full"})
        )
        await websocket.close(code=4000)
        return

    # Confirm connection
    await websocket.send_text(
        json.dumps({
            "type": "connected",
            "player": player.id,
            "team": player.team,  # empty string until teams are assigned
        })
    )

    # Send game-state snapshot if reconnecting mid-game
    sync = _manager.get_game_sync(room_id, player)
    if sync:
        await websocket.send_text(json.dumps(sync))

    # Broadcast updated player list
    await _broadcast_player_list(room_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "Invalid JSON"})
                )
                continue

            event_type = data.get("type")

            # ── Start game ────────────────────────────────────────────
            if event_type == "start_game":
                try:
                    rounds = max(1, min(int(data.get("rounds", 5)), 20))
                    time_val = max(30, min(int(data.get("time", 70)), 300))
                except (ValueError, TypeError):
                    continue
                players = _manager.get_players(room_id)
                if len([p for p in players if p.ws is not None]) < 2:
                    await websocket.send_text(
                        json.dumps({
                            "type": "error",
                            "message": "Need at least 2 players to start",
                        })
                    )
                    continue
                await _manager.start_game(room_id, rounds, time_val)

            # ── Drawing relay ─────────────────────────────────────────
            elif event_type == "draw":
                validated = _validate_draw(data)
                if not validated:
                    continue
                game = _manager.games.get(room_id)
                # Only the current drawer (a thief) should send draw events
                if game and game.phase == "drawing" and player.team == TEAM_THIEF:
                    game.draw_history.append(validated)
                await _manager.broadcast(room_id, json.dumps(validated), sender=websocket)

            elif event_type == "fill":
                try:
                    msg = {
                        "type": "fill",
                        "x": float(data["x"]),
                        "y": float(data["y"]),
                        "color": str(data.get("color", "#000000"))[:20],
                    }
                except (ValueError, TypeError, KeyError):
                    continue
                game = _manager.games.get(room_id)
                if game and game.phase == "drawing" and player.team == TEAM_THIEF:
                    game.draw_history.append(msg)
                await _manager.broadcast(room_id, json.dumps(msg), sender=websocket)

            elif event_type == "end":
                end_msg: dict = {"type": "end"}
                game = _manager.games.get(room_id)
                if game and game.phase == "drawing" and player.team == TEAM_THIEF:
                    game.draw_history.append(end_msg)
                await _manager.broadcast(room_id, json.dumps(end_msg), sender=websocket)

            elif event_type == "clear":
                clear_msg: dict = {"type": "clear"}
                game = _manager.games.get(room_id)
                if game and game.phase == "drawing" and player.team == TEAM_THIEF:
                    game.draw_history = [clear_msg]
                await _manager.broadcast(room_id, json.dumps(clear_msg), sender=websocket)

            # ── Chat / guess ──────────────────────────────────────────
            elif event_type == "chat":
                try:
                    text = str(data.get("text", "")).strip()[:200]
                    if not text:
                        continue
                except (ValueError, TypeError):
                    continue

                guessed = await _manager.check_guess(room_id, player, text)
                if not guessed:
                    # Don't broadcast exact word from police (prevent hints)
                    game = _manager.games.get(room_id)
                    if (
                        game
                        and game.phase == "drawing"
                        and text.strip().lower() == game.secret_word.lower()
                    ):
                        continue
                    chat_msg = {
                        "type": "chat",
                        "text": text,
                        "playerId": player.id,
                        "playerName": player.name,
                        "team": player.team,
                    }
                    await _manager.broadcast(
                        room_id, json.dumps(chat_msg), sender=websocket
                    )

            # ── Unknown → ignore ──────────────────────────────────────

    except WebSocketDisconnect:
        _manager.disconnect(room_id, websocket)
        remaining = _manager.player_count(room_id)
        if remaining > 0:
            await _broadcast_player_list(room_id)
            # End round if the drawer disconnected
            game = _manager.games.get(room_id)
            if game and game.phase == "drawing":
                thieves = _manager.get_thieves(room_id)
                if game.thief_drawer_index >= len(thieves):
                    await _manager.end_round(room_id)


async def _broadcast_player_list(room_id: str) -> None:
    """Notify all clients of the current player list with teams and scores."""
    players = _manager.get_players(room_id)
    active = [p for p in players if p.ws is not None]
    msg = json.dumps({
        "type": "player_joined",
        "players": len(active),
        "playerList": [
            {"id": p.id, "name": p.name, "team": p.team, "score": p.score}
            for p in players
        ],
    })
    await _manager.broadcast_all(room_id, msg)
