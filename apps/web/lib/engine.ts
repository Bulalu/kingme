// Typed client for the kingme engine API (apps/engine-api on Modal).
// See docs/API.md for the full contract.
//
// Two coordinate systems live side by side here:
//   - API uses 8 strings of 8 chars each, with `r`/`R` and `w`/`W` for
//     red/white pieces (kings uppercase). Move paths are 0-31 dark-square
//     indices, with index 0 at API row 0's first dark square.
//   - The Arena UI uses an 8×8 Piece grid with RED at the bottom (human,
//     moves up) and BLACK at the top (AI, moves down).
//
// Mapping: API "red" → UI BLACK (top, AI), API "white" → UI RED (bottom,
// human). Coordinates are identical (no rotation needed) because the
// dark-square parity matches in both systems.
//
// IMPORTANT: per CLAUDE.md, the engine API is the source of truth for
// legality and state transitions. The frontend only renders what the API
// returns and forwards user clicks back as PDN strings.

import {
  BLACK,
  BLACK_K,
  EMPTY,
  RED,
  RED_K,
  type BoardState,
  type Piece,
  type Side,
} from "./checkers";

const ENGINE_BASE =
  process.env.NEXT_PUBLIC_ENGINE_BASE_URL ??
  "https://ctrlx--kingme-engine-api.modal.run";

// ── Types (mirror docs/API.md) ─────────────────────────────────

export type ApiColor = "red" | "white";

export interface RepetitionCount {
  board: number[];
  side_to_move: ApiColor;
  count: number;
}

export interface StatePayload {
  rows: string[];
  side_to_move: ApiColor;
  forced_square: number | null;
  no_progress_count: number;
  repetition_counts: RepetitionCount[];
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

export type ApiWinner = ApiColor | "draw" | null;

export interface LegalMovesResponse {
  state: StatePayload;
  legal_moves: MovePayload[];
  winner: ApiWinner;
}

export interface ApplyMoveResponse {
  applied_move: MovePayload;
  state: StatePayload;
  legal_moves: MovePayload[];
  winner: ApiWinner;
}

export interface AgentMoveResponse {
  agent: AgentSummary;
  move: MovePayload;
  state: StatePayload;
  legal_moves: MovePayload[];
  winner: ApiWinner;
  search?: SearchPayload;
}

export interface PlayTurnResponse {
  applied_move: MovePayload;
  agent: AgentSummary | null;
  agent_move: MovePayload | null;
  state: StatePayload;
  legal_moves: MovePayload[];
  winner: ApiWinner;
  search?: SearchPayload | null;
}

// ── Fetch wrappers ─────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ENGINE_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`engine ${path} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function getInitialState(
  signal?: AbortSignal,
): Promise<StatePayload> {
  const res = await fetch(`${ENGINE_BASE}/v1/state/initial`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`engine /v1/state/initial ${res.status}`);
  }
  return (await res.json()) as StatePayload;
}

export function getLegalMoves(state: StatePayload) {
  return post<LegalMovesResponse>("/v1/state/legal-moves", { state });
}

export function applyMoveApi(state: StatePayload, movePdn: string) {
  return post<ApplyMoveResponse>("/v1/state/apply-move", {
    state,
    move_pdn: movePdn,
  });
}

export function agentMove(agentId: string, state: StatePayload) {
  return post<AgentMoveResponse>("/v1/agent-move", {
    agent_id: agentId,
    state,
  });
}

export function playTurnApi(
  agentId: string,
  state: StatePayload,
  movePdn: string,
) {
  return post<PlayTurnResponse>("/v1/play-turn", {
    agent_id: agentId,
    state,
    move_pdn: movePdn,
  });
}

// ── Coordinate + color conversions ─────────────────────────────

// API row pieces → UI Piece:
//   'r' / 'R' (API red, top) → UI BLACK / BLACK_K (top, AI)
//   'w' / 'W' (API white, bottom) → UI RED / RED_K (bottom, human)
export function rowsToBoard(rows: string[]): BoardState {
  const board: BoardState = [];
  for (let r = 0; r < 8; r++) {
    const row: Piece[] = [];
    const src = rows[r] ?? "";
    for (let c = 0; c < 8; c++) {
      const ch = src[c];
      if (ch === "r") row.push(BLACK);
      else if (ch === "R") row.push(BLACK_K);
      else if (ch === "w") row.push(RED);
      else if (ch === "W") row.push(RED_K);
      else row.push(EMPTY);
    }
    board.push(row);
  }
  return board;
}

// API "red" turn → UI BLACK turn (AI). API "white" → UI RED (human).
export function apiSideToUi(s: ApiColor): Side {
  return s === "red" ? "black" : "red";
}

// API winner → UI winner. Same color flip; "draw" stays "draw".
export function apiWinnerToUi(w: ApiWinner): Side | "draw" | null {
  if (w === null) return null;
  if (w === "draw") return "draw";
  return apiSideToUi(w);
}

// 0-31 dark-square index ↔ (row, col).
// Row 0 dark squares are at cols 1,3,5,7 (idx 0..3).
// Row 1 dark squares are at cols 0,2,4,6 (idx 4..7).
export function coordToSquare(r: number, c: number): number {
  const file = r % 2 === 0 ? (c - 1) / 2 : c / 2;
  return r * 4 + file;
}

export function squareToCoord(idx: number): [number, number] {
  const r = Math.floor(idx / 4);
  const file = idx % 4;
  const c = r % 2 === 0 ? 1 + 2 * file : 2 * file;
  return [r, c];
}

// Find the legal move that starts at `from` and ends at `to` (UI coords).
// Multi-jumps are returned as a single MovePayload with `path` of length
// >2 — we match by first and last entries only.
export function findMoveByEndpoints(
  legal: MovePayload[],
  from: [number, number],
  to: [number, number],
): MovePayload | undefined {
  const fromSq = coordToSquare(from[0], from[1]);
  const toSq = coordToSquare(to[0], to[1]);
  return legal.find(
    (m) => m.path[0] === fromSq && m.path[m.path.length - 1] === toSq,
  );
}

// Apply a MovePayload to a StatePayload optimistically (visual only).
// Used to update the board immediately on click without waiting for the
// engine round-trip. The engine's authoritative response should overwrite
// this once it lands; on disagreement the server wins.
//
// Note: `no_progress_count` and `repetition_counts` are intentionally NOT
// recomputed accurately here — they only matter for draw detection over
// many moves, and the engine reset will fix them on the next response.
export function optimisticApplyMove(
  state: StatePayload,
  mv: MovePayload,
): StatePayload {
  const grid = state.rows.map((row) => row.split(""));
  const [fr, fc] = squareToCoord(mv.path[0]);
  const piece = grid[fr][fc];

  grid[fr][fc] = ".";
  // Each pair of adjacent squares in `path` that's 2 apart is a jump;
  // the captured piece sits on the midpoint.
  for (let i = 0; i < mv.path.length - 1; i++) {
    const [ar, ac] = squareToCoord(mv.path[i]);
    const [br, bc] = squareToCoord(mv.path[i + 1]);
    if (Math.abs(ar - br) === 2) {
      grid[(ar + br) / 2][(ac + bc) / 2] = ".";
    }
  }

  const [er, ec] = squareToCoord(mv.path[mv.path.length - 1]);
  let placed = piece;
  if (mv.promotes) {
    if (piece === "r") placed = "R";
    else if (piece === "w") placed = "W";
  }
  grid[er][ec] = placed;

  return {
    ...state,
    rows: grid.map((row) => row.join("")),
    side_to_move: state.side_to_move === "red" ? "white" : "red",
    forced_square: null,
  };
}
