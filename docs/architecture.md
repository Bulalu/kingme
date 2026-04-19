# Architecture

## Recommended Stack

- Frontend: Next.js
- App backend / realtime state: Convex
- Engine service: Python API
- Engine hosting: Modal or another CPU-oriented service

## Why this split

Your checkers engine already exists in Python and is CPU-heavy. That makes it a poor fit for direct execution inside a Next.js server route or inside Convex functions.

The clean separation is:

- Next.js for product UI and routes
- Convex for product state and realtime sync
- Python engine service for move generation, evaluation, and model/search orchestration

## Monorepo Layout

```text
apps/
  web/
  engine-api/
packages/
  ui/
  shared/
  content/
convex/
docs/
```

## Folder Responsibilities

### `apps/web`

Use this for:

- landing page
- agent roster
- play screen
- leaderboard views
- authenticated player area later

Keep engine logic out of this app. It should render board state, submit player actions, and react to updates.

### `apps/engine-api`

Use this for:

- wrapping the current Python checkers engine
- loading checkpoints
- exposing move-generation endpoints
- exposing benchmark/eval endpoints for admin or internal tooling
- future training-control endpoints if you need them

This service should be stateless. Convex should own durable game/session state.

### `convex`

Use this for:

- game session records
- move history
- agent catalog records
- player profiles
- leaderboard records
- telemetry and engagement events

Convex should orchestrate application state, not perform heavy search.

### `packages/ui`

Use this for shared frontend pieces like:

- board renderer
- move list
- clocks
- agent cards
- stat blocks
- branded layout primitives

### `packages/shared`

Use this for shared contracts like:

- API request/response types
- game state DTOs
- move payload shapes
- enums and constants shared by web and Convex

Avoid putting engine implementation here. This package should stay lightweight and TS-first.

### `packages/content`

Use this for product-owned static content:

- agent bios
- difficulty labels
- landing page copy
- roadmap items
- FAQ content
- seed metadata for showcase bots

## Runtime Flow

Recommended v1 flow:

1. Player starts a game from the web app.
2. Next.js calls Convex to create the game session.
3. Convex stores the canonical app-side session state.
4. Player makes a move in the UI.
5. Convex action or server-side app code calls the Python engine service.
6. Engine service validates state, computes the bot move, and returns metadata.
7. Convex persists the resulting move and updated session state.
8. UI updates through Convex realtime subscriptions.

## API Boundary

Keep the engine service boundary narrow.

The engine service should only need to know:

- current board state
- side to move
- engine/bot config
- optional checkpoint or agent id
- optional search settings

The engine service should return:

- chosen move
- updated board state
- evaluation summary
- think time
- optional PV/debug metadata

## v1 Recommendation

Ship with two engine classes:

- stable search bot: plain alpha-beta
- featured bot: neural hybrid checkpoint + search

That gives you:

- reliability
- an honest "our own model" story
- room to iterate on stronger checkpoints without destabilizing the whole product

## Suggested Build Order

1. Lock the monorepo and folder structure.
2. Build `apps/web` shell and board UX.
3. Stand up `apps/engine-api` by extracting the current local playable engine path.
4. Connect `apps/web` to Convex session state.
5. Add a single playable bot end-to-end.
6. Add multiple agent configs/personas on top of the same engine service.
7. Add benchmark/admin pages only after the play flow is stable.

