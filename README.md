# kingme

[![Live at kingme.dev](https://img.shields.io/badge/live-kingme.dev-ff4b2b)](https://kingme.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

`kingme` is a home for AI game agents — a place where agents get served, promoted, and then play humans or each other across different games.

![Kingme roster concept](docs/assets/kingme-roster-concept.png)

The goal is simple:

- a roster of strong playable agents across multiple games
- a polished web experience
- a clean separation between product code and engine/training code

This repo is where the product gets assembled. The heavy experimentation still happens in separate engine lab repos, and `kingme` consumes the strongest released engine configurations from that work for actual play.

**Try it**: [kingme.dev/sinza](https://kingme.dev/sinza) — no sign-up.

## What Powers Sinza Today

`sinza` is currently served through our Python engine API and runs on a tuned alpha-beta search engine at depth 7, playing the Tanzanian-style 8×8 draughts variant (flying kings, mandatory captures, captures remain on the board until a multi-jump sequence completes).

We also keep a separate research/training stack where we experiment with self-play, neural guidance, and future checkpoint-backed agents. That research path has not been promoted into production yet.

Today that means:

- the web app is the player-facing experience
- Convex owns product state and realtime app data (players, games, leaderboard)
- the Python `engine-api` owns legal moves, state transitions, and bot replies
- checkers is the first live game, not the only planned one
- `sinza` is just the first public agent, not the last one

## What this repo is (and isn't)

**Is:**

- the product layer for human-vs-agent and agent-vs-agent play
- brand + gameplay UX
- the serving runtime for released engine agents (legal-move generation, state transitions)
- app-state orchestration (sessions, records, leaderboards)

**Isn't:**

- the training repo. Teacher data, checkpoints, self-play loops, benchmark scripts — all that lives in a separate lab repo. PRs that retrain or re-tune the model won't land here.
- a general-purpose checkers library. The engine implements one specific variant (Tanzanian-style) and serves one specific agent runtime.

## Stack

- **Web**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, hosted on Vercel
- **Realtime + data**: [Convex](https://convex.dev)
- **Engine API**: FastAPI + Python, deployed on [Modal](https://modal.com)
- **Monorepo**: pnpm workspaces

## Repo layout

```text
apps/
  web/          Next.js product app and marketing site
  engine-api/   Python engine/inference service
packages/
  ui/           Shared React UI primitives and board components
  shared/       Shared TypeScript contracts and helpers
  content/      Static content, agent metadata, copy, and config
convex/         Convex app backend: schema + queries + mutations + crons
docs/           Architecture and API contract
```

Intent:

- `apps/web` owns the player-facing app and brand experience.
- `apps/engine-api` owns bot move generation and engine orchestration.
- `convex/` owns app state, realtime subscriptions, player/game records, leaderboards.
- `packages/*` hold reusable code that should not live inside one app.

## Run it locally

### Prerequisites

- Node 20+, pnpm 10+
- Python 3.11+ (only if you're hacking on the engine)
- A free [Convex](https://convex.dev) account

### Web + Convex

```bash
# 1. install JS deps
pnpm install

# 2. provision a Convex dev deployment (interactive — pick a team/project)
npx convex dev --once --configure

# 3. run the Convex function sync + dev server in one terminal
npx convex dev

# 4. run the Next.js app in another terminal
pnpm --filter @kingme/web dev
```

Open http://localhost:3000 — the landing page reads live counters from your Convex dev deployment. `/sinza` opens the play view, which by default hits our public engine at `https://ctrlx--kingme-engine-api.modal.run`. Override by setting `NEXT_PUBLIC_ENGINE_BASE_URL` in `apps/web/.env.local` if you're running the engine yourself.

### Engine API (optional)

You only need this if you're changing engine behaviour. See [apps/engine-api/README.md](apps/engine-api/README.md) for Modal setup and local dev instructions.

## Docs

- [docs/architecture.md](docs/architecture.md) — overall repo split and rollout order
- [docs/engine.md](docs/engine.md) — how the serving engine works and why it's separate from training
- [docs/API.md](docs/API.md) — request/response contract for the engine API
- [docs/llm-arena-roadmap.md](docs/llm-arena-roadmap.md) — incremental plan for the manual model-vs-model arena, live UI, and replay storage

## Contributing

Issues and PRs welcome. For anything non-trivial, open an issue first so we can agree on the approach before you spend time on a diff. Read [CLAUDE.md](CLAUDE.md) to understand the constraints the serving side follows (e.g. the engine API is the source of truth for move legality, not the frontend).

## License

[MIT](LICENSE) © Bulalu
