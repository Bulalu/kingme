from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .registry import AgentRegistry
from .schemas import (
    AgentMoveRequest,
    AgentMoveResponse,
    AgentSummary,
    ApplyMoveRequest,
    ApplyMoveResponse,
    HealthPayload,
    LegalMovesRequest,
    LegalMovesResponse,
    StatePayload,
)
from .service import EngineService
from .settings import load_settings


def create_app() -> FastAPI:
    settings = load_settings()
    registry = AgentRegistry(settings.agents_dir)
    service = EngineService(registry)

    app = FastAPI(title=settings.app_name)

    @app.get("/health", response_model=HealthPayload)
    def health() -> HealthPayload:
        return HealthPayload(ok=True, app=settings.app_name)

    @app.get("/v1/agents", response_model=list[AgentSummary])
    def list_agents() -> list[AgentSummary]:
        return service.list_agents()

    @app.get("/v1/state/initial", response_model=StatePayload)
    def initial_state() -> StatePayload:
        return service.initial_state()

    @app.post("/v1/state/legal-moves", response_model=LegalMovesResponse)
    def legal_moves(request: LegalMovesRequest) -> LegalMovesResponse:
        try:
            return service.legal_moves(request.state)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/v1/state/apply-move", response_model=ApplyMoveResponse)
    def apply_move(request: ApplyMoveRequest) -> ApplyMoveResponse:
        try:
            return service.apply_move(request.state, request.move_pdn)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/v1/agent-move", response_model=AgentMoveResponse)
    def agent_move(request: AgentMoveRequest) -> AgentMoveResponse:
        try:
            return service.agent_move(request.agent_id, request.state)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return app

