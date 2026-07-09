import { motion, useReducedMotion } from "framer-motion";
import { Check, ArrowRight, ArrowDown, Users, Wrench, Clock, Wallet } from "lucide-react";
import ninna from "@/assets/team/ninna.jpg";
import robert from "@/assets/team/robert.jpg";
import eva from "@/assets/team/eva.jpg";
import maxImg from "@/assets/team/max.jpg";

/**
 * ReplaceStack
 * ------------
 * A conversion-focused comparison: the old GTM stack (multiple hires + many
 * disconnected tools) vs. one AI-native workforce. Motion-graphics accents,
 * matching the page color scheme.
 */

const OLD_HIRES = ["Content marketer", "Growth analyst", "SDR / BDR"];
const OLD_TOOLS = ["Content tool", "Scheduler", "Lead scraper", "Enrichment", "Sequencer", "Analytics"];
const OLD_STATS = [
  { icon: <Users className="h-3.5 w-3.5" />, v: "~3 hires" },
  { icon: <Wrench className="h-3.5 w-3.5" />, v: "6+ tools" },
  { icon: <Clock className="h-3.5 w-3.5" />, v: "Weeks to ramp" },
  { icon: <Wallet className="h-3.5 w-3.5" />, v: "$$$ / month" },
];

const TEAM = [
  { name: "Ninna", img: ninna, ring: "ring-violet-400" },
  { name: "Robert", img: robert, ring: "ring-blue-400" },
  { name: "Eva", img: eva, ring: "ring-emerald-400" },
  { name: "Max", img: maxImg, ring: "ring-amber-400" },
];

const WEEZ_WINS = [
  "One connected system, not six tabs",
  "Live in days, not months of hiring",
  "Scales output without new headcount",
  "One simple plan — no tool sprawl",
];

export default function ReplaceStack() {
  const reduce = useReducedMotion();

  return (
    <div className="relative grid items-stretch gap-6 md:grid-cols-2">
      {/* connector arrow (desktop) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block">
        <motion.div
          animate={reduce ? undefined : { x: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-900/10 bg-white text-blue-600 shadow-lg"
        >
          <ArrowRight className="h-5 w-5" />
        </motion.div>
      </div>

      {/* OLD WAY */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/70 p-7"
      >
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
          The usual setup
        </div>

        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">People you'd hire</div>
        <div className="flex flex-wrap gap-2">
          {OLD_HIRES.map((h, i) => (
            <motion.span
              key={h}
              animate={reduce ? undefined : { y: [0, -3, 0] }}
              transition={{ duration: 3, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 shadow-sm"
            >
              {h}
            </motion.span>
          ))}
        </div>

        <div className="mb-3 mt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tools you'd stitch together</div>
        <div className="flex flex-wrap gap-2">
          {OLD_TOOLS.map((t, i) => (
            <motion.span
              key={t}
              animate={reduce ? undefined : { y: [0, 3, 0] }}
              transition={{ duration: 3.4, delay: i * 0.25, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-2.5 py-1.5 text-xs text-slate-400"
            >
              {t}
            </motion.span>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 border-t border-slate-200 pt-5 sm:grid-cols-4">
          {OLD_STATS.map((s) => (
            <div key={s.v} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="text-slate-400">{s.icon}</span> {s.v}
            </div>
          ))}
        </div>
      </motion.div>

      {/* mobile arrow */}
      <div className="flex justify-center md:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-900/10 bg-white text-blue-600 shadow">
          <ArrowDown className="h-5 w-5" />
        </div>
      </div>

      {/* WEEZ WAY */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-3xl border border-blue-200/70 bg-white p-7 shadow-[0_30px_80px_-40px_rgba(37,99,235,0.45)]"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
            With Weez
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your AI-native marketing team</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex -space-x-3">
              {TEAM.map((m) => (
                <div key={m.name} className={`h-11 w-11 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-white ${m.ring}`}>
                  <img src={m.img} alt={m.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <div className="text-sm">
              <div className="font-semibold text-slate-900">Ninna · Robert · Eva · Max</div>
              <div className="text-slate-500">One team. One operating system.</div>
            </div>
          </div>

          <ul className="mt-6 space-y-3 border-t border-slate-100 pt-5">
            {WEEZ_WINS.map((w) => (
              <li key={w} className="flex items-start gap-3 text-[15px] text-slate-800">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
