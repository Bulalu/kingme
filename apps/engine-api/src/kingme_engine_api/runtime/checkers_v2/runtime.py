"""Runtime alias layer for the serving checkers state."""

from __future__ import annotations

from .state import (
    DRAW,
    EMPTY,
    RED,
    RED_KING,
    RED_MAN,
    WHITE,
    WHITE_KING,
    WHITE_MAN,
    CheckersState,
)


FAST_STATE_AVAILABLE = False
FastCheckersState = None
ReferenceCheckersState = CheckersState

