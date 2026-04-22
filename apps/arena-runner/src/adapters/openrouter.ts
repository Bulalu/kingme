import type {
  ArenaModelAdapter,
  ArenaModelOutput,
  ArenaModelSelection,
  ArenaPromptInput,
} from "@kingme/shared/arena-prompt";

import { ARENA_MAX_SAY_CHARS } from "@kingme/shared/arena-prompt";

import {
  arenaMoveOutputJsonSchema,
  buildChatMessages,
} from "../prompts/checkersMoveSelection.js";

export interface OpenRouterAdapterConfig {
  apiKey: string;
  httpReferer?: string;
  appTitle?: string;
  baseUrl?: string;
}

export class OpenRouterError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`openrouter ${status}: ${body.slice(0, 500)}`);
    this.name = "OpenRouterError";
  }
}

export class OpenRouterProtocolError extends Error {
  constructor(message: string, public readonly rawOutput: string) {
    super(message);
    this.name = "OpenRouterProtocolError";
  }
}

// Transport-layer failure: DNS, TLS, connection reset, offline. fetch()
// throws these as TypeError instead of returning an HTTP response, so
// they'd otherwise skip the provider retry gate in runner.ts and get
// misclassified as a runner bug.
export class OpenRouterNetworkError extends Error {
  constructor(message: string, public readonly cause: Error) {
    super(`openrouter transport: ${message}`);
    this.name = "OpenRouterNetworkError";
  }
}

interface ChatCompletionResponse {
  id?: string;
  choices: Array<{
    message: { content: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface ParsedModelOutput {
  movePdn: string;
  say: string | null;
}

// Lenient parser. `say` is defence-in-depth — the JSON schema already
// caps length on the provider side, but models that ignore strict mode
// can send back anything, and we normalize here: absent -> null, empty
// string -> null, over-long -> truncated.
function parseArenaOutput(raw: string): ParsedModelOutput {
  const trimmed = raw.trim();
  const tryParse = (s: string): ArenaModelOutput | null => {
    try {
      const obj = JSON.parse(s) as unknown;
      if (
        obj &&
        typeof obj === "object" &&
        "move_pdn" in obj &&
        typeof (obj as Record<string, unknown>).move_pdn === "string"
      ) {
        const rec = obj as Record<string, unknown>;
        const sayVal = rec.say;
        const say =
          typeof sayVal === "string" && sayVal.length > 0 ? sayVal : null;
        return { move_pdn: rec.move_pdn as string, say };
      }
    } catch {
      // fall through
    }
    return null;
  };

  const from = (parsed: ArenaModelOutput): ParsedModelOutput => ({
    movePdn: parsed.move_pdn,
    say:
      parsed.say === null
        ? null
        : parsed.say.slice(0, ARENA_MAX_SAY_CHARS),
  });

  const direct = tryParse(trimmed);
  if (direct) return from(direct);

  // Fallback: first {...} block in the string.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const fromBraces = tryParse(trimmed.slice(start, end + 1));
    if (fromBraces) return from(fromBraces);
  }

  throw new OpenRouterProtocolError("model output is not valid arena JSON", raw);
}

export function createOpenRouterAdapter(
  config: OpenRouterAdapterConfig,
): ArenaModelAdapter {
  const base = (config.baseUrl ?? "https://openrouter.ai/api/v1").replace(
    /\/+$/,
    "",
  );

  return {
    async selectMove(input: ArenaPromptInput): Promise<ArenaModelSelection> {
      const messages = buildChatMessages(input);
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        input.profile.timeoutMs,
      );
      const started = performance.now();

      try {
        let res: Response;
        try {
          res = await fetch(`${base}/chat/completions`, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${config.apiKey}`,
              ...(config.httpReferer ? { "http-referer": config.httpReferer } : {}),
              ...(config.appTitle ? { "x-title": config.appTitle } : {}),
            },
            body: JSON.stringify({
              model: input.profile.model,
              temperature: input.profile.temperature,
              max_tokens: input.profile.maxOutputTokens,
              // Forwarded verbatim to OpenRouter's `reasoning` field;
              // the provider routes it to each model's native control
              // (effort for OpenAI, max_tokens for Anthropic thinking,
              // etc.). Omitting it uses OpenRouter's defaults.
              ...(input.profile.reasoning
                ? { reasoning: input.profile.reasoning }
                : {}),
              messages,
              response_format: {
                type: "json_schema",
                json_schema: arenaMoveOutputJsonSchema,
              },
            }),
          });
        } catch (err) {
          // AbortError from the timeout controller propagates untouched so
          // runner.ts maps it to `provider_timeout`. Every other throw from
          // fetch is a transport failure (DNS, TLS, connection reset,
          // offline) and must go through the provider retry gate.
          if (err instanceof Error && err.name === "AbortError") throw err;
          throw new OpenRouterNetworkError(
            err instanceof Error ? err.message : String(err),
            err instanceof Error ? err : new Error(String(err)),
          );
        }

        const latencyMs = Math.round(performance.now() - started);

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new OpenRouterError(res.status, body);
        }

        const data = (await res.json()) as ChatCompletionResponse;
        const content = data.choices?.[0]?.message?.content ?? "";
        const { movePdn, say } = parseArenaOutput(content);

        return {
          movePdn,
          say,
          latencyMs,
          rawOutput: content,
          providerRequestId: data.id,
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
            totalTokens: data.usage?.total_tokens,
          },
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
