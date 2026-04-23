"use client";

// Landing page sections for kingme.dev
// Ported from the design package (sections.jsx).

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Board from "./Board";
import { AGENT_ROSTER, FEATURED_AGENT, getAgentPath } from "@/lib/agents";

// ── Hero ───────────────────────────────────────────────────────
export interface HeroProps {
  variant: string;
  accent: string;
  copyVoice: string;
  mode: "demo" | "play";
  setMode: (m: "demo" | "play") => void;
}

function fmtInt(n: number) {
  return n.toLocaleString("en-US");
}

function fmtPct(n: number, d: number) {
  if (d <= 0) return "—";
  const pct = (n / d) * 100;
  return pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
}

export function Hero({ accent, copyVoice, mode, setMode }: HeroProps) {
  // Live agent counters from Convex. Falls back to hardcoded copy until
  // the first game is recorded (or while the query is loading).
  const featuredAgentStats = useQuery(api.agents.getByAgentId, {
    agentId: FEATURED_AGENT.id,
  });
  const featuredAgentGames = featuredAgentStats
    ? fmtInt(featuredAgentStats.gamesPlayed)
    : "0";
  const featuredAgentWinRate =
    featuredAgentStats && featuredAgentStats.gamesPlayed > 0
      ? fmtPct(featuredAgentStats.wins, featuredAgentStats.gamesPlayed)
      : "—";
  const humansWonRate =
    featuredAgentStats && featuredAgentStats.gamesPlayed > 0
      ? fmtPct(featuredAgentStats.losses, featuredAgentStats.gamesPlayed)
      : "—";
  const totalMoves = featuredAgentStats
    ? fmtInt(featuredAgentStats.totalMoves)
    : "—";
  const featuredAgentLabel = FEATURED_AGENT.displayName.toLowerCase();
  const taunts: Record<
    string,
    {
      kicker: string;
      line1: string;
      line2: string;
      sub: string;
      cta: string;
      cta2: string;
    }
  > = {
    cocky: {
      kicker: `meet ${featuredAgentLabel} · your first problem`,
      line1: "KING",
      line2: "ME.",
      sub: "AI agents that trained themselves. Now they're looking for a game.",
      cta: `play ${featuredAgentLabel}`,
      cta2: "watch him play himself",
    },
    dry: {
      kicker: `${featuredAgentLabel} · checkers agent · v3`,
      line1: "PLAY",
      line2: `${FEATURED_AGENT.name}.`,
      sub: "Trained from scratch on self-play. No opening books, no lookup tables — just a network that taught itself checkers.",
      cta: `play ${featuredAgentLabel}`,
      cta2: "watch demo",
    },
  };
  const t = taunts[copyVoice] || taunts.cocky;

  return (
    <section className="km-hero" data-screen-label="01 Hero">
      <div className="km-hero-grid">
        <div className="km-hero-left">
          <div className="km-kicker">
            <span className="km-kicker-dot" />
            {t.kicker}
          </div>
          <h1 className="km-h1">
            <span className="km-h1-line">{t.line1}</span>
            <span className="km-h1-line km-h1-accent">{t.line2}</span>
          </h1>
          <p className="km-hero-sub">{t.sub}</p>

          <div className="km-hero-ctas">
            <Link
              className="km-btn km-btn-primary"
              href={getAgentPath(FEATURED_AGENT.id)}
            >
              {`▶ ${t.cta}`}
            </Link>
            <button
              className={
                "km-btn km-btn-ghost " +
                (mode === "demo" ? "km-btn-active" : "")
              }
              onClick={() => setMode("demo")}
              type="button"
            >
              {t.cta2}
            </button>
          </div>

          <div className="km-hero-meta">
            <Stat label="games played vs bot" value={featuredAgentGames} />
            <Stat label="humans who won" value={humansWonRate} />
            <Stat label="moves he's made" value={totalMoves} />
          </div>
        </div>

        <div className="km-hero-right">
          <div className="km-hero-opponent">
            <div className="km-opp-portrait">
              <Image
                src={FEATURED_AGENT.img}
                alt={FEATURED_AGENT.displayName}
                fill
                sizes="88px"
                priority
              />
              <div className="km-opp-badge">● LIVE</div>
            </div>
              <div className="km-opp-meta">
                <div className="km-opp-label">your opponent</div>
                <div className="km-opp-name">{FEATURED_AGENT.name}</div>
                <div className="km-opp-stats">
                  <span>
                    <b>{featuredAgentGames}</b> games
                  </span>
                  <span>·</span>
                  <span>
                    <b>{featuredAgentWinRate}</b> win rate
                  </span>
                </div>
              <div className="km-opp-quote">&ldquo;njoo tuzinese wewe.....&rdquo;</div>
            </div>
          </div>
          <div className="km-board-stage">
            <div className="km-board-chrome">
              <div className="km-chrome-row">
                <span className="km-chrome-dot" />
                <span className="km-chrome-dot" />
                <span className="km-chrome-dot" />
                <span className="km-chrome-title">
                  {`kingme://${FEATURED_AGENT.id}/live`}
                </span>
                <span className="km-chrome-badge">
                  {mode === "play" ? "● LIVE" : "● DEMO"}
                </span>
              </div>
              <Board
                key={mode}
                mode={mode}
                size={460}
                accent={accent}
                demoSpeedMs={850}
              />
              <div className="km-board-footer">
                <span>{`agent · ${FEATURED_AGENT.id}-${FEATURED_AGENT.version.toLowerCase()} · ${FEATURED_AGENT.params} params`}</span>
                <span>difficulty · hard</span>
              </div>
            </div>
            <div className="km-board-shadow" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="km-stat">
      <div className="km-stat-val">{value}</div>
      <div className="km-stat-lbl">{label}</div>
    </div>
  );
}

// ── Marquee ────────────────────────────────────────────────────
export function Marquee() {
  const items = [
    "SKILL ISSUE",
    "★",
    "BRO",
    "★",
    "YOU'RE COOKED",
    "★",
    "SINZA DOESN'T MISS",
    "★",
    "WHY DO YOU TRY",
    "★",
    "L",
    "★",
    "NJOO TUZINESE WEWE",
    "★",
    "IT'S OVER",
    "★",
  ];
  const full = [...items, ...items, ...items];
  return (
    <div className="km-marquee" aria-hidden="true">
      <div className="km-marquee-track">
        {full.map((x, i) => (
          <span key={i} className="km-marquee-item">
            {x}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Roster (the agents) ────────────────────────────────────────
export function Roster() {
  return (
    <section className="km-section km-roster" data-screen-label="03 Agents">
      <SectionHead
        kicker="the roster · 04 agents"
        title={
          <>
            Pick your <span className="km-strike">agent</span>{" "}
            <span className="km-accent-text">loss.</span>
          </>
        }
        sub="Every game on kingme gets its own agent — its own training run, its own personality, its own way of making you lose. Here are the first four."
      />
      <div className="km-roster-grid">
        {AGENT_ROSTER.map((a) => (
          <article key={a.id} className={"km-agent km-agent-" + a.status}>
            <div className="km-agent-portrait">
              <Image
                src={a.img}
                alt={a.name}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
              />
              <div className="km-agent-overlay">
                <span className={"km-agent-pill km-agent-pill-" + a.status}>
                  {a.status === "live" ? "● live · play now" : "◌ in training"}
                </span>
              </div>
            </div>
            <div className="km-agent-body">
              <div className="km-agent-head">
                <div>
                  <div className="km-agent-tag">{a.tagline}</div>
                  <h3 className="km-agent-name">{a.name}</h3>
                </div>
                <div className="km-agent-version">{a.version}</div>
              </div>
              <p className="km-agent-bio">{a.bio}</p>
              <div className="km-agent-foot">
                <span className="km-agent-style">{a.style}</span>
                {a.status === "live" ? (
                  <Link
                    className="km-btn km-btn-primary km-btn-sm"
                    href={getAgentPath(a.id)}
                  >
                    play {a.name.toLowerCase()} →
                  </Link>
                ) : (
                  <button className="km-btn km-btn-ghost km-btn-sm">
                    notify when ready
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ── Roadmap (games) — condensed strip ──────────────────────────
export function Roadmap() {
  const games = [
    {
      name: "Checkers",
      status: "live" as const,
      glyph: "◈",
      agent: "sinza, masaki, tabata",
      note: "live · play now",
    },
    {
      name: "Chess",
      status: "upcoming" as const,
      glyph: "♞",
      agent: "tba",
      note: "casting agent",
    },
    {
      name: "Poker",
      status: "upcoming" as const,
      glyph: "♠",
      agent: "tba",
      note: "heads-up NLHE",
    },
  ];
  return (
    <section className="km-section km-roadmap" data-screen-label="03 Roadmap">
      <SectionHead
        kicker="roadmap · more agents, more games"
        title="More games. More agents. More losses."
        sub="Each game on kingme gets its own agent, trained from scratch by the same method: play yourself until you're terrifying."
      />
      <div className="km-roadmap-grid">
        {games.map((g) => (
          <div key={g.name} className={"km-game km-game-" + g.status}>
            <div className="km-game-glyph">{g.glyph}</div>
            <div className="km-game-name">{g.name}</div>
            <div className="km-game-agent">{g.agent}</div>
            <div className="km-game-status">
              <span className={"km-status-pill km-status-" + g.status}>
                {g.status === "live" ? "● live" : "◌ coming"}
              </span>
            </div>
            <div className="km-game-note">{g.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Leaderboard ────────────────────────────────────────────────
export function Leaderboard() {
  const rows = useQuery(api.players.topLeaderboard, { limit: 10 });
  const loading = rows === undefined;
  const empty = rows !== undefined && rows.length === 0;

  return (
    <section
      className="km-section km-leaderboard"
      data-screen-label="03 Leaderboard"
    >
      <SectionHead
        kicker="leaderboard"
        title="Who's actually won."
        sub="Every human who's finished a game against a live kingme agent. The ones still at 0 wins are the evidence."
      />
      <div className="km-lb-wrap">
        <div className="km-lb-header">
          <div>#</div>
          <div>handle</div>
          <div>win%</div>
          <div>w</div>
          <div>l</div>
          <div>d</div>
          <div>games</div>
        </div>
        {loading && (
          <div className="km-lb-row">
            <div className="km-lb-rank">—</div>
            <div className="km-lb-name">loading…</div>
            <div className="km-lb-elo">—</div>
            <div>—</div>
            <div>—</div>
            <div>—</div>
            <div>—</div>
          </div>
        )}
        {empty && (
          <div className="km-lb-row">
            <div className="km-lb-rank">01</div>
            <div className="km-lb-name">nobody yet</div>
            <div className="km-lb-elo">—</div>
            <div>0</div>
            <div>0</div>
            <div>0</div>
            <div>0</div>
          </div>
        )}
        {(() => {
          const maxWins = rows?.reduce((m, r) => Math.max(m, r.wins), 0) ?? 0;
          return rows?.map((r, i) => {
            const rate = r.gamesPlayed > 0 ? (r.wins / r.gamesPlayed) * 100 : 0;
            const rateLabel =
              r.gamesPlayed === 0
                ? "—"
                : rate >= 10
                  ? `${rate.toFixed(0)}%`
                  : `${rate.toFixed(1)}%`;
            const handle = r.name ?? "anon";
            const isTop = maxWins > 0 && r.wins === maxWins;
            return (
              <div key={`${i}-${handle}`} className="km-lb-row">
                <div className="km-lb-rank">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="km-lb-name">
                  {handle}
                  {isTop && (
                    <span aria-label="most wins" title="most wins">
                      🔥
                    </span>
                  )}
                </div>
                <div className="km-lb-elo">{rateLabel}</div>
                <div>{r.wins}</div>
                <div>{r.losses}</div>
                <div>{r.draws}</div>
                <div>{r.gamesPlayed}</div>
              </div>
            );
          });
        })()}
      </div>
      <div className="km-lb-foot">
        <span className="km-lb-note">
          entry is automatic. there is no signup to lose.
        </span>
        {empty && (
          <Link
            className="km-btn km-btn-primary km-btn-sm"
            href={getAgentPath(FEATURED_AGENT.id)}
          >
            be the first →
          </Link>
        )}
      </div>
    </section>
  );
}

// ── Wins Gallery (AI destroys humans) ──────────────────────────
export function WinsGallery() {
  const games = [
    {
      opp: "anon_8821",
      moves: 24,
      time: "2m 14s",
      verdict: "double jump, move 19",
      cap: 8,
    },
    {
      opp: "stefan.k",
      moves: 31,
      time: "4m 02s",
      verdict: "triple in the center",
      cap: 11,
    },
    {
      opp: "grandma64",
      moves: 18,
      time: "1m 47s",
      verdict: "forced zugzwang",
      cap: 9,
    },
    {
      opp: "ml_intern",
      moves: 42,
      time: "6m 09s",
      verdict: "two crowns, then cleanup",
      cap: 10,
    },
  ];
  return (
    <section className="km-section km-gallery" data-screen-label="04 Wins">
      <SectionHead
        kicker="recent losses · other peoples'"
        title="The machine has been busy."
        sub="A sample of the last 24 hours. These are real games. The annotations are Sinza's own post-game commentary."
      />
      <div className="km-gallery-grid">
        {games.map((g, i) => (
          <div key={i} className="km-game-card">
            <MiniBoard seed={i * 13 + 7} />
            <div className="km-gcard-body">
              <div className="km-gcard-row">
                <span className="km-gcard-label">vs</span>
                <span className="km-gcard-opp">{g.opp}</span>
                <span className="km-gcard-result">W</span>
              </div>
              <div className="km-gcard-verdict">&ldquo;{g.verdict}&rdquo;</div>
              <div className="km-gcard-stats">
                <span>{g.moves} moves</span>
                <span>·</span>
                <span>{g.time}</span>
                <span>·</span>
                <span>{g.cap} captured</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildMiniBoard(seed: number): number[][] {
  let s = seed;
  const board: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  let reds = 0,
    blacks = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue;
      s = (s * 9301 + 49297) % 233280;
      const v = s / 233280;
      if (r < 3 && v < 0.55 && blacks < 9) {
        board[r][c] = 3;
        blacks++;
      } else if (r > 4 && v < 0.35 && reds < 5) {
        board[r][c] = 1;
        reds++;
      } else if (r >= 3 && r <= 4 && v < 0.2) {
        board[r][c] = v < 0.1 ? 4 : 3;
        blacks++;
      }
    }
  }
  return board;
}

// deterministic pseudo-board for the wins gallery thumbnails
function MiniBoard({ seed = 0 }: { seed?: number }) {
  const b = useMemo(() => buildMiniBoard(seed), [seed]);
  return (
    <div className="km-mini-board">
      {b.map((row, r) =>
        row.map((p, c) => (
          <div
            key={`${r}-${c}`}
            className={
              "km-mini-cell " +
              ((r + c) % 2 === 1 ? "km-mini-dark" : "km-mini-light")
            }
          >
            {p !== 0 && (
              <div
                className={
                  "km-mini-piece " +
                  (p === 1 || p === 2 ? "km-mini-red" : "km-mini-black") +
                  (p === 2 || p === 4 ? " km-mini-king" : "")
                }
              />
            )}
          </div>
        )),
      )}
    </div>
  );
}

// ── How it's trained ───────────────────────────────────────────
export function HowItWorks() {
  return (
    <section className="km-section km-how" data-screen-label="05 How">
      <SectionHead
        kicker="for the ml people"
        title="No engines. No books. No kidding."
        sub="Every agent on kingme is a neural network we trained end-to-end on self-play. The policy picks a move. A tree search makes it better. That's it."
      />
      <div className="km-how-grid">
        <div className="km-how-card">
          <div className="km-how-num">01</div>
          <div className="km-how-title">Play yourself, a lot</div>
          <div className="km-how-body">
            Two copies of a random network play each other until one stumbles
            into winning. Repeat ~14 million times.
          </div>
          <div className="km-how-code">
            <pre>{`for step in range(14_000_000):
  game = SelfPlay(net, search_sims=400)
  replay.push(game.trajectory)
  if step % 2048 == 0:
    net.train(replay.sample(1024))`}</pre>
          </div>
        </div>
        <div className="km-how-card">
          <div className="km-how-num">02</div>
          <div className="km-how-title">Search at inference</div>
          <div className="km-how-body">
            At game time the bot runs MCTS guided by the network. More sims =
            stronger play. The difficulty dial is literally the number of
            simulations per move.
          </div>
          <div className="km-how-code">
            <pre>{`easy:   sims=8      (≈ plays itself in 80ms)
normal: sims=120    (≈ thinks for half a second)
hard:   sims=1600   (≈ it's not thinking about you)`}</pre>
          </div>
        </div>
        <div className="km-how-card">
          <div className="km-how-num">03</div>
          <div className="km-how-title">Ship it, loop it</div>
          <div className="km-how-body">
            Every human game goes back into a replay buffer. The bot that beat
            you yesterday is smaller than the one you play today.
          </div>
          <div className="km-how-code">
            <pre>{`v1  → 1.7M games      (jan)
v2  → +4.2M games     (feb)
v3  → +8.1M games     (now) ← you are here
v4  → soon`}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Submit your agent ──────────────────────────────────────────
export function SubmitAgent() {
  return (
    <section className="km-section km-submit" data-screen-label="06 Submit">
      <div className="km-submit-wrap">
        <div className="km-submit-left">
          <div className="km-kicker">
            <span className="km-kicker-dot" />
            coming soon · for developers
          </div>
          <h2 className="km-h2">
            Bring your own agent.
            <br />
            <span className="km-accent-text">Let it fight.</span>
          </h2>
          <p className="km-lede">
            Soon: train a model, upload a checkpoint, let it enter the ring.
            Your agent plays ours. Your agent plays everyone else&apos;s. The
            leaderboard sorts it out.
          </p>
          <ul className="km-submit-list">
            <li>
              <span className="km-check">▸</span> docker image, one entrypoint,
              standard protocol
            </li>
            <li>
              <span className="km-check">▸</span> wall-clock budget per move,
              enforced
            </li>
            <li>
              <span className="km-check">▸</span> tournaments every sunday night
            </li>
            <li>
              <span className="km-check">▸</span> prize pool, eventually
            </li>
          </ul>
          <div className="km-submit-ctas">
            <button className="km-btn km-btn-primary">get early access</button>
            <button className="km-btn km-btn-ghost">read the spec</button>
          </div>
        </div>
        <div className="km-submit-right">
          <div className="km-terminal">
            <div className="km-term-header">
              <span className="km-term-dot" />
              <span className="km-term-dot" />
              <span className="km-term-dot" />
              <span className="km-term-title">submit.sh</span>
            </div>
            <pre className="km-term-body">
              <span className="km-term-prompt">$</span>{" "}
              <span className="km-term-cmd">kingme</span> push my-agent:v0.4
              {"\n"}
              <span className="km-term-muted">
                → validating entrypoint ………… ok
              </span>
              {"\n"}
              <span className="km-term-muted">
                → running sanity games ……… 50/50
              </span>
              {"\n"}
              <span className="km-term-muted">
                → estimated elo ………………… 1840 ± 40
              </span>
              {"\n"}
              <span className="km-term-muted">
                → queued for sunday&apos;s bracket
              </span>
              {"\n"}
              {"\n"}
              <span className="km-term-prompt">$</span>{" "}
              <span className="km-term-cmd">kingme</span> watch my-agent{"\n"}
              <span className="km-term-muted">round 1 ·</span> my-agent{" "}
              <span className="km-accent-text">W</span> vs anon_8821{"\n"}
              <span className="km-term-muted">round 2 ·</span> my-agent{" "}
              <span className="km-term-red">L</span> vs{" "}
              <span className="km-term-muted">sinza-v3</span>
              {"\n"}
              <span className="km-term-muted">round 3 ·</span> my-agent{" "}
              <span className="km-accent-text">W</span> vs threefold{"\n"}
              <span className="km-term-cursor">▋</span>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────
export function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  return (
    <footer className="km-footer" data-screen-label="07 Footer">
      <div className="km-footer-top">
        <div className="km-footer-brand">
          <div className="km-logo-big">
            kingme<span className="km-logo-dot">.</span>dev
          </div>
          <p className="km-footer-tag">
            the machines are smarter than you and they know it.
          </p>
        </div>
        <div className="km-footer-sub">
          <div className="km-sub-label">get told when we ship chess.</div>
          <form
            className="km-sub-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (email) setSubscribed(true);
            }}
          >
            <input
              type="email"
              placeholder="you@domain.lose"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="km-sub-input"
              required
            />
            <button className="km-sub-btn" type="submit">
              {subscribed ? "✓ on the list" : "notify me"}
            </button>
          </form>
        </div>
      </div>
      <div className="km-footer-bot">
        <div>© 2026 kingme labs · trained in a bedroom</div>
        <div>
          built by{" "}
          <a
            className="km-footer-link"
            href="https://x.com/elisha_bulalu"
            target="_blank"
            rel="noopener noreferrer"
          >
            bulalu
          </a>{" "}
          ·{" "}
          <a
            className="km-footer-link km-footer-gh"
            href="https://github.com/Bulalu/kingme"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="kingme on GitHub"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            source
          </a>{" "}
          · made to lose gracefully (you, not us)
        </div>
      </div>
    </footer>
  );
}

// ── SectionHead helper ─────────────────────────────────────────
function SectionHead({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: ReactNode;
  sub?: string;
}) {
  return (
    <div className="km-section-head">
      <div className="km-kicker">
        <span className="km-kicker-dot" />
        {kicker}
      </div>
      <h2 className="km-h2">{title}</h2>
      {sub && <p className="km-lede">{sub}</p>}
    </div>
  );
}
