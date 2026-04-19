"""Frozen rules metadata for the serving runtime."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Ruleset:
    name: str
    board_size: int
    playable_squares: int
    action_size: int
    mandatory_capture: bool
    forced_same_piece_continuation: bool
    repetition_draw_count: int
    no_progress_draw_halfmoves: int
    canonical_observation_shape: tuple[int, int, int]


CHECKERS_V2_RULESET = Ruleset(
    name="english_checkers_v2",
    board_size=8,
    playable_squares=32,
    action_size=256,
    mandatory_capture=True,
    forced_same_piece_continuation=True,
    repetition_draw_count=3,
    no_progress_draw_halfmoves=80,
    canonical_observation_shape=(8, 8, 8),
)

