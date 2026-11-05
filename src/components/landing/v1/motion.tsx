import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { EASE } from "../primitives";

/* Motion utilities for the V1 landing page. Each one degrades to its resolved state under
   prefers-reduced-motion, and every scroll-triggered effect fires once. */

/* ───────────── a number that counts up when it scrolls into view ───────────── */

export function CountUp({ to, duration = 1.4, format = (n: number) => Math.round(n).toLocaleString(), className = "" }: { to: number; duration?: number; format?: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [val, setVal] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce || !inView) return;
    const c = animate(0, to, { duration, ease: EASE, onUpdate: (v) => setVal(v) });
    return () => c.stop();
  }, [inView, reduce, to, duration]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(reduce ? to : val)}
    </span>
  );
}

/* ───────────── headline words sliding up out of a mask ───────────── */

export function WordReveal({ text, muted, className = "", delay = 0, id, as: Tag = "h1" }: { text: string; muted?: string; className?: string; delay?: number; id?: string; as?: "h1" | "h2" | "p" }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const mutedWords = muted ? muted.split(" ") : [];
  const all = [...words.map((w) => ({ w, muted: false })), ...mutedWords.map((w) => ({ w, muted: true }))];
  const M = motion[Tag];
  return (
    <M id={id} className={className} aria-label={muted ? `${text} ${muted}` : text}>
      {all.map((it, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-top" aria-hidden="true">
          <motion.span
            className={`inline-block ${it.muted ? "text-dx-ink-muted" : ""}`}
            initial={reduce ? false : { y: "110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, delay: delay + i * 0.045 + (it.muted ? 0.25 : 0), ease: EASE }}
          >
            {it.w}
          </motion.span>
          {i < all.length - 1 ? " " : ""}
        </span>
      ))}
    </M>
  );
}

/* ───────────── a card that tilts toward the cursor, with a soft spotlight ───────────── */

export function TiltCard({ children, className = "", max = 4, spotlight = true }: { children: ReactNode; className?: string; max?: number; spotlight?: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 22, mass: 0.6 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 22, mass: 0.6 });
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const glow = useMotionTemplate`radial-gradient(360px circle at ${mx}% ${my}%, rgba(11,110,105,0.07), transparent 60%)`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType === "touch") return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 2 * max);
    rx.set(-(py - 0.5) * 2 * max);
    mx.set(px * 100);
    my.set(py * 100);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };
  return (
    <motion.div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 1000 }} className={`relative will-change-transform ${className}`}>
      {spotlight && !reduce && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: glow }} />}
      {children}
    </motion.div>
  );
}

/* ───────────── reading progress under the nav ───────────── */

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  return <motion.div aria-hidden="true" className="absolute inset-x-0 bottom-[-1px] h-[2px] origin-left bg-dx-brand" style={{ scaleX }} />;
}

/* ───────────── "days before anyone noticed" bar ───────────── */

export function ElapsedBar({ days, max = 21, label }: { days: number; max?: number; label: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const pct = Math.min(100, (days / max) * 100);
  const on = reduce || inView;
  return (
    <div ref={ref} className="mt-4" role="img" aria-label={label}>
      <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-dx-sunken">
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-dx-signal" initial={reduce ? false : { width: 0 }} animate={{ width: on ? `${pct}%` : 0 }} transition={{ duration: 1.6, ease: EASE, delay: 0.2 }} />
      </div>
      <div className="relative mt-2 h-4 font-dx-mono text-[11px] text-dx-ink-muted">
        <span className="absolute left-0">day 0</span>
        <motion.span className="absolute whitespace-nowrap text-dx-signal-ink" style={{ left: `${pct}%` }} initial={reduce ? false : { opacity: 0, y: 2, x: pct > 80 ? "-100%" : "-50%" }} animate={{ opacity: on ? 1 : 0, y: on ? 0 : 2, x: pct > 80 ? "-100%" : "-50%" }} transition={{ duration: 0.4, delay: 1.5 }}>
          noticed
        </motion.span>
      </div>
    </div>
  );
}

/* ───────────── a thin rotating beam along a card's border ───────────── */

export function BorderBeam({ children, className = "", color = "rgba(11,110,105,0.9)" }: { children: ReactNode; className?: string; color?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`dx-beam relative rounded-[8px] ${className}`} style={{ "--dx-beam-color": color } as CSSProperties} data-static={reduce ? "" : undefined}>
      <div className="relative h-full rounded-[8px] bg-dx-raised">{children}</div>
    </div>
  );
}

/* ───────────── perspective grid for the dark closing panel ───────────── */

export function NightGrid() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <div className="absolute inset-x-0 bottom-0 h-[70%] [perspective:600px]">
        <div className="dx-night-grid absolute inset-x-[-40%] bottom-[-10%] top-0 origin-bottom [transform:rotateX(62deg)]" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-[linear-gradient(to_bottom,#0c1315_0%,rgba(12,19,21,0.55)_45%,rgba(12,19,21,0.1)_100%)]" />
      <div className="absolute left-1/2 top-[20%] h-[360px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(59,191,175,0.18),transparent_70%)] blur-2xl" />
    </div>
  );
}

/* ───────────── a quiet dot grid with a slow daily-check sweep, for the hero ───────────── */

export function HeroBackdrop() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(rgba(15,26,31,0.09)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_70%_40%,black_20%,transparent_72%)]" />
      {!reduce && <div className="dx-sweep absolute inset-y-0 w-[46%] bg-[linear-gradient(90deg,transparent,rgba(11,110,105,0.06),transparent)]" />}
    </div>
  );
}
