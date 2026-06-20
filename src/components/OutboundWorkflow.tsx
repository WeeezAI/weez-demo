import { motion } from "framer-motion";
import {
  Linkedin, Heart, MessageCircle, Repeat2, Filter, Mail,
  Database, Send, CalendarCheck, Sparkles, ArrowRight, CheckCircle2,
} from "lucide-react";

/* ---------- shared bits ---------- */

const Card = ({ children, className = "" }: any) => (
  <div
    className={
      "relative rounded-2xl border border-slate-900/10 bg-white/90 backdrop-blur " +
      "shadow-[0_20px_50px_-25px_rgba(15,23,42,0.35)] " + className
    }
  >
    {children}
  </div>
);

const StepLabel = ({ n, title }: { n: number; title: string }) => (
  <div className="flex items-center gap-3">
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-semibold">
      {n}
    </span>
    <span className="text-sm font-semibold tracking-wide uppercase text-slate-700">
      {title}
    </span>
  </div>
);

/* ---------- step cards ---------- */

const PostCard = () => (
  <Card className="p-5 w-full max-w-[340px]">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center text-white font-bold">
        F
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">Founder · You</div>
        <div className="text-[11px] text-slate-500">just posted · <Linkedin className="inline w-3 h-3" /></div>
      </div>
    </div>
    <p className="mt-3 text-sm text-slate-700 leading-relaxed">
      "We just shipped autonomous outbound for B2B founders. No more cold lists, just warm signals."
    </p>
    <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
      <motion.span
        initial={{ scale: 1 }} animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        className="inline-flex items-center gap-1 text-rose-500"
      >
        <Heart className="w-3.5 h-3.5 fill-rose-500" /> 248
      </motion.span>
      <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> 36</span>
      <span className="inline-flex items-center gap-1"><Repeat2 className="w-3.5 h-3.5" /> 19</span>
    </div>
  </Card>
);

const EngagementCard = () => {
  const people = [
    { n: "Aisha K.", r: "VP Marketing · Series B SaaS", icp: true },
    { n: "Rahul M.", r: "Founder · D2C", icp: false },
    { n: "Priya S.", r: "Head of Growth · FinTech", icp: true },
    { n: "Daniel L.", r: "Student", icp: false },
    { n: "Maya R.", r: "CMO · HealthTech", icp: true },
  ];
  return (
    <Card className="p-5 w-full max-w-[340px]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Engagement tracker</div>
        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">LIVE</span>
      </div>
      <div className="mt-3 space-y-2">
        {people.map((p, i) => (
          <motion.div
            key={p.n}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.15, duration: 0.4 }}
            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
              p.icp ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-50 opacity-60"
            }`}
          >
            <div>
              <div className="font-medium text-slate-800">{p.n}</div>
              <div className="text-[10px] text-slate-500">{p.r}</div>
            </div>
            {p.icp ? (
              <span className="text-[10px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> ICP
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">skip</span>
            )}
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

const EnrichmentCard = () => (
  <Card className="p-5 w-full max-w-[340px]">
    <div className="flex items-center gap-2">
      <Database className="w-4 h-4 text-slate-700" />
      <div className="text-sm font-semibold text-slate-900">Enrichment</div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {["Apollo", "Clay", "Hunter", "Lusha"].map((s, i) => (
        <motion.div
          key={s}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.12 }}
          className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 bg-white"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> {s}
        </motion.div>
      ))}
    </div>
    <div className="mt-3 rounded-lg bg-slate-900 text-slate-100 p-2.5 font-mono text-[11px] leading-relaxed">
      <div>aisha@series-b.io <span className="text-emerald-400">✓</span></div>
      <div>priya@fintech.co <span className="text-emerald-400">✓</span></div>
      <div>maya@healthtech.io <span className="text-emerald-400">✓</span></div>
    </div>
  </Card>
);

const OutboundCard = () => (
  <Card className="p-5 w-full max-w-[340px]">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-slate-700" />
        <div className="text-sm font-semibold text-slate-900">Hyperpersonalized outbound</div>
      </div>
      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
    </div>
    <div className="mt-3 text-xs text-slate-600">To: aisha@series-b.io</div>
    <div className="text-xs text-slate-900 font-medium">Subj: Loved your take on warm outbound</div>
    <p className="mt-2 text-xs text-slate-700 leading-relaxed">
      Hey Aisha — saw you engaged with the autonomous outbound post.
      Noticed your team just hit Series B —{" "}
      <span className="bg-yellow-100 px-1 rounded">we built exactly this for VPs scaling pipeline without SDRs.</span>
    </p>
    <motion.div
      initial={{ width: 0 }} animate={{ width: "100%" }}
      transition={{ duration: 2.2, repeat: Infinity }}
      className="mt-3 h-1 rounded-full bg-gradient-to-r from-blue-500 to-sky-400"
    />
    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
      <span>Sending...</span>
      <Send className="w-3 h-3" />
    </div>
  </Card>
);

const MeetingCard = () => (
  <Card className="p-5 w-full max-w-[340px]">
    <div className="flex items-center gap-2">
      <CalendarCheck className="w-4 h-4 text-emerald-600" />
      <div className="text-sm font-semibold text-slate-900">Meeting booked</div>
    </div>
    <div className="mt-3 rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50 border border-emerald-200 p-3">
      <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">Thursday · 3:30 PM</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">Discovery — Aisha K.</div>
      <div className="text-[11px] text-slate-600">VP Marketing · Series B SaaS</div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Replied in 14 min · positive
      </div>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
      <div className="rounded-md bg-slate-50 p-2">
        <div className="text-base font-bold text-slate-900">42%</div>
        <div className="text-[10px] text-slate-500">reply rate</div>
      </div>
      <div className="rounded-md bg-slate-50 p-2">
        <div className="text-base font-bold text-slate-900">18</div>
        <div className="text-[10px] text-slate-500">meetings/wk</div>
      </div>
      <div className="rounded-md bg-slate-50 p-2">
        <div className="text-base font-bold text-slate-900">0</div>
        <div className="text-[10px] text-slate-500">SDRs hired</div>
      </div>
    </div>
  </Card>
);

/* ---------- main ---------- */

const STEPS = [
  { n: 1, title: "Founder posts", node: <PostCard /> },
  { n: 2, title: "Track engagement · filter ICP", node: <EngagementCard /> },
  { n: 3, title: "Enrich via Apollo & Clay", node: <EnrichmentCard /> },
  { n: 4, title: "Send hyperpersonalized outbound", node: <OutboundCard /> },
  { n: 5, title: "Book the meeting", node: <MeetingCard /> },
];

export const OutboundWorkflow = () => {
  return (
    <div className="relative">
      {/* Desktop: horizontal flow */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-5 gap-4 items-stretch">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex flex-col"
            >
              <StepLabel n={s.n} title={s.title} />
              <div className="mt-4 flex-1 flex">{s.node}</div>
              {i < STEPS.length - 1 && (
                <div className="pointer-events-none absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                  <motion.div
                    animate={{ x: [0, 6, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center"
                  >
                    <ArrowRight className="w-4 h-4 text-slate-700" />
                  </motion.div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* animated flowing line under the cards */}
        <div className="relative mt-10 h-1 rounded-full bg-slate-200/70 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            animate={{ x: ["-30%", "330%"] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>

      {/* Mobile / tablet: vertical stack with connectors */}
      <div className="lg:hidden flex flex-col gap-8">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <StepLabel n={s.n} title={s.title} />
            <div className="mt-4">{s.node}</div>
            {i < STEPS.length - 1 && (
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="mt-6 w-8 h-8 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center rotate-90"
              >
                <ArrowRight className="w-4 h-4 text-slate-700" />
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default OutboundWorkflow;
