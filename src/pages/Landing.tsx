import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Sparkles, ArrowRight, Instagram, Linkedin, BrainCircuit, BarChart3, PenSquare,
  Check, X, Menu, Play, Quote,
  Radar, Send, CalendarRange, Layers, Signal, CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/weez-logo.png";
import AnimatedBackground from "@/components/landing/AnimatedBackground";
import HeroBackground from "@/components/landing/HeroBackground";
import LogoMarquee from "@/components/landing/LogoMarquee";
import DemoModal from "@/components/landing/DemoModal";
import HeroAITeam from "@/components/HeroAITeam";
import WeezWorkflow from "@/components/landing/WeezWorkflow";
import PostToMeeting from "@/components/landing/PostToMeeting";
import ReplaceStack from "@/components/landing/ReplaceStack";
import ninna from "@/assets/team/ninna.jpg";
import robert from "@/assets/team/robert.jpg";
import eva from "@/assets/team/eva.jpg";
import maxImg from "@/assets/team/max.jpg";

/* =============== Motion + primitives =============== */

const fadeUp: any = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as any },
  }),
};

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const Section = ({ id, children, className = "" }: any) => (
  <section id={id} className={`relative py-24 md:py-28 px-6 ${className}`}>
    <div className="relative mx-auto max-w-7xl">{children}</div>
  </section>
);

const Eyebrow = ({ children }: any) => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true }}
    className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur"
  >
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
    {children}
  </motion.div>
);

const H2 = ({ children, className = "" }: any) => (
  <motion.h2
    variants={fadeUp}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true }}
    className={`text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 md:text-5xl ${className}`}
  >
    {children}
  </motion.h2>
);

const Sub = ({ children, className = "" }: any) => (
  <motion.p
    variants={fadeUp}
    custom={1}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true }}
    className={`max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg ${className}`}
  >
    {children}
  </motion.p>
);

const PrimaryButton = ({ children, onClick }: any) => (
  <button
    onClick={onClick}
    className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full px-6 text-sm font-semibold text-white"
  >
    <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400" />
    <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 opacity-60 blur-xl transition group-hover:opacity-90" />
    <span className="relative flex items-center gap-2">
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </span>
  </button>
);

/* =============== Data =============== */

const TEAM_MINI = [
  { name: "Ninna", role: "CMO", img: ninna, ring: "ring-violet-400" },
  { name: "Eva", role: "Analyst", img: eva, ring: "ring-emerald-400" },
  { name: "Max", role: "Outreach", img: maxImg, ring: "ring-amber-400" },
  { name: "Robert", role: "Content", img: robert, ring: "ring-blue-400" },
];

const STEPS = [
  {
    n: "01",
    icon: <BrainCircuit className="h-5 w-5" />,
    title: "Learn your company",
    desc: "Weez learns your founder voice, product, positioning, and ICP — the context a marketing hire would take weeks to absorb.",
  },
  {
    n: "02",
    icon: <PenSquare className="h-5 w-5" />,
    title: "Create campaigns & content",
    desc: "Your AI team turns founder knowledge into founder-led content, messaging, and campaign angles built for your ICP.",
  },
  {
    n: "03",
    icon: <Radar className="h-5 w-5" />,
    title: "Find high-intent accounts",
    desc: "It tracks hiring, product, and growth signals to surface companies already showing intent — not scraped random lists.",
  },
  {
    n: "04",
    icon: <CalendarRange className="h-5 w-5" />,
    title: "Run warm outbound & book meetings",
    desc: "Weez finds the right buyer, enriches the contact, drafts contextual outreach, and moves conversations toward booked meetings.",
  },
];

const CAPABILITIES = [
  {
    icon: <PenSquare className="h-5 w-5" />,
    title: "Founder-Led Content Engine",
    desc: "Posts, campaigns, and narratives generated from founder context and product positioning.",
    accent: "from-blue-600 to-sky-500",
    large: true,
  },
  {
    icon: <CalendarRange className="h-5 w-5" />,
    title: "Campaign Planning & Execution",
    desc: "Plan content arcs and campaigns around launches, growth priorities, and product motion.",
    accent: "from-violet-500 to-fuchsia-500",
    large: true,
  },
  {
    icon: <Radar className="h-5 w-5" />,
    title: "Event-Driven Account Discovery",
    desc: "Track hiring, product launches, and growth signals across companies that match your ICP.",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    icon: <Send className="h-5 w-5" />,
    title: "Warm Outbound Workflow",
    desc: "Select the right contact, enrich them, and generate contextual outreach from real company motion.",
    accent: "from-amber-500 to-orange-500",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Marketing Intelligence & Analytics",
    desc: "Understand what's converting and which accounts and campaigns deserve attention next.",
    accent: "from-sky-500 to-blue-600",
  },
];

const DIFFERENTIATORS = [
  {
    icon: <BrainCircuit className="h-6 w-6" />,
    title: "It understands your business first",
    desc: "Weez doesn't start with prompts or random sequences. It learns your founder context, product, and customer profile before it writes or sends anything.",
  },
  {
    icon: <Signal className="h-6 w-6" />,
    title: "It works from buying signals",
    desc: "Instead of blasting generic outbound, Weez monitors companies showing relevant hiring, product, and growth signals — then acts on live intent.",
  },
  {
    icon: <Layers className="h-6 w-6" />,
    title: "Content + outbound in one system",
    desc: "Most tools either create content or automate sales. Weez connects founder-led marketing, campaign execution, and warm outbound into a single workflow.",
  },
];

const BEST_FIT = [
  "Founder-led B2B SaaS startups",
  "Post-validation / PMF-ish teams",
  "Lean GTM teams without a full marketing org",
  "Teams scaling content + outbound without 4 separate hires",
  "Startups that need pipeline before building an in-house team",
];

const NOT_FOR = [
  "Enterprise teams with a 20-person marketing org",
  "Ecommerce and D2C brands",
  "Agencies wanting white-labeled lead scraping",
  "Pure B2C consumer apps",
];

const METRICS = [
  { v: "5x", l: "Faster campaign creation" },
  { v: "+62%", l: "Engagement uplift" },
  { v: "-41%", l: "Lower marketing cost" },
  { v: "1.2k+", l: "Pilot users & waitlist" },
];

/* =============== Page =============== */

const Landing = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

  const [demoOpen, setDemoOpen] = useState(false);
  const goAuth = () => navigate("/auth");

  return (
    <div className="relative min-h-screen bg-[#FBFCFE] font-sans text-slate-900 [overflow-x:clip] selection:bg-blue-500/20">
      <AnimatedBackground />

      {/* ============ NAV ============ */}
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#080b12]/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate("/")}>
            <span
              style={{ fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif", fontWeight: 559 }}
              className="text-2xl leading-none tracking-tight text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]"
            >
              Dexraflow
            </span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/90 md:flex [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]">
            {[
              ["how", "How it works"],
              ["team", "The team"],
              ["capabilities", "Capabilities"],
              ["why", "Why Weez"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="transition hover:text-white"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={goAuth}
              className="hidden rounded-full text-white hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Log in
            </Button>
            <PrimaryButton onClick={() => setDemoOpen(true)}>Book a Demo</PrimaryButton>
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10"><Menu /></Button>
                </SheetTrigger>
                <SheetContent side="right" className="border-slate-900/10 bg-white pt-20 text-slate-900">
                  <nav className="flex flex-col gap-5 text-lg">
                    <button className="text-left" onClick={() => scrollTo("how")}>How it works</button>
                    <button className="text-left" onClick={() => scrollTo("team")}>The team</button>
                    <button className="text-left" onClick={() => scrollTo("capabilities")}>Capabilities</button>
                    <button className="text-left" onClick={() => scrollTo("why")}>Why Weez</button>
                    <button onClick={goAuth} className="text-left">Log in</button>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* ============ 1. HERO (cinematic ASCII) ============ */}
      <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#05070d]">
        {/* Hero background — your exact image (public/hero-forest.jpg), with the
            animated ASCII canvas as a fallback until the file is added. */}
        <HeroBackground className="absolute inset-0" />

        {/* Dark scrim over the image so the header + hero text are clearly
            legible: a slight overall darken, a left gradient under the text, a
            stronger top gradient under the header, and a bottom fade. */}
        <div className="pointer-events-none absolute inset-0 bg-black/30" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#05070d]" />

        {/* Content — anchored to the LEFT. */}
        <motion.div
          style={{ y: heroY }}
          className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col items-center justify-center px-6 pb-40 pt-28 lg:items-start"
        >
          <div className="max-w-2xl text-center lg:text-left">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-slate-200 backdrop-blur"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
              AI-Native Marketing Workforce · Built for B2B SaaS
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="show"
              className="mt-7 text-4xl font-semibold leading-[1.03] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] sm:text-6xl lg:text-[4.6rem]"
            >
              B2B SaaS growth without hiring a full marketing team
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="show"
              className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/90 [text-shadow:0_1px_16px_rgba(0,0,0,0.5)] md:text-lg lg:mx-0"
            >
              Weez is your AI-native marketing workforce — learning your founder voice, product, and
              ICP to create content, track high-intent accounts, and run warm outbound that turns
              into meetings.
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="show"
              className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            >
              <PrimaryButton onClick={() => setDemoOpen(true)}>Book a Demo</PrimaryButton>
              <button
                onClick={() => scrollTo("workflow")}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-6 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
              >
                <Play className="h-4 w-4" /> See Weez in Action
              </button>
            </motion.div>

            {/* mini team + proof */}
            <motion.div
              variants={fadeUp}
              custom={4}
              initial="hidden"
              animate="show"
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
            >
              <div className="flex -space-x-3">
                {TEAM_MINI.map((m) => (
                  <div
                    key={m.name}
                    className={`h-10 w-10 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-[#05070d] ${m.ring}`}
                  >
                    <img src={m.img} alt={m.name} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="text-sm text-slate-400">
                <span className="font-semibold text-slate-200">Ninna, Eva, Max &amp; Robert</span> — your
                AI team, online now.
              </div>
            </motion.div>

            <motion.a
              variants={fadeUp}
              custom={5}
              initial="hidden"
              animate="show"
              href="https://www.producthunt.com/products/weez-ai-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-weez-ai-2"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block"
            >
              <img
                alt="Weez AI on Product Hunt"
                width="230"
                height="50"
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1139404&theme=dark&t=1778051193830"
              />
            </motion.a>
          </div>
        </motion.div>

        {/* scroll cue */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
          <div className="flex h-9 w-6 items-start justify-center rounded-full border border-white/25 p-1.5">
            <span className="h-2 w-1 animate-bounce rounded-full bg-white/60" />
          </div>
        </div>
      </section>

      {/* ============ 1b. INTEGRATIONS MARQUEE (dark → light bridge) ============ */}
      <section className="relative bg-[#05070d] pb-20 pt-2">
        <div className="mx-auto max-w-7xl px-6">
          <p className="mb-8 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Connects with the tools you already use
          </p>
          <LogoMarquee />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#FBFCFE]" />
      </section>

      {/* ============ 2. HOW IT WORKS ============ */}
      <Section id="how">
        <div className="mb-16 text-center">
          <Eyebrow>How Weez Works</Eyebrow>
          <H2 className="mx-auto mt-5">From founder context to booked meetings.</H2>
          <Sub className="mx-auto mt-5 text-center">
            One connected workflow — not four disconnected tools stitched together.
          </Sub>
        </div>

        <div className="relative grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-16 hidden h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent lg:block" />
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="relative rounded-3xl border border-slate-900/10 bg-white/80 p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_24px_60px_-30px_rgba(30,64,175,0.35)]"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-lg shadow-blue-600/30">
                  {s.icon}
                </div>
                <span className="text-4xl font-bold tracking-tight text-slate-900/10">{s.n}</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ============ 3. MEET THE TEAM ============ */}
      <Section id="team">
        <div className="mb-4 text-center">
          <Eyebrow>Meet Your AI Marketing Team</Eyebrow>
          <H2 className="mx-auto mt-5">Four specialists. One operating system.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Not a set of features — a team with clear responsibilities, working together from
            strategy to booked pipeline.
          </Sub>
        </div>
        <HeroAITeam />
      </Section>

      {/* ============ 4. THE WEEZ WORKFLOW (motion-graphics loop) ============ */}
      <WeezWorkflow />

      {/* ============ 5. CAPABILITIES ============ */}
      <Section id="capabilities">
        <div className="mb-14 text-center">
          <Eyebrow>What Weez Handles</Eyebrow>
          <H2 className="mx-auto mt-5">Everything a lean marketing team would own.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Organized by outcome, not by dashboard. Here's what your AI workforce takes off your plate.
          </Sub>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-6">
          {CAPABILITIES.map((c, i) => (
            <motion.div
              key={c.title}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className={`group relative overflow-hidden rounded-3xl border border-slate-900/10 bg-white/80 p-7 backdrop-blur-xl transition hover:border-slate-900/20 ${
                c.large ? "lg:col-span-3" : "lg:col-span-2"
              }`}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl transition group-hover:bg-blue-500/20" />
              <div className="relative">
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${c.accent} text-white shadow-lg`}>
                  {c.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ============ 6. WHY DIFFERENT ============ */}
      <Section id="why">
        <div className="mb-14 text-center">
          <Eyebrow>Why Weez Is Different</Eyebrow>
          <H2 className="mx-auto mt-5">Not an SDR bot. Not a content tool.</H2>
          <Sub className="mx-auto mt-5 text-center">
            The difference isn't more automation — it's understanding, intent, and one connected system.
          </Sub>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {DIFFERENTIATORS.map((d, i) => (
            <motion.div
              key={d.title}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-3xl border border-slate-900/10 bg-gradient-to-b from-white to-slate-50/60 p-8"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                {d.icon}
              </div>
              <h3 className="text-xl font-semibold text-slate-900">{d.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{d.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ============ 7. POST TO MEETING (animated walkthrough) ============ */}
      <Section id="workflow" className="overflow-hidden">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>From post to meeting</Eyebrow>
          <H2 className="mx-auto mt-5">One post in. Booked meetings out.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Follow a single founder post as it becomes qualified pipeline — Robert publishes,
            Eva reads intent signals and enriches the account, Max runs warm outbound, and a
            meeting lands on the calendar. Fully autonomous.
          </Sub>
        </div>
        <div className="mt-16">
          <PostToMeeting />
        </div>
      </Section>

      {/* ============ 8. BUILT FOR / ICP ============ */}
      <Section id="fit">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <Eyebrow>Who It's For</Eyebrow>
          <H2 className="mx-auto mt-5">
            Built for B2B SaaS teams that need growth before they can hire a full marketing org.
          </H2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-8"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" /> Best fit for
            </div>
            <ul className="space-y-3">
              {BEST_FIT.map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-800">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <span className="text-[15px]">{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            variants={fadeUp}
            custom={1}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="rounded-3xl border border-slate-900/10 bg-white/80 p-8 backdrop-blur"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <X className="h-3.5 w-3.5" /> Probably not for
            </div>
            <ul className="space-y-3">
              {NOT_FOR.map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-500">
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                  <span className="text-[15px]">{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </Section>

      {/* ============ 9. SOCIAL PROOF ============ */}
      <Section id="proof" className="overflow-hidden">
        <div className="mb-12 text-center">
          <Eyebrow>Early Proof</Eyebrow>
          <H2 className="mx-auto mt-5">Real output, not just a promise.</H2>
        </div>

        {/* metrics */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((s, i) => (
            <motion.div
              key={s.l}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="rounded-3xl border border-slate-900/10 bg-white/80 p-7 text-center backdrop-blur"
            >
              <div className="bg-gradient-to-br from-blue-600 to-sky-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
                {s.v}
              </div>
              <div className="mt-2 text-sm text-slate-600">{s.l}</div>
            </motion.div>
          ))}
        </div>

        {/* testimonial */}
        <motion.figure
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="relative mx-auto mt-8 max-w-4xl overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/85 p-8 shadow-[0_30px_80px_-30px_rgba(37,99,235,0.25)] backdrop-blur-xl md:p-12"
        >
          <div className="absolute -right-6 -top-10 text-blue-500/10">
            <Quote className="h-40 w-40" />
          </div>
          <div className="relative">
            <div className="mb-6 flex gap-1">
              {Array.from({ length: 5 }).map((_, s) => (
                <Sparkles key={s} className="h-4 w-4 fill-blue-500 text-blue-500" />
              ))}
            </div>
            <blockquote className="text-2xl font-semibold leading-snug tracking-tight text-slate-900 md:text-3xl">
              "Weez doesn't just generate content — it understands our brand and creates
              relevant posts, ideas, and content plans that actually align with our positioning.
              It saved us serious time while keeping our content consistent and authentic."
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-sky-400 text-lg font-semibold text-white shadow-lg shadow-blue-600/30">
                S
              </div>
              <div>
                <div className="font-semibold text-slate-900">Shivang</div>
                <div className="text-sm text-slate-600">Founder &amp; CEO, Niverro Technologies</div>
                <a
                  href="https://www.niverro.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 transition hover:text-blue-700"
                >
                  www.niverro.com
                </a>
              </div>
            </figcaption>
          </div>
        </motion.figure>

      </Section>

      {/* ============ 9b. REPLACE THE STACK ============ */}
      <Section id="replace">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <Eyebrow>Replace, don't add</Eyebrow>
          <H2 className="mx-auto mt-5">Replace the stack — don't add to it.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Weez isn't one more tab in an already-crowded GTM stack. It collapses the hires and
            tools you'd otherwise stitch together into a single AI-native team.
          </Sub>
        </div>
        <ReplaceStack />
      </Section>

      {/* ============ 11. FINAL CTA ============ */}
      <Section>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2.5rem] border border-slate-900/10 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 px-8 py-16 text-center md:px-16 md:py-20"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.35),transparent_60%)]" />
          <div className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/30 blur-[120px]" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
              Stop stitching together content tools, lead lists, and SDR workflows.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300 md:text-lg">
              Let Weez act as your AI-native marketing team — from campaign creation to
              high-intent outbound that books meetings.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton onClick={() => setDemoOpen(true)}>Book a Demo</PrimaryButton>
              <button
                onClick={() => scrollTo("workflow")}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
              >
                <Play className="h-4 w-4" /> See Weez in Action
              </button>
            </div>
          </div>
        </motion.div>
      </Section>

      {/* ============ FOOTER ============ */}
      <footer className="relative border-t border-slate-900/5 px-6 py-12">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <img src={logo} alt="Weez AI" className="h-7 w-auto" />
            </div>
            <p className="text-sm text-slate-500">
              Your AI-native marketing workforce for B2B SaaS. Built by Dexraflow.
            </p>
          </div>
          <div>
            <div className="mb-3 text-xs uppercase tracking-widest text-slate-500">Product</div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li><button onClick={() => scrollTo("capabilities")} className="hover:text-slate-900">Capabilities</button></li>
              <li><button onClick={() => scrollTo("team")} className="hover:text-slate-900">The team</button></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-xs uppercase tracking-widest text-slate-500">Company</div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li><a href="mailto:support@dexraflow.com" className="hover:text-slate-900">Contact</a></li>
              <li><span onClick={() => navigate("/privacy-policy")} className="cursor-pointer hover:text-slate-900">Privacy</span></li>
              <li><span onClick={() => navigate("/terms-conditions")} className="cursor-pointer hover:text-slate-900">Terms</span></li>
              <li><span onClick={() => navigate("/data-deletion")} className="cursor-pointer hover:text-slate-900">Delete Account</span></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-xs uppercase tracking-widest text-slate-500">Social</div>
            <div className="flex gap-3">
              {[Linkedin, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-900/10 bg-slate-900/[0.04] text-slate-700 transition hover:bg-slate-900/[0.06] hover:text-slate-900"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-7xl items-center justify-between border-t border-slate-900/5 pt-6 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Weez AI · Dexraflow Inc.</span>
          <span>An AI-native marketing workforce for B2B SaaS.</span>
        </div>
      </footer>

      {/* Book a Demo — lead form modal (emails the team via SES) */}
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
};

export default Landing;
