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
