import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { engineColor, engineState } from "./arenaValidators";

// Arena ply persistence. Same admin-only posture as arenaMatches:
// internal functions only, reached by the runner via ConvexHttpClient
// with a deploy key. See arenaMatches.ts for the broader rationale.

// Record one authoritative ply and advance the parent match. The match
// patch and the ply insert run in the same Convex mutation (one atomic
// transaction), so the UI can never observe a ply row whose matchId
// points at stale currentState.
//
// `plyIndex` must equal the match's current `totalPlies` — this is how
// we detect a double-append from a retrying runner and refuse to write
// gapped or duplicate ply sequences.
export const append = internalMutation({
  args: {
    matchId: v.string(),
    plyIndex: v.number(),
    side: engineColor,
    profileId: v.string(),
    movePdn: v.string(),
    legalMoves: v.optional(v.array(v.string())),
    stateBefore: engineState,
    stateAfter: engineState,
    latencyMs: v.number(),
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
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query("arenaMatches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .unique();
    if (!match) throw new Error(`arena match ${args.matchId} not found`);
    if (match.status !== "running") {
      throw new Error(
        `arena match ${args.matchId} cannot accept plies (status=${match.status})`,
      );
    }
    if (args.plyIndex !== match.totalPlies) {
      throw new Error(
        `ply index mismatch for ${args.matchId}: expected ${match.totalPlies}, got ${args.plyIndex}`,
      );
    }

    const plyId = await ctx.db.insert("arenaPlies", {
      matchId: args.matchId,
      plyIndex: args.plyIndex,
      side: args.side,
      profileId: args.profileId,
      movePdn: args.movePdn,
      legalMoves: args.legalMoves,
      stateBefore: args.stateBefore,
      stateAfter: args.stateAfter,
      latencyMs: args.latencyMs,
      providerRequestId: args.providerRequestId,
      rawOutput: args.rawOutput,
      usage: args.usage,
      createdAt: Date.now(),
    });

    await ctx.db.patch(match._id, {
      currentState: args.stateAfter,
      totalPlies: match.totalPlies + 1,
    });

    return plyId;
  },
});

// Ordered plies for one match. Used for replay rendering and for
// debugging a specific turn's raw model output. Index-ordered so the
// result is always `[ply 0, ply 1, ...]`.
export const listByMatch = internalQuery({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    return await ctx.db
      .query("arenaPlies")
      .withIndex("by_match_ply", (q) => q.eq("matchId", matchId))
      .order("asc")
      .collect();
  },
});
