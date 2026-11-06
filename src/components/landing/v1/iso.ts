/* Tiny isometric projection used by the 3D-style SVG icons and the static hero illustration.
   World space is right-handed with Y up. The camera sits at the +X/+Z corner, so the visible
   side faces are the +X and +Z ones. */

export const COS30 = 0.8660254;
export const SIN30 = 0.5;

/** Project a world point to screen space (unit = 1px until scaled by the caller). */
export const iso = (x: number, y: number, z: number): [number, number] => [(x - z) * COS30, (x + z) * SIN30 - y];

export const pt = (x: number, y: number, z: number) => iso(x, y, z).join(",");

/** The 2D affine matrix that lays flat artwork onto an iso top face (origin at the face's local 0,0). */
export const TOP_FACE_MATRIX = `matrix(${COS30} ${SIN30} ${-COS30} ${SIN30} 0 0)`;

export type IsoPalette = { top: string; left: string; right: string; stroke?: string };

export const PAL = {
  tile: { top: "#ffffff", left: "#c6d2ce", right: "#a9b8b3", stroke: "rgba(15,26,31,0.28)" },
  brand: { top: "#3bbfaf", left: "#0b6e69", right: "#095955", stroke: "rgba(9,89,85,0.5)" },
  amber: { top: "#f6b25c", left: "#e8962e", right: "#c47516", stroke: "rgba(138,75,0,0.45)" },
  ink: { top: "#2a3a40", left: "#0f1a1f", right: "#0a1216", stroke: "rgba(0,0,0,0.5)" },
  glass: { top: "rgba(220,239,236,0.55)", left: "rgba(11,110,105,0.18)", right: "rgba(11,110,105,0.28)", stroke: "rgba(11,110,105,0.55)" },
  night: { top: "#1c2a2f", left: "#131d20", right: "#0e1619", stroke: "rgba(59,191,175,0.35)" },
  glassNight: { top: "rgba(59,191,175,0.2)", left: "rgba(59,191,175,0.08)", right: "rgba(59,191,175,0.14)", stroke: "rgba(59,191,175,0.85)" },
} satisfies Record<string, IsoPalette>;

/** Polygon point strings for the three visible faces of an axis-aligned box. */
export function boxFaces(x: number, y: number, z: number, w: number, h: number, d: number) {
  const top = [pt(x, y + h, z), pt(x + w, y + h, z), pt(x + w, y + h, z + d), pt(x, y + h, z + d)].join(" ");
  const left = [pt(x, y, z + d), pt(x + w, y, z + d), pt(x + w, y + h, z + d), pt(x, y + h, z + d)].join(" ");
  const right = [pt(x + w, y, z), pt(x + w, y, z + d), pt(x + w, y + h, z + d), pt(x + w, y + h, z)].join(" ");
  return { top, left, right };
}

/** World-space translation (dx, dz on the ground plane, dy up) expressed as screen x/y for motion transforms. */
export const toScreen = (dx: number, dy: number, dz: number) => ({ x: (dx - dz) * COS30, y: (dx + dz) * SIN30 - dy });
