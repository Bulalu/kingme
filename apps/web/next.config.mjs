import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin Turbopack to the monorepo root so it doesn't pick up an unrelated
  // lockfile elsewhere on disk.
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
