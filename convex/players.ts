import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// One-shot upsert keyed on the browser's anonId. Used on every /sinza boot
// so we always end up with a stable players row before a game begins.
export const upsert = mutation({
  args: {
    anonId: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { anonId, name }) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_anonId", (q) => q.eq("anonId", anonId))
      .unique();

    if (existing) {
      // Only patch name if the caller actually sent one — this lets the
      // initial bootstrap call leave the name alone if the player already
      // chose one in a previous session.
      if (name !== undefined && name !== existing.name) {
        await ctx.db.patch(existing._id, { name });
      }
      return existing._id;
    }

    return await ctx.db.insert("players", {
      anonId,
      name,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  },
});

// Keyed on anonId rather than playerId so a malicious client can't use a
// scraped/guessed playerId to rename someone else's entry. Server looks up
// the player from the caller's own anonId (held in localStorage).
export const setName = mutation({
  args: { anonId: v.string(), name: v.string() },
  handler: async (ctx, { anonId, name }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_anonId", (q) => q.eq("anonId", anonId))
      .unique();
    if (!player) throw new Error("player not found");
    await ctx.db.patch(player._id, { name });
  },
});

export const get = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, { playerId }) => {
    return await ctx.db.get(playerId);
  },
});

export const getByAnonId = query({
  args: { anonId: v.string() },
  handler: async (ctx, { anonId }) => {
    return await ctx.db
      .query("players")
      .withIndex("by_anonId", (q) => q.eq("anonId", anonId))
      .unique();
  },
});
