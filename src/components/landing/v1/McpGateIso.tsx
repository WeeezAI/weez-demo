import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TileMark } from "./ControlPlaneIso";
import { IsoBox } from "./IsoIcons";
import { iso, PAL, TOP_FACE_MATRIX } from "./iso";
import { Chip, Stage, useLoop, useStageInView } from "./isoScene";
import { MCP, TILE_H, TILE_SIZE } from "./sceneData";

/* The MCP explainer, animated in the page's isometric style.
   Three agents above the Dexraflow plane, four tools below. In each slot one agent asks (a pulse
   drops to the plane), the plane checks every tool (a ripple, probes, tiles flash), answers
   ALLOW / HOLD / WAIT with the reason, then the write lands in HubSpot and is logged, the held
   request returns to its agent, or the waiting one hovers. `onPhase` reports 0..3 so the steps
   beside the scene can follow. Reduced motion shows the three answers side by side. */

const W = 560;
const H = 440;
const S = 54;
const ORIGIN = [280, 296] as const;
const sp = (x: number, y: number, z: number) => {
  const [a, b] = iso(x, y, z);
  return [ORIGIN[0] + a * S, ORIGIN[1] + b * S] as const;
};
const BRAND = "#0b6e69";
const SIGNAL = "#e8962e";
const SUCCESS = "#1e7a4a";

/* phases per slot: ask → check → decide → act → hold */
const STEP = [0.9, 1.1, 0.6, 1.0, 1.4] as const;
const PHASES = MCP.requests.flatMap((_, slot) => STEP.map((d, ph) => ({ slot, ph, d })));
const DURATIONS = PHASES.map((p) => p.d);

export default function McpGateIso({ className = "", onPhase }: { className?: string; onPhase?: (phase: number) => void }) {
  const { ref, inView, reduce } = useStageInView();
  const i = useLoop(DURATIONS, inView, reduce);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 480));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  const { slot, ph, d } = PHASES[i];
  const req = MCP.requests[slot];
  const agent = MCP.agents[req.agent];

  useEffect(() => {
    onPhase?.(reduce ? -1 : Math.min(3, ph));
  }, [ph, reduce, onPhase]);

  const geo = useMemo(() => {
    const top = TILE_H;
    const agentBottom = (a: (typeof MCP.agents)[number]) => sp(a.x, MCP.agentY - MCP.agentSize / 2 - 0.08, MCP.agentZ);
    const agentTop = (a: (typeof MCP.agents)[number]) => sp(a.x, MCP.agentY + MCP.agentSize / 2 + 0.45, MCP.agentZ);
    const planePt = (a: (typeof MCP.agents)[number]) => sp(a.x, MCP.planeY + 0.1, MCP.agentZ);
    const tileTop = (k: string) => {
      const t = MCP.tiles.find((x) => x.k === k)!;
      return sp(t.x, top + 0.1, MCP.tileZ);
    };
    return { top, agentBottom, agentTop, planePt, tileTop };
  }, []);
  const { top, agentBottom, agentTop, planePt, tileTop } = geo;

  // where the request is, per phase
  const color = req.decision === "ALLOW" ? SUCCESS : SIGNAL;
  let pos = planePt(agent);
  let pulseColor = BRAND;
  let pulseOpacity = 1;
  let ease: "linear" | "easeIn" | "easeOut" | "easeInOut" = "linear";
  if (ph === 0) {
    pos = planePt(agent);
    ease = "easeIn";
  } else if (ph === 1) pos = planePt(agent);
  else if (ph === 2) {
    pos = planePt(agent);
    pulseColor = color;
  } else {
    pulseColor = color;
    ease = "easeInOut";
    if (req.decision === "ALLOW" && req.target) pos = tileTop(req.target);
    else if (req.decision === "HOLD") pos = agentBottom(agent);
    else pos = planePt(agent);
    if (ph === 4 && req.decision !== "WAIT") pulseOpacity = 0;
  }
  const jump = ph === 0 && !reduce; // the pulse starts at the agent each slot
  const checking = ph === 1;
  // chips at the outer agents grow inward on wide stages; on narrow ones everything centres on its agent
  const side = (k: number) => (narrow ? "center" : k === 0 ? "left" : k === 2 ? "right" : "center") as "left" | "right" | "center";

  return (
    <div ref={ref} className={className}>
      <Stage w={W} h={H} label="Three AI agents above a translucent Dexraflow plane, four GTM tools below it. Each agent asks before it acts: the Clay agent's write is allowed and logged into HubSpot; the AI SDR's email is held because Raj owns an open deal; the Claude agent's email waits because the contact was emailed an hour ago.">
        {(L) => (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <radialGradient id="mgi-shadow" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#0f1a1f" stopOpacity="0.16" />
                  <stop offset="1" stopColor="#0f1a1f" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="mgi-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor={BRAND} stopOpacity="0.5" />
                  <stop offset="1" stopColor={BRAND} stopOpacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx={ORIGIN[0]} cy={ORIGIN[1] + 40} rx={240} ry={90} fill="url(#mgi-shadow)" />

              {/* back: tools, probes */}
              <motion.g style={{ x: L.back.x, y: L.back.y }}>
                <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]}) scale(${S})`}>
                  {MCP.tiles.map((t, k) => (
                    <motion.ellipse key={`g-${t.k}`} cx={iso(t.x, 0, MCP.tileZ)[0]} cy={iso(t.x, 0, MCP.tileZ)[1] + 0.1} rx={1.1} ry={0.58} fill="url(#mgi-glow)" initial={false} animate={{ opacity: checking ? [0, 1, 0] : 0 }} transition={{ duration: 0.7, delay: checking ? 0.15 + k * 0.18 : 0 }} />
                  ))}
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
                  {MCP.tiles.map((t, k) => {
                    const [x1, y1] = iso(agent.x, MCP.planeY, MCP.agentZ);
                    const [x2, y2] = iso(t.x, top, MCP.tileZ);
                    return <motion.line key={`p-${t.k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={BRAND} strokeWidth={0.03} strokeDasharray="0.05 0.06" initial={false} animate={{ opacity: checking ? [0, 0.9, 0.9, 0] : 0 }} transition={{ duration: 0.8, delay: checking ? 0.1 + k * 0.18 : 0 }} />;
                  })}
                  {/* the allowed write's path */}
                  {req.decision === "ALLOW" && req.target && ph >= 3 && (
                    <motion.line x1={iso(agent.x, MCP.planeY, MCP.agentZ)[0]} y1={iso(agent.x, MCP.planeY, MCP.agentZ)[1]} x2={iso(MCP.tiles.find((t) => t.k === req.target)!.x, top + 0.05, MCP.tileZ)[0]} y2={iso(MCP.tiles.find((t) => t.k === req.target)!.x, top + 0.05, MCP.tileZ)[1]} stroke={SUCCESS} strokeWidth={0.035} strokeLinecap="round" initial={{ pathLength: 0, opacity: 0.9 }} animate={{ pathLength: 1, opacity: ph === 4 ? 0 : 0.9 }} transition={{ pathLength: { duration: 0.9, ease: "easeInOut" }, opacity: { duration: 0.6, delay: ph === 4 ? 0.6 : 0 } }} />
                  )}
                </g>
              </motion.g>

              {/* mid: the plane, the ripple, the guides, the agents, the request */}
              <motion.g style={{ x: L.mid.x, y: L.mid.y }}>
                <g transform={`translate(${ORIGIN[0]} ${ORIGIN[1]}) scale(${S})`}>
                  <motion.g initial={false} animate={{ y: [0, -0.035, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
                    <IsoBox x={-MCP.planeW / 2} y={MCP.planeY} z={-MCP.planeD / 2} w={MCP.planeW} h={0.05} d={MCP.planeD} pal={PAL.glass} />
                  </motion.g>
                  <g transform={`translate(${iso(agent.x, MCP.planeY + 0.06, MCP.agentZ)[0]} ${iso(agent.x, MCP.planeY + 0.06, MCP.agentZ)[1]}) ${TOP_FACE_MATRIX}`}>
                    {reduce ? (
                      [0.35, 0.7, 1.05].map((r, k) => <circle key={r} r={r} fill="none" stroke="#3bbfaf" strokeWidth={0.03} strokeOpacity={0.8 - k * 0.25} />)
                    ) : (
                      <motion.circle key={`ripple-${slot}`} r={0.3} fill="none" stroke="#3bbfaf" strokeWidth={0.04} initial={{ scale: 0.3, opacity: 0 }} animate={checking ? { scale: [0.3, 3.4], opacity: [0.9, 0] } : { opacity: 0 }} transition={{ duration: 1.0, ease: "easeOut" }} />
                    )}
                  </g>
                  {MCP.agents.map((a) => {
                    const [x1, y1] = iso(a.x, MCP.planeY + 0.05, MCP.agentZ);
                    const [x2, y2] = iso(a.x, MCP.agentY - MCP.agentSize / 2, MCP.agentZ);
                    return <line key={`g-${a.k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b9c6c2" strokeWidth={0.025} strokeDasharray="0.07 0.07" />;
                  })}
                  {MCP.agents.map((a, k) => (
                    <motion.g key={a.k} initial={false} animate={{ y: [0, -0.06, 0] }} transition={{ duration: 3.2 + k * 0.4, repeat: Infinity, ease: "easeInOut", delay: k * 0.5 }}>
                      <IsoBox x={a.x - MCP.agentSize / 2} y={MCP.agentY - MCP.agentSize / 2} z={MCP.agentZ - MCP.agentSize / 2} w={MCP.agentSize} h={MCP.agentSize} d={MCP.agentSize} pal={PAL.ink} />
                      <g transform={`translate(${iso(a.x, MCP.agentY + MCP.agentSize / 2 + 0.002, MCP.agentZ)[0]} ${iso(a.x, MCP.agentY + MCP.agentSize / 2 + 0.002, MCP.agentZ)[1]}) ${TOP_FACE_MATRIX} scale(0.7)`}>
                        <TileMark k={a.k} />
                      </g>
                    </motion.g>
                  ))}
                </g>
                {/* the request */}
                {reduce ? (
                  <>
                    <circle cx={tileTop("hubspot")[0]} cy={tileTop("hubspot")[1]} r={5} fill={SUCCESS} />
                    <circle cx={agentBottom(MCP.agents[1])[0]} cy={agentBottom(MCP.agents[1])[1]} r={5} fill={SIGNAL} />
                    <circle cx={planePt(MCP.agents[2])[0]} cy={planePt(MCP.agents[2])[1]} r={5} fill={SIGNAL} />
                  </>
                ) : (
                  <>
                    <motion.circle r={5.5} initial={false} animate={{ cx: pos[0], cy: pos[1], fill: pulseColor, opacity: jump ? 0 : pulseOpacity }} transition={jump ? { duration: 0 } : { cx: { duration: d, ease }, cy: { duration: d, ease }, fill: { duration: 0.4 }, opacity: { duration: pulseOpacity === 0 ? 0.5 : 0.01, delay: pulseOpacity === 0 ? 0.5 : 0 } }} />
                    <motion.circle key={`drop-${slot}`} r={5.5} fill={BRAND} initial={{ cx: agentBottom(agent)[0], cy: agentBottom(agent)[1], opacity: 1 }} animate={{ cx: planePt(agent)[0], cy: planePt(agent)[1], opacity: ph === 0 ? 1 : 0 }} transition={{ cx: { duration: STEP[0], ease: "easeIn" }, cy: { duration: STEP[0], ease: "easeIn" }, opacity: { duration: 0.01 } }} />
                    <motion.circle r={11} initial={false} animate={{ cx: pos[0], cy: pos[1], fill: pulseColor, opacity: ph === 0 || pulseOpacity === 0 ? 0 : [0.16, 0.3, 0.16] }} transition={{ cx: { duration: ph === 0 ? 0 : d, ease }, cy: { duration: ph === 0 ? 0 : d, ease }, fill: { duration: 0.4 }, opacity: { duration: 1.2, repeat: Infinity } }} />
                  </>
                )}
              </motion.g>
            </svg>

            {/* front: chips */}
            <motion.div className="absolute inset-0" style={{ x: L.front.x, y: L.front.y }}>
              <Chip x={W - 6} y={H - 16} w={W} h={H} tone="ink" anchor="right">
                Dexraflow MCP · check_action
              </Chip>
              {reduce
                ? MCP.requests.map((r, k) => (
                    <Chip key={k} x={8} y={18 + k * 30} w={W} h={H} tone={r.decision === "ALLOW" ? "green" : "amber"} anchor="left">
                      <span className="font-semibold tracking-[0.06em]">{r.decision}</span> · {r.why}
                    </Chip>
                  ))
                : MCP.requests.map((r, k) => {
                    const a = MCP.agents[r.agent];
                    const mine = k === slot;
                    const tile = r.target ? MCP.tiles.find((t) => t.k === r.target)! : null;
                    const after = tile ? sp(tile.x, 0.2, MCP.tileZ) : agentTop(a);
                    return (
                      <div key={k}>
                        <Chip x={agentTop(a)[0]} y={agentTop(a)[1]} w={W} h={H} tone="ink" anchor={side(r.agent)} show={mine && ph <= 1}>
                          {a.name} · {r.ask}
                        </Chip>
                        <Chip x={planePt(a)[0]} y={planePt(a)[1] + 28} w={W} h={H} tone={r.decision === "ALLOW" ? "green" : "amber"} anchor={side(r.agent)} show={mine && ph >= 2}>
                          <span className="font-semibold tracking-[0.06em]">{r.decision}</span> · {r.why}
                        </Chip>
                        <Chip x={after[0]} y={after[1]} w={W} h={H} tone={r.decision === "ALLOW" ? "green" : "amber"} anchor={tile ? "center" : side(r.agent)} show={mine && ph >= 4}>
                          {r.after}
                        </Chip>
                      </div>
                    );
                  })}
            </motion.div>
          </>
        )}
      </Stage>
    </div>
  );
}
