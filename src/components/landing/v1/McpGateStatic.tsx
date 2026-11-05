import { IsoBox } from "./IsoIcons";
import { iso, PAL, TOP_FACE_MATRIX } from "./iso";
import { TileMark } from "./ControlPlaneStatic";
import { MCP, TILE_H, TILE_SIZE } from "./sceneData";

/* The MCP explainer as a still: three agents above the plane, four tools below, and the three
   answers side by side. Serves reduced motion, small screens, no WebGL and the loading state. */

const S = 54;
const ORIGIN = [280, 296] as const;
const sp = (x: number, y: number, z: number) => {
  const [a, b] = iso(x, y, z);
  return [ORIGIN[0] + a * S, ORIGIN[1] + b * S] as const;
};

const mono = "'JetBrains Mono', ui-monospace, monospace";

/** Width from the label length: JetBrains Mono at 11px is about 6.7px per character. */
const chipWidth = (text: string, strong?: string) => 36 + Math.ceil((text.length + (strong ? strong.length + 3 : 0)) * 6.7);

function ChipBox({ x, y, tone, text, strong }: { x: number; y: number; tone: "ink" | "green" | "amber"; text: string; strong?: string }) {
  const w = chipWidth(text, strong);
  const fill = { ink: "#0f1a1f", green: "#e3f2ea", amber: "#fcefdc" }[tone];
  const stroke = { ink: "none", green: "rgba(30,122,74,0.35)", amber: "rgba(232,150,46,0.5)" }[tone];
  const color = { ink: "#ffffff", green: "#1e7a4a", amber: "#8a4b00" }[tone];
  const dot = { ink: "#3bbfaf", green: "#1e7a4a", amber: "#e8962e" }[tone];
  return (
    <g transform={`translate(${x} ${y})`} fontFamily={mono} fontSize={11} fontWeight={500}>
      <rect width={w} height={26} rx={6} fill={fill} stroke={stroke} />
      <circle cx={14} cy={13} r={3} fill={dot} />
      <text x={24} y={17} fill={color} letterSpacing={0.3}>
        {strong && <tspan fontWeight={700}>{strong} · </tspan>}
        {text}
      </text>
    </g>
  );
}

export default function McpGateStatic({ className = "" }: { className?: string }) {
  const top = TILE_H;
  const a0 = MCP.agents[0];
  const hub = MCP.tiles[0];
  const [px, py] = sp(MCP.planeW / 2 - 0.15, MCP.planeY + 0.05, -MCP.planeD / 2 + 0.25);
  // the three answers as a column at the top left, each tied to its agent by a thin leader
  const chips = MCP.requests.map((r, i) => {
    const a = MCP.agents[r.agent];
    const [ax, ay] = sp(a.x, MCP.agentY + MCP.agentSize / 2 + 0.05, MCP.agentZ);
    return { r, ax, ay, x: 8, y: 6 + i * 30 };
  });
  return (
    <svg viewBox="0 0 560 440" className={className} role="img" aria-label="Three AI agents above a translucent Dexraflow plane, four GTM tools below it. The Clay agent's write is allowed and logged into HubSpot; the AI SDR's email is held because Raj owns an open deal; the Claude agent's email waits because the contact was emailed an hour ago.">
      <defs>
        <radialGradient id="mcps-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#0f1a1f" stopOpacity="0.16" />
          <stop offset="1" stopColor="#0f1a1f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={ORIGIN[0]} cy={ORIGIN[1] + 40} rx={240} ry={90} fill="url(#mcps-shadow)" />
      <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]}) scale(${S})`}>
        {MCP.tiles.map((t) => (
          <IsoBox key={t.k} x={t.x - TILE_SIZE / 2} y={0} z={MCP.tileZ - TILE_SIZE / 2} w={TILE_SIZE} h={TILE_H} d={TILE_SIZE} pal={PAL.tile} />
        ))}
        {MCP.tiles.map((t) => {
          const [a, b] = iso(t.x, top + 0.002, MCP.tileZ);
          return (
            <g key={`m-${t.k}`} transform={`translate(${a} ${b}) ${TOP_FACE_MATRIX}`}>
              <TileMark k={t.k} />
            </g>
          );
        })}
        {/* probes from the plane to every tool */}
        {MCP.tiles.map((t) => {
          const [x1, y1] = iso(a0.x, MCP.planeY, MCP.agentZ);
          const [x2, y2] = iso(t.x, top, MCP.tileZ);
          return <line key={`p-${t.k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0b6e69" strokeWidth={0.02} strokeOpacity={0.45} strokeDasharray="0.05 0.06" />;
        })}
        {/* the allowed write landing in HubSpot */}
        {(() => {
          const [x1, y1] = iso(a0.x, MCP.planeY, MCP.agentZ);
          const [x2, y2] = iso(hub.x, top + 0.1, MCP.tileZ);
          return (
            <g>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1e7a4a" strokeWidth={0.035} strokeLinecap="round" />
              <circle cx={x2} cy={y2} r={0.08} fill="#1e7a4a" />
            </g>
          );
        })()}
        {/* the plane and the ripple of the check */}
        <IsoBox x={-MCP.planeW / 2} y={MCP.planeY} z={-MCP.planeD / 2} w={MCP.planeW} h={0.05} d={MCP.planeD} pal={PAL.glass} />
        <g transform={`translate(${iso(a0.x, MCP.planeY + 0.06, MCP.agentZ)[0]} ${iso(a0.x, MCP.planeY + 0.06, MCP.agentZ)[1]}) ${TOP_FACE_MATRIX}`}>
          {[0.35, 0.7, 1.05].map((r, i) => (
            <circle key={r} r={r} fill="none" stroke="#3bbfaf" strokeWidth={0.03} strokeOpacity={0.8 - i * 0.25} />
          ))}
        </g>
        {/* guides and agents */}
        {MCP.agents.map((a) => {
          const [x1, y1] = iso(a.x, MCP.planeY + 0.05, MCP.agentZ);
          const [x2, y2] = iso(a.x, MCP.agentY - MCP.agentSize / 2, MCP.agentZ);
          return <line key={`g-${a.k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b9c6c2" strokeWidth={0.025} strokeDasharray="0.07 0.07" />;
        })}
        {MCP.agents.map((a) => (
          <IsoBox key={a.k} x={a.x - MCP.agentSize / 2} y={MCP.agentY - MCP.agentSize / 2} z={MCP.agentZ - MCP.agentSize / 2} w={MCP.agentSize} h={MCP.agentSize} d={MCP.agentSize} pal={PAL.ink} />
        ))}
        {MCP.agents.map((a) => {
          const [x, y] = iso(a.x, MCP.agentY + MCP.agentSize / 2 + 0.002, MCP.agentZ);
          return (
            <g key={`am-${a.k}`} transform={`translate(${x} ${y}) ${TOP_FACE_MATRIX} scale(0.7)`}>
              <TileMark k={a.k} />
            </g>
          );
        })}
        {/* the held request bouncing back, the waiting one hovering */}
        <circle cx={iso(MCP.agents[1].x, MCP.agentY - MCP.agentSize / 2 - 0.12, MCP.agentZ)[0]} cy={iso(MCP.agents[1].x, MCP.agentY - MCP.agentSize / 2 - 0.12, MCP.agentZ)[1]} r={0.08} fill="#e8962e" />
        <circle cx={iso(MCP.agents[2].x, MCP.planeY + 0.1, MCP.agentZ)[0]} cy={iso(MCP.agents[2].x, MCP.planeY + 0.1, MCP.agentZ)[1]} r={0.08} fill="#e8962e" />
      </g>
      <ChipBox x={px - chipWidth("Dexraflow MCP · check_action")} y={py - 50} tone="ink" text="Dexraflow MCP · check_action" />
      {chips.map(({ r, ax, ay, x, y }, i) => (
        <g key={i}>
          <line x1={x + chipWidth(r.why, r.decision)} y1={y + 13} x2={ax} y2={ay} stroke={r.decision === "ALLOW" ? "#1e7a4a" : "#e8962e"} strokeWidth={1} strokeDasharray="2 3" strokeOpacity={0.6} />
          <circle cx={ax} cy={ay} r={2.5} fill={r.decision === "ALLOW" ? "#1e7a4a" : "#e8962e"} />
          <ChipBox x={x} y={y} tone={r.decision === "ALLOW" ? "green" : "amber"} strong={r.decision} text={r.why} />
        </g>
      ))}
    </svg>
  );
}
