# @kingme/arena-runner

Manual CLI harness that runs one LLM-vs-LLM checkers match end-to-end
against the kingme engine API and writes a JSON transcript locally.

This is Phase 1 of [docs/llm-arena-roadmap.md](../../docs/llm-arena-roadmap.md):
no Convex, no UI, no public surface. It exists to prove that:

- the prompt shape works
- models reliably select legal moves
- the engine loop is stable
- cost and latency are acceptable

## Setup

`OPENROUTER_API_KEY` is loaded from either `.env.local` at the repo
root or `apps/arena-runner/.env.local` (package-local takes precedence
if both exist). Use whichever fits your existing env layout.

```bash
cp apps/arena-runner/.env.example apps/arena-runner/.env.local
# set OPENROUTER_API_KEY in the file
pnpm install
```

## Run a match

Invoke from the repo root. Profile paths are resolved relative to
`apps/arena-runner/` (pnpm's `--filter` runs the script with that as
cwd), so `profiles/foo.json` is the common form:

```bash
pnpm --filter @kingme/arena-runner run match \
  --red profiles/openai-gpt-4o-mini.json \
  --white profiles/anthropic-claude-haiku.json
```

Flags:

- `--red <path>` — profile JSON for the red (top) side. **Required.**
- `--white <path>` — profile JSON for the white (bottom) side. **Required.**
- `--max-plies <N>` — hard ply cap (default 300).
- `--out <path>` — transcript path (default `transcripts/<matchId>.json`).
- `--persist` — also write the match + plies to Convex via the admin
  wrappers. Requires `CONVEX_URL` and `ARENA_ADMIN_SECRET` in the env,
  and the same secret set on the deployment via
  `npx convex env set ARENA_ADMIN_SECRET <value>`. Persistence is
  best-effort: the first Convex error logs and disables further
  writes for that match, so a broken Convex cannot kill an otherwise
  valid local run. The JSON transcript is always written.

Engine colors `red` and `white` match the Python engine API exactly. The
web UI's red/black mapping is a view-layer concern and does not apply
here.

## Profiles

A profile pins the exact model identity used for a side:

```json
{
  "profileId": "openai-gpt-4o-mini-checkers-v1",
  "displayName": "gpt-4o-mini",
  "provider": "openrouter",
  "model": "openai/gpt-4o-mini",
  "promptVersion": "checkers-move-selection-v1",
  "temperature": 0,
  "maxOutputTokens": 64,
  "timeoutMs": 30000,
  "gameKey": "checkers",
  "variantKey": "tanzanian-8x8"
}
```

Add new profiles under `apps/arena-runner/profiles/` and pass the path
on the CLI. Prompt version, temperature, and timeout are pinned per
profile because changing any of them can change playing strength — the
profile fields also land on the match transcript so a replay describes
the exact configuration used.

## Failure policy

- **Invalid JSON / illegal move** — one repair attempt, then `failed`
  with `terminationReason = "protocol_violation"`.
- **Provider timeout / network error** — one bounded retry, then the
  match is `aborted` with `terminationReason = "provider_timeout"` or
  `"provider_error"`.
- **Engine / runner crash** — `failed` with `"runner_error"`.

Match exit codes:

- `0` — completed (either winner or max plies).
- `1` — failed (model protocol violation or runner error).
- `3` — aborted (provider timeout or outage).

## Transcript

Each match writes a single JSON file with participants, initial/final
state, and one entry per ply containing `stateBefore`, `stateAfter`,
the chosen PDN, latency, token usage, and the raw model output. That
is enough to replay the match or debug a bad turn without rerunning
inference.

## What this runner does NOT do

- Persist anything to Convex — Phase 2.
- Show the match in the web UI — Phase 3.
- Group matches into batches or compute standings — Phase 4.
- Speak to OpenAI / Anthropic directly — everything goes through
  OpenRouter for now.
