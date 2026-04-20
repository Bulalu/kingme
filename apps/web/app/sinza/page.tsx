import type { Metadata } from "next";
import Arena from "./Arena";
import "./sinza.css";

export const metadata: Metadata = {
  title: "kingme · sinza kijiweni",
};

export default function SinzaPage() {
  return <Arena agentId="sinza" boardStyle="emerald" />;
}
