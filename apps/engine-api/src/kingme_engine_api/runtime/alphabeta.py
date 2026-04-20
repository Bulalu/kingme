from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from itertools import islice
from pathlib import Path
from typing import Any, Literal, Mapping

from .checkers_v2.runtime import DRAW, CheckersState
from .engine import (
    MacroMove,
    apply_macro_move,
    current_player_sign,
    legal_macro_moves,
    macro_move_to_pdn,
    structural_balance_terms,
)


WIN_SCORE = 1_000_000
INF = 10 * WIN_SCORE


@dataclass(frozen=True)
class SearchResult:
    best_move: MacroMove | None
    score: int
    depth: int
    nodes: int
    principal_variation: tuple[MacroMove, ...]


@dataclass
class TTEntry:
    depth: int
    score: int
    flag: Literal["exact", "lower", "upper"]
    best_move_actions: tuple[int, ...] | None
    generation: int


@dataclass(frozen=True)
class EvalWeights:
    man_value: int = 100
    king_value: int = 175
    endgame_king_bonus: int = 36
    advancement_weight: int = 3
    center_weight: int = 8
    back_rank_weight: int = 5
    mobility_bonus: int = 2
    low_mobility_penalty: int = 12
    threatened_man_weight: int = 14
    threatened_king_weight: int = 24
    runaway_weight: int = 10
    king_mobility_weight: int = 4
    king_center_weight: int = 4
    supported_man_weight: int = 6
    connected_piece_weight: int = 3
    promotion_threat_weight: int = 16
    king_trap_weight: int = 10

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any]) -> "EvalWeights":
        data = {
            field_name: int(raw.get(field_name, getattr(cls, field_name)))
            for field_name in cls.__dataclass_fields__
        }
        return cls(**data)

    @classmethod
    def from_path(cls, path: str | Path) -> "EvalWeights":
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("eval weights file must contain a JSON object")
        return cls.from_mapping(payload)


class AlphaBetaAgent:
    def __init__(
        self,
        max_depth: int = 6,
        transposition_capacity: int = 200_000,
        enable_quiescence: bool = True,
        eval_weights: EvalWeights | None = None,
    ):
        self.max_depth = max_depth
        self.transposition_capacity = transposition_capacity
        self.enable_quiescence = enable_quiescence
        self.eval_weights = eval_weights or EvalWeights()
        self._tt: dict[tuple[object, ...], TTEntry] = {}
        self._nodes = 0
        self._search_generation = 0
        self._legal_move_cache: dict[tuple[object, ...], tuple[MacroMove, ...]] = {}
        self._killer_moves: dict[int, list[tuple[int, ...]]] = {}
        self._history_scores: dict[tuple[int, ...], int] = {}

    def search(self, state: CheckersState) -> SearchResult:
        if state.forced_square is not None:
            raise ValueError("alpha-beta search expects turn-boundary states, not mid-jump states")
        self._nodes = 0
        self._search_generation += 1
        self._legal_move_cache.clear()
        self._killer_moves.clear()
        self._history_scores.clear()
        best_move: MacroMove | None = None
        best_score = -INF
        principal_variation: tuple[MacroMove, ...] = ()
        aspiration_window = 64
        for depth in range(1, self.max_depth + 1):
            if depth == 1 or abs(best_score) >= WIN_SCORE:
                score, pv = self._negamax(state, depth, -INF, INF, ply=0)
            else:
                window = aspiration_window
                while True:
                    alpha = max(-INF, best_score - window)
                    beta = min(INF, best_score + window)
                    score, pv = self._negamax(state, depth, alpha, beta, ply=0)
                    if score <= alpha or score >= beta:
                        window *= 2
                        if window >= INF:
                            score, pv = self._negamax(state, depth, -INF, INF, ply=0)
                            break
                        continue
                    aspiration_window = max(32, window)
                    break
            best_score = score
            principal_variation = pv
            if pv:
                best_move = pv[0]
            aspiration_window = max(32, aspiration_window)
        return SearchResult(
            best_move=best_move,
            score=best_score,
            depth=self.max_depth,
            nodes=self._nodes,
            principal_variation=principal_variation,
        )

    def evaluate(self, state: CheckersState, legal_moves: tuple[MacroMove, ...] | None = None) -> int:
        winner = state.winner()
        if winner is not None:
            if winner == DRAW:
                return 0
            return WIN_SCORE if winner == state.side_to_move else -WIN_SCORE
        terms = structural_balance_terms(state)
        total_pieces = terms.red_men + terms.red_kings + terms.white_men + terms.white_kings
        king_value = self.eval_weights.king_value + (
            self.eval_weights.endgame_king_bonus * max(0, 24 - total_pieces)
        ) // 24
        red_material = terms.red_men * self.eval_weights.man_value + terms.red_kings * king_value
        white_material = terms.white_men * self.eval_weights.man_value + terms.white_kings * king_value
        score = 0
        score += red_material - white_material
        score += self.eval_weights.advancement_weight * terms.advancement
        score += self.eval_weights.center_weight * terms.center_control
        score += self.eval_weights.back_rank_weight * terms.back_rank_guard
        score += self.eval_weights.threatened_man_weight * terms.threatened_men
        score += self.eval_weights.threatened_king_weight * terms.threatened_kings
        score += self.eval_weights.runaway_weight * terms.runaway
        score += self.eval_weights.king_mobility_weight * terms.king_mobility
        score += self.eval_weights.king_center_weight * terms.king_center
        score += self.eval_weights.supported_man_weight * terms.supported_man
        score += self.eval_weights.connected_piece_weight * terms.connected_piece
        score += self.eval_weights.promotion_threat_weight * terms.promotion_threat
        score += self.eval_weights.king_trap_weight * terms.king_trap
        if legal_moves is None:
            legal_moves = self._legal_moves(state)
        mobility = len(legal_moves)
        if mobility <= 1:
            score -= self.eval_weights.low_mobility_penalty
        else:
            score += self.eval_weights.mobility_bonus * mobility
        return score * current_player_sign(state.side_to_move)

    def _negamax(self, state: CheckersState, depth: int, alpha: int, beta: int, ply: int) -> tuple[int, tuple[MacroMove, ...]]:
        self._nodes += 1
        alpha_orig = alpha
        key = self._tt_key(state)
        entry = self._tt.get(key)
        if entry is not None and entry.depth >= depth:
            entry_score = self._tt_score_to_search(entry.score, ply)
            if entry.flag == "exact":
                move = self._lookup_move(state, entry.best_move_actions)
                return entry_score, (() if move is None else (move,))
            if entry.flag == "lower":
                alpha = max(alpha, entry_score)
            elif entry.flag == "upper":
                beta = min(beta, entry_score)
            if alpha >= beta:
                move = self._lookup_move(state, entry.best_move_actions)
                return entry_score, (() if move is None else (move,))
        winner = state.winner()
        if depth == 0 or winner is not None:
            legal_moves = None if winner is not None else self._legal_moves(state)
            terminal = self.evaluate(state, legal_moves)
            if abs(terminal) >= WIN_SCORE:
                terminal -= ply if terminal > 0 else -ply
            if depth == 0 and winner is None and self.enable_quiescence:
                quiet_score = self._quiescence(state, alpha, beta, ply)
                if abs(quiet_score) >= WIN_SCORE:
                    quiet_score -= ply if quiet_score > 0 else -ply
                return quiet_score, ()
            return terminal, ()
        legal_moves = self._legal_moves(state)
        if not legal_moves:
            terminal = self.evaluate(state, legal_moves)
            if abs(terminal) >= WIN_SCORE:
                terminal -= ply if terminal > 0 else -ply
            return terminal, ()
        ordered_moves = self._order_moves(state, list(legal_moves), entry.best_move_actions if entry else None, ply)
        best_score = -INF
        best_move: MacroMove | None = None
        best_suffix: tuple[MacroMove, ...] = ()
        for idx, move in enumerate(ordered_moves):
            child = state.clone()
            apply_macro_move(child, move)
            if idx == 0:
                child_score, child_pv = self._negamax(child, depth - 1, -beta, -alpha, ply + 1)
            else:
                child_score, child_pv = self._negamax(child, depth - 1, -alpha - 1, -alpha, ply + 1)
                probe_score = -child_score
                if alpha < probe_score < beta:
                    child_score, child_pv = self._negamax(child, depth - 1, -beta, -alpha, ply + 1)
            score = -child_score
            if score > best_score:
                best_score = score
                best_move = move
                best_suffix = child_pv
            alpha = max(alpha, best_score)
            if alpha >= beta:
                if not move.is_capture:
                    self._record_killer(ply, move.actions)
                    self._history_scores[move.actions] = self._history_scores.get(move.actions, 0) + depth * depth
                break
        assert best_move is not None
        flag: Literal["exact", "lower", "upper"]
        if best_score <= alpha_orig:
            flag = "upper"
        elif best_score >= beta:
            flag = "lower"
        else:
            flag = "exact"
        self._store_tt(
            key,
            TTEntry(
                depth=depth,
                score=self._search_score_to_tt(best_score, ply),
                flag=flag,
                best_move_actions=best_move.actions,
                generation=self._search_generation,
            ),
        )
        return best_score, (best_move,) + best_suffix

    def _tt_key(self, state: CheckersState) -> tuple[object, ...]:
        repetition_signature = tuple(sorted(state.repetition_counts.items()))
        return (
            state.position_key()[0],
            state.side_to_move,
            state.forced_square,
            tuple(sorted(state.pending_captures)),
            state.no_progress_count,
            repetition_signature,
        )

    def _lookup_move(self, state: CheckersState, actions: tuple[int, ...] | None) -> MacroMove | None:
        if actions is None:
            return None
        for move in self._legal_moves(state):
            if move.actions == actions:
                return move
        return None

    def _order_moves(self, state: CheckersState, moves: list[MacroMove], tt_actions: tuple[int, ...] | None, ply: int) -> list[MacroMove]:
        def key(move: MacroMove) -> tuple[int, int, int, int, int, int]:
            tt_bonus = 1 if tt_actions is not None and move.actions == tt_actions else 0
            killer_rank = self._killer_rank(ply, move.actions)
            history_score = self._history_scores.get(move.actions, 0)
            return (tt_bonus, int(move.is_capture), move.capture_count, int(move.promotes), killer_rank, history_score)
        return sorted(moves, key=key, reverse=True)

    def _store_tt(self, key: tuple[object, ...], entry: TTEntry) -> None:
        existing = self._tt.get(key)
        if existing is not None and existing.depth > entry.depth:
            return
        if len(self._tt) >= self.transposition_capacity and key not in self._tt:
            victim_key: tuple[object, ...] | None = None
            victim_entry: TTEntry | None = None
            for candidate_key, candidate_entry in islice(self._tt.items(), 32):
                if victim_entry is None or (candidate_entry.depth, candidate_entry.generation) < (
                    victim_entry.depth,
                    victim_entry.generation,
                ):
                    victim_key = candidate_key
                    victim_entry = candidate_entry
            if victim_key is not None and victim_entry is not None:
                if (entry.depth, entry.generation) < (victim_entry.depth, victim_entry.generation):
                    return
                del self._tt[victim_key]
        self._tt[key] = entry

    def _legal_moves(self, state: CheckersState) -> tuple[MacroMove, ...]:
        key = self._tt_key(state)
        cached = self._legal_move_cache.get(key)
        if cached is None:
            cached = tuple(legal_macro_moves(state))
            self._legal_move_cache[key] = cached
        return cached

    def _record_killer(self, ply: int, actions: tuple[int, ...]) -> None:
        killers = self._killer_moves.setdefault(ply, [])
        if actions in killers:
            killers.remove(actions)
        killers.insert(0, actions)
        del killers[2:]

    def _killer_rank(self, ply: int, actions: tuple[int, ...]) -> int:
        killers = self._killer_moves.get(ply, [])
        if killers and killers[0] == actions:
            return 2
        if len(killers) > 1 and killers[1] == actions:
            return 1
        return 0

    def _search_score_to_tt(self, score: int, ply: int) -> int:
        if score >= WIN_SCORE - 1024:
            return score + ply
        if score <= -WIN_SCORE + 1024:
            return score - ply
        return score

    def _tt_score_to_search(self, score: int, ply: int) -> int:
        if score >= WIN_SCORE - 1024:
            return score - ply
        if score <= -WIN_SCORE + 1024:
            return score + ply
        return score

    def _quiescence(self, state: CheckersState, alpha: int, beta: int, ply: int) -> int:
        self._nodes += 1
        legal_moves = self._legal_moves(state)
        stand_pat = self.evaluate(state, legal_moves)
        if stand_pat >= beta:
            return stand_pat
        alpha = max(alpha, stand_pat)
        tactical_moves = [move for move in legal_moves if move.is_capture]
        if not tactical_moves:
            return stand_pat
        ordered_moves = self._order_moves(state, tactical_moves, None, ply)
        best_score = stand_pat
        for move in ordered_moves:
            child = state.clone()
            apply_macro_move(child, move)
            score = -self._quiescence(child, -beta, -alpha, ply + 1)
            if score > best_score:
                best_score = score
            alpha = max(alpha, best_score)
            if alpha >= beta:
                break
        return best_score


def principal_variation_to_pdn(result: SearchResult) -> list[str]:
    return [macro_move_to_pdn(move) for move in result.principal_variation]
