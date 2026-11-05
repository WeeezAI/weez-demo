/* Shared layout for the hero's control-plane scene (3D and static). World units; Y up.
   Six tool tiles in two rows. A lead travels Form → HubSpot → Zapier → Outreach → Slack.
   Clay enriches from HubSpot on a side wire. The Zapier → Outreach hop is the one that breaks. */

export type TileDef = { k: string; name: string; x: number; z: number };

export const TILE_SIZE = 1;
export const TILE_H = 0.18;
export const PLANE_Y = 1.5;
export const PLANE_W = 4.6;
export const PLANE_D = 2.8;

export const TILES: TileDef[] = [
  { k: "form", name: "Web form", x: -1.4, z: -0.7 },
  { k: "hubspot", name: "HubSpot", x: 0, z: -0.7 },
  { k: "zapier", name: "Zapier", x: 1.4, z: -0.7 },
  { k: "clay", name: "Clay", x: -1.4, z: 0.7 },
  { k: "slack", name: "Slack", x: 0, z: 0.7 },
  { k: "outreach", name: "Outreach", x: 1.4, z: 0.7 },
];

export const byKey = (k: string) => TILES.find((t) => t.k === k)!;

/** The lead's route, as tile keys. */
export const ROUTE = ["form", "hubspot", "zapier", "outreach", "slack"] as const;

/** Index of the route segment that silently breaks (zapier → outreach). */
export const BROKEN_SEGMENT = 2;

export const SIDE_WIRES: [string, string][] = [["hubspot", "clay"]];

/** One cycle: a healthy run, then a broken run that the plane catches. Seconds. */
export const T = {
  period: 11,
  hop: 0.9, // per route segment
  okChip: [3.7, 4.7] as const,
  brokenStart: 4.9,
  dropDur: 0.75,
  scan: [6.8, 8.2] as const,
  scanFrom: -2.6,
  scanTo: 2.6,
};

/* ───────────── the MCP gate scene ─────────────
   Three agents above a Dexraflow plane above four CRM/GTM tools. Each agent asks before it acts;
   the plane checks every tool, answers, and logs. One request per slot, three slots per loop. */

export type McpDecision = "ALLOW" | "HOLD" | "WAIT";
export type McpRequest = { agent: number; ask: string; decision: McpDecision; why: string; target: string | null; after: string };

export const MCP = {
  tiles: [
    { k: "hubspot", x: -2.1 },
    { k: "salesforce", x: -0.7 },
    { k: "outreach", x: 0.7 },
    { k: "slack", x: 2.1 },
  ],
  tileZ: 0.35,
  planeY: 1.2,
  planeW: 5.4,
  planeD: 2.3,
  agentY: 2.4,
  agentZ: -0.45,
  agentSize: 0.55,
  agents: [
    { k: "clay", name: "Clay agent", x: -1.6 },
    { k: "bot", name: "AI SDR", x: 0 },
    { k: "claude", name: "Claude agent", x: 1.6 },
  ],
  requests: [
    { agent: 0, ask: "update_title · jane@acme.com", decision: "ALLOW", why: "no conflict · write allowed", target: "hubspot", after: "logged · act_8f21" },
    { agent: 1, ask: "send_email · jane@acme.com", decision: "HOLD", why: "open deal · Raj owns it", target: null, after: "Raj notified in Slack" },
    { agent: 2, ask: "send_email · jane@acme.com", decision: "WAIT", why: "emailed 1h ago by AI SDR", target: null, after: "one touch per contact" },
  ] as McpRequest[],
  /** Seconds per request. Phases inside a slot: ask → check → decide → act. */
  slot: 4.8,
  t: { ask: 0.9, check: 2.0, decide: 2.6, act: 3.6, hide: 4.55 },
};
