from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str
    agents_dir: Path
    default_device: str


def load_settings() -> Settings:
    engine_api_root = Path(__file__).resolve().parents[2]
    agents_dir = Path(os.environ.get("KINGME_AGENTS_DIR", engine_api_root / "agents"))
    return Settings(
        app_name="kingme-engine-api",
        agents_dir=agents_dir.resolve(),
        default_device=os.environ.get("KINGME_DEFAULT_DEVICE", "auto"),
    )

