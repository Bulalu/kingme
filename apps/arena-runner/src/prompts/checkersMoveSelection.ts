import type { MovePayload, StatePayload } from "@kingme/shared/engine";
import {
  ARENA_MAX_SAY_CHARS,
  ARENA_PROMPT_VERSION,
  type ArenaMoveHistoryEntry,
  type ArenaPromptInput,
} from "@kingme/shared/arena-prompt";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// JSON Schema for provider-side structured output. Keep in sync with
// ArenaModelOutput in @kingme/shared/arena-prompt.
//
// `say` is nullable so a model can opt into silence by passing null.
// OpenRouter / OpenAI strict-mode structured output requires every
// declared property to appear in `required`, so "optional" is
// expressed as `string | null` with null meaning "I've got nothing
// to say this turn".
export const arenaMoveOutputJsonSchema = {
  name: "arena_move",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["move_pdn", "say"],
    properties: {
      move_pdn: {
        type: "string",
        description: "Exactly one value from the supplied legal_moves list.",
      },
      say: {
        type: ["string", "null"],
        maxLength: ARENA_MAX_SAY_CHARS,
        description:
          "Optional short in-character banter about your move or the position. null if you've got nothing worth saying.",
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are playing Tanzanian-style 8x8 checkers in a head-to-head competition against another AI. Your goal is to win. Another model wants your crown — don't let it have it.

Rules:
- Red moves first. Red pieces (r/R) sit at the top of \`rows\` and move down. White pieces (w/W) sit at the bottom and move up.
- Uppercase letters are kings; they fly any diagonal distance.
- Captures are mandatory. Multi-jump sequences must be completed fully.
- When a forced_square is set, only the piece on that square may continue.

Output: pick exactly one move from the provided legal_moves list. Return ONLY a JSON object of the form {"move_pdn": "<value>", "say": <string or null>} — no prose, no markdown. The move_pdn value must be copied verbatim from the list.

About \`say\`: along with your move, you MAY include a short (max ${ARENA_MAX_SAY_CHARS} chars) in-character line — taunt, trash-talk, praise, regret, whatever fits the moment, in the voice of a streetwise checkers player. If there is nothing worth saying, pass "say": null and just play. Don't force it. No disclaimers. No "I'll do my best." No rules lectures.`;

// ── Board helpers (dark-square 0-31 index <-> 8x8 grid) ────────
// Row 0 dark squares are at cols 1,3,5,7 (idx 0..3).
// Row 1 dark squares are at cols 0,2,4,6 (idx 4..7).

function squareToCoord(idx: number): [number, number] {
  const r = Math.floor(idx / 4);
  const file = idx % 4;
  const c = r % 2 === 0 ? 1 + 2 * file : 2 * file;
  return [r, c];
}

function coordToSquare(r: number, c: number): number {
  const file = r % 2 === 0 ? (c - 1) / 2 : c / 2;
  return r * 4 + file;
}

function pieceAt(state: StatePayload, sq: number): string {
  const [r, c] = squareToCoord(sq);
  const row = state.rows[r] ?? "";
  return row[c] ?? ".";
}

function describePiece(ch: string): string | null {
  if (ch === "r") return "red man";
  if (ch === "R") return "red king";
  if (ch === "w") return "white man";
  if (ch === "W") return "white king";
  return null;
}

// Squares captured along a multi-jump path. For man captures the
// captured piece sits on the midpoint (row delta 2), but Tanzanian
// flying kings can capture across longer diagonals — so for each
// segment we walk the diagonal from `from` to `to` and find the
// single occupied square between them (Tanzanian rules allow at most
// one capture per segment). Used only for annotation — the engine
// remains authoritative for what the capture actually does.
function capturedSquares(path: number[], state: StatePayload): number[] {
  const caught: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ar, ac] = squareToCoord(path[i]);
    const [br, bc] = squareToCoord(path[i + 1]);
    const dr = Math.sign(br - ar);
    const dc = Math.sign(bc - ac);
    if (dr === 0 || dc === 0) continue;
    let r = ar + dr;
    let c = ac + dc;
    while (r !== br || c !== bc) {
      const ch = state.rows[r]?.[c];
      if (ch && ch !== ".") {
        caught.push(coordToSquare(r, c));
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return caught;
}

function countPieces(rows: string[]): {
  redMen: number;
  redKings: number;
  whiteMen: number;
  whiteKings: number;
} {
  let redMen = 0;
  let redKings = 0;
  let whiteMen = 0;
  let whiteKings = 0;
  for (const row of rows) {
    for (const ch of row) {
      if (ch === "r") redMen++;
      else if (ch === "R") redKings++;
      else if (ch === "w") whiteMen++;
      else if (ch === "W") whiteKings++;
    }
  }
  return { redMen, redKings, whiteMen, whiteKings };
}

function materialSummary(rows: string[]): string {
  const { redMen, redKings, whiteMen, whiteKings } = countPieces(rows);
  const red = `${redMen + redKings} (${redMen} men, ${redKings} kings)`;
  const white = `${whiteMen + whiteKings} (${whiteMen} men, ${whiteKings} kings)`;
  return `material: red ${red} | white ${white}`;
}

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
    materialSummary(state.rows),
  ].join("\n");
}

function annotateMove(move: MovePayload, state: StatePayload): string {
  const mover = describePiece(pieceAt(state, move.path[0])) ?? "piece";
  const pathStr = move.path.join(" → ");
  if (!move.is_capture) {
    const base = `${mover} advances ${pathStr}`;
    return move.promotes ? `${base} (promotes to king)` : base;
  }
  const caught = capturedSquares(move.path, state)
    .map((sq) => {
      const piece = describePiece(pieceAt(state, sq));
      return piece ? `${piece} at ${sq}` : `square ${sq}`;
    })
    .join(", ");
  const verb = move.capture_count > 1 ? "multi-capture" : "captures";
  const base = `${mover} ${verb} ${pathStr} (takes ${caught})`;
  return move.promotes ? `${base} (promotes to king)` : base;
}

function formatLegalMoves(moves: MovePayload[], state: StatePayload): string {
  const width = String(moves.length).length;
  const padPdn = Math.max(...moves.map((m) => m.pdn.length));
  return moves
    .map((m, i) => {
      const num = String(i + 1).padStart(width, " ");
      const pdn = m.pdn.padEnd(padPdn, " ");
      return `  ${num}. ${pdn}  — ${annotateMove(m, state)}`;
    })
    .join("\n");
}

// Deterministic ordering so prompt framing doesn't leak engine move ordering.
export function sortLegalMoves(moves: MovePayload[]): MovePayload[] {
  return [...moves].sort((a, b) => a.pdn.localeCompare(b.pdn));
}

function formatMoveHistory(entries: ArenaMoveHistoryEntry[]): string {
  if (entries.length === 0) return "  (none yet)";
  const recent = entries.slice(-20);
  const sideWidth = 5; // "white"
  const pdnWidth = Math.max(...recent.map((e) => e.movePdn.length));
  return recent
    .map((e) => {
      const side = e.side.padEnd(sideWidth, " ");
      const pdn = e.movePdn.padEnd(pdnWidth, " ");
      const quote = e.say ? `   "${e.say}"` : "";
      return `  ${side} — ${pdn}${quote}`;
    })
    .join("\n");
}

export function buildChatMessages(input: ArenaPromptInput): ChatMessage[] {
  const sorted = sortLegalMoves(input.legalMoves);

  const user = [
    `prompt_version: ${ARENA_PROMPT_VERSION}`,
    `you_are_playing: ${input.sideToMove}`,
    "",
    formatState(input.state),
    "",
    `recent_moves (last ${Math.min(input.moveHistory.length, 20)}):`,
    formatMoveHistory(input.moveHistory),
    "",
    `legal_moves (${sorted.length}):`,
    formatLegalMoves(sorted, input.state),
    "",
    'Respond with exactly {"move_pdn": "<one of the legal_moves pdn values>", "say": <string or null>}.',
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
