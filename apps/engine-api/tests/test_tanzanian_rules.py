from __future__ import annotations

from kingme_engine_api.runtime.checkers_v2.action_encoding import coords_to_square
from kingme_engine_api.runtime.checkers_v2.rules import CHECKERS_V2_RULESET
from kingme_engine_api.runtime.checkers_v2.runtime import (
    DRAW,
    RED,
    WHITE_MAN,
    CheckersState,
)
from kingme_engine_api.runtime.engine import apply_macro_move, legal_macro_moves, structural_balance_terms


def test_flying_king_can_slide_multiple_diagonal_squares() -> None:
    state = CheckersState.from_rows(
        (
            "........",
            "........",
            "........",
            "..R.....",
            "........",
            "........",
            "........",
            "........",
        ),
        side_to_move=RED,
    )

    moves = legal_macro_moves(state)

    assert moves
    assert all(not move.is_capture for move in moves)
    assert {move.final_square for move in moves} == {
        coords_to_square(2, 1),
        coords_to_square(1, 0),
        coords_to_square(2, 3),
        coords_to_square(1, 4),
        coords_to_square(0, 5),
        coords_to_square(4, 1),
        coords_to_square(5, 0),
        coords_to_square(4, 3),
        coords_to_square(5, 4),
        coords_to_square(6, 5),
        coords_to_square(7, 6),
    }


def test_flying_king_can_land_beyond_captured_piece() -> None:
    state = CheckersState.from_rows(
        (
            "........",
            "........",
            "...w....",
            "..R.....",
            "........",
            "........",
            "........",
            "........",
        ),
        side_to_move=RED,
    )

    moves = legal_macro_moves(state)

    assert moves
    assert all(move.is_capture for move in moves)
    assert {move.final_square for move in moves} == {
        coords_to_square(1, 4),
        coords_to_square(0, 5),
    }


def test_applying_flying_king_capture_removes_the_jumped_piece() -> None:
    state = CheckersState.from_rows(
        (
            "........",
            "........",
            "...w....",
            "..R.....",
            "........",
            "........",
            "........",
            "........",
        ),
        side_to_move=RED,
    )

    move = next(
        item for item in legal_macro_moves(state) if item.final_square == coords_to_square(0, 5)
    )
    apply_macro_move(state, move)

    assert state.board[coords_to_square(0, 5)] > 0
    assert state.board[coords_to_square(2, 3)] == 0
    assert state.side_to_move == -RED


def test_flying_king_multicapture_keeps_jumped_piece_until_turn_end() -> None:
    state = CheckersState.from_rows(
        (
            "........",
            "........",
            ".....w..",
            "........",
            ".w......",
            "R.......",
            "........",
            "........",
        ),
        side_to_move=RED,
    )

    move = next(item for item in legal_macro_moves(state) if item.path == (20, 6, 15))
    first_action, second_action = move.actions
    first_captured_square = coords_to_square(4, 1)
    second_captured_square = coords_to_square(2, 5)

    state.apply(first_action)

    assert state.forced_square == coords_to_square(1, 4)
    assert state.pending_captures == {first_captured_square}
    assert state.board[first_captured_square] == WHITE_MAN

    state.apply(second_action)

    assert state.pending_captures == frozenset()
    assert state.forced_square is None
    assert state.board[first_captured_square] == 0
    assert state.board[second_captured_square] == 0
    assert state.side_to_move == -RED


def test_blocked_flying_king_ray_does_not_count_as_threat() -> None:
    state = CheckersState.from_rows(
        (
            ".....w..",
            "....w...",
            "........",
            "..R.....",
            "........",
            "........",
            "........",
            "........",
        ),
        side_to_move=RED,
    )

    terms = structural_balance_terms(state)

    assert terms.threatened_men == 0


def test_bare_kings_are_an_immediate_draw() -> None:
    state = CheckersState.from_rows(
        (
            "........",
            "R.......",
            "........",
            "........",
            "........",
            "........",
            "........",
            "W.......",
        ),
        side_to_move=RED,
    )

    assert state.winner() == DRAW
    assert legal_macro_moves(state) == []


def test_lone_king_low_material_endgame_is_playable_before_draw_limit() -> None:
    state = CheckersState.from_rows(
        (
            ".......W",
            "........",
            "...r....",
            "........",
            ".r......",
            "....R...",
            "........",
            "........",
        ),
        side_to_move=RED,
        no_progress_count=CHECKERS_V2_RULESET.low_material_draw_halfmoves - 1,
    )

    assert state.winner() is None
    assert legal_macro_moves(state)


def test_lone_king_low_material_endgame_draws_after_short_quiet_limit() -> None:
    state = CheckersState.from_rows(
        (
            ".......W",
            "........",
            "...r....",
            "........",
            ".r......",
            "....R...",
            "........",
            "........",
        ),
        side_to_move=RED,
        no_progress_count=CHECKERS_V2_RULESET.low_material_draw_halfmoves,
    )

    assert state.winner() == DRAW
    assert legal_macro_moves(state) == []
