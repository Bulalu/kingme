import { v } from "convex/values";
import { query } from "./_generated/server";

// Agents are lazy-seeded inline by games.start on the first call for a new
// agentId — there's no public mutation to insert agent rows. This keeps
// agentId + displayName server-authoritative (derived from the call that
// opens an actual game) instead of client-controlled, and removes one more
// public write surface a script could abuse.

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
