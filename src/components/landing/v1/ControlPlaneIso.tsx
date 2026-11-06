import { useMemo } from "react";
import { motion } from "framer-motion";
import { BRAND_ICONS, BRAND_LOGOS } from "../brandIcons";
import { IsoBox } from "./IsoIcons";
import { iso, PAL, TOP_FACE_MATRIX } from "./iso";
import { Chip, Stage, useLoop, useStageInView } from "./isoScene";
import { BROKEN_SEGMENT, byKey, PLANE_D, PLANE_W, PLANE_Y, ROUTE, SIDE_WIRES, TILE_H, TILE_SIZE, TILES } from "./sceneData";

/* The hero illustration, animated in the page's isometric style.
   One loop: a lead runs Form → HubSpot → Zapier → Outreach → Slack and every handoff matches.
   The next lead silently drops at the Zapier hop. The plane's scan sweeps the grid, locks onto the
   broken tile, lights it amber and names the loss. Reduced motion holds the final frame. */

const W = 560;
const H = 420;
const S = 64;
const ORIGIN = [280, 252] as const;
const sp = (x: number, y: number, z: number) => {
  const [a, b] = iso(x, y, z);
  return [ORIGIN[0] + a * S, ORIGIN[1] + b * S] as const;
};
const BRAND = "#0b6e69";
const SIGNAL = "#e8962e";

export function TileMark({ k }: { k: string }) {
  if (k === "bot")
    return (
      <g stroke="#3bbfaf" strokeWidth={0.04} strokeLinecap="round" fill="none">
        <rect x={-0.2} y={-0.12} width={0.4} height={0.3} rx={0.07} />
        <circle cx={-0.08} cy={0.03} r={0.035} fill="#3bbfaf" stroke="none" />
        <circle cx={0.08} cy={0.03} r={0.035} fill="#3bbfaf" stroke="none" />
        <line x1={0} y1={-0.12} x2={0} y2={-0.2} />
        <circle cx={0} cy={-0.23} r={0.03} fill="#3bbfaf" stroke="none" />
      </g>
    );
  if (k === "form")
    return (
      <g stroke="#0f1a1f" strokeWidth={0.035} strokeLinecap="round" fill="none">
        <rect x={-0.25} y={-0.25} width={0.5} height={0.5} rx={0.06} />
        <line x1={-0.14} y1={-0.1} x2={0.14} y2={-0.1} />
        <line x1={-0.14} y1={0.02} x2={0.06} y2={0.02} />
        <rect x={-0.14} y={0.1} width={0.18} height={0.08} rx={0.02} fill={BRAND} stroke="none" />
      </g>
    );
  const logo = BRAND_LOGOS[k];
  if (logo) return <image href={logo.src} x={-0.25} y={-0.25} width={0.5} height={0.5} preserveAspectRatio="xMidYMid meet" />;
  const icon = BRAND_ICONS[k];
  if (!icon) return null;
  return <path d={icon.path} fill={icon.hex} transform={`translate(-0.25 -0.25) scale(${0.5 / 24})`} />;
}

type Phase = { at: string; d: number; jump?: boolean; ok?: boolean; drop?: boolean; scan?: boolean; caught?: boolean; hidden?: boolean };
const PHASES: Phase[] = [
  { at: "form", d: 0.05, jump: true },
  { at: "hubspot", d: 0.9 },
  { at: "zapier", d: 0.9 },
  { at: "outreach", d: 0.9 },
  { at: "slack", d: 0.9 },
  { at: "slack", d: 1.3, ok: true, hidden: true },
  { at: "form", d: 0.05, jump: true },
  { at: "hubspot", d: 0.9 },
  { at: "zapier", d: 0.9 },
  { at: "mid", d: 0.45 },
  { at: "drop", d: 0.8, drop: true },
  { at: "drop", d: 1.6, scan: true, hidden: true },
  { at: "drop", d: 2.4, caught: true, hidden: true },
];
const DURATIONS = PHASES.map((p) => p.d);

export default function ControlPlaneIso({ className = "" }: { className?: string }) {
  const { ref, inView, reduce } = useStageInView();
  const i = useLoop(DURATIONS, inView, reduce);
  const ph = PHASES[i];

  const geo = useMemo(() => {
    const top = TILE_H;
    const route = ROUTE.map(byKey);
    const broken = route[BROKEN_SEGMENT];
    const next = route[BROKEN_SEGMENT + 1];
    const mid = { x: (broken.x + next.x) / 2, z: (broken.z + next.z) / 2 };
    const anchors: Record<string, readonly [number, number]> = {};
    for (const t of TILES) anchors[t.k] = sp(t.x, top + 0.08, t.z);
    anchors.mid = sp(mid.x, top + 0.08, mid.z);
    anchors.drop = sp(mid.x, -1.3, mid.z);
    const beamAt = (x: number) => [iso(x, PLANE_Y - 0.03, -PLANE_D / 2), iso(x, PLANE_Y - 0.03, PLANE_D / 2), iso(x, 0, PLANE_D / 2), iso(x, 0, -PLANE_D / 2)].map((p) => p.join(",")).join(" ");
    const shift = (dx: number) => ({ x: dx * 0.866 * S, y: dx * 0.5 * S });
    return { top, route, broken, mid, anchors, beamAt, shift, sorted: [...TILES].sort((a, b) => a.x + a.z - (b.x + b.z)) };
  }, []);

  const { top, route, broken, mid, anchors, beamAt, shift, sorted } = geo;
  const [px, py] = anchors[ph.at];
  const pulseColor = ph.drop || ph.scan || ph.caught ? SIGNAL : BRAND;
  const SCAN_FROM = -2.7;
  const SCAN_TO = 2.7;
  const beamShift = ph.caught ? shift(broken.x - SCAN_FROM) : ph.scan ? shift(SCAN_TO - SCAN_FROM) : shift(0);
  const [planeChipX, planeChipY] = sp(-PLANE_W / 2 + 0.35, PLANE_Y + 0.05, -PLANE_D / 2 + 0.35);
  const [okX, okY] = sp(byKey("slack").x, 0.95, byKey("slack").z);
  const [caughtX, caughtY] = sp(broken.x, 1.0, broken.z);

  return (
    <div ref={ref} className={className}>
      <Stage w={W} h={H} label="Six GTM tools on a grid beneath a translucent control plane. A lead runs from the web form to Slack and every handoff matches. The next lead silently drops at Zapier; the plane's scan lights the tile amber: 37 leads never reached Outreach.">
        {(L) => (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <radialGradient id="cpi-shadow" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#0f1a1f" stopOpacity="0.16" />
                  <stop offset="1" stopColor="#0f1a1f" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="cpi-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor={SIGNAL} stopOpacity="0.55" />
                  <stop offset="1" stopColor={SIGNAL} stopOpacity="0" />
                </radialGradient>
                <linearGradient id="cpi-beam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={BRAND} stopOpacity="0.26" />
                  <stop offset="1" stopColor={BRAND} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              <ellipse cx={ORIGIN[0]} cy={ORIGIN[1] + 30} rx={230} ry={95} fill="url(#cpi-shadow)" />

              {/* back layer: tiles, wires, the lead */}
              <motion.g style={{ x: L.back.x, y: L.back.y }}>
                <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]}) scale(${S})`}>
                  {/* amber underglow for the broken tile */}
                  <motion.ellipse cx={iso(broken.x, 0, broken.z)[0]} cy={iso(broken.x, 0, broken.z)[1] + 0.1} rx={1.2} ry={0.62} fill="url(#cpi-glow)" initial={false} animate={{ opacity: ph.caught ? 1 : 0 }} transition={{ duration: 0.5 }} />
                  {sorted.map((t) => (
                    <IsoBox key={t.k} x={t.x - TILE_SIZE / 2} y={0} z={t.z - TILE_SIZE / 2} w={TILE_SIZE} h={TILE_H} d={TILE_SIZE} pal={PAL.tile} />
                  ))}
                  <motion.polygon
                    points={[iso(broken.x - 0.53, top + 0.005, broken.z - 0.53), iso(broken.x + 0.53, top + 0.005, broken.z - 0.53), iso(broken.x + 0.53, top + 0.005, broken.z + 0.53), iso(broken.x - 0.53, top + 0.005, broken.z + 0.53)].map((p) => p.join(",")).join(" ")}
                    fill="none"
                    stroke={SIGNAL}
                    strokeWidth={0.05}
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ opacity: ph.caught ? 1 : 0 }}
                    transition={{ duration: 0.4 }}
                  />
                  {TILES.map((t) => {
                    const [a, b] = iso(t.x, top + 0.002, t.z);
                    return (
                      <g key={t.k} transform={`translate(${a} ${b}) ${TOP_FACE_MATRIX}`}>
                        <TileMark k={t.k} />
                      </g>
                    );
                  })}
                  {SIDE_WIRES.map(([a, b]) => {
                    const A = byKey(a);
                    const B = byKey(b);
                    return <line key={a + b} x1={iso(A.x, top, A.z)[0]} y1={iso(A.x, top, A.z)[1]} x2={iso(B.x, top, B.z)[0]} y2={iso(B.x, top, B.z)[1]} stroke="#b9c6c2" strokeWidth={0.03} strokeDasharray="0.08 0.08" />;
                  })}
                  {route.slice(0, -1).map((A, k) => {
                    const B = route[k + 1];
                    const isBroken = k === BROKEN_SEGMENT;
                    const [x1, y1] = iso(A.x, top, A.z);
                    const [x2, y2] = iso(B.x, top, B.z);
                    return <motion.line key={A.k + B.k} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={0.035} strokeLinecap="round" initial={false} animate={{ stroke: isBroken && (ph.caught || ph.scan) ? SIGNAL : BRAND, strokeDasharray: isBroken && (ph.caught || ph.scan) ? "0.06 0.08" : "1 0" }} transition={{ duration: 0.4 }} />;
                  })}
                  {/* the dotted fall line, once the drop happened */}
                  <motion.line x1={iso(mid.x, top + 0.08, mid.z)[0]} y1={iso(mid.x, top + 0.08, mid.z)[1]} x2={iso(mid.x, -1.3, mid.z)[0]} y2={iso(mid.x, -1.3, mid.z)[1]} stroke={SIGNAL} strokeWidth={0.025} strokeDasharray="0.04 0.07" initial={false} animate={{ opacity: ph.scan || ph.caught ? 1 : 0 }} transition={{ duration: 0.3 }} />
                </g>
                {/* the lead */}
                <motion.circle
                  r={5.5}
                  initial={false}
                  animate={{ cx: px, cy: py, fill: pulseColor, opacity: ph.hidden ? 0 : ph.drop ? 0.25 : 1 }}
                  transition={ph.jump ? { duration: 0 } : { cx: { duration: ph.d, ease: ph.drop ? "easeIn" : "linear" }, cy: { duration: ph.d, ease: ph.drop ? "easeIn" : "linear" }, fill: { duration: 0.5 }, opacity: { duration: ph.drop ? ph.d : 0.2, ease: "easeIn" } }}
                />
                <motion.circle
                  r={11}
                  initial={false}
                  animate={{ cx: px, cy: py, fill: pulseColor, opacity: ph.hidden || ph.drop ? 0 : [0.18, 0.32, 0.18] }}
                  transition={ph.jump ? { duration: 0 } : { cx: { duration: ph.d, ease: "linear" }, cy: { duration: ph.d, ease: "linear" }, fill: { duration: 0.5 }, opacity: { duration: 1.2, repeat: Infinity } }}
                />
              </motion.g>

              {/* mid layer: the scan beam and the plane */}
              <motion.g style={{ x: L.mid.x, y: L.mid.y }}>
                <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]}) scale(${S})`}>
                  <motion.g initial={false} animate={{ x: beamShift.x / S, y: beamShift.y / S, opacity: ph.scan ? 1 : ph.caught ? 0.7 : 0 }} transition={{ x: { duration: ph.scan ? ph.d : 0.6, ease: ph.scan ? "easeInOut" : "easeOut" }, y: { duration: ph.scan ? ph.d : 0.6, ease: ph.scan ? "easeInOut" : "easeOut" }, opacity: { duration: 0.3 } }}>
                    <polygon points={beamAt(SCAN_FROM)} fill="url(#cpi-beam)" />
                    <line x1={iso(SCAN_FROM, PLANE_Y - 0.03, -PLANE_D / 2)[0]} y1={iso(SCAN_FROM, PLANE_Y - 0.03, -PLANE_D / 2)[1]} x2={iso(SCAN_FROM, PLANE_Y - 0.03, PLANE_D / 2)[0]} y2={iso(SCAN_FROM, PLANE_Y - 0.03, PLANE_D / 2)[1]} stroke="#3bbfaf" strokeWidth={0.035} />
                  </motion.g>
                  <motion.g initial={false} animate={{ y: [0, -0.04, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
                    <IsoBox x={-PLANE_W / 2} y={PLANE_Y} z={-PLANE_D / 2} w={PLANE_W} h={0.05} d={PLANE_D} pal={PAL.glass} />
                  </motion.g>
                </g>
              </motion.g>
            </svg>

            {/* front layer: chips */}
            <motion.div className="absolute inset-0" style={{ x: L.front.x, y: L.front.y }}>
              <Chip x={planeChipX} y={planeChipY - 22} w={W} h={H} tone="ink">
                Dexraflow · daily check
              </Chip>
              <Chip x={okX} y={okY} w={W} h={H} tone="green" show={!!ph.ok}>
                208 leads · every handoff matched
              </Chip>
              <Chip x={caughtX + 20} y={caughtY} w={W} h={H} tone="amber" anchor="right" show={!!ph.caught}>
                37 leads never reached Outreach
              </Chip>
            </motion.div>
          </>
        )}
      </Stage>
    </div>
  );
}
