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
  cardUrl: string | null;
}

export default function ArenaPage() {
  const matches = useQuery(api.arenaPublic.listRecent, { limit: 25 });

  return (
    <main className="arena-page">
      <section className="km-wrap arena-head">
        <div className="km-kicker">
          <span className="km-kicker-dot" />
          the arena
        </div>
        <h1 className="arena-h1">
          llms at the <span className="km-accent-text">draughts board</span>
        </h1>
        <p className="arena-lede">
          you&rsquo;ve seen the benchmarks. now watch them play checkers.
        </p>
      </section>

      <section className="km-wrap arena-section">
        <SectionHead label="main event" />
        <MainEvent />
      </section>

      <section className="km-wrap arena-section">
        <SectionHead label="undercard" />
        <Undercard matches={matches as PublicMatch[] | undefined} />
      </section>
    </main>
  );
}

function SectionHead({ label }: { label: string }) {
  return (
    <div className="arena-section-head" role="separator" aria-label={label}>
      <span className="arena-section-rule" aria-hidden="true" />
      <span className="arena-section-label">{label}</span>
      <span className="arena-section-rule" aria-hidden="true" />
    </div>
  );
}

function MainEvent() {
  return (
    <figure className="main-event">
      <Image
        src="/arena/main-event.png"
        alt="GPT-5.4 vs Opus 4.7 — checkers showdown"
        fill
        priority
        sizes="(max-width: 720px) 100vw, (max-width: 1320px) calc(100vw - 96px), 1224px"
        className="main-event-img"
      />
      <div className="main-event-scrim" aria-hidden="true" />
      <figcaption className="main-event-footer">
        <span className="main-event-pill">
          <span className="main-event-pill-dot" aria-hidden="true" />
          dropping soon
        </span>
        <span className="main-event-dot" aria-hidden="true">
          ·
        </span>
        <span className="main-event-meta">best of 5 · date tba</span>
        <span className="main-event-dot" aria-hidden="true">
          ·
        </span>
        <span className="main-event-meta">frontier-model showdown</span>
      </figcaption>
    </figure>
  );
}

function Undercard({ matches }: { matches?: PublicMatch[] }) {
  if (matches === undefined) {
    return <p className="undercard-empty">loading undercard…</p>;
  }
  if (matches.length === 0) {
    return (
      <p className="undercard-empty">
        undercard to be announced. check back soon.
      </p>
    );
  }
  return (
    <div className="undercard-grid">
      {matches.map((m) => (
        <UndercardCard key={m._id} match={m} />
      ))}
    </div>
  );
}

function UndercardCard({ match }: { match: PublicMatch }) {
  const status = match.status as ArenaStatus;
  const red = match.redParticipant.displayName;
  const white = match.whiteParticipant.displayName;
  const cardArt = match.cardUrl;

  if (cardArt) {
    return (
      <Link
        href={`/arena/matches/${match.matchId}`}
        className="uc-card uc-card--poster"
        data-status={status}
      >
        <Image
          src={cardArt}
          alt={`${red} vs ${white} — matchup card`}
          fill
          sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 33vw"
          className="uc-poster-img"
        />
        <div className="uc-poster-scrim" aria-hidden="true" />
        <div className="uc-poster-top">
          <span className="uc-status" data-status={status}>
            {STATUS_LABEL[status] ?? status}
          </span>
          <span className="uc-when">{formatWhen(match.requestedAt)}</span>
        </div>
        <div className="uc-poster-footer">
          <span className="uc-poster-plies">{match.totalPlies} plies</span>
          <span className="uc-poster-result">
            {winnerLine(match.winner, red, white)}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/arena/matches/${match.matchId}`}
      className="uc-card"
      data-status={status}
    >
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
