from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

import numpy as np

from .checkers_v2.action_encoding import (
    canonicalize_square,
    coords_to_square,
    decode_action,
    playable_square_coords,
    square_to_coords,
)
from .checkers_v2.runtime import (
    RED,
    RED_KING,
    RED_MAN,
    WHITE,
    WHITE_KING,
    WHITE_MAN,
    CheckersState,
)


@dataclass(frozen=True)
class MacroMove:
    actions: tuple[int, ...]
    path: tuple[int, ...]
    is_capture: bool
    capture_count: int
    promotes: bool
    final_square: int


@dataclass(frozen=True)
class StructuralBalanceTerms:
    red_men: int
    red_kings: int
    white_men: int
    white_kings: int
    advancement: int
    center_control: int
    back_rank_guard: int
    threatened_men: int
    threatened_kings: int
    runaway: int
    king_mobility: int
    king_center: int
    supported_man: int
    connected_piece: int
    promotion_threat: int
    king_trap: int


MOVE_FEATURE_SIZE = 100
_ALL_DIRECTIONS = ((-1, -1), (-1, 1), (1, -1), (1, 1))


def action_destination_square(action: int) -> int:
    return decode_action(action).destination_square


def _step_directions(piece: int) -> tuple[tuple[int, int], ...]:
    if piece in (RED_KING, WHITE_KING):
        return _ALL_DIRECTIONS
    if piece == RED_MAN:
        return ((1, -1), (1, 1))
    if piece == WHITE_MAN:
        return ((-1, -1), (-1, 1))
    return ()


def _adjacent_square(square: int, delta_row: int, delta_col: int) -> int | None:
    row, col = square_to_coords(square)
    dest_row = row + delta_row
    dest_col = col + delta_col
    if not (0 <= dest_row < 8 and 0 <= dest_col < 8 and (dest_row + dest_col) % 2 == 1):
        return None
    return coords_to_square(dest_row, dest_col)


def _jump_landing_square(square: int, delta_row: int, delta_col: int) -> int | None:
    row, col = square_to_coords(square)
    landing_row = row + 2 * delta_row
    landing_col = col + 2 * delta_col
    if not (0 <= landing_row < 8 and 0 <= landing_col < 8 and (landing_row + landing_col) % 2 == 1):
        return None
    return coords_to_square(landing_row, landing_col)


def _ray_squares(square: int, delta_row: int, delta_col: int) -> tuple[int, ...]:
    row, col = square_to_coords(square)
    squares: list[int] = []
    row += delta_row
    col += delta_col
    while 0 <= row < 8 and 0 <= col < 8:
        if (row + col) % 2 == 1:
            squares.append(coords_to_square(row, col))
        row += delta_row
        col += delta_col
    return tuple(squares)


def _is_enemy_piece(piece: int, other: int) -> bool:
    return piece != 0 and other != 0 and ((piece > 0) != (other > 0))


def _mark_threatened_piece(
    piece: int,
    square: int,
    threatened_red_men: set[int],
    threatened_red_kings: set[int],
    threatened_white_men: set[int],
    threatened_white_kings: set[int],
) -> None:
    if piece == RED_MAN:
        threatened_red_men.add(square)
    elif piece == RED_KING:
        threatened_red_kings.add(square)
    elif piece == WHITE_MAN:
        threatened_white_men.add(square)
    elif piece == WHITE_KING:
        threatened_white_kings.add(square)


def legal_macro_moves(state: CheckersState) -> list[MacroMove]:
    if state.is_terminal():
        return []
    player = state.side_to_move
    moves: list[MacroMove] = []
    for action in sorted(state.legal_actions()):
        source_square = decode_action(action).source_square
        source_piece = state.board[source_square]
        next_state = state.clone()
        next_state.apply(action)
        _extend_macro_move(
            state=next_state,
            player=player,
            source_piece=source_piece,
            actions=(action,),
            path=(source_square, action_destination_square(action)),
            capture_count=int(decode_action(action).is_capture),
            out=moves,
        )
    moves.sort(key=lambda move: move.actions)
    return moves


def _extend_macro_move(
    state: CheckersState,
    player: int,
    source_piece: int,
    actions: tuple[int, ...],
    path: tuple[int, ...],
    capture_count: int,
    out: list[MacroMove],
) -> None:
    if state.side_to_move != player or state.forced_square is None or state.is_terminal():
        final_square = path[-1]
        final_piece = state.board[final_square]
        promotes = abs(source_piece) == 1 and abs(final_piece) == 2
        out.append(
            MacroMove(
                actions=actions,
                path=path,
                is_capture=capture_count > 0,
                capture_count=capture_count,
                promotes=promotes,
                final_square=final_square,
            )
        )
        return
    for action in sorted(state.legal_actions()):
        next_state = state.clone()
        next_state.apply(action)
        _extend_macro_move(
            state=next_state,
            player=player,
            source_piece=source_piece,
            actions=actions + (action,),
            path=path + (action_destination_square(action),),
            capture_count=capture_count + int(decode_action(action).is_capture),
            out=out,
        )


def apply_macro_move(state: CheckersState, move: MacroMove | Sequence[int] | object) -> None:
    actions = tuple(move.actions) if hasattr(move, "actions") else tuple(move)
    for action in actions:
        state.apply(action)


def macro_move_to_pdn(move: MacroMove) -> str:
    separator = "x" if move.is_capture else "-"
    return separator.join(str(square + 1) for square in move.path)


def macro_move_feature_vector(move: MacroMove, player: int) -> np.ndarray:
    features = np.zeros(MOVE_FEATURE_SIZE, dtype=np.float32)
    source_square = canonicalize_square(move.path[0], player)
    final_square = canonicalize_square(move.final_square, player)
    features[source_square] = 1.0
    features[32 + final_square] = 1.0
    for square in move.path[1:]:
        features[64 + canonicalize_square(square, player)] = 1.0
    features[96] = float(move.is_capture)
    features[97] = min(move.capture_count, 4) / 4.0
    features[98] = float(move.promotes)
    features[99] = min(len(move.actions), 6) / 6.0
    return features


def macro_move_feature_matrix(moves: Iterable[MacroMove], player: int) -> np.ndarray:
    matrix = [macro_move_feature_vector(move, player) for move in moves]
    if not matrix:
        return np.zeros((0, MOVE_FEATURE_SIZE), dtype=np.float32)
    return np.stack(matrix, axis=0)


def state_to_dark_planes(state: CheckersState) -> np.ndarray:
    planes = state.canonical_planes()
    dark = np.zeros((planes.shape[0], 8, 4), dtype=planes.dtype)
    for square in range(32):
        row, col = square_to_coords(square)
        dark[:, row, col // 2] = planes[:, row, col]
    return dark


def piece_counts(state: CheckersState) -> dict[str, int]:
    counts = {
        "red_men": 0,
        "red_kings": 0,
        "white_men": 0,
        "white_kings": 0,
    }
    for piece in state.board:
        if piece == RED_MAN:
            counts["red_men"] += 1
        elif piece == RED_KING:
            counts["red_kings"] += 1
        elif piece == WHITE_MAN:
            counts["white_men"] += 1
        elif piece == WHITE_KING:
            counts["white_kings"] += 1
    return counts


def structural_balance_terms(state: CheckersState, max_runaway_steps: int = 3) -> StructuralBalanceTerms:
    board = state.board
    red_men = 0
    red_kings = 0
    white_men = 0
    white_kings = 0
    advancement = 0
    center_control = 0
    back_rank_guard = 0
    threatened_red_men: set[int] = set()
    threatened_red_kings: set[int] = set()
    threatened_white_men: set[int] = set()
    threatened_white_kings: set[int] = set()
    runaway = 0
    king_mobility = 0
    king_center = 0
    supported_man = 0
    connected_piece = 0
    promotion_threat = 0
    king_trap = 0
    center_rows = {2, 3, 4, 5}
    center_cols = {2, 3, 4, 5}

    for square, piece in enumerate(board):
        if piece == 0:
            continue
        row, col = square_to_coords(square)
        is_red = piece > 0
        is_man = abs(piece) == 1
        is_king = abs(piece) == 2
        if piece == RED_MAN:
            red_men += 1
            advancement += row
            if row == 0:
                back_rank_guard += 1
        elif piece == RED_KING:
            red_kings += 1
        elif piece == WHITE_MAN:
            white_men += 1
            advancement -= 7 - row
            if row == 7:
                back_rank_guard -= 1
        elif piece == WHITE_KING:
            white_kings += 1
        if row in center_rows and col in center_cols:
            center_control += 1 if is_red else -1
        if is_king:
            row_score = 3 - min(abs(row - 3), abs(row - 4))
            col_score = 3 - min(abs(col - 3), abs(col - 4))
            score = row_score + col_score
            king_center += score if is_red else -score
        if is_man:
            steps = _minimum_runaway_steps(state, square, piece, max_runaway_steps)
            if steps is not None and steps > 0:
                bonus = max_runaway_steps + 1 - steps
                runaway += bonus if is_red else -bonus
            support_dirs = ((-1, -1), (-1, 1)) if piece == RED_MAN else ((1, -1), (1, 1))
            supported = False
            for delta_row, delta_col in support_dirs:
                neighbor = _adjacent_square(square, delta_row, delta_col)
                if neighbor is not None:
                    other = board[neighbor]
                    if other != 0 and ((piece > 0) == (other > 0)):
                        supported = True
            piece_promotion_threat = 0
            for delta_row, delta_col in _step_directions(piece):
                destination_square = _adjacent_square(square, delta_row, delta_col)
                if destination_square is not None and board[destination_square] == 0:
                    dest_row, _ = square_to_coords(destination_square)
                    if (piece == RED_MAN and dest_row == 7) or (piece == WHITE_MAN and dest_row == 0):
                        piece_promotion_threat = max(piece_promotion_threat, 2)
                middle_square = _adjacent_square(square, delta_row, delta_col)
                landing_square = _jump_landing_square(square, delta_row, delta_col)
                if middle_square is None or landing_square is None:
                    continue
                middle_piece = board[middle_square]
                if not _is_enemy_piece(piece, middle_piece) or board[landing_square] != 0:
                    continue
                if middle_piece == RED_MAN:
                    threatened_red_men.add(middle_square)
                elif middle_piece == RED_KING:
                    threatened_red_kings.add(middle_square)
                elif middle_piece == WHITE_MAN:
                    threatened_white_men.add(middle_square)
                elif middle_piece == WHITE_KING:
                    threatened_white_kings.add(middle_square)
                landing_row, _ = square_to_coords(landing_square)
                if (piece == RED_MAN and landing_row == 7) or (piece == WHITE_MAN and landing_row == 0):
                    piece_promotion_threat = max(piece_promotion_threat, 3)
            if supported:
                supported_man += 1 if is_red else -1
            if piece_promotion_threat:
                promotion_threat += piece_promotion_threat if is_red else -piece_promotion_threat
        if is_king:
            mobility = 0
            for delta_row, delta_col in _ALL_DIRECTIONS:
                seen_enemy: int | None = None
                seen_enemy_piece = 0
                for target_square in _ray_squares(square, delta_row, delta_col):
                    target_piece = board[target_square]
                    if target_piece == 0:
                        if seen_enemy is None:
                            mobility += 1
                        else:
                            mobility += 2
                            _mark_threatened_piece(
                                seen_enemy_piece,
                                seen_enemy,
                                threatened_red_men,
                                threatened_red_kings,
                                threatened_white_men,
                                threatened_white_kings,
                            )
                        continue
                    if not _is_enemy_piece(piece, target_piece):
                        break
                    if seen_enemy is not None:
                        break
                    seen_enemy = target_square
                    seen_enemy_piece = target_piece
            if mobility <= 1:
                mobility -= 1
                king_trap += 1 if not is_red else -1
            king_mobility += mobility if is_red else -mobility
        connections = 0
        for delta_row, delta_col in _ALL_DIRECTIONS:
            neighbor = _adjacent_square(square, delta_row, delta_col)
            if neighbor is None:
                continue
            other = board[neighbor]
            if other != 0 and ((piece > 0) == (other > 0)):
                connections += 1
        if connections > 0:
            connected_piece += min(connections, 2) if is_red else -min(connections, 2)

    threatened_men = len(threatened_white_men) - len(threatened_red_men)
    threatened_kings = len(threatened_white_kings) - len(threatened_red_kings)
    return StructuralBalanceTerms(
        red_men=red_men,
        red_kings=red_kings,
        white_men=white_men,
        white_kings=white_kings,
        advancement=advancement,
        center_control=center_control,
        back_rank_guard=back_rank_guard,
        threatened_men=threatened_men,
        threatened_kings=threatened_kings,
        runaway=runaway,
        king_mobility=king_mobility,
        king_center=king_center,
        supported_man=supported_man,
        connected_piece=connected_piece,
        promotion_threat=promotion_threat,
        king_trap=king_trap,
    )


def _minimum_runaway_steps(state: CheckersState, square: int, piece: int, remaining_steps: int) -> int | None:
    row, _ = square_to_coords(square)
    if piece == RED_MAN and row == 7:
        return 0
    if piece == WHITE_MAN and row == 0:
        return 0
    if remaining_steps == 0:
        return None
    best: int | None = None
    for delta_row, delta_col in _step_directions(piece):
        destination_square = _adjacent_square(square, delta_row, delta_col)
        if destination_square is None or state.board[destination_square] != 0:
            continue
        child = _minimum_runaway_steps(state, destination_square, piece, remaining_steps - 1)
        if child is None:
            continue
        total_steps = child + 1
        if best is None or total_steps < best:
            best = total_steps
    return best


def current_player_sign(player: int) -> int:
    if player not in (RED, WHITE):
        raise ValueError(f"unsupported player {player}")
    return 1 if player == RED else -1
