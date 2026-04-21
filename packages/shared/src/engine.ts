// Canonical engine API contract types.
//
// Mirrors apps/engine-api/src/kingme_engine_api/schemas.py field-for-field.
// The Python engine is the source of truth for legal moves and state
// transitions; this file exists so TypeScript consumers (web, arena runner,
// convex) all agree on the wire shape.
//
// When the Python schema changes, update this file in the same commit.

export type ApiColor = "red" | "white";
export type ColorLiteral = ApiColor | "draw";
export type ApiWinner = ColorLiteral | null;

export interface RepetitionCount {
  board: number[];
  side_to_move: ApiColor;
  count: number;
}

export interface StatePayload {
  rows: string[];
  side_to_move: ApiColor;
  forced_square: number | null;
  pending_captures: number[];
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

export interface SearchPayload {
  score: number;
  depth: number;
  nodes: number;
  principal_variation: string[];
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

export interface HealthPayload {
  ok: boolean;
  app: string;
}

export interface LegalMovesRequest {
  state: StatePayload;
}

export interface LegalMovesResponse {
  state: StatePayload;
  legal_moves: MovePayload[];
  winner: ApiWinner;
}

export interface ApplyMoveRequest {
  state: StatePayload;
  move_pdn: string;
}

export interface ApplyMoveResponse {
  applied_move: MovePayload;
  state: StatePayload;
  legal_moves: MovePayload[];
  winner: ApiWinner;
}

export interface AgentMoveRequest {
  agent_id: string;
  state: StatePayload;
}

export interface AgentMoveResponse {
  agent: AgentSummary;
  move: MovePayload;
  state: StatePayload;
  legal_moves: MovePayload[];
  winner: ApiWinner;
  search: SearchPayload;
}

export interface PlayTurnRequest {
  agent_id: string;
  state: StatePayload;
  move_pdn: string;
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
