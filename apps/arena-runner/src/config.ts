import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ArenaProfile } from "@kingme/shared/arena";
import { ARENA_DEFAULT_TURN_TIMEOUT_MS } from "@kingme/shared/arena-prompt";

export interface RunnerEnv {
  openRouterApiKey: string;
  engineBaseUrl: string;
  openRouterReferer?: string;
  openRouterAppTitle?: string;
}

export function loadEnv(): RunnerEnv {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy apps/arena-runner/.env.example to .env.local and fill it in.",
    );
  }
  return {
    openRouterApiKey,
    engineBaseUrl:
      process.env.ENGINE_BASE_URL ?? "https://ctrlx--kingme-engine-api.modal.run",
    openRouterReferer: process.env.OPENROUTER_HTTP_REFERER,
    openRouterAppTitle: process.env.OPENROUTER_APP_TITLE,
  };
}

export interface PersistEnv {
  convexUrl: string;
  adminSecret: string;
}

export function loadPersistEnv(): PersistEnv {
  const convexUrl = process.env.CONVEX_URL;
  const adminSecret = process.env.ARENA_ADMIN_SECRET;
  if (!convexUrl || !adminSecret) {
    throw new Error(
      "--persist requires CONVEX_URL and ARENA_ADMIN_SECRET. Set them in .env.local. Run `npx convex env set ARENA_ADMIN_SECRET <value>` on the deployment too.",
    );
  }
  return { convexUrl, adminSecret };
}

// Minimal profile shape expected on disk. Missing fields get sensible
// defaults so profile JSON files stay small.
interface ProfileFile {
  profileId?: string;
  displayName: string;
  provider?: "openrouter";
  model: string;
  promptVersion?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  gameKey?: "checkers";
  variantKey?: "tanzanian-8x8";
}

export async function loadProfile(path: string): Promise<ArenaProfile> {
  const absolute = resolve(process.cwd(), path);
  const raw = await readFile(absolute, "utf8");
  const parsed = JSON.parse(raw) as ProfileFile;
  if (!parsed.displayName || !parsed.model) {
    throw new Error(`profile ${path} is missing required fields (displayName, model)`);
  }
  const now = Date.now();
  return {
    profileId: parsed.profileId ?? parsed.model,
    displayName: parsed.displayName,
    provider: parsed.provider ?? "openrouter",
    model: parsed.model,
    promptVersion: parsed.promptVersion ?? "checkers-move-selection-v1",
    temperature: parsed.temperature ?? 0,
    maxOutputTokens: parsed.maxOutputTokens ?? 64,
    timeoutMs: parsed.timeoutMs ?? ARENA_DEFAULT_TURN_TIMEOUT_MS,
    enabled: true,
    public: false,
    gameKey: parsed.gameKey ?? "checkers",
    variantKey: parsed.variantKey ?? "tanzanian-8x8",
    createdAt: now,
    updatedAt: now,
  };
}
