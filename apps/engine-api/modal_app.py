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


@app.function(
    image=image,
    cpu=4.0,
    memory=4096,
    timeout=300,
    # Keep one container running at all times so requests don't need to boot
    # the service from zero.
    min_containers=1,
    # Cap fan-out so unexpected load can't run up the bill. Bump if we
    # actually start hitting this ceiling.
    max_containers=5,
    # Let any extra containers from short bursts stay hot for longer before
    # Modal scales them back down.
    scaledown_window=20 * 60,
)
# Alpha-beta search is CPU-bound and single-threaded under the GIL, so a
# single container can really only chew on one move at a time. Cap each
# container at 1 concurrent request — Modal will spin up additional
# containers (up to max_containers) when multiple players move at once,
# instead of queueing them all on one box.
@modal.concurrent(max_inputs=1)
@modal.asgi_app(label="kingme-engine-api")
def fastapi_app():
    # Imported inside the function so the Modal CLI can discover this app
    # without needing fastapi installed locally — the runtime image has it.
    from kingme_engine_api.api import create_app

    return create_app()
