# @kingme/shared

Canonical TypeScript contracts used across the kingme workspace.

- `engine` — payload types that mirror `apps/engine-api/src/kingme_engine_api/schemas.py` exactly. The Python engine API is the source of truth; this file must track it field-for-field.
- `arena` — LLM arena domain types (profiles, matches, plies, status enums). Game-agnostic where possible; checkers-specific pieces are marked.
- `arena-prompt` — prompt input/output schema, model adapter interface, and failure policy for the arena runner.

Consumers import by subpath:

```ts
import type { StatePayload } from "@kingme/shared/engine";
import type { ArenaMatch } from "@kingme/shared/arena";
```
