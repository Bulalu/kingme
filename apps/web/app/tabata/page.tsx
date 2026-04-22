import type { Metadata } from "next";
import Arena from "../sinza/Arena";
import "../sinza/sinza.css";

export const metadata: Metadata = {
  title: "kingme · tabata supper room",
};

export default function TabataPage() {
  return <Arena agentId="tabata" boardStyle="emerald" />;
}
