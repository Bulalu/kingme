import type { Metadata } from "next";
import Arena from "./Arena";
import "./arena.css";

export const metadata: Metadata = {
  title: "kingme · arena",
};

export default function ArenaPage() {
  return <Arena agentId="sinza" boardStyle="emerald" />;
}
