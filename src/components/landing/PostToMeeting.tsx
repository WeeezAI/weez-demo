import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Signal, Radar, Database, Send, CalendarCheck, Linkedin, Heart,
  MessageCircle, Repeat2, Check, Sparkles, TrendingUp, Flame,
} from "lucide-react";

/**
 * PostToMeeting
 * -------------
 * A clean, auto-advancing walkthrough of the updated outbound motion:
 * founder post -> intent signals + ICP -> enrichment -> warm outbound -> booked.
 * Each step shows a live mini-UI; a progress rail syncs at the top and steps
 * are clickable.
 */

type Step = {
  label: string;
  agent: string;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  text: string;
  grad: string;
  soft: string;
};

const STEPS: Step[] = [
  {
    label: "Signal",
    agent: "Eva",
    title: "A live buying signal appears",
    desc: "A prospect engages with founder-led content — Weez captures it as a live buying signal from a real, in-market buyer.",
    Icon: Signal,
    text: "text-emerald-600",
    grad: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-50",
  },
  {
    label: "Qualify",
    agent: "Eva",
    title: "Intent signals + ICP filtering",
    desc: "Eva reads who engaged, cross-checks live hiring and growth signals, and keeps only high-fit, high-intent accounts.",
    Icon: Radar,
    text: "text-emerald-600",
    grad: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-50",
  },
  {
    label: "Enrich",
    agent: "Eva",
    title: "Contacts enriched & verified",
    desc: "The right decision-maker is resolved and verified across enrichment sources — no manual list building.",
    Icon: Database,
    text: "text-emerald-600",
    grad: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-50",
  },
  {
    label: "Outbound",
    agent: "Max",
    title: "Warm, contextual outreach",
    desc: "Max drafts a message grounded in the engagement and company motion — a conversation starter, not a cold template.",
    Icon: Send,
    text: "text-amber-600",
    grad: "from-amber-500 to-orange-500",
    soft: "bg-amber-50",
  },
  {
    label: "Meeting",
    agent: "Max",
    title: "A qualified meeting is booked",
    desc: "Positive replies convert into calendar-ready meetings — pipeline created without hiring a single SDR.",
    Icon: CalendarCheck,
    text: "text-amber-600",
    grad: "from-amber-500 to-orange-500",
    soft: "bg-amber-50",
  },
];

const STEP_MS = 2800;

/* ---------- step visuals ---------- */

function PostCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-400 font-bold text-white">
          F
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">Founder · You</div>
          <div className="text-[11px] text-slate-500">
            just posted · <Linkedin className="inline h-3 w-3" />
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        "We shipped autonomous outbound for B2B founders — no more cold lists, just warm signals from people already in-market."
      </p>
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <motion.span
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="inline-flex items-center gap-1 text-rose-500"
        >
          <Heart className="h-3.5 w-3.5 fill-rose-500" /> 248
        </motion.span>
        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> 36</span>
        <span className="inline-flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5" /> 19</span>
      </div>
    </div>
  );
}

function SignalsCard() {
  const people = [
    { n: "Aisha K.", r: "VP Marketing · SaaS", tag: "Series B", icp: true },
    { n: "Priya S.", r: "Head of Growth · FinTech", tag: "Hiring SDRs", icp: true },
    { n: "Rahul M.", r: "Student", tag: "", icp: false },
    { n: "Maya R.", r: "CMO · HealthTech", tag: "Launched v2", icp: true },
    { n: "Daniel L.", r: "Unrelated industry", tag: "", icp: false },
  ];
  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Engagement + signals</div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">LIVE</span>
      </div>
      <div className="mt-3 space-y-2">
        {people.map((p, i) => (
          <motion.div
            key={p.n}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
              p.icp ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50 opacity-60"
            }`}
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-800">{p.n}</div>
              <div className="text-[10px] text-slate-500">{p.r}</div>
            </div>
            {p.icp ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <Flame className="h-2.5 w-2.5" /> {p.tag}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">skip</span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EnrichCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-slate-700" />
        <div className="text-sm font-semibold text-slate-900">Enrichment</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {["Apollo", "Clay", "Hunter", "Lusha"].map((s, i) => (
          <motion.div
            key={s}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.12 }}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> {s}
          </motion.div>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] leading-relaxed text-slate-100">
        <div>aisha@series-b.io <span className="text-emerald-400">✓</span></div>
        <div>priya@fintech.co <span className="text-emerald-400">✓</span></div>
        <div>maya@healthtech.io <span className="text-emerald-400">✓</span></div>
      </div>
    </div>
  );
}

function OutboundCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-slate-700" />
          <div className="text-sm font-semibold text-slate-900">Warm outbound</div>
        </div>
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
      </div>
      <div className="mt-3 text-xs text-slate-600">To: aisha@series-b.io</div>
      <div className="text-xs font-medium text-slate-900">Loved your take on warm outbound</div>
      <p className="mt-2 text-xs leading-relaxed text-slate-700">
        Hey Aisha — saw you engaged with the autonomous outbound post. Noticed your team just hit Series B —{" "}
        <span className="rounded bg-amber-100 px-1">we built exactly this for VPs scaling pipeline without SDRs.</span>
      </p>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: 2.2, repeat: Infinity }}
        className="mt-3 h-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Sending…</span>
        <Send className="h-3 w-3" />
      </div>
    </div>
  );
}

function MeetingCard() {
  const stats = [
    { v: "42%", l: "reply rate" },
    { v: "18", l: "meetings/wk" },
    { v: "0", l: "SDRs hired" },
  ];
  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-emerald-600" />
        <div className="text-sm font-semibold text-slate-900">Meeting booked</div>
      </div>
      <div className="mt-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-sky-50 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Thursday · 3:30 PM</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">Discovery — Aisha K.</div>
        <div className="text-[11px] text-slate-600">VP Marketing · Series B SaaS</div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Replied in 14 min · positive
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.l} className="rounded-md bg-slate-50 p-2">
            <div className="text-base font-bold text-slate-900">{s.v}</div>
            <div className="text-[10px] text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CARDS = [<PostCard />, <SignalsCard />, <EnrichCard />, <OutboundCard />, <MeetingCard />];

export default function PostToMeeting() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(id);
  }, []);

  const step = STEPS[active];

  return (
    <div className="relative">
      {/* progress rail */}
      <div className="relative mx-auto max-w-4xl">
        <div className="absolute left-0 right-0 top-5 h-px bg-slate-200" />
        <motion.div
          className="absolute left-0 top-5 h-px bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500"
          animate={{ width: `${(active / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        <div className="relative grid grid-cols-5 gap-2">
          {STEPS.map((s, i) => {
            const isActive = i === active;
            const done = i < active;
            return (
              <button key={s.label} onClick={() => setActive(i)} className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-white transition-colors duration-500 ${
                    isActive
                      ? `border-transparent bg-gradient-to-br ${s.grad} shadow-lg`
                      : done
                      ? "border-transparent bg-emerald-500"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <s.Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />}
                </motion.div>
                <span
                  className={`hidden text-[11px] font-semibold sm:block ${
                    isActive ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* panel */}
      <div className="mt-12 grid items-center gap-10 rounded-3xl border border-slate-900/10 bg-white/70 p-6 backdrop-blur-xl md:grid-cols-2 md:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${active}`}
            initial={{ opacity: 0, y: reduce ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -14 }}
            transition={{ duration: 0.4 }}
          >
            <div className={`inline-flex items-center gap-2 rounded-full ${step.soft} px-3 py-1 text-xs font-semibold ${step.text}`}>
              <step.Icon className="h-3.5 w-3.5" />
              Step {active + 1} · {step.agent}
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{step.title}</h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">{step.desc}</p>

            {active === STEPS.length - 1 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
              >
                <TrendingUp className="h-4 w-4" /> Pipeline created — fully autonomous
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center md:justify-end">
          <AnimatePresence mode="wait">
            <motion.div
              key={`card-${active}`}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.98, y: reduce ? 0 : -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-full justify-center"
            >
              {CARDS[active]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
