import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * AnimatedBackground
 * ------------------
 * A reusable, GPU-friendly ambient background for the landing page.
 *  - Slowly drifting gradient orbs (brand blue / violet / cyan)
 *  - Floating particle field
 *  - Subtle animated grid with a radial mask
 *
 * Respects prefers-reduced-motion: falls back to a static gradient.
 */

type Orb = {
  className: string;
  color: string;
  duration: number;
  x: number[];
  y: number[];
};

const ORBS: Orb[] = [
  {
    className: "w-[46rem] h-[46rem] -top-56 -left-40",
    color: "from-blue-500/35",
    duration: 22,
    x: [0, 60, -20, 0],
    y: [0, 40, 80, 0],
  },
  {
    className: "w-[40rem] h-[40rem] top-32 -right-40",
    color: "from-violet-500/30",
    duration: 26,
    x: [0, -50, 30, 0],
    y: [0, 60, -30, 0],
  },
  {
    className: "w-[34rem] h-[34rem] bottom-0 left-1/3",
    color: "from-cyan-400/25",
    duration: 30,
    x: [0, 40, -40, 0],
    y: [0, -50, 30, 0],
  },
];

function Particles({ count = 34 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2.5 + 1,
        duration: Math.random() * 14 + 12,
        delay: Math.random() * 10,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-blue-500/30"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            boxShadow: "0 0 10px rgba(59,130,246,0.35)",
          }}
          animate={{ y: [0, -40, 0], opacity: [0, 0.9, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default function AnimatedBackground({
  particles = true,
  className = "",
}: {
  particles?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <div className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}>
      {/* Base wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.08),transparent_55%)]" />

      {/* Drifting orbs */}
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[130px] ${orb.className}`}
          animate={reduce ? undefined : { x: orb.x, y: orb.y }}
          transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className={`w-full h-full rounded-full bg-gradient-to-br ${orb.color} to-transparent`} />
        </motion.div>
      ))}

      {/* Animated grid */}
      <div
        className="absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.045) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
        }}
      />

      {/* Particles */}
      {particles && !reduce && <Particles />}
    </div>
  );
}
