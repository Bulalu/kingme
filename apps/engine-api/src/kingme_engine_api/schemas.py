from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ColorLiteral = Literal["red", "white", "draw"]


class RepetitionCountPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    board: list[int]
    side_to_move: Literal["red", "white"]
    count: int


class StatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rows: list[str]
    side_to_move: Literal["red", "white"]
    forced_square: int | None = None
    no_progress_count: int = 0
    repetition_counts: list[RepetitionCountPayload] = Field(default_factory=list)


class MovePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pdn: str
    actions: list[int]
    path: list[int]
    is_capture: bool
    capture_count: int
    promotes: bool
    final_square: int


class SearchPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: float
    depth: int
    nodes: int
    principal_variation: list[str]


class AgentSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    display_name: str
    description: str
    engine: str
    depth: int
    ready: bool
    public: bool


class HealthPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    app: str


class LegalMovesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: StatePayload


class LegalMovesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: StatePayload
    legal_moves: list[MovePayload]
    winner: ColorLiteral | None


class ApplyMoveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: StatePayload
    move_pdn: str


class ApplyMoveResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    applied_move: MovePayload
    state: StatePayload
    legal_moves: list[MovePayload]
    winner: ColorLiteral | None


class AgentMoveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agent_id: str
    state: StatePayload


class AgentMoveResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agent: AgentSummary
    move: MovePayload
    state: StatePayload
    legal_moves: list[MovePayload]
    winner: ColorLiteral | None
    search: SearchPayload

