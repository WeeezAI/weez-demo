import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Line, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { BRAND, BRAND_NIGHT, Chip, LINE, show, SIGNAL, Tile, useCurtainAlpha } from "./sceneShared";
import { BROKEN_SEGMENT, byKey, PLANE_D, PLANE_W, PLANE_Y, ROUTE, SIDE_WIRES, T, TILE_H, TILE_SIZE, TILES } from "./sceneData";

/* The hero's WebGL scene: a translucent control plane above six GTM tools.
   One loop (11s) tells the whole pitch without words:
     1. a lead pulses Form → HubSpot → Zapier → Outreach → Slack; every handoff matches.
     2. the next lead silently drops at the Zapier → Outreach hop. No error anywhere.
     3. the plane's daily scan sweeps the grid, lights the broken tile amber and names the loss.
   All per-frame work mutates refs; React re-renders only on mount. */

const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

function Scene({ active }: { active: boolean }) {
  const world = useRef<THREE.Group>(null);
  const plane = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const pulseMat = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const beam = useRef<THREE.Group>(null);
  const rim = useRef<THREE.MeshBasicMaterial | null>(null);
  const okChip = useRef<HTMLDivElement | null>(null);
  const caughtChip = useRef<HTMLDivElement | null>(null);
  const planeChip = useRef<HTMLDivElement | null>(null);
  const alpha = useCurtainAlpha();
  const { camera, pointer } = useThree();

  const route = useMemo(() => ROUTE.map(byKey), []);
  const broken = route[BROKEN_SEGMENT];
  const y0 = TILE_H / 2 + 0.11;
  const teal = useMemo(() => new THREE.Color(BRAND), []);
  const amber = useMemo(() => new THREE.Color(SIGNAL), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    camera.lookAt(0, 0.45, 0);
  }, [camera]);

  /** Position along the route: u in [0, segments]. */
  const at = (u: number, out: THREE.Vector3) => {
    const i = Math.min(route.length - 2, Math.floor(u));
    const k = u - i;
    const A = route[i];
    const B = route[i + 1];
    out.set(A.x + (B.x - A.x) * k, y0, A.z + (B.z - A.z) * k);
  };
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!active) return;
    const t = state.clock.elapsedTime % T.period;
    const segs = route.length - 1;

    // idle drift + pointer parallax
    if (world.current) {
      const ry = pointer.x * 0.14;
      const rx = -pointer.y * 0.06;
      world.current.rotation.y += (ry - world.current.rotation.y) * 0.04;
      world.current.rotation.x += (rx - world.current.rotation.x) * 0.04;
      world.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.025;
    }
    if (plane.current) plane.current.position.y = PLANE_Y + Math.sin(state.clock.elapsedTime * 0.8 + 1) * 0.035;

    let pulseVisible = false;
    let pulseColor = teal;
    let dropK = 0;
    let scanK = -1;
    let caught = false;

    if (t < T.brokenStart) {
      // 1 · healthy run
      const u = t / T.hop;
      if (u < segs) {
        pulseVisible = true;
        at(u, v);
      }
      show(okChip.current, t >= T.okChip[0] && t <= T.okChip[1]);
      show(caughtChip.current, false);
    } else {
      // 2 · the broken run
      const tb = t - T.brokenStart;
      const u = tb / T.hop;
      const dropAt = BROKEN_SEGMENT + 0.5;
      if (u < dropAt) {
        pulseVisible = true;
        at(u, v);
      } else {
        const td = tb - dropAt * T.hop;
        if (td < T.dropDur) {
          pulseVisible = true;
          dropK = td / T.dropDur;
          at(dropAt, v);
          v.y = y0 - 1.5 * ease(dropK) * dropK;
          scratch.copy(teal).lerp(amber, Math.min(1, dropK * 2));
          pulseColor = scratch;
        }
      }
      // 3 · the scan
      if (t >= T.scan[0] && t <= T.scan[1]) scanK = (t - T.scan[0]) / (T.scan[1] - T.scan[0]);
      const beamX = T.scanFrom + (T.scanTo - T.scanFrom) * easeInOut(Math.max(0, scanK));
      caught = (scanK >= 0 && beamX >= broken.x) || t > T.scan[1];
      show(caughtChip.current, caught);
      show(okChip.current, false);
    }

    if (pulse.current && pulseMat.current && halo.current && haloMat.current) {
      pulse.current.visible = pulseVisible;
      halo.current.visible = pulseVisible;
      if (pulseVisible) {
        pulse.current.position.copy(v);
        halo.current.position.copy(v);
        pulseMat.current.color.copy(pulseColor);
        haloMat.current.color.copy(pulseColor);
        pulseMat.current.opacity = 1 - dropK * 0.9;
        haloMat.current.opacity = (0.22 + Math.sin(state.clock.elapsedTime * 6) * 0.08) * (1 - dropK);
        const s = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.08;
        halo.current.scale.setScalar(s);
      }
    }

    if (beam.current) {
      beam.current.visible = scanK >= 0;
      if (scanK >= 0) beam.current.position.x = T.scanFrom + (T.scanTo - T.scanFrom) * easeInOut(scanK);
    }
    if (rim.current) {
      const target = caught ? 0.8 : 0;
      rim.current.opacity += (target - rim.current.opacity) * 0.12;
    }
  });

  const routeLines = route.slice(0, -1).map((A, i) => {
    const B = route[i + 1];
    return { key: A.k + B.k, points: [new THREE.Vector3(A.x, TILE_H / 2 + 0.01, A.z), new THREE.Vector3(B.x, TILE_H / 2 + 0.01, B.z)] as [THREE.Vector3, THREE.Vector3], broken: i === BROKEN_SEGMENT };
  });

  return (
    <>
      <ambientLight intensity={2.3} />
      <hemisphereLight args={["#ffffff", "#e9eeec", 1.4]} />
      <directionalLight position={[3.5, 6, 4]} intensity={3.1} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 5, -5, 0.5, 20]} />
      </directionalLight>

      <group ref={world}>
        {/* floor shadow catcher */}
        <mesh rotation-x={-Math.PI / 2} position-y={-TILE_H / 2 - 0.001} receiveShadow>
          <planeGeometry args={[14, 14]} />
          <shadowMaterial transparent opacity={0.1} />
        </mesh>

        {TILES.map((t) => (
          <Tile key={t.k} k={t.k} x={t.x} z={t.z} rimRef={t.k === broken.k ? rim : undefined} />
        ))}

        {SIDE_WIRES.map(([a, b]) => {
          const A = byKey(a);
          const B = byKey(b);
          return <Line key={a + b} points={[[A.x, TILE_H / 2 + 0.01, A.z], [B.x, TILE_H / 2 + 0.01, B.z]]} color={LINE} lineWidth={1} dashed dashSize={0.08} gapSize={0.08} />;
        })}
        {routeLines.map((l) => (
          <Line key={l.key} points={l.points} color={l.broken ? "#b9c6c2" : BRAND} lineWidth={1.4} transparent opacity={l.broken ? 0.9 : 0.55} />
        ))}

        {/* the lead */}
        <mesh ref={pulse} visible={false}>
          <sphereGeometry args={[0.07, 24, 24]} />
          <meshBasicMaterial ref={pulseMat} color={BRAND} transparent toneMapped={false} />
        </mesh>
        <mesh ref={halo} visible={false}>
          <sphereGeometry args={[0.16, 24, 24]} />
          <meshBasicMaterial ref={haloMat} color={BRAND} transparent opacity={0.25} toneMapped={false} depthWrite={false} />
        </mesh>

        {/* the scan beam: a bright rule under the plane and a soft curtain to the floor */}
        <group ref={beam} visible={false}>
          <mesh position-y={PLANE_Y - 0.045}>
            <boxGeometry args={[0.025, 0.02, PLANE_D]} />
            <meshBasicMaterial color={BRAND_NIGHT} toneMapped={false} />
          </mesh>
          <mesh position-y={PLANE_Y / 2 - 0.03} rotation-y={Math.PI / 2}>
            <planeGeometry args={[PLANE_D, PLANE_Y - 0.06]} />
            <meshBasicMaterial color={BRAND} transparent opacity={0.16} alphaMap={alpha} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>

        {/* the control plane */}
        <group ref={plane} position-y={PLANE_Y}>
          <RoundedBox args={[PLANE_W, 0.05, PLANE_D]} radius={0.025} smoothness={3}>
            <meshPhysicalMaterial color="#d6eee9" transparent opacity={0.3} roughness={0.08} metalness={0} clearcoat={1} clearcoatRoughness={0.1} reflectivity={0.7} side={THREE.DoubleSide} depthWrite={false} />
            <Edges color={BRAND} threshold={30}>
              <lineBasicMaterial color={BRAND} transparent opacity={1} />
            </Edges>
          </RoundedBox>
          <Chip el={planeChip} tone="ink" visible anchor="left" position={[-PLANE_W / 2 + 0.2, 0.28, PLANE_D / 2 - 0.3]}>
            Dexraflow · daily check
          </Chip>
        </group>

        <Chip el={okChip} tone="green" position={[byKey("slack").x, 0.85, byKey("slack").z]}>
          208 leads · every handoff matched
        </Chip>
        <Chip el={caughtChip} tone="amber" anchor="right" position={[broken.x + 0.35, 0.95, broken.z]}>
          37 leads never reached Outreach
        </Chip>
      </group>
    </>
  );
}

export default function ControlPlaneScene({ active, onReady }: { active: boolean; onReady?: () => void }) {
  return (
    <Canvas
      flat
      shadows
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 26, position: [4.45, 3.9, 5.9], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        onReady?.();
      }}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <Scene active={active} />
    </Canvas>
  );
}
