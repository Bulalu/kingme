# kingme

Monorepo for the `kingme` product.

Initial structure:

```text
apps/
  web/          Next.js product app and marketing site
  engine-api/   Python engine/inference service
packages/
  ui/           Shared React UI primitives and board components
  shared/       Shared TypeScript contracts and helpers
  content/      Static content, agent metadata, copy, and config
convex/         Convex app backend code (no schema scaffolded yet)
docs/           Architecture and delivery notes
```

Current intention:

- `apps/web` owns the player-facing app and brand experience.
- `apps/engine-api` owns bot move generation and engine orchestration.
- `convex` owns app state, realtime subscriptions, sessions, and leaderboards.
- `packages/*` hold reusable code that should not live inside one app.

See [docs/architecture.md](/Users/elishabulalu/Desktop/kingme/docs/architecture.md) for the recommended split and rollout order.

