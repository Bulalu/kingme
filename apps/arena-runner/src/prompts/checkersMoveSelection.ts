import type { MovePayload, StatePayload } from "@kingme/shared/engine";
import {
  ARENA_PROMPT_VERSION,
  type ArenaPromptInput,
} from "@kingme/shared/arena-prompt";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// JSON Schema for provider-side structured output. Keep in sync with
// ArenaModelOutput in @kingme/shared/arena-prompt.
export const arenaMoveOutputJsonSchema = {
  name: "arena_move",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["move_pdn"],
    properties: {
      move_pdn: {
        type: "string",
        description: "Exactly one value from the supplied legal_moves list.",
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are a competitive Tanzanian-style 8x8 checkers player.

Rules reminder:
- Red moves first; red pieces (r/R) sit at the top of \`rows\` and move down.
- White pieces (w/W) sit at the bottom and move up.
- Uppercase letters are kings; they can fly multiple squares diagonally.
- Captures are mandatory. Multi-jump sequences must be completed fully.
- When a forced_square is set, only the piece on that square may continue.

You pick exactly one move from the provided legal_moves list.
Return ONLY a JSON object of the form {"move_pdn": "<pdn from the list>"} — no prose, no markdown, no explanation.
The value MUST be copied verbatim from one of the legal_moves entries.`;

function formatState(state: StatePayload): string {
  return [
    "Board (row 0 = top, file 0 = left):",
    ...state.rows.map((row, i) => `  ${i} ${row}`),
    `side_to_move: ${state.side_to_move}`,
    `forced_square: ${state.forced_square ?? "none"}`,
    `pending_captures: ${
      state.pending_captures.length ? state.pending_captures.join(",") : "none"
    }`,
    `no_progress_count: ${state.no_progress_count}`,
  ].join("\n");
}

function formatLegalMoves(moves: MovePayload[]): string {
  return moves
    .map((m, i) => {
      const tags: string[] = [];
      if (m.is_capture) tags.push(`cap=${m.capture_count}`);
      if (m.promotes) tags.push("promotes");
      const tagStr = tags.length ? ` (${tags.join(", ")})` : "";
      return `  ${i + 1}. ${m.pdn}${tagStr}`;
    })
    .join("\n");
}

// Deterministic ordering so prompt framing doesn't leak engine move ordering.
export function sortLegalMoves(moves: MovePayload[]): MovePayload[] {
  return [...moves].sort((a, b) => a.pdn.localeCompare(b.pdn));
}

export function buildChatMessages(input: ArenaPromptInput): ChatMessage[] {
  const sorted = sortLegalMoves(input.legalMoves);
  const historyBlock =
    input.moveHistory.length === 0
      ? "(none)"
      : input.moveHistory.slice(-20).join(", ");

  const user = [
    `prompt_version: ${ARENA_PROMPT_VERSION}`,
    `you_are_playing: ${input.sideToMove}`,
    "",
    formatState(input.state),
    "",
    `recent_moves: ${historyBlock}`,
    "",
    `legal_moves (${sorted.length}):`,
    formatLegalMoves(sorted),
    "",
    'Respond with exactly {"move_pdn": "<one of the legal_moves pdn values>"}.',
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
