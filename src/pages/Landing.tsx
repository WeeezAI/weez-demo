import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Sparkles, ArrowRight, Instagram, Linkedin, Target, Wand2,
  Rocket, LineChart, Zap, BrainCircuit, MessageSquare, BarChart3,
  Users, Building2, Briefcase, Check, Menu, Play, TrendingUp, Quote,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/weez-logo.png";
import showcaseNotebook1 from "@/assets/showcase/notebooklm1.png";
import showcaseNotebook2 from "@/assets/showcase/notebooklm2.png";
import showcaseNotion1 from "@/assets/showcase/notion1.png";
import showcaseNotion2 from "@/assets/showcase/notion2.png";
import showcaseMedscore1 from "@/assets/showcase/medscore1.jpeg";
import showcaseMedscore2 from "@/assets/showcase/medscore2.jpeg";
import showcaseDexraflow1 from "@/assets/showcase/dexraflow1.png";
import showcaseDexraflow2 from "@/assets/showcase/dexraflow2.png";
import showcaseZeeks1 from "@/assets/showcase/zeeks1.jpeg";
import showcaseZeeks2 from "@/assets/showcase/zeeks2.jpeg";
import { HeroFloatingCards } from "@/components/HeroFloatingCards";

/* =============== Reusable bits =============== */

const fadeUp: any = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as any },
  }),
};

const GlowOrb = ({ className = "", color = "from-blue-500/40" }: any) => (
  <div className={`pointer-events-none absolute rounded-full blur-[120px] ${className}`}>
    <div className={`w-full h-full bg-gradient-to-br ${color} to-transparent rounded-full`} />
  </div>
);

const GridBG = () => (
  <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
);

const Section = ({ id, children, className = "" }: any) => (
  <section id={id} className={`relative py-28 px-6 ${className}`}>
    <div className="max-w-7xl mx-auto relative">{children}</div>
  </section>
);

const Eyebrow = ({ children }: any) => (
  <motion.div
    variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
    className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-900/10 bg-white/70 backdrop-blur text-xs font-medium text-slate-700"
  >
    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
    {children}
  </motion.div>
);

const H2 = ({ children, className = "" }: any) => (
  <motion.h2
    variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
    className={`font-agrandir font-bold text-4xl md:text-6xl tracking-tight text-slate-900 leading-[1.05] ${className}`}
  >
    {children}
  </motion.h2>
);

const Sub = ({ children, className = "" }: any) => (
  <motion.p
    variants={fadeUp} custom={1} initial="hidden" whileInView="show" viewport={{ once: true }}
    className={`text-base md:text-lg text-slate-600 max-w-2xl ${className}`}
  >
    {children}
  </motion.p>
);

const GradientButton = ({ children, onClick, variant = "primary" }: any) => {
  if (variant === "ghost") {
    return (
      <button
        onClick={onClick}
        className="group relative inline-flex items-center gap-2 h-12 px-6 rounded-full border border-slate-900/15 bg-slate-900/[0.04] backdrop-blur text-slate-900 text-sm font-medium hover:bg-slate-900/[0.06] transition"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="group relative inline-flex items-center gap-2 h-12 px-6 rounded-full text-white text-sm font-semibold overflow-hidden"
    >
      <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400" />
      <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 blur-xl opacity-60 group-hover:opacity-90 transition" />
      <span className="relative flex items-center gap-2">
        {children}
        <ArrowRight className="w-4 h-4 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
};

/* =============== Hero Visual =============== */

const HeroVisual = () => {
  const navigate = useNavigate();
  const prompts = [
    "Run my Marketing for 30 days",
    "Maximize my engagement for 30 days",
    "Do content posting for 30 days",
    "Do rapid marketing for 30 days",
  ];
  const chips = prompts;
  const tabs = [
    { label: "Chat", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { label: "Content Planner", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { label: "Connectors", icon: <Zap className="w-3.5 h-3.5" /> },
  ];

  const [typed, setTyped] = useState("");
  const [promptIdx, setPromptIdx] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pause" | "deleting">("typing");
  const [userTyping, setUserTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userTyping) return;
    const full = prompts[promptIdx];
    let timeout: any;
    if (phase === "typing") {
      if (typed.length < full.length) {
        timeout = setTimeout(() => setTyped(full.slice(0, typed.length + 1)), 55);
      } else {
        timeout = setTimeout(() => setPhase("deleting"), 1400);
      }
    } else if (phase === "deleting") {
      if (typed.length > 0) {
        timeout = setTimeout(() => setTyped(typed.slice(0, -1)), 28);
      } else {
        setPromptIdx((i) => (i + 1) % prompts.length);
        setPhase("typing");
      }
    }
    return () => clearTimeout(timeout);
  }, [typed, phase, promptIdx, userTyping]);

  const goAuth = () => navigate("/auth");

  // Container scroll animation
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 0.5], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.92, 1]);
  const translateY = useTransform(scrollYProgress, [0, 0.5], [40, 0]);

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-5xl" style={{ perspective: "1200px" }}>
      <motion.div
        style={{ rotateX, scale, y: translateY, transformStyle: "preserve-3d" }}
        className="relative"
      >
      <div className="relative rounded-3xl border border-slate-900/10 bg-white/70 backdrop-blur-2xl shadow-2xl shadow-blue-900/20 overflow-hidden">
        <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-900/5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-slate-500 font-mono">weez.ai / autopilot</span>
          </div>
          <div className="flex items-center gap-1">
            {tabs.map((t, i) => (
              <div
                key={t.label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${
                  i === 0
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400"
                }`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 sm:px-10 py-10 sm:py-14 bg-gradient-to-b from-blue-50/40 via-white to-sky-50/30">
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              <Zap className="w-3 h-3" />
              Autonomous Marketing Workforce
            </div>
          </div>

          <h3 className="mt-5 text-center text-2xl sm:text-4xl font-semibold tracking-tight text-slate-900">
            What shall we architect for<br />
            <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 bg-clip-text text-transparent">
              Acme Grade
            </span>{" "}
            today?
          </h3>
          <p className="mt-3 text-center text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            Deploy conversion-optimized artifacts and strategic narratives with absolute brand alignment.
          </p>

          {/* Editable Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); goAuth(); }}
            className="mt-8 rounded-2xl bg-white border border-slate-900/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-5 py-4 cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            <div className="min-h-[44px] flex items-center">
              <input
                ref={inputRef}
                value={typed}
                onFocus={() => { if (!userTyping) { setUserTyping(true); setTyped(""); } }}
                onChange={(e) => { setUserTyping(true); setTyped(e.target.value); }}
                placeholder="Ask Weez anything…"
                className="w-full bg-transparent border-0 outline-none text-sm text-slate-700 placeholder:text-slate-300"
              />
              {!userTyping && (
                <span className="ml-0.5 inline-block w-[2px] h-4 bg-blue-500 animate-pulse" />
              )}
            </div>
            <div className="flex items-center justify-end pt-3 border-t border-slate-900/5">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-50 border border-slate-900/5 hover:bg-slate-100 transition"
              >
                <Wand2 className="w-3 h-3" />
                Configure Workspace
              </button>
            </div>
          </form>

          <button
            onClick={goAuth}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-600 text-white py-4 text-sm font-semibold uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-shadow"
          >
            <Rocket className="w-4 h-4" />
            Run Autonomous Campaign
          </button>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {chips.map((c, i) => (
              <motion.button
                key={c}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                onClick={goAuth}
                className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-[11px] font-medium hover:scale-[1.03] transition-transform"
              >
                {c}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity }}
        className="absolute -left-4 top-20 hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-slate-900/10 bg-white shadow-lg text-xs text-slate-900">
        <Wand2 className="w-3.5 h-3.5 text-blue-500" /> Caption generated
      </motion.div>
      <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity }}
        className="absolute -right-4 bottom-20 hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-slate-900/10 bg-white shadow-lg text-xs text-slate-900">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> CTR up 24%
      </motion.div>
      </motion.div>
    </div>
  );
};

/* =============== Page =============== */

const Landing = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const priceTable = {
    USD: { symbol: "$", monthly: 79, yearly: 59, yearlyTotal: 708, savings: 240 },
    INR: { symbol: "₹", monthly: 2999, yearly: 1999, yearlyTotal: 23988, savings: 12000 },
  } as const;
  const fmt = (n: number) => n.toLocaleString(currency === "INR" ? "en-IN" : "en-US");
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -60]);

  // Rotating hero word
  const rotatingWords = ["Runs Itself", "Plans Itself", "Creates Itself", "Launches Itself", "Optimizes Itself"];
  const [wordIdx, setWordIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setWordIdx((i) => (i + 1) % rotatingWords.length), 2200);
    return () => clearInterval(id);
  }, []);

  const features = [
    { icon: <Wand2 />, title: "AI-Powered Content Creation", desc: "Generate posts, ads, and creatives instantly." },
    { icon: <MessageSquare />, title: "Automated Engagement", desc: "Convert conversations into leads, on autopilot." },
    { icon: <BarChart3 />, title: "Deep Analytics & Insights", desc: "Actionable recommendations on every metric." },
  ];

  const audiences = [
    { icon: <Building2 />, title: "SaaS Founders", desc: "Scale marketing without hiring a team." },
    { icon: <Users />, title: "Growth Teams", desc: "Automate execution and focus on strategy." },
    { icon: <Briefcase />, title: "Startups", desc: "Drive consistent user acquisition." },
  ];

  const integrations = ["LinkedIn", "Instagram", "Meta Ads", "Google Ads", "HubSpot", "Salesforce", "Notion", "Slack"];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-500/20 overflow-x-hidden">
      {/* Global ambient gradient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(34,211,238,0.12),transparent_55%)]" />
      </div>

      {/* Nav */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-xl bg-white/70 border-b border-slate-900/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src={logo} alt="Weez AI" className="h-7 w-auto" />
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-700">
            <a href="#how" className="hover:text-slate-900 transition">How it works</a>
            <a href="#features" className="hover:text-slate-900 transition">Features</a>
            <a href="#integrations" className="hover:text-slate-900 transition">Integrations</a>
            <a href="#pricing" className="hover:text-slate-900 transition">Pricing</a>
            <a href="#vision" className="hover:text-slate-900 transition">Vision</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/auth')} className="hidden sm:inline-flex text-slate-800 hover:text-slate-900 hover:bg-slate-900/[0.04] rounded-full">Log in</Button>
            <GradientButton onClick={() => navigate('/auth')}>Start Free</GradientButton>
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-900"><Menu /></Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-white border-slate-900/10 text-slate-900 pt-20">
                  <nav className="flex flex-col gap-5 text-lg">
                    <a href="#how">How it works</a>
                    <a href="#features">Features</a>
                    <a href="#integrations">Integrations</a>
                    <a href="#vision">Vision</a>
                    <button onClick={() => navigate('/auth')} className="text-left">Log in</button>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* 1. HERO */}
      <section className="relative pt-40 pb-28 px-6">
        <GridBG />
        <GlowOrb className="w-[600px] h-[600px] -top-40 -left-40" color="from-blue-600/50" />
        <GlowOrb className="w-[500px] h-[500px] top-20 right-0" color="from-blue-500/40" />
        <GlowOrb className="w-[400px] h-[400px] bottom-0 left-1/3" color="from-sky-400/30" />

        <motion.div style={{ y: heroY }} className="relative max-w-7xl mx-auto text-center">
          <Eyebrow>Autonomous Marketing • Live Beta</Eyebrow>
          <motion.h1
            variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="mt-6 font-agrandir font-bold text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[0.95]"
          >
            Marketing that <br />
            <span className="relative inline-block align-baseline overflow-hidden" style={{ minWidth: "8ch" }}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={rotatingWords[wordIdx]}
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  exit={{ y: "-100%", opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400"
                >
                  {rotatingWords[wordIdx]}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>
          <motion.p
            variants={fadeUp} custom={2} initial="hidden" animate="show"
            className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto"
          >
            Weez AI plans, creates, launches, and optimizes your marketing — so you get leads without hiring a team.
          </motion.p>
          <motion.div
            variants={fadeUp} custom={3} initial="hidden" animate="show"
            className="mt-9 flex items-center justify-center gap-3 flex-wrap"
          >
            <GradientButton onClick={() => navigate('/auth')}>Start Automating Marketing</GradientButton>
            <GradientButton variant="ghost"><Play className="w-4 h-4" /> Watch Demo</GradientButton>
          </motion.div>

          <motion.div
            variants={fadeUp} custom={4} initial="hidden" animate="show"
            className="mt-6 flex justify-center"
          >
            <a
              href="https://www.producthunt.com/products/weez-ai-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-weez-ai-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                alt="Weez AI - Where Marketing Runs Itself | Product Hunt"
                width="250"
                height="54"
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1139404&theme=light&t=1778051193830"
              />
            </a>
          </motion.div>

          <div className="mt-12">
            <HeroVisual />
          </div>
        </motion.div>
      </section>

      {/* 2. PROBLEM */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <Eyebrow>The Problem</Eyebrow>
            <H2 className="mt-5">Marketing is slow, expensive,<br/> and hard to scale.</H2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "Founders don't have time to run marketing consistently",
              "Hiring marketers or agencies is expensive",
              "Campaigns take weeks to execute",
              "Results are unpredictable and hard to optimize",
            ].map((t, i) => (
              <motion.div key={t} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="p-5 rounded-2xl border border-slate-900/10 bg-slate-900/[0.02] backdrop-blur">
                <div className="text-rose-300 text-xs font-mono mb-2">PROBLEM 0{i + 1}</div>
                <p className="text-slate-800 text-sm leading-relaxed">{t}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* 3. SOLUTION */}
      <Section>
        <div className="text-center mb-14">
          <Eyebrow>The Solution</Eyebrow>
          <H2 className="mt-5">Weez AI runs your marketing<br/> end-to-end.</H2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { i: <Target />, t: "Plans campaigns", d: "Based on your goals." },
            { i: <Wand2 />, t: "Creates content", d: "Posts, ads, creatives." },
            { i: <Rocket />, t: "Launches everywhere", d: "Across every platform." },
            { i: <LineChart />, t: "Optimizes results", d: "Improves automatically." },
          ].map((s, i) => (
            <motion.div key={s.t} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="relative p-6 rounded-2xl border border-slate-900/10 bg-gradient-to-b from-white/[0.05] to-transparent overflow-hidden group">
              <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-blue-500/20 blur-3xl group-hover:bg-blue-500/30 transition" />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-slate-900/[0.04] border border-slate-900/10 flex items-center justify-center text-blue-300 mb-4">
                  {s.i}
                </div>
                <h3 className="font-semibold text-slate-900">{s.t}</h3>
                <p className="text-sm text-slate-600 mt-1">{s.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* 4. HOW IT WORKS */}
      <Section id="how">
        <div className="text-center mb-16">
          <Eyebrow>How it Works</Eyebrow>
          <H2 className="mt-5">From strategy to results — automatically.</H2>
        </div>
        <div className="relative grid lg:grid-cols-3 gap-6">
          {/* connecting line */}
          <div className="hidden lg:block absolute top-16 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
          {[
            { n: "01", t: "Set Your Goal", d: "Tell Weez what you want — leads, growth, or engagement.", i: <Target /> },
            { n: "02", t: "Launch Instantly", d: "AI generates content and runs campaigns across platforms.", i: <Rocket /> },
            { n: "03", t: "Optimize Forever", d: "Tracks performance and improves results over time.", i: <TrendingUp /> },
          ].map((s, i) => (
            <motion.div key={s.n} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="relative p-7 rounded-3xl border border-slate-900/10 bg-slate-900/[0.03] backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
                  {s.i}
                </div>
                <span className="font-agrandir font-bold text-5xl text-slate-900/10">{s.n}</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900">{s.t}</h3>
              <p className="text-slate-600 text-sm mt-2 leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* 5. FEATURES */}
      <Section id="features">
        <div className="text-center mb-14">
          <Eyebrow>Capabilities</Eyebrow>
          <H2 className="mt-5">Power up your marketing<br/> with next-gen automation.</H2>
          <Sub className="mt-5 mx-auto">Weez AI combines intelligence and execution to run campaigns that actually perform.</Sub>
        </div>

        {/* Big cards */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {[
            { t: "All-in-One Marketing Automation", d: "Plan, create, and launch campaigns across platforms — all from one place.", g: "from-blue-600/30 to-blue-500/20" },
            { t: "Smarter Campaigns. Better Results.", d: "AI analyzes performance, optimizes in real-time, and scales what works.", g: "from-sky-400/30 to-blue-600/20" },
          ].map((c, i) => (
            <motion.div key={c.t} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className={`relative p-8 md:p-10 rounded-3xl border border-slate-900/10 bg-gradient-to-br ${c.g} overflow-hidden min-h-[260px]`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
              <div className="relative">
                <Sparkles className="w-6 h-6 text-slate-800 mb-5" />
                <h3 className="font-agrandir font-bold text-3xl text-slate-900 leading-tight">{c.t}</h3>
                <p className="text-slate-700 mt-3 max-w-md">{c.d}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Small cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="p-6 rounded-2xl border border-slate-900/10 bg-slate-900/[0.03] hover:bg-slate-900/[0.06] transition">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h4 className="font-semibold text-slate-900">{f.title}</h4>
              <p className="text-sm text-slate-600 mt-1">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* 6. WHO IT'S FOR */}
      <Section>
        <div className="text-center mb-14">
          <Eyebrow>Who It's For</Eyebrow>
          <H2 className="mt-5">Built for founders & teams who want<br/> marketing on autopilot.</H2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {audiences.map((a, i) => (
            <motion.div key={a.title} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="p-7 rounded-3xl border border-slate-900/10 bg-gradient-to-b from-white/[0.04] to-transparent text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/30 to-blue-500/30 flex items-center justify-center text-blue-200 mb-4">
                {a.icon}
              </div>
              <h3 className="text-xl font-semibold text-slate-900">{a.title}</h3>
              <p className="text-slate-600 text-sm mt-2">{a.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* 7. INTEGRATIONS */}
      <Section id="integrations">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Eyebrow>Integrations</Eyebrow>
          <H2 className="mt-5">Connect the channels that<br/> actually drive growth.</H2>
          <Sub className="mt-5">Weez AI plugs directly into the tools your team already lives in — capturing leads, running campaigns, and reporting back to you automatically.</Sub>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              name: "HubSpot CRM",
              tag: "Lead Tracking",
              desc: "Every lead generated by Weez AI flows straight into HubSpot — enriched, scored, and ready for sales follow-up.",
              icon: <Target className="w-6 h-6 text-white" />,
              gradient: "from-orange-500 to-rose-500",
              bullets: ["Auto-sync new leads", "Lifecycle stage updates", "Pipeline-ready contacts"],
            },
            {
              name: "LinkedIn",
              tag: "B2B Marketing",
              desc: "Run founder-led B2B campaigns — posts, thought leadership, and lead gen ads — fully automated for your ICP.",
              icon: <Linkedin className="w-6 h-6 text-white" />,
              gradient: "from-sky-500 to-blue-600",
              bullets: ["Daily authority posts", "Lead gen ad campaigns", "Inbound DM playbooks"],
            },
            {
              name: "Instagram",
              tag: "B2C Marketing",
              desc: "Drive consumer demand with auto-generated reels, carousels, and stories — published on the best-performing time slots.",
              icon: <Instagram className="w-6 h-6 text-white" />,
              gradient: "from-blue-500 to-pink-500",
              bullets: ["Reels & carousels", "Story automation", "Smart scheduling"],
            },
          ].map((it, i) => (
            <motion.div key={it.name} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="group relative p-7 rounded-3xl border border-slate-900/10 bg-white/80 backdrop-blur hover:border-slate-900/20 transition">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${it.gradient} flex items-center justify-center shadow-lg mb-5`}>
                {it.icon}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{it.tag}</div>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{it.name}</h3>
              <p className="text-sm text-slate-600 mt-3">{it.desc}</p>
              <ul className="mt-5 space-y-2">
                {it.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-blue-500" /> {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Email performance updates banner */}
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="mt-10 relative overflow-hidden rounded-3xl border border-slate-900/10 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-8 md:p-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center shadow-xl shadow-blue-500/30 shrink-0">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-wider text-blue-600 font-semibold">Performance Updates</div>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 font-agrandir">Weekly performance reports — straight to your inbox.</h3>
              <p className="text-slate-600 mt-2 text-sm md:text-base">No need to log in. Weez AI emails you a clean summary of leads generated, top-performing posts, ad spend efficiency, and what it's optimizing next.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Leads", "Engagement", "Ad ROAS", "Next moves"].map((c) => (
                <span key={c} className="px-3 py-1.5 rounded-full bg-white border border-slate-900/10 text-xs text-slate-700">{c}</span>
              ))}
            </div>
          </div>
        </motion.div>
      </Section>

      {/* 8. PROOF */}
      <Section>
        <div className="text-center mb-14">
          <Eyebrow>Results</Eyebrow>
          <H2 className="mt-5">Real results, not just features.</H2>
        </div>
        <div className="grid md:grid-cols-4 gap-5">
          {[
            { v: "5x", l: "Faster campaign creation" },
            { v: "+62%", l: "Engagement uplift" },
            { v: "-41%", l: "Lower marketing costs" },
            { v: "1.2k+", l: "Pilot users & waitlist" },
          ].map((s, i) => (
            <motion.div key={s.l} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="p-7 rounded-2xl border border-slate-900/10 bg-slate-900/[0.03] text-center">
              <div className="font-agrandir font-bold text-5xl bg-clip-text text-transparent bg-gradient-to-br from-blue-600 to-blue-600">
                {s.v}
              </div>
              <div className="text-sm text-slate-600 mt-2">{s.l}</div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* TESTIMONIALS */}
      <Section id="testimonials">
        <div className="text-center mb-14">
          <Eyebrow>Testimonials</Eyebrow>
          <H2 className="mt-5">Loved by founders<br/> who ship.</H2>
        </div>

        <div className="max-w-4xl mx-auto">
          {[
            {
              quote: "Weez AI doesn't just generate content — it understands our brand and creates relevant LinkedIn posts, ideas, and content plans that actually align with our positioning. It has saved us significant time while keeping our content consistent and authentic.",
              name: "Shivang",
              role: "Founder & CEO, Niverro Technologies",
              url: "www.niverro.com",
              initials: "S",
            },
          ].map((t, i) => (
            <motion.figure
              key={t.name}
              variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="relative p-8 md:p-12 rounded-[2rem] border border-slate-900/10 bg-white/80 backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(37,99,235,0.25)] overflow-hidden"
            >
              <div className="absolute -top-10 -right-6 text-blue-500/10">
                <Quote className="w-40 h-40" />
              </div>
              <div className="relative">
                <div className="flex gap-1 mb-6">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Sparkles key={s} className="w-4 h-4 text-blue-500 fill-blue-500" />
                  ))}
                </div>
                <blockquote className="font-agrandir text-2xl md:text-3xl leading-snug tracking-tight text-slate-900">
                  "{t.quote}"
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-sky-400 flex items-center justify-center text-white font-semibold text-lg shadow-lg shadow-blue-600/30">
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{t.name}</div>
                    <div className="text-sm text-slate-600">{t.role}</div>
                    <a
                      href={`https://${t.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 transition"
                    >
                      {t.url}
                    </a>
                  </div>
                </figcaption>
              </div>
            </motion.figure>
          ))}
        </div>
      </Section>

      {/* 9. VISION */}
      <Section id="vision">
        <div className="relative max-w-4xl mx-auto text-center p-12 md:p-16 rounded-[2.5rem] border border-slate-900/10 bg-gradient-to-br from-blue-200/60 via-blue-200/50 to-sky-200/40 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,0.18),transparent_60%)]" />
          <div className="relative">
            <Eyebrow>Vision</Eyebrow>
            <H2 className="mt-6">The future of marketing<br/> is autonomous.</H2>
            <p className="mt-6 text-slate-700 max-w-2xl mx-auto">
              Weez AI is building the world's first fully automated marketing system —
              where campaigns run, learn, and improve without manual effort.
            </p>
          </div>
        </div>
      </Section>

      {/* SHOWCASE — Content created by our system */}
      <Section id="showcase" className="overflow-hidden">
        <div className="text-center max-w-3xl mx-auto">
          <Eyebrow>Created by Weez</Eyebrow>
          <H2 className="mt-6">Content our system<br/> created in production.</H2>
          <Sub className="mt-5 mx-auto">
            Every visual below was conceived, designed and shipped autonomously by Weez —
            for real brands, in real campaigns.
          </Sub>
        </div>

        {/* Marquee row 1 */}
        <div className="mt-14 relative [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <motion.div
            className="flex gap-6 w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 60, ease: "linear", repeat: Infinity }}
          >
            {[
              { src: showcaseNotion1, brand: "Notion", title: "From Chaos to Clarity" },
              { src: showcaseMedscore1, brand: "Medscore", title: "Stop Credit Leaks" },
              { src: showcaseDexraflow1, brand: "Dexraflow", title: "CRM to Pipeline" },
              { src: showcaseZeeks1, brand: "Zeeks", title: "The $48K Spreadsheet" },
              { src: showcaseNotebook1, brand: "NotebookLM", title: "Passive to Active Synthesis" },
            ].concat([
              { src: showcaseNotion1, brand: "Notion", title: "From Chaos to Clarity" },
              { src: showcaseMedscore1, brand: "Medscore", title: "Stop Credit Leaks" },
              { src: showcaseDexraflow1, brand: "Dexraflow", title: "CRM to Pipeline" },
              { src: showcaseZeeks1, brand: "Zeeks", title: "The $48K Spreadsheet" },
              { src: showcaseNotebook1, brand: "NotebookLM", title: "Passive to Active Synthesis" },
            ]).map((item, i) => (
              <div key={`r1-${i}`} className="group relative w-[460px] shrink-0 rounded-2xl overflow-hidden border border-slate-900/10 bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.25)]">
                <img src={item.src} alt={`${item.brand} — ${item.title}`} loading="lazy" className="w-full h-[260px] object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">{item.brand}</div>
                  <div className="text-white font-medium text-sm">{item.title}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Marquee row 2 — reverse */}
        <div className="mt-6 relative [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <motion.div
            className="flex gap-6 w-max"
            animate={{ x: ["-50%", "0%"] }}
            transition={{ duration: 70, ease: "linear", repeat: Infinity }}
          >
            {[
              { src: showcaseNotebook2, brand: "NotebookLM", title: "Fragmented Information" },
              { src: showcaseZeeks2, brand: "Zeeks", title: "CFO Goes Pale in 12s" },
              { src: showcaseDexraflow2, brand: "Dexraflow", title: "147 Leads Automated" },
              { src: showcaseMedscore2, brand: "Medscore", title: "Revenue vs Collectability" },
              { src: showcaseNotion2, brand: "Notion", title: "7 Places Teams Hide Work" },
            ].concat([
              { src: showcaseNotebook2, brand: "NotebookLM", title: "Fragmented Information" },
              { src: showcaseZeeks2, brand: "Zeeks", title: "CFO Goes Pale in 12s" },
              { src: showcaseDexraflow2, brand: "Dexraflow", title: "147 Leads Automated" },
              { src: showcaseMedscore2, brand: "Medscore", title: "Revenue vs Collectability" },
              { src: showcaseNotion2, brand: "Notion", title: "7 Places Teams Hide Work" },
            ]).map((item, i) => (
              <div key={`r2-${i}`} className="group relative w-[460px] shrink-0 rounded-2xl overflow-hidden border border-slate-900/10 bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.25)]">
                <img src={item.src} alt={`${item.brand} — ${item.title}`} loading="lazy" className="w-full h-[260px] object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">{item.brand}</div>
                  <div className="text-white font-medium text-sm">{item.title}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          <span>Notion</span><span>NotebookLM</span><span>Medscore</span><span>Dexraflow</span><span>Zeeks</span>
        </div>
      </Section>



      {/* PRICING */}
      <Section id="pricing">
        <div className="text-center max-w-3xl mx-auto">
          <Eyebrow>Pricing</Eyebrow>
          <H2 className="mt-6">Simple, transparent pricing.</H2>
          <Sub className="mt-5 mx-auto">
            Replace your marketing workflow — not just a tool.
          </Sub>
        </div>

        {/* Currency toggle */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center p-1 rounded-full border border-slate-900/10 bg-white/80 backdrop-blur shadow-sm">
            <button
              onClick={() => setCurrency("USD")}
              className={`px-4 h-10 rounded-full text-sm font-medium transition inline-flex items-center gap-2 ${
                currency === "USD" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <svg className="w-5 h-5 rounded-sm" viewBox="0 0 20 16" xmlns="http://www.w3.org/2000/svg">
                <rect width="20" height="16" fill="#B22234"/>
                <rect y="1.23" width="20" height="1.23" fill="white"/>
                <rect y="3.69" width="20" height="1.23" fill="white"/>
                <rect y="6.15" width="20" height="1.23" fill="white"/>
                <rect y="8.62" width="20" height="1.23" fill="white"/>
                <rect y="11.08" width="20" height="1.23" fill="white"/>
                <rect y="13.54" width="20" height="1.23" fill="white"/>
                <rect width="8" height="8.62" fill="#3C3B6E"/>
              </svg>
              USD
            </button>
            <button
              onClick={() => setCurrency("INR")}
              className={`px-4 h-10 rounded-full text-sm font-medium transition inline-flex items-center gap-2 ${
                currency === "INR" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <svg className="w-5 h-5 rounded-sm" viewBox="0 0 20 16" xmlns="http://www.w3.org/2000/svg">
                <rect width="20" height="5.33" fill="#FF9932"/>
                <rect y="5.33" width="20" height="5.33" fill="white"/>
                <rect y="10.67" width="20" height="5.33" fill="#138808"/>
                <circle cx="10" cy="8" r="1.6" fill="#000080"/>
                <circle cx="10" cy="8" r="1.3" fill="none" stroke="#000080" strokeWidth="0.15"/>
              </svg>
              INR
            </button>
          </div>
        </div>

        {/* Billing toggle */}
        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center p-1 rounded-full border border-slate-900/10 bg-white/80 backdrop-blur shadow-sm">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 h-10 rounded-full text-sm font-medium transition ${
                billing === "monthly" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-5 h-10 rounded-full text-sm font-medium transition inline-flex items-center gap-2 ${
                billing === "yearly" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Yearly
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                billing === "yearly" ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-100 text-emerald-700"
              }`}>
                Save 25%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing card */}
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
          className="relative mt-12 max-w-3xl mx-auto"
        >
          <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-blue-500/30 via-blue-500/30 to-sky-400/30 blur-2xl" />
          <div className="relative rounded-[2rem] border border-slate-900/10 bg-white/90 backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(139,92,246,0.35)] overflow-hidden transition-transform duration-300 hover:-translate-y-1">
            {/* Top ribbon */}
            <div className="absolute top-5 right-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-blue-600 via-blue-500 to-sky-400 shadow-md">
                <Sparkles className="w-3 h-3" /> Recommended
              </span>
            </div>

            <div className="p-8 md:p-12">
              <div className="text-sm font-medium text-blue-600">Growth Plan</div>
              <div className="mt-1 font-agrandir font-bold text-2xl text-slate-900">
                Everything you need to run marketing on autopilot
              </div>

              {/* Price */}
              <div className="mt-8 flex items-end gap-3 flex-wrap">
                <div className="font-agrandir font-bold text-6xl md:text-7xl tracking-tight text-slate-900 leading-none">
                  {priceTable[currency].symbol}{fmt(billing === "yearly" ? priceTable[currency].yearly : priceTable[currency].monthly)}
                </div>
                <div className="pb-2 text-slate-600">
                  <div className="text-sm">/ month</div>
                  <div className="text-xs text-slate-500">
                    {billing === "yearly"
                      ? `billed annually (${priceTable[currency].symbol}${fmt(priceTable[currency].yearlyTotal)}/year)`
                      : "billed monthly"}
                  </div>
                </div>
                {billing === "yearly" && (
                  <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <TrendingUp className="w-3 h-3" /> Save {priceTable[currency].symbol}{fmt(priceTable[currency].savings)}/year (25% off)
                  </span>
                )}
              </div>

              {/* CTA */}
              <div className="mt-8 flex flex-col items-start gap-2">
                <GradientButton onClick={() => navigate('/auth')}>Start 14-Day Free Trial</GradientButton>
                <div className="text-xs text-slate-500">No credit card required</div>
              </div>

              <div className="my-10 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent" />

              {/* Features grouped */}
              <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
                {[
                  { title: "Core Automation", icon: <Zap className="w-4 h-4" />, items: ["Run LinkedIn marketing on autopilot", "AI-generated posts, articles & creatives", "Auto-publishing and scheduling"] },
                  { title: "Growth Engine", icon: <Rocket className="w-4 h-4" />, items: ["Founder-led & company-led distribution", "Automated engagement (comments, interactions)", "Lead generation system"] },
                  { title: "CRM & Pipeline", icon: <Target className="w-4 h-4" />, items: ["HubSpot integration", "Automatic lead capture", "Pipeline tracking"] },
                  { title: "Analytics & Intelligence", icon: <BarChart3 className="w-4 h-4" />, items: ["Deep performance analytics", "Industry benchmark comparison", "Best time to post insights", "Decision-maker engagement tracking"] },
                  { title: "System Capabilities", icon: <BrainCircuit className="w-4 h-4" />, items: ["Multi-account support", "Campaign automation", "Continuous optimization"] },
                ].map((g) => (
                  <div key={g.title}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/15 to-blue-500/15 text-blue-600 flex items-center justify-center">
                        {g.icon}
                      </span>
                      {g.title}
                    </div>
                    <ul className="mt-3 space-y-2">
                      {g.items.map((it) => (
                        <li key={it} className="flex items-start gap-2 text-sm text-slate-700">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </Section>

      {/* 10. FINAL CTA */}
      <Section>
        <div className="relative text-center py-16">
          <GlowOrb className="w-[500px] h-[300px] -top-20 left-1/2 -translate-x-1/2" color="from-blue-500/40" />
          <H2 className="relative">Start running your marketing<br/> on autopilot.</H2>
          <div className="relative mt-9 flex items-center justify-center gap-3 flex-wrap">
            <GradientButton onClick={() => navigate('/auth')}>Get Started Free</GradientButton>
            <GradientButton variant="ghost" onClick={() => navigate('/auth')}>Run Your First Campaign</GradientButton>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="relative border-t border-slate-900/5 py-12 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-poppins font-bold text-slate-900">Weez AI</span>
            </div>
            <p className="text-sm text-slate-500">Marketing that runs itself. Built by Dexraflow.</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Product</div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li><a href="#features" className="hover:text-slate-900">Features</a></li>
              <li><span onClick={() => navigate('/plans')} className="cursor-pointer hover:text-slate-900">Pricing</span></li>
              <li><a href="#integrations" className="hover:text-slate-900">Integrations</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Company</div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li><a href="mailto:support@dexraflow.com" className="hover:text-slate-900">Contact</a></li>
              <li><span onClick={() => navigate('/privacy-policy')} className="cursor-pointer hover:text-slate-900">Privacy</span></li>
              <li><span onClick={() => navigate('/terms-conditions')} className="cursor-pointer hover:text-slate-900">Terms</span></li>
              <li><span onClick={() => navigate('/data-deletion')} className="cursor-pointer hover:text-slate-900">Delete Account</span></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Social</div>
            <div className="flex gap-3">
              {[Linkedin, Instagram].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-full border border-slate-900/10 bg-slate-900/[0.04] hover:bg-slate-900/[0.06] flex items-center justify-center text-slate-700 hover:text-slate-900 transition">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-slate-900/5 flex items-center justify-between text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Weez AI · Dexraflow Inc.</span>
          <span>Made with ⚡ for autonomous marketers</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
