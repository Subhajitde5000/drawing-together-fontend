"""Game-state dataclass for the Police-Thieves mode.

Game Rules
----------
* Players are split into two teams: **POLICE** and **THIEVES**.
* At the start of each round the server picks one member of the thief team
  to be the *drawer*.  All thieves learn the secret word; police do not.
* Police players guess by sending chat messages.
  - First correct guesser among police → the whole police team scores.
  - Score is based on how much time remains (10–100 pts per police player).
* If the round timer expires without a correct police guess → thief team
  scores 20 pts each (and the drawer gets +10 bonus pts).
* After *total_rounds* rounds the team with the highest total score wins.
"""

import asyncio
from typing import List, Optional


class PTGameState:
    """Per-room state for one Police-Thieves game session."""

    __slots__ = (
        "phase",
        "total_rounds",
        "current_round",
        "round_time",
        "time_left",
        "thief_drawer_index",
        "secret_word",
        "correct_police",
        "used_words",
        "draw_history",
        "revealed_indices",
        "timer_task",
        "hint_task",
    )

    def __init__(self, total_rounds: int = 5, round_time: int = 70) -> None:
        # lobby | drawing | roundover | finished
        self.phase: str = "lobby"

        self.total_rounds: int = total_rounds
        self.current_round: int = 0
        self.round_time: int = round_time
        self.time_left: int = round_time

        # Index into the *thief* sub-list (rotates every round)
        self.thief_drawer_index: int = -1

        self.secret_word: str = ""
        # Names of police players who guessed correctly this round
        self.correct_police: List[str] = []

        self.used_words: List[str] = []
        self.draw_history: List[dict] = []
        self.revealed_indices: List[int] = []

        self.timer_task: Optional[asyncio.Task] = None
        self.hint_task: Optional[asyncio.Task] = None
