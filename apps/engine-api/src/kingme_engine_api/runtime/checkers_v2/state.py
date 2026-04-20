"""Slow reference state for Tanzanian-style 8x8 draughts serving."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np

from .action_encoding import coords_to_square, decode_action, encode_action, rotate_coords_180, square_to_coords
from .rules import CHECKERS_V2_RULESET

EMPTY = 0
RED = 1
WHITE = -1
DRAW = 0

RED_MAN = 1
RED_KING = 2
WHITE_MAN = -1
WHITE_KING = -2

PIECE_TO_CHAR = {
    EMPTY: ".",
    RED_MAN: "r",
    RED_KING: "R",
    WHITE_MAN: "w",
    WHITE_KING: "W",
}
CHAR_TO_PIECE = {value: key for key, value in PIECE_TO_CHAR.items() if key != EMPTY}


@dataclass(frozen=True)
class Move:
    action: int
    source_square: int
    destination_square: int
    is_capture: bool
    captured_square: int | None = None


def _piece_owner(piece: int) -> int:
    if piece > 0:
        return RED
    if piece < 0:
        return WHITE
    return EMPTY


def _is_king(piece: int) -> bool:
    return abs(piece) == 2


def _promotion_row(player: int) -> int:
    return 7 if player == RED else 0


def _step_move_types(piece: int) -> tuple[str, ...]:
    if _piece_owner(piece) == RED:
        return ("SW", "SE")
    return ("NW", "NE")


def _capture_move_types(piece: int) -> tuple[str, ...]:
    if _piece_owner(piece) == RED:
        return ("JSW", "JSE")
    return ("JNW", "JNE")


def _all_directions() -> tuple[tuple[int, int], ...]:
    return ((-1, -1), (-1, 1), (1, -1), (1, 1))


def _move_directions(piece: int) -> tuple[tuple[int, int], ...]:
    if _is_king(piece):
        return _all_directions()
    if _piece_owner(piece) == RED:
        return ((1, -1), (1, 1))
    return ((-1, -1), (-1, 1))


def _capture_directions(piece: int) -> tuple[tuple[int, int], ...]:
    if _is_king(piece):
        return _all_directions()
    if _piece_owner(piece) == RED:
        return ((1, -1), (1, 1))
    return ((-1, -1), (-1, 1))


def _ray_squares(square: int, delta_row: int, delta_col: int) -> list[int]:
    row, col = square_to_coords(square)
    squares: list[int] = []
    row += delta_row
    col += delta_col
    while 0 <= row < 8 and 0 <= col < 8:
        if (row + col) % 2 == 1:
            squares.append(coords_to_square(row, col))
        row += delta_row
        col += delta_col
    return squares


def _adjacent_square(square: int, delta_row: int, delta_col: int) -> int | None:
    row, col = square_to_coords(square)
    row += delta_row
    col += delta_col
    if not (0 <= row < 8 and 0 <= col < 8 and (row + col) % 2 == 1):
        return None
    return coords_to_square(row, col)


def _initial_board() -> list[int]:
    board = [EMPTY] * CHECKERS_V2_RULESET.playable_squares
    for square in range(12):
        board[square] = RED_MAN
    for square in range(20, 32):
        board[square] = WHITE_MAN
    return board


class CheckersState:
    def __init__(
        self,
        board: Sequence[int] | None = None,
        side_to_move: int = RED,
        forced_square: int | None = None,
        no_progress_count: int = 0,
        repetition_counts: dict[tuple[tuple[int, ...], int], int] | None = None,
    ):
        self.board = list(board) if board is not None else _initial_board()
        if len(self.board) != CHECKERS_V2_RULESET.playable_squares:
            raise ValueError("board must contain 32 playable squares")
        if side_to_move not in (RED, WHITE):
            raise ValueError("side_to_move must be RED or WHITE")
        self.side_to_move = side_to_move
        self.forced_square = forced_square
        self.no_progress_count = no_progress_count
        self.repetition_counts = dict(repetition_counts or {})
        self._winner: int | None = None
        if not self.repetition_counts:
            self.repetition_counts[self.position_key()] = 1

    @classmethod
    def initial(cls) -> "CheckersState":
        return cls()

    @classmethod
    def from_rows(
        cls,
        rows: Sequence[str],
        side_to_move: int = RED,
        forced_square: int | None = None,
        no_progress_count: int = 0,
        repetition_counts: dict[tuple[tuple[int, ...], int], int] | None = None,
    ) -> "CheckersState":
        if len(rows) != CHECKERS_V2_RULESET.board_size:
            raise ValueError("rows must contain exactly 8 rows")
        board = [EMPTY] * CHECKERS_V2_RULESET.playable_squares
        for row_idx, row in enumerate(rows):
            if len(row) != CHECKERS_V2_RULESET.board_size:
                raise ValueError("each row must contain exactly 8 characters")
            for col_idx, char in enumerate(row):
                if char == ".":
                    continue
                square = coords_to_square(row_idx, col_idx)
                try:
                    board[square] = CHAR_TO_PIECE[char]
                except KeyError as exc:
                    raise ValueError(f"unsupported board character: {char!r}") from exc
        return cls(
            board=board,
            side_to_move=side_to_move,
            forced_square=forced_square,
            no_progress_count=no_progress_count,
            repetition_counts=repetition_counts,
        )

    def clone(self) -> "CheckersState":
        cloned = CheckersState(
            board=self.board,
            side_to_move=self.side_to_move,
            forced_square=self.forced_square,
            no_progress_count=self.no_progress_count,
            repetition_counts=self.repetition_counts,
        )
        cloned._winner = self._winner
        return cloned

    def position_key(self) -> tuple[tuple[int, ...], int]:
        return tuple(self.board), self.side_to_move

    def legal_actions(self) -> list[int]:
        if self._winner is not None or self._is_drawn():
            return []
        return self._generate_legal_actions()

    def canonical_planes(self) -> np.ndarray:
        planes = np.zeros(CHECKERS_V2_RULESET.canonical_observation_shape, dtype=np.float32)
        progress_value = min(
            self.no_progress_count / CHECKERS_V2_RULESET.no_progress_draw_halfmoves,
            1.0,
        )
        for square, piece in enumerate(self.board):
            if piece == EMPTY:
                continue
            row, col = square_to_coords(square)
            if self.side_to_move == WHITE:
                row, col = rotate_coords_180(row, col)
                piece = -piece
            if piece == RED_MAN:
                planes[0, row, col] = 1.0
            elif piece == RED_KING:
                planes[1, row, col] = 1.0
            elif piece == WHITE_MAN:
                planes[2, row, col] = 1.0
            elif piece == WHITE_KING:
                planes[3, row, col] = 1.0
        if self.forced_square is not None:
            row, col = square_to_coords(self.forced_square)
            if self.side_to_move == WHITE:
                row, col = rotate_coords_180(row, col)
            planes[4, row, col] = 1.0
        for square in range(CHECKERS_V2_RULESET.playable_squares):
            row, col = square_to_coords(square)
            if self.side_to_move == WHITE:
                row, col = rotate_coords_180(row, col)
            planes[5, row, col] = 1.0
        planes[6, :, :] = progress_value
        planes[7, :, :] = 1.0
        return planes

    def apply(self, action: int) -> None:
        legal_actions = self._generate_legal_actions()
        if action not in legal_actions:
            raise ValueError(f"illegal action {action} for current state")
        decoded = decode_action(action)
        source_square = decoded.source_square
        source_piece = self.board[source_square]
        if source_piece == EMPTY:
            raise ValueError("cannot move from an empty source square")
        destination_square = decoded.destination_square
        is_capture = decoded.is_capture
        self._winner = None
        if is_capture:
            self._apply_capture(source_square, destination_square, source_piece)
            return
        self._apply_step(source_square, destination_square, source_piece)

    def winner(self) -> int | None:
        if self._winner is not None:
            return self._winner
        if not self._player_has_pieces(self.side_to_move):
            return -self.side_to_move
        if not self._generate_legal_actions():
            return -self.side_to_move
        if self._is_drawn():
            return DRAW
        return None

    def is_terminal(self) -> bool:
        return self.winner() is not None

    def zobrist(self) -> int:
        return hash(self.position_key())

    def to_ascii(self) -> str:
        rows = [["."] * CHECKERS_V2_RULESET.board_size for _ in range(CHECKERS_V2_RULESET.board_size)]
        for square, piece in enumerate(self.board):
            row, col = square_to_coords(square)
            rows[row][col] = PIECE_TO_CHAR[piece]
        return "\n".join("".join(row) for row in rows)

    def _generate_legal_actions(self) -> list[int]:
        source_squares = self._source_squares()
        captures: list[int] = []
        for square in source_squares:
            captures.extend(self._capture_actions_for_square(square))
        if captures:
            return sorted(captures)
        if self.forced_square is not None:
            return []
        moves: list[int] = []
        for square in source_squares:
            moves.extend(self._step_actions_for_square(square))
        return sorted(moves)

    def _source_squares(self) -> list[int]:
        if self.forced_square is not None:
            return [self.forced_square]
        return [square for square, piece in enumerate(self.board) if _piece_owner(piece) == self.side_to_move]

    def _capture_actions_for_square(self, square: int) -> list[int]:
        piece = self.board[square]
        if _piece_owner(piece) != self.side_to_move:
            return []
        if _is_king(piece):
            return self._king_capture_actions(square, piece)
        actions: list[int] = []
        for move_type in _capture_move_types(piece):
            action = self._candidate_step_or_jump(square, move_type, require_capture=True)
            if action is not None:
                actions.append(action)
        return actions

    def _step_actions_for_square(self, square: int) -> list[int]:
        piece = self.board[square]
        if _piece_owner(piece) != self.side_to_move:
            return []
        if _is_king(piece):
            return self._king_step_actions(square, piece)
        actions: list[int] = []
        for move_type in _step_move_types(piece):
            action = self._candidate_step_or_jump(square, move_type, require_capture=False)
            if action is not None:
                actions.append(action)
        return actions

    def _candidate_step_or_jump(self, source_square: int, move_type: str, require_capture: bool) -> int | None:
        delta_row, delta_col = {
            "NW": (-1, -1),
            "NE": (-1, 1),
            "SW": (1, -1),
            "SE": (1, 1),
            "JNW": (-1, -1),
            "JNE": (-1, 1),
            "JSW": (1, -1),
            "JSE": (1, 1),
        }[move_type]
        if require_capture:
            middle_square = _adjacent_square(source_square, delta_row, delta_col)
            destination_square = _adjacent_square(source_square, 2 * delta_row, 2 * delta_col)
            if middle_square is None or destination_square is None:
                return None
            middle_piece = self.board[middle_square]
            if self.board[destination_square] != EMPTY:
                return None
            if middle_piece == EMPTY or _piece_owner(middle_piece) == self.side_to_move:
                return None
            return encode_action(source_square, destination_square, True)

        destination_square = _adjacent_square(source_square, delta_row, delta_col)
        if destination_square is None or self.board[destination_square] != EMPTY:
            return None
        return encode_action(source_square, destination_square, False)

    def _apply_step(self, source_square: int, destination_square: int, piece: int) -> None:
        self.board[source_square] = EMPTY
        promoted = self._should_promote(piece, destination_square)
        self.board[destination_square] = self._promoted_piece(piece) if promoted else piece
        self.forced_square = None
        self.no_progress_count = 0 if promoted else self.no_progress_count + 1
        mover = self.side_to_move
        self.side_to_move = -self.side_to_move
        self._finalize_turn(mover)

    def _apply_capture(self, source_square: int, destination_square: int, piece: int) -> None:
        captured_square = self._captured_square(source_square, destination_square, piece)
        if captured_square is None:
            raise ValueError("capture move is missing a captured piece")
        self.board[source_square] = EMPTY
        self.board[captured_square] = EMPTY
        promoted = self._should_promote(piece, destination_square)
        next_piece = self._promoted_piece(piece) if promoted else piece
        self.board[destination_square] = next_piece
        self.no_progress_count = 0
        if promoted:
            self.forced_square = None
            mover = self.side_to_move
            self.side_to_move = -self.side_to_move
            self._finalize_turn(mover)
            return
        if self._capture_actions_for_piece(destination_square, next_piece):
            self.forced_square = destination_square
            return
        self.forced_square = None
        mover = self.side_to_move
        self.side_to_move = -self.side_to_move
        self._finalize_turn(mover)

    def _capture_actions_for_piece(self, square: int, piece: int) -> list[int]:
        if _is_king(piece):
            return self._king_capture_actions(square, piece)
        actions: list[int] = []
        for move_type in _capture_move_types(piece):
            action = self._candidate_step_or_jump(square, move_type, require_capture=True)
            if action is not None:
                actions.append(action)
        return actions

    def _king_step_actions(self, square: int, piece: int) -> list[int]:
        if _piece_owner(piece) != self.side_to_move:
            return []
        actions: list[int] = []
        for delta_row, delta_col in _move_directions(piece):
            for target_square in _ray_squares(square, delta_row, delta_col):
                if self.board[target_square] != EMPTY:
                    break
                actions.append(encode_action(square, target_square, False))
        return actions

    def _king_capture_actions(self, square: int, piece: int) -> list[int]:
        if _piece_owner(piece) != self.side_to_move:
            return []
        actions: list[int] = []
        for delta_row, delta_col in _capture_directions(piece):
            seen_enemy: int | None = None
            for target_square in _ray_squares(square, delta_row, delta_col):
                target_piece = self.board[target_square]
                if target_piece == EMPTY:
                    if seen_enemy is not None:
                        actions.append(encode_action(square, target_square, True))
                    continue
                if _piece_owner(target_piece) == self.side_to_move:
                    break
                if seen_enemy is not None:
                    break
                seen_enemy = target_square
        return actions

    def _captured_square(self, source_square: int, destination_square: int, piece: int) -> int | None:
        source_row, source_col = square_to_coords(source_square)
        dest_row, dest_col = square_to_coords(destination_square)
        delta_row = dest_row - source_row
        delta_col = dest_col - source_col
        if delta_row == 0 or delta_col == 0 or abs(delta_row) != abs(delta_col):
            return None

        step_row = 1 if delta_row > 0 else -1
        step_col = 1 if delta_col > 0 else -1
        row = source_row + step_row
        col = source_col + step_col
        captured_square: int | None = None
        while row != dest_row and col != dest_col:
            square = coords_to_square(row, col)
            occupant = self.board[square]
            if occupant != EMPTY:
                if _piece_owner(occupant) == _piece_owner(piece):
                    return None
                if captured_square is not None:
                    return None
                captured_square = square
            row += step_row
            col += step_col
        return captured_square

    def _finalize_turn(self, mover: int) -> None:
        if not self._player_has_pieces(self.side_to_move) or not self._generate_legal_actions():
            self._winner = mover
            return
        key = self.position_key()
        self.repetition_counts[key] = self.repetition_counts.get(key, 0) + 1
        if self.repetition_counts[key] >= CHECKERS_V2_RULESET.repetition_draw_count:
            self._winner = DRAW
            return
        if self.no_progress_count >= CHECKERS_V2_RULESET.no_progress_draw_halfmoves:
            self._winner = DRAW

    def _player_has_pieces(self, player: int) -> bool:
        return any(_piece_owner(piece) == player for piece in self.board)

    def _is_drawn(self) -> bool:
        if self.no_progress_count >= CHECKERS_V2_RULESET.no_progress_draw_halfmoves:
            return True
        return self.repetition_counts.get(self.position_key(), 0) >= CHECKERS_V2_RULESET.repetition_draw_count

    def _should_promote(self, piece: int, destination_square: int) -> bool:
        if _is_king(piece):
            return False
        row, _ = square_to_coords(destination_square)
        return row == _promotion_row(_piece_owner(piece))

    def _promoted_piece(self, piece: int) -> int:
        return RED_KING if _piece_owner(piece) == RED else WHITE_KING
