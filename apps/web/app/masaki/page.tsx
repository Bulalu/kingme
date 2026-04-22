import type { Metadata } from "next";
import Arena from "../sinza/Arena";
import "../sinza/sinza.css";

export const metadata: Metadata = {
  title: "kingme · masaki social club",
};

export default function MasakiPage() {
  return <Arena agentId="masaki" boardStyle="rose" />;
}
