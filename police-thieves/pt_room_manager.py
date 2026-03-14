"""Room + player management and game-loop logic for Police-Thieves mode."""

import asyncio
import json
import os
import random
from typing import Dict, List, Optional

from fastapi import WebSocket

from .pt_game_state import PTGameState

MAX_PLAYERS: int = int(os.getenv("MAX_PLAYERS_PER_ROOM", "8"))

# ── Teams ──────────────────────────────────────────────────────────────────
TEAM_POLICE = "police"
TEAM_THIEF = "thief"

# ── Word bank (police-thieves themed + general objects) ───────────────────
WORD_LIST: List[str] = [
    # General objects (good for drawing)
    "key", "door", "window", "ladder", "rope", "mask", "bag", "vault",
    "safe", "lock", "handcuffs", "badge", "gun", "flashlight", "walkie-talkie",
    "prison", "cell", "escape", "disguise", "footprint", "fingerprint",
    "camera", "alarm", "safe-cracker", "getaway car", "hideout", "ransom",
    "detective", "clue", "suspect", "evidence", "witness", "patrol car",
    # General drawing words for variety
    "tree", "house", "cat", "dog", "sun", "moon", "star", "bird", "fish",
    "apple", "book", "car", "boat", "cloud", "fire", "flower", "guitar",
    "heart", "kite", "lamp", "lion", "mountain", "ocean", "pizza", "rain",
    "rainbow", "robot", "rocket", "snake", "snowman", "spider", "sword",
    "tiger", "train", "umbrella", "whale", "witch", "wolf", "zebra",
    "balloon", "banana", "bridge", "butterfly", "candle", "castle",
    "cherry", "clock", "compass", "crown", "diamond", "dinosaur",
    "dolphin", "dragon", "drum", "eagle", "elephant", "ghost",
]


class PTPlayer:
    """One connected player in a Police-Thieves room."""

    __slots__ = ("ws", "id", "name", "team", "score")

    def __init__(
        self,
        ws: Optional[WebSocket],
        player_id: int,
        name: str = "Player",
        team: str = "",
    ) -> None:
        self.ws: Optional[WebSocket] = ws
        self.id: int = player_id
        self.name: str = name
        self.team: str = team   # TEAM_POLICE or TEAM_THIEF
        self.score: int = 0


class PTRoomManager:
    """Manages all Police-Thieves rooms, players, and game lifecycles."""

    def __init__(self) -> None:
        self.rooms: Dict[str, List[PTPlayer]] = {}
        self.games: Dict[str, PTGameState] = {}
        self._next_id: Dict[str, int] = {}

    # ── Room helpers ──────────────────────────────────────────────────────

    def room_exists(self, room_id: str) -> bool:
        return room_id in self.rooms

    def player_count(self, room_id: str) -> int:
        return len([p for p in self.rooms.get(room_id, []) if p.ws is not None])

    def is_full(self, room_id: str) -> bool:
        return self.player_count(room_id) >= MAX_PLAYERS

    def get_players(self, room_id: str) -> List[PTPlayer]:
        return self.rooms.get(room_id, [])

    def get_player(self, room_id: str, ws: WebSocket) -> Optional[PTPlayer]:
        for p in self.rooms.get(room_id, []):
            if p.ws is ws:
                return p
        return None

    # ── Connect / disconnect ──────────────────────────────────────────────

    def connect(
        self, room_id: str, ws: WebSocket, name: str = "Player"
    ) -> Optional[PTPlayer]:
        if room_id not in self.rooms:
            self.rooms[room_id] = []
            self._next_id[room_id] = 1

        # Allow reconnection by name if a ghost slot exists
        game = self.games.get(room_id)
        if game and game.phase != "lobby":
            for p in self.rooms[room_id]:
                if p.name == name:
                    p.ws = ws
                    return p
        else:
            for p in self.rooms[room_id]:
                if p.name == name and p.ws is None:
                    p.ws = ws
                    return p

        if self.is_full(room_id):
            return None

        pid = self._next_id[room_id]
        self._next_id[room_id] = pid + 1
        player = PTPlayer(ws, pid, name)
        self.rooms[room_id].append(player)
        return player

    def disconnect(self, room_id: str, ws: WebSocket) -> None:
        if room_id not in self.rooms:
            return

        game = self.games.get(room_id)
        keep_ghost = game and game.phase != "lobby"

        if keep_ghost:
            for p in self.rooms[room_id]:
                if p.ws is ws:
                    p.ws = None
                    break
        else:
            self.rooms[room_id] = [p for p in self.rooms[room_id] if p.ws is not ws]

        # Fully clean up if no active connections remain
        active = [p for p in self.rooms.get(room_id, []) if p.ws is not None]
        if not active:
            del self.rooms[room_id]
            self._next_id.pop(room_id, None)
            g = self.games.pop(room_id, None)
            if g:
                self._cancel_tasks(g)

    # ── Broadcast helpers ─────────────────────────────────────────────────

    async def broadcast(
        self,
        room_id: str,
        message: str,
        sender: Optional[WebSocket] = None,
    ) -> None:
        for p in self.rooms.get(room_id, []):
            if p.ws is not None and p.ws is not sender:
                try:
                    await p.ws.send_text(message)
                except Exception:
                    pass

    async def broadcast_all(self, room_id: str, message: str) -> None:
        for p in self.rooms.get(room_id, []):
            if p.ws is not None:
                try:
                    await p.ws.send_text(message)
                except Exception:
                    pass

    async def send_to(self, ws: Optional[WebSocket], message: str) -> None:
        if ws is None:
            return
        try:
            await ws.send_text(message)
        except Exception:
            pass

    # ── Team assignment ───────────────────────────────────────────────────

    def assign_teams(self, room_id: str) -> None:
        """Randomly split active players into police / thief teams."""
        players = [p for p in self.rooms.get(room_id, []) if p.ws is not None]
        random.shuffle(players)
        for i, p in enumerate(players):
            p.team = TEAM_POLICE if i % 2 == 0 else TEAM_THIEF

    def get_thieves(self, room_id: str) -> List[PTPlayer]:
        return [p for p in self.rooms.get(room_id, []) if p.team == TEAM_THIEF]

    def get_police(self, room_id: str) -> List[PTPlayer]:
        return [p for p in self.rooms.get(room_id, []) if p.team == TEAM_POLICE]

    # ── Word helpers ──────────────────────────────────────────────────────

    def pick_word(self, game: PTGameState) -> str:
        available = [w for w in WORD_LIST if w not in game.used_words]
        if not available:
            available = list(WORD_LIST)
            game.used_words.clear()
        word = random.choice(available)
        game.used_words.append(word)
        return word

    @staticmethod
    def mask_word(word: str, revealed: List[int]) -> str:
        return " ".join(
            c.upper() if i in revealed else "_"
            for i, c in enumerate(word)
            if not c.isspace()
        )

    # ── Game helpers ──────────────────────────────────────────────────────

    def get_or_create_game(
        self, room_id: str, rounds: int = 5, round_time: int = 70
    ) -> PTGameState:
        if room_id not in self.games:
            self.games[room_id] = PTGameState(rounds, round_time)
        return self.games[room_id]

    def get_game_sync(self, room_id: str, player: PTPlayer) -> Optional[dict]:
        """Full game-state snapshot for a reconnecting player."""
        game = self.games.get(room_id)
        if not game or game.phase == "lobby":
            return None

        thieves = self.get_thieves(room_id)
        drawer = (
            thieves[game.thief_drawer_index]
            if game.thief_drawer_index < len(thieves)
            else None
        )

        msg: dict = {
            "type": "game_state",
            "phase": game.phase,
            "round": game.current_round,
            "totalRounds": game.total_rounds,
            "roundTime": game.round_time,
            "timeLeft": game.time_left,
            "playerTeam": player.team,
            "drawer": drawer.id if drawer else None,
            "drawerName": drawer.name if drawer else "?",
            "scores": [
                {"id": p.id, "name": p.name, "team": p.team, "score": p.score}
                for p in self.get_players(room_id)
            ],
            "correctPolice": list(game.correct_police),
        }

        if game.phase == "drawing":
            if player.team == TEAM_THIEF:
                msg["word"] = game.secret_word
            else:
                msg["mask"] = self.mask_word(game.secret_word, game.revealed_indices)
            msg["drawHistory"] = game.draw_history

        return msg

    # ── Round lifecycle ───────────────────────────────────────────────────

    async def start_game(self, room_id: str, rounds: int, round_time: int) -> None:
        """Initialise a new game session (teams + first round)."""
        game = self.get_or_create_game(room_id, rounds, round_time)
        game.total_rounds = rounds
        game.round_time = round_time
        game.current_round = 0
        game.thief_drawer_index = -1
        game.phase = "lobby"
        game.used_words.clear()

        # Reset scores
        for p in self.get_players(room_id):
            p.score = 0

        # Assign teams
        self.assign_teams(room_id)

        # Broadcast team assignments
        players = self.get_players(room_id)
        team_msg = json.dumps({
            "type": "teams_assigned",
            "players": [
                {"id": p.id, "name": p.name, "team": p.team}
                for p in players
            ],
        })
        await self.broadcast_all(room_id, team_msg)

        await self.start_round(room_id)

    async def start_round(self, room_id: str) -> None:
        game = self.games.get(room_id)
        thieves = self.get_thieves(room_id)
        police = self.get_police(room_id)

        if not game or not thieves or not police:
            return
        if game.phase == "drawing":
            return

        # Ensure there are enough active players across both teams
        active_thieves = [p for p in thieves if p.ws is not None]
        active_police = [p for p in police if p.ws is not None]
        if not active_thieves or not active_police:
            return

        game.current_round += 1
        game.phase = "drawing"
        game.correct_police = []
        game.revealed_indices = []
        game.time_left = game.round_time
        game.draw_history = []

        # Rotate drawer within the thief team
        game.thief_drawer_index = (game.thief_drawer_index + 1) % len(thieves)
        drawer = thieves[game.thief_drawer_index]

        word = self.pick_word(game)
        game.secret_word = word

        # Initial letter reveal (1 letter)
        letter_indices = [i for i, c in enumerate(word) if c != " "]
        initial = random.sample(letter_indices, min(1, len(letter_indices)))
        game.revealed_indices = list(initial)
        mask = self.mask_word(word, game.revealed_indices)

        all_players = self.get_players(room_id)
        for p in all_players:
            msg: dict = {
                "type": "round_start",
                "round": game.current_round,
                "totalRounds": game.total_rounds,
                "drawer": drawer.id,
                "drawerName": drawer.name,
                "drawerTeam": TEAM_THIEF,
                "mask": mask,
                "wordLength": len(word.replace(" ", "")),
            }
            # Thieves know the word; police only get the mask
            if p.team == TEAM_THIEF:
                msg["word"] = word
            await self.send_to(p.ws, json.dumps(msg))

        self._cancel_tasks(game)
        game.timer_task = asyncio.create_task(self._run_timer(room_id))
        game.hint_task = asyncio.create_task(self._run_hints(room_id))

    async def end_round(self, room_id: str) -> None:
        game = self.games.get(room_id)
        if not game:
            return

        self._cancel_tasks(game)
        game.phase = "roundover"

        police = self.get_police(room_id)
        thieves = self.get_thieves(room_id)
        drawer = (
            thieves[game.thief_drawer_index]
            if game.thief_drawer_index < len(thieves)
            else None
        )

        police_won = len(game.correct_police) > 0

        if not police_won:
            # Thieves score: 20 pts each active thief, +10 bonus for the drawer
            for t in thieves:
                if t.ws is not None:
                    t.score += 20
            if drawer and drawer.ws is not None:
                drawer.score += 10  # bonus for the active drawer

        is_final = game.current_round >= game.total_rounds

        scores = [
            {"id": p.id, "name": p.name, "team": p.team, "score": p.score}
            for p in self.get_players(room_id)
        ]

        await self.broadcast_all(
            room_id,
            json.dumps({
                "type": "round_over",
                "word": game.secret_word,
                "policeWon": police_won,
                "correctPolice": list(game.correct_police),
                "drawer": drawer.id if drawer else None,
                "drawerName": drawer.name if drawer else "?",
                "scores": scores,
                "isFinal": is_final,
                "round": game.current_round,
                "totalRounds": game.total_rounds,
            }),
        )

        if is_final:
            game.phase = "finished"
            # Determine overall winner
            police_total = sum(p.score for p in police)
            thief_total = sum(p.score for p in thieves)
            if police_total > thief_total:
                winning_team = TEAM_POLICE
            elif thief_total > police_total:
                winning_team = TEAM_THIEF
            else:
                winning_team = "draw"

            await self.broadcast_all(
                room_id,
                json.dumps({
                    "type": "game_over",
                    "winningTeam": winning_team,
                    "policeScore": police_total,
                    "thiefScore": thief_total,
                    "scores": scores,
                }),
            )
        else:
            async def _auto_next(rid: str) -> None:
                await asyncio.sleep(3)
                g = self.games.get(rid)
                if g and g.phase == "roundover":
                    await self.start_round(rid)

            asyncio.create_task(_auto_next(room_id))

    async def check_guess(
        self, room_id: str, player: PTPlayer, text: str
    ) -> bool:
        """Return True if the guess is correct and the player is a police member."""
        game = self.games.get(room_id)
        if not game or game.phase != "drawing":
            return False

        # Only police can guess
        if player.team != TEAM_POLICE:
            return False

        # Already guessed
        if player.name in game.correct_police:
            return False

        if text.strip().lower() == game.secret_word.lower():
            remaining_pct = game.time_left / game.round_time if game.round_time else 0
            points = max(10, int(10 + 90 * remaining_pct))
            player.score += points
            game.correct_police.append(player.name)

            await self.broadcast_all(
                room_id,
                json.dumps({
                    "type": "correct_guess",
                    "playerName": player.name,
                    "playerId": player.id,
                    "team": TEAM_POLICE,
                    "points": points,
                }),
            )

            # All active police guessed → police win the round
            active_police = [
                p for p in self.get_police(room_id) if p.ws is not None
            ]
            if len(game.correct_police) >= len(active_police):
                await self.end_round(room_id)

            return True
        return False

    # ── Timer ─────────────────────────────────────────────────────────────

    async def _run_timer(self, room_id: str) -> None:
        game = self.games.get(room_id)
        if not game:
            return
        try:
            while game.time_left > 0 and game.phase == "drawing":
                await asyncio.sleep(1)
                game.time_left -= 1
                await self.broadcast_all(
                    room_id,
                    json.dumps({"type": "timer", "seconds": game.time_left}),
                )
            if game.phase == "drawing":
                await self.end_round(room_id)
        except asyncio.CancelledError:
            pass

    # ── Hint reveals ──────────────────────────────────────────────────────

    async def _run_hints(self, room_id: str) -> None:
        game = self.games.get(room_id)
        if not game:
            return
        word = game.secret_word
        letter_indices = [i for i, c in enumerate(word) if c != " "]
        total = len(letter_indices)
        max_reveals = max(1, total // 2)
        interval = game.round_time / (max_reveals + 1)

        try:
            for _ in range(max_reveals):
                await asyncio.sleep(interval)
                if game.phase != "drawing":
                    break
                unrevealed = [
                    i for i in letter_indices if i not in game.revealed_indices
                ]
                if not unrevealed:
                    break
                idx = random.choice(unrevealed)
                game.revealed_indices.append(idx)
                mask = self.mask_word(word, game.revealed_indices)
                # Only police receive hints (thieves already know the word)
                hint_msg = json.dumps({"type": "hint", "mask": mask})
                for p in self.get_police(room_id):
                    await self.send_to(p.ws, hint_msg)
        except asyncio.CancelledError:
            pass

    @staticmethod
    def _cancel_tasks(game: PTGameState) -> None:
        if game.timer_task and not game.timer_task.done():
            game.timer_task.cancel()
        if game.hint_task and not game.hint_task.done():
            game.hint_task.cancel()
        game.timer_task = None
        game.hint_task = None
