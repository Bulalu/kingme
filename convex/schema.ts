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

// ── LLM arena validators ───────────────────────────────────────
//
// Mirrors packages/shared/src/arena.ts and engine.ts. If those change,
// update this block in the same PR. These tables persist manual
// model-vs-model matches per the llm-arena-roadmap; they are NOT wired
// to any public surface — only the runner and (later) admin-only views
// read/write them.

const engineColor = v.union(v.literal("red"), v.literal("white"));

const engineState = v.object({
  rows: v.array(v.string()),
  side_to_move: engineColor,
  forced_square: v.union(v.number(), v.null()),
  pending_captures: v.array(v.number()),
  no_progress_count: v.number(),
  repetition_counts: v.array(
    v.object({
      board: v.array(v.number()),
      side_to_move: engineColor,
      count: v.number(),
    }),
  ),
});

// Snapshot of a profile captured onto the match record at start time so a
// completed match still describes its original participants even if the
// source profile is later edited.
const arenaParticipant = v.object({
  profileId: v.string(),
  displayName: v.string(),
  provider: v.literal("openrouter"),
  model: v.string(),
  promptVersion: v.string(),
  temperature: v.number(),
  maxOutputTokens: v.number(),
  timeoutMs: v.number(),
});

const arenaMatchStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("aborted"),
);

const arenaTerminationReason = v.union(
  v.literal("normal"),
  v.literal("max_plies"),
  v.literal("protocol_violation"),
  v.literal("provider_timeout"),
  v.literal("provider_error"),
  v.literal("runner_error"),
  v.literal("cancelled"),
);

const arenaWinner = v.union(engineColor, v.literal("draw"), v.null());

const arenaGameKey = v.literal("checkers");
const arenaVariantKey = v.literal("tanzanian-8x8");

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

  // Configured arena participant (model + prompt pin). External string
  // profileId is what transcripts, matches, and URLs reference — the Convex
  // _id stays internal.
  arenaProfiles: defineTable({
    profileId: v.string(),
    displayName: v.string(),
    provider: v.literal("openrouter"),
    model: v.string(),
    promptVersion: v.string(),
    temperature: v.number(),
    maxOutputTokens: v.number(),
    timeoutMs: v.number(),
    enabled: v.boolean(),
    public: v.boolean(),
    gameKey: arenaGameKey,
    variantKey: arenaVariantKey,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_gameKey", ["gameKey"]),

  // One requested / running / completed arena match. External matchId
  // (runner-generated UUID) is the public handle.
  arenaMatches: defineTable({
    matchId: v.string(),
    gameKey: arenaGameKey,
    variantKey: arenaVariantKey,
    status: arenaMatchStatus,
    requestedBy: v.string(),
    requestedAt: v.number(),
    startedAt: v.union(v.number(), v.null()),
    endedAt: v.union(v.number(), v.null()),
    redProfileId: v.string(),
    whiteProfileId: v.string(),
    redParticipant: arenaParticipant,
    whiteParticipant: arenaParticipant,
    initialState: engineState,
    currentState: engineState,
    winner: arenaWinner,
    terminationReason: v.union(arenaTerminationReason, v.null()),
    totalPlies: v.number(),
    engineBaseUrl: v.string(),
    engineVersion: v.union(v.string(), v.null()),
    errorSummary: v.union(v.string(), v.null()),
    visibility: v.union(v.literal("private"), v.literal("public")),
  })
    .index("by_matchId", ["matchId"])
    .index("by_status_requestedAt", ["status", "requestedAt"])
    .index("by_visibility_requestedAt", ["visibility", "requestedAt"]),

  // One ply per model turn. stateBefore + stateAfter are both persisted so
  // replay stays stable without re-running inference or re-applying moves.
  arenaPlies: defineTable({
    matchId: v.string(),
    plyIndex: v.number(),
    side: engineColor,
    profileId: v.string(),
    movePdn: v.string(),
    legalMoves: v.optional(v.array(v.string())),
    stateBefore: engineState,
    stateAfter: engineState,
    latencyMs: v.number(),
    providerRequestId: v.optional(v.string()),
    rawOutput: v.optional(v.string()),
    usage: v.optional(
      v.object({
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
      }),
    ),
    createdAt: v.number(),
  }).index("by_match_ply", ["matchId", "plyIndex"]),
});
