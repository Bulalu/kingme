// Minimal legal-move engine — standard American checkers, 8x8, mandatory captures.
// Used by the in-hero demo board AND the /arena play view.
//
// IMPORTANT: this is a self-contained landing-page bot, NOT the live `sinza`
// engine. The real engine lives at apps/engine-api and will eventually back
// the arena via the documented API contract (see docs/API.md).

export const EMPTY = 0;
export const RED = 1;
export const RED_K = 2;
export const BLACK = 3;
export const BLACK_K = 4;

export type Piece = 0 | 1 | 2 | 3 | 4;
export type BoardState = Piece[][];
export type Side = "red" | "black";
export type Coord = [number, number];

export interface Move {
  from: Coord;
  path: Coord[];
  captured: Coord[];
  promoted: boolean;
}

export function startBoard(): BoardState {
  const b: BoardState = Array.from({ length: 8 }, () =>
    Array(8).fill(EMPTY) as Piece[],
  );
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = BLACK;
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = RED;
  return b;
}

export const isRed = (p: Piece) => p === RED || p === RED_K;
export const isBlack = (p: Piece) => p === BLACK || p === BLACK_K;
export const isKing = (p: Piece) => p === RED_K || p === BLACK_K;
export const opp = (side: Side): Side => (side === "red" ? "black" : "red");
export const sideOf = (p: Piece): Side | null =>
  isRed(p) ? "red" : isBlack(p) ? "black" : null;

function dirs(p: Piece): Array<[number, number]> {
  if (p === RED) return [[-1, -1], [-1, 1]];
  if (p === BLACK) return [[1, -1], [1, 1]];
  if (p === RED_K || p === BLACK_K)
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return [];
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(b: BoardState): BoardState {
  return b.map((row) => row.slice() as Piece[]);
}

export function legalMoves(board: BoardState, side: Side): Move[] {
  const jumps: Move[] = [];
  const simples: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (sideOf(p) !== side) continue;
      const jumpSeqs = findJumps(board, r, c, p, [], []);
      if (jumpSeqs.length) {
        for (const s of jumpSeqs) jumps.push({ from: [r, c], ...s });
      }
      for (const [dr, dc] of dirs(p)) {
        const nr = r + dr,
          nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] === EMPTY) {
          const promoted =
            (p === RED && nr === 0) || (p === BLACK && nr === 7);
          simples.push({
            from: [r, c],
            path: [[nr, nc]],
            captured: [],
            promoted,
          });
        }
      }
    }
  }
  return jumps.length ? jumps : simples;
}

function findJumps(
  board: BoardState,
  r: number,
  c: number,
  piece: Piece,
  path: Coord[],
  captured: Coord[],
): Array<Omit<Move, "from">> {
  const results: Array<Omit<Move, "from">> = [];
  for (const [dr, dc] of dirs(piece)) {
    const mr = r + dr,
      mc = c + dc;
    const lr = r + 2 * dr,
      lc = c + 2 * dc;
    if (!inBounds(lr, lc)) continue;
    if (board[lr][lc] !== EMPTY) continue;
    const mid = board[mr][mc];
    if (!mid || sideOf(mid) === sideOf(piece)) continue;
    if (captured.some(([cr, cc]) => cr === mr && cc === mc)) continue;

    const b2 = cloneBoard(board);
    b2[r][c] = EMPTY;
    b2[mr][mc] = EMPTY;
    let newPiece: Piece = piece;
    let promoted = false;
    if (piece === RED && lr === 0) {
      newPiece = RED_K;
      promoted = true;
    }
    if (piece === BLACK && lr === 7) {
      newPiece = BLACK_K;
      promoted = true;
    }
    b2[lr][lc] = newPiece;

    const newPath: Coord[] = [...path, [lr, lc]];
    const newCap: Coord[] = [...captured, [mr, mc]];

    let extended: Array<Omit<Move, "from">> = [];
    if (!promoted) {
      extended = findJumps(b2, lr, lc, newPiece, newPath, newCap);
    }
    if (extended.length) {
      for (const e of extended) results.push(e);
    } else {
      results.push({ path: newPath, captured: newCap, promoted });
    }
  }
  return results;
}

export function applyMove(board: BoardState, move: Move): BoardState {
  const b = cloneBoard(board);
  const [fr, fc] = move.from;
  const piece = b[fr][fc];
  b[fr][fc] = EMPTY;
  for (const [cr, cc] of move.captured) b[cr][cc] = EMPTY;
  const [er, ec] = move.path[move.path.length - 1];
  let newPiece: Piece = piece;
  if (piece === RED && er === 0) newPiece = RED_K;
  if (piece === BLACK && er === 7) newPiece = BLACK_K;
  b[er][ec] = newPiece;
  return b;
}

function evaluate(board: BoardState, side: Side): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const v = isKing(p) ? 3 : 1;
      const advance = isBlack(p) ? r : 7 - r;
      const val = v + advance * 0.05;
      if (sideOf(p) === side) score += val;
      else score -= val;
    }
  }
  return score;
}

export function pickAIMove(
  board: BoardState,
  side: Side,
  difficulty: "easy" | "normal" | "hard" = "normal",
): Move | null {
  const moves = legalMoves(board, side);
  if (!moves.length) return null;
  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  const scored = moves.map((m) => {
    const b2 = applyMove(board, m);
    const capScore = m.captured.length * 4;
    const promoScore = m.promoted ? 2 : 0;
    return { m, s: evaluate(b2, side) + capScore + promoScore };
  });
  scored.sort((a, b) => b.s - a.s);
  if (difficulty === "hard") return scored[0].m;
  const top = scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.3)));
  return top[Math.floor(Math.random() * top.length)].m;
}

export function winner(board: BoardState): Side | "draw" | null {
  const rMoves = legalMoves(board, "red").length;
  const bMoves = legalMoves(board, "black").length;
  if (!rMoves && !bMoves) return "draw";
  if (!rMoves) return "black";
  if (!bMoves) return "red";
  return null;
}
