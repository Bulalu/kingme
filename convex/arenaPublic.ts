import { paginationOptsValidator } from "convex/server";
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
  // Surface cardUrl + series explicitly so they're always present on
  // the wire — either the value or null. Client code shouldn't have
  // to distinguish "undefined on the doc" from "explicit null".
  return {
    ...rest,
    cardUrl: m.cardUrl ?? null,
    series: m.series ?? null,
  };
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
    // say is public-safe — it's a deliberate in-character line the
    // model emitted as part of the game, not a debug trace.
    say: p.say ?? null,
    createdAt: p.createdAt,
  };
}

// Newest-first, public matches only. `limit` caps at 50 to keep list
// pages cheap; richer pagination can come once there are enough
// matches to warrant it. The integer/finite guard defends against a
// misbehaving caller passing NaN/Infinity/1.5 — `.take()` would
// otherwise error at runtime on this public endpoint.
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const raw = limit ?? 25;
    const normalized = Number.isFinite(raw) ? Math.floor(raw) : 25;
    const take = Math.min(Math.max(normalized, 1), 50);
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

// Ordered plies for a public match. Paginated so a long match (the
// runner accepts any positive --max-plies) cannot exceed per-query
// row/size limits. Callers pass standard Convex pagination opts; an
// empty page with isDone=true is returned for missing/private matches
// so client code can render uniformly without branching on null.
export const listPlies = query({
  args: {
    matchId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { matchId, paginationOpts }) => {
    const match = await ctx.db
      .query("arenaMatches")
      .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
      .unique();
    if (!match || match.visibility !== "public") {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("arenaPlies")
      .withIndex("by_match_ply", (q) => q.eq("matchId", matchId))
      .order("asc")
      .paginate(paginationOpts);
    return { ...result, page: result.page.map(toPublicPly) };
  },
});
