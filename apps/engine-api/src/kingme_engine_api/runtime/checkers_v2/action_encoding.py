"""Shared action encoding for Tanzanian-style 8x8 draughts.

The previous serving runtime encoded moves as one of eight fixed deltas from
the source square. That only works for English/American checkers where kings
move a single step. Flying kings need variable-distance actions, so actions are
encoded as:

- source playable square
- destination playable square
- capture bit
"""

from __future__ import annotations

from dataclasses import dataclass


BOARD_SIZE = 8
PLAYABLE_SQUARES = 32
ACTION_SIZE = PLAYABLE_SQUARES * PLAYABLE_SQUARES * 2
_PLAYABLE_COORDS = tuple(
    (row, col)
    for row in range(BOARD_SIZE)
    for col in range(BOARD_SIZE)
    if (row + col) % 2 == 1
)
_COORDS_TO_SQUARE = {coords: idx for idx, coords in enumerate(_PLAYABLE_COORDS)}


@dataclass(frozen=True)
class DecodedAction:
    source_square: int
    destination_square: int
    is_capture: bool
    move_type: str


def playable_square_coords() -> tuple[tuple[int, int], ...]:
    return _PLAYABLE_COORDS


def square_to_coords(square: int) -> tuple[int, int]:
    if not 0 <= square < PLAYABLE_SQUARES:
        raise ValueError(f"square index must be in [0, {PLAYABLE_SQUARES}), got {square}")
    return _PLAYABLE_COORDS[square]


def coords_to_square(row: int, col: int) -> int:
    try:
        return _COORDS_TO_SQUARE[(row, col)]
    except KeyError as exc:
        raise ValueError(f"({row}, {col}) is not a playable square") from exc


def encode_action(source_square: int, destination_square: int, is_capture: bool = False) -> int:
    source_square = int(source_square)
    destination_square = int(destination_square)
    if not 0 <= source_square < PLAYABLE_SQUARES:
        raise ValueError(f"source square must be in [0, {PLAYABLE_SQUARES}), got {source_square}")
    if not 0 <= destination_square < PLAYABLE_SQUARES:
        raise ValueError(
            f"destination square must be in [0, {PLAYABLE_SQUARES}), got {destination_square}"
        )
    capture_id = 1 if is_capture else 0
    return (source_square * PLAYABLE_SQUARES + destination_square) * 2 + capture_id


def decode_action(action: int) -> DecodedAction:
    if not 0 <= action < ACTION_SIZE:
        raise ValueError(f"action must be in [0, {ACTION_SIZE}), got {action}")
    pair, capture_id = divmod(action, 2)
    source_square, destination_square = divmod(pair, PLAYABLE_SQUARES)
    is_capture = bool(capture_id)
    return DecodedAction(
        source_square=source_square,
        destination_square=destination_square,
        is_capture=is_capture,
        move_type="capture" if is_capture else "move",
    )


def rotate_coords_180(row: int, col: int) -> tuple[int, int]:
    return BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - col


def rotate_square_180(square: int) -> int:
    row, col = square_to_coords(square)
    return coords_to_square(*rotate_coords_180(row, col))


def canonicalize_square(square: int, player: int) -> int:
    return square if player > 0 else rotate_square_180(square)


def canonicalize_action(action: int, player: int) -> int:
    decoded = decode_action(action)
    if player > 0:
        return action
    return encode_action(
        rotate_square_180(decoded.source_square),
        rotate_square_180(decoded.destination_square),
        decoded.is_capture,
    )
