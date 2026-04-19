from __future__ import annotations

import sys
from pathlib import Path

import modal


APP_ROOT = Path(__file__).resolve().parent
SRC_ROOT = APP_ROOT / "src"

if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from kingme_engine_api.api import create_app


app = modal.App("kingme-engine-api")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_pyproject("pyproject.toml")
    .add_local_dir("src", remote_path="/root/src", copy=True)
    .add_local_dir("agents", remote_path="/root/agents", copy=True)
    .env(
        {
            "KINGME_AGENTS_DIR": "/root/agents",
            "KINGME_DEFAULT_DEVICE": "cpu",
            "PYTHONPATH": "/root/src",
        }
    )
)


@app.function(image=image, cpu=2.0, memory=2048, timeout=300)
@modal.asgi_app(label="kingme-engine-api")
def fastapi_app():
    return create_app()
