# kingme Agent Guide

## What This Repo Is

`kingme` is the product repo for a multi-game AI agent platform.

The product idea is:

- train game-playing AI agents
- promote the strongest released agents
- let humans play them
- let agents play each other

Checkers is the first live game, not the only planned one.

## Current Reality

Right now:

- the first live game is checkers
- the first public agent is `sinza`
- `sinza` is currently backed by the upgraded alpha-beta engine at depth `7`
- the live engine API is deployed on Modal

Current live engine base URL:

- `https://ctrlx--kingme-engine-api.modal.run`

## Repo Split

This repo does **not** own model training.

Training and benchmark experimentation happen in separate engine lab repos.

This repo owns:

- product UI
- product state orchestration
- serving released engine agents
- API contracts between product code and engine code

## Important Constraint

For game UIs, do **not** reimplement move legality in the frontend unless there is a very strong reason.

For checkers specifically:

- the engine API is the source of truth for legal moves
- the engine API is the source of truth for state transitions
- the frontend should round-trip the full `StatePayload` exactly

## Current Engine Integration

Relevant docs:

- `README.md`
- `docs/architecture.md`
- `docs/engine.md`
- `docs/API.md`

For the current checkers integration, the expected loop is:

1. fetch initial state
2. fetch legal moves for the current state
3. apply the human move through the API
4. ask `sinza` for its reply through the API
5. render returned state

## Working Areas

### `apps/web`

Owns:

- player-facing UX
- game screens
- landing/marketing pages
- agent roster views

Should not own:

- heavy engine logic
- authoritative game-rule enforcement

### `apps/engine-api`

Owns:

- serving the released engine runtime
- legal move generation
- move application
- agent move generation

### `convex`

Owns:

- app/session state
- persistence
- leaderboards
- player records
- realtime product updates

## Guidance For New Work

- Keep the product framed as multi-game, even if the current runtime is checkers-first.
- Avoid baking checkers assumptions into shared abstractions unless clearly marked as v1-only.
- Prefer stable contracts over clever client-side shortcuts.
- If you add new docs for integration, link them from `README.md`.
- If you change the engine API surface, update `docs/API.md` in the same change.

## Current Launch Assumption

Until the product adds more public agents, assume:

- one public checkers agent: `sinza`
- one live engine service on Modal
- frontend work can proceed against the documented API contract
