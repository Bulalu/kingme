import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  arenaGameKey,
  arenaMatchStatus,
  arenaParticipant,
  arenaTerminationReason,
  arenaVariantKey,
  arenaVisibility,
  arenaWinner,
  engineColor,
  engineState,
} from "./arenaValidators";

// Records of who's playing on kingme.dev and what they've played against the
// public agents. There's no real auth — `anonId` is a UUID stored in the
// player's localStorage, so the same browser always maps to the same player
// row. Clearing storage = a fresh player.
//
// Counters on `players` and `agents` are denormalized from `games` so the
// landing page and arena top bar can read live stats with one cheap row
// fetch instead of scanning the games table on every render.

// LLM arena tables persist manual model-vs-model matches per the
// llm-arena-roadmap; they are NOT wired to any public surface — only
// the runner and (later) admin-only views read/write them. Validators
// live in ./arenaValidators so function files can import them too.

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
    visibility: arenaVisibility,
    // Optional path to commissioned poster art for this matchup,
    // relative to apps/web/public (e.g. "/arena/cards/foo.png"). When
    // set, the undercard renders the poster as the card background;
    // otherwise the card falls back to an auto-generated layout.
    cardUrl: v.optional(v.string()),
    // Optional series membership. When set, the undercard groups
    // matches sharing the same series.id into a single scorecard
    // block with numbered game cards underneath, rather than
    // rendering each match as an independent card. gameIndex is the
    // 1-based ordinal within the series; bestOf lets the UI render a
    // "best of N" banner + decide when a series winner is determined;
    // name is an optional human label ("Round 1", "Rematch", etc.).
    series: v.optional(
      v.object({
        id: v.string(),
        gameIndex: v.number(),
        bestOf: v.optional(v.number()),
        name: v.optional(v.string()),
      }),
    ),
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
    // Optional in-character banter emitted by the model for this ply.
    // null means the model explicitly chose silence; undefined covers
    // legacy rows from before the v2 prompt was introduced.
    say: v.optional(v.union(v.string(), v.null())),
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
