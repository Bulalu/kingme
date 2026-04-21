import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";

// Public-read surface for the arena. Only returns matches whose
// `visibility` is `"public"`; private matches (the runner's default)
// are never exposed here. Private debug fields — raw model output,
// provider request ids, token usage, internal error summaries, the
// user handle that requested the match — are stripped from the
// response per the "separate public replay from private debug data"
// rule in docs/llm-arena-roadmap.md.

type ArenaMatchDoc = Doc<"arenaMatches">;
type ArenaPlyDoc = Doc<"arenaPlies">;

function toPublicMatch(m: ArenaMatchDoc) {
  const {
    requestedBy: _requestedBy,
    errorSummary: _errorSummary,
    ...rest
  } = m;
  return rest;
}

function toPublicPly(p: ArenaPlyDoc) {
  return {
    _id: p._id,
    _creationTime: p._creationTime,
    matchId: p.matchId,
    plyIndex: p.plyIndex,
    side: p.side,
    profileId: p.profileId,
    movePdn: p.movePdn,
    stateBefore: p.stateBefore,
    stateAfter: p.stateAfter,
    latencyMs: p.latencyMs,
    createdAt: p.createdAt,
  };
}

// Newest-first, public matches only. `limit` caps at 50 to keep list
// pages cheap; richer pagination can come once there are enough
// matches to warrant it.
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const take = Math.min(Math.max(limit ?? 25, 1), 50);
    const matches = await ctx.db
      .query("arenaMatches")
      .withIndex("by_visibility_requestedAt", (q) => q.eq("visibility", "public"))
      .order("desc")
      .take(take);
    return matches.map(toPublicMatch);
  },
});

// Single public match by its external matchId. Returns null both for
// missing matches and for private ones so a scraper can't distinguish
// "not found" from "exists but private".
export const getMatch = query({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db
      .query("arenaMatches")
      .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
      .unique();
    if (!match || match.visibility !== "public") return null;
    return toPublicMatch(match);
  },
});

// Ordered plies for a public match; empty array for missing/private
// matches so client code can render "no plies yet" uniformly.
export const listPlies = query({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db
      .query("arenaMatches")
      .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
      .unique();
    if (!match || match.visibility !== "public") return [];
    const plies = await ctx.db
      .query("arenaPlies")
      .withIndex("by_match_ply", (q) => q.eq("matchId", matchId))
      .order("asc")
      .collect();
    return plies.map(toPublicPly);
  },
});
