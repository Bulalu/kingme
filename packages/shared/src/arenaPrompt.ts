// Arena prompt contract and failure policy.
//
// The runner MUST present every model with the same structured input and
// require the same structured output. Do NOT ask the model to free-form a
// move and then loosely interpret it — the model picks one exact PDN string
// from the legal list.

import type { ApiColor, MovePayload, StatePayload } from "./engine";
import type { ArenaProfile, ArenaTerminationReason, ArenaUsage } from "./arena";

export const ARENA_PROMPT_VERSION = "checkers-move-selection-v2";

// Max length of the model's in-character commentary. Enforced by the
// JSON schema on the provider side and by the parser as a defence in
// depth. Models that want to stay silent return `"say": null`.
export const ARENA_MAX_SAY_CHARS = 120;

export interface ArenaPromptInput {
  state: StatePayload;
  legalMoves: MovePayload[];
  sideToMove: ApiColor;
  moveHistory: string[];
  profile: ArenaProfile;
}

// The only structured output we accept from a model turn. `say` is a
// short optional taunt / chirp / regret line — null means "nothing to
// say this turn", which we want the model to feel free to do.
export interface ArenaModelOutput {
  move_pdn: string;
  say: string | null;
}

export interface ArenaModelSelection {
  movePdn: string;
  say: string | null;
  latencyMs: number;
  rawOutput?: string;
  providerRequestId?: string;
  usage?: ArenaUsage;
}

export interface ArenaModelAdapter {
  selectMove(input: ArenaPromptInput): Promise<ArenaModelSelection>;
}

// Failure policy for the arena runner. Pick one policy and apply it
// consistently across the codebase.
//
//   protocol_violation_after_retry  -> forfeit the offending side
//   provider_timeout                -> one bounded retry, then `aborted`
//   provider_error                  -> `aborted`
//   runner_error / internal crash   -> `failed`
//
// `aborted` and `failed` must NOT be counted toward standings.
export const ARENA_MAX_REPAIR_ATTEMPTS = 1;
export const ARENA_MAX_PROVIDER_RETRIES = 1;
export const ARENA_DEFAULT_TURN_TIMEOUT_MS = 30_000;
export const ARENA_DEFAULT_MAX_PLIES = 300;

export interface ArenaTurnFailure {
  reason: Extract<
    ArenaTerminationReason,
    "protocol_violation" | "provider_timeout" | "provider_error" | "runner_error"
  >;
  detail: string;
  side: ApiColor;
}
