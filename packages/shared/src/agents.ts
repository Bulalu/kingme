export const RELEASED_AGENT_IDS = ["sinza", "masaki", "tabata"] as const;

export type ReleasedAgentId = (typeof RELEASED_AGENT_IDS)[number];

export interface ReleasedAgentCatalogEntry {
  id: ReleasedAgentId;
  displayName: string;
}

export const RELEASED_AGENT_CATALOG = {
  sinza: {
    id: "sinza",
    displayName: "Sinza",
  },
  masaki: {
    id: "masaki",
    displayName: "Masaki",
  },
  tabata: {
    id: "tabata",
    displayName: "Tabata",
  },
} as const satisfies Record<ReleasedAgentId, ReleasedAgentCatalogEntry>;

export function isReleasedAgentId(value: string): value is ReleasedAgentId {
  return RELEASED_AGENT_IDS.includes(value as ReleasedAgentId);
}

export function getReleasedAgentCatalogEntry(
  agentId: string,
): ReleasedAgentCatalogEntry | null {
  return isReleasedAgentId(agentId) ? RELEASED_AGENT_CATALOG[agentId] : null;
}
