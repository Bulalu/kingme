import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  arenaGameKey,
  arenaParticipant,
  arenaVariantKey,
  arenaVisibility,
  engineState,
} from "./arenaValidators";

// Arena match CRUD. Admin-only per docs/llm-arena-roadmap.md: exported
// as `internalMutation`/`internalQuery` so they are NOT reachable from
// the public Convex client. The runner will call them in step 4 via
// `ConvexHttpClient` configured with a deploy key (Convex's built-in
// admin credential); a future admin UI would wrap these in public
// mutations/queries that gate on `ctx.auth.getUserIdentity()`.

// Create a new match row in `pending` state. The runner supplies the
// external matchId (a UUID) so transcripts on disk and rows in Convex
// share the same public handle. Idempotent on matchId: calling twice
// with the same matchId is rejected so a runner retry can't double-seed.
export const create = internalMutation({
  args: {
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
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("arenaMatches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .unique();
    if (existing) {
      throw new Error(`arena match ${args.matchId} already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("arenaMatches", {
      matchId: args.matchId,
      gameKey: args.gameKey,
      variantKey: args.variantKey,
      status: "pending",
      requestedBy: args.requestedBy,
      requestedAt: now,
      startedAt: null,
      endedAt: null,
      redProfileId: args.redProfileId,
      whiteProfileId: args.whiteProfileId,
      redParticipant: args.redParticipant,
      whiteParticipant: args.whiteParticipant,
      initialState: args.initialState,
      currentState: args.initialState,
      winner: null,
      terminationReason: null,
      totalPlies: 0,
      engineBaseUrl: args.engineBaseUrl,
      engineVersion: args.engineVersion ?? null,
      errorSummary: null,
      visibility: args.visibility ?? "private",
    });
  },
});

// Look up a match by its external matchId. Returns null when not found
// so admin UIs can render a 404 without catching exceptions.
export const getByMatchId = internalQuery({
  args: { matchId: v.string() },
  handler: async (ctx, { matchId }) => {
    return await ctx.db
      .query("arenaMatches")
      .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
      .unique();
  },
});

// Recent matches, newest first. `limit` caps at 100 to keep list views
// cheap; pagination comes later with a cursor-based variant if needed.
// `visibility` filters to public rows for (future) public listings; when
// omitted, all rows are returned — admin default.
export const listRecent = internalQuery({
  args: {
    limit: v.optional(v.number()),
    visibility: v.optional(arenaVisibility),
  },
  handler: async (ctx, { limit, visibility }) => {
    const take = Math.min(Math.max(limit ?? 50, 1), 100);
    const base = ctx.db.query("arenaMatches");
    if (visibility) {
      return await base
        .withIndex("by_visibility_requestedAt", (q) =>
          q.eq("visibility", visibility),
        )
        .order("desc")
        .take(take);
    }
    return await base.order("desc").take(take);
  },
});
