from __future__ import annotations

from .registry import AgentRegistry, ReleasedAgentConfig
from .runtime.engine import MacroMove, apply_macro_move, legal_macro_moves, macro_move_to_pdn
from .runtime.checkers_v2.runtime import DRAW, RED, WHITE, CheckersState
from .schemas import (
    AgentMoveResponse,
    AgentSummary,
    ApplyMoveResponse,
    LegalMovesResponse,
    MovePayload,
    PlayTurnResponse,
    SearchPayload,
    StatePayload,
)


def _color_to_name(color: int) -> str:
    if color == RED:
        return "red"
    if color == WHITE:
        return "white"
    if color == DRAW:
        return "draw"
    raise ValueError(f"unsupported color value {color}")


def _name_to_color(color: str) -> int:
    if color == "red":
        return RED
    if color == "white":
        return WHITE
    raise ValueError(f"unsupported color name {color}")


def _serialize_state(state: CheckersState) -> StatePayload:
    repetition_counts = []
    for (board, side_to_move), count in sorted(state.repetition_counts.items()):
        repetition_counts.append(
            {
                "board": list(board),
                "side_to_move": _color_to_name(side_to_move),
                "count": int(count),
            }
        )
    return StatePayload(
        rows=state.to_ascii().splitlines(),
        side_to_move=_color_to_name(state.side_to_move),
        forced_square=state.forced_square,
        pending_captures=sorted(state.pending_captures),
        no_progress_count=state.no_progress_count,
        repetition_counts=repetition_counts,
    )


def _deserialize_state(payload: StatePayload) -> CheckersState:
    repetition_counts: dict[tuple[tuple[int, ...], int], int] = {}
    for entry in payload.repetition_counts:
        key = (tuple(entry.board), _name_to_color(entry.side_to_move))
        repetition_counts[key] = entry.count
    return CheckersState.from_rows(
        payload.rows,
        side_to_move=_name_to_color(payload.side_to_move),
        forced_square=payload.forced_square,
        pending_captures=payload.pending_captures,
        no_progress_count=payload.no_progress_count,
        repetition_counts=repetition_counts or None,
    )


def _serialize_move(move: MacroMove) -> MovePayload:
    return MovePayload(
        pdn=macro_move_to_pdn(move),
        actions=list(move.actions),
        path=list(move.path),
        is_capture=move.is_capture,
        capture_count=move.capture_count,
        promotes=move.promotes,
        final_square=move.final_square,
    )


def _serialize_winner(state: CheckersState) -> str | None:
    winner = state.winner()
    if winner is None:
        return None
    return _color_to_name(winner)


def _serialize_agent(config: ReleasedAgentConfig) -> AgentSummary:
    return AgentSummary(
        id=config.id,
        display_name=config.display_name,
        description=config.description,
        engine=config.engine,
        depth=config.depth,
        ready=config.ready,
        public=config.public,
    )


class EngineService:
    def __init__(self, registry: AgentRegistry):
        self.registry = registry

    def health(self) -> dict[str, object]:
        return {"ok": True}

    def initial_state(self) -> StatePayload:
        return _serialize_state(CheckersState.initial())

    def list_agents(self) -> list[AgentSummary]:
        return [_serialize_agent(config) for config in self.registry.list_configs()]

    def legal_moves(self, state_payload: StatePayload) -> LegalMovesResponse:
        state = _deserialize_state(state_payload)
        moves = [_serialize_move(move) for move in legal_macro_moves(state)]
        return LegalMovesResponse(
            state=_serialize_state(state),
            legal_moves=moves,
            winner=_serialize_winner(state),
        )

    def apply_move(self, state_payload: StatePayload, move_pdn: str) -> ApplyMoveResponse:
        state = _deserialize_state(state_payload)
        move = self._move_from_pdn(state, move_pdn)
        apply_macro_move(state, move)
        return ApplyMoveResponse(
            applied_move=_serialize_move(move),
            state=_serialize_state(state),
            legal_moves=[_serialize_move(item) for item in legal_macro_moves(state)],
            winner=_serialize_winner(state),
        )

    def agent_move(self, agent_id: str, state_payload: StatePayload) -> AgentMoveResponse:
        state = _deserialize_state(state_payload)
        config = self.registry.get_config(agent_id)
        agent = self.registry.get_agent(agent_id)
        result = agent.search(state)
        if result.best_move is None:
            raise ValueError(f"agent {agent_id} returned no move for non-terminal state")
        move = result.best_move
        apply_macro_move(state, move)
        return AgentMoveResponse(
            agent=_serialize_agent(config),
            move=_serialize_move(move),
            state=_serialize_state(state),
            legal_moves=[_serialize_move(item) for item in legal_macro_moves(state)],
            winner=_serialize_winner(state),
            search=SearchPayload(
                score=float(result.score),
                depth=int(result.depth),
                nodes=int(result.nodes),
                principal_variation=[macro_move_to_pdn(item) for item in result.principal_variation],
            ),
        )

    def play_turn(
        self,
        agent_id: str,
        state_payload: StatePayload,
        move_pdn: str,
    ) -> PlayTurnResponse:
        state = _deserialize_state(state_payload)
        human_move = self._move_from_pdn(state, move_pdn)
        apply_macro_move(state, human_move)

        winner = _serialize_winner(state)
        if winner is not None:
            return PlayTurnResponse(
                applied_move=_serialize_move(human_move),
                agent=None,
                agent_move=None,
                state=_serialize_state(state),
                legal_moves=[_serialize_move(item) for item in legal_macro_moves(state)],
                winner=winner,
                search=None,
            )

        config = self.registry.get_config(agent_id)
        agent = self.registry.get_agent(agent_id)
        result = agent.search(state)
        if result.best_move is None:
            raise ValueError(f"agent {agent_id} returned no move for non-terminal state")

        bot_move = result.best_move
        apply_macro_move(state, bot_move)
        return PlayTurnResponse(
            applied_move=_serialize_move(human_move),
            agent=_serialize_agent(config),
            agent_move=_serialize_move(bot_move),
            state=_serialize_state(state),
            legal_moves=[_serialize_move(item) for item in legal_macro_moves(state)],
            winner=_serialize_winner(state),
            search=SearchPayload(
                score=float(result.score),
                depth=int(result.depth),
                nodes=int(result.nodes),
                principal_variation=[macro_move_to_pdn(item) for item in result.principal_variation],
            ),
        )

    def _move_from_pdn(self, state: CheckersState, move_pdn: str) -> MacroMove:
        legal_moves = legal_macro_moves(state)
        for move in legal_moves:
            if macro_move_to_pdn(move) == move_pdn:
                return move
        raise ValueError(f"illegal move for current state: {move_pdn}")
