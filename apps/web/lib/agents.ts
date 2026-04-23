import {
  RELEASED_AGENT_CATALOG,
  RELEASED_AGENT_IDS,
  isReleasedAgentId,
  type ReleasedAgentId,
} from "@kingme/shared/agents";

export interface BoardStyle {
  label: string;
  light: string;
  dark: string;
  frame: string;
  frame2: string;
  pieceDark: string;
}

export const BOARD_STYLES = {
  emerald: {
    label: "emerald felt",
    light: "#ead9b0",
    dark: "#3a5a3a",
    frame: "#1a120a",
    frame2: "#3a2414",
    pieceDark: "ink",
  },
  rose: {
    label: "rose velvet",
    light: "#f2d7de",
    dark: "#8f4f69",
    frame: "#241116",
    frame2: "#512433",
    pieceDark: "ink",
  },
} as const satisfies Record<string, BoardStyle>;

export type BoardStyleId = keyof typeof BOARD_STYLES;

interface AgentProfileBase {
  id: string;
  displayName: string;
  name: string;
  tagline: string;
  venue: string;
  metadataTitle: string;
  img: string;
  boardStyle: BoardStyleId;
  lossEmoji: string;
  game: "Checkers";
  status: "live" | "training";
  version: string;
  bio: string;
  style: string;
  taunt: string;
}

export interface PlayableAgentProfile extends AgentProfileBase {
  id: PlayableAgentId;
  status: "live";
}

export interface TrainingAgentProfile extends AgentProfileBase {
  status: "training";
}

export type AgentProfile = PlayableAgentProfile | TrainingAgentProfile;

const AGENT_CATALOG = {
  masaki: {
    id: "masaki",
    displayName: RELEASED_AGENT_CATALOG.masaki.displayName,
    name: "MASAKI",
    tagline: "the closer",
    venue: "MASAKI SOCIAL CLUB",
    metadataTitle: "kingme · masaki social club",
    img: "/assets/masaki.png",
    boardStyle: "rose",
    lossEmoji: "😘",
    game: "Checkers",
    status: "live",
    version: "v0.6",
    bio: "Masaki doesn't perform. She closes. You get one loose diagonal, one lazy king path, and suddenly the room is hers.",
    style: "clinical · punishes drift",
    taunt: "one loose diagonal. that's all.",
  },
  tabata: {
    id: "tabata",
    displayName: RELEASED_AGENT_CATALOG.tabata.displayName,
    name: "TABATA",
    tagline: "the landlord",
    venue: "TABATA SUPPER ROOM",
    metadataTitle: "kingme · tabata supper room",
    img: "/assets/tabata.png",
    boardStyle: "emerald",
    lossEmoji: "🍺",
    game: "Checkers",
    status: "live",
    version: "v0.4",
    bio: "Tokea uswazi siachi ukoko. Tokea mageto huu ndo mtoko, matendo sina ropo ropo.",
    style: "patient · owns the tempo",
    taunt: "siachi ukoko.",
  },
  sinza: {
    id: "sinza",
    displayName: RELEASED_AGENT_CATALOG.sinza.displayName,
    name: "SINZA",
    tagline: "the showman",
    venue: "SINZA KIJIWENI",
    metadataTitle: "kingme · sinza kijiweni",
    img: "/assets/sinza.webp",
    boardStyle: "emerald",
    lossEmoji: "😂",
    game: "Checkers",
    status: "live",
    version: "v1",
    bio: "Sinza is here for the audience, not the game. He'll let you king him just to make the comeback uglier. He's never lost a rematch. He's never offered one either.",
    style: "aggressive · loves forced captures",
    taunt: "njoo tuzinese wewe.....",
  },
  manzese: {
    id: "manzese",
    displayName: "Mze Manzese",
    name: "MZE MANZESE",
    tagline: "the old man",
    venue: "MANZESE BACK OFFICE",
    metadataTitle: "kingme · manzese back office",
    img: "/assets/manzese.webp",
    boardStyle: "emerald",
    lossEmoji: "😂",
    game: "Checkers",
    status: "training",
    version: "v0.7",
    bio: "Mze Manzese is back in the room, still reading the board like it owes him rent. He's in training for the next release.",
    style: "in training · old-school pressure",
    taunt: "back soon. don't get comfortable.",
  },
} as const satisfies Record<string, AgentProfile>;

export type AgentId = keyof typeof AGENT_CATALOG;

export const FEATURED_AGENT_ID: ReleasedAgentId = "sinza";
export const FEATURED_AGENT = AGENT_CATALOG[FEATURED_AGENT_ID];

export const AGENT_ROSTER = [
  AGENT_CATALOG.masaki,
  AGENT_CATALOG.tabata,
  AGENT_CATALOG.sinza,
  AGENT_CATALOG.manzese,
] as const satisfies readonly AgentProfile[];

export const PLAYABLE_AGENT_IDS = RELEASED_AGENT_IDS;
export type PlayableAgentId = ReleasedAgentId;

export const PLAYABLE_AGENTS = PLAYABLE_AGENT_IDS.map(
  (id) => AGENT_CATALOG[id],
) as readonly PlayableAgentProfile[];

export function getAgentPath(agentId: AgentId): `/${AgentId}` {
  return `/${agentId}`;
}

export function isPlayableAgentId(value: string): value is PlayableAgentId {
  return isReleasedAgentId(value);
}

export function getPlayableAgentProfile(
  agentId: string,
): PlayableAgentProfile | null {
  return isPlayableAgentId(agentId) ? AGENT_CATALOG[agentId] : null;
}
