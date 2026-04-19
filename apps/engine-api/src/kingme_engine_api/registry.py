from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from .runtime.agents import BootstrapPolicyAgent, HybridBootstrapAlphaBetaAgent
from .runtime.alphabeta import AlphaBetaAgent, EvalWeights


EngineLiteral = Literal["alphabeta", "bootstrap_policy", "bootstrap_hybrid"]


@dataclass(frozen=True)
class ReleasedAgentConfig:
    id: str
    display_name: str
    description: str
    engine: EngineLiteral
    depth: int
    checkpoint_path: str | None = None
    eval_weights_path: str | None = None
    device: str = "auto"
    value_scale: float = 100.0
    heuristic_blend: float = 1.0
    quiescence: bool = True
    public: bool = True

    @classmethod
    def from_mapping(cls, payload: dict[str, Any]) -> "ReleasedAgentConfig":
        def expand(value: Any) -> Any:
            if isinstance(value, str):
                expanded = os.path.expandvars(value).strip()
                return expanded or None
            return value

        return cls(
            id=str(payload["id"]),
            display_name=str(payload.get("display_name", payload["id"])),
            description=str(payload.get("description", "")),
            engine=str(payload["engine"]),  # type: ignore[arg-type]
            depth=int(payload.get("depth", 4)),
            checkpoint_path=expand(payload.get("checkpoint_path")),
            eval_weights_path=expand(payload.get("eval_weights_path")),
            device=str(expand(payload.get("device")) or "auto"),
            value_scale=float(payload.get("value_scale", 100.0)),
            heuristic_blend=float(payload.get("heuristic_blend", 1.0)),
            quiescence=bool(payload.get("quiescence", True)),
            public=bool(payload.get("public", True)),
        )

    @property
    def ready(self) -> bool:
        if self.engine == "alphabeta":
            return True
        return bool(self.checkpoint_path and Path(self.checkpoint_path).exists())


class AgentRegistry:
    def __init__(self, agents_dir: Path):
        self.agents_dir = agents_dir
        self._configs = self._load_configs()
        self._instances: dict[str, object] = {}

    def list_configs(self) -> list[ReleasedAgentConfig]:
        return sorted(self._configs.values(), key=lambda item: item.id)

    def get_config(self, agent_id: str) -> ReleasedAgentConfig:
        try:
            return self._configs[agent_id]
        except KeyError as exc:
            raise KeyError(f"unknown agent: {agent_id}") from exc

    def get_agent(self, agent_id: str) -> object:
        config = self.get_config(agent_id)
        if not config.ready:
            raise FileNotFoundError(f"agent {agent_id} is not ready for serving")
        cached = self._instances.get(agent_id)
        if cached is not None:
            return cached

        agent: object
        if config.engine == "alphabeta":
            weights = EvalWeights.from_path(config.eval_weights_path) if config.eval_weights_path else None
            agent = AlphaBetaAgent(
                max_depth=config.depth,
                enable_quiescence=config.quiescence,
                eval_weights=weights,
            )
        elif config.engine == "bootstrap_policy":
            assert config.checkpoint_path is not None
            agent = BootstrapPolicyAgent(
                checkpoint_path=config.checkpoint_path,
                device=config.device,
            )
        elif config.engine == "bootstrap_hybrid":
            assert config.checkpoint_path is not None
            agent = HybridBootstrapAlphaBetaAgent(
                checkpoint_path=config.checkpoint_path,
                max_depth=config.depth,
                device=config.device,
                value_scale=config.value_scale,
                heuristic_blend=config.heuristic_blend,
                enable_quiescence=config.quiescence,
            )
        else:
            raise ValueError(f"unsupported engine kind: {config.engine}")

        self._instances[agent_id] = agent
        return agent

    def _load_configs(self) -> dict[str, ReleasedAgentConfig]:
        configs: dict[str, ReleasedAgentConfig] = {}
        if not self.agents_dir.exists():
            return configs

        for path in sorted(self.agents_dir.glob("*.json")):
            if path.name.endswith(".example.json"):
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            config = ReleasedAgentConfig.from_mapping(payload)
            configs[config.id] = config
        return configs

