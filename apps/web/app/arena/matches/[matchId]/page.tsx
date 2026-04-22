"use client";

import Link from "next/link";
import { use } from "react";
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

function winnerLine(
  winner: "red" | "white" | "draw" | null,
  red: string,
  white: string,
): string {
  if (winner === null) return "no winner";
  if (winner === "draw") return "draw";
  if (winner === "red") return `${red} wins`;
  return `${white} wins`;
}

function ArenaBoard({ state }: { state: StatePayload }) {
  return (
    <div className="arena-board" role="img" aria-label="current board position">
      {state.rows.map((row, r) => (
        <div key={r} className="arena-board-row">
          {Array.from(row).map((ch, c) => {
            const isDark = (r + c) % 2 === 1;
            const pieceClass =
              ch === "r"
                ? "piece red man"
                : ch === "R"
                ? "piece red king"
                : ch === "w"
                ? "piece white man"
                : ch === "W"
                ? "piece white king"
                : null;
            return (
              <div
                key={c}
                className={`arena-board-sq ${isDark ? "dark" : "light"}`}
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

export default function ArenaMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  const match = useQuery(api.arenaPublic.getMatch, { matchId });
  // initialNumItems covers almost every match in one page; if a run hits the
  // 300-ply cap the user can load more, but typical games finish far sooner.
  const pliesResult = usePaginatedQuery(
    api.arenaPublic.listPlies,
    { matchId },
    { initialNumItems: 300 },
  );

  if (match === undefined) {
    return (
      <main className="arena-match">
        <p className="arena-match-loading">loading match…</p>
      </main>
    );
  }

  if (match === null) {
    return (
      <main className="arena-match">
        <header className="arena-match-header">
          <Link href="/arena" className="arena-back">
            ← back to arena
          </Link>
        </header>
        <p className="arena-match-missing">
          match not found. it may be private or it might never have existed.
        </p>
      </main>
    );
  }

  const plies = pliesResult.results;
  const red = match.redParticipant.displayName;
  const white = match.whiteParticipant.displayName;
  const duration = formatDuration(match.startedAt, match.endedAt);

  return (
    <main className="arena-match">
      <header className="arena-match-header">
        <Link href="/arena" className="arena-back">
          ← back to arena
        </Link>
        <h1 className="arena-match-title">
          <span className="arena-side arena-red">{red}</span>
          <span className="arena-vs">vs</span>
          <span className="arena-side arena-white">{white}</span>
        </h1>
        <div className="arena-match-meta" data-status={match.status}>
          <span className="arena-status">
            {STATUS_LABEL[match.status as ArenaStatus] ?? match.status}
          </span>
          <span>·</span>
          <span>{match.totalPlies} plies</span>
          {duration && (
            <>
              <span>·</span>
              <span>{duration}</span>
            </>
          )}
          <span>·</span>
          <span>{formatWhen(match.requestedAt)}</span>
          <span>·</span>
          <span className="arena-result">{winnerLine(match.winner, red, white)}</span>
        </div>
      </header>

      <section className="arena-match-body">
        <div className="arena-participants">
          <ParticipantCard side="red" snapshot={match.redParticipant} />
          <ParticipantCard side="white" snapshot={match.whiteParticipant} />
        </div>

        <div className="arena-board-wrap">
          <ArenaBoard state={match.currentState} />
          <p className="arena-board-caption">
            {match.status === "running"
              ? `${match.currentState.side_to_move} to move`
              : `final position — ${match.totalPlies} plies played`}
          </p>
        </div>
      </section>

      <section className="arena-moves">
        <h2 className="arena-moves-heading">moves</h2>
        {plies.length === 0 ? (
          <p className="arena-moves-empty">no plies yet.</p>
        ) : (
          <ol className="arena-moves-list">
            {plies.map((p) => (
              <li
                key={p._id}
                className="arena-move-row"
                data-side={p.side}
              >
                <span className="arena-move-index">{p.plyIndex + 1}</span>
                <span className={`arena-move-side arena-${p.side}`}>{p.side}</span>
                <span className="arena-move-pdn">{p.movePdn}</span>
                {p.say && (
                  <span className="arena-move-say">&ldquo;{p.say}&rdquo;</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function ParticipantCard({
  side,
  snapshot,
}: {
  side: "red" | "white";
  snapshot: {
    displayName: string;
    model: string;
    promptVersion: string;
    temperature: number;
    maxOutputTokens: number;
  };
}) {
  return (
    <div className={`arena-participant arena-participant-${side}`}>
      <p className="arena-participant-side">{side}</p>
      <p className="arena-participant-name">{snapshot.displayName}</p>
      <dl className="arena-participant-meta">
        <dt>model</dt>
        <dd>{snapshot.model}</dd>
        <dt>prompt</dt>
        <dd>{snapshot.promptVersion}</dd>
        <dt>temp</dt>
        <dd>{snapshot.temperature}</dd>
        <dt>max out</dt>
        <dd>{snapshot.maxOutputTokens}</dd>
      </dl>
    </div>
  );
}
