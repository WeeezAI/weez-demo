import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * AnimatedBackground — a LIGHT "deep space" ambient backdrop.
 *
 * The page stays bright (pale lavender-white), but the atmosphere is cosmic:
 *  - Slow nebula clouds in indigo / violet / cyan
 *  - A drifting starfield (dark pinpricks, so stars read on a light page)
 *  - A faint star-chart grid, radially masked
 *  - One slow comet streak
 *
 * Respects prefers-reduced-motion: nebulae hold still and the starfield and
 * comet are dropped entirely.
 */

type Nebula = {
  className: string;
  color: string;
  duration: number;
  x: number[];
  y: number[];
};

const NEBULAE: Nebula[] = [
  {
    className: "w-[48rem] h-[48rem] -top-60 -left-44",
    color: "from-indigo-400/30",
    duration: 26,
    x: [0, 60, -20, 0],
    y: [0, 40, 80, 0],
  },
  {
    className: "w-[42rem] h-[42rem] top-28 -right-44",
    color: "from-violet-400/28",
    duration: 30,
    x: [0, -50, 30, 0],
    y: [0, 60, -30, 0],
  },
  {
    className: "w-[36rem] h-[36rem] bottom-0 left-1/3",
    color: "from-cyan-300/28",
    duration: 34,
    x: [0, 40, -40, 0],
    y: [0, -50, 30, 0],
  },
  {
    className: "w-[30rem] h-[30rem] top-1/2 left-8",
    color: "from-fuchsia-300/20",
    duration: 38,
    x: [0, 30, -30, 0],
    y: [0, -40, 20, 0],
  },
];

/** Stars are dark-on-light so they stay visible against the bright page. */
function Starfield({ count = 60 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2.2 + 1,
        duration: Math.random() * 5 + 3,
        delay: Math.random() * 6,
        indigo: Math.random() > 0.45,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <motion.span
          key={s.id}
          className={`absolute rounded-full ${s.indigo ? "bg-indigo-500/45" : "bg-violet-500/35"}`}
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
          animate={{ opacity: [0.15, 0.85, 0.15], scale: [1, 1.35, 1] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function Comet() {
  return (
    <motion.div
      className="pointer-events-none absolute left-[-12%] top-[12%] h-px w-40 origin-left"
      style={{
        background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.55), rgba(34,211,238,0.75))",
      }}
      animate={{ x: ["0vw", "125vw"], y: ["0vh", "42vh"], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 7, repeat: Infinity, repeatDelay: 11, ease: "easeIn" }}
    />
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
      {/* Base wash — a bright sky with cosmic tint, never dark. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.14),transparent_58%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.12),transparent_58%),radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.10),transparent_55%)]" />

      {/* Drifting nebula clouds */}
      {NEBULAE.map((n, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[140px] ${n.className}`}
          animate={reduce ? undefined : { x: n.x, y: n.y }}
          transition={{ duration: n.duration, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className={`h-full w-full rounded-full bg-gradient-to-br ${n.color} to-transparent`} />
        </motion.div>
      ))}

      {/* Star-chart grid */}
      <div
        className="absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_74%)]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(79,70,229,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.05) 1px, transparent 1px)",
          backgroundSize: "58px 58px",
        }}
      />

      {particles && !reduce && (
        <>
          <Starfield />
          <Comet />
        </>
      )}
    </div>
  );
}
