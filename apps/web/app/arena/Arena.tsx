"use client";

// Arena (play) view — clean 2D. Ported from the design package (arena.jsx),
// minus the AgentSelect screen: this view always opens straight into a game
// against sinza. When the live engine is wired up, swap pickAIMove for the
// engine API call.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyMove,
  isBlack,
  isKing,
  isRed,
  legalMoves,
  pickAIMove,
  startBoard,
  winner as winnerOf,
  type BoardState,
  type Coord,
  type Move,
  type Side,
} from "@/lib/checkers";

interface Agent {
  id: string;
  name: string;
  tagline: string;
  venue: string;
  img: string;
}

const AGENTS: Record<string, Agent> = {
  sinza: {
    id: "sinza",
    name: "SINZA",
    tagline: "the showman",
    venue: "SINZA SOCIAL HALL",
    img: "/assets/sinza.png",
  },
  manzese: {
    id: "manzese",
    name: "MZE MANZESE",
    tagline: "the old man",
    venue: "MANZESE BACK OFFICE",
    img: "/assets/manzese.png",
  },
};

interface BoardStyle {
  label: string;
  light: string;
  dark: string;
  frame: string;
  frame2: string;
  pieceDark: string;
}

const BOARD_STYLES: Record<string, BoardStyle> = {
  emerald: {
    label: "emerald felt",
    light: "#ead9b0",
    dark: "#3a5a3a",
    frame: "#1a120a",
    frame2: "#3a2414",
    pieceDark: "ink",
  },
};

interface MoveLog {
  side: Side;
  from: Coord;
  to: Coord;
  captured: number;
  promoted: boolean;
}

interface ComboState {
  count: number;
  side: Side;
  key: number;
}

interface PlayerCardProps {
  agent?: Agent;
  name: string;
  tagline: string;
  captured: number;
  active: boolean;
  time: string;
  side: Side;
  isOpponent?: boolean;
}

function PlayerCard({
  agent,
  name,
  tagline,
  captured,
  active,
  time,
  side,
  isOpponent,
}: PlayerCardProps) {
  return (
    <div
      className={
        "ar-pc " +
        (active ? "ar-pc-active " : "") +
        (isOpponent ? "ar-pc-opp" : "ar-pc-you")
      }
    >
      {agent ? (
        <div className="ar-pc-avatar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agent.img} alt={name} />
        </div>
      ) : (
        <div className="ar-pc-avatar ar-pc-avatar-you">
          <span>YOU</span>
        </div>
      )}
      <div className="ar-pc-info">
        <div className="ar-pc-tag">{tagline}</div>
        <div className="ar-pc-name">{name}</div>
        <div className="ar-pc-captured">
          <span className="ar-pc-cap-label">captured</span>
          <div className="ar-pc-caps">
            {captured === 0 ? (
              <span className="ar-pc-cap-empty">—</span>
            ) : (
              Array.from({ length: captured }).map((_, i) => (
                <span
                  key={i}
                  className={
                    "ar-pc-cap ar-pc-cap-" +
                    (side === "red" ? "red" : "black")
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>
      <div className="ar-pc-clock">
        <div className="ar-pc-clock-label">{active ? "thinking" : "idle"}</div>
        <div className="ar-pc-clock-time">{time}</div>
      </div>
    </div>
  );
}

function fmtClock(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

interface PostGameProps {
  status: Side | "draw";
  agent: Agent;
  moves: number;
  onExit: () => void;
  onRematch: () => void;
}

function PostGame({ status, agent, moves, onExit, onRematch }: PostGameProps) {
  const lost = status === "black";
  const won = status === "red";

  // Intentional non-determinism for the falling-emoji effect. Computed once
  // per mount via a lazy useState initializer so re-renders don't reshuffle.
  const [laughs] = useState(() => {
    if (!lost) return [] as Array<{
      id: number;
      left: number;
      delay: number;
      dur: number;
      size: number;
      sway: number;
      rot: number;
    }>;
    return Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2.2,
      dur: 2.8 + Math.random() * 2.2,
      size: 28 + Math.random() * 42,
      sway: (Math.random() - 0.5) * 120,
      rot: (Math.random() - 0.5) * 60,
    }));
  });

  return (
    <div className="ar-post">
      <div className="ar-post-backdrop" />
      {lost && (
        <div className="ar-laugh-rain" aria-hidden="true">
          {laughs.map((l) => (
            <span
              key={l.id}
              className="ar-laugh"
              style={
                {
                  left: l.left + "%",
                  animationDelay: l.delay + "s",
                  animationDuration: l.dur + "s",
                  fontSize: l.size + "px",
                  "--sway": l.sway + "px",
                  "--rot": l.rot + "deg",
                } as React.CSSProperties
              }
            >
              😂
            </span>
          ))}
        </div>
      )}
      <div className="ar-post-card">
        <div className="ar-post-stamp">{lost ? "L" : won ? "W" : "D"}</div>
        <div className="ar-post-kicker">
          {lost ? "verdict" : won ? "upset" : "draw"} · {moves} moves
        </div>
        <h2 className="ar-post-h">
          {lost ? (
            <>
              you lost
              <br />
              to <span className="ar-accent">{agent.name}</span>.
            </>
          ) : won ? (
            <>
              you beat
              <br />
              <span className="ar-accent">{agent.name}</span>.
            </>
          ) : (
            <>
              neither of you
              <br />
              won.
            </>
          )}
        </h2>
        <div className="ar-post-ctas">
          <button className="ar-btn ar-btn-primary">
            share your {lost ? "loss" : won ? "win" : "draw"}
          </button>
          <button className="ar-btn ar-btn-ghost" onClick={onRematch}>
            rematch
          </button>
          <button className="ar-btn ar-btn-ghost" onClick={onExit}>
            leave
          </button>
        </div>
        <div className="ar-post-foot">
          kingme.dev · {agent.venue.toLowerCase()}
        </div>
      </div>
    </div>
  );
}

export default function Arena({
  agentId = "sinza",
  boardStyle = "emerald",
}: {
  agentId?: string;
  boardStyle?: string;
}) {
  const router = useRouter();
  const agent = AGENTS[agentId] || AGENTS.sinza;
  const bs = BOARD_STYLES[boardStyle] || BOARD_STYLES.emerald;

  // gameKey lets us reset all in-game state by remounting via key prop.
  const [gameKey, setGameKey] = useState(0);
  const onExit = () => router.push("/");
  const onRematch = () => setGameKey((k) => k + 1);

  return (
    <ArenaGame
      key={gameKey}
      agent={agent}
      boardStyle={boardStyle}
      bs={bs}
      onExit={onExit}
      onRematch={onRematch}
    />
  );
}

function ArenaGame({
  agent,
  boardStyle,
  bs,
  onExit,
  onRematch,
}: {
  agent: Agent;
  boardStyle: string;
  bs: BoardStyle;
  onExit: () => void;
  onRematch: () => void;
}) {
  const [board, setBoard] = useState<BoardState>(startBoard);
  const [turn, setTurn] = useState<Side>("red");
  const [selected, setSelected] = useState<Coord | null>(null);
  const [legalFrom, setLegalFrom] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Coord; to: Coord } | null>(
    null,
  );
  const [status, setStatus] = useState<Side | "draw" | null>(null);
  const [history, setHistory] = useState<MoveLog[]>([]);
  const [yourClock, setYourClock] = useState(300);
  const [theirClock, setTheirClock] = useState(300);
  const [combo, setCombo] = useState<ComboState | null>(null);
  const comboKey = useRef(0);

  // Derived: AI is "thinking" between human's move and its reply firing.
  const thinking = turn === "black" && !status;

  // clocks
  useEffect(() => {
    if (status) return;
    const id = setInterval(() => {
      if (turn === "red") setYourClock((s) => Math.max(0, s - 1));
      else setTheirClock((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [turn, status]);

  // AI turn
  useEffect(() => {
    if (status || turn !== "black") return;
    const delay = 700 + Math.random() * 900;
    const t = setTimeout(() => {
      const mv = pickAIMove(board, "black", "normal");
      if (!mv) {
        setStatus("red");
        return;
      }
      const nb = applyMove(board, mv);
      const to = mv.path[mv.path.length - 1];
      setBoard(nb);
      setLastMove({ from: mv.from, to });
      setHistory((h) => [
        ...h,
        {
          side: "black",
          from: mv.from,
          to,
          captured: mv.captured.length,
          promoted: mv.promoted,
        },
      ]);
      if (mv.captured.length >= 2) {
        setCombo({ count: mv.captured.length, side: "black", key: ++comboKey.current });
      }
      const w = winnerOf(nb);
      if (w) setStatus(w);
      else setTurn("red");
    }, delay);
    return () => clearTimeout(t);
  }, [board, turn, status]);

  // auto-clear combo banner
  useEffect(() => {
    if (!combo) return;
    const t = setTimeout(() => setCombo(null), 1400);
    return () => clearTimeout(t);
  }, [combo]);

  function onCell(r: number, c: number) {
    if (status || turn !== "red") return;
    const all = legalMoves(board, "red");
    const piece = board[r][c];
    if (piece && (piece === 1 || piece === 2)) {
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
        const to = mv.path[mv.path.length - 1];
        setBoard(nb);
        setLastMove({ from: mv.from, to });
        setHistory((h) => [
          ...h,
          {
            side: "red",
            from: mv.from,
            to,
            captured: mv.captured.length,
            promoted: mv.promoted,
          },
        ]);
        if (mv.captured.length >= 2) {
          setCombo({
            count: mv.captured.length,
            side: "red",
            key: ++comboKey.current,
          });
        }
        setSelected(null);
        setLegalFrom([]);
        const w = winnerOf(nb);
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
  const yourCaptured = 12 - blackCount;
  const theirCaptured = 12 - redCount;

  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <div
      className={
        "ar-arena ar-board-" + boardStyle + " ar-piece-dark-" + bs.pieceDark
      }
      style={
        {
          "--ar-board-light": bs.light,
          "--ar-board-dark": bs.dark,
          "--ar-board-frame": bs.frame,
          "--ar-board-frame2": bs.frame2,
        } as React.CSSProperties
      }
    >
      {/* top bar */}
      <div className="ar-bar">
        <button className="ar-bar-exit" onClick={onExit}>
          ← leave
        </button>
        <div className="ar-bar-venue">
          <span className="ar-bar-venue-name">{agent.venue}</span>
          <span className="ar-bar-venue-sub">kingme.dev</span>
        </div>
        <div className="ar-bar-moves">
          <span className="ar-bar-moves-label">move</span>
          <span className="ar-bar-moves-count">
            {String(history.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* main layout */}
      <div className="ar-main">
        {/* left column — move log */}
        <aside className="ar-side ar-side-left">
          <div className="ar-side-h">MOVES</div>
          <div className="ar-log">
            {history.length === 0 && (
              <div className="ar-log-empty">no moves yet</div>
            )}
            {history.map((h, i) => (
              <div key={i} className={"ar-log-row ar-log-" + h.side}>
                <span className="ar-log-num">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="ar-log-side">
                  {h.side === "red"
                    ? "you"
                    : agent.name.split(" ")[0].toLowerCase()}
                </span>
                <span className="ar-log-move">
                  {files[h.from[1]]}
                  {ranks[h.from[0]]}→{files[h.to[1]]}
                  {ranks[h.to[0]]}
                  {h.captured > 0 && (
                    <span className="ar-log-x"> ×{h.captured}</span>
                  )}
                  {h.promoted && <span className="ar-log-k"> ♔</span>}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* center — opponent / board / you */}
        <div className="ar-center">
          <PlayerCard
            agent={agent}
            name={agent.name}
            tagline={agent.tagline}
            captured={yourCaptured}
            active={turn === "black" && !status}
            time={fmtClock(theirClock)}
            side="black"
            isOpponent
          />

          <div className="ar-board-wrap">
            {combo && (
              <div
                key={combo.key}
                className={"ar-combo ar-combo-" + combo.side}
              >
                <div className="ar-combo-emoji">
                  {combo.count === 2
                    ? "💀"
                    : combo.count === 3
                      ? "🔥"
                      : "👑"}
                </div>
                <div className="ar-combo-label">
                  <span className="ar-combo-x">×{combo.count}</span>
                  <span className="ar-combo-word">
                    {combo.count === 2
                      ? "double"
                      : combo.count === 3
                        ? "triple"
                        : combo.count === 4
                          ? "quadruple"
                          : "massacre"}
                  </span>
                </div>
              </div>
            )}
            <div className="ar-ranks">
              {ranks.map((r) => (
                <span key={r}>{r}</span>
              ))}
            </div>

            <div className="ar-board-outer">
              <div className="ar-board">
                {board.map((row, r) =>
                  row.map((pc, c) => {
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
                          "ar-cell " +
                          (dark ? "ar-dark" : "ar-light") +
                          (isSel ? " ar-sel" : "") +
                          (isTarget ? " ar-target" : "") +
                          (isLast ? " ar-last" : "")
                        }
                        onClick={() => onCell(r, c)}
                      >
                        {pc !== 0 && (
                          <div
                            className={
                              "ar-piece " +
                              (isRed(pc) ? "ar-red" : "ar-black") +
                              (isKing(pc) ? " ar-king" : "")
                            }
                          >
                            {isKing(pc) && <span className="ar-crown">♔</span>}
                          </div>
                        )}
                        {isTarget && <div className="ar-target-dot" />}
                      </div>
                    );
                  }),
                )}
              </div>

              <div className="ar-files">
                {files.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
            </div>
          </div>

          <PlayerCard
            name="YOU"
            tagline="the challenger"
            captured={theirCaptured}
            active={turn === "red" && !status}
            time={fmtClock(yourClock)}
            side="red"
          />
        </div>

        {/* right column — status / eval / actions */}
        <aside className="ar-side ar-side-right">
          <div className="ar-stat">
            <div className="ar-stat-label">status</div>
            <div className="ar-stat-val">
              {status ? (
                status === "black" ? (
                  "you lost"
                ) : status === "red" ? (
                  "you won??"
                ) : (
                  "draw"
                )
              ) : thinking ? (
                <span className="ar-blink">thinking…</span>
              ) : turn === "red" ? (
                "your move"
              ) : (
                "…"
              )}
            </div>
          </div>

          <div className="ar-eval">
            <div className="ar-eval-label">position</div>
            <div className="ar-eval-bar">
              <div
                className="ar-eval-fill"
                style={{
                  height: `${(redCount / (redCount + blackCount)) * 100}%`,
                }}
              />
            </div>
            <div className="ar-eval-nums">
              <span>{redCount}</span>
              <span className="ar-eval-sep">vs</span>
              <span>{blackCount}</span>
            </div>
          </div>

          <div className="ar-actions">
            <button className="ar-act" disabled>
              resign
            </button>
            <button className="ar-act" disabled>
              offer draw
            </button>
          </div>
        </aside>
      </div>

      {status && (
        <PostGame
          status={status}
          agent={agent}
          moves={history.length}
          onExit={onExit}
          onRematch={onRematch}
        />
      )}
    </div>
  );
}
