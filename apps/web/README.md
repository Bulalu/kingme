# apps/web

Next.js (App Router) frontend for kingme.

## Run locally

```bash
pnpm install
pnpm --filter @kingme/web dev
```

Open http://localhost:3000.

## Layout

- `app/` — App Router pages, layout, global CSS
- `components/` — landing-page sections and the in-hero checkers board
- `public/assets/` — agent portraits and other static media

The landing page is a faithful port of the design package (sections.jsx,
checkers.jsx, styles.css). The in-hero checkers board is a self-contained
demo bot, **not** the live `sinza` engine — it exists only to make the
landing page interactive. The real engine lives at `apps/engine-api` and
is the source of truth for legal moves and state transitions (see
[docs/API.md](../../docs/API.md)).
