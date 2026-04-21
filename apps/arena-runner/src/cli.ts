import { parseArgs } from "node:util";

import { createOpenRouterAdapter } from "./adapters/openrouter.js";
import { loadEnv, loadProfile } from "./config.js";
import { createEngineClient } from "./engineClient.js";
import { runMatch } from "./runner.js";

function printUsageAndExit(code: number): never {
  console.error(
    [
      "Usage: pnpm --filter @kingme/arena-runner run match -- --red <profile.json> --white <profile.json> [--max-plies N] [--out path.json]",
      "",
      "Example:",
      "  pnpm --filter @kingme/arena-runner run match -- \\",
      "    --red apps/arena-runner/profiles/openai-gpt-4o-mini.json \\",
      "    --white apps/arena-runner/profiles/anthropic-claude-haiku.json",
    ].join("\n"),
  );
  process.exit(code);
}

async function main(): Promise<void> {
  // pnpm forwards its own `--` as a literal arg; strip it before parsing.
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const { values } = parseArgs({
    args: argv,
    options: {
      red: { type: "string" },
      white: { type: "string" },
      "max-plies": { type: "string" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) printUsageAndExit(0);
  if (!values.red || !values.white) {
    console.error("error: --red and --white are required\n");
    printUsageAndExit(2);
  }

  const env = loadEnv();
  const [redProfile, whiteProfile] = await Promise.all([
    loadProfile(values.red),
    loadProfile(values.white),
  ]);

  const adapter = createOpenRouterAdapter({
    apiKey: env.openRouterApiKey,
    httpReferer: env.openRouterReferer,
    appTitle: env.openRouterAppTitle,
  });
  const engine = createEngineClient(env.engineBaseUrl);

  const maxPlies = values["max-plies"]
    ? Number.parseInt(values["max-plies"], 10)
    : undefined;
  if (maxPlies !== undefined && (!Number.isFinite(maxPlies) || maxPlies <= 0)) {
    console.error("error: --max-plies must be a positive integer");
    process.exit(2);
  }

  const result = await runMatch({
    engine,
    adapter,
    redProfile,
    whiteProfile,
    transcriptPath: values.out,
    maxPlies,
  });

  if (result.status === "failed") {
    process.exit(1);
  }
  if (result.status === "aborted") {
    process.exit(3);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
