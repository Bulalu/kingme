# Engine

This document describes the current serving engine runtime for the first live game: checkers.

`kingme` itself is not intended to be checkers-only. As more games are added, each game can have its own serving runtime and API surface behind the same broader product.

## Purpose

`kingme` does not own training. It owns serving.

The training repo remains the lab where we:

- generate teacher data
- train checkpoints
- tune search
- benchmark against stronger engines

This repo owns the serving runtime that turns a released agent into a playable product bot.

## Current Checkers Ruleset

The live checkers runtime now targets the local Tanzanian-style 8x8 rules instead of English checkers.

That means:

- men move forward diagonally by one square
- men capture forward only
- captures are mandatory
- kings are flying kings
- kings can move diagonally across multiple empty squares
- kings can capture from distance and choose any empty landing square beyond the captured piece
- during a multi-capture sequence, jumped pieces remain on the board until the full sequence ends

The code for that lives in:

- `apps/engine-api/src/kingme_engine_api/runtime/checkers_v2/`

## Split Between Repos

### Training repo

Keep these there:

- training loops
- bootstrap generation
- checkpoint experiments
- benchmarking against KingsRow
- tuner scripts

### `kingme`

Keep these here:

- released agent manifests
- runtime state logic
- move validation
- alpha-beta / hybrid search
- checkpoint loading
- HTTP inference API

## What We Ported

The serving slice is intentionally narrow:

- `runtime/checkers_v2/`
  rules state and action encoding
- `runtime/engine.py`
  macro-move generation and feature extraction
- `runtime/alphabeta.py`
  stable search bot
- `runtime/model.py`
  neural policy/value model definition
- `runtime/agents.py`
  search-only, policy-only, and hybrid runtime agents

The key point is:

We did **not** port the training machinery. We ported the **playable engine runtime**.

## Agent Types

### `alphabeta`

Pure search bot with no checkpoint dependency.

Use this for:

- stable baseline bots
- guaranteed product fallback
- local testing without model artifacts

### `bootstrap_policy`

Checkpoint-backed policy/value bot that picks moves directly from the model.

This is useful for experiments, but it is not the best product default right now.

### `bootstrap_hybrid`

Checkpoint-backed bot that still runs alpha-beta search, but uses the neural net for:

- move ordering
- value guidance inside evaluation

This is the strongest path we currently own in the lab.

## Runtime Flow

1. Web or backend sends the current game state to the engine API.
2. The engine API reconstructs the full checkers state.
3. The requested released agent is loaded from its manifest.
4. The engine validates legal moves.
5. The agent searches and returns the chosen macro-move.
6. The engine applies the move and returns:
   - the chosen move
   - the next state
   - legal reply moves
   - winner if terminal
   - search metadata

## State Format

The API uses a serializable board payload instead of raw Python objects.

State payload includes:

- `rows`
- `side_to_move`
- `forced_square`
- `no_progress_count`
- `repetition_counts`

`repetition_counts` is important because draw logic depends on position repetition, not just board layout.

## Released Agent Manifests

Agent manifests live in:

- `apps/engine-api/agents/`

These manifests declare:

- id
- display name
- engine type
- search depth
- checkpoint path if needed
- runtime knobs like `value_scale`

This keeps product serving stable even while the training repo remains experimental.

## Why We Do Not Commit Checkpoints Here By Default

Model artifacts can be large and change frequently.

For now, `kingme` is structured to load released checkpoints from explicit paths or future object storage, instead of baking every experiment into git.

The committed manifests are the contract. The checkpoint itself is a release artifact.

## API Surface

Current endpoints:

- `GET /health`
- `GET /v1/agents`
- `GET /v1/state/initial`
- `POST /v1/state/legal-moves`
- `POST /v1/state/apply-move`
- `POST /v1/agent-move`
- `POST /v1/play-turn`

Full request/response contract:

- [API.md](/Users/elishabulalu/Desktop/kingme/docs/API.md)

That is enough for:

- validating player moves
- applying state transitions
- asking a bot for its reply

## Current Product Lineup

Current released checkers agents:

- `sinza` — upgraded `alphabeta`, `depth 7`
- `masaki` — upgraded `alphabeta`, `depth 5`
- `tabata` — upgraded `alphabeta`, `depth 4`

These are all served from the same stable search-backed runtime family.

Reason:

- benchmark evidence still favors the upgraded search engine over the older checkpoint-backed hybrid runtime we have on hand
- the hybrid path stays in the lab until it clearly earns promotion
