"use client";

// Landing page sections for kingme.dev
// Ported from the design package (sections.jsx).

import { useMemo, useState, type ReactNode } from "react";
import Board from "./Board";

// ── Hero ───────────────────────────────────────────────────────
export interface HeroProps {
  variant: string;
  accent: string;
  copyVoice: string;
  mode: "demo" | "play";
  setMode: (m: "demo" | "play") => void;
}

export function Hero({ accent, copyVoice, mode, setMode }: HeroProps) {
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
      kicker: "meet sinza · your first problem",
      line1: "KING",
      line2: "ME.",
      sub: "AI agents that trained themselves. Now they're looking for a game.",
      cta: "play sinza",
      cta2: "watch him play himself",
    },
    dry: {
      kicker: "sinza · checkers agent · v3",
      line1: "PLAY",
      line2: "SINZA.",
      sub: "Trained from scratch on self-play. No opening books, no lookup tables — just a network that taught itself checkers.",
      cta: "play sinza",
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
            {/* Arena page isn't built yet — primary CTA is a visual placeholder.
                When arena ships, route this to it instead of toggling mode. */}
            <button className="km-btn km-btn-primary" type="button">
              {`▶ ${t.cta}`}
            </button>
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
            <Stat label="games played vs bot" value="41,287" />
            <Stat label="humans who won" value="3.1%" />
            <Stat label="avg think time" value="0.8s" />
          </div>
        </div>

        <div className="km-hero-right">
          <div className="km-hero-opponent">
            <div className="km-opp-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/sinza.png" alt="Sinza" />
              <div className="km-opp-badge">● LIVE</div>
            </div>
            <div className="km-opp-meta">
              <div className="km-opp-label">your opponent</div>
              <div className="km-opp-name">SINZA</div>
              <div className="km-opp-stats">
                <span>
                  <b>2,418</b> elo
                </span>
                <span>·</span>
                <span>
                  <b>41,287</b> games
                </span>
                <span>·</span>
                <span>
                  <b>96.9%</b> win rate
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
                <span className="km-chrome-title">kingme://sinza/live</span>
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
                <span>agent · sinza-v1 · 61M params</span>
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
    "IT CROWNED ITSELF",
    "★",
    "YOU CAN'T OUT-THINK A THINKING MACHINE",
    "★",
    "41,287 GAMES · 1,279 HUMAN WINS",
    "★",
    "NO OPENING BOOK",
    "★",
    "NO LOOKUP TABLES",
    "★",
    "JUST A NETWORK THAT DIDN'T STOP PLAYING",
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
  const agents = [
    {
      id: "sinza",
      img: "/assets/sinza.png",
      name: "SINZA",
      tagline: "the showman",
      game: "Checkers",
      status: "live" as const,
      elo: "2,418",
      games: "41,287",
      winRate: "96.9%",
      params: "61M",
      version: "v1",
      bio: "Sinza plays fast and talks faster. He learned checkers the only way that matters — fourteen million games against himself — and now he wants yours. He drinks through the whole match. It does not help you.",
      quote: '"king me, then king me again. i can wait."',
      style: "aggressive · loves forced captures",
    },
    {
      id: "manzese",
      img: "/assets/manzese.png",
      name: "MZE MANZESE",
      tagline: "the old man",
      game: "Checkers · grandmaster",
      status: "training" as const,
      elo: "—",
      games: "2.1M",
      winRate: "tbd",
      params: "240M",
      version: "v0.7",
      bio: "Manzese has played the game longer than the game has been a game. He doesn't think. He remembers. Still in training. When he drops, Sinza gets nervous.",
      quote:
        '"the board is mine. the moves are mine. the win? always mine."',
      style: "prophetic · never hurries",
    },
  ];
  return (
    <section className="km-section km-roster" data-screen-label="02 Agents">
      <SectionHead
        kicker="the roster · 02 agents"
        title={
          <>
            Pick your <span className="km-strike">agent</span>{" "}
            <span className="km-accent-text">loss.</span>
          </>
        }
        sub="Every game on kingme gets its own agent — its own training run, its own personality, its own way of making you lose. Here are the first two."
      />
      <div className="km-roster-grid">
        {agents.map((a) => (
          <article key={a.id} className={"km-agent km-agent-" + a.status}>
            <div className="km-agent-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.img} alt={a.name} />
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
                  <button className="km-btn km-btn-primary km-btn-sm">
                    play {a.name.toLowerCase()} →
                  </button>
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
      agent: "sinza, manzese",
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
  const rows = [
    {
      rank: 1,
      name: "silent_queen",
      elo: 2418,
      wins: 89,
      losses: 4,
      streak: 12,
      flag: "owner",
    },
    {
      rank: 2,
      name: "m. polotsky",
      elo: 2377,
      wins: 74,
      losses: 9,
      streak: 6,
      flag: "gm",
    },
    {
      rank: 3,
      name: "threefold",
      elo: 2301,
      wins: 63,
      losses: 11,
      streak: 3,
      flag: "",
    },
    {
      rank: 4,
      name: "h_king_me",
      elo: 2244,
      wins: 58,
      losses: 13,
      streak: 1,
      flag: "",
    },
    {
      rank: 5,
      name: "double_jump",
      elo: 2189,
      wins: 51,
      losses: 18,
      streak: 0,
      flag: "",
    },
    {
      rank: 6,
      name: "crown_seeker",
      elo: 2140,
      wins: 44,
      losses: 20,
      streak: 2,
      flag: "",
    },
    {
      rank: 7,
      name: "not.a.bot",
      elo: 2102,
      wins: 40,
      losses: 22,
      streak: 0,
      flag: "suspect",
    },
  ];
  return (
    <section
      className="km-section km-leaderboard"
      data-screen-label="03 Leaderboard"
    >
      <SectionHead
        kicker="leaderboard · this week"
        title="The 3% who beat it."
        sub="Tournaments are coming. For now, here are the humans who've won more than they've lost."
      />
      <div className="km-lb-wrap">
        <div className="km-lb-header">
          <div>#</div>
          <div>handle</div>
          <div>elo</div>
          <div>w</div>
          <div>l</div>
          <div>streak</div>
        </div>
        {rows.map((r) => (
          <div key={r.name} className="km-lb-row">
            <div className="km-lb-rank">{String(r.rank).padStart(2, "0")}</div>
            <div className="km-lb-name">
              {r.name}
              {r.flag === "owner" && (
                <span className="km-tag km-tag-owner">you?</span>
              )}
              {r.flag === "gm" && <span className="km-tag">gm</span>}
              {r.flag === "suspect" && (
                <span className="km-tag km-tag-warn">sus</span>
              )}
            </div>
            <div className="km-lb-elo">{r.elo}</div>
            <div>{r.wins}</div>
            <div>{r.losses}</div>
            <div>
              {r.streak > 0 ? (
                <span className="km-streak">🔥 {r.streak}</span>
              ) : (
                <span className="km-streak-0">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="km-lb-foot">
        <span className="km-lb-note">
          entry is automatic. there is no signup to lose.
        </span>
        <button className="km-btn km-btn-ghost km-btn-sm">
          see full board →
        </button>
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
