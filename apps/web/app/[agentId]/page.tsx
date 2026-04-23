import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Arena from "@/components/arena/Arena";
import "@/components/arena/arena.css";
import {
  PLAYABLE_AGENTS,
  getPlayableAgentProfile,
} from "@/lib/agents";

type AgentPageProps = {
  params: Promise<{ agentId: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return PLAYABLE_AGENTS.map((agent) => ({ agentId: agent.id }));
}

export async function generateMetadata({
  params,
}: AgentPageProps): Promise<Metadata> {
  const { agentId } = await params;
  const agent = getPlayableAgentProfile(agentId);
  if (!agent) return {};
  return { title: agent.metadataTitle };
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { agentId } = await params;
  const agent = getPlayableAgentProfile(agentId);
  if (!agent) notFound();
  return <Arena agent={agent} />;
}
