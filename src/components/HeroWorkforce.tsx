import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, Radar, Send, PenSquare, Check, CalendarCheck, TrendingUp } from "lucide-react";
import ninna from "@/assets/team/ninna.jpg";
import eva from "@/assets/team/eva.jpg";
import max from "@/assets/team/max.jpg";
import robert from "@/assets/team/robert.jpg";

/**
 * HeroWorkforce
 * -------------
 * The dynamic "Weez at work" hero visual. It introduces the AI marketing
 * team (Ninna, Eva, Max, Robert) and animates a live operating flow that
 * loops continuously: strategy -> signals -> outbound -> content -> booked.
 */

type Agent = {
  name: string;
  role: string;
  img: string;
  Icon: React.ComponentType<{ className?: string }>;
  activity: string;
  // explicit tailwind class strings (kept whole so they are not purged)
  text: string;
  dot: string;
  ring: string;
  soft: string;
  border: string;
  grad: string;
};

const AGENTS: Agent[] = [
  {
    name: "Ninna",
    role: "CMO · Strategy",
    img: ninna,
    Icon: Sparkles,
    activity: "Launched campaign · Founder-led outbound",
    text: "text-violet-600",
    dot: "bg-violet-500",
    ring: "ring-violet-300",
    soft: "bg-violet-50",
    border: "border-violet-200",
    grad: "from-violet-500 to-fuchsia-500",
  },
  {
    name: "Eva",
    role: "Lead Analyst · Signals",
    img: eva,
    Icon: Radar,
    activity: "Found 18 high-fit accounts · hiring + launch signals",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
    ring: "ring-emerald-300",
    soft: "bg-emerald-50",
    border: "border-emerald-200",
    grad: "from-emerald-500 to-teal-500",
  },
  {
    name: "Max",
    role: "Sales & Outreach",
    img: max,
    Icon: Send,
    activity: "12 warm opportunities · 4 approved · 2 replies",
    text: "text-amber-600",
    dot: "bg-amber-500",
    ring: "ring-amber-300",
    soft: "bg-amber-50",
    border: "border-amber-200",
    grad: "from-amber-500 to-orange-500",
  },
  {
    name: "Robert",
    role: "Content Lead",
    img: robert,
    Icon: PenSquare,
    activity: "3 founder posts + 1 campaign asset ready",
    text: "text-blue-600",
    dot: "bg-blue-500",
    ring: "ring-blue-300",
    soft: "bg-blue-50",
    border: "border-blue-200",
    grad: "from-blue-600 to-sky-500",
  },
];

const STEP_MS = 2200;

function useTypewriter(text: string, active: boolean) {
  const [typed, setTyped] = useState("");
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      setTyped(text);
      return;
    }
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text, active, reduce]);
  return active ? typed : text;
}

function AgentRow({ agent, index, step }: { agent: Agent; index: number; step: number }) {
  const active = step === index;
  const done = step > index;
  const typed = useTypewriter(agent.activity, active);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.35 + index * 0.14, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-500 ${
        active
          ? `${agent.soft} ${agent.border} shadow-sm scale-[1.015]`
          : "border-slate-900/[0.06] bg-white/70"
      }`}
    >
      {/* avatar */}
      <div className="relative shrink-0">
        <div
          className={`h-11 w-11 overflow-hidden rounded-xl ring-2 transition-all duration-500 ${
            active ? agent.ring : "ring-slate-200"
          }`}
        >
          <img src={agent.img} alt={agent.name} className="h-full w-full object-cover" />
        </div>
        {active && (
          <motion.span
            layoutId="active-pulse"
            className={`absolute -inset-1 rounded-2xl ${agent.ring} ring-2`}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
          />
        )}
      </div>

      {/* text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{agent.name}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {agent.role}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-snug text-slate-600">
          <agent.Icon className={`h-3.5 w-3.5 shrink-0 ${agent.text}`} />
          <span className="truncate">
            {typed}
            {active && typed.length < agent.activity.length && (
              <span className="ml-0.5 inline-block h-3 w-[2px] -translate-y-px animate-pulse bg-slate-400 align-middle" />
            )}
          </span>
        </div>
      </div>

      {/* status */}
      <div className="shrink-0">
        {done ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : active ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${agent.dot} opacity-70`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${agent.dot}`} />
          </span>
        ) : (
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
        )}
      </div>
    </motion.div>
  );
}

export default function HeroWorkforce() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= AGENTS.length - 1) {
          setCycle((c) => c + 1);
          return 0;
        }
        return s + 1;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [reduce]);

  const allDone = step === AGENTS.length - 1;

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
      {/* glow */}
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-transparent blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformPerspective: 1200 }}
        className="relative overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 shadow-[0_40px_120px_-40px_rgba(30,64,175,0.45)] backdrop-blur-2xl"
      >
        {/* top accent line */}
        <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-blue-500/70 to-transparent" />

        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.06] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-2 font-mono text-[11px] text-slate-400">weez · workforce</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </div>
        </div>

        {/* body */}
        <div className="relative bg-gradient-to-b from-white/40 via-white to-slate-50/60 p-4">
          {/* connector spine */}
          <div className="absolute bottom-24 left-[2.45rem] top-20 w-px bg-gradient-to-b from-violet-300/60 via-slate-200 to-blue-300/60" />

          <div className="space-y-2.5">
            {AGENTS.map((agent, i) => (
              <AgentRow key={agent.name} agent={agent} index={i} step={step} />
            ))}
          </div>

          {/* outcome bar */}
          <AnimatePresence mode="wait">
            {allDone && (
              <motion.div
                key={`booked-${cycle}`}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                  <CalendarCheck className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900">Meeting booked · Priya R.</div>
                  <div className="text-[11px] text-slate-500">VP Marketing · Series B SaaS · replied in 14 min</div>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-emerald-600 shadow-sm">
                  <TrendingUp className="h-3 w-3" /> Pipeline
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* floating metric chips */}
      <motion.div
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-6 top-16 hidden items-center gap-2 rounded-2xl border border-slate-900/10 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xl sm:flex"
      >
        <Radar className="h-3.5 w-3.5 text-emerald-500" /> 18 high-fit accounts
      </motion.div>
      <motion.div
        animate={reduce ? undefined : { y: [0, 12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-5 bottom-24 hidden items-center gap-2 rounded-2xl border border-slate-900/10 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xl sm:flex"
      >
        <Send className="h-3.5 w-3.5 text-amber-500" /> 42% reply rate
      </motion.div>
    </div>
  );
}
