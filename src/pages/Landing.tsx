import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Instagram, Linkedin, Check, X, Menu, Play, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
  IconWorldOrbit, IconNebulaBrain, IconSignalDish, IconCometSend, IconOrbitCalendar,
  IconMissionChart, IconRadarSweep, IconProbeMail, IconConstellation, IconRocket,
  IconCrew, IconTrajectory, IconEnergyCell, IconStation, IconBeacon,
  IconTelescope, IconTimeOrbit, IconStarMap, IconProbeBot, IconDockingPort,
  IconReplyComet, IconPipelineValue, IconSignalCount, IconAccounts, IconMeetingsBooked,
} from "@/components/landing/CosmicIcons";
import ninna from "@/assets/team/ninna.jpg";
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
    className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-indigo-700 shadow-[0_2px_14px_-6px_rgba(79,70,229,0.45)] backdrop-blur"
  >
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
    </span>
    {children}
  </motion.div>
);

const H2 = ({ children, className = "" }: any) => (
  <motion.h2
    variants={fadeUp}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true }}
    className={`text-4xl font-semibold leading-[1.08] tracking-tight text-indigo-950 md:text-5xl ${className}`}
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
    className={`max-w-2xl text-base leading-relaxed text-indigo-950/65 md:text-lg ${className}`}
  >
    {children}
  </motion.p>
);

const PrimaryButton = ({ children, onClick }: any) => (
  <button
    onClick={onClick}
    className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full px-6 text-sm font-semibold text-white"
  >
    <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-400" />
    <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-400 opacity-70 blur-xl transition group-hover:opacity-100" />
    <span className="relative flex items-center gap-2">
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </span>
  </button>
);

/* =============== Data =============== */

const TEAM_MINI = [
  { name: "Ninna", role: "GTM Strategist", img: ninna, ring: "ring-violet-400" },
  { name: "Eva", role: "Market Intelligence", img: eva, ring: "ring-cyan-400" },
  { name: "Max", role: "Sales Execution", img: maxImg, ring: "ring-amber-400" },
];

const STEPS = [
  {
    n: "01",
    icon: <IconWorldOrbit className="h-9 w-9" />,
    title: "Start with your website",
    desc: "Weez ingests your website to learn what you sell, who you sell to, and the outcomes you drive — no lengthy setup.",
  },
  {
    n: "02",
    icon: <IconNebulaBrain className="h-9 w-9" />,
    title: "Build your business context",
    desc: "It absorbs your product, positioning, and ICP — the context a GTM hire would take weeks to fully learn.",
  },
  {
    n: "03",
    icon: <IconSignalDish className="h-9 w-9" />,
    title: "Detect live buying signals",
    desc: "Weez continuously monitors hiring, funding, product, and growth signals to surface accounts already in-market.",
  },
  {
    n: "04",
    icon: <IconCometSend className="h-9 w-9" />,
    title: "Run autonomous outreach",
    desc: "It finds the right buyer, enriches the contact, and sends contextual outreach grounded in real signals.",
  },
  {
    n: "05",
    icon: <IconOrbitCalendar className="h-9 w-9" />,
    title: "Book qualified meetings",
    desc: "Positive replies turn into calendar-ready meetings — pipeline generated without hiring a single SDR.",
  },
];

const CAPABILITIES = [
  {
    icon: <IconMissionChart className="h-9 w-9" />,
    title: "Revenue Intelligence",
    desc: "Pipeline, qualified accounts, replies, and revenue impact in one live view — always know what's working.",
    accent: "from-indigo-500 to-violet-600",
    large: true,
  },
  {
    icon: <IconRadarSweep className="h-9 w-9" />,
    title: "Market Intelligence",
    desc: "Continuously track hiring, funding, product, and growth signals across companies that match your ICP.",
    accent: "from-cyan-400 to-teal-500",
    large: true,
  },
  {
    icon: <IconProbeMail className="h-9 w-9" />,
    title: "Sales Execution",
    desc: "Enrich the right contact and run warm, contextual outreach that turns live intent into booked meetings.",
    accent: "from-amber-400 to-orange-500",
  },
  {
    icon: <IconConstellation className="h-9 w-9" />,
    title: "Buying Signal Monitoring",
    desc: "Always-on detection of live in-market intent, so you reach accounts at exactly the right moment.",
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: <IconRocket className="h-9 w-9" />,
    title: "Autonomous Meetings",
    desc: "From first touch to booked meeting — executed autonomously, with you approving what matters.",
    accent: "from-indigo-600 to-cyan-400",
  },
];

const ADDITIONAL_CAPABILITIES = [
  {
    icon: <IconStarMap className="h-9 w-9" />,
    title: "Founder-Led Content Engine",
    desc: "Founder-led posts and campaigns that attract the right buyers and feed the top of your pipeline.",
    accent: "from-indigo-600 to-cyan-400",
  },
  {
    icon: <IconOrbitCalendar className="h-9 w-9" />,
    title: "Campaign Planning & Execution",
    desc: "Plan content and campaigns around launches, growth priorities, and product motion.",
    accent: "from-violet-500 to-fuchsia-500",
  },
];

const DIFFERENTIATORS = [
  {
    icon: <IconNebulaBrain className="h-11 w-11" />,
    title: "It understands your business first",
    desc: "Weez doesn't start with prompts or random sequences. It learns your business, product, and customer profile before it detects a signal or sends anything.",
  },
  {
    icon: <IconSignalDish className="h-11 w-11" />,
    title: "It works from live buying signals",
    desc: "Instead of blasting generic outbound, Weez monitors companies showing real hiring, funding, and growth signals — then acts on live intent.",
  },
  {
    icon: <IconMissionChart className="h-11 w-11" />,
    title: "Revenue intelligence, not vanity metrics",
    desc: "Most tools stop at opens and clicks. Weez ties every action to qualified accounts, booked meetings, and pipeline you can actually see.",
  },
];

const SIGNAL_SOURCES = [
  {
    icon: <IconCrew className="h-9 w-9" />,
    title: "Hiring signals",
    desc: "New roles and team expansion that reveal budget, priorities, and growth motion.",
  },
  {
    icon: <IconTrajectory className="h-9 w-9" />,
    title: "Funding & growth",
    desc: "Fresh funding, revenue milestones, and expansion that signal readiness to buy.",
  },
  {
    icon: <IconRocket className="h-9 w-9" />,
    title: "Product & launches",
    desc: "New products, features, and launches that map directly to the problem you solve.",
  },
  {
    icon: <IconEnergyCell className="h-9 w-9" />,
    title: "Tech & intent",
    desc: "Tooling changes and category research that point to active, in-market intent.",
  },
  {
    icon: <IconStation className="h-9 w-9" />,
    title: "Leadership changes",
    desc: "New executives and decision-makers who reset priorities and open buying windows.",
  },
  {
    icon: <IconBeacon className="h-9 w-9" />,
    title: "Engagement signals",
    desc: "Interactions with your content and category that surface warm, high-fit accounts.",
  },
];

const EXPLAINERS = [
  {
    icon: <IconTelescope className="h-11 w-11" />,
    q: "Why this company?",
    desc: "Weez shows the ICP fit and the exact signals that make this account worth pursuing right now.",
  },
  {
    icon: <IconTimeOrbit className="h-11 w-11" />,
    q: "Why now?",
    desc: "It surfaces the live trigger — a key hire, launch, or funding event — that makes the timing right.",
  },
  {
    icon: <IconStarMap className="h-11 w-11" />,
    q: "Why this contact?",
    desc: "It explains why this is the right buyer and how their role connects to the opportunity.",
  },
];

const METRICS = [
  { v: "1,240", l: "Buying Signals", icon: <IconSignalCount className="h-7 w-7" /> },
  { v: "318", l: "Qualified Accounts", icon: <IconAccounts className="h-7 w-7" /> },
  { v: "2,470", l: "Emails Sent", icon: <IconProbeMail className="h-7 w-7" /> },
  { v: "412", l: "Replies", icon: <IconReplyComet className="h-7 w-7" /> },
  { v: "63", l: "Meetings Booked", icon: <IconMeetingsBooked className="h-7 w-7" /> },
  { v: "$1.8M", l: "Revenue Pipeline", icon: <IconPipelineValue className="h-7 w-7" /> },
];

const SDR_TRADITIONAL = [
  "Weeks of hiring, onboarding, and ramp",
  "Manual list building and research",
  "Reps only work business hours",
  "Ramp costs, quota churn, and turnover",
  "Generic sequences blasted at scale",
];

const SDR_WEEZ = [
  "Live in days — no hiring required",
  "Autonomous research from live signals",
  "Monitors buying signals 24/7",
  "One simple plan — no ramp or churn",
  "Contextual outreach tailored per account",
];

const AI_SDR_EDGE = [
  {
    icon: <IconDockingPort className="h-11 w-11" />,
    title: "Plug-and-play setup",
    desc: "Point Weez at your website and it's ready — no long onboarding, prompt engineering, or CSV imports.",
  },
  {
    icon: <IconMissionChart className="h-11 w-11" />,
    title: "Revenue intelligence",
    desc: "Not just send-and-track. Weez ties outreach to qualified accounts, meetings, and pipeline revenue.",
  },
  {
    icon: <IconBeacon className="h-11 w-11" />,
    title: "Continuous signal monitoring",
    desc: "Always-on detection of live buying signals — not static lists that go stale the day you upload them.",
  },
  {
    icon: <IconProbeBot className="h-11 w-11" />,
    title: "Autonomous execution",
    desc: "Weez researches, decides, and runs outreach end-to-end — escalating only what needs your call.",
  },
];

const BEST_FIT = [
  "Founder-led B2B SaaS startups",
  "Post-validation / PMF-ish teams",
  "Lean GTM teams without a full sales org",
  "Teams generating pipeline without 4 separate hires",
  "Startups that need meetings before building an in-house team",
];

const NOT_FOR = [
  "Enterprise teams with a 20-person GTM org",
  "Ecommerce and D2C brands",
  "Agencies wanting white-labeled lead scraping",
  "Pure B2C consumer apps",
];

/* =============== Page =============== */

const Landing = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

  const [demoOpen, setDemoOpen] = useState(false);
  const goAuth = () => navigate("/auth");

  // The header sits over the dark space video at the top of the page, then
  // becomes light cosmic glass once the hero has scrolled away.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#F6F5FF] font-sans text-indigo-950 [overflow-x:clip] selection:bg-violet-500/20">
      <AnimatedBackground />

      {/* ============ NAV ============ */}
      <header
        className={`fixed top-0 z-50 w-full backdrop-blur-xl transition-colors duration-500 ${
          scrolled
            ? "border-b border-indigo-100 bg-white/80 shadow-[0_6px_30px_-24px_rgba(79,70,229,0.7)]"
            : "border-b border-white/10 bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate("/")}>
            <span
              style={{ fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif", fontWeight: 559 }}
              className={`text-2xl leading-none tracking-tight transition-colors duration-500 ${
                scrolled
                  ? "bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent"
                  : "text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]"
              }`}
            >
              Dexraflow
            </span>
          </div>
          <nav
            className={`hidden items-center gap-8 text-sm font-medium transition-colors duration-500 md:flex ${
              scrolled ? "text-indigo-950/75" : "text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.4)]"
            }`}
          >
            {[
              ["how", "How it works"],
              ["team", "The team"],
              ["capabilities", "Capabilities"],
              ["why", "Why Weez"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`transition ${scrolled ? "hover:text-indigo-600" : "hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={goAuth}
              className={`hidden rounded-full transition-colors duration-500 sm:inline-flex ${
                scrolled
                  ? "text-indigo-950/80 hover:bg-indigo-50 hover:text-indigo-700"
                  : "text-white hover:bg-white/10 hover:text-white"
              }`}
            >
              Log in
            </Button>
            <PrimaryButton onClick={() => setDemoOpen(true)}>Book a Demo</PrimaryButton>
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={scrolled ? "text-indigo-700 hover:bg-indigo-50" : "text-white hover:bg-white/10"}
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="border-indigo-100 bg-[#F6F5FF] pt-20 text-indigo-950">
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
        {/* Hero background — the looping video (public/hero-space.mp4), falling
            back to a still poster, then the animated ASCII canvas. */}
        <HeroBackground className="absolute inset-0" />

        {/* Dark scrim over the image so the header + hero text are clearly
            legible: a slight overall darken, a left gradient under the text, a
            stronger top gradient under the header, and a bottom fade. */}
        <div className="pointer-events-none absolute inset-0 bg-black/30" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#F6F5FF]" />

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
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-indigo-50 backdrop-blur"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              AI-Native GTM Workforce · Built for B2B SaaS
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="show"
              className="mt-7 text-4xl font-semibold leading-[1.03] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] sm:text-6xl lg:text-[4.6rem]"
            >
              B2B SaaS pipeline without hiring a full GTM team
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="show"
              className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/90 [text-shadow:0_1px_16px_rgba(0,0,0,0.5)] md:text-lg lg:mx-0"
            >
              Weez is your AI-native GTM workforce — it learns your business, detects live buying
              signals, and runs autonomous outreach to generate pipeline and book qualified meetings.
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="show"
              className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            >
              <PrimaryButton onClick={() => setDemoOpen(true)}>Deploy Your AI GTM Workforce</PrimaryButton>
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
                    className={`h-10 w-10 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-indigo-950/40 ${m.ring}`}
                  >
                    <img src={m.img} alt={m.name} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="text-sm text-indigo-100/80">
                <span className="font-semibold text-white">Ninna, Eva &amp; Max</span> — your
                AI GTM team, online now.
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
      <section className="relative pb-20 pt-10">
        <div className="mx-auto max-w-7xl px-6">
          <p className="mb-8 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-500/70">
            Connects with the tools you already use
          </p>
          <LogoMarquee />
        </div>
      </section>

      {/* ============ 2. HOW IT WORKS ============ */}
      <Section id="how">
        <div className="mb-16 text-center">
          <Eyebrow>How Weez Works</Eyebrow>
          <H2 className="mx-auto mt-5">From your website to booked meetings.</H2>
          <Sub className="mx-auto mt-5 text-center">
            One connected workflow — website to business context to signal detection to outreach to meetings.
          </Sub>
        </div>

        <div className="relative grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          <div className="absolute left-[12%] right-[12%] top-16 hidden h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent lg:block" />
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="relative rounded-3xl border border-indigo-100 bg-white/80 p-6 shadow-[0_1px_2px_rgba(79,70,229,0.04)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_28px_70px_-34px_rgba(99,102,241,0.55)]"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-cyan-50 ring-1 ring-indigo-100">
                  {s.icon}
                </div>
                <span className="bg-gradient-to-br from-indigo-300 to-violet-200 bg-clip-text text-4xl font-bold tracking-tight text-transparent">{s.n}</span>
              </div>
              <h3 className="text-lg font-semibold text-indigo-950">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-indigo-950/65">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ============ 3. MEET THE TEAM ============ */}
      <Section id="team">
        <div className="mb-4 text-center">
          <Eyebrow>Meet Your AI GTM Team</Eyebrow>
          <H2 className="mx-auto mt-5">Four specialists. One operating system.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Not a set of features — a team with clear responsibilities, working together from
            live signals to booked pipeline.
          </Sub>
        </div>
        <HeroAITeam />
      </Section>

      {/* ============ 4. THE WEEZ WORKFLOW (motion-graphics loop) ============ */}
      <WeezWorkflow />

      {/* ============ 5. HOW WEEZ FINDS BUYING SIGNALS ============ */}
      <Section id="signals">
        <div className="mb-14 text-center">
          <Eyebrow>Buying Signals</Eyebrow>
          <H2 className="mx-auto mt-5">How Weez finds accounts already in-market.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Weez continuously reads the signals that reveal real intent — so you reach buyers when
            they're most likely to move, not when a list happened to get uploaded.
          </Sub>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SIGNAL_SOURCES.map((s, i) => (
            <motion.div
              key={s.title}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="group relative overflow-hidden rounded-3xl border border-indigo-100 bg-white/80 p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_28px_70px_-34px_rgba(34,211,238,0.5)]"
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl transition group-hover:bg-cyan-400/25" />
              <div className="relative">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-50 to-indigo-50 ring-1 ring-cyan-100">
                  {s.icon}
                </div>
                <h3 className="text-lg font-semibold text-indigo-950">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-indigo-950/65">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ============ 6. EXPLAINABLE AI ============ */}
      <Section id="explainable">
        <div className="mb-14 text-center">
          <Eyebrow>Explainable AI</Eyebrow>
          <H2 className="mx-auto mt-5">Every account comes with a reason.</H2>
          <Sub className="mx-auto mt-5 text-center">
            No black box. For every account Weez surfaces, it shows its work — so you always know
            why it's worth your time.
          </Sub>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {EXPLAINERS.map((e, i) => (
            <motion.div
              key={e.q}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/50 p-8 transition hover:-translate-y-1 hover:shadow-[0_28px_70px_-34px_rgba(99,102,241,0.5)]"
            >
              <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-violet-400/10 blur-3xl" />
              <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white ring-1 ring-indigo-100 shadow-[0_10px_26px_-14px_rgba(79,70,229,0.5)]">
                {e.icon}
              </div>
              <h3 className="relative text-xl font-semibold text-indigo-950">{e.q}</h3>
              <p className="relative mt-3 text-sm leading-relaxed text-indigo-950/65">{e.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ============ 7. CAPABILITIES ============ */}
      <Section id="capabilities">
        <div className="mb-14 text-center">
          <Eyebrow>What Weez Handles</Eyebrow>
          <H2 className="mx-auto mt-5">Everything a lean GTM team would own.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Organized by revenue outcome, not by dashboard. Here's what your AI workforce takes off your plate.
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
              className={`group relative overflow-hidden rounded-3xl border border-indigo-100 bg-white/80 p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_28px_70px_-34px_rgba(139,92,246,0.5)] ${
                c.large ? "lg:col-span-3" : "lg:col-span-2"
              }`}
            >
              <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${c.accent} opacity-[0.12] blur-3xl transition group-hover:opacity-25`} />
              <div className="relative">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-cyan-50 ring-1 ring-indigo-100">
                  {c.icon}
                </div>
                <h3 className="text-lg font-semibold text-indigo-950">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-indigo-950/65">{c.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional (content) capabilities — secondary */}
        <div className="mt-14">
          <div className="mb-6 flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">
              Additional Capabilities
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {ADDITIONAL_CAPABILITIES.map((c, i) => (
              <motion.div
                key={c.title}
                variants={fadeUp}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="group relative overflow-hidden rounded-3xl border border-indigo-100 bg-white/70 p-7 backdrop-blur-xl transition hover:border-violet-200 hover:shadow-[0_24px_60px_-34px_rgba(139,92,246,0.45)]"
              >
                <div className="relative flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-cyan-50 ring-1 ring-indigo-100">
                    {c.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-indigo-950">{c.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-indigo-950/65">{c.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ============ 8. WHY DIFFERENT ============ */}
      <Section id="why">
        <div className="mb-14 text-center">
          <Eyebrow>Why Weez Is Different</Eyebrow>
          <H2 className="mx-auto mt-5">Not an SDR bot. Not a content tool.</H2>
          <Sub className="mx-auto mt-5 text-center">
            The difference isn't more automation — it's understanding, live intent, and revenue you can measure.
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
              className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-b from-white to-violet-50/50 p-8 transition hover:-translate-y-1 hover:shadow-[0_28px_70px_-34px_rgba(99,102,241,0.5)]"
            >
              <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white ring-1 ring-indigo-100 shadow-[0_10px_26px_-14px_rgba(79,70,229,0.5)]">
                {d.icon}
              </div>
              <h3 className="relative text-xl font-semibold text-indigo-950">{d.title}</h3>
              <p className="relative mt-3 text-sm leading-relaxed text-indigo-950/65">{d.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ============ 9. SIGNAL → RESEARCH → OUTREACH → MEETING (animated walkthrough) ============ */}
      <Section id="workflow" className="overflow-hidden">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Signal → Research → Outreach → Meeting</Eyebrow>
          <H2 className="mx-auto mt-5">A live signal in. A booked meeting out.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Follow a single buying signal as it becomes qualified pipeline — Eva reads the intent
            and enriches the account, Max runs warm outreach, and a meeting lands on the calendar.
            Fully autonomous.
          </Sub>
        </div>
        <div className="mt-16">
          <PostToMeeting />
        </div>
      </Section>

      {/* ============ 10. REVENUE INTELLIGENCE DASHBOARD ============ */}
      <Section id="dashboard" className="overflow-hidden">
        <div className="mb-12 text-center">
          <Eyebrow>Revenue Intelligence</Eyebrow>
          <H2 className="mx-auto mt-5">Your pipeline, in one live view.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Not a content calendar — a revenue dashboard. Every signal, account, and reply ties
            back to meetings booked and pipeline generated.
          </Sub>
        </div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-indigo-100 bg-white/85 p-6 shadow-[0_34px_90px_-34px_rgba(99,102,241,0.4)] backdrop-blur-xl md:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-cyan-50 ring-1 ring-indigo-100">
                <IconMissionChart className="h-6 w-6" />
              </span>
              <span className="text-sm font-semibold text-indigo-950">Revenue Intelligence Dashboard</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-100">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
              </span> Live
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {METRICS.map((s, i) => (
              <motion.div
                key={s.l}
                variants={fadeUp}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="rounded-2xl border border-indigo-100 bg-white p-6 text-left transition hover:border-violet-200 hover:shadow-[0_20px_50px_-30px_rgba(99,102,241,0.5)]"
              >
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-cyan-50 ring-1 ring-indigo-100">
                  {s.icon}
                </div>
                <div className="bg-gradient-to-br from-indigo-600 via-violet-500 to-cyan-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                  {s.v}
                </div>
                <div className="mt-1 text-sm text-indigo-950/65">{s.l}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* ============ 11. WEEZ vs TRADITIONAL SDR TEAM ============ */}
      <Section id="vs-sdr">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <Eyebrow>Weez vs a traditional SDR team</Eyebrow>
          <H2 className="mx-auto mt-5">Pipeline without the payroll.</H2>
          <Sub className="mx-auto mt-5 text-center">
            A traditional SDR team takes months to build and costs a fortune to run. Weez delivers
            the same outcome — qualified meetings — without the overhead.
          </Sub>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <motion.div
            variants={fadeUp}
            custom={1}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="rounded-3xl border border-indigo-100 bg-white/70 p-8 backdrop-blur"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-400">
              <X className="h-3.5 w-3.5" /> Traditional SDR team
            </div>
            <ul className="space-y-3">
              {SDR_TRADITIONAL.map((t) => (
                <li key={t} className="flex items-start gap-3 text-indigo-950/50">
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-indigo-200" />
                  <span className="text-[15px]">{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-8"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="relative mb-6 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700 shadow-sm ring-1 ring-cyan-100">
              <Sparkles className="h-3.5 w-3.5" /> Weez GTM workforce
            </div>
            <ul className="relative space-y-3">
              {SDR_WEEZ.map((t) => (
                <li key={t} className="relative flex items-start gap-3 text-indigo-950/80">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
                  <span className="text-[15px]">{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </Section>

      {/* ============ 12. WEEZ vs AI SDR PLATFORMS ============ */}
      <Section id="vs-ai-sdr">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <Eyebrow>Weez vs AI SDR platforms</Eyebrow>
          <H2 className="mx-auto mt-5">More than send-and-track automation.</H2>
          <Sub className="mx-auto mt-5 text-center">
            Most AI SDR tools automate sending against a list you upload. Weez runs the whole motion —
            and ties it to revenue.
          </Sub>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {AI_SDR_EDGE.map((d, i) => (
            <motion.div
              key={d.title}
              variants={fadeUp}
              custom={i}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-white/80 p-7 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_28px_70px_-34px_rgba(34,211,238,0.45)]"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-cyan-50 ring-1 ring-indigo-100">
                {d.icon}
              </div>
              <h3 className="text-base font-semibold text-indigo-950">{d.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-indigo-950/65">{d.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ============ 13. BUILT FOR / ICP ============ */}
      <Section id="fit">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <Eyebrow>Who It's For</Eyebrow>
          <H2 className="mx-auto mt-5">
            Built for B2B SaaS teams that need pipeline before they can hire a full GTM org.
          </H2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-8"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-violet-400/15 blur-3xl" />
            <div className="relative mb-6 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700 shadow-sm ring-1 ring-cyan-100">
              <Sparkles className="h-3.5 w-3.5" /> Best fit for
            </div>
            <ul className="relative space-y-3">
              {BEST_FIT.map((t) => (
                <li key={t} className="relative flex items-start gap-3 text-indigo-950/80">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
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
            className="rounded-3xl border border-indigo-100 bg-white/70 p-8 backdrop-blur"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-400">
              <X className="h-3.5 w-3.5" /> Probably not for
            </div>
            <ul className="space-y-3">
              {NOT_FOR.map((t) => (
                <li key={t} className="flex items-start gap-3 text-indigo-950/50">
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-indigo-200" />
                  <span className="text-[15px]">{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </Section>

      {/* ============ 14. REPLACE THE STACK ============ */}
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

      {/* ============ 15. FINAL CTA ============ */}
      <Section>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2.5rem] border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-violet-50 to-cyan-50 px-8 py-16 text-center shadow-[0_40px_100px_-50px_rgba(99,102,241,0.6)] md:px-16 md:py-20"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_62%)]" />
          <div className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-400/25 blur-[120px]" />
          <div className="pointer-events-none absolute -top-16 right-10 h-52 w-52 rounded-full bg-cyan-300/25 blur-[100px]" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-indigo-950 md:text-5xl">
              Stop stitching together lead lists, enrichment tools, and SDR workflows.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base text-indigo-950/70 md:text-lg">
              Let Weez act as your AI-native GTM workforce — from live buying signals to
              high-intent outreach that books qualified meetings.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton onClick={() => setDemoOpen(true)}>Book More Qualified Meetings</PrimaryButton>
              <button
                onClick={() => scrollTo("workflow")}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-6 text-sm font-medium text-indigo-700 backdrop-blur transition hover:bg-white"
              >
                <Play className="h-4 w-4" /> See Weez in Action
              </button>
            </div>
          </div>
        </motion.div>
      </Section>

      {/* ============ FOOTER ============ */}
      <footer className="relative border-t border-indigo-100 px-6 py-12">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <img src={logo} alt="Weez AI" className="h-7 w-auto" />
            </div>
            <p className="text-sm text-indigo-950/60">
              Your AI-native GTM workforce for B2B SaaS. Built by Dexraflow.
            </p>
          </div>
          <div>
            <div className="mb-3 text-xs uppercase tracking-widest text-indigo-500/80">Product</div>
            <ul className="space-y-2 text-sm text-indigo-950/75">
              <li><button onClick={() => scrollTo("capabilities")} className="transition hover:text-indigo-600">Capabilities</button></li>
              <li><button onClick={() => scrollTo("team")} className="transition hover:text-indigo-600">The team</button></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-xs uppercase tracking-widest text-indigo-500/80">Company</div>
            <ul className="space-y-2 text-sm text-indigo-950/75">
              <li><a href="mailto:support@dexraflow.com" className="transition hover:text-indigo-600">Contact</a></li>
              <li><span onClick={() => navigate("/privacy-policy")} className="cursor-pointer transition hover:text-indigo-600">Privacy</span></li>
              <li><span onClick={() => navigate("/terms-conditions")} className="cursor-pointer transition hover:text-indigo-600">Terms</span></li>
              <li><span onClick={() => navigate("/data-deletion")} className="cursor-pointer transition hover:text-indigo-600">Delete Account</span></li>
            </ul>
          </div>
          <div>
            <div className="mb-3 text-xs uppercase tracking-widest text-indigo-500/80">Social</div>
            <div className="flex gap-3">
              {[Linkedin, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-600 transition hover:border-violet-200 hover:text-violet-600 hover:shadow-[0_8px_22px_-12px_rgba(99,102,241,0.6)]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-7xl items-center justify-between border-t border-indigo-100 pt-6 text-xs text-indigo-950/55">
          <span>© {new Date().getFullYear()} Weez AI · Dexraflow Inc.</span>
          <span>An AI-native GTM workforce for B2B SaaS.</span>
        </div>
      </footer>

      {/* Book a Demo — lead form modal (emails the team via SES) */}
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
};

export default Landing;
