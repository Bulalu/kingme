# Engine

## Purpose

`kingme` does not own training. It owns serving.

The training repo remains the lab where we:

- generate teacher data
- train checkpoints
- tune search
- benchmark against stronger engines

This repo owns the serving runtime that turns a released agent into a playable product bot.

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

That is enough for:

- validating player moves
- applying state transitions
- asking a bot for its reply

## Recommendation For Product

For the first public release, use one agent:

- `sinza`

And point it at the strongest owned serving config, not the most experimental one.

At the moment that means:

- upgraded `alphabeta`
- `depth 7`

Reason:

- benchmark evidence says the upgraded search engine is currently stronger than the older checkpoint-backed hybrid runtime we have on hand
- the hybrid path stays in the lab until it clearly earns promotion
