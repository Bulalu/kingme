# apps/engine-api

Python inference service for `kingme`.

This app owns:

- released bot manifests
- playable engine runtime
- move validation
- bot move generation
- search/eval metadata for product use

It intentionally does **not** own:

- training
- benchmarking
- tuner scripts
- teacher-data generation

Those stay in the training repo.

## Planned Runtime Split

- `src/kingme_engine_api/api.py`
  FastAPI routes
- `src/kingme_engine_api/service.py`
  request handling and state transitions
- `src/kingme_engine_api/registry.py`
  released agent manifests and lazy agent loading
- `src/kingme_engine_api/runtime/`
  vendored serving-only checkers runtime
- `agents/`
  released bot manifests

## Run

```bash
cd apps/engine-api
uvicorn kingme_engine_api.main:app --reload --host 127.0.0.1 --port 8051
```

## Deploy To Modal

Current deploy entrypoint:

- `apps/engine-api/modal_app.py`

Deploy from this directory:

```bash
cd apps/engine-api
modal deploy modal_app.py
```

Develop against a live Modal dev endpoint:

```bash
cd apps/engine-api
modal serve modal_app.py
```

The Modal deployment bundles:

- `src/kingme_engine_api`
- `agents/`

and sets:

- `KINGME_AGENTS_DIR=/root/agents`
- `KINGME_DEFAULT_DEVICE=cpu`

That means the first deployed version is ready to serve the built-in alpha-beta agents immediately.

If you want a released checkpoint-backed bot on Modal later, add the checkpoint as a release artifact first, then point an agent manifest at its container path.

## Environment

See [.env.example](/Users/elishabulalu/Desktop/kingme/apps/engine-api/.env.example).
