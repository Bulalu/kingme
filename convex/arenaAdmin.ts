import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

// Convex runtime exposes `process.env` for variables set via
// `npx convex env set`, but the Convex tsconfig doesn't pull in
// @types/node. Declare the minimal shape we need.
declare const process: { env: Record<string, string | undefined> };
import {
  arenaGameKey,
  arenaParticipant,
  arenaTerminationReason,
  arenaVariantKey,
  arenaVisibility,
  arenaWinner,
  engineColor,
  engineState,
} from "./arenaValidators";

// Public-but-admin-gated surface for the arena runner and (eventually)
// admin UIs. The real CRUD lives in arenaMatches.ts / arenaPlies.ts as
// internal functions; these wrappers exist only because the Convex
// public client (ConvexHttpClient) cannot call internal.* directly.
//
// Access is gated by a shared secret set via `npx convex env set
// ARENA_ADMIN_SECRET <value>` on the target deployment. The runner
// sends the same value in its `--persist` flow. This is a stopgap until
// real user auth lands in phase 5, at which point these wrappers
// should migrate to `ctx.auth.getUserIdentity()`-based checks.

function assertAdmin(secret: string): void {
  const expected = process.env.ARENA_ADMIN_SECRET;
  if (!expected) {
    throw new Error(
      "ARENA_ADMIN_SECRET not set on this Convex deployment. Run `npx convex env set ARENA_ADMIN_SECRET <value>`.",
    );
  }
  if (secret !== expected) {
    throw new Error("unauthorized: bad ARENA_ADMIN_SECRET");
  }
}

export const createMatch = mutation({
  args: {
    adminSecret: v.string(),
    matchId: v.string(),
    gameKey: arenaGameKey,
    variantKey: arenaVariantKey,
    requestedBy: v.string(),
    redProfileId: v.string(),
    whiteProfileId: v.string(),
    redParticipant: arenaParticipant,
    whiteParticipant: arenaParticipant,
    initialState: engineState,
    engineBaseUrl: v.string(),
    engineVersion: v.optional(v.string()),
    visibility: v.optional(arenaVisibility),
  },
  handler: async (
    ctx,
    { adminSecret, ...rest },
  ): Promise<Id<"arenaMatches">> => {
    assertAdmin(adminSecret);
    return await ctx.runMutation(internal.arenaMatches.create, rest);
  },
});

export const claimMatch = mutation({
  args: {
    adminSecret: v.string(),
    matchId: v.string(),
  },
  handler: async (
    ctx,
    { adminSecret, matchId },
  ): Promise<Id<"arenaMatches">> => {
    assertAdmin(adminSecret);
    return await ctx.runMutation(internal.arenaMatches.claim, { matchId });
  },
});

export const finalizeMatch = mutation({
  args: {
    adminSecret: v.string(),
    matchId: v.string(),
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
      v.literal("aborted"),
    ),
    winner: arenaWinner,
    terminationReason: arenaTerminationReason,
    errorSummary: v.optional(v.string()),
  },
  handler: async (ctx, { adminSecret, ...rest }): Promise<void> => {
    assertAdmin(adminSecret);
    await ctx.runMutation(internal.arenaMatches.finalize, rest);
  },
});

export const appendPly = mutation({
  args: {
    adminSecret: v.string(),
    matchId: v.string(),
    plyIndex: v.number(),
    side: engineColor,
    profileId: v.string(),
    movePdn: v.string(),
    legalMoves: v.optional(v.array(v.string())),
    stateBefore: engineState,
    stateAfter: engineState,
    latencyMs: v.number(),
    say: v.optional(v.union(v.string(), v.null())),
    providerRequestId: v.optional(v.string()),
    rawOutput: v.optional(v.string()),
    usage: v.optional(
      v.object({
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
      }),
    ),
  },
  handler: async (
    ctx,
    { adminSecret, ...rest },
  ): Promise<Id<"arenaPlies">> => {
    assertAdmin(adminSecret);
    return await ctx.runMutation(internal.arenaPlies.append, rest);
  },
});
