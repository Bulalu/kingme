# LLM Arena Roadmap

This document lays out a practical, low-confusion plan for adding a **manual, replayable LLM arena** to `kingme`, starting with checkers.

The goal is to make it easy for an implementation agent to build this in stages without breaking the current product assumptions.

## What We Are Building

We want a mode where **you explicitly trigger matches** between model-backed agents such as GPT, Claude, Qwen, GLM, and others, and then:

- the models play **checkers** against each other
- the match is visible in the UI while it is running
- the move history is stored so completed matches can be replayed later
- the system can later grow into a broader arena / leaderboard / batch-eval workflow

This is **not** an always-on self-play system.

## Product Assumptions

For this repo, the arena should follow these rules:

1. **Manual trigger only**
   - matches start only when explicitly requested by an admin workflow you control
   - no background self-play loop
   - no public endpoint that lets anyone spawn paid model-vs-model games

2. **Engine API remains authoritative**
   - the Python engine API is the source of truth for:
     - legal moves
     - state transitions
     - winner / draw detection
   - LLMs do **not** invent legal moves or update board state themselves

3. **Convex owns durable arena state**
   - match metadata
   - move logs
   - replay data
   - live match status for the web UI

4. **The web app is a viewer and control surface**
   - show ongoing matches
   - show completed matches
   - replay stored games
   - optionally expose an admin-only manual start page later

5. **Keep the design multi-game friendly**
   - checkers is first
   - table names and contracts should leave room for future games

---

## Non-Goals For v1

Do **not** try to solve these in the first pass:

- public user-triggered arena games
- autonomous scheduled tournaments
- tool-using / search-using LLM agents
- hidden chain-of-thought capture and display
- perfect ratings / ranking science from day one
- adding new checkers rules logic to the frontend

---

## Hard Constraints From This Repo

These existing repo constraints should guide the whole design:

- `apps/engine-api` is the referee
- `apps/web` should not reimplement move legality
- `convex/` should persist app state, not run long heavy search loops
- this repo is product-serving focused, not a training lab

That leads to one clear arena rule:

> Every model turn must be generated from an authoritative engine state and an authoritative legal move list.

---

## Recommended Architecture

## 1. Keep `apps/engine-api` as the match referee

The arena runner should use the existing engine endpoints:

- `GET /v1/state/initial`
- `POST /v1/state/legal-moves`
- `POST /v1/state/apply-move`

For the arena, that is enough.

The model turn loop should be:

1. fetch initial state
2. fetch legal moves for that state
3. send the state + legal moves to the current model
4. validate that the model selected one of the legal `move_pdn` values
5. apply the chosen move through the engine API
6. persist the ply
7. repeat until terminal

### Important

Do **not** ask the LLM to output arbitrary move text and then try to "interpret" it loosely.

Instead, the model should choose **exactly one value from the provided legal move list**.

---

## 2. Add a dedicated arena runner

Recommended new app:

```text
apps/
  web/
  engine-api/
  arena-runner/
```

This runner should:

- claim a pending arena match
- call the engine API for authoritative state and move application
- call OpenRouter-backed LLMs through a provider adapter
- persist match progress to Convex after each ply
- finalize match results and replay data

### Why a separate runner?

Because a full model-vs-model match is:

- long-running
- external-API heavy
- latency-sensitive
- not a good fit for a browser request
- not a good fit for a long Convex mutation/action loop

A dedicated runner keeps execution concerns separate from persistence and UI.

---

## 3. Use Convex for persistence and live subscriptions

Convex should store:

- model profiles used in the arena
- match requests
- running/completed match status
- ply-by-ply move logs
- replay-ready board snapshots
- optional ratings later

### Important replay note

If we only store the final move list at the end, the UI cannot show live progress.

So the correct plan is:

- **persist each ply as it happens** for live viewing
- keep the completed move log afterward for replay

That satisfies both needs:

- live arena watching
- historical replay

---

## 4. Use a provider adapter for LLM calls

Start with OpenRouter, but do not wire match logic directly to OpenRouter-specific request shapes.

Use an abstraction like:

```ts
interface ArenaModelAdapter {
  selectMove(input: {
    state: StatePayload;
    legalMoves: MovePayload[];
    sideToMove: "red" | "white";
    moveHistory: string[];
    profile: ArenaAgentProfile;
  }): Promise<{
    movePdn: string;
    latencyMs: number;
    rawOutput?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  }>;
}
```

Recommended first implementation:

- `OpenRouterAdapter`
- optionally implemented with Vercel AI SDK

### Recommendation on Vercel AI SDK

Using Vercel AI SDK is reasonable for v1, especially if it helps with structured output.

However:

- keep SDK usage inside the adapter layer
- keep the rest of the arena runner provider-agnostic
- be willing to swap to direct OpenRouter HTTP if needed

This prevents lock-in and keeps the rest of the system stable.

---

## Core Design Principles

## A. Manual start only

Arena jobs should be created only by an admin-only workflow.

Recommended order:

1. **first**: local CLI/manual command
2. **later**: hidden admin page or protected admin mutation

Do **not** launch with a public match creation surface.

---

## B. Replay must be first-class

Replay is not a nice-to-have. It should shape the storage design.

For every completed match, store enough to replay it **without depending on brittle future reconstruction**.

At minimum store:

- initial engine state
- engine version / ruleset identifier
- participants and model profile metadata
- ordered list of plies
- `move_pdn` for each ply
- authoritative `state_after` for each ply
- winner / termination reason
- timestamps / latency per ply

### Why store `state_after` per ply?

Because replay should remain stable even if:

- the runtime implementation evolves
- the engine gets refactored later
- future replay UI wants fast direct rendering without recomputing every move

Since arena matches are manually triggered and not high-volume at first, the extra storage is worth the reliability.

---

## C. Separate public replay data from private debug data

It is fine to keep internal debug logs such as:

- raw model output
- provider request ids
- token usage
- timeout / retry metadata

But public replay pages should not depend on exposing hidden reasoning.

Public replay should focus on:

- board progression
- move list
- metadata about the participants
- result
- optional short public-safe commentary later

---

## D. Keep arena agents separate from released product agents

The current `agents` table is about product-facing released agents like `sinza`.

Do not overload that table for experimental LLM arena identities.

Instead, add arena-specific tables.

This keeps:

- released game agents
- experimental arena profiles

cleanly separated.

---

## E. Use engine-native colors in backend execution

In the backend runner and stored arena records, prefer engine-native colors:

- `red`
- `white`

Only map into UI-facing colors during rendering if needed.

This avoids confusion between the current web UI conventions and the engine API contract.

---

## Foundation Work Before Arena Execution

Before building the arena, tighten the shared contract.

### Required cleanup

The TypeScript web client currently mirrors most engine API types, but the engine schema includes fields like `pending_captures` that should be preserved exactly.

Before arena work begins:

1. create shared engine contract types in `packages/shared`
2. make web and runner import those shared types
3. ensure the shared `StatePayload` matches the Python schema exactly, including:
   - `rows`
   - `side_to_move`
   - `forced_square`
   - `pending_captures`
   - `no_progress_count`
   - `repetition_counts`

This should be done early to avoid replay bugs and forced-capture edge-case bugs.

---

## Proposed Data Model

Start small. Do not build a full tournament engine before single-match persistence works.

## Phase 1 tables

### `arenaProfiles`
Represents one configured arena participant profile.

Suggested fields:

- `profileId`
- `displayName`
- `provider` (`openrouter` for now)
- `model` (exact provider model id)
- `promptVersion`
- `temperature`
- `maxOutputTokens`
- `timeoutMs`
- `enabled`
- `public`
- `gameKey` (`checkers`)
- `variantKey` (`tanzanian-8x8`)
- `createdAt`
- `updatedAt`

### `arenaMatches`
Represents one requested/running/completed match.

Suggested fields:

- `matchId`
- `gameKey`
- `variantKey`
- `status` (`pending`, `running`, `completed`, `failed`, `aborted`)
- `requestedBy`
- `requestedAt`
- `startedAt`
- `endedAt`
- `redProfileId`
- `whiteProfileId`
- `initialState`
- `currentState`
- `winner`
- `terminationReason`
- `totalPlies`
- `engineBaseUrl`
- `engineVersion` or ruleset/version marker
- `errorSummary`
- `visibility` (`private`, `public`)

### `arenaPlies`
Stores one authoritative ply record per move.

Suggested fields:

- `matchId`
- `plyIndex`
- `side`
- `profileId`
- `movePdn`
- `legalMoves` (optional; good for debugging, optional for v1)
- `stateBefore`
- `stateAfter`
- `latencyMs`
- `providerRequestId` (optional)
- `rawOutput` (optional, private/debug only)
- `usage` (optional)
- `createdAt`

### Why `stateBefore` and `stateAfter`?

If you can afford the storage, this is the cleanest replay design.

It makes:

- live spectating
- completed replay
- debugging invalid outputs
- future analysis

much simpler.

## Phase 2+ tables

Only after the basics work, consider adding:

- `arenaRuns` for grouped batches / tournaments
- `arenaRatings` for Glicko/Elo snapshots
- `arenaOpenings` for curated opening seeds

---

## Match Execution Contract

The runner should use a strict move-selection contract.

## Prompt input

For each turn, send the current model:

- side to move
- authoritative serialized state
- authoritative legal moves
- short rules reminder
- recent move history
- output instruction: choose one legal move only

## Output format

Require a tiny structured response such as:

```json
{ "move_pdn": "9-14" }
```

## Validation rules

1. if the model returns valid JSON and a legal move, continue
2. if the model returns invalid JSON, do one repair attempt
3. if it still fails, mark the match failed or forfeit that side based on chosen policy
4. if the provider times out, do one bounded retry
5. if the provider is down, mark the match `aborted` or `failed` rather than inventing a result

### Recommendation

For fair arena results, distinguish between:

- **model/protocol failure**
- **provider/network failure**

Do not blur them together.

---

## Fairness Rules

If we want the arena results to mean anything, use these rules from the start.

1. **Same prompt skeleton for every model**
2. **Neutral move ordering**
   - sort `legal_moves` deterministically before prompting
   - do not leak engine-preferred ordering by accident
3. **Low temperature**
   - use `0` or a very low value unless testing creativity on purpose
4. **Bounded output budget**
   - keep outputs short and structured
5. **Consistent timeout policy**
6. **Color-balanced evaluation**
   - for serious comparisons, play both colors
7. **Opening diversity later**
   - once single-match flow is stable, add curated opening seeds or balanced starting positions

---

## Manual Trigger Workflow

Because only you should trigger these matches, the recommended rollout is:

## v1

- a local CLI command creates a pending match
- the runner claims that match and executes it

Example conceptual flow:

```text
pnpm arena:create --red claude-sonnet --white qwen-72b
pnpm arena:run --match <id>
```

## v2

- a hidden admin page in `apps/web`
- or a protected admin-only route / mutation
- still manual, never public

### Security note

Because the repo currently does not have strong public auth for this feature, do not rely on a visible client-side button for match creation.

Use one of:

- local-only CLI
- server route protected by admin secret
- future real admin auth

---

## UI Roadmap

## Initial arena UI

The first UI does not need to be elaborate.

It should support:

- list of recent arena matches
- match detail page
- current status (`pending`, `running`, `completed`, `failed`)
- participant cards
- live board position for running matches
- move list
- final result

## Replay UI

Completed matches should support:

- stepping forward/backward through plies
- jump to start / end
- viewing board state at each ply
- viewing participant metadata
- optionally showing per-ply latency

### Recommended routes

```text
/arena
/arena/matches/[matchId]
```

### Admin routes later

```text
/arena/admin
```

Only add admin controls after basic read-only viewing works.

---

## Incremental Build Plan

This is the recommended implementation order.

## Phase 0 — Contract tightening and design lock

### Scope

Lock the arena architecture before any expensive provider integration.

### Tasks

- add this roadmap doc
- move shared engine contract types into `packages/shared`
- make the shared `StatePayload` match the engine schema exactly
- define arena TS types for:
  - profile
  - match
  - ply
  - status enums
- decide exact prompt schema and output schema
- decide failure policy for invalid model outputs

### Deliverables

- shared TypeScript types
- prompt template file(s)
- provider adapter interface
- clear status enum definitions

### Exit criteria

- one source of truth for engine payload types exists
- replay-required fields are agreed
- no ambiguity remains around who owns legality or state transitions

---

## Phase 1 — Local single-match harness

### Scope

Run one complete model-vs-model game outside the UI first.

### Tasks

- add `apps/arena-runner`
- implement engine API client for the runner
- implement `OpenRouterAdapter`
- build a single-match execution loop
- print or save a local JSON match log
- use manual CLI invocation only

### Notes

This phase should not depend on Convex UI work.

The goal is to prove:

- the prompt shape works
- the models can reliably select legal moves
- the engine loop is stable
- the cost/latency is acceptable

### Exit criteria

- a single match can be run locally end-to-end
- move selection is validated against legal moves
- a completed JSON transcript exists

---

## Phase 2 — Convex-backed persisted matches

### Scope

Persist arena matches and plies so the product can display them.

### Tasks

- add new Convex schema entries for arena tables
- add mutations/queries/internal functions for:
  - create pending match
  - claim match
  - append ply
  - complete match
  - fail match
  - list recent matches
  - fetch match detail + plies
- make the runner write each ply to Convex as it happens
- persist initial state and final state
- persist replay-safe board snapshots per ply

### Important

Do not wait until the match ends to write everything.

Write incrementally so the UI can subscribe live.

### Exit criteria

- a pending match can be created manually
- the runner can claim and execute it
- plies appear in Convex during execution
- a completed match can be reloaded entirely from stored data

---

## Phase 3 — Read-only arena UI and replay UI

### Scope

Expose the arena in the web app.

### Tasks

- add `/arena` list page
- add `/arena/matches/[matchId]` detail page
- subscribe to live match state through Convex
- show board, move list, result, participant metadata
- add replay controls for completed matches
- render from stored match + ply data, not from ad hoc local state only

### Recommended UX order

1. recent matches list
2. running/completed badge
3. match detail board
4. move list
5. replay controls

### Exit criteria

- a running match is viewable in the UI
- a completed match can be replayed step-by-step
- the replay works from stored data alone

---

## Phase 4 — Manual batch runs and standings

### Scope

After single matches and replay are solid, add grouped evaluation.

### Tasks

- add `arenaRuns` or equivalent grouping model
- create batches manually from a small set of profiles
- support paired games with color swap
- optionally add curated opening seeds
- compute standings from completed matches
- optionally add lightweight Elo/Glicko snapshots

### Important

Do not add ratings before you trust match persistence and failure handling.

### Exit criteria

- a manually triggered batch can run multiple matches
- results are grouped cleanly
- standings can be shown on the UI

---

## Phase 5 — Hardening and ops

### Scope

Make the arena safe to operate repeatedly.

### Tasks

- add provider timeout and retry policies
- add per-match max ply cap
- add per-turn timeout cap
- store token/cost metadata where available
- add retry-safe claim/lock semantics for runner execution
- ensure only one runner can own a match at a time
- add admin-only controls to cancel or retry matches
- separate public replay data from private debug logs

### Exit criteria

- failed matches do not corrupt standings
- duplicate runners cannot double-play one match
- costs and outages are observable

---

## Suggested File / Module Layout

This is a recommended direction, not a hard requirement.

```text
apps/
  arena-runner/
    src/
      cli.ts
      config.ts
      engineClient.ts
      runner.ts
      adapters/
        openrouter.ts
      prompts/
        checkersMoveSelection.ts

apps/web/
  app/
    arena/
      page.tsx
      matches/[matchId]/page.tsx
      admin/page.tsx            # later

convex/
  arenaProfiles.ts
  arenaMatches.ts
  arenaPlies.ts
  arenaRuns.ts                 # later
  schema.ts

packages/shared/
  src/
    engine.ts                  # canonical engine payload types
    arena.ts                   # arena-specific types
```

---

## OpenRouter and Model Identity Guidance

For arena integrity, store and display the exact model profile, not just a brand label.

Good profile identity examples:

- `claude-sonnet-4-checkers-v1`
- `qwen-72b-instruct-checkers-v1`
- `glm-4.5-checkers-v1`

Each profile should pin:

- provider
- exact model id
- prompt version
- temperature
- token budget
- timeout

This matters because changing any of those can change playing strength.

---

## Replay Data Requirements

A match should be replayable without relying on inference happening again.

For each match, persist:

- `initialState`
- ordered plies
- `stateAfter` per ply
- result
- participant metadata
- timestamps

Optional but useful:

- per-ply legal move list
- per-ply latency
- provider/model metadata snapshot at match time

### Recommendation

Snapshot the participant profile fields onto the match record as well.

That way a replay still describes the original participants even if the underlying profile is edited later.

---

## Failure Policies

The implementation agent should choose one clear policy and apply it consistently.

Recommended status meanings:

- `completed`
  - normal finished game
- `failed`
  - model output invalid beyond retry budget, or internal execution bug
- `aborted`
  - external provider outage / intentional cancellation

Recommended policy:

- protocol violation by a model after retry budget -> loss for that side or `failed`, depending on whether you want strict competition immediately
- provider outage -> `aborted`
- internal runner crash -> `failed`

Pick one and document it in code comments and UI labels.

---

## What Not To Do Early

To keep this project incremental and reliable, avoid these traps:

- do not build public arena creation before admin-only flows
- do not compute fancy ratings before replay and persistence are correct
- do not let the browser talk directly to OpenRouter
- do not reimplement legality in the frontend
- do not store only a final result and lose the move-by-move record
- do not depend on raw model reasoning for public product features
- do not overload the existing public `agents` table for experimental arena identities

---

## Definition of Done For the First Useful Release

The first meaningful arena release is done when all of the following are true:

1. you can manually create a model-vs-model checkers match
2. the runner executes it end-to-end using the engine API as referee
3. each ply is persisted during execution
4. the web UI shows running and completed matches
5. completed matches can be replayed step-by-step
6. the stored replay data is sufficient without re-running inference
7. the feature is admin-triggered only

That is the right first destination.

Ratings, tournaments, and public polish can come after that.

---

## Recommended First Execution Order For an Implementation Agent

If another agent is following this roadmap, the safest order is:

1. tighten shared engine payload types
2. create the arena runner and local single-match harness
3. prove OpenRouter move selection works reliably
4. add Convex persistence for matches and plies
5. wire the runner to persist live progress
6. build read-only arena pages in `apps/web`
7. add replay controls
8. add admin-only manual creation flow
9. only then add batch runs / standings / ratings

This order minimizes wasted work and keeps the system understandable at every stage.
