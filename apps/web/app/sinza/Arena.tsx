"use client";

// Arena (play) view — clean 2D, driven by the live engine API on Modal.
// Per CLAUDE.md, the engine API owns legality and state transitions; this
// component round-trips the full StatePayload exactly and only renders.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import NamePromptModal from "./NamePromptModal";
import { generateMemeName, getOrCreateAnonId } from "@/lib/identity";
import {
  isBlack,
  isKing,
  isRed,
  type BoardState,
  type Coord,
  type Side,
} from "@/lib/checkers";
import {
  agentMove,
  apiSideToUi,
  apiWinnerToUi,
  coordToSquare,
  findMoveByEndpoints,
  getInitialState,
  getLegalMoves,
  optimisticApplyMove,
  playTurnApi,
  rowsToBoard,
  squareToCoord,
  type ApplyMoveResponse,
  type AgentMoveResponse,
  type MovePayload,
  type PlayTurnResponse,
  type StatePayload,
} from "@/lib/engine";

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
    venue: "SINZA KIJIWENI",
    img: "/assets/sinza.webp",
  },
  masaki: {
    id: "masaki",
    name: "MASAKI",
    tagline: "the closer",
    venue: "MASAKI SOCIAL CLUB",
    img: "/assets/masaki.png",
  },
  tabata: {
    id: "tabata",
    name: "TABATA",
    tagline: "the landlord",
    venue: "TABATA SUPPER ROOM",
    img: "/assets/tabata.png",
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
          <Image src={agent.img} alt={name} fill sizes="56px" />
          {active && (
            <div
              className="ar-pc-thinking-bubble"
              role="status"
              aria-label={`${name} is thinking`}
            >
              <span className="ar-pc-thinking-emoji">🤔</span>
              <span className="ar-pc-thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          )}
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
  const lossEmoji =
    agent.id === "masaki" ? "😘" : agent.id === "tabata" ? "🍺" : "😂";

  // Intentional non-determinism for the falling-emoji effect. Computed once
  // per mount via a lazy useState initializer so re-renders don't reshuffle.
  const [drops] = useState(() => {
    if (!lost)
      return [] as Array<{
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
        <div className="ar-emoji-rain" aria-hidden="true">
          {drops.map((l) => (
            <span
              key={l.id}
              className="ar-emoji-drop"
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
              {lossEmoji}
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

  // ── Anonymous identity ────────────────────────────────────────
  // anonId is generated/read on first paint so the player record stays
  // stable across visits from this browser.
  const [anonId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getOrCreateAnonId(),
  );

  const upsertPlayer = useMutation(api.players.upsert);
  const setPlayerName = useMutation(api.players.setName);
  const startGame = useMutation(api.games.start);
  const completeGame = useMutation(api.games.complete);

  // Reactive read of the player row by anonId.
  const player = useQuery(
    api.players.getByAnonId,
    anonId ? { anonId } : "skip",
  );

  // Ensure the player row exists. Fires once when anonId is known and
  // there's no row yet.
  const upsertedRef = useRef(false);
  useEffect(() => {
    if (!anonId) return;
    if (player !== undefined) {
      // Query has resolved (null = no row yet, object = exists).
      if (player === null && !upsertedRef.current) {
        upsertedRef.current = true;
        upsertPlayer({ anonId }).catch(() => {
          upsertedRef.current = false;
        });
      }
    }
  }, [anonId, player, upsertPlayer]);

  const handleSubmitName = useCallback(
    (name: string) => {
      if (!anonId) return;
      setPlayerName({ anonId, name });
    },
    [anonId, setPlayerName],
  );
  const handleSkipName = useCallback(
    (memeName: string) => {
      if (!anonId) return;
      setPlayerName({ anonId, name: memeName });
    },
    [anonId, setPlayerName],
  );

  // ── Game record lifecycle ─────────────────────────────────────
  // gameKey forces a fresh ArenaGame on rematch so all in-game state resets.
  const [gameKey, setGameKey] = useState(0);
  const [gameId, setGameId] = useState<Id<"games"> | null>(null);
  const startingRef = useRef(false);

  // Open a games row once the player exists, has a name, and we don't
  // already have a current gameId (or we just bumped gameKey for rematch).
  useEffect(() => {
    if (!anonId) return;
    if (!player || !player.name) return;
    if (gameId !== null) return;
    if (startingRef.current) return;
    startingRef.current = true;
    startGame({
      anonId,
      agentId: agent.id,
      agentDisplayName: agent.name,
    })
      .then((id) => setGameId(id))
      .finally(() => {
        startingRef.current = false;
      });
  }, [anonId, player, gameId, gameKey, startGame, agent.id, agent.name]);

  // Plain navigation — no forfeit. Used when the game is already in a
  // terminal state (PostGame screen) where handleGameEnd has written or
  // is about to write the real winner. If we forfeited here too, an
  // in-flight human-win or draw could be overtaken by the agent-win and
  // the idempotency guard would preserve the wrong result.
  const onExit = useCallback(() => {
    router.push("/");
  }, [router]);

  // Mid-game exit from the top bar. Mark the game as an agent forfeit
  // before navigating.
  const onForfeitAndExit = useCallback(
    (movesPlayed: number) => {
      if (gameId && anonId) {
        completeGame({
          gameId,
          anonId,
          winner: "agent",
          moves: movesPlayed,
        }).catch(() => {
          // Idempotent on the server — swallow and navigate.
        });
      }
      router.push("/");
    },
    [gameId, anonId, completeGame, router],
  );
  const onRematch = () => {
    setGameId(null);
    setGameKey((k) => k + 1);
  };

  // Translate ArenaGame's UI-side winner into the persistence layer's
  // human-perspective enum and forward to the mutation. Called once per
  // game from inside ArenaGame when status flips.
  const handleGameEnd = useCallback(
    (status: Side | "draw", moves: number) => {
      if (!gameId || !anonId) return;
      const winner: "human" | "agent" | "draw" =
        status === "draw" ? "draw" : status === "red" ? "human" : "agent";
      completeGame({ gameId, anonId, winner, moves }).catch(() => {
        // Mutation is idempotent on the server side; swallowing here is
        // safe — the user already sees the post-game card.
      });
    },
    [gameId, anonId, completeGame],
  );

  // Show modal when player has loaded but hasn't picked a name yet.
  const needsName = player && !player.name;

  return (
    <>
      {needsName && (
        <NamePromptModal
          onSubmit={handleSubmitName}
          onSkip={handleSkipName}
          generateMemeName={generateMemeName}
        />
      )}
      <ArenaGame
        key={gameKey}
        agent={agent}
        boardStyle={boardStyle}
        bs={bs}
        onExit={onExit}
        onForfeitAndExit={onForfeitAndExit}
        onRematch={onRematch}
        onGameEnd={handleGameEnd}
      />
    </>
  );
}

function ArenaGame({
  agent,
  boardStyle,
  bs,
  onExit,
  onForfeitAndExit,
  onRematch,
  onGameEnd,
}: {
  agent: Agent;
  boardStyle: string;
  bs: BoardStyle;
  onExit: () => void;
  onForfeitAndExit: (moves: number) => void;
  onRematch: () => void;
  onGameEnd: (status: Side | "draw", moves: number) => void;
}) {
  // Engine-authoritative game state.
  const [apiState, setApiState] = useState<StatePayload | null>(null);
  const [legal, setLegal] = useState<MovePayload[]>([]);
  const [status, setStatus] = useState<Side | "draw" | null>(null);
  const [boot, setBoot] = useState<"loading" | "ready" | "error">("loading");
  const [bootError, setBootError] = useState<string | null>(null);

  // UI-only ephemeral state (not persisted, not engine-owned).
  const [selected, setSelected] = useState<Coord | null>(null);
  const [legalFrom, setLegalFrom] = useState<MovePayload[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Coord; to: Coord } | null>(
    null,
  );
  const [history, setHistory] = useState<MoveLog[]>([]);
  const [yourClock, setYourClock] = useState(300);
  const [theirClock, setTheirClock] = useState(300);
  const [combo, setCombo] = useState<ComboState | null>(null);
  const comboKey = useRef(0);
  // Pending request guard: while a move is in-flight we suppress clicks
  // and show "thinking" so the user can't double-submit.
  const [pending, setPending] = useState(false);

  // Derived: who's to move (UI side), and whether the AI is currently working.
  const turn: Side | null = apiState ? apiSideToUi(apiState.side_to_move) : null;
  const board: BoardState = apiState
    ? rowsToBoard(apiState.rows)
    : Array.from({ length: 8 }, () => Array(8).fill(0) as BoardState[number]);
  const thinking = !!apiState && !status && (turn === "black" || pending);

  // Persist the game outcome exactly once when status flips from null.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!status || reportedRef.current) return;
    reportedRef.current = true;
    onGameEnd(status, history.length);
  }, [status, history.length, onGameEnd]);

  // Apply an ApplyMove or AgentMove response, advancing all derived state.
  const applyResponse = useCallback(
    (
      next: ApplyMoveResponse | AgentMoveResponse,
      moveSide: Side,
      moveAgentName?: string,
    ) => {
      const { state, legal_moves, winner } = next;
      const move = "applied_move" in next ? next.applied_move : next.move;
      const fromCoord = squareToCoord(move.path[0]);
      const toCoord = squareToCoord(move.path[move.path.length - 1]);

      setApiState(state);
      setLegal(legal_moves);
      setLastMove({ from: fromCoord, to: toCoord });
      setHistory((h) => [
        ...h,
        {
          side: moveSide,
          from: fromCoord,
          to: toCoord,
          captured: move.capture_count,
          promoted: move.promotes,
        },
      ]);
      if (move.capture_count >= 2) {
        comboKey.current += 1;
        setCombo({
          count: move.capture_count,
          side: moveSide,
          key: comboKey.current,
        });
      }
      const w = apiWinnerToUi(winner);
      if (w) setStatus(w);

      // Suppress unused-var warning in builds without the agent name in scope.
      void moveAgentName;
    },
    [],
  );

  const applyPlayTurnResponse = useCallback(
    (next: PlayTurnResponse) => {
      setApiState(next.state);
      setLegal(next.legal_moves);
      const w = apiWinnerToUi(next.winner);
      if (w) {
        setStatus(w);
        return;
      }
      if (next.agent_move) {
        const fromCoord = squareToCoord(next.agent_move.path[0]);
        const toCoord = squareToCoord(
          next.agent_move.path[next.agent_move.path.length - 1],
        );
        setLastMove({ from: fromCoord, to: toCoord });
        setHistory((h) => [
          ...h,
          {
            side: "black",
            from: fromCoord,
            to: toCoord,
            captured: next.agent_move!.capture_count,
            promoted: next.agent_move!.promotes,
          },
        ]);
        if (next.agent_move.capture_count >= 2) {
          comboKey.current += 1;
          setCombo({
            count: next.agent_move.capture_count,
            side: "black",
            key: comboKey.current,
          });
        }
      }
    },
    [],
  );

  // Boot: fetch initial state, then if it's the AI's turn, ask sinza to open.
  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const initial = await getInitialState(ctrl.signal);
        if (cancelled) return;
        const initialUiTurn = apiSideToUi(initial.side_to_move);
        // Always fetch legal moves so highlights work no matter whose turn.
        const lm = await getLegalMoves(initial);
        if (cancelled) return;
        setApiState(lm.state);
        setLegal(lm.legal_moves);
        setBoot("ready");

        // If sinza opens (API initial state has side_to_move === "red" today),
        // trigger the agent move right away.
        if (initialUiTurn === "black") {
          setPending(true);
          try {
            const agentResp = await agentMove(agent.id, lm.state);
            if (cancelled) return;
            applyResponse(agentResp, "black");
          } finally {
            if (!cancelled) setPending(false);
          }
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setBootError(msg);
        setBoot("error");
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [agent.id, applyResponse]);

  // clocks
  useEffect(() => {
    if (status || !turn) return;
    const id = setInterval(() => {
      if (turn === "red") setYourClock((s) => Math.max(0, s - 1));
      else setTheirClock((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [turn, status]);

  // auto-clear combo banner
  useEffect(() => {
    if (!combo) return;
    const t = setTimeout(() => setCombo(null), 1400);
    return () => clearTimeout(t);
  }, [combo]);

  // Human click handler.
  const onCell = useCallback(
    async (r: number, c: number) => {
      if (status || pending || boot !== "ready") return;
      if (!apiState || turn !== "red") return;

      const piece = board[r][c];

      // Click on own piece → select it and show its legal targets.
      if (piece && (piece === 1 || piece === 2)) {
        const fromSq = coordToSquare(r, c);
        const mine = legal.filter((m) => m.path[0] === fromSq);
        if (mine.length) {
          setSelected([r, c]);
          setLegalFrom(mine);
          return;
        }
      }

      // Click on a target → submit the move.
      if (selected) {
        const mv = findMoveByEndpoints(legalFrom, selected, [r, c]);
        if (mv) {
          // Optimistic UI: snap the piece to its destination immediately so
          // there's no perceptible lag. The engine round-trip happens in the
          // background and overwrites this state when it lands.
          const optimistic = optimisticApplyMove(apiState, mv);
          const fromCoord = squareToCoord(mv.path[0]);
          const toCoord = squareToCoord(mv.path[mv.path.length - 1]);
          const previous = apiState;

          setApiState(optimistic);
          setLegal([]);
          setLastMove({ from: fromCoord, to: toCoord });
          setHistory((h) => [
            ...h,
            {
              side: "red",
              from: fromCoord,
              to: toCoord,
              captured: mv.capture_count,
              promoted: mv.promotes,
            },
          ]);
          if (mv.capture_count >= 2) {
            comboKey.current += 1;
            setCombo({
              count: mv.capture_count,
              side: "red",
              key: comboKey.current,
            });
          }
          setSelected(null);
          setLegalFrom([]);
          setPending(true);

          try {
            // One backend round trip: confirm the human move and get Sinza's reply.
            const turnResp = await playTurnApi(agent.id, previous, mv.pdn);
            applyPlayTurnResponse(turnResp);
          } catch (e) {
            // Roll back to the engine's last known good state.
            const msg = e instanceof Error ? e.message : String(e);
            setApiState(previous);
            setBootError(msg);
            setBoot("error");
          } finally {
            setPending(false);
          }
          return;
        }
      }

      setSelected(null);
      setLegalFrom([]);
    },
    [
      agent.id,
      apiState,
      applyPlayTurnResponse,
      board,
      boot,
      legal,
      legalFrom,
      pending,
      selected,
      status,
      turn,
    ],
  );

  const targets = new Set(
    legalFrom.map((m) => {
      const [er, ec] = squareToCoord(m.path[m.path.length - 1]);
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
        <button
          className="ar-bar-exit"
          onClick={() =>
            status ? onExit() : onForfeitAndExit(history.length)
          }
        >
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
            active={turn === "red" && !status && !pending}
            time={fmtClock(yourClock)}
            side="red"
          />
        </div>

        {/* right column — status / eval / actions */}
        <aside className="ar-side ar-side-right">
          <div className="ar-stat">
            <div className="ar-stat-label">status</div>
            <div className="ar-stat-val">
              {boot === "loading" ? (
                <span className="ar-blink">connecting…</span>
              ) : boot === "error" ? (
                <span title={bootError ?? ""}>engine offline</span>
              ) : status ? (
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
                  height: `${(redCount / Math.max(1, redCount + blackCount)) * 100}%`,
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
