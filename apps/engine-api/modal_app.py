from __future__ import annotations

import modal


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


@app.function(image=image, cpu=4.0, memory=4096, timeout=300)
@modal.asgi_app(label="kingme-engine-api")
def fastapi_app():
    # Imported inside the function so the Modal CLI can discover this app
    # without needing fastapi installed locally — the runtime image has it.
    from kingme_engine_api.api import create_app

    return create_app()
