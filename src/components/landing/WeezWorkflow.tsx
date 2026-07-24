import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, Radar, Send, ArrowRight, RefreshCw } from "lucide-react";

/**
 * WeezWorkflow
 * ------------
 * A clean, motion-graphics style "operating loop" that shows how the AI
 * GTM workforce turns business context into booked meetings — and keeps
 * looping. A synced legend (left) + an orbital animation (right) advance
 * together in a continuous cycle.
 */

type Stage = {
  fn: string;
  agent: string;
  caption: string;
  Icon: React.ComponentType<{ className?: string }>;
  text: string;
  grad: string;
  soft: string;
  border: string;
  ring: string;
  stroke: string;
  glow: string;
  // node position in percent within the square orbit
  x: number;
  y: number;
};

const STAGES: Stage[] = [
  {
    fn: "Context & Strategy",
    agent: "Ninna · GTM Strategist",
    caption: "Learns your business, product, and ICP — then sets the go-to-market strategy.",
    Icon: Sparkles,
    text: "text-violet-600",
    grad: "from-violet-500 to-fuchsia-500",
    soft: "bg-violet-50",
    border: "border-violet-200",
    ring: "ring-violet-300",
    stroke: "#8b5cf6",
    glow: "rgba(139,92,246,0.5)",
    x: 50,
    y: 9,
  },
  {
    fn: "Signals & Accounts",
    agent: "Eva · Market Intelligence",
    caption: "Tracks hiring, funding, launch, and growth signals to surface high-intent accounts.",
    Icon: Radar,
    text: "text-emerald-600",
    grad: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-50",
    border: "border-emerald-200",
    ring: "ring-emerald-300",
    stroke: "#10b981",
    glow: "rgba(16,185,129,0.5)",
    x: 85,
    y: 71,
  },
  {
    fn: "Warm Outbound",
    agent: "Max · Sales Execution",
    caption: "Enriches contacts, drafts contextual outreach, and books qualified meetings.",
    Icon: Send,
    text: "text-amber-600",
    grad: "from-amber-500 to-orange-500",
    soft: "bg-amber-50",
    border: "border-amber-200",
    ring: "ring-amber-300",
    stroke: "#f59e0b",
    glow: "rgba(245,158,11,0.5)",
    x: 15,
    y: 71,
  },
];

const STEP_MS = 2100;

function Orbit({ active, booked }: { active: number; booked: number }) {
  const reduce = useReducedMotion();
  const stage = STAGES[active];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]">
      {/* ambient glow */}
      <div
        className="absolute inset-[12%] rounded-full blur-2xl transition-colors duration-700"
        style={{ background: `radial-gradient(circle, ${stage.glow}, transparent 70%)` }}
      />

      {/* rotating conic ring */}
      <motion.div
        className="absolute inset-[9%] rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(37,99,235,0.35) 60deg, rgba(139,92,246,0.35) 140deg, transparent 200deg)",
          WebkitMaskImage: "radial-gradient(closest-side, transparent 80%, black 82%)",
          maskImage: "radial-gradient(closest-side, transparent 80%, black 82%)",
        }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* static track ring */}
      <div className="absolute inset-[9%] rounded-full border border-dashed border-slate-300/70" />

      {/* SVG spokes: line from center to each node, active one flows */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {STAGES.map((s, i) => (
          <motion.line
            key={i}
            x1="50"
            y1="50"
            x2={s.x}
            y2={s.y}
            stroke={i === active ? s.stroke : "#e2e8f0"}
            strokeWidth={i === active ? 0.7 : 0.4}
            strokeDasharray="3 3"
            animate={reduce || i !== active ? undefined : { strokeDashoffset: [0, -12] }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            opacity={i === active ? 1 : 0.5}
          />
        ))}
      </svg>

      {/* orbiting particles */}
      {!reduce &&
        [0, 120, 240].map((offset, i) => (
          <motion.div
            key={i}
            className="absolute inset-[9%]"
            style={{ rotate: offset }}
            animate={{ rotate: [offset, offset + 360] }}
            transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
          >
            <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.8)]" />
          </motion.div>
        ))}

      {/* nodes */}
      {STAGES.map((s, i) => {
        const isActive = i === active;
        return (
          <div
            key={s.fn}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            <motion.div
              animate={{ scale: isActive ? 1.12 : 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors duration-500 ${
                isActive
                  ? `bg-gradient-to-br ${s.grad} border-transparent text-white shadow-lg`
                  : "border-slate-200 bg-white text-slate-400 shadow-sm"
              }`}
            >
              <s.Icon className="h-6 w-6" />
              {isActive && !reduce && (
                <motion.span
                  className={`absolute inset-0 rounded-2xl ring-2 ${s.ring}`}
                  initial={{ opacity: 0.7, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.6 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
            </motion.div>
          </div>
        );
      })}

      {/* center core */}
      <div className="absolute inset-[28%] flex items-center justify-center rounded-full border border-slate-900/10 bg-white/85 shadow-[0_20px_60px_-30px_rgba(30,64,175,0.5)] backdrop-blur-xl">
        <div className="px-3 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Now running
              </div>
              <div className={`mt-1 flex items-center justify-center gap-1.5 ${stage.text}`}>
                <stage.Icon className="h-3.5 w-3.5" />
                <span className="text-[13px] font-semibold leading-tight text-slate-900">{stage.fn}</span>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="mx-auto mt-3 h-px w-10 bg-slate-200" />
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {booked.toLocaleString("en-US")}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            meetings booked
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WeezWorkflow() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [booked, setBooked] = useState(126);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((a) => {
        const next = (a + 1) % STAGES.length;
        if (next === 0) setBooked((b) => b + 3);
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="workflow-loop" className="relative px-6 py-24 md:py-28">
      <div className="mx-auto max-w-7xl">
        {/* heading */}
        <div className="mb-14 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            The Weez Workflow
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="mx-auto mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 md:text-5xl"
          >
            One continuous engine — not three disconnected tools.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg"
          >
            Context surfaces live buying signals, signals become warm
            conversations, and conversations turn into booked meetings — then the
            loop learns and repeats.
          </motion.p>
        </div>

        {/* content: legend + orbit */}
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* legend */}
          <div className="order-2 space-y-3 lg:order-1">
            {STAGES.map((s, i) => {
              const isActive = i === active;
              return (
                <button
                  key={s.fn}
                  onClick={() => setActive(i)}
                  className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-500 ${
                    isActive
                      ? `${s.soft} ${s.border} scale-[1.01] shadow-sm`
                      : "border-slate-900/[0.06] bg-white/70 hover:border-slate-900/10"
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-500 ${
                      isActive
                        ? `bg-gradient-to-br ${s.grad} text-white shadow-md`
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <s.Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-slate-900">{s.fn}</span>
                      <span
                        className={`text-[10px] font-medium uppercase tracking-wide ${
                          isActive ? s.text : "text-slate-400"
                        }`}
                      >
                        {s.agent}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{s.caption}</p>
                  </div>
                  <ArrowRight
                    className={`mt-1 h-4 w-4 shrink-0 transition-all duration-500 ${
                      isActive ? `${s.text} translate-x-0.5` : "text-slate-300"
                    }`}
                  />
                </button>
              );
            })}

            <div className="flex items-center gap-2 pl-1 pt-2 text-xs text-slate-500">
              <RefreshCw className={`h-3.5 w-3.5 text-blue-500 ${reduce ? "" : "animate-spin"}`} style={{ animationDuration: "6s" }} />
              Continuously learns and improves with every cycle.
            </div>
          </div>

          {/* orbit */}
          <div className="order-1 lg:order-2">
            <Orbit active={active} booked={booked} />
          </div>
        </div>
      </div>
    </section>
  );
}
