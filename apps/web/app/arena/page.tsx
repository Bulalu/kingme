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

// Per-matchup card art. Key is `{red.displayName}__{white.displayName}` —
// lowercase. When a match's participant display names match a key, the
// undercard renders the image as a fight-poster background instead of
// the auto-generated layout. Stopgap until we add a proper cardUrl
// field on arenaMatches — good enough while the matchup roster is small.
const MATCHUP_CARDS: Record<string, string> = {
  "gpt-5.4-mini__claude-haiku-4.5":
    "/arena/cards/gpt-5.4-mini__claude-haiku-4.5.png",
  // Legacy dev alias — the old `gpt-4o-mini` profile was renamed to
  // `gpt-5.4-mini` but historical Convex matches still carry the old
  // display name in their participant snapshot. Same matchup, same
  // card art. Remove this entry once those older dev matches are
  // purged or re-snapshotted.
  "gpt-4o-mini__claude-haiku-4.5":
    "/arena/cards/gpt-5.4-mini__claude-haiku-4.5.png",
};

function cardArtFor(redName: string, whiteName: string): string | null {
  const key = `${redName.toLowerCase()}__${whiteName.toLowerCase()}`;
  return MATCHUP_CARDS[key] ?? null;
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
  const cardArt = cardArtFor(red, white);

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
          sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
          <span className="uc-poster-result">
            {winnerLine(match.winner, red, white)}
          </span>
          <span className="uc-poster-plies">{match.totalPlies} plies</span>
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
