// Anonymous identity for kingme.
//
// We don't have real auth yet. Each browser gets a stable random UUID
// stored in localStorage; that uuid maps 1:1 to a `players` row in
// Convex. Clearing storage = a fresh player. Optional name attached to
// the row turns it into a "mini profile".

const ANON_ID_KEY = "kingme:anonId";

export function getOrCreateAnonId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(ANON_ID_KEY);
  if (existing) return existing;
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `anon_${Math.random().toString(36).slice(2, 12)}`;
  window.localStorage.setItem(ANON_ID_KEY, fresh);
  return fresh;
}

// Cocky meme-name fallback for players who skip the name prompt. Keeps
// the leaderboard from being a wall of "anon_*".
const ADJECTIVES = [
  "kingless",
  "doomed",
  "drunk",
  "mid",
  "polite",
  "spooked",
  "loud",
  "loose",
  "cooked",
  "stuck",
  "tilted",
  "chatty",
];
const NOUNS = [
  "rookie",
  "pawn",
  "regret",
  "challenger",
  "intern",
  "tourist",
  "draft",
  "experiment",
  "victim",
  "scholar",
  "guess",
  "promise",
];

export function generateMemeName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const tag = Math.floor(1000 + Math.random() * 9000);
  return `${a}_${n}_${tag}`;
}
