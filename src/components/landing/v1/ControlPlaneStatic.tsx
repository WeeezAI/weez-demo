import { BRAND_ICONS, BRAND_LOGOS } from "../brandIcons";
import { IsoBox } from "./IsoIcons";
import { iso, PAL, TOP_FACE_MATRIX } from "./iso";
import { BROKEN_SEGMENT, byKey, PLANE_D, PLANE_W, PLANE_Y, ROUTE, SIDE_WIRES, TILE_H, TILE_SIZE, TILES } from "./sceneData";

/* The hero illustration as a still: the same scene as the WebGL version, frozen at the moment
   the plane catches the broken hop. Used for reduced motion, small screens, no WebGL, and as the
   loading state so nothing jumps when the 3D canvas arrives. */

const S = 64; // px per world unit
const ORIGIN = [280, 252] as const;

const sp = (x: number, y: number, z: number) => {
  const [a, b] = iso(x, y, z);
  return [ORIGIN[0] + a * S, ORIGIN[1] + b * S] as const;
};

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
        <rect x={-0.14} y={0.1} width={0.18} height={0.08} rx={0.02} fill="#0b6e69" stroke="none" />
      </g>
    );
  const logo = BRAND_LOGOS[k];
  if (logo) return <image href={logo.src} x={-0.25} y={-0.25} width={0.5} height={0.5} preserveAspectRatio="xMidYMid meet" />;
  const icon = BRAND_ICONS[k];
  if (!icon) return null;
  return <path d={icon.path} fill={icon.hex} transform={`translate(-0.25 -0.25) scale(${0.5 / 24})`} />;
}

export default function ControlPlaneStatic({ className = "" }: { className?: string }) {
  const sorted = [...TILES].sort((a, b) => a.x + a.z - (b.x + b.z));
  const top = TILE_H;
  const route = ROUTE.map(byKey);
  const broken = byKey(ROUTE[BROKEN_SEGMENT]);
  const [bx, by] = sp(broken.x, top + 0.9, broken.z);
  const [px, py] = sp(-PLANE_W / 2 + 0.35, PLANE_Y + 0.05, -PLANE_D / 2 + 0.35);

  return (
    <svg viewBox="0 0 560 420" className={className} role="img" aria-label="Six GTM tools on a grid beneath a translucent control plane. A lead's path from the web form to Outreach is broken at Zapier; the plane's scan highlights it in amber with the note '37 leads never reached Outreach'.">
      <defs>
        <radialGradient id="cps-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#0f1a1f" stopOpacity="0.16" />
          <stop offset="1" stopColor="#0f1a1f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cps-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b6e69" stopOpacity="0.22" />
          <stop offset="1" stopColor="#0b6e69" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <ellipse cx={ORIGIN[0]} cy={ORIGIN[1] + 30} rx={230} ry={95} fill="url(#cps-shadow)" />

      <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]}) scale(${S})`}>
        {sorted.map((t) => (
          <IsoBox key={t.k} x={t.x - TILE_SIZE / 2} y={0} z={t.z - TILE_SIZE / 2} w={TILE_SIZE} h={TILE_H} d={TILE_SIZE} pal={PAL.tile} />
        ))}
        {/* amber rim on the broken tile */}
        <polygon
          points={[iso(broken.x - 0.53, top + 0.005, broken.z - 0.53), iso(broken.x + 0.53, top + 0.005, broken.z - 0.53), iso(broken.x + 0.53, top + 0.005, broken.z + 0.53), iso(broken.x - 0.53, top + 0.005, broken.z + 0.53)].map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="#e8962e"
          strokeWidth={0.05}
          strokeLinejoin="round"
        />
        {/* marks laid flat on the tiles */}
        {TILES.map((t) => {
          const [a, b] = iso(t.x, top + 0.002, t.z);
          return (
            <g key={t.k} transform={`translate(${a} ${b}) ${TOP_FACE_MATRIX}`}>
              <TileMark k={t.k} />
            </g>
          );
        })}
        {/* wires */}
        {SIDE_WIRES.map(([a, b]) => {
          const A = byKey(a);
          const B = byKey(b);
          return <line key={a + b} x1={iso(A.x, top, A.z)[0]} y1={iso(A.x, top, A.z)[1]} x2={iso(B.x, top, B.z)[0]} y2={iso(B.x, top, B.z)[1]} stroke="#b9c6c2" strokeWidth={0.03} strokeDasharray="0.08 0.08" />;
        })}
        {route.slice(0, -1).map((A, i) => {
          const B = route[i + 1];
          const isBroken = i === BROKEN_SEGMENT;
          const [x1, y1] = iso(A.x, top, A.z);
          const [x2, y2] = iso(B.x, top, B.z);
          return <line key={A.k + B.k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isBroken ? "#e8962e" : "#0b6e69"} strokeWidth={0.035} strokeDasharray={isBroken ? "0.06 0.08" : undefined} strokeLinecap="round" />;
        })}
        {/* the dropped lead */}
        {(() => {
          const A = route[BROKEN_SEGMENT];
          const B = route[BROKEN_SEGMENT + 1];
          const mx = (A.x + B.x) / 2;
          const mz = (A.z + B.z) / 2;
          const [sx, sy] = iso(mx, top + 0.05, mz);
          const [dx, dy] = iso(mx, -0.55, mz);
          return (
            <g>
              <line x1={sx} y1={sy} x2={dx} y2={dy} stroke="#e8962e" strokeWidth={0.025} strokeDasharray="0.04 0.07" />
              <circle cx={dx} cy={dy} r={0.08} fill="#e8962e" opacity={0.6} />
            </g>
          );
        })()}
        {/* the scan beam over the broken tile */}
        <polygon
          points={[iso(broken.x, PLANE_Y - 0.03, -PLANE_D / 2), iso(broken.x, PLANE_Y - 0.03, PLANE_D / 2), iso(broken.x, 0, PLANE_D / 2), iso(broken.x, 0, -PLANE_D / 2)].map((p) => p.join(",")).join(" ")}
          fill="url(#cps-beam)"
        />
        <line x1={iso(broken.x, PLANE_Y - 0.03, -PLANE_D / 2)[0]} y1={iso(broken.x, PLANE_Y - 0.03, -PLANE_D / 2)[1]} x2={iso(broken.x, PLANE_Y - 0.03, PLANE_D / 2)[0]} y2={iso(broken.x, PLANE_Y - 0.03, PLANE_D / 2)[1]} stroke="#0b6e69" strokeWidth={0.03} />
        {/* the plane */}
        <IsoBox x={-PLANE_W / 2} y={PLANE_Y} z={-PLANE_D / 2} w={PLANE_W} h={0.05} d={PLANE_D} pal={PAL.glass} />
      </g>

      {/* screen-space chips */}
      <g transform={`translate(${px - 95} ${py - 30})`} fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize={11} fontWeight={500}>
        <rect x={0} y={0} width={190} height={26} rx={6} fill="#0f1a1f" />
        <circle cx={14} cy={13} r={3} fill="#3bbfaf" />
        <text x={24} y={17} fill="#ffffff" letterSpacing={0.3}>
          Dexraflow · daily check
        </text>
      </g>
      <g transform={`translate(${bx - 120} ${by - 60})`} fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize={11} fontWeight={500}>
        <rect x={0} y={0} width={240} height={26} rx={6} fill="#fcefdc" stroke="rgba(232,150,46,0.5)" />
        <circle cx={14} cy={13} r={3} fill="#e8962e" />
        <text x={24} y={17} fill="#8a4b00" letterSpacing={0.3}>
          37 leads never reached Outreach
        </text>
      </g>
    </svg>
  );
}
