import { useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/* Bento primitives for the landing page.
   A Chapter is one row of the story: a numbered node on the left rail and a grid of
   Tiles on the right. Tiles are joined by Wires, wave-shaped connectors that carry a
   pulse when the chapter's sequence reaches them. Everything is static under
   prefers-reduced-motion. */

export const TEAL = "#0b6e69";
export const LINE = "#d3dcd9";

/* ───────────── chapter + rail ───────────── */

export function Chapter({
  id,
  n,
  label,
  title,
  muted,
  intro,
  children,
  dark = false,
}: {
  id: string;
  n: string;
  label: string;
  title: ReactNode;
  muted?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  dark?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.25 });
  const reduce = !!useReducedMotion();
  const lit = inView || reduce;
  return (
    <section ref={ref} id={id} className="relative scroll-mt-32 grid gap-5 lg:grid-cols-[64px_1fr] lg:gap-8" aria-labelledby={`${id}-title`}>
      {/* rail */}
      <div className="hidden lg:block" aria-hidden="true">
        <div className="sticky top-32 flex flex-col items-center">
          <motion.span
            className={`flex h-9 w-9 items-center justify-center rounded-[8px] border font-dx-mono text-[12px] font-semibold ${
              dark ? "border-dx-night-line bg-dx-night text-dx-night-ink" : "border-dx-line bg-dx-raised text-dx-ink"
            }`}
            initial={false}
            animate={{ borderColor: lit ? TEAL : dark ? "#24333a" : LINE, color: lit ? TEAL : undefined }}
            transition={{ duration: 0.4 }}
          >
            {n}
          </motion.span>
          <svg width="24" height="140" viewBox="0 0 24 140" className="mt-1">
            <path d="M12 0 C 12 30, 12 30, 12 70 S 12 110, 12 140" fill="none" stroke={LINE} strokeWidth="1.5" />
            {lit && !reduce && (
              <path d="M12 0 C 12 30, 12 30, 12 70 S 12 110, 12 140" fill="none" stroke={TEAL} strokeWidth="1.5" strokeDasharray="6 12" className="animate-[wire-flow_1.6s_linear_infinite]" />
            )}
          </svg>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className={`flex items-center gap-2.5 font-dx-mono text-[12px] font-medium uppercase leading-4 tracking-[0.08em] ${dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}`}>
              <span aria-hidden="true" className={`h-[3px] w-4 rounded-[1px] ${dark ? "bg-dx-brand-night" : "bg-dx-brand"}`} />
              <span className="lg:hidden">{n} · </span>
              {label}
            </p>
            <h2 id={`${id}-title`} className={`mt-3 max-w-3xl text-[28px] font-semibold leading-[1.12] tracking-[-0.02em] sm:text-[36px] ${dark ? "text-dx-night-ink" : "text-dx-ink"}`}>
              {title}
              {muted && <span className={dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}> {muted}</span>}
            </h2>
          </div>
          {intro && <p className={`max-w-md text-[15px] leading-relaxed ${dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}`}>{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

/* ───────────── tile ───────────── */

export function Tile({
  children,
  className = "",
  active = false,
  dark = false,
  pad = true,
  label,
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
  dark?: boolean;
  pad?: boolean;
  label?: ReactNode;
  as?: "div" | "article" | "a";
} & Record<string, unknown>) {
  const base = dark ? "border-dx-night-line bg-dx-night text-dx-night-ink" : "border-dx-line bg-dx-raised text-dx-ink";
  return (
    <motion.div
      className={`relative min-w-0 rounded-[12px] border ${base} ${pad ? "p-5" : ""} ${className}`}
      initial={false}
      animate={{ borderColor: active ? TEAL : dark ? "#24333a" : LINE, boxShadow: active ? "0 0 0 3px rgba(11,110,105,0.12)" : "0 0 0 0 rgba(11,110,105,0)" }}
      transition={{ duration: 0.35 }}
    >
      <Tag className="contents" {...(rest as object)}>
        {label && (
          <p className={`mb-3 font-dx-mono text-[11px] font-medium uppercase tracking-[0.08em] ${dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}`}>{label}</p>
        )}
        {children}
      </Tag>
    </motion.div>
  );
}

/* ───────────── wire ───────────── */

const H_PATH = "M0 14 C 8 14, 10 4, 16 4 S 24 24, 32 24 S 40 14, 48 14";
const H_NARROW = "M0 14 C 4 14, 5 6, 8 6 S 12 22, 16 22 S 20 14, 24 14";
const V_PATH = "M14 0 C 14 8, 4 10, 4 16 S 24 24, 24 32 S 14 40, 14 48";

/** A wave-shaped connector between two tiles. Horizontal on large screens, vertical below.
    `on` keeps a slow flow running; `pulse` fires a brighter dot along it. */
export function Wire({ on = false, pulse = false, vertical, narrow = false, className = "" }: { on?: boolean; pulse?: boolean; vertical?: boolean; narrow?: boolean; className?: string }) {
  const reduce = !!useReducedMotion();
  const render = (v: boolean, extra: string) => {
    const d = v ? V_PATH : narrow ? H_NARROW : H_PATH;
    const w = v ? 28 : narrow ? 24 : 48;
    return (
      <svg width={w} height={v ? 48 : 28} viewBox={v ? "0 0 28 48" : `0 0 ${w} 28`} className={`shrink-0 ${extra}`} aria-hidden="true">
        <path d={d} fill="none" stroke={LINE} strokeWidth="1.5" />
        {(on || pulse) && !reduce && <path d={d} fill="none" stroke={TEAL} strokeWidth="1.5" strokeDasharray="5 9" className="animate-[wire-flow_1.4s_linear_infinite]" />}
        {(on || pulse) && reduce && <path d={d} fill="none" stroke={TEAL} strokeWidth="1.5" />}
        {pulse && !reduce && (
          <circle r="3.5" fill={TEAL} style={{ offsetPath: `path('${d}')`, offsetRotate: "0deg" }} className="animate-[wire-pulse_1.1s_ease-in-out_infinite]" />
        )}
      </svg>
    );
  };
  if (vertical === true) return <div className={`flex justify-center ${className}`}>{render(true, "")}</div>;
  if (vertical === false) return <div className={`flex items-center ${className}`}>{render(false, "")}</div>;
  return (
    <div className={`flex items-center justify-center self-center ${className}`}>
      {render(true, "lg:hidden")}
      {render(false, "hidden lg:block")}
    </div>
  );
}

/** A row of tiles joined by wires: one column on phones, `1fr auto 1fr auto …` on desktop.
    `step` is the index of the wire currently carrying a pulse; earlier wires keep flowing. */
export function WiredRow({ items, step, narrow = false, className = "" }: { items: ReactNode[]; step: number; narrow?: boolean; className?: string }) {
  const cols = items.map(() => "minmax(0,1fr)").join(" auto ");
  return (
    <div className={`grid gap-3 lg:gap-2 lg:[grid-template-columns:var(--wired)] ${className}`} style={{ "--wired": cols } as CSSProperties}>
      {items.map((it, i) => (
        <div key={i} className="contents">
          {it}
          {i < items.length - 1 && <Wire on={step > i} pulse={step === i} narrow={narrow} />}
        </div>
      ))}
    </div>
  );
}

/** Decorative wave field for the hero tile background. */
export function WaveField({ className = "" }: { className?: string }) {
  const reduce = !!useReducedMotion();
  const rows = [0, 1, 2, 3, 4, 5];
  return (
    <svg viewBox="0 0 600 240" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true">
      {rows.map((r) => {
        const y = 30 + r * 36;
        const d = `M-20 ${y} C 80 ${y - 18}, 160 ${y + 18}, 240 ${y} S 400 ${y - 18}, 480 ${y} S 600 ${y + 18}, 640 ${y}`;
        return (
          <g key={r}>
            <path d={d} fill="none" stroke={LINE} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {!reduce && (
              <path
                d={d}
                fill="none"
                stroke={TEAL}
                strokeOpacity="0.55"
                strokeWidth="1.2"
                strokeDasharray="10 60"
                vectorEffect="non-scaling-stroke"
                className="animate-[wire-flow_3.2s_linear_infinite]"
                style={{ animationDelay: `${r * -0.45}s` }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
