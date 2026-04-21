// Shared validators for the LLM arena tables. Mirrors
// packages/shared/src/arena.ts and packages/shared/src/engine.ts. Imported
// by schema.ts (for table definitions) and by individual function files
// (for argument validation). If the shared TS types or the Python engine
// schema change, update this file in the same PR.

import { v } from "convex/values";

export const engineColor = v.union(v.literal("red"), v.literal("white"));

export const engineState = v.object({
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

export const arenaParticipant = v.object({
  profileId: v.string(),
  displayName: v.string(),
  provider: v.literal("openrouter"),
  model: v.string(),
  promptVersion: v.string(),
  temperature: v.number(),
  maxOutputTokens: v.number(),
  timeoutMs: v.number(),
});

export const arenaMatchStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("aborted"),
);

export const arenaTerminationReason = v.union(
  v.literal("normal"),
  v.literal("max_plies"),
  v.literal("protocol_violation"),
  v.literal("provider_timeout"),
  v.literal("provider_error"),
  v.literal("runner_error"),
  v.literal("cancelled"),
);

export const arenaWinner = v.union(engineColor, v.literal("draw"), v.null());

export const arenaGameKey = v.literal("checkers");
export const arenaVariantKey = v.literal("tanzanian-8x8");

export const arenaVisibility = v.union(
  v.literal("private"),
  v.literal("public"),
);
