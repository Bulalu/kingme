import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { rateLimiter } from "./rateLimits";

// A game that hasn't seen a `complete` call within this window is treated
// as abandoned — auto-forfeited to the agent by the cron. 30 minutes is
// comfortably longer than any real game (5–15 min).
const ABANDON_THRESHOLD_MS = 30 * 60 * 1000;

// Open a new game row when the arena boots. Returns a gameId the client
// holds onto until `complete` is called. Also makes sure the agent row
// exists so denormalized counters can be bumped later.
//
// Keyed on anonId rather than playerId — the server resolves it so a
// client can't start a game attributed to some other player they guessed.
export const start = mutation({
  args: {
    anonId: v.string(),
    agentId: v.string(),
    agentDisplayName: v.string(),
  },
  handler: async (ctx, { anonId, agentId, agentDisplayName }) => {
    await rateLimiter.limit(ctx, "startGame", { key: anonId, throws: true });
    const player = await ctx.db
      .query("players")
      .withIndex("by_anonId", (q) => q.eq("anonId", anonId))
      .unique();
    if (!player) throw new Error("player not found");

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

    // Dedupe: if the player already has a *fresh* unfinished game against
    // this agent, reuse it. A refresh storm won't spawn phantom losses.
    // Games older than the abandon threshold are ignored here — they'll
    // be swept up by the forfeit cron and the player gets a new row.
    const cutoff = Date.now() - ABANDON_THRESHOLD_MS;
    const openGame = await ctx.db
      .query("games")
      .withIndex("by_player", (q) => q.eq("playerId", player._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("agentId"), agentId),
          q.eq(q.field("endedAt"), undefined),
          q.gte(q.field("startedAt"), cutoff),
        ),
      )
      .first();
    if (openGame) return openGame._id;

    return await ctx.db.insert("games", {
      playerId: player._id,
      agentId,
      startedAt: Date.now(),
      moves: 0,
    });
  },
});

// Mark a game as finished and bump denormalized counters on the player and
// agent. `winner` is from the perspective of the human:
//   "human" = player won, "agent" = sinza won, "draw" = neither.
//
// anonId is checked against the game's player to prevent a client from
// completing someone else's game with a scraped gameId.
export const complete = mutation({
  args: {
    gameId: v.id("games"),
    anonId: v.string(),
    winner: v.union(
      v.literal("human"),
      v.literal("agent"),
      v.literal("draw"),
    ),
    moves: v.number(),
  },
  handler: async (ctx, { gameId, anonId, winner, moves }) => {
    await rateLimiter.limit(ctx, "completeGame", { key: anonId, throws: true });
    const game = await ctx.db.get(gameId);
    if (!game) {
      throw new Error(`game ${gameId} not found`);
    }
    const caller = await ctx.db
      .query("players")
      .withIndex("by_anonId", (q) => q.eq("anonId", anonId))
      .unique();
    if (!caller || caller._id !== game.playerId) {
      throw new Error("not your game");
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

// Auto-forfeit unfinished games older than ABANDON_THRESHOLD_MS. Runs on a
// cron (see convex/crons.ts). Batched so a single run stays within Convex
// transaction limits; schedules itself again if it hit the batch ceiling.
export const forfeitAbandoned = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ABANDON_THRESHOLD_MS;
    const batchSize = 50;

    const candidates = await ctx.db
      .query("games")
      .filter((q) =>
        q.and(
          q.eq(q.field("endedAt"), undefined),
          q.lt(q.field("startedAt"), cutoff),
        ),
      )
      .take(batchSize);

    for (const game of candidates) {
      // Re-check under transaction — another writer may have completed it.
      const fresh = await ctx.db.get(game._id);
      if (!fresh || fresh.endedAt !== undefined) continue;

      await ctx.db.patch(game._id, {
        endedAt: Date.now(),
        winner: "agent",
      });

      const player = await ctx.db.get(game.playerId);
      if (player) {
        await ctx.db.patch(player._id, {
          gamesPlayed: player.gamesPlayed + 1,
          losses: player.losses + 1,
          lastPlayedAt: Date.now(),
        });
      }

      const agent = await ctx.db
        .query("agents")
        .withIndex("by_agentId", (q) => q.eq("agentId", game.agentId))
        .unique();
      if (agent) {
        await ctx.db.patch(agent._id, {
          gamesPlayed: agent.gamesPlayed + 1,
          wins: agent.wins + 1,
          totalMoves: agent.totalMoves + fresh.moves,
        });
      }
    }

    return { processed: candidates.length, reachedBatchLimit: candidates.length === batchSize };
  },
});
