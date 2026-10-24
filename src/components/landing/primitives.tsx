import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/* Shared landing-page primitives: the design-system eyebrow, two-tone section title,
   scroll reveal and the two button styles. Used by Landing.tsx and the MCP section. */

export const EASE = [0.22, 1, 0.36, 1] as const;

export const Reveal = ({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

/** Mono uppercase `eyebrow`, led by a short brand "plane" bar. */
export const Eyebrow = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
  <p className={`flex items-center gap-2.5 font-dx-mono text-[12px] font-medium uppercase leading-4 tracking-[0.08em] ${dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}`}>
    <span aria-hidden="true" className={`h-[3px] w-4 rounded-[1px] ${dark ? "bg-dx-brand-night" : "bg-dx-brand"}`} />
    {children}
  </p>
);

/** Two-tone `display` heading: an ink lead sentence, then an ink-muted continuation. */
export const SectionTitle = ({
  id,
  lead,
  muted,
  dark = false,
  className = "",
}: {
  id: string;
  lead: ReactNode;
  muted?: ReactNode;
  dark?: boolean;
  className?: string;
}) => (
  <h2
    id={id}
    className={`mt-5 max-w-3xl text-[30px] font-semibold leading-[1.14] tracking-[-0.02em] sm:text-[44px] sm:leading-[50px] ${dark ? "text-dx-night-ink" : "text-dx-ink"} ${className}`}
  >
    {lead}
    {muted && <span className={dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}> {muted}</span>}
  </h2>
);

/** Focus ring per the system: 2px solid `focus`, 2px offset. */
export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-focus focus-visible:ring-offset-2";

export const PrimaryCTA = ({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-dx-brand px-4 text-[14px] font-medium text-white transition hover:bg-dx-brand-hover ${FOCUS} ${className}`}
  >
    {children}
    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
  </button>
);

export const SecondaryCTA = ({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-dx-line-strong bg-dx-raised px-4 text-[14px] font-medium text-dx-ink transition hover:bg-dx-surface ${FOCUS} ${className}`}
  >
    {children}
  </button>
);
