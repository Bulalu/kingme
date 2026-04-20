import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Agents seed themselves on first reference. The frontend treats an agent
// row as "may not exist yet" — landing card falls back to defaults if the
// query returns null.
export const ensure = mutation({
  args: {
    agentId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, { agentId, displayName }) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("agents", {
      agentId,
      displayName,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalMoves: 0,
    });
  },
});

export const getByAgentId = query({
  args: { agentId: v.string() },
  handler: async (ctx, { agentId }) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
      .unique();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});
