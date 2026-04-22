from __future__ import annotations

from fastapi.testclient import TestClient

from kingme_engine_api.api import create_app
from kingme_engine_api.runtime.checkers_v2.action_encoding import coords_to_square


client = TestClient(create_app())


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_agents_endpoint_lists_builtin_bots() -> None:
    response = client.get("/v1/agents")
    assert response.status_code == 200
    payload = response.json()
    agent_ids = [agent["id"] for agent in payload]
    assert agent_ids == ["sinza", "sinza-street", "sinza-pulse"]
    depths = {agent["id"]: agent["depth"] for agent in payload}
    assert depths == {
        "sinza": 7,
        "sinza-street": 6,
        "sinza-pulse": 4,
    }


def test_apply_and_reply_flow_works_for_builtin_agent() -> None:
    initial_response = client.get("/v1/state/initial")
    assert initial_response.status_code == 200
    state = initial_response.json()

    legal_response = client.post("/v1/state/legal-moves", json={"state": state})
    assert legal_response.status_code == 200
    legal_moves = legal_response.json()["legal_moves"]
    assert legal_moves

    applied_response = client.post(
        "/v1/state/apply-move",
        json={"state": state, "move_pdn": legal_moves[0]["pdn"]},
    )
    assert applied_response.status_code == 200
    after_human = applied_response.json()["state"]

    agent_response = client.post(
        "/v1/agent-move",
        json={"agent_id": "sinza", "state": after_human},
    )
    assert agent_response.status_code == 200
    payload = agent_response.json()
    assert payload["move"]["pdn"]
    assert payload["search"]["depth"] >= 0


def test_play_turn_combines_human_move_and_agent_reply() -> None:
    initial_response = client.get("/v1/state/initial")
    assert initial_response.status_code == 200
    state = initial_response.json()

    legal_response = client.post("/v1/state/legal-moves", json={"state": state})
    assert legal_response.status_code == 200
    move_pdn = legal_response.json()["legal_moves"][0]["pdn"]

    turn_response = client.post(
        "/v1/play-turn",
        json={"agent_id": "sinza", "state": state, "move_pdn": move_pdn},
    )
    assert turn_response.status_code == 200
    payload = turn_response.json()
    assert payload["applied_move"]["pdn"] == move_pdn
    assert payload["agent"]["id"] == "sinza"
    assert payload["agent_move"]["pdn"]
    assert payload["search"]["depth"] >= 0


def test_legal_moves_accept_pending_captures_for_forced_flying_king_sequence() -> None:
    response = client.post(
        "/v1/state/legal-moves",
        json={
            "state": {
                "rows": [
                    "........",
                    "....R...",
                    ".....w..",
                    "........",
                    ".w......",
                    "........",
                    "........",
                    "........",
                ],
                "side_to_move": "red",
                "forced_square": coords_to_square(1, 4),
                "pending_captures": [coords_to_square(4, 1)],
                "no_progress_count": 0,
                "repetition_counts": [],
            }
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert {move["pdn"] for move in payload["legal_moves"]} == {"7x16", "7x20"}
