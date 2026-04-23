import { v } from "convex/values";
import { query } from "./_generated/server";

// Agents are lazy-seeded inline by games.start on the first call for a new
// released agentId — there's no public mutation to insert agent rows. The
// displayName comes from the server-side released-agent catalog, not from
// the browser, which keeps identity metadata authoritative and consistent.

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
