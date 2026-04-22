// Convex-backed persistence for the arena runner.
//
// The runner calls `create` once, `claim` once, `appendPly` per move,
// and `finalize` once on termination. All four go through the admin
// wrappers in convex/arenaAdmin.ts using a shared ARENA_ADMIN_SECRET;
// the internal tables remain unreachable from the public Convex client.
//
// Persistence is best-effort *in aggregate but strict per-call*: the
// caller decides how to react to a rejected promise (runner.ts logs
// and disables further persistence on the first failure, so a broken
// Convex cannot take down an otherwise valid local match).

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
// Type-only import so we inherit precise mutation arg/return types from the
// generated d.ts without forcing Node to load the corresponding .js at
// runtime (convex/_generated/api.js is ESM-authored but sits under a
// directory with no `type: module`, so a runtime import would fail).
import type { api as GeneratedApi } from "@convex/_generated/api";

const api = anyApi as unknown as typeof GeneratedApi;

import type { ApiColor, StatePayload } from "@kingme/shared/engine";
import type {
  ArenaMatchStatus,
  ArenaParticipantSnapshot,
  ArenaTerminationReason,
  ArenaUsage,
  ArenaVisibility,
  GameKey,
  VariantKey,
} from "@kingme/shared/arena";

export interface CreateMatchArgs {
  matchId: string;
  gameKey: GameKey;
  variantKey: VariantKey;
  requestedBy: string;
  redProfileId: string;
  whiteProfileId: string;
  redParticipant: ArenaParticipantSnapshot;
  whiteParticipant: ArenaParticipantSnapshot;
  initialState: StatePayload;
  engineBaseUrl: string;
  engineVersion?: string;
  visibility?: ArenaVisibility;
}

export interface AppendPlyArgs {
  matchId: string;
  plyIndex: number;
  side: ApiColor;
  profileId: string;
  movePdn: string;
  legalMoves?: string[];
  stateBefore: StatePayload;
  stateAfter: StatePayload;
  latencyMs: number;
  say?: string | null;
  providerRequestId?: string;
  rawOutput?: string;
  usage?: ArenaUsage;
}

export interface FinalizeMatchArgs {
  matchId: string;
  status: Extract<ArenaMatchStatus, "completed" | "failed" | "aborted">;
  winner: ApiColor | "draw" | null;
  terminationReason: ArenaTerminationReason;
  errorSummary?: string;
}

export interface ArenaPersistence {
  create(args: CreateMatchArgs): Promise<void>;
  claim(matchId: string): Promise<void>;
  appendPly(args: AppendPlyArgs): Promise<void>;
  finalize(args: FinalizeMatchArgs): Promise<void>;
}

export interface ConvexPersistenceConfig {
  convexUrl: string;
  adminSecret: string;
}

export function createConvexPersistence(
  config: ConvexPersistenceConfig,
): ArenaPersistence {
  const client = new ConvexHttpClient(config.convexUrl);
  const adminSecret = config.adminSecret;

  return {
    async create(args) {
      await client.mutation(api.arenaAdmin.createMatch, {
        adminSecret,
        ...args,
      });
    },
    async claim(matchId) {
      await client.mutation(api.arenaAdmin.claimMatch, {
        adminSecret,
        matchId,
      });
    },
    async appendPly(args) {
      await client.mutation(api.arenaAdmin.appendPly, {
        adminSecret,
        ...args,
      });
    },
    async finalize(args) {
      await client.mutation(api.arenaAdmin.finalizeMatch, {
        adminSecret,
        ...args,
      });
    },
  };
}
