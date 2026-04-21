import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import type {
  ApiColor,
  MovePayload,
  StatePayload,
} from "@kingme/shared/engine";
import type {
  ArenaMatchStatus,
  ArenaParticipantSnapshot,
  ArenaPly,
  ArenaProfile,
  ArenaTerminationReason,
} from "@kingme/shared/arena";
import type {
  ArenaModelAdapter,
  ArenaModelSelection,
} from "@kingme/shared/arena-prompt";
import {
  ARENA_DEFAULT_MAX_PLIES,
  ARENA_MAX_PROVIDER_RETRIES,
  ARENA_MAX_REPAIR_ATTEMPTS,
} from "@kingme/shared/arena-prompt";

import type { EngineClient } from "./engineClient.js";
import { EngineError } from "./engineClient.js";
import {
  OpenRouterError,
  OpenRouterNetworkError,
  OpenRouterProtocolError,
} from "./adapters/openrouter.js";

export interface RunMatchOptions {
  engine: EngineClient;
  adapter: ArenaModelAdapter;
  redProfile: ArenaProfile;
  whiteProfile: ArenaProfile;
  transcriptPath?: string;
  maxPlies?: number;
  onPly?: (ply: ArenaPly) => void;
  log?: (message: string) => void;
}

export interface MatchResult {
  matchId: string;
  status: ArenaMatchStatus;
  winner: ApiColor | "draw" | null;
  terminationReason: ArenaTerminationReason;
  totalPlies: number;
  errorSummary: string | null;
  transcriptPath: string;
}

function snapshotProfile(profile: ArenaProfile): ArenaParticipantSnapshot {
  return {
    profileId: profile.profileId,
    displayName: profile.displayName,
    provider: profile.provider,
    model: profile.model,
    promptVersion: profile.promptVersion,
    temperature: profile.temperature,
    maxOutputTokens: profile.maxOutputTokens,
    timeoutMs: profile.timeoutMs,
  };
}

async function selectWithRetry(
  adapter: ArenaModelAdapter,
  legalPdns: Set<string>,
  input: Parameters<ArenaModelAdapter["selectMove"]>[0],
  log: (m: string) => void,
): Promise<ArenaModelSelection> {
  let lastProtocolError: OpenRouterProtocolError | null = null;
  let providerAttempts = 0;
  let repairAttempts = 0;

  // providerAttempts counts towards ARENA_MAX_PROVIDER_RETRIES (extra tries).
  // repairAttempts counts towards ARENA_MAX_REPAIR_ATTEMPTS for bad output.
  for (;;) {
    try {
      const selection = await adapter.selectMove(input);
      if (!legalPdns.has(selection.movePdn)) {
        if (repairAttempts >= ARENA_MAX_REPAIR_ATTEMPTS) {
          throw new OpenRouterProtocolError(
            `model chose illegal move "${selection.movePdn}"`,
            selection.rawOutput ?? "",
          );
        }
        repairAttempts += 1;
        log(`  repair attempt ${repairAttempts}: illegal move "${selection.movePdn}"`);
        continue;
      }
      return selection;
    } catch (err) {
      if (err instanceof OpenRouterProtocolError) {
        lastProtocolError = err;
        if (repairAttempts >= ARENA_MAX_REPAIR_ATTEMPTS) {
          throw err;
        }
        repairAttempts += 1;
        log(`  repair attempt ${repairAttempts}: ${err.message}`);
        continue;
      }
      if (
        err instanceof OpenRouterError ||
        err instanceof OpenRouterNetworkError ||
        isAbortError(err)
      ) {
        if (providerAttempts >= ARENA_MAX_PROVIDER_RETRIES) {
          throw err;
        }
        providerAttempts += 1;
        log(`  provider retry ${providerAttempts}: ${(err as Error).message}`);
        continue;
      }
      throw err;
    }
  }
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "AbortError" || err.message.includes("aborted"))
  );
}

function classifyFailure(err: unknown): {
  status: ArenaMatchStatus;
  reason: ArenaTerminationReason;
  summary: string;
} {
  if (err instanceof OpenRouterProtocolError) {
    return {
      status: "failed",
      reason: "protocol_violation",
      summary: err.message,
    };
  }
  if (isAbortError(err)) {
    return {
      status: "aborted",
      reason: "provider_timeout",
      summary: (err as Error).message,
    };
  }
  if (err instanceof OpenRouterError || err instanceof OpenRouterNetworkError) {
    return {
      status: "aborted",
      reason: "provider_error",
      summary: err.message,
    };
  }
  if (err instanceof EngineError) {
    return {
      status: "failed",
      reason: "runner_error",
      summary: err.message,
    };
  }
  return {
    status: "failed",
    reason: "runner_error",
    summary: err instanceof Error ? err.message : String(err),
  };
}

export async function runMatch(opts: RunMatchOptions): Promise<MatchResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const maxPlies = opts.maxPlies ?? ARENA_DEFAULT_MAX_PLIES;

  const matchId = randomUUID();
  const transcriptPath =
    opts.transcriptPath ??
    resolve(process.cwd(), "transcripts", `${matchId}.json`);

  const startedAt = Date.now();
  const redSnapshot = snapshotProfile(opts.redProfile);
  const whiteSnapshot = snapshotProfile(opts.whiteProfile);

  log(`match ${matchId}: ${redSnapshot.displayName} (red) vs ${whiteSnapshot.displayName} (white)`);

  const initialState = await opts.engine.getInitialState();
  let state: StatePayload = initialState;
  const plies: ArenaPly[] = [];
  const moveHistory: string[] = [];
  let legal = await opts.engine.getLegalMoves(state);
  let winner = legal.winner;

  let status: ArenaMatchStatus = "running";
  let terminationReason: ArenaTerminationReason = "normal";
  let errorSummary: string | null = null;

  try {
    while (winner === null && plies.length < maxPlies) {
      const sideToMove = state.side_to_move;
      const profile =
        sideToMove === "red" ? opts.redProfile : opts.whiteProfile;
      const legalMoves: MovePayload[] = legal.legal_moves;
      const legalPdns = new Set(legalMoves.map((m) => m.pdn));

      log(`ply ${plies.length + 1} [${sideToMove}] ${profile.displayName}: ${legalMoves.length} legal`);

      let selection: ArenaModelSelection;
      try {
        selection = await selectWithRetry(
          opts.adapter,
          legalPdns,
          {
            state,
            legalMoves,
            sideToMove,
            moveHistory,
            profile,
          },
          log,
        );
      } catch (err) {
        const failure = classifyFailure(err);
        status = failure.status;
        terminationReason = failure.reason;
        errorSummary = `[${sideToMove}] ${failure.summary}`;
        log(`  -> ${failure.reason}: ${failure.summary}`);
        break;
      }

      const stateBefore = state;
      const applied = await opts.engine.applyMove(state, selection.movePdn);
      state = applied.state;
      legal = {
        state: applied.state,
        legal_moves: applied.legal_moves,
        winner: applied.winner,
      };
      winner = applied.winner;

      const ply: ArenaPly = {
        matchId,
        plyIndex: plies.length,
        side: sideToMove,
        profileId: profile.profileId,
        movePdn: applied.applied_move.pdn,
        legalMoves: Array.from(legalPdns),
        stateBefore,
        stateAfter: applied.state,
        latencyMs: selection.latencyMs,
        providerRequestId: selection.providerRequestId,
        rawOutput: selection.rawOutput,
        usage: selection.usage,
        createdAt: Date.now(),
      };
      plies.push(ply);
      moveHistory.push(applied.applied_move.pdn);
      opts.onPly?.(ply);

      log(`  -> ${applied.applied_move.pdn} (${selection.latencyMs}ms)`);
    }

    if (status === "running") {
      if (winner !== null) {
        status = "completed";
        terminationReason = "normal";
      } else {
        status = "completed";
        terminationReason = "max_plies";
      }
    }
  } catch (err) {
    const failure = classifyFailure(err);
    status = failure.status;
    terminationReason = failure.reason;
    errorSummary = failure.summary;
    log(`runner error: ${failure.summary}`);
  }

  const endedAt = Date.now();
  const transcript = {
    matchId,
    gameKey: opts.redProfile.gameKey,
    variantKey: opts.redProfile.variantKey,
    status,
    terminationReason,
    winner,
    errorSummary,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    engineBaseUrl: opts.engine.baseUrl,
    redParticipant: redSnapshot,
    whiteParticipant: whiteSnapshot,
    initialState,
    finalState: state,
    totalPlies: plies.length,
    plies,
  };

  await mkdir(dirname(transcriptPath), { recursive: true });
  await writeFile(transcriptPath, JSON.stringify(transcript, null, 2), "utf8");

  log(
    `match ${matchId} ${status} (${terminationReason}) after ${plies.length} plies; transcript: ${transcriptPath}`,
  );

  return {
    matchId,
    status,
    winner,
    terminationReason,
    totalPlies: plies.length,
    errorSummary,
    transcriptPath,
  };
}
