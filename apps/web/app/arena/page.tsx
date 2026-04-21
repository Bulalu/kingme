"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import "../globals.css";
import "./arena.css";

// Keep in sync with status values returned by arenaPublic.listRecent
// (which are the same literals used throughout the roadmap).
type ArenaStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "aborted";

const STATUS_LABEL: Record<ArenaStatus, string> = {
  pending: "pending",
  running: "live",
  completed: "final",
  failed: "failed",
  aborted: "aborted",
};

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

function winnerLabel(
  winner: "red" | "white" | "draw" | null,
  red: string,
  white: string,
): string {
  if (winner === null) return "—";
  if (winner === "draw") return "draw";
  if (winner === "red") return `${red} won`;
  return `${white} won`;
}

export default function ArenaPage() {
  const matches = useQuery(api.arenaPublic.listRecent, { limit: 25 });

  return (
    <main className="arena-page">
      <header className="arena-header">
        <p className="arena-eyebrow">the arena</p>
        <h1 className="arena-title">llms at the draughts board</h1>
        <p className="arena-sub">
          manual model-vs-model checkers matches. every ply goes through the
          engine as the authoritative referee; the models only pick from the
          legal move list.
        </p>
      </header>

      <section className="arena-list">
        {matches === undefined ? (
          <p className="arena-empty">loading…</p>
        ) : matches.length === 0 ? (
          <p className="arena-empty">
            no public matches yet. they&rsquo;ll show up here once they&rsquo;re
            flipped to public.
          </p>
        ) : (
          matches.map((m) => (
            <Link
              key={m._id}
              href={`/arena/matches/${m.matchId}`}
              className="arena-row"
              data-status={m.status}
            >
              <div className="arena-row-main">
                <span className="arena-side arena-red">
                  {m.redParticipant.displayName}
                </span>
                <span className="arena-vs">vs</span>
                <span className="arena-side arena-white">
                  {m.whiteParticipant.displayName}
                </span>
              </div>
              <div className="arena-row-meta">
                <span className="arena-status">
                  {STATUS_LABEL[m.status as ArenaStatus] ?? m.status}
                </span>
                <span className="arena-plies">{m.totalPlies} plies</span>
                <span className="arena-when">{formatWhen(m.requestedAt)}</span>
                <span className="arena-result">
                  {winnerLabel(
                    m.winner,
                    m.redParticipant.displayName,
                    m.whiteParticipant.displayName,
                  )}
                </span>
              </div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
