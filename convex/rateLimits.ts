import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

// Per-anonId rate limits for the write mutations. Numbers are tuned for
// "generous for legit play, painful for a script." A legit player only
// calls upsert/setName a handful of times per session, starts one game
// per session, and completes it once (plus maybe one forfeit from LEAVE).
//
// Token-bucket lets bursts happen (a rapid-fire rematch cycle won't trip)
// while keeping the long-run rate bounded. Capacity defaults to `rate`.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  upsertPlayer: { kind: "token bucket", rate: 5, period: MINUTE },
  setName: { kind: "token bucket", rate: 5, period: MINUTE },
  startGame: { kind: "token bucket", rate: 10, period: MINUTE },
  completeGame: { kind: "token bucket", rate: 30, period: MINUTE },
});
