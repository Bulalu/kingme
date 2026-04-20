import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Records of who's playing on kingme.dev and what they've played against the
// public agents. There's no real auth — `anonId` is a UUID stored in the
// player's localStorage, so the same browser always maps to the same player
// row. Clearing storage = a fresh player.
//
// Counters on `players` and `agents` are denormalized from `games` so the
// landing page and arena top bar can read live stats with one cheap row
// fetch instead of scanning the games table on every render.

export default defineSchema({
  players: defineTable({
    anonId: v.string(),
    name: v.optional(v.string()),
    gamesPlayed: v.number(),
    wins: v.number(),
    losses: v.number(),
    draws: v.number(),
    lastPlayedAt: v.optional(v.number()),
  }).index("by_anonId", ["anonId"]),

  agents: defineTable({
    // Matches the agent id served by apps/engine-api (e.g. "sinza").
    agentId: v.string(),
    displayName: v.string(),
    gamesPlayed: v.number(),
    wins: v.number(),
    losses: v.number(),
    draws: v.number(),
    totalMoves: v.number(),
  }).index("by_agentId", ["agentId"]),

  games: defineTable({
    playerId: v.id("players"),
    agentId: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    // null/undefined while in progress. "human" / "agent" / "draw" once over.
    winner: v.optional(
      v.union(v.literal("human"), v.literal("agent"), v.literal("draw")),
    ),
    moves: v.number(),
  })
    .index("by_player", ["playerId"])
    .index("by_agent_completed", ["agentId", "endedAt"]),
});
