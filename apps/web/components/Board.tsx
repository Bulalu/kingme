"use client";

// Checkers engine + board renderer
// Minimal legal-move engine (standard American checkers, 8x8, mandatory captures)
// EMPTY=0, RED=1, RED_KING=2, BLACK=3, BLACK_KING=4
// "Red" = human (bottom, moves up), "Black" = AI (top, moves down)
//
// Ported from the design package (checkers.jsx). This is a self-contained
// landing-page demo bot — NOT the live `sinza` engine. The real engine lives
// at apps/engine-api and is the authoritative source for legal moves.

import { useCallback, useEffect, useState } from "react";

const EMPTY = 0,
  RED = 1,
  RED_K = 2,
  BLACK = 3,
  BLACK_K = 4;

type Piece = 0 | 1 | 2 | 3 | 4;
type BoardState = Piece[][];
type Side = "red" | "black";
type Coord = [number, number];

interface Move {
  from: Coord;
  path: Coord[];
  captured: Coord[];
  promoted: boolean;
}

function startBoard(): BoardState {
  const b: BoardState = Array.from({ length: 8 }, () =>
    Array(8).fill(EMPTY) as Piece[],
  );
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = BLACK;
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = RED;
  return b;
}

const isRed = (p: Piece) => p === RED || p === RED_K;
const isBlack = (p: Piece) => p === BLACK || p === BLACK_K;
const isKing = (p: Piece) => p === RED_K || p === BLACK_K;
const opp = (side: Side): Side => (side === "red" ? "black" : "red");
const sideOf = (p: Piece): Side | null =>
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

function legalMoves(board: BoardState, side: Side): Move[] {
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

function applyMove(board: BoardState, move: Move): BoardState {
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

function pickAIMove(
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

function winner(board: BoardState): Side | "draw" | null {
  const rMoves = legalMoves(board, "red").length;
  const bMoves = legalMoves(board, "black").length;
  if (!rMoves && !bMoves) return "draw";
  if (!rMoves) return "black";
  if (!bMoves) return "red";
  return null;
}

interface BoardProps {
  mode?: "demo" | "play";
  size?: number;
  accent?: string;
  demoSpeedMs?: number;
}

export default function Board({
  mode = "demo",
  size = 480,
  accent = "#ff4b2b",
  demoSpeedMs = 900,
}: BoardProps) {
  const [board, setBoard] = useState<BoardState>(startBoard);
  const [turn, setTurn] = useState<Side>("red");
  const [selected, setSelected] = useState<Coord | null>(null);
  const [legalFrom, setLegalFrom] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Coord; to: Coord } | null>(
    null,
  );
  const [status, setStatus] = useState<Side | "draw" | null>(null);

  // Render-derived: AI is "thinking" between the human move and its reply timeout firing.
  const thinking = mode === "play" && turn === "black" && !status;

  // demo mode: both sides auto-play, restart on end
  useEffect(() => {
    if (mode !== "demo") return;
    if (status) {
      const t = setTimeout(() => {
        setBoard(startBoard());
        setTurn("red");
        setStatus(null);
        setLastMove(null);
      }, 1800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      const mv = pickAIMove(board, turn, "normal");
      if (!mv) {
        setStatus(winner(board) || opp(turn));
        return;
      }
      const nb = applyMove(board, mv);
      setBoard(nb);
      setLastMove({ from: mv.from, to: mv.path[mv.path.length - 1] });
      const w = winner(nb);
      if (w) setStatus(w);
      else setTurn(opp(turn));
    }, demoSpeedMs);
    return () => clearTimeout(t);
  }, [mode, board, turn, status, demoSpeedMs]);

  // play mode: AI responds after human move
  useEffect(() => {
    if (mode !== "play") return;
    if (status) return;
    if (turn !== "black") return;
    const t = setTimeout(
      () => {
        const mv = pickAIMove(board, "black", "normal");
        if (!mv) {
          setStatus(winner(board) || "red");
          return;
        }
        const nb = applyMove(board, mv);
        setBoard(nb);
        setLastMove({ from: mv.from, to: mv.path[mv.path.length - 1] });
        const w = winner(nb);
        if (w) setStatus(w);
        else setTurn("red");
      },
      650 + Math.random() * 500,
    );
    return () => clearTimeout(t);
  }, [mode, board, turn, status]);

  const reset = useCallback(() => {
    setBoard(startBoard());
    setTurn("red");
    setSelected(null);
    setLegalFrom([]);
    setLastMove(null);
    setStatus(null);
  }, []);

  function handleCellClick(r: number, c: number) {
    if (mode !== "play") return;
    if (status || turn !== "red") return;

    const all = legalMoves(board, "red");
    const piece = board[r][c];

    if (piece && sideOf(piece) === "red") {
      const mine = all.filter((m) => m.from[0] === r && m.from[1] === c);
      if (mine.length) {
        setSelected([r, c]);
        setLegalFrom(mine);
        return;
      }
    }
    if (selected) {
      const mv = legalFrom.find((m) => {
        const [er, ec] = m.path[m.path.length - 1];
        return er === r && ec === c;
      });
      if (mv) {
        const nb = applyMove(board, mv);
        setBoard(nb);
        setLastMove({ from: mv.from, to: mv.path[mv.path.length - 1] });
        setSelected(null);
        setLegalFrom([]);
        const w = winner(nb);
        if (w) setStatus(w);
        else setTurn("black");
        return;
      }
    }
    setSelected(null);
    setLegalFrom([]);
  }

  const targets = new Set(
    legalFrom.map((m) => {
      const [er, ec] = m.path[m.path.length - 1];
      return `${er},${ec}`;
    }),
  );

  const redCount = board.flat().filter(isRed).length;
  const blackCount = board.flat().filter(isBlack).length;

  return (
    <div
      className="km-board-wrap"
      style={
        {
          "--km-board-max": `${size}px`,
        } as React.CSSProperties
      }
    >
      <div
        className="km-board"
        style={{ "--accent": accent } as React.CSSProperties}
      >
        {board.map((row, r) =>
          row.map((p, c) => {
            const dark = (r + c) % 2 === 1;
            const isSel =
              selected && selected[0] === r && selected[1] === c;
            const isTarget = targets.has(`${r},${c}`);
            const isLast =
              lastMove &&
              ((lastMove.from[0] === r && lastMove.from[1] === c) ||
                (lastMove.to[0] === r && lastMove.to[1] === c));
            return (
              <div
                key={`${r}-${c}`}
                className={
                  "km-cell" +
                  (dark ? " km-dark" : " km-light") +
                  (isSel ? " km-sel" : "") +
                  (isTarget ? " km-target" : "") +
                  (isLast ? " km-last" : "")
                }
                onClick={() => handleCellClick(r, c)}
              >
                {p !== EMPTY && (
                  <div
                    className={
                      "km-piece " +
                      (isRed(p) ? "km-red" : "km-black") +
                      (isKing(p) ? " km-king" : "")
                    }
                  >
                    {isKing(p) && <span className="km-crown">♔</span>}
                  </div>
                )}
                {isTarget && <div className="km-dot" />}
              </div>
            );
          }),
        )}
      </div>
      {mode === "play" && (
        <div className="km-board-hud">
          <div className="km-hud-left">
            <span className="km-hud-dot km-hud-you" /> you
            <span className="km-hud-count">{redCount}</span>
          </div>
          <div className="km-hud-mid">
            {status
              ? status === "red"
                ? "you win. somehow."
                : status === "black"
                  ? "the machine wins."
                  : "draw."
              : thinking
                ? "thinking…"
                : turn === "red"
                  ? "your move"
                  : "ai move"}
          </div>
          <div className="km-hud-right">
            <span className="km-hud-count">{blackCount}</span>
            ai <span className="km-hud-dot km-hud-ai" />
          </div>
          <button className="km-reset" onClick={reset}>
            reset
          </button>
        </div>
      )}
    </div>
  );
}
