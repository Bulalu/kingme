# Engine API

This document is the integration contract for `kingme` clients and supporting agents.

Use it when building:

- the Next.js frontend
- Convex actions that call the engine
- test harnesses
- other agent workflows that need to validate moves or ask a released bot for a reply

Base URL examples:

- local: `http://127.0.0.1:8051`
- Modal: `https://ctrlx--kingme-engine-api.modal.run`

## Current Public Agents

The current public bots are:

- `sinza`
- `masaki`
- `tabata`

At the moment, they are backed by:

- `sinza` → `engine: alphabeta`, `depth: 7`
- `masaki` → `engine: alphabeta`, `depth: 5`
- `tabata` → `engine: alphabeta`, `depth: 4`

Clients should not hardcode search internals beyond what the API returns. Treat the API as the source of truth.

## Core Rules For Clients

1. The frontend should not implement checkers legality on its own.
2. The engine API is authoritative for:
   - legal moves
   - move application
   - turn order
   - draw/winner detection
3. Clients should preserve and round-trip the full `state` payload exactly as returned.
4. Clients should send PDN move strings returned by the API, not invent their own move encoding.

## Current Ruleset Notes

The live engine currently serves the Tanzanian-style 8x8 variant used by the product team:

- men move forward diagonally one square
- men capture forward only
- captures are mandatory
- kings are flying kings and can travel multiple empty diagonal squares
- kings can capture from distance and may land on any empty square beyond the captured piece
- during a multi-capture sequence, captured pieces stay on the board until the sequence is finished

Frontend code should treat all legality and landing-square generation as engine-owned behavior.

## Data Models

### `StatePayload`

Represents the full playable game state.

```json
{
  "rows": [
    ".r.r.r.r",
    "r.r.r.r.",
    ".r.r.r.r",
    "........",
    "........",
    "w.w.w.w.",
    ".w.w.w.w",
    "w.w.w.w."
  ],
  "side_to_move": "red",
  "forced_square": null,
  "pending_captures": [],
  "no_progress_count": 0,
  "repetition_counts": [
    {
      "board": [1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
      "side_to_move": "red",
      "count": 1
    }
  ]
}
```

Fields:

- `rows`
  - 8 strings, one per board row
  - pieces are serialized as characters for reconstruction
- `side_to_move`
  - `"red"` or `"white"`
- `forced_square`
  - `null` unless the current player is in the middle of a forced multi-jump sequence
- `pending_captures`
  - playable-square indexes for pieces already jumped in the current capture sequence
  - these pieces stay on the board visually/internally until the sequence completes
- `no_progress_count`
  - move counter used in draw logic
- `repetition_counts`
  - repetition-tracking payload
  - clients should store and send it back unchanged

### `MovePayload`

Represents one legal full-turn move.

```json
{
  "pdn": "9-14",
  "actions": [65],
  "path": [8, 13],
  "is_capture": false,
  "capture_count": 0,
  "promotes": false,
  "final_square": 13
}
```

Fields:

- `pdn`
  - move string to use in follow-up requests
- `actions`
  - internal action encoding
  - useful for debugging, not necessary for frontend UX
- `path`
  - 0-based playable-square path used by the engine
- `is_capture`
  - whether the move is a capture sequence
- `capture_count`
  - number of captures in the macro-move
- `promotes`
  - whether the move promotes to king
- `final_square`
  - final landing square in engine coordinates

### `AgentSummary`

```json
{
  "id": "sinza",
  "display_name": "Sinza",
  "description": "Current strongest owned release. Upgraded alpha-beta search running the April 19 strong-mode depth.",
  "engine": "alphabeta",
  "depth": 7,
  "ready": true,
  "public": true
}
```

### `SearchPayload`

Metadata about the engine’s move selection.

```json
{
  "score": 41.0,
  "depth": 7,
  "nodes": 128430,
  "principal_variation": ["9-14", "22-18", "5-9"]
}
```

This payload is optional for UI use, but useful for:

- developer tooling
- “thinking” overlays
- telemetry
- replay/debug views

## Endpoints

### `GET /health`

Basic service liveness check.

Response:

```json
{
  "ok": true,
  "app": "kingme-engine-api"
}
```

### `GET /v1/agents`

Returns the list of publicly configured engine agents.

Current expected response:

```json
[
  {
    "id": "sinza",
    "display_name": "Sinza",
    "description": "Current strongest owned release. Upgraded alpha-beta search running the April 19 strong-mode depth.",
    "engine": "alphabeta",
    "depth": 7,
    "ready": true,
    "public": true
  },
  {
    "id": "masaki",
    "display_name": "Masaki",
    "description": "Masaki is all timing and pressure. She doesn't rush the board. She makes the board rush you.",
    "engine": "alphabeta",
    "depth": 5,
    "ready": true,
    "public": true
  },
  {
    "id": "tabata",
    "display_name": "Tabata",
    "description": "Tabata plays like the room already belongs to him. Calm hand, sharp eye, no wasted moves.",
    "engine": "alphabeta",
    "depth": 4,
    "ready": true,
    "public": true
  }
]
```

Notes:

- today, this returns `sinza`, `masaki`, and `tabata`
- do not hardcode that set forever; still consume it as a list

### `GET /v1/state/initial`

Returns the canonical starting state for a new game.

Use this when:

- starting a new local game
- resetting the board
- initializing a server-side stored match

Response body is a `StatePayload`.

### `POST /v1/state/legal-moves`

Returns all legal full-turn moves for the provided state.

Request:

```json
{
  "state": {
    "rows": [
      ".r.r.r.r",
      "r.r.r.r.",
      ".r.r.r.r",
      "........",
      "........",
      "w.w.w.w.",
      ".w.w.w.w",
      "w.w.w.w."
    ],
    "side_to_move": "red",
    "forced_square": null,
    "no_progress_count": 0,
    "repetition_counts": []
  }
}
```

Response:

```json
{
  "state": { "...": "same state payload" },
  "legal_moves": [
    {
      "pdn": "9-14",
      "actions": [65],
      "path": [8, 13],
      "is_capture": false,
      "capture_count": 0,
      "promotes": false,
      "final_square": 13
    }
  ],
  "winner": null
}
```

Use this for:

- highlighting valid origin/destination choices
- validating stale client state
- supporting replay/debug tools

### `POST /v1/state/apply-move`

Applies one human-selected move to the current state.

Request:

```json
{
  "state": { "...": "current state payload" },
  "move_pdn": "9-14"
}
```

Response:

```json
{
  "applied_move": {
    "pdn": "9-14",
    "actions": [65],
    "path": [8, 13],
    "is_capture": false,
    "capture_count": 0,
    "promotes": false,
    "final_square": 13
  },
  "state": { "...": "next state payload" },
  "legal_moves": [
    {
      "pdn": "22-18",
      "actions": [154],
      "path": [21, 17],
      "is_capture": false,
      "capture_count": 0,
      "promotes": false,
      "final_square": 17
    }
  ],
  "winner": null
}
```

Use this when:

- the user confirms a move
- you want the server to advance the authoritative state

### `POST /v1/play-turn`

Applies the human move and returns Sinza's reply in the same request.

This is the preferred live-play endpoint for the frontend because it removes one full backend round trip from the critical path.

Request:

```json
{
  "agent_id": "sinza",
  "state": { "...": "current state payload" },
  "move_pdn": "9-14"
}
```

Response:

```json
{
  "applied_move": {
    "pdn": "9-14",
    "actions": [65],
    "path": [8, 13],
    "is_capture": false,
    "capture_count": 0,
    "promotes": false,
    "final_square": 13
  },
  "agent": {
    "id": "sinza",
    "display_name": "Sinza",
    "description": "Current strongest owned release. Upgraded alpha-beta search running the April 19 strong-mode depth.",
    "engine": "alphabeta",
    "depth": 7,
    "ready": true,
    "public": true
  },
  "agent_move": {
    "pdn": "22-18",
    "actions": [169],
    "path": [21, 17],
    "is_capture": false,
    "capture_count": 0,
    "promotes": false,
    "final_square": 17
  },
  "state": { "...": "post-agent state payload" },
  "legal_moves": [],
  "winner": null,
  "search": {
    "score": 41.0,
    "depth": 7,
    "nodes": 128430,
    "principal_variation": ["22-18", "10-15", "18x9"]
  }
}
```

Notes:

- if the human move ends the game immediately, `agent` and `agent_move` will be `null`
- the returned `state` is the final authoritative state after the full turn sequence

### `POST /v1/agent-move`

Asks a named engine agent to make the next move.

Request:

```json
{
  "agent_id": "sinza",
  "state": { "...": "current state payload" }
}
```

Response:

```json
{
  "agent": {
    "id": "sinza",
    "display_name": "Sinza",
    "description": "Current strongest owned release. Upgraded alpha-beta search running the April 19 strong-mode depth.",
    "engine": "alphabeta",
    "depth": 7,
    "ready": true,
    "public": true
  },
  "move": {
    "pdn": "22-18",
    "actions": [154],
    "path": [21, 17],
    "is_capture": false,
    "capture_count": 0,
    "promotes": false,
    "final_square": 17
  },
  "state": { "...": "next state payload" },
  "legal_moves": [
    {
      "pdn": "10-15",
      "actions": [74],
      "path": [9, 14],
      "is_capture": false,
      "capture_count": 0,
      "promotes": false,
      "final_square": 14
    }
  ],
  "winner": null,
  "search": {
    "score": 41.0,
    "depth": 7,
    "nodes": 128430,
    "principal_variation": ["22-18", "10-15", "18x9"]
  }
}
```

Use this when:

- the human finishes their turn
- the UI needs the selected agent's reply
- you want bot search metadata for a developer overlay

## Expected Client Game Loop

Recommended loop for the frontend:

1. Call `GET /v1/state/initial`
2. Store that full `state`
3. Call `POST /v1/state/legal-moves`
4. Let the user pick one of the returned `legal_moves`
5. Call `POST /v1/play-turn` with:
   - `agent_id: "<released agent id>"`
   - current state
   - chosen `move_pdn`
6. Replace local state with returned `state`
7. If `winner` is not `null`, stop
8. Repeat

## Error Contract

Expected error behavior:

- `400`
  - malformed state
  - illegal move
  - invalid request payload
- `404`
  - unknown `agent_id`
- `409`
  - known agent exists but is not ready to serve

Example error response:

```json
{
  "detail": "illegal move for current state: 9-14"
}
```

## Recommendations For Other Agents

If another coding agent is integrating with this API, it should assume:

- the set of public agents comes from `GET /v1/agents`
- the engine API owns legality and state transitions
- `StatePayload` must be preserved exactly
- `move_pdn` is the canonical write format
- `rows` are display-friendly, but not enough alone to recreate the full state without the rest of the payload

## TypeScript Starter Types

These are safe starter types for frontend work.

```ts
export type Color = "red" | "white" | "draw";

export interface RepetitionCountPayload {
  board: number[];
  side_to_move: "red" | "white";
  count: number;
}

export interface StatePayload {
  rows: string[];
  side_to_move: "red" | "white";
  forced_square: number | null;
  no_progress_count: number;
  repetition_counts: Array<{
    board: number[];
    side_to_move: "red" | "white";
    count: number;
  }>;
}

export interface MovePayload {
  pdn: string;
  actions: number[];
  path: number[];
  is_capture: boolean;
  capture_count: number;
  promotes: boolean;
  final_square: number;
}

export interface AgentSummary {
  id: string;
  display_name: string;
  description: string;
  engine: string;
  depth: number;
  ready: boolean;
  public: boolean;
}

export interface SearchPayload {
  score: number;
  depth: number;
  nodes: number;
  principal_variation: string[];
}
```

## `curl` Examples

Get initial state:

```bash
curl -sS https://ctrlx--kingme-engine-api.modal.run/v1/state/initial
```

List agents:

```bash
curl -sS https://ctrlx--kingme-engine-api.modal.run/v1/agents
```

Ask a released agent for a move:

```bash
curl -sS https://ctrlx--kingme-engine-api.modal.run/v1/agent-move \
  -H 'content-type: application/json' \
  -d '{
    "agent_id": "sinza",
    "state": {
      "rows": [
        ".r.r.r.r",
        "r.r.r.r.",
        ".r.r.r.r",
        "........",
        "........",
        "w.w.w.w.",
        ".w.w.w.w",
        "w.w.w.w."
      ],
      "side_to_move": "red",
      "forced_square": null,
      "no_progress_count": 0,
      "repetition_counts": []
    }
  }'
```

Play a full human turn and get an agent reply:

```bash
curl -sS https://ctrlx--kingme-engine-api.modal.run/v1/play-turn \
  -H 'content-type: application/json' \
  -d '{
    "agent_id": "sinza",
    "move_pdn": "9-14",
    "state": {
      "rows": [
        ".r.r.r.r",
        "r.r.r.r.",
        ".r.r.r.r",
        "........",
        "........",
        "w.w.w.w.",
        ".w.w.w.w",
        "w.w.w.w."
      ],
      "side_to_move": "red",
      "forced_square": null,
      "no_progress_count": 0,
      "repetition_counts": []
    }
  }'
```
