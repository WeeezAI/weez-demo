import { useRef, useMemo } from "react";
import { motion, useScroll, useTransform, useReducedMotion, useSpring } from "framer-motion";
import {
  Brain,
  Sparkles,
  FileText,
  Heart,
  Globe2,
  Target,
  Users,
  Mail,
  CalendarCheck,
  TrendingUp,
  Building2,
  MessageSquare,
  Linkedin,
  Star,
  Activity,
  Zap,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Floating particles                                                 */
/* ------------------------------------------------------------------ */

function Particles({ count = 40 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 12 + 10,
        delay: Math.random() * 8,
      })),
    [count]
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-cyan-300/40"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            boxShadow: "0 0 8px rgba(103,232,249,0.55)",
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable bits                                                      */
/* ------------------------------------------------------------------ */

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
      }}
    >
      {children}
    </div>
  );
}

function StageShell({
  index,
  eyebrow,
  title,
  label,
  children,
}: {
  index: number;
  eyebrow: string;
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-[88vw] sm:w-[640px] md:w-[720px] flex-shrink-0 px-6 md:px-10 py-10 flex flex-col justify-center">
      <div className="flex items-center gap-3 text-cyan-300/80 text-xs uppercase tracking-[0.25em] font-medium">
        <span className="font-mono text-cyan-400">
          {String(index).padStart(2, "0")}
        </span>
        <span className="h-px w-10 bg-gradient-to-r from-cyan-400/60 to-transparent" />
        <span>{eyebrow}</span>
      </div>
      <h3 className="mt-4 text-3xl md:text-4xl font-semibold text-white tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-sm md:text-base text-slate-400 max-w-md">
        {label}
      </p>
      <div className="mt-8 relative">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual stage visuals                                           */
/* ------------------------------------------------------------------ */

const sourceChips = [
  { icon: Users, label: "Founder profile" },
  { icon: Building2, label: "Product pages" },
  { icon: Star, label: "Testimonials" },
  { icon: Globe2, label: "Website" },
  { icon: Linkedin, label: "LinkedIn" },
];

function Stage1() {
  return (
    <div className="relative h-[320px]">
      {/* Central brain */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative h-28 w-28 rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-600/30 border border-cyan-300/40 backdrop-blur-xl flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl" />
          <Brain className="h-12 w-12 text-cyan-200 relative" />
        </div>
      </motion.div>

      {sourceChips.map((c, i) => {
        const angle = (i / sourceChips.length) * Math.PI * 2 - Math.PI / 2;
        const r = 130;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
          >
            <motion.div
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] backdrop-blur-md px-3 py-1.5 text-xs text-slate-200 whitespace-nowrap"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 3, delay: i * 0.3, repeat: Infinity }}
            >
              <Icon className="h-3.5 w-3.5 text-cyan-300" />
              {c.label}
            </motion.div>
            {/* flow line */}
            <motion.span
              className="absolute left-1/2 top-1/2 h-px origin-left bg-gradient-to-r from-cyan-400/60 to-transparent"
              style={{
                width: r,
                transform: `rotate(${angle + Math.PI}rad)`,
              }}
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 2.5, delay: i * 0.25, repeat: Infinity }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Stage2() {
  const items = ["Content Strategy", "Campaign Ideas", "Topic Clusters", "Distribution Plans"];
  return (
    <div className="relative h-[320px]">
      <div className="absolute left-6 top-1/2 -translate-y-1/2">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-violet-300/40 backdrop-blur-xl flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-violet-200" />
        </div>
        <div className="mt-2 text-xs text-violet-200 font-medium text-center">Strategist</div>
      </div>
      <div className="absolute left-32 right-0 top-0 bottom-0 flex flex-col justify-center gap-3">
        {items.map((label, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ delay: i * 0.15, duration: 0.6 }}
          >
            <GlassCard className="px-4 py-3 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-sm text-slate-100">{label}</span>
              <motion.div
                className="ml-auto h-1 w-16 rounded-full bg-violet-500/30 overflow-hidden"
              >
                <motion.div
                  className="h-full bg-violet-400"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                />
              </motion.div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Stage3() {
  const posts = [
    { title: "Why founder-led content compounds", meta: "248 reactions · 42 comments" },
    { title: "The new B2B GTM motion", meta: "186 reactions · 31 comments" },
    { title: "What no one tells you about ICP", meta: "312 reactions · 58 comments" },
  ];
  return (
    <div className="relative h-[320px]">
      {posts.map((p, i) => (
        <motion.div
          key={i}
          className="absolute left-0 right-0"
          style={{ top: i * 70 }}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-80px" }}
          transition={{ delay: i * 0.2, duration: 0.7 }}
        >
          <GlassCard className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
                <Linkedin className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-white font-medium">{p.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{p.meta}</div>
              </div>
              <FileText className="h-4 w-4 text-cyan-300/60" />
            </div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}

function Stage4() {
  const signals = [
    { icon: Heart, label: "Like", color: "text-rose-300" },
    { icon: MessageSquare, label: "Comment", color: "text-cyan-300" },
    { icon: Activity, label: "Share", color: "text-emerald-300" },
    { icon: Zap, label: "Profile view", color: "text-amber-300" },
  ];
  return (
    <div className="relative h-[320px]">
      {/* Brain target */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 h-20 w-20 rounded-2xl bg-gradient-to-br from-cyan-400/30 to-blue-600/30 border border-cyan-300/40 flex items-center justify-center">
        <Brain className="h-8 w-8 text-cyan-200" />
      </div>
      {signals.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.div
            key={i}
            className="absolute left-0"
            style={{ top: 30 + i * 60 }}
            animate={{ x: [0, 220], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 3.5, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className={`flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md px-3 py-1.5 text-xs ${s.color}`}>
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Stage5() {
  const competitors = ["Competitor post", "Industry thread", "Similar topic", "Market discussion"];
  return (
    <div className="relative h-[320px]">
      <div className="grid grid-cols-2 gap-3 h-full content-center">
        {competitors.map((c, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" }}
          >
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <Globe2 className="h-3.5 w-3.5" /> Market signal
              </div>
              <div className="mt-2 text-sm text-white">{c}</div>
              <div className="mt-3 h-1 w-full rounded-full bg-emerald-500/20 overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-400"
                  animate={{ width: ["20%", "80%", "20%"] }}
                  transition={{ duration: 3, delay: i * 0.4, repeat: Infinity }}
                />
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Stage6() {
  const leads = [
    { name: "Priya R.", role: "VP Marketing · SaaS", score: 94, keep: true },
    { name: "Daniel K.", role: "Head of Growth", score: 88, keep: true },
    { name: "—", role: "Unrelated industry", score: 32, keep: false },
    { name: "Maya S.", role: "Founder · Series A", score: 91, keep: true },
    { name: "—", role: "Low intent signal", score: 21, keep: false },
  ];
  return (
    <div className="relative h-[340px] space-y-2">
      {leads.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, x: 0 }}
          animate={l.keep ? { opacity: 1, x: 0 } : { opacity: [1, 0.2], x: [0, -40] }}
          transition={{ duration: 2, delay: 1 + i * 0.2, repeat: Infinity, repeatDelay: 3 }}
        >
          <GlassCard className={`p-3 flex items-center gap-3 ${!l.keep ? "border-dashed" : ""}`}>
            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold ${l.keep ? "bg-emerald-400/20 text-emerald-200 border border-emerald-300/30" : "bg-slate-500/20 text-slate-400"}`}>
              {l.score}
            </div>
            <div className="flex-1">
              <div className="text-sm text-white">{l.name}</div>
              <div className="text-xs text-slate-400">{l.role}</div>
            </div>
            <div className="flex gap-1.5">
              {["ICP", "Match", "Sim", "Conv"].map((t) => (
                <span
                  key={t}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${l.keep ? "bg-cyan-400/15 text-cyan-200" : "bg-slate-600/20 text-slate-500"}`}
                >
                  {t}
                </span>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}

function Stage7() {
  const facets = [
    { icon: Heart, label: "Common interest", value: "Founder-led GTM" },
    { icon: Building2, label: "Company insight", value: "Recently raised Series B" },
    { icon: Activity, label: "Recent activity", value: "Posted on ICP discovery" },
    { icon: MessageSquare, label: "Conversation angle", value: "Pipeline efficiency" },
  ];
  return (
    <div className="relative h-[340px]">
      <GlassCard className="p-5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-500" />
          <div>
            <div className="text-white font-medium">Priya R.</div>
            <div className="text-xs text-slate-400">VP Marketing · Northwind SaaS</div>
          </div>
          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-emerald-400/15 text-emerald-200">
            Ready to engage
          </span>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {facets.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-80px" }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
              >
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-cyan-300/80">
                  <Icon className="h-3.5 w-3.5" />
                  {f.label}
                </div>
                <div className="mt-1 text-sm text-white">{f.value}</div>
              </motion.div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

function Stage8() {
  return (
    <div className="relative h-[340px]">
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 text-xs text-cyan-300">
          <Mail className="h-3.5 w-3.5" /> Drafting hyperpersonalized message
        </div>
        <div className="mt-4 text-sm text-slate-300 leading-relaxed">
          <span className="text-white">Hi Priya,</span> loved your take on founder-led GTM —
          especially the point on ICP signal density. We've been seeing similar
          patterns after Northwind's Series B…
        </div>
        <motion.div
          className="mt-4 h-1 rounded-full bg-cyan-500/20 overflow-hidden"
        >
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-400 to-blue-400"
            animate={{ width: ["0%", "100%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          Context-aware · No templates
        </div>
      </GlassCard>
    </div>
  );
}

function Stage9() {
  return (
    <div className="relative h-[340px] flex flex-col justify-center gap-4">
      <GlassCard className="p-4">
        <div className="text-xs text-slate-400">Priya R.</div>
        <div className="text-sm text-white mt-1">"Interesting — tell me more about how Weez handles ICP scoring?"</div>
      </GlassCard>
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-cyan-300">Trust score</span>
          <motion.span
            className="text-white font-mono"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            87 / 100
          </motion.span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
            animate={{ width: ["10%", "87%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="mt-3 text-xs text-emerald-300 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Optimal moment to propose meeting
        </div>
      </GlassCard>
    </div>
  );
}

function Stage10() {
  return (
    <div className="relative h-[340px] space-y-3">
      <GlassCard className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center">
          <CalendarCheck className="h-4 w-4 text-cyan-300" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-white">Discovery · Priya R.</div>
          <div className="text-xs text-slate-400">Thu · 11:30 AM · Google Meet</div>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-400/15 text-emerald-200">Booked</span>
      </GlassCard>
      <GlassCard className="p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Pipeline this week</span>
          <span className="text-emerald-300 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> +$184k
          </span>
        </div>
        <div className="mt-3 flex items-end gap-1 h-16">
          {[30, 45, 38, 60, 52, 78, 92].map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-cyan-500/30 to-cyan-300/80"
              initial={{ height: 0 }}
              whileInView={{ height: `${h}%` }}
              viewport={{ once: false, margin: "-80px" }}
              transition={{ delay: i * 0.08, duration: 0.6 }}
            />
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage registry                                                     */
/* ------------------------------------------------------------------ */

const stages = [
  {
    eyebrow: "Context",
    title: "Founder & Company Context",
    label: "Weez learns your founder story, product, customers, and positioning.",
    render: <Stage1 />,
  },
  {
    eyebrow: "Strategy",
    title: "Marketing Strategist",
    label: "Creates a continuously evolving marketing strategy.",
    render: <Stage2 />,
  },
  {
    eyebrow: "Creation",
    title: "Content Engine",
    label: "Produces high-conviction content tailored to your audience.",
    render: <Stage3 />,
  },
  {
    eyebrow: "Inbound",
    title: "Inbound Intelligence",
    label: "Tracks who is engaging with your content and why.",
    render: <Stage4 />,
  },
  {
    eyebrow: "Market",
    title: "Market Intelligence",
    label: "Discovers people engaging with similar conversations across the market.",
    render: <Stage5 />,
  },
  {
    eyebrow: "Leads",
    title: "Lead Intelligence",
    label: "Finds the 100 most relevant prospects instead of scraping thousands.",
    render: <Stage6 />,
  },
  {
    eyebrow: "Relationship",
    title: "Relationship Intelligence",
    label: "Builds relationship context before outreach begins.",
    render: <Stage7 />,
  },
  {
    eyebrow: "Outbound",
    title: "Outbound Engine",
    label: "Starts meaningful conversations instead of cold sales emails.",
    render: <Stage8 />,
  },
  {
    eyebrow: "Readiness",
    title: "Meeting Readiness",
    label: "Determines the optimal moment to introduce a meeting.",
    render: <Stage9 />,
  },
  {
    eyebrow: "Pipeline",
    title: "Calendar & Pipeline",
    label: "Turns conversations into opportunities and customers.",
    render: <Stage10 />,
  },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LivingWorkflow() {
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  // Translate the horizontal rail. ~88% of width to scroll through.
  const xRaw = useTransform(scrollYProgress, [0, 1], ["0%", "-87%"]);
  const x = useSpring(xRaw, { stiffness: 80, damping: 24, mass: 0.4 });

  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const flowItems = ["Content", "Signals", "Leads", "Conversations", "Meetings", "Customers"];

  return (
    <section className="relative bg-black text-white">
      {/* Heading */}
      <div className="relative mx-auto max-w-5xl px-6 pt-24 md:pt-32 pb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-cyan-300 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          The Weez Workflow
        </div>
        <h2 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
          Turn Content Into Pipeline Automatically
        </h2>
        <p className="mt-5 text-base md:text-lg text-slate-400 max-w-2xl mx-auto">
          Weez continuously learns from your company, creates content, discovers
          buying signals, qualifies leads, starts conversations, and books meetings.
        </p>
      </div>

      {/* Horizontal scroll rail */}
      <div
        ref={trackRef}
        className="relative"
        style={{ height: reduce ? "auto" : `${stages.length * 70}vh` }}
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          {/* Ambient background */}
          <div className="absolute inset-0">
            <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "60px 60px",
                maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              }}
            />
            <Particles count={50} />
          </div>

          {/* Progress bar */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Live system
            </span>
            <div className="h-px w-48 bg-white/10 overflow-hidden rounded-full">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-400 to-violet-400"
                style={{ width: progressWidth }}
              />
            </div>
          </div>

          {/* Rail */}
          <motion.div
            style={reduce ? undefined : { x }}
            className={`absolute top-0 left-0 h-full flex items-center ${
              reduce ? "flex-col overflow-x-auto w-full" : ""
            }`}
          >
            {stages.map((s, i) => (
              <div key={i} className="relative flex items-center">
                <StageShell
                  index={i + 1}
                  eyebrow={s.eyebrow}
                  title={s.title}
                  label={s.label}
                >
                  {s.render}
                </StageShell>
                {i < stages.length - 1 && (
                  <div className="relative h-px w-32 md:w-40 flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/40 via-cyan-300/20 to-violet-400/40" />
                    <motion.span
                      className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]"
                      animate={{ left: ["0%", "100%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    />
                    <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-300/70" />
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Final flow */}
      <div className="relative mx-auto max-w-5xl px-6 py-28 md:py-36 text-center">
        <div className="flex flex-col items-center gap-2 mb-16">
          {flowItems.map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.12, duration: 0.6 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md px-6 py-2.5 text-sm md:text-base text-white">
                {item}
              </div>
              {i < flowItems.length - 1 && (
                <motion.div
                  className="h-8 w-px bg-gradient-to-b from-cyan-300/80 to-transparent"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                />
              )}
            </motion.div>
          ))}
        </div>
        <h3 className="text-4xl md:text-6xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
          Not Another Marketing Tool
        </h3>
        <p className="mt-5 text-base md:text-lg text-slate-400 max-w-2xl mx-auto">
          An AI-Native Marketing Workforce that continuously generates pipeline.
        </p>
      </div>
    </section>
  );
}

export default LivingWorkflow;
