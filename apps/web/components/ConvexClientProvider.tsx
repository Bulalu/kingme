"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

// Lazily instantiated so SSR builds don't crash if the env var isn't set
// yet (e.g. during the very first `pnpm build` before `npx convex dev`
// has been run on a fresh checkout).
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    // Convex isn't configured — render the app without the provider so
    // pages that don't use Convex still load. Hooks like useQuery will
    // throw if called from inside a Convex-less subtree, which is
    // surfaced clearly during development.
    return <>{children}</>;
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
