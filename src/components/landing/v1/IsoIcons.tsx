import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { boxFaces, PAL, TOP_FACE_MATRIX, toScreen, type IsoPalette } from "./iso";

/* Isometric, 3D-style icons drawn in SVG, each telling one small story from the page.
   They are built from a single box primitive so the light direction, stroke and palette stay
   consistent across the set. Motion is gentle, loops slowly, and switches off with
   prefers-reduced-motion (the icons then show their resolved state). */

/* ───────────── primitives ───────────── */

export function IsoBox({ x, y, z, w, h, d, pal, opacity = 1, dashed = false }: { x: number; y: number; z: number; w: number; h: number; d: number; pal: IsoPalette; opacity?: number; dashed?: boolean }) {
  const f = boxFaces(x, y, z, w, h, d);
  if (dashed)
    return (
      <g opacity={opacity} fill="none" stroke={pal.left} strokeWidth={0.07} strokeDasharray="0.14 0.1" strokeLinejoin="round">
        <polygon points={f.left} />
        <polygon points={f.right} />
        <polygon points={f.top} />
      </g>
    );
  return (
    <g opacity={opacity}>
      <polygon points={f.left} fill={pal.left} />
      <polygon points={f.right} fill={pal.right} />
      <polygon points={f.top} fill={pal.top} />
      {pal.stroke && <polygon points={f.top} fill="none" stroke={pal.stroke} strokeWidth={0.04} strokeLinejoin="round" />}
    </g>
  );
}

/** 48×48 frame; `scale` is pixels per world unit, `cy` the vertical anchor of the world origin. */
function Frame({ size, scale, cy = 30, label, children }: { size: number; scale: number; cy?: number; label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={label} className="shrink-0 overflow-visible">
      <g transform={`translate(24 ${cy}) scale(${scale})`}>{children}</g>
    </svg>
  );
}

const Shadow = ({ rx = 1.6, ry = 0.8, cx = 0, cy = 0, opacity = 0.14 }: { rx?: number; ry?: number; cx?: number; cy?: number; opacity?: number }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#0f1a1f" opacity={opacity} />
);

type IconProps = { size?: number };

/* ───────────── 01 · a workflow stopped ───────────── */

export function IsoStopped({ size = 56 }: IconProps) {
  const reduce = useReducedMotion();
  const step = toScreen(0.95, 0, 0);
  return (
    <Frame size={size} scale={11} cy={28} label="A conveyor of leads with a gap where the next one should be">
      <Shadow rx={2.4} ry={1.2} cy={0.9} />
      <IsoBox x={-1.7} y={0} z={-0.5} w={3.4} h={0.12} d={1} pal={PAL.tile} />
      {[0, 1].map((i) => (
        <motion.g
          key={i}
          initial={false}
          animate={reduce ? { x: step.x, y: step.y, opacity: 1 } : { x: [0, step.x, step.x, step.x], y: [0, step.y, step.y, step.y], opacity: [0, 1, 1, 0] }}
          transition={reduce ? undefined : { duration: 3.2, times: [0, 0.4, 0.85, 1], ease: ["easeOut", "linear", "linear"], repeat: Infinity, delay: i * 0.15 }}
        >
          <IsoBox x={-1.55 + i * 0.95 - 0.95} y={0.12} z={-0.25} w={0.5} h={0.5} d={0.5} pal={PAL.brand} />
        </motion.g>
      ))}
      <IsoBox x={0.95} y={0.12} z={-0.25} w={0.5} h={0.5} d={0.5} pal={PAL.amber} dashed />
      <motion.circle
        cx={toScreen(1.2, 1.25, 0).x}
        cy={toScreen(1.2, 1.25, 0).y}
        r={0.16}
        fill={PAL.amber.left}
        initial={false}
        animate={reduce ? { opacity: 1 } : { opacity: [0.2, 1, 0.2], scale: [0.9, 1.1, 0.9] }}
        transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </Frame>
  );
}

/* ───────────── 02 · form fills that never became leads ───────────── */

function Sheet({ y, pal, lines = true }: { y: number; pal: IsoPalette; lines?: boolean }) {
  return (
    <g>
      <IsoBox x={-0.65} y={y} z={-0.8} w={1.3} h={0.08} d={1.6} pal={pal} />
      {lines && (
        <g transform={`translate(${toScreen(-0.45, y + 0.085, -0.55).x} ${toScreen(-0.45, y + 0.085, -0.55).y}) ${TOP_FACE_MATRIX}`} stroke="rgba(15,26,31,0.35)" strokeWidth={0.07} strokeLinecap="round">
          <line x1={0} y1={0} x2={0.9} y2={0} />
          <line x1={0} y1={0.3} x2={0.7} y2={0.3} />
          <line x1={0} y1={0.6} x2={0.8} y2={0.6} />
          <rect x={0} y={0.85} width={0.45} height={0.22} rx={0.05} fill={PAL.brand.left} stroke="none" />
        </g>
      )}
    </g>
  );
}

export function IsoFormDrop({ size = 56 }: IconProps) {
  const reduce = useReducedMotion();
  const fall = toScreen(1.1, -1.2, 0.3);
  return (
    <Frame size={size} scale={11} cy={26} label="A stack of form submissions with the top sheet slipping off">
      <Shadow rx={2} ry={1} cy={0.9} />
      <Sheet y={0} pal={PAL.tile} />
      <Sheet y={0.14} pal={PAL.tile} />
      <Sheet y={0.28} pal={PAL.tile} />
      <motion.g
        initial={false}
        animate={reduce ? { x: fall.x * 0.5, y: fall.y * 0.5, rotate: -10, opacity: 1 } : { x: [0, 0, fall.x], y: [0, 0, fall.y], rotate: [0, 0, -14], opacity: [1, 1, 0] }}
        transition={reduce ? undefined : { duration: 3.4, times: [0, 0.45, 1], ease: ["linear", "easeIn"], repeat: Infinity }}
        style={{ transformOrigin: "0px 0px" }}
      >
        <Sheet y={0.42} pal={PAL.amber} lines={false} />
      </motion.g>
    </Frame>
  );
}

/* ───────────── 03 · leads with no owner ───────────── */

export function IsoNoOwner({ size = 56 }: IconProps) {
  const reduce = useReducedMotion();
  const lead = toScreen(0.5, 1.25, 0.5);
  return (
    <Frame size={size} scale={11} cy={30} label="An empty seat with a lead hovering above it, waiting for an owner">
      <Shadow rx={1.8} ry={0.9} cx={0} cy={0.9} />
      <IsoBox x={0} y={0} z={0} w={1} h={0.35} d={1} pal={PAL.tile} />
      <IsoBox x={0} y={0.35} z={0} w={1} h={0.9} d={0.18} pal={PAL.tile} />
      <ellipse cx={toScreen(0.5, 0.36, 0.55).x} cy={toScreen(0.5, 0.36, 0.55).y} rx={0.3} ry={0.15} fill="#0f1a1f" opacity={0.12} />
      <motion.g initial={false} animate={reduce ? {} : { y: [0, -0.22, 0] }} transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
        <circle cx={lead.x} cy={lead.y} r={0.22} fill={PAL.amber.left} />
        <motion.circle
          cx={lead.x}
          cy={lead.y}
          r={0.22}
          fill="none"
          stroke={PAL.amber.left}
          strokeWidth={0.05}
          initial={false}
          animate={reduce ? { opacity: 0 } : { scale: [1, 2.6], opacity: [0.6, 0] }}
          transition={reduce ? undefined : { duration: 2, repeat: Infinity, ease: "easeOut" }}
          style={{ transformOrigin: `${lead.x}px ${lead.y}px` }}
        />
      </motion.g>
    </Frame>
  );
}

/* ───────────── 04 · hot leads with no follow-up ───────────── */

export function IsoHotLead({ size = 56 }: IconProps) {
  const reduce = useReducedMotion();
  const top = toScreen(0, 0.95, 0);
  return (
    <Frame size={size} scale={11} cy={30} label="A hot lead pulsing on a block while a small clock keeps turning">
      <Shadow rx={1.8} ry={0.9} cy={0.9} />
      <IsoBox x={-0.5} y={0} z={-0.5} w={1} h={0.6} d={1} pal={PAL.brand} />
      {[0, 1].map((i) => (
        <motion.ellipse
          key={i}
          cx={toScreen(0, 0.61, 0).x}
          cy={toScreen(0, 0.61, 0).y}
          rx={0.3}
          ry={0.15}
          fill="none"
          stroke={PAL.amber.left}
          strokeWidth={0.06}
          initial={false}
          animate={reduce ? { opacity: 0.5, scale: 2 } : { scale: [1, 3.2], opacity: [0.7, 0] }}
          transition={reduce ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeOut", delay: i * 1.1 }}
          style={{ transformOrigin: `${toScreen(0, 0.61, 0).x}px ${toScreen(0, 0.61, 0).y}px` }}
        />
      ))}
      <circle cx={top.x} cy={top.y} r={0.26} fill={PAL.amber.left} />
      <circle cx={top.x} cy={top.y} r={0.1} fill="#fff6e8" />
      {/* the clock */}
      <g transform="translate(1.25 -1.15)">
        <circle r={0.42} fill="#ffffff" stroke="rgba(15,26,31,0.35)" strokeWidth={0.06} />
        <motion.line x1={0} y1={0} x2={0} y2={-0.28} stroke="#0f1a1f" strokeWidth={0.07} strokeLinecap="round" initial={false} animate={reduce ? { rotate: 120 } : { rotate: 360 }} transition={reduce ? undefined : { duration: 4, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "0px 0px" }} />
        <line x1={0} y1={0} x2={0.2} y2={0} stroke="#0f1a1f" strokeWidth={0.07} strokeLinecap="round" />
      </g>
    </Frame>
  );
}

/* ───────────── vision · now: catch ───────────── */

export function IsoRadar({ size = 64 }: IconProps) {
  const reduce = useReducedMotion();
  const c = toScreen(0, 0.13, 0);
  return (
    <Frame size={size} scale={11} cy={26} label="A radar disc with a sweep passing over a lead">
      <Shadow rx={2.2} ry={1.1} cy={0.6} />
      <IsoBox x={-1.4} y={0} z={-1.4} w={2.8} h={0.12} d={2.8} pal={PAL.tile} />
      <g transform={`translate(${c.x} ${c.y}) ${TOP_FACE_MATRIX}`}>
        {[0.45, 0.85, 1.25].map((r) => (
          <circle key={r} r={r} fill="none" stroke="rgba(11,110,105,0.35)" strokeWidth={0.05} />
        ))}
        <motion.path d="M0 0 L1.25 0 A1.25 1.25 0 0 0 0.6 -1.1 Z" fill="url(#iso-sweep)" initial={false} animate={reduce ? { rotate: 200 } : { rotate: 360 }} transition={reduce ? undefined : { duration: 3.6, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "0px 0px" }} />
        <circle r={0.09} fill={PAL.brand.left} />
        <motion.circle cx={0.55} cy={-0.7} r={0.14} fill={PAL.amber.left} initial={false} animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 1, 0.15, 0.15] }} transition={reduce ? undefined : { duration: 3.6, times: [0, 0.05, 0.4, 0.6, 1], repeat: Infinity, ease: "linear" }} />
      </g>
      <defs>
        <linearGradient id="iso-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0b6e69" stopOpacity="0.45" />
          <stop offset="1" stopColor="#0b6e69" stopOpacity="0" />
        </linearGradient>
      </defs>
    </Frame>
  );
}

/* ───────────── vision · next: warn before a change breaks something ───────────── */

export function IsoShield({ size = 64 }: IconProps) {
  const reduce = useReducedMotion();
  const from = toScreen(1.4, 0, 0);
  return (
    <Frame size={size} scale={11} cy={30} label="A change moving toward a workflow and stopping at a translucent barrier">
      <Shadow rx={2.2} ry={1.1} cy={0.6} />
      <IsoBox x={-1.6} y={0} z={-0.6} w={3.2} h={0.12} d={1.2} pal={PAL.tile} />
      <IsoBox x={-1.2} y={0.12} z={-0.3} w={0.6} h={0.6} d={0.6} pal={PAL.brand} />
      <motion.g
        initial={false}
        animate={reduce ? { x: from.x * 0.15, y: from.y * 0.15 } : { x: [from.x, from.x * 0.1, from.x * 0.22, from.x * 0.12, from.x * 0.12, from.x], y: [from.y, from.y * 0.1, from.y * 0.22, from.y * 0.12, from.y * 0.12, from.y], opacity: [0, 1, 1, 1, 1, 0] }}
        transition={reduce ? undefined : { duration: 3.6, times: [0, 0.3, 0.38, 0.46, 0.85, 1], ease: "easeOut", repeat: Infinity }}
      >
        <IsoBox x={0.25} y={0.12} z={-0.3} w={0.6} h={0.6} d={0.6} pal={PAL.amber} />
      </motion.g>
      <IsoBox x={-0.2} y={0.12} z={-0.75} w={0.08} h={1.3} d={1.5} pal={PAL.glass} />
      <motion.polygon
        points={boxFaces(-0.2, 0.12, -0.75, 0.08, 1.3, 1.5).left}
        fill="#0b6e69"
        initial={false}
        animate={reduce ? { opacity: 0.1 } : { opacity: [0, 0, 0.35, 0.08, 0.08, 0] }}
        transition={reduce ? undefined : { duration: 3.6, times: [0, 0.3, 0.36, 0.5, 0.85, 1], repeat: Infinity }}
      />
    </Frame>
  );
}

/* ───────────── vision · then: every AI agent checks Dexraflow first ───────────── */

export function IsoAgents({ size = 64 }: IconProps) {
  const reduce = useReducedMotion();
  const xs = [-1, 0, 1];
  return (
    <Frame size={size} scale={10} cy={34} label="Three agents beneath a plane, each sending a check up to it before acting">
      <Shadow rx={2.6} ry={1.3} cy={0.6} />
      {xs.map((x) => (
        <IsoBox key={x} x={x - 0.25} y={0} z={-0.25} w={0.5} h={0.5} d={0.5} pal={PAL.ink} />
      ))}
      {xs.map((x, i) => {
        const a = toScreen(x, 0.55, 0);
        const b = toScreen(x, 1.3, 0);
        return (
          <g key={x}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(11,110,105,0.25)" strokeWidth={0.05} strokeDasharray="0.1 0.1" />
            <motion.circle
              cx={a.x}
              r={0.11}
              fill={PAL.brand.top}
              initial={false}
              animate={reduce ? { cy: b.y, opacity: 1 } : { cy: [a.y, b.y, b.y], opacity: [0, 1, 0] }}
              transition={reduce ? undefined : { duration: 2.4, times: [0, 0.6, 1], repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
            />
          </g>
        );
      })}
      <IsoBox x={-1.7} y={1.3} z={-0.9} w={3.4} h={0.07} d={1.8} pal={PAL.glass} />
      <circle cx={toScreen(-1.35, 1.4, -0.6).x} cy={toScreen(-1.35, 1.4, -0.6).y} r={0.1} fill={PAL.brand.left} />
    </Frame>
  );
}
