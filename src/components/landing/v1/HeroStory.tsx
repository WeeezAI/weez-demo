import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Check, FileText, GitBranch, Send } from "lucide-react";
import { BrandIcon } from "../UseCaseAnimations";
import { EASE, FOCUS } from "../primitives";

/* The hero stage. One lead's journey told in three chapters that play on their own, Mosey-style:
   a path draws across four handoffs, notes float in beside each one, a ring counts, a dark pill
   captions the moment, and a stepper underneath shows where we are. Chapters can be clicked.
   Pauses off-screen and on hover; reduced motion shows each chapter's final frame. */

const BRAND = "#0b6e69";
const SIGNAL = "#e8962e";
const LINE = "#d3dcd9";

type Chapter = { key: string; label: string; caption: string; len: number };
const CHAPTERS: Chapter[] = [
  { key: "arrives", label: "A lead comes in", caption: "Every handoff matched", len: 7.2 },
  { key: "breaks", label: "It breaks silently", caption: "Nothing errored. Nobody noticed.", len: 7.6 },
  { key: "caught", label: "Dexraflow catches it", caption: "Caught the same day, not three weeks later", len: 8 },
];

const NODES = [
  { key: "form", name: "Web form", icon: FileText },
  { key: "crm", name: "HubSpot", brand: "hubspot" },
  { key: "routing", name: "Routing", icon: GitBranch },
  { key: "seq", name: "Outreach", brand: "outreach" },
];

/** Plays the chapters on a clock. `t` is seconds into the current chapter. */
function useStory(active: boolean, reduce: boolean) {
  const [ch, setCh] = useState(0);
  const [t, setT] = useState(0);
  const clock = useRef({ idx: 0, elapsed: 0 });
  useEffect(() => {
    if (reduce || !active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const c = clock.current;
      c.elapsed += (now - last) / 1000;
      last = now;
      if (c.elapsed >= CHAPTERS[c.idx].len) {
        c.elapsed = 0;
        c.idx = (c.idx + 1) % CHAPTERS.length;
        setCh(c.idx);
      }
      setT(c.elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduce]);
  const go = (i: number) => {
    clock.current = { idx: i, elapsed: 0 };
    setCh(i);
    setT(0);
  };
  return { ch, t: reduce ? 99 : t, go };
}

/* ───────────── pieces ───────────── */

const Note = ({ show, tone = "ink", children, className = "", center = false }: { show: boolean; tone?: "ink" | "amber" | "green" | "teal"; children: ReactNode; className?: string; center?: boolean }) => {
  const tones = {
    ink: "border-dx-line bg-white text-dx-ink",
    amber: "border-dx-signal/50 bg-dx-signal-soft text-dx-signal-ink",
    green: "border-dx-success/30 bg-dx-success-soft text-dx-success",
    teal: "border-dx-brand/30 bg-dx-brand-soft text-dx-brand",
  };
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          style={{ x: center ? "-50%" : 0 }}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.25 } }}
          transition={{ duration: 0.45, ease: EASE }}
          className={`absolute z-10 whitespace-nowrap rounded-[6px] border px-2.5 py-1.5 text-[12px] font-medium leading-tight shadow-[0_6px_20px_-12px_rgba(15,26,31,0.35)] ${tones[tone]} ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** A node card: icon plus name. Lights teal when the lead reaches it, amber when it is the break. */
const Node = ({ name, brand, icon: Icon, state, children }: { name: string; brand?: string; icon?: typeof FileText; state: "idle" | "lit" | "broken" | "dim"; children?: ReactNode }) => (
  <div className="relative flex shrink-0 flex-col items-center">
    <motion.div
      className="flex h-[72px] w-[72px] flex-col items-center justify-center gap-1.5 rounded-[10px] border bg-white sm:h-[88px] sm:w-[88px]"
      initial={false}
      animate={{
        borderColor: state === "lit" ? BRAND : state === "broken" ? SIGNAL : LINE,
        boxShadow: state === "lit" ? "0 0 0 4px rgba(11,110,105,0.12)" : state === "broken" ? "0 0 0 4px rgba(232,150,46,0.16)" : "0 1px 2px rgba(15,26,31,0.04)",
        opacity: state === "dim" ? 0.45 : 1,
        scale: state === "lit" || state === "broken" ? 1.04 : 1,
      }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {brand ? <BrandIcon k={brand} size={24} /> : Icon ? <Icon className="h-6 w-6 text-dx-ink-muted" strokeWidth={1.5} aria-hidden="true" /> : null}
      <span className="text-[11px] font-medium text-dx-ink sm:text-[12px]">{name}</span>
    </motion.div>
    {children}
  </div>
);

/** The dotted path between two nodes. `fill` 0..1 draws the teal line; the dot rides along it. */
const Link_ = ({ fill, dot, broken }: { fill: number; dot: boolean; broken: boolean }) => (
  <div className="relative h-[72px] min-w-[28px] flex-1 sm:h-[88px]" aria-hidden="true">
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 10">
      <line x1="0" y1="5" x2="100" y2="5" stroke={LINE} strokeWidth="1.5" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <motion.line x1="0" y1="5" x2="100" y2="5" stroke={broken ? SIGNAL : BRAND} strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={false} animate={{ pathLength: fill }} transition={{ duration: 0.15, ease: "linear" }} />
    </svg>
    <AnimatePresence>
      {dot && (
        <motion.span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
          style={{ left: `calc(${Math.min(1, fill) * 100}% - 5px)`, background: broken ? SIGNAL : BRAND, boxShadow: `0 0 0 4px ${broken ? "rgba(232,150,46,0.2)" : "rgba(11,110,105,0.18)"}` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </AnimatePresence>
  </div>
);

/** The ring: a count with a label, drawn like Mosey's progress dial. */
const Ring = ({ show, value, label, tone, className = "" }: { show: boolean; value: number; label: string; tone: "amber" | "teal"; className?: string }) => {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!show) return setN(0);
    if (reduce) return setN(value);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 1400);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [show, value, reduce]);
  const color = tone === "amber" ? SIGNAL : "#3bbfaf";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          style={{ x: "-50%" }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
          transition={{ duration: 0.5, ease: EASE }}
          className={`absolute z-20 flex h-[108px] w-[108px] flex-col items-center justify-center rounded-full bg-dx-ink text-white shadow-[0_18px_40px_-18px_rgba(15,26,31,0.6)] ${className}`}
        >
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 108 108" aria-hidden="true">
            <circle cx="54" cy="54" r="50" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
            <motion.circle cx="54" cy="54" r="50" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: reduce ? 1 : n / value }} transition={{ duration: 0.2 }} />
          </svg>
          <span className="font-dx-mono text-[26px] font-semibold leading-none tabular-nums">{n}</span>
          <span className="mt-1 max-w-[80px] text-center font-dx-mono text-[9px] uppercase leading-tight tracking-[0.06em] text-dx-night-ink-muted">{label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const SlackNote = ({ show }: { show: boolean }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        style={{ x: "-50%" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8, transition: { duration: 0.25 } }}
        transition={{ duration: 0.55, ease: EASE }}
        className="absolute left-1/2 top-full z-20 mt-5 w-[min(92vw,420px)] rounded-[8px] border border-dx-line bg-white p-3 text-left shadow-[0_18px_40px_-18px_rgba(15,26,31,0.45)]"
      >
        <div className="flex items-start gap-2.5">
          <BrandIcon k="slack" size={18} />
          <div className="min-w-0 text-[12px] leading-snug text-dx-ink">
            <p className="font-semibold">
              Dexraflow <span className="font-normal text-dx-ink-muted">→ #revops · 09:00</span>
            </p>
            <p className="mt-1">
              Routing stopped assigning demo requests at 14:02 on Tuesday. <span className="font-semibold">37 leads have no owner</span>, about <span className="font-semibold">$46k</span> in pipeline.
            </p>
            <p className="mt-1.5 font-medium text-dx-brand">View the 37 leads →</p>
          </div>
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-dx-brand" strokeWidth={2} aria-hidden="true" />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

/** Decorative wave lines in the stage corners. */
const Waves = ({ flip = false }: { flip?: boolean }) => (
  <svg aria-hidden="true" viewBox="0 0 220 120" className={`pointer-events-none absolute bottom-0 hidden h-[120px] w-[220px] lg:block ${flip ? "right-0 -scale-x-100" : "left-0"}`}>
    {[0, 1, 2, 3].map((i) => (
      <path key={i} d={`M-10 ${120 - i * 22} C 60 ${120 - i * 22}, 90 ${40 - i * 10}, 150 ${40 - i * 10} S 230 ${60 - i * 12}, 240 ${60 - i * 12}`} fill="none" stroke={LINE} strokeWidth="1" />
    ))}
  </svg>
);

/* ───────────── the stage ───────────── */

export default function HeroStory({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = !!useReducedMotion();
  const [hover, setHover] = useState(false);
  const { ch, t, go } = useStory(inView && !hover, reduce);
  const key = CHAPTERS[ch].key;

  // a lead travels: 0.9 s per hop, starting at 0.6 s
  const hop = (i: number) => Math.max(0, Math.min(1, (t - 0.6 - i * 0.9) / 0.8));
  const reached = (i: number) => (i === 0 ? t > 0.3 : hop(i - 1) >= 1);
  const arrives = key === "arrives";
  const breaks = key === "breaks";
  const caught = key === "caught";
  // chapter 2: the lead stops mid-way between routing and the sequence
  const stopAt = 0.42;
  const fill2 = (i: number) => (i < 2 ? hop(i) : Math.min(stopAt, hop(i)));
  const dotIdx = [0, 1, 2].find((i) => hop(i) > 0 && hop(i) < (breaks && i === 2 ? stopAt : 1));
  const stuck = breaks && hop(2) >= stopAt;
  // chapter 3: a scan sweeps left to right
  const scan = caught ? Math.max(0, Math.min(1, (t - 0.4) / 1.6)) : 0;
  const scanned = (i: number) => caught && scan >= (i + 0.5) / NODES.length;

  const state = (i: number): "idle" | "lit" | "broken" | "dim" => {
    if (arrives) return reached(i) ? "lit" : "idle";
    if (breaks) {
      if (i === 2) return stuck ? "broken" : reached(2) ? "lit" : "idle";
      if (i === 3) return stuck ? "dim" : "idle";
      return reached(i) ? "lit" : "idle";
    }
    return scanned(i) ? (i === 2 ? "broken" : "lit") : "idle";
  };
  const fill = (i: number) => (arrives ? hop(i) : breaks ? fill2(i) : Math.max(0, Math.min(1, scan * NODES.length - i - 0.5)));

  return (
    <div ref={ref} className={`relative ${className}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Waves />
      <Waves flip />

      {/* stage */}
      <div className="relative mx-auto max-w-4xl px-2 pb-[164px] pt-[76px] sm:pb-[172px] sm:pt-[96px]" role="img" aria-label="A lead travels from a web form to HubSpot to routing to Outreach. In the second chapter routing stops assigning and 37 leads have no owner, while every run still reports success. In the third, Dexraflow's daily check finds the break and posts the 37 leads to Slack.">
        {/* scan line, chapter 3 */}
        {caught && !reduce && scan < 1 && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-dx-brand-night/70 shadow-[0_0_24px_4px_rgba(59,191,175,0.35)]" style={{ left: `${scan * 100}%` }} />}

        <div className="flex items-center">
          {NODES.map((n, i) => (
            <div key={n.key} className="contents">
              <Node name={n.name} brand={n.brand} icon={n.icon} state={state(i)}>
                {/* chapter 1 notes */}
                {i === 0 && <Note show={arrives && reached(0)} className="-top-12 left-0 sm:-top-14">New demo request · pricing page</Note>}
                {i === 1 && <Note show={arrives && reached(1)} center className="top-full mt-3 left-1/2">Contact created</Note>}
                {i === 2 && <Note show={arrives && reached(2)} center className="-top-12 left-1/2 sm:-top-14">Owner: Sam</Note>}
                {i === 3 && <Note show={arrives && reached(3)} tone="green" className="top-full mt-3 right-0">Sequence started ✓</Note>}

                {/* chapter 2 notes */}
                {i === 1 && <Note show={breaks && reached(1)} tone="green" center className="-top-12 left-1/2 hidden sm:block sm:-top-14">Run status: Success ✓</Note>}
                {i === 2 && <Note show={breaks && stuck} tone="amber" center className="-top-12 left-1/2 sm:-top-14">No owner assigned</Note>}
                {i === 2 && <Ring show={breaks && t > 2.2} value={37} label="leads with no owner" tone="amber" className="left-1/2 top-full mt-3" />}
                {i === 3 && <Note show={breaks && stuck} className="top-full mt-3 right-0 hidden sm:block">Nothing ever arrives</Note>}

                {/* chapter 3 notes */}
                {i === 0 && <Note show={scanned(0)} tone="teal" className="-top-12 left-0 hidden sm:block sm:-top-14">212 fills ✓</Note>}
                {i === 1 && <Note show={scanned(1)} tone="teal" center className="-top-12 left-1/2 hidden sm:block sm:-top-14">212 contacts ✓</Note>}
                {i === 2 && <Note show={scanned(2)} tone="amber" center className="-top-12 left-1/2 sm:-top-14">175 owned · 37 missing</Note>}
                {i === 3 && <Note show={scanned(3)} tone="teal" className="-top-12 right-0 hidden sm:block sm:-top-14">175 in sequence</Note>}
              </Node>
              {i < NODES.length - 1 && <Link_ fill={fill(i)} dot={!caught && dotIdx === i} broken={breaks && i === 2 && stuck} />}
            </div>
          ))}
        </div>

        {/* the Slack alert, chapter 3 */}
        <div className="relative">
          <SlackNote show={caught && scan >= 1 && t > 2.6} />
        </div>
      </div>

      {/* caption pill */}
      <div className="relative flex justify-center" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.p
            key={key}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
            transition={{ duration: 0.45, ease: EASE }}
            className="rounded-full bg-dx-ink px-4 py-2 text-[13px] font-medium text-white"
          >
            {CHAPTERS[ch].caption}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* stepper */}
      <div className="mt-7 flex justify-center" role="tablist" aria-label="Hero chapters">
        <div className="flex flex-wrap justify-center gap-1 sm:gap-8">
          {CHAPTERS.map((c, i) => {
            const on = i === ch;
            const p = reduce ? 1 : on ? Math.min(1, t / c.len) : i < ch ? 1 : 0;
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => go(i)}
                className={`group relative rounded px-1.5 pb-3 pt-1 text-[11px] font-medium transition sm:px-2 sm:text-[13px] ${on ? "text-dx-ink" : "text-dx-ink-muted hover:text-dx-ink"} ${FOCUS}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="font-dx-mono text-[11px] text-dx-ink-muted">0{i + 1}</span>
                  {c.label}
                </span>
                <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-dx-line">
                  <span className="block h-full rounded-full bg-dx-brand" style={{ width: `${p * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
