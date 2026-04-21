// Arena domain types.
//
// Shared between the arena runner (apps/arena-runner), Convex persistence,
// and the web viewer UI. Keep these game-agnostic where reasonable; checkers
// enters only through the engine payloads from ./engine.

import type { ApiColor, StatePayload } from "./engine";

export type GameKey = "checkers";
export type VariantKey = "tanzanian-8x8";

export type ArenaProvider = "openrouter";

export type ArenaMatchStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "aborted";

export type ArenaTerminationReason =
  | "normal"
  | "max_plies"
  | "protocol_violation"
  | "provider_timeout"
  | "provider_error"
  | "runner_error"
  | "cancelled";

export type ArenaVisibility = "private" | "public";

export interface ArenaProfile {
  profileId: string;
  displayName: string;
  provider: ArenaProvider;
  model: string;
  promptVersion: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  enabled: boolean;
  public: boolean;
  gameKey: GameKey;
  variantKey: VariantKey;
  createdAt: number;
  updatedAt: number;
}

// Snapshot of the profile fields needed to describe a participant in a
// completed match, even if the underlying ArenaProfile is later edited.
// Persisted on the match record so replays remain faithful.
export interface ArenaParticipantSnapshot {
  profileId: string;
  displayName: string;
  provider: ArenaProvider;
  model: string;
  promptVersion: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface ArenaMatch {
  matchId: string;
  gameKey: GameKey;
  variantKey: VariantKey;
  status: ArenaMatchStatus;
  requestedBy: string;
  requestedAt: number;
  startedAt: number | null;
  endedAt: number | null;
  redProfileId: string;
  whiteProfileId: string;
  redParticipant: ArenaParticipantSnapshot;
  whiteParticipant: ArenaParticipantSnapshot;
  initialState: StatePayload;
  currentState: StatePayload;
  winner: ApiColor | "draw" | null;
  terminationReason: ArenaTerminationReason | null;
  totalPlies: number;
  engineBaseUrl: string;
  engineVersion: string | null;
  errorSummary: string | null;
  visibility: ArenaVisibility;
}

export interface ArenaUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ArenaPly {
  matchId: string;
  plyIndex: number;
  side: ApiColor;
  profileId: string;
  movePdn: string;
  legalMoves?: string[];
  stateBefore: StatePayload;
  stateAfter: StatePayload;
  latencyMs: number;
  providerRequestId?: string;
  rawOutput?: string;
  usage?: ArenaUsage;
  createdAt: number;
}
