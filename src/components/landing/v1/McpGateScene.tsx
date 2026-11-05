import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { BRAND, BRAND_NIGHT, Chip, LINE, show, SIGNAL, SUCCESS, Tile } from "./sceneShared";
import { MCP, TILE_H } from "./sceneData";
import type { SceneProps } from "./LazyScene";

/* The MCP explainer: how an agent's action passes through Dexraflow.
   Three agents sit above the plane, four tools sit below it. In each 4.8s slot one agent asks
   (a pulse drops to the plane), the plane checks every tool (a ripple, probe lines, tiles flash),
   answers ALLOW / HOLD / WAIT, then either writes through to the tool and logs it, sends the
   request back up to the agent, or holds it in place. `onPhase` reports 0..3 so the copy beside
   the scene can follow along. */

const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
/** A short flash: rises over `up`, falls over `down`. */
const flash = (t: number, at: number, up = 0.12, down = 0.45) => (t < at ? 0 : t < at + up ? (t - at) / up : t < at + up + down ? 1 - (t - at - up) / down : 0);

/** A ref that reads and writes one index of a ref-held array. */
const slot = <T,>(arr: React.MutableRefObject<(T | null)[]>, i: number): React.MutableRefObject<T | null> => ({
  get current() {
    return arr.current[i] ?? null;
  },
  set current(v: T | null) {
    arr.current[i] = v;
  },
});
const DECISION_TONE = { ALLOW: "green", HOLD: "amber", WAIT: "amber" } as const;

function Scene({ active, onPhase }: SceneProps) {
  const world = useRef<THREE.Group>(null);
  const plane = useRef<THREE.Group>(null);
  const agents = useRef<(THREE.Group | null)[]>([]);
  const pulse = useRef<THREE.Mesh>(null);
  const pulseMat = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const ripple = useRef<THREE.Mesh>(null);
  const rippleMat = useRef<THREE.MeshBasicMaterial>(null);
  const probes = useRef<(THREE.Object3D | null)[]>([]);
  const tileRims = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const askChips = useRef<(HTMLDivElement | null)[]>([]);
  const decideChips = useRef<(HTMLDivElement | null)[]>([]);
  const afterChips = useRef<(HTMLDivElement | null)[]>([]);
  const lastPhase = useRef(-1);
  const { camera, pointer } = useThree();

  const colors = useMemo(() => ({ teal: new THREE.Color(BRAND), allow: new THREE.Color(SUCCESS), hold: new THREE.Color(SIGNAL), scratch: new THREE.Color() }), []);
  const v = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    camera.lookAt(0, 0.95, 0);
  }, [camera]);

  const period = MCP.slot * MCP.requests.length;

  useFrame((state) => {
    if (!active) return;
    const e = state.clock.elapsedTime;
    const t = e % period;
    const slot = Math.min(MCP.requests.length - 1, Math.floor(t / MCP.slot));
    const lt = t - slot * MCP.slot;
    const req = MCP.requests[slot];
    const ag = MCP.agents[req.agent];
    const T = MCP.t;

    // idle drift + pointer parallax
    if (world.current) {
      world.current.rotation.y += (pointer.x * 0.12 - world.current.rotation.y) * 0.04;
      world.current.rotation.x += (-pointer.y * 0.05 - world.current.rotation.x) * 0.04;
    }
    if (plane.current) plane.current.position.y = MCP.planeY + Math.sin(e * 0.8) * 0.03;
    agents.current.forEach((g, i) => {
      if (g) g.position.y = MCP.agentY + Math.sin(e * 0.9 + i * 1.7) * 0.05;
    });

    // phases
    const phase = lt < T.ask ? 0 : lt < T.check ? 1 : lt < T.decide ? 2 : 3;
    if (phase !== lastPhase.current) {
      lastPhase.current = phase;
      onPhase?.(phase);
    }

    // chips
    MCP.requests.forEach((r, i) => {
      const mine = i === slot;
      show(askChips.current[i], mine && lt < T.check);
      show(decideChips.current[i], mine && lt >= T.decide - 0.1 && lt < T.hide);
      show(afterChips.current[i], mine && lt >= T.act - 0.25 && lt < T.hide);
    });

    // the pulse
    const top = MCP.agentY - MCP.agentSize / 2 - 0.05;
    const onPlane = MCP.planeY + 0.09;
    const color = req.decision === "ALLOW" ? colors.allow : colors.hold;
    let visible = true;
    let col: THREE.Color = colors.teal;
    if (lt < T.ask) {
      v.set(ag.x, top + (onPlane - top) * ease(lt / T.ask), MCP.agentZ);
    } else if (lt < T.decide) {
      v.set(ag.x, onPlane, MCP.agentZ);
      const k = clamp01((lt - T.check) / (T.decide - T.check));
      colors.scratch.copy(colors.teal).lerp(color, k);
      col = colors.scratch;
    } else if (lt < T.act) {
      const k = easeInOut(clamp01((lt - T.decide) / (T.act - T.decide)));
      col = color;
      if (req.decision === "ALLOW" && req.target) {
        const tile = MCP.tiles.find((x) => x.k === req.target)!;
        v.set(ag.x + (tile.x - ag.x) * k, onPlane + (TILE_H / 2 + 0.1 - onPlane) * k, MCP.agentZ + (MCP.tileZ - MCP.agentZ) * k);
      } else if (req.decision === "HOLD") {
        v.set(ag.x, onPlane + (top - onPlane) * k, MCP.agentZ);
      } else {
        v.set(ag.x, onPlane + Math.sin(e * 5) * 0.03, MCP.agentZ);
      }
    } else if (lt < T.hide) {
      col = color;
      if (req.decision === "ALLOW" && req.target) {
        const tile = MCP.tiles.find((x) => x.k === req.target)!;
        v.set(tile.x, TILE_H / 2 + 0.1, MCP.tileZ);
      } else if (req.decision === "HOLD") v.set(ag.x, top, MCP.agentZ);
      else v.set(ag.x, onPlane + Math.sin(e * 5) * 0.03, MCP.agentZ);
      visible = lt < T.hide - 0.3 || req.decision === "WAIT";
    } else visible = false;

    if (pulse.current && pulseMat.current && halo.current && haloMat.current) {
      pulse.current.visible = visible;
      halo.current.visible = visible;
      pulse.current.position.copy(v);
      halo.current.position.copy(v);
      pulseMat.current.color.copy(col);
      haloMat.current.color.copy(col);
      haloMat.current.opacity = 0.22 + Math.sin(e * 6) * 0.08;
      halo.current.scale.setScalar(1 + Math.sin(e * 6) * 0.08);
    }

    // the check: ripple on the plane, probes to the tools, tools flash in turn
    const ck = clamp01((lt - T.ask) / (T.check - T.ask));
    const checking = lt >= T.ask && lt < T.check;
    if (ripple.current && rippleMat.current) {
      ripple.current.visible = checking;
      ripple.current.position.set(ag.x, MCP.planeY + 0.04, MCP.agentZ);
      const s = 0.3 + ease(ck) * 3.2;
      ripple.current.scale.set(s, s, 1);
      rippleMat.current.opacity = (1 - ck) * 0.8;
    }
    MCP.tiles.forEach((_, i) => {
      const f = checking ? flash(lt, T.ask + 0.12 + i * 0.18, 0.1, 0.5) : 0;
      const rim = tileRims.current[i];
      if (rim) rim.opacity += (f * 0.7 - rim.opacity) * 0.3;
      MCP.agents.forEach((_a, a) => {
        const line = probes.current[a * MCP.tiles.length + i];
        if (line) {
          const mat = (line as THREE.Mesh).material as THREE.Material & { opacity: number };
          mat.opacity = a === req.agent ? f * 0.9 : 0;
        }
      });
    });
  });

  const probeLines = MCP.agents.flatMap((a) => MCP.tiles.map((tile) => ({ key: `${a.k}-${tile.k}`, points: [new THREE.Vector3(a.x, MCP.planeY - 0.02, MCP.agentZ), new THREE.Vector3(tile.x, TILE_H / 2 + 0.01, MCP.tileZ)] as [THREE.Vector3, THREE.Vector3] })));

  return (
    <>
      <ambientLight intensity={2.3} />
      <hemisphereLight args={["#ffffff", "#e9eeec", 1.4]} />
      <directionalLight position={[3.5, 7, 4]} intensity={3.1} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 0.5, 24]} />
      </directionalLight>

      <group ref={world}>
        <mesh rotation-x={-Math.PI / 2} position-y={-TILE_H / 2 - 0.001} receiveShadow>
          <planeGeometry args={[16, 16]} />
          <shadowMaterial transparent opacity={0.1} />
        </mesh>

        {/* the tools */}
        {MCP.tiles.map((tile, i) => (
          <Tile key={tile.k} k={tile.k} x={tile.x} z={MCP.tileZ} rimRef={slot(tileRims, i)} rimColor={BRAND} />
        ))}

        {/* probes from the plane to each tool, lit only while checking */}
        {probeLines.map((l, i) => (
          <Line key={l.key} ref={(el) => (probes.current[i] = el)} points={l.points} color={BRAND} lineWidth={1.2} transparent opacity={0} depthWrite={false} />
        ))}

        {/* the plane */}
        <group ref={plane} position-y={MCP.planeY}>
          <RoundedBox args={[MCP.planeW, 0.05, MCP.planeD]} radius={0.025} smoothness={3}>
            <meshPhysicalMaterial color="#d6eee9" transparent opacity={0.3} roughness={0.08} metalness={0} clearcoat={1} clearcoatRoughness={0.1} reflectivity={0.7} side={THREE.DoubleSide} depthWrite={false} />
            <Edges color={BRAND} threshold={30}>
              <lineBasicMaterial color={BRAND} transparent opacity={1} />
            </Edges>
          </RoundedBox>
          <Chip el={{ current: null }} tone="ink" visible anchor="right" position={[MCP.planeW / 2 - 0.15, 0.3, -MCP.planeD / 2 + 0.25]}>
            Dexraflow MCP · check_action
          </Chip>
        </group>
        <mesh ref={ripple} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.3, 0.345, 64]} />
          <meshBasicMaterial ref={rippleMat} color={BRAND_NIGHT} transparent opacity={0} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>

        {/* the agents */}
        {MCP.agents.map((a, i) => (
          <group key={a.k} ref={(el) => (agents.current[i] = el)} position={[0, MCP.agentY, 0]}>
            <Tile k={a.k} x={a.x} z={MCP.agentZ} size={MCP.agentSize} height={MCP.agentSize} color="#0f1a1f" edge="#2f4148" mark={0.34} />
          </group>
        ))}
        {MCP.agents.map((a) => (
          <Line key={`guide-${a.k}`} points={[[a.x, MCP.agentY - MCP.agentSize / 2, MCP.agentZ], [a.x, MCP.planeY + 0.03, MCP.agentZ]]} color={LINE} lineWidth={1} dashed dashSize={0.07} gapSize={0.07} />
        ))}

        {/* the request */}
        <mesh ref={pulse} visible={false}>
          <sphereGeometry args={[0.075, 24, 24]} />
          <meshBasicMaterial ref={pulseMat} color={BRAND} toneMapped={false} />
        </mesh>
        <mesh ref={halo} visible={false}>
          <sphereGeometry args={[0.17, 24, 24]} />
          <meshBasicMaterial ref={haloMat} color={BRAND} transparent opacity={0.25} toneMapped={false} depthWrite={false} />
        </mesh>

        {/* chips: what was asked, what was decided, what happened next */}
        {MCP.requests.map((r, i) => {
          const a = MCP.agents[r.agent];
          const tile = r.target ? MCP.tiles.find((x) => x.k === r.target)! : null;
          const afterPos: [number, number, number] = tile ? [tile.x, 0.7, MCP.tileZ] : [a.x, MCP.agentY + 0.5, MCP.agentZ];
          // chips at the outer agents grow inward so nothing clips at the frame edge
          const side = (r.agent === 0 ? "left" : r.agent === 2 ? "right" : "center") as "left" | "right" | "center";
          return (
            <group key={i}>
              <Chip el={slot(askChips, i)} tone="ink" anchor={side} position={[a.x, MCP.agentY + 0.5, MCP.agentZ]}>
                {a.name} · {r.ask}
              </Chip>
              <Chip el={slot(decideChips, i)} tone={DECISION_TONE[r.decision]} anchor={side} position={[a.x, MCP.planeY + 0.55, MCP.agentZ]}>
                <span className="font-semibold tracking-[0.06em]">{r.decision}</span> · {r.why}
              </Chip>
              <Chip el={slot(afterChips, i)} tone={r.decision === "ALLOW" ? "green" : "amber"} anchor={tile ? "center" : side} position={afterPos}>
                {r.after}
              </Chip>
            </group>
          );
        })}
      </group>
    </>
  );
}

export default function McpGateScene({ active, onReady, onPhase }: SceneProps) {
  return (
    <Canvas
      flat
      shadows
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 26, position: [6.3, 5.4, 8.4], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        onReady?.();
      }}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <Scene active={active} onPhase={onPhase} />
    </Canvas>
  );
}
