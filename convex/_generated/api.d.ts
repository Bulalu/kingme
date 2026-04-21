/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as arenaAdmin from "../arenaAdmin.js";
import type * as arenaMatches from "../arenaMatches.js";
import type * as arenaPlies from "../arenaPlies.js";
import type * as arenaValidators from "../arenaValidators.js";
import type * as crons from "../crons.js";
import type * as games from "../games.js";
import type * as players from "../players.js";
import type * as rateLimits from "../rateLimits.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  arenaAdmin: typeof arenaAdmin;
  arenaMatches: typeof arenaMatches;
  arenaPlies: typeof arenaPlies;
  arenaValidators: typeof arenaValidators;
  crons: typeof crons;
  games: typeof games;
  players: typeof players;
  rateLimits: typeof rateLimits;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
