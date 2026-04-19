from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path

import torch

from .alphabeta import AlphaBetaAgent, INF
from .checkers_v2.runtime import CheckersState
from .device import resolve_device
from .engine import MOVE_FEATURE_SIZE, legal_macro_moves, macro_move_feature_matrix, state_to_dark_planes
from .model import CheckersMoveNet


@dataclass(frozen=True)
class AgentMoveResult:
    best_move: object
    score: float
    depth: int
    nodes: int
    principal_variation: tuple[object, ...]


class RandomAgent:
    def __init__(self, seed: int = 0):
        self.rng = random.Random(seed)

    def search(self, state: CheckersState) -> AgentMoveResult:
        moves = legal_macro_moves(state)
        if not moves:
            return AgentMoveResult(None, 0.0, 0, 0, ())
        move = self.rng.choice(moves)
        return AgentMoveResult(move, 0.0, 0, 1, (move,))


class BootstrapPolicyAgent:
    def __init__(self, checkpoint_path: str | Path, device: str = "auto"):
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        train_config = checkpoint.get("config", {})
        self.device = resolve_device(device)
        self.model = CheckersMoveNet(
            input_channels=8,
            move_feature_size=checkpoint.get("move_feature_size", MOVE_FEATURE_SIZE),
            channels=train_config.get("channels", 64),
            residual_blocks=train_config.get("residual_blocks", 4),
            hidden_size=train_config.get("hidden_size", 128),
        ).to(self.device)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()

    @torch.no_grad()
    def search(self, state: CheckersState) -> AgentMoveResult:
        moves = legal_macro_moves(state)
        if not moves:
            return AgentMoveResult(None, 0.0, 0, 0, ())
        board = torch.from_numpy(state_to_dark_planes(state)).unsqueeze(0).to(self.device)
        move_features = torch.from_numpy(macro_move_feature_matrix(moves, state.side_to_move)).unsqueeze(0).to(self.device)
        move_mask = torch.ones((1, len(moves)), dtype=torch.float32, device=self.device)
        logits, values = self.model(board, move_features, move_mask)
        move_index = int(logits.argmax(dim=-1).item())
        move = moves[move_index]
        value = float(values.item())
        return AgentMoveResult(move, value, 0, 1, (move,))


class HybridBootstrapAlphaBetaAgent(AlphaBetaAgent):
    def __init__(
        self,
        checkpoint_path: str | Path,
        max_depth: int = 2,
        device: str = "auto",
        transposition_capacity: int = 200_000,
        value_scale: float = 400.0,
        heuristic_blend: float = 0.50,
        enable_quiescence: bool = False,
    ):
        super().__init__(
            max_depth=max_depth,
            transposition_capacity=transposition_capacity,
            enable_quiescence=enable_quiescence,
        )
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        train_config = checkpoint.get("config", {})
        self.device = resolve_device(device)
        self.model = CheckersMoveNet(
            input_channels=8,
            move_feature_size=checkpoint.get("move_feature_size", MOVE_FEATURE_SIZE),
            channels=train_config.get("channels", 64),
            residual_blocks=train_config.get("residual_blocks", 4),
            hidden_size=train_config.get("hidden_size", 128),
        ).to(self.device)
        self.model.load_state_dict(checkpoint["model_state"])
        self.model.eval()
        self.value_scale = value_scale
        self.heuristic_blend = heuristic_blend
        self._nn_cache: dict[
            tuple[object, ...],
            tuple[tuple[tuple[int, ...], ...], dict[tuple[int, ...], float], float],
        ] = {}

    def search(self, state: CheckersState):
        self._nn_cache.clear()
        return super().search(state)

    def evaluate(self, state: CheckersState, legal_moves=None) -> int:
        terminal = state.winner()
        if terminal is not None:
            return super().evaluate(state, legal_moves)
        _, _, net_value = self._infer_state(state)
        heuristic = super().evaluate(state, legal_moves)
        blended = (net_value * self.value_scale) + self.heuristic_blend * heuristic
        blended = max(min(blended, INF - 1), -INF + 1)
        return int(blended)

    def _order_moves(
        self,
        state: CheckersState,
        moves: list[object],
        tt_actions: tuple[int, ...] | None,
        ply: int,
    ) -> list[object]:
        action_scores = None
        try:
            _, action_scores, _ = self._infer_state(state)
        except Exception:
            action_scores = None

        def key(move) -> tuple[int, int, int, int, float, int, int]:
            tt_bonus = 1 if tt_actions is not None and move.actions == tt_actions else 0
            policy_score = -1e9 if action_scores is None else action_scores.get(move.actions, -1e9)
            killer_rank = self._killer_rank(ply, move.actions)
            history_score = self._history_scores.get(move.actions, 0)
            return (
                tt_bonus,
                int(move.is_capture),
                move.capture_count,
                int(move.promotes),
                policy_score,
                killer_rank,
                history_score,
            )

        return sorted(moves, key=key, reverse=True)

    @torch.no_grad()
    def _infer_state(self, state: CheckersState) -> tuple[tuple[tuple[int, ...], ...], dict[tuple[int, ...], float], float]:
        key = self._tt_key(state)
        cached = self._nn_cache.get(key)
        if cached is not None:
            return cached
        moves = legal_macro_moves(state)
        if not moves:
            cached = ((), {}, 0.0)
            self._nn_cache[key] = cached
            return cached
        board = torch.from_numpy(state_to_dark_planes(state)).unsqueeze(0).to(self.device)
        move_features = torch.from_numpy(macro_move_feature_matrix(moves, state.side_to_move)).unsqueeze(0).to(self.device)
        move_mask = torch.ones((1, len(moves)), dtype=torch.float32, device=self.device)
        logits, values = self.model(board, move_features, move_mask)
        logits = logits.squeeze(0).detach().cpu()
        action_scores = {
            move.actions: float(logits[idx].item())
            for idx, move in enumerate(moves)
        }
        cached = (
            tuple(move.actions for move in moves),
            action_scores,
            float(values.item()),
        )
        self._nn_cache[key] = cached
        return cached
