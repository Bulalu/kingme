from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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
    PlayTurnRequest,
    PlayTurnResponse,
    StatePayload,
)
from .service import EngineService
from .settings import load_settings


def create_app() -> FastAPI:
    settings = load_settings()
    registry = AgentRegistry(settings.agents_dir)
    service = EngineService(registry)

    app = FastAPI(title=settings.app_name)

    # Browser clients (apps/web on kingme.dev and local dev) talk to this
    # API directly. Allow the production origin and common local dev hosts.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://kingme.dev",
            "https://www.kingme.dev",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_origin_regex=r"^https://[a-z0-9-]+-ctrlx\.vercel\.app$",
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["content-type"],
        max_age=600,
    )

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

    @app.post("/v1/play-turn", response_model=PlayTurnResponse)
    def play_turn(request: PlayTurnRequest) -> PlayTurnResponse:
        try:
            return service.play_turn(request.agent_id, request.state, request.move_pdn)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return app
