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

## Current Ruleset

The serving engine now follows the local Tanzanian-style 8x8 draughts variant:

- men move forward diagonally one square
- men capture forward only
- captures are mandatory
- kings are flying kings and can move diagonally across any number of empty squares
- kings can capture from distance and land on any empty square beyond the captured piece
- during a multi-capture sequence, jumped pieces remain on the board until the sequence ends

This rules logic lives in:

- `apps/engine-api/src/kingme_engine_api/runtime/checkers_v2/`

## Keeping Modal Warm

The live engine API is configured to stay warm on Modal:

- `min_containers=1`
  keeps one container running so the service does not scale all the way to zero.
- `scaledown_window=20 * 60`
  keeps burst containers around for up to 20 minutes before scaling them down.

What this improves:

- the first move of a new game
- the first move after a period of inactivity
- repeated sessions that arrive close together

What this does **not** improve:

- the raw search time of a hard move once the container is already warm

So if move latency is still high after warm-up, that is a search/runtime problem, not a cold-start problem.

If you want a released checkpoint-backed bot on Modal later, add the checkpoint as a release artifact first, then point an agent manifest at its container path.

## Live Product Agent

The intended public launch agent is:

- `sinza`

Right now `sinza` is mapped to the strongest owned engine config we can defend from benchmark evidence:

- upgraded `alphabeta`
- `depth: 7`

This is deliberate. The older neural hybrid checkpoints are interesting, but they are not yet the strongest serving choice. Until a checkpoint-backed release clearly beats the upgraded search engine, `sinza` should stay on the stronger engine.

## Environment

See [.env.example](/Users/elishabulalu/Desktop/kingme/apps/engine-api/.env.example).
