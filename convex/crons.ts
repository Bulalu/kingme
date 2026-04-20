import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sweep for unfinished games older than ABANDON_THRESHOLD_MS (30 min) and
// mark them as agent wins. Keeps the leaderboard + counters honest when a
// player closes the tab, loses network, or just walks away.
crons.interval(
  "forfeit abandoned games",
  { minutes: 15 },
  internal.games.forfeitAbandoned,
  {},
);

export default crons;
