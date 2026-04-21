import type {
  ApplyMoveResponse,
  LegalMovesResponse,
  StatePayload,
} from "@kingme/shared/engine";

export interface EngineClient {
  readonly baseUrl: string;
  getInitialState(signal?: AbortSignal): Promise<StatePayload>;
  getLegalMoves(state: StatePayload, signal?: AbortSignal): Promise<LegalMovesResponse>;
  applyMove(
    state: StatePayload,
    movePdn: string,
    signal?: AbortSignal,
  ): Promise<ApplyMoveResponse>;
}

export class EngineError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`engine ${path} ${status}: ${body || "no body"}`);
    this.name = "EngineError";
  }
}

export function createEngineClient(baseUrl: string): EngineClient {
  const normalized = baseUrl.replace(/\/+$/, "");

  async function request<T>(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<T> {
    const res = await fetch(`${normalized}${path}`, {
      ...init,
      signal,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new EngineError(path, res.status, body);
    }
    return (await res.json()) as T;
  }

  return {
    baseUrl: normalized,
    getInitialState: (signal) =>
      request<StatePayload>("/v1/state/initial", { method: "GET" }, signal),
    getLegalMoves: (state, signal) =>
      request<LegalMovesResponse>(
        "/v1/state/legal-moves",
        { method: "POST", body: JSON.stringify({ state }) },
        signal,
      ),
    applyMove: (state, movePdn, signal) =>
      request<ApplyMoveResponse>(
        "/v1/state/apply-move",
        { method: "POST", body: JSON.stringify({ state, move_pdn: movePdn }) },
        signal,
      ),
  };
}
