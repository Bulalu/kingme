"""Shared action encoding for English checkers."""

from __future__ import annotations

from dataclasses import dataclass


BOARD_SIZE = 8
PLAYABLE_SQUARES = 32
MOVE_TYPES = ("NW", "NE", "SW", "SE", "JNW", "JNE", "JSW", "JSE")
MOVE_TYPE_TO_ID = {name: idx for idx, name in enumerate(MOVE_TYPES)}
ACTION_SIZE = PLAYABLE_SQUARES * len(MOVE_TYPES)
_ROTATED_MOVE_TYPES = {
    "NW": "SE",
    "NE": "SW",
    "SW": "NE",
    "SE": "NW",
    "JNW": "JSE",
    "JNE": "JSW",
    "JSW": "JNE",
    "JSE": "JNW",
}
_PLAYABLE_COORDS = tuple(
    (row, col)
    for row in range(BOARD_SIZE)
    for col in range(BOARD_SIZE)
    if (row + col) % 2 == 1
)
_COORDS_TO_SQUARE = {coords: idx for idx, coords in enumerate(_PLAYABLE_COORDS)}
_MOVE_DELTAS = {
    "NW": (-1, -1),
    "NE": (-1, 1),
    "SW": (1, -1),
    "SE": (1, 1),
    "JNW": (-2, -2),
    "JNE": (-2, 2),
    "JSW": (2, -2),
    "JSE": (2, 2),
}


@dataclass(frozen=True)
class DecodedAction:
    source_square: int
    move_type_id: int
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


def move_type_id(move_type: int | str) -> int:
    if isinstance(move_type, int):
        if not 0 <= move_type < len(MOVE_TYPES):
            raise ValueError(f"move type id must be in [0, {len(MOVE_TYPES)}), got {move_type}")
        return move_type
    try:
        return MOVE_TYPE_TO_ID[move_type]
    except KeyError as exc:
        raise ValueError(f"unknown move type: {move_type}") from exc


def encode_action(source_square: int, move_type: int | str) -> int:
    source_square = int(source_square)
    if not 0 <= source_square < PLAYABLE_SQUARES:
        raise ValueError(f"source square must be in [0, {PLAYABLE_SQUARES}), got {source_square}")
    return source_square * len(MOVE_TYPES) + move_type_id(move_type)


def decode_action(action: int) -> DecodedAction:
    if not 0 <= action < ACTION_SIZE:
        raise ValueError(f"action must be in [0, {ACTION_SIZE}), got {action}")
    source_square, move_type_idx = divmod(action, len(MOVE_TYPES))
    return DecodedAction(
        source_square=source_square,
        move_type_id=move_type_idx,
        move_type=MOVE_TYPES[move_type_idx],
    )


def destination_coords(source_square: int, move_type: int | str) -> tuple[int, int]:
    row, col = square_to_coords(source_square)
    delta_row, delta_col = _MOVE_DELTAS[MOVE_TYPES[move_type_id(move_type)]]
    return row + delta_row, col + delta_col


def rotate_coords_180(row: int, col: int) -> tuple[int, int]:
    return BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - col


def rotate_square_180(square: int) -> int:
    row, col = square_to_coords(square)
    return coords_to_square(*rotate_coords_180(row, col))


def rotate_move_type_180(move_type: int | str) -> str:
    return _ROTATED_MOVE_TYPES[MOVE_TYPES[move_type_id(move_type)]]


def canonicalize_square(square: int, player: int) -> int:
    return square if player > 0 else rotate_square_180(square)


def canonicalize_action(action: int, player: int) -> int:
    decoded = decode_action(action)
    if player > 0:
        return action
    return encode_action(
        rotate_square_180(decoded.source_square),
        rotate_move_type_180(decoded.move_type),
    )

