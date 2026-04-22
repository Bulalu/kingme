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

type TerminationReason =
  | "normal"
  | "max_plies"
  | "protocol_violation"
  | "provider_timeout"
  | "provider_error"
  | "runner_error"
  | "cancelled"
  | null;

// Renders the result line for a match card. When a match ended without
// a winner, explain WHY — "no winner" alone reads like a draw, but the
// reason is usually truncation (we hit the ply cap) or an operational
// failure. Engine-decided draws get their own label.
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
  // winner === null
  if (status === "failed") return "forfeit · protocol";
  if (status === "aborted") return "aborted";
  if (terminationReason === "max_plies") return "ply cap reached";
  return "no winner";
}

interface SeriesMeta {
  id: string;
  gameIndex: number;
  bestOf?: number;
  name?: string;
}

interface MatchParticipant {
  profileId: string;
  displayName: string;
  model: string;
}

interface PublicMatch {
  _id: string;
  matchId: string;
  status: string;
  winner: "red" | "white" | "draw" | null;
  terminationReason: TerminationReason;
  requestedAt: number;
  totalPlies: number;
  redParticipant: MatchParticipant;
  whiteParticipant: MatchParticipant;
  cardUrl: string | null;
  series: SeriesMeta | null;
}

interface SeriesGroup {
  id: string;
  bestOf?: number;
  name?: string;
  cardUrl: string | null;
  games: PublicMatch[]; // sorted by gameIndex ascending
  participants: { a: MatchParticipant; b: MatchParticipant };
  scoreA: number;
  scoreB: number;
  winner: MatchParticipant | null; // the profile that won the series, if decided
}

// Partition the match list into series groups (matches that share a
// series.id) and loose matches. Series groups are sorted by the
// latest requestedAt of their games so the freshest action is up top.
// Within a group, games are sorted by gameIndex ascending.
function partitionMatches(matches: PublicMatch[]): {
  seriesGroups: SeriesGroup[];
  loose: PublicMatch[];
} {
  const bySeriesId = new Map<string, PublicMatch[]>();
  const loose: PublicMatch[] = [];
  for (const m of matches) {
    if (!m.series) {
      loose.push(m);
      continue;
    }
    const arr = bySeriesId.get(m.series.id);
    if (arr) arr.push(m);
    else bySeriesId.set(m.series.id, [m]);
  }

  const seriesGroups: SeriesGroup[] = [];
  for (const [id, gamesRaw] of bySeriesId) {
    const games = [...gamesRaw].sort(
      (x, y) => (x.series?.gameIndex ?? 0) - (y.series?.gameIndex ?? 0),
    );
    // Participants across the series. Uses profileId for identity so a
    // profile can swap sides between games and still score correctly.
    const seen = new Map<string, MatchParticipant>();
    for (const g of games) {
      if (!seen.has(g.redParticipant.profileId))
        seen.set(g.redParticipant.profileId, g.redParticipant);
      if (!seen.has(g.whiteParticipant.profileId))
        seen.set(g.whiteParticipant.profileId, g.whiteParticipant);
    }
    const entries = [...seen.values()];
    // A series ought to have exactly two participants; if we somehow
    // end up with more (e.g. a bug in series tagging), fall back to
    // rendering the group without a scorecard by skipping the grouping.
    if (entries.length !== 2) continue;
    const [a, b] = entries;

    let scoreA = 0;
    let scoreB = 0;
    for (const g of games) {
      const winnerProfile =
        g.winner === "red"
          ? g.redParticipant.profileId
          : g.winner === "white"
          ? g.whiteParticipant.profileId
          : null;
      if (winnerProfile === a.profileId) scoreA++;
      else if (winnerProfile === b.profileId) scoreB++;
    }

    let winner: MatchParticipant | null = null;
    const bestOf = games[0]?.series?.bestOf;
    if (bestOf) {
      const threshold = Math.ceil((bestOf + 1) / 2);
      if (scoreA >= threshold) winner = a;
      else if (scoreB >= threshold) winner = b;
    }

    // Prefer a cardUrl from the first game that has one; fine because
    // series games are the same matchup.
    const cardUrl = games.find((g) => g.cardUrl)?.cardUrl ?? null;

    seriesGroups.push({
      id,
      bestOf,
      name: games[0]?.series?.name,
      cardUrl,
      games,
      participants: { a, b },
      scoreA,
      scoreB,
      winner,
    });
  }

  // Sort series groups by their most recent game
  seriesGroups.sort((x, y) => {
    const xLatest = Math.max(...x.games.map((g) => g.requestedAt));
    const yLatest = Math.max(...y.games.map((g) => g.requestedAt));
    return yLatest - xLatest;
  });

  return { seriesGroups, loose };
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

  const { seriesGroups, loose } = partitionMatches(matches);

  return (
    <div className="undercard-stack">
      {seriesGroups.map((s) => (
        <SeriesBlock key={s.id} series={s} />
      ))}
      {loose.length > 0 && (
        <div className="undercard-grid">
          {loose.map((m) => (
            <UndercardCard key={m._id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function SeriesBlock({ series }: { series: SeriesGroup }) {
  return (
    <section className="series" aria-label={series.name ?? "series"}>
      <SeriesScorecard series={series} />
      <div className="series-games">
        {series.games.map((m) => (
          <UndercardCard key={m._id} match={m} />
        ))}
      </div>
    </section>
  );
}

function SeriesScorecard({ series }: { series: SeriesGroup }) {
  const { participants, scoreA, scoreB, winner, bestOf, games, name } = series;
  const decided = winner !== null;
  const label = name ?? "series";
  const totalSlots = bestOf ?? games.length;
  const statusLine = decided
    ? "final"
    : games.length >= (bestOf ?? 0)
    ? "tied"
    : "in progress";

  return (
    <div className="series-card" data-status={decided ? "final" : "live"}>
      {series.cardUrl && (
        <div className="series-card-bg" aria-hidden="true">
          <Image
            src={series.cardUrl}
            alt=""
            fill
            sizes="(max-width: 960px) 100vw, 1200px"
            className="series-card-bg-img"
          />
          <div className="series-card-bg-scrim" />
        </div>
      )}
      <div className="series-card-body">
        <div className="series-card-eyebrow">
          <span className="series-card-label">{label}</span>
          <span className="series-card-dot" aria-hidden="true">·</span>
          {bestOf ? <span>best of {bestOf}</span> : <span>{games.length} games</span>}
          <span className="series-card-dot" aria-hidden="true">·</span>
          <span className="series-card-status" data-status={decided ? "final" : "live"}>
            {statusLine}
          </span>
        </div>
        <div className="series-card-score">
          <span className="series-card-side series-card-side-a">
            <span className="series-card-name">{participants.a.displayName}</span>
          </span>
          <span className="series-card-tally" aria-label="series score">
            <span className="series-card-num">{scoreA}</span>
            <span className="series-card-dash" aria-hidden="true">—</span>
            <span className="series-card-num">{scoreB}</span>
          </span>
          <span className="series-card-side series-card-side-b">
            <span className="series-card-name">{participants.b.displayName}</span>
          </span>
        </div>
        <div className="series-card-footer">
          {decided && winner ? (
            <span className="series-card-winner">
              series winner: <strong>{winner.displayName}</strong>
            </span>
          ) : bestOf ? (
            <span className="series-card-progress">
              {games.length} of {totalSlots} games played
            </span>
          ) : (
            <span className="series-card-progress">{games.length} games</span>
          )}
        </div>
      </div>
    </div>
  );
}

function UndercardCard({ match }: { match: PublicMatch }) {
  const status = match.status as ArenaStatus;
  const red = match.redParticipant.displayName;
  const white = match.whiteParticipant.displayName;
  const cardArt = match.cardUrl;
  const gameIndex = match.series?.gameIndex ?? null;

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
          <span className="uc-top-chips">
            {gameIndex !== null && (
              <span className="uc-game-badge">game {gameIndex}</span>
            )}
            <span className="uc-status" data-status={status}>
              {STATUS_LABEL[status] ?? status}
            </span>
          </span>
          <span className="uc-when">{formatWhen(match.requestedAt)}</span>
        </div>
        <div className="uc-poster-footer">
          <span className="uc-poster-plies">{match.totalPlies} plies</span>
          <span className="uc-poster-result">
            {resultLine(status, match.winner, match.terminationReason, red, white)}
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
        <span className="uc-top-chips">
          {gameIndex !== null && (
            <span className="uc-game-badge">game {gameIndex}</span>
          )}
          <span className="uc-status" data-status={status}>
            {STATUS_LABEL[status] ?? status}
          </span>
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
        <span className="uc-result">
          {resultLine(status, match.winner, match.terminationReason, red, white)}
        </span>
      </div>
    </Link>
  );
}
