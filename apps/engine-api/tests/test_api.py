from __future__ import annotations

from fastapi.testclient import TestClient

from kingme_engine_api.api import create_app


client = TestClient(create_app())


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_agents_endpoint_lists_builtin_bots() -> None:
    response = client.get("/v1/agents")
    assert response.status_code == 200
    agent_ids = {agent["id"] for agent in response.json()}
    assert {"rookie", "street"}.issubset(agent_ids)


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
        json={"agent_id": "rookie", "state": after_human},
    )
    assert agent_response.status_code == 200
    payload = agent_response.json()
    assert payload["move"]["pdn"]
    assert payload["search"]["depth"] >= 0
