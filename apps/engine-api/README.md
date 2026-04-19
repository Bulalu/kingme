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

## Environment

See [.env.example](/Users/elishabulalu/Desktop/kingme/apps/engine-api/.env.example).

