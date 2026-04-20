from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

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


def _client_ip(request: Request) -> str:
    """Extract client IP honoring the X-Forwarded-For header set by Modal's
    ingress. Falls back to the direct socket peer if no forwarding header
    is present (e.g. local dev).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Trust the first hop — Modal controls the edge and rewrites this.
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "anonymous"


def create_app() -> FastAPI:
    settings = load_settings()
    registry = AgentRegistry(settings.agents_dir)
    service = EngineService(registry)

    # Per-IP rate limits. In-memory state per container, which is fine —
    # Modal caps us at max_containers=5 so effective ceilings are ~5x the
    # numbers below. Tuned generously for real play: a checkers game is
    # ~40-70 moves over 5-15 min, so 120 apply-move/min (2/sec) is well
    # above any human play speed.
    limiter = Limiter(key_func=_client_ip)

    app = FastAPI(title=settings.app_name)
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    def _rate_limit_handler(_request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={"detail": f"rate limit exceeded: {exc.detail}"},
        )

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
    @limiter.limit("30/minute")
    def initial_state(request: Request) -> StatePayload:
        return service.initial_state()

    @app.post("/v1/state/legal-moves", response_model=LegalMovesResponse)
    @limiter.limit("120/minute")
    def legal_moves(request: Request, body: LegalMovesRequest) -> LegalMovesResponse:
        try:
            return service.legal_moves(body.state)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/v1/state/apply-move", response_model=ApplyMoveResponse)
    @limiter.limit("120/minute")
    def apply_move(request: Request, body: ApplyMoveRequest) -> ApplyMoveResponse:
        try:
            return service.apply_move(body.state, body.move_pdn)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/v1/agent-move", response_model=AgentMoveResponse)
    @limiter.limit("60/minute")
    def agent_move(request: Request, body: AgentMoveRequest) -> AgentMoveResponse:
        try:
            return service.agent_move(body.agent_id, body.state)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/v1/play-turn", response_model=PlayTurnResponse)
    @limiter.limit("60/minute")
    def play_turn(request: Request, body: PlayTurnRequest) -> PlayTurnResponse:
        try:
            return service.play_turn(body.agent_id, body.state, body.move_pdn)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except FileNotFoundError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return app
