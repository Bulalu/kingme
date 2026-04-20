import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Open a new game row when the arena boots. Returns a gameId the client
// holds onto until `complete` is called. Also makes sure the agent row
// exists so denormalized counters can be bumped later.
export const start = mutation({
  args: {
    playerId: v.id("players"),
    agentId: v.string(),
    agentDisplayName: v.string(),
  },
  handler: async (ctx, { playerId, agentId, agentDisplayName }) => {
    // Lazy-seed agent row.
    const existingAgent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", agentId))
      .unique();
    if (!existingAgent) {
      await ctx.db.insert("agents", {
        agentId,
        displayName: agentDisplayName,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalMoves: 0,
      });
    }

    return await ctx.db.insert("games", {
      playerId,
      agentId,
      startedAt: Date.now(),
      moves: 0,
    });
  },
});

// Mark a game as finished and bump denormalized counters on the player and
// agent. `winner` is from the perspective of the human:
//   "human" = player won, "agent" = sinza won, "draw" = neither.
export const complete = mutation({
  args: {
    gameId: v.id("games"),
    winner: v.union(
      v.literal("human"),
      v.literal("agent"),
      v.literal("draw"),
    ),
    moves: v.number(),
  },
  handler: async (ctx, { gameId, winner, moves }) => {
    const game = await ctx.db.get(gameId);
    if (!game) {
      throw new Error(`game ${gameId} not found`);
    }
    // Idempotency guard — refreshes/re-renders shouldn't double-count.
    if (game.endedAt !== undefined) return;

    await ctx.db.patch(gameId, {
      endedAt: Date.now(),
      winner,
      moves,
    });

    // Player counters.
    const player = await ctx.db.get(game.playerId);
    if (player) {
      await ctx.db.patch(player._id, {
        gamesPlayed: player.gamesPlayed + 1,
        wins: player.wins + (winner === "human" ? 1 : 0),
        losses: player.losses + (winner === "agent" ? 1 : 0),
        draws: player.draws + (winner === "draw" ? 1 : 0),
        lastPlayedAt: Date.now(),
      });
    }

    // Agent counters. winner is from human's POV, so it's flipped here.
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", game.agentId))
      .unique();
    if (agent) {
      await ctx.db.patch(agent._id, {
        gamesPlayed: agent.gamesPlayed + 1,
        wins: agent.wins + (winner === "agent" ? 1 : 0),
        losses: agent.losses + (winner === "human" ? 1 : 0),
        draws: agent.draws + (winner === "draw" ? 1 : 0),
        totalMoves: agent.totalMoves + moves,
      });
    }
  },
});

export const getByPlayer = query({
  args: { playerId: v.id("players"), limit: v.optional(v.number()) },
  handler: async (ctx, { playerId, limit }) => {
    return await ctx.db
      .query("games")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .order("desc")
      .take(limit ?? 20);
  },
});
