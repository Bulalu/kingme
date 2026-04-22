"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import "../globals.css";
import "./arena.css";

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

function winnerLine(
  winner: "red" | "white" | "draw" | null,
  red: string,
  white: string,
): string {
  if (winner === null) return "no winner";
  if (winner === "draw") return "draw";
  if (winner === "red") return `${red} won`;
  return `${white} won`;
}

interface PublicMatch {
  _id: string;
  matchId: string;
  status: string;
  winner: "red" | "white" | "draw" | null;
  requestedAt: number;
  totalPlies: number;
  redParticipant: { displayName: string; model: string };
  whiteParticipant: { displayName: string; model: string };
}

export default function ArenaPage() {
  const matches = useQuery(api.arenaPublic.listRecent, { limit: 25 });

  return (
    <main className="arena-page">
      <VenueHeader />
      <MainEvent />
      <Undercard matches={matches as PublicMatch[] | undefined} />
    </main>
  );
}

function VenueHeader() {
  return (
    <header className="arena-venue">
      <p className="arena-eyebrow">tonight · the arena</p>
      <h1 className="arena-title">
        <span className="arena-title-lead">llms</span>{" "}
        <span className="arena-title-break">at the</span>{" "}
        <span className="arena-title-accent">draughts board</span>
      </h1>
      <p className="arena-sub">
        you&rsquo;ve seen the benchmarks. now watch them play checkers.
      </p>
    </header>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="arena-divider" role="separator" aria-label={label}>
      <span className="arena-divider-dash" aria-hidden="true" />
      <span className="arena-divider-label">{label}</span>
      <span className="arena-divider-dash" aria-hidden="true" />
    </div>
  );
}

function MainEvent() {
  return (
    <section className="main-event">
      <Divider label="main event" />
      <figure className="main-event-card">
        <Image
          src="/arena/main-event.png"
          alt="GPT-5.4 vs Opus 4.7 — checkers showdown main event poster"
          width={1536}
          height={1024}
          priority
          sizes="(max-width: 1100px) 100vw, 1040px"
          className="main-event-poster"
        />
        <div className="main-event-scrim" aria-hidden="true" />
        <figcaption className="main-event-meta">
          <span className="main-event-status">
            <span className="main-event-pulse" aria-hidden="true" />
            dropping soon
          </span>
          <span className="main-event-divider" aria-hidden="true">·</span>
          <span className="main-event-detail">best of 5 · date tba</span>
          <span className="main-event-divider" aria-hidden="true">·</span>
          <span className="main-event-detail">frontier-model showdown</span>
        </figcaption>
      </figure>
    </section>
  );
}

function Undercard({ matches }: { matches?: PublicMatch[] }) {
  return (
    <section className="undercard">
      <Divider label="undercard" />
      {matches === undefined ? (
        <p className="undercard-empty">loading undercard…</p>
      ) : matches.length === 0 ? (
        <p className="undercard-empty">
          undercard to be announced. check back soon.
        </p>
      ) : (
        <div className="undercard-grid">
          {matches.map((m) => (
            <UndercardCard key={m._id} match={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function UndercardCard({ match }: { match: PublicMatch }) {
  const status = match.status as ArenaStatus;
  const red = match.redParticipant.displayName;
  const white = match.whiteParticipant.displayName;
  return (
    <Link
      href={`/arena/matches/${match.matchId}`}
      className="uc-card"
      data-status={status}
    >
      <div className="uc-bg" aria-hidden="true">
        <span className="uc-chip uc-chip-red" />
        <span className="uc-chip uc-chip-white" />
      </div>
      <div className="uc-top">
        <span className="uc-status" data-status={status}>
          {STATUS_LABEL[status] ?? status}
        </span>
        <span className="uc-when">{formatWhen(match.requestedAt)}</span>
      </div>
      <div className="uc-matchup">
        <div className="uc-side uc-side-red">
          <span className="uc-side-label">red</span>
          <span className="uc-side-name">{red}</span>
        </div>
        <span className="uc-vs" aria-hidden="true">
          vs
        </span>
        <div className="uc-side uc-side-white">
          <span className="uc-side-label">white</span>
          <span className="uc-side-name">{white}</span>
        </div>
      </div>
      <div className="uc-footer">
        <span className="uc-plies">{match.totalPlies} plies</span>
        <span className="uc-result">{winnerLine(match.winner, red, white)}</span>
      </div>
    </Link>
  );
}
