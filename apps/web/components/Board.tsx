"use client";

// Hero board renderer — uses the shared landing-page checkers engine.

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY,
  applyMove,
  isBlack,
  isKing,
  isRed,
  legalMoves,
  opp,
  pickAIMove,
  sideOf,
  startBoard,
  winner,
  type BoardState,
  type Coord,
  type Move,
  type Side,
} from "@/lib/checkers";

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
