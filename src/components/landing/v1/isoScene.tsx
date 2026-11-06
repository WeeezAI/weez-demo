/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";

/* Shared pieces for the animated isometric scenes: a phase loop that only runs on screen,
   a DOM chip pinned to a viewBox point, and a stage that parallaxes its layers with the pointer. */

/** Steps through phases with the given durations (seconds) while `active`; holds on the last phase under reduced motion. */
export function useLoop(durations: readonly number[], active: boolean, reduce: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce || !active) return;
    let idx = 0;
    let id = 0;
    setI(0);
    const step = () => {
      id = window.setTimeout(() => {
        idx = (idx + 1) % durations.length;
        setI(idx);
        step();
      }, durations[idx] * 1000);
    };
    step();
    return () => window.clearTimeout(id);
  }, [active, reduce, durations]);
  return reduce ? durations.length - 1 : i;
}

export function useStageInView() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduce = !!useReducedMotion();
  return { ref, inView, reduce };
}

const TONES = {
  ink: "bg-dx-ink text-white",
  amber: "border border-dx-signal/50 bg-dx-signal-soft text-dx-signal-ink",
  green: "border border-dx-success/30 bg-dx-success-soft text-dx-success",
  teal: "border border-dx-brand/30 bg-dx-brand-soft text-dx-brand",
};
const DOTS = { ink: "bg-dx-brand-night", amber: "bg-dx-signal", green: "bg-dx-success", teal: "bg-dx-brand" };
const SHIFT = { center: "translate(-50%, -50%)", left: "translate(0, -50%)", right: "translate(-100%, -50%)" };

/** A chip pinned to a point of the stage's viewBox, in real DOM so the type stays crisp. */
export function Chip({ x, y, w, h, show = true, tone = "ink", anchor = "center", layer, children }: { x: number; y: number; w: number; h: number; show?: boolean; tone?: keyof typeof TONES; anchor?: keyof typeof SHIFT; layer?: ReactNode; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: `${(x / w) * 100}%`, top: `${(y / h) * 100}%`, transform: SHIFT[anchor] }}>
      <motion.div
        className={`flex items-center gap-2 whitespace-nowrap rounded-[6px] px-2.5 py-1 font-dx-mono text-[11px] font-medium tracking-[0.02em] shadow-[0_6px_20px_-10px_rgba(15,26,31,0.35)] ${TONES[tone]}`}
        initial={false}
        animate={{ opacity: show ? 1 : 0, y: show ? 0 : 4 }}
        transition={{ duration: 0.28 }}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[tone]}`} />
        {children}
        {layer}
      </motion.div>
    </div>
  );
}

export type Layer = { x: MotionValue<number>; y: MotionValue<number> };
export type Layers = { back: Layer; mid: Layer; front: Layer };

/** Wraps a scene and hands it three parallax layers (back, mid, front) that follow the pointer. Off for touch and reduced motion. */
export function Stage({ w, h, label, className = "", children }: { w: number; h: number; label: string; className?: string; children: (layers: Layers) => ReactNode }) {
  const reduce = !!useReducedMotion();
  const px = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const py = useSpring(useMotionValue(0), { stiffness: 60, damping: 18 });
  const useLayer = (d: number): Layer => ({ x: useTransform(px, (v) => v * d), y: useTransform(py, (v) => v * d) });
  const layers: Layers = { back: useLayer(3), mid: useLayer(7), front: useLayer(11) };
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative w-full select-none ${className}`}
      style={{ aspectRatio: `${w} / ${h}` }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType === "touch") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width - 0.5) * 2);
        py.set(((e.clientY - r.top) / r.height - 0.5) * 2);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      {children(layers)}
    </div>
  );
}
