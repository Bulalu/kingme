"use client";

import Link from "next/link";
import { use, useEffect, useRef } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { StatePayload } from "@kingme/shared/engine";
import "../../../globals.css";
import "../../arena.css";
import "./match.css";

type ArenaStatus = "pending" | "running" | "completed" | "failed" | "aborted";

const STATUS_LABEL: Record<ArenaStatus, string> = {
  pending: "pending",
  running: "live",
  completed: "final",
  failed: "failed",
  aborted: "aborted",
};

function formatDuration(startedAt: number | null, endedAt: number | null) {
  if (!startedAt) return null;
  const end = endedAt ?? Date.now();
  const secs = Math.round((end - startedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem ? `${mins}m ${rem}s` : `${mins}m`;
}

function formatWhen(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type TerminationReason =
  | "normal"
  | "max_plies"
  | "protocol_violation"
  | "provider_timeout"
  | "provider_error"
  | "runner_error"
  | "cancelled"
  | null;

// Match result label. winner+status+terminationReason together give a
// much honester read than `winner` alone — a null winner on a maxed-
// out match is "ply cap reached", not "no winner" (reads as draw), and
// a failed match is a forfeit, not a null result.
function resultLine(
  status: ArenaStatus,
  winner: "red" | "white" | "draw" | null,
  terminationReason: TerminationReason,
  red: string,
  white: string,
): string {
  if (winner === "red") return `${red} won`;
  if (winner === "white") return `${white} won`;
  if (winner === "draw") return "draw";
  if (status === "failed") return "forfeit · protocol";
  if (status === "aborted") return "aborted";
  if (terminationReason === "max_plies") return "ply cap reached";
  return "no winner";
}

interface ParticipantSnapshot {
  displayName: string;
  model: string;
  promptVersion: string;
  temperature: number;
  maxOutputTokens: number;
}

interface PublicPly {
  _id: string;
  plyIndex: number;
  side: "red" | "white";
  movePdn: string;
  stateBefore: StatePayload;
  stateAfter: StatePayload;
  say: string | null;
  latencyMs: number;
  createdAt: number;
}

export default function ArenaMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  const match = useQuery(api.arenaPublic.getMatch, { matchId });
  const pliesResult = usePaginatedQuery(
    api.arenaPublic.listPlies,
    { matchId },
    { initialNumItems: 300 },
  );

  if (match === undefined) {
    return (
      <main className="match-page">
        <div className="km-wrap match-loading">loading match…</div>
      </main>
    );
  }

  if (match === null) {
    return (
      <main className="match-page">
        <div className="km-wrap">
          <Link href="/arena" className="match-back">
            ← back to arena
          </Link>
          <p className="match-missing">
            match not found. it may be private, or it never existed.
          </p>
        </div>
      </main>
    );
  }

  const plies = pliesResult.results as PublicPly[];
  const status = match.status as ArenaStatus;
  const red = match.redParticipant.displayName;
  const white = match.whiteParticipant.displayName;
  const duration = formatDuration(match.startedAt, match.endedAt);
  const isLive = status === "running";

  return (
    <main className="match-page">
      <div className="km-wrap">
        <div className="match-head">
          <Link href="/arena" className="match-back">
            ← back to arena
          </Link>
          <div className="km-kicker match-kicker">
            <span className="km-kicker-dot" />
            {isLive ? "the arena · live" : "the arena · match"}
          </div>
          <h1 className="match-title">
            <span className="match-title-red">{red}</span>
            <span className="match-title-vs">vs</span>
            <span className="match-title-white">{white}</span>
          </h1>
          <div className="match-meta" data-status={status}>
            <span className="match-status">
              {STATUS_LABEL[status] ?? status}
            </span>
            <span className="match-meta-dot">·</span>
            <span>{match.totalPlies} plies</span>
            {duration && (
              <>
                <span className="match-meta-dot">·</span>
                <span>{duration}</span>
              </>
            )}
            <span className="match-meta-dot">·</span>
            <span>{formatWhen(match.requestedAt)}</span>
            <span className="match-meta-dot">·</span>
            <span className="match-meta-result">
              {resultLine(
                status,
                match.winner,
                match.terminationReason as TerminationReason,
                red,
                white,
              )}
            </span>
          </div>
        </div>

        <div className="match-stage">
          <section className="match-board-col">
            <ParticipantStrip
              side="red"
              snapshot={match.redParticipant}
              sideToMove={match.currentState.side_to_move}
              status={status}
            />
            <BoardChrome state={match.currentState} matchId={matchId} status={status} />
            <ParticipantStrip
              side="white"
              snapshot={match.whiteParticipant}
              sideToMove={match.currentState.side_to_move}
              status={status}
            />
            <MoveTicker plies={plies} total={match.totalPlies} />
          </section>

          <aside className="match-chat-col">
            <CommentaryPanel plies={plies} status={status} />
          </aside>
        </div>
      </div>
    </main>
  );
}

// ── Board ────────────────────────────────────────────────────

function BoardChrome({
  state,
  matchId,
  status,
}: {
  state: StatePayload;
  matchId: string;
  status: ArenaStatus;
}) {
  const badge =
    status === "running" ? "● LIVE" : status === "completed" ? "● FINAL" : status.toUpperCase();
  const shortId = matchId.slice(0, 8);
  return (
    <div className="km-board-chrome match-chrome">
      <div className="km-chrome-row">
        <span className="km-chrome-dot" />
        <span className="km-chrome-dot" />
        <span className="km-chrome-dot" />
        <span className="km-chrome-title">kingme://arena/{shortId}</span>
        <span className="km-chrome-badge" data-status={status}>
          {badge}
        </span>
      </div>
      <ArenaBoard state={state} />
    </div>
  );
}

function ArenaBoard({ state }: { state: StatePayload }) {
  return (
    <div className="match-board" role="img" aria-label="current board position">
      {state.rows.map((row, r) => (
        <div key={r} className="match-board-row">
          {Array.from(row).map((ch, c) => {
            const isDark = (r + c) % 2 === 1;
            const pieceClass =
              ch === "r"
                ? "match-piece match-piece-red"
                : ch === "R"
                ? "match-piece match-piece-red match-piece-king"
                : ch === "w"
                ? "match-piece match-piece-white"
                : ch === "W"
                ? "match-piece match-piece-white match-piece-king"
                : null;
            return (
              <div
                key={c}
                className={`match-sq ${isDark ? "match-sq-dark" : "match-sq-light"}`}
              >
                {pieceClass && <span className={pieceClass} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Participant strips (red corner + white corner) ──────────

function ParticipantStrip({
  side,
  snapshot,
  sideToMove,
  status,
}: {
  side: "red" | "white";
  snapshot: ParticipantSnapshot;
  sideToMove: "red" | "white";
  status: ArenaStatus;
}) {
  const toMove = status === "running" && sideToMove === side;
  return (
    <div className={`match-strip match-strip-${side}`} data-to-move={toMove}>
      <span className={`match-strip-dot match-strip-dot-${side}`} />
      <div className="match-strip-body">
        <span className="match-strip-side">{side}</span>
        <span className="match-strip-name">{snapshot.displayName}</span>
      </div>
      <span className="match-strip-model">{snapshot.model}</span>
      {toMove && <span className="match-strip-tomove">to move</span>}
    </div>
  );
}

// ── Compact move ticker (below the board) ──────────────────

function MoveTicker({
  plies,
  total,
}: {
  plies: PublicPly[];
  total: number;
}) {
  return (
    <div className="match-ticker">
      <div className="match-ticker-head">
        <span>moves</span>
        <span className="match-ticker-count">{total}</span>
      </div>
      {plies.length === 0 ? (
        <p className="match-ticker-empty">no moves yet.</p>
      ) : (
        <ol className="match-ticker-list">
          {plies.map((p) => (
            <li
              key={p._id}
              className="match-ticker-row"
              data-side={p.side}
            >
              <span className="match-ticker-idx">{p.plyIndex + 1}</span>
              <span className={`match-ticker-side match-ticker-side-${p.side}`}>
                {p.side === "red" ? "●" : "○"}
              </span>
              <span className="match-ticker-pdn">{p.movePdn}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Commentary chat panel ──────────────────────────────────

function CommentaryPanel({
  plies,
  status,
}: {
  plies: PublicPly[];
  status: ArenaStatus;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const commented = plies.filter((p) => p.say && p.say.trim().length > 0);

  // Auto-scroll to bottom as new messages land — classic live-chat behaviour.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [commented.length]);

  const isLive = status === "running";

  return (
    <div className="chat" data-status={status}>
      <div className="chat-head">
        <span className="chat-head-dot" data-live={isLive} />
        <span className="chat-head-label">
          {isLive ? "live commentary" : "commentary"}
        </span>
        <span className="chat-head-count">{commented.length}</span>
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        {commented.length === 0 ? (
          <p className="chat-empty">
            {isLive
              ? "waiting for the first chirp…"
              : "silent match. nothing said."}
          </p>
        ) : (
          <ul className="chat-list">
            {commented.map((p, i) => (
              <li
                key={p._id}
                className="chat-msg"
                data-side={p.side}
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                <header className="chat-msg-head">
                  <span className={`chat-msg-dot chat-msg-dot-${p.side}`} />
                  <span className="chat-msg-side">{p.side}</span>
                  <span className="chat-msg-ply">ply {p.plyIndex + 1}</span>
                </header>
                <p className="chat-msg-body">&ldquo;{p.say}&rdquo;</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
