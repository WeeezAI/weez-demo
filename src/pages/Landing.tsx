import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Sparkles, ArrowRight, Instagram, Linkedin, Target, Wand2,
  Rocket, LineChart, Zap, BrainCircuit, MessageSquare, BarChart3,
  Users, Building2, Briefcase, Check, Menu, Play, TrendingUp,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/weez-logo.png";

/* =============== Reusable bits =============== */

const fadeUp: any = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as any },
  }),
};

const GlowOrb = ({ className = "", color = "from-violet-500/40" }: any) => (
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
    className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-900/10 bg-white/70 backdrop-blur text-xs font-medium text-zinc-700"
  >
    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
    {children}
  </motion.div>
);

const H2 = ({ children, className = "" }: any) => (
  <motion.h2
    variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
    className={`font-agrandir font-bold text-4xl md:text-6xl tracking-tight text-zinc-900 leading-[1.05] ${className}`}
  >
    {children}
  </motion.h2>
);

const Sub = ({ children, className = "" }: any) => (
  <motion.p
    variants={fadeUp} custom={1} initial="hidden" whileInView="show" viewport={{ once: true }}
    className={`text-base md:text-lg text-zinc-600 max-w-2xl ${className}`}
  >
    {children}
  </motion.p>
);

const GradientButton = ({ children, onClick, variant = "primary" }: any) => {
  if (variant === "ghost") {
    return (
      <button
        onClick={onClick}
        className="group relative inline-flex items-center gap-2 h-12 px-6 rounded-full border border-zinc-900/15 bg-zinc-900/[0.04] backdrop-blur text-zinc-900 text-sm font-medium hover:bg-zinc-900/[0.06] transition"
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
      <span className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400" />
      <span className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 blur-xl opacity-60 group-hover:opacity-90 transition" />
      <span className="relative flex items-center gap-2">
        {children}
        <ArrowRight className="w-4 h-4 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
};

/* =============== Hero Visual =============== */

const HeroVisual = () => {
  const posts = [
    { p: "Instagram", c: "from-fuchsia-500 to-rose-500", t: "Launching today 🚀" },
    { p: "LinkedIn", c: "from-cyan-500 to-blue-600", t: "How AI is changing GTM…" },
    { p: "Meta Ads", c: "from-violet-500 to-indigo-600", t: "30% lower CPL this week" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4 }}
      className="relative mx-auto w-full max-w-5xl"
    >
      <div className="relative rounded-3xl border border-zinc-900/10 bg-zinc-900/[0.03] backdrop-blur-2xl p-6 shadow-2xl shadow-violet-900/30">
        <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />
        {/* Top bar */}
        <div className="flex items-center justify-between pb-5 border-b border-zinc-900/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-zinc-500 font-mono">weez.ai / autopilot</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-300/90">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Generating campaign…
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 pt-5">
          {/* Generation column */}
          <div className="md:col-span-1 rounded-2xl border border-zinc-900/10 bg-gradient-to-b from-white/5 to-transparent p-4">
            <div className="text-[11px] uppercase tracking-widest text-zinc-500 mb-3">Brief</div>
            <div className="space-y-2">
              {["Get 100 SaaS demos", "Target founders", "LinkedIn + Instagram"].map((t, i) => (
                <motion.div key={t}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.2 }}
                  className="flex items-center gap-2 text-sm text-zinc-800">
                  <Check className="w-4 h-4 text-emerald-400" /> {t}
                </motion.div>
              ))}
            </div>
            <div className="mt-5 h-1.5 bg-zinc-900/[0.04] rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: "100%" }}
                transition={{ duration: 3, delay: 1, repeat: Infinity, repeatType: "reverse" }}
                className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400" />
            </div>
            <div className="mt-2 text-[11px] text-zinc-500">AI is creating 12 assets…</div>
          </div>

          {/* Posts column */}
          <div className="md:col-span-2 grid grid-cols-3 gap-3">
            {posts.map((post, i) => (
              <motion.div key={post.p}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + i * 0.25, duration: 0.6 }}
                className="rounded-xl border border-zinc-900/10 bg-zinc-900/[0.03] overflow-hidden"
              >
                <div className={`h-24 bg-gradient-to-br ${post.c} relative`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent_60%)]" />
                  <div className="absolute bottom-2 left-2 text-[10px] font-medium text-zinc-900 backdrop-blur bg-zinc-900/10 px-2 py-0.5 rounded-full">
                    {post.p}
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="text-[11px] text-zinc-800 leading-tight line-clamp-2">{post.t}</div>
                  <div className="mt-2 flex gap-1">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-1 flex-1 rounded-full bg-zinc-900/[0.06]">
                        <motion.div initial={{ width: 0 }} animate={{ width: "100%" }}
                          transition={{ delay: 1.5 + i * 0.2 + j * 0.1, duration: 0.8 }}
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-400" />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Stats row */}
            <div className="col-span-3 grid grid-cols-3 gap-3 mt-1">
              {[
                { l: "Reach", v: "284k", up: "+38%" },
                { l: "Leads", v: "1,204", up: "+62%" },
                { l: "CPL", v: "$3.40", up: "-41%" },
              ].map((s, i) => (
                <motion.div key={s.l}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8 + i * 0.15 }}
                  className="rounded-xl border border-zinc-900/10 bg-zinc-900/[0.02] p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{s.l}</div>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-lg font-semibold text-zinc-900">{s.v}</span>
                    <span className="text-[10px] text-emerald-300">{s.up}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating chips */}
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity }}
        className="absolute -left-4 top-12 hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-zinc-900/10 bg-white/80 backdrop-blur text-xs text-zinc-900">
        <Wand2 className="w-3.5 h-3.5 text-fuchsia-300" /> Caption generated
      </motion.div>
      <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity }}
        className="absolute -right-4 bottom-16 hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-zinc-900/10 bg-white/80 backdrop-blur text-xs text-zinc-900">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-300" /> CTR up 24%
      </motion.div>
    </motion.div>
  );
};

/* =============== Page =============== */

const Landing = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -60]);

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
    <div className="min-h-screen bg-[#FAFBFD] text-zinc-900 font-sans selection:bg-violet-500/20 overflow-x-hidden">
      {/* Global ambient gradient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(34,211,238,0.12),transparent_55%)]" />
      </div>

      {/* Nav */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-xl bg-white/70 border-b border-zinc-900/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src={logo} alt="Weez AI" className="h-7 w-auto" />
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-700">
            <a href="#how" className="hover:text-zinc-900 transition">How it works</a>
            <a href="#features" className="hover:text-zinc-900 transition">Features</a>
            <a href="#integrations" className="hover:text-zinc-900 transition">Integrations</a>
            <a href="#vision" className="hover:text-zinc-900 transition">Vision</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/auth')} className="hidden sm:inline-flex text-zinc-800 hover:text-zinc-900 hover:bg-zinc-900/[0.04] rounded-full">Log in</Button>
            <GradientButton onClick={() => navigate('/auth')}>Start Free</GradientButton>
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-zinc-900"><Menu /></Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-white border-zinc-900/10 text-zinc-900 pt-20">
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
        <GlowOrb className="w-[600px] h-[600px] -top-40 -left-40" color="from-violet-600/50" />
        <GlowOrb className="w-[500px] h-[500px] top-20 right-0" color="from-fuchsia-500/40" />
        <GlowOrb className="w-[400px] h-[400px] bottom-0 left-1/3" color="from-cyan-500/30" />

        <motion.div style={{ y: heroY }} className="relative max-w-7xl mx-auto text-center">
          <Eyebrow>Autonomous Marketing • Live Beta</Eyebrow>
          <motion.h1
            variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="mt-6 font-agrandir font-bold text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[0.95]"
          >
            Marketing that <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500">
              Runs Itself
            </span>
          </motion.h1>
          <motion.p
            variants={fadeUp} custom={2} initial="hidden" animate="show"
            className="mt-6 text-lg md:text-xl text-zinc-600 max-w-2xl mx-auto"
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

          <div className="mt-16">
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
                className="p-5 rounded-2xl border border-zinc-900/10 bg-zinc-900/[0.02] backdrop-blur">
                <div className="text-rose-300 text-xs font-mono mb-2">PROBLEM 0{i + 1}</div>
                <p className="text-zinc-800 text-sm leading-relaxed">{t}</p>
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
              className="relative p-6 rounded-2xl border border-zinc-900/10 bg-gradient-to-b from-white/[0.05] to-transparent overflow-hidden group">
              <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-violet-500/20 blur-3xl group-hover:bg-fuchsia-500/30 transition" />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-zinc-900/[0.04] border border-zinc-900/10 flex items-center justify-center text-fuchsia-300 mb-4">
                  {s.i}
                </div>
                <h3 className="font-semibold text-zinc-900">{s.t}</h3>
                <p className="text-sm text-zinc-600 mt-1">{s.d}</p>
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
          <div className="hidden lg:block absolute top-16 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent" />
          {[
            { n: "01", t: "Set Your Goal", d: "Tell Weez what you want — leads, growth, or engagement.", i: <Target /> },
            { n: "02", t: "Launch Instantly", d: "AI generates content and runs campaigns across platforms.", i: <Rocket /> },
            { n: "03", t: "Optimize Forever", d: "Tracks performance and improves results over time.", i: <TrendingUp /> },
          ].map((s, i) => (
            <motion.div key={s.n} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="relative p-7 rounded-3xl border border-zinc-900/10 bg-zinc-900/[0.03] backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-fuchsia-900/40">
                  {s.i}
                </div>
                <span className="font-agrandir font-bold text-5xl text-zinc-900/10">{s.n}</span>
              </div>
              <h3 className="text-xl font-semibold text-zinc-900">{s.t}</h3>
              <p className="text-zinc-600 text-sm mt-2 leading-relaxed">{s.d}</p>
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
            { t: "All-in-One Marketing Automation", d: "Plan, create, and launch campaigns across platforms — all from one place.", g: "from-violet-600/30 to-fuchsia-500/20" },
            { t: "Smarter Campaigns. Better Results.", d: "AI analyzes performance, optimizes in real-time, and scales what works.", g: "from-cyan-500/30 to-blue-600/20" },
          ].map((c, i) => (
            <motion.div key={c.t} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className={`relative p-8 md:p-10 rounded-3xl border border-zinc-900/10 bg-gradient-to-br ${c.g} overflow-hidden min-h-[260px]`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
              <div className="relative">
                <Sparkles className="w-6 h-6 text-zinc-800 mb-5" />
                <h3 className="font-agrandir font-bold text-3xl text-zinc-900 leading-tight">{c.t}</h3>
                <p className="text-zinc-700 mt-3 max-w-md">{c.d}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Small cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="p-6 rounded-2xl border border-zinc-900/10 bg-zinc-900/[0.03] hover:bg-zinc-900/[0.06] transition">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/15 text-fuchsia-300 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h4 className="font-semibold text-zinc-900">{f.title}</h4>
              <p className="text-sm text-zinc-600 mt-1">{f.desc}</p>
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
              className="p-7 rounded-3xl border border-zinc-900/10 bg-gradient-to-b from-white/[0.04] to-transparent text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center text-fuchsia-200 mb-4">
                {a.icon}
              </div>
              <h3 className="text-xl font-semibold text-zinc-900">{a.title}</h3>
              <p className="text-zinc-600 text-sm mt-2">{a.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* 7. INTEGRATIONS */}
      <Section id="integrations">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <Eyebrow>Ecosystem</Eyebrow>
            <H2 className="mt-5">Works with the tools<br/> you already use.</H2>
            <Sub className="mt-5">Plug Weez AI into your existing stack — and let it do the heavy lifting across LinkedIn, Instagram, Meta Ads, Google Ads, and your CRM.</Sub>
            <div className="mt-7">
              <GradientButton variant="ghost">View All Integrations</GradientButton>
            </div>
          </div>

          {/* Orbit visual */}
          <div className="relative h-[400px]">
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                className="absolute w-[280px] h-[280px] rounded-full border border-zinc-900/10" />
              <motion.div animate={{ rotate: -360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className="absolute w-[400px] h-[400px] rounded-full border border-zinc-900/5" />
              {/* central brain */}
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-fuchsia-900/60">
                <BrainCircuit className="w-10 h-10 text-white" />
                <div className="absolute inset-0 rounded-full bg-fuchsia-400/40 blur-xl animate-pulse" />
              </div>

              {integrations.slice(0, 6).map((name, i) => {
                const angle = (i / 6) * Math.PI * 2;
                const r = 140;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                return (
                  <motion.div key={name}
                    initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                    className="absolute"
                    style={{ transform: `translate(${x}px, ${y}px)` }}>
                    <div className="px-3 py-1.5 rounded-full border border-zinc-900/15 bg-white/80 backdrop-blur text-xs text-zinc-900 whitespace-nowrap">
                      {name}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
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
              className="p-7 rounded-2xl border border-zinc-900/10 bg-zinc-900/[0.03] text-center">
              <div className="font-agrandir font-bold text-5xl bg-clip-text text-transparent bg-gradient-to-br from-fuchsia-600 to-violet-600">
                {s.v}
              </div>
              <div className="text-sm text-zinc-600 mt-2">{s.l}</div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* 9. VISION */}
      <Section id="vision">
        <div className="relative max-w-4xl mx-auto text-center p-12 md:p-16 rounded-[2.5rem] border border-zinc-900/10 bg-gradient-to-br from-violet-200/60 via-fuchsia-200/50 to-cyan-200/40 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,70,239,0.18),transparent_60%)]" />
          <div className="relative">
            <Eyebrow>Vision</Eyebrow>
            <H2 className="mt-6">The future of marketing<br/> is autonomous.</H2>
            <p className="mt-6 text-zinc-700 max-w-2xl mx-auto">
              Weez AI is building the world's first fully automated marketing system —
              where campaigns run, learn, and improve without manual effort.
            </p>
          </div>
        </div>
      </Section>

      {/* 10. FINAL CTA */}
      <Section>
        <div className="relative text-center py-16">
          <GlowOrb className="w-[500px] h-[300px] -top-20 left-1/2 -translate-x-1/2" color="from-fuchsia-500/40" />
          <H2 className="relative">Start running your marketing<br/> on autopilot.</H2>
          <div className="relative mt-9 flex items-center justify-center gap-3 flex-wrap">
            <GradientButton onClick={() => navigate('/auth')}>Get Started Free</GradientButton>
            <GradientButton variant="ghost" onClick={() => navigate('/auth')}>Run Your First Campaign</GradientButton>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="relative border-t border-zinc-900/5 py-12 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-poppins font-bold text-zinc-900">Weez AI</span>
            </div>
            <p className="text-sm text-zinc-500">Marketing that runs itself. Built by Dexraflow.</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Product</div>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li><a href="#features" className="hover:text-zinc-900">Features</a></li>
              <li><span onClick={() => navigate('/plans')} className="cursor-pointer hover:text-zinc-900">Pricing</span></li>
              <li><a href="#integrations" className="hover:text-zinc-900">Integrations</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Company</div>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li><a href="mailto:support@dexraflow.com" className="hover:text-zinc-900">Contact</a></li>
              <li><span onClick={() => navigate('/privacy-policy')} className="cursor-pointer hover:text-zinc-900">Privacy</span></li>
              <li><span onClick={() => navigate('/terms-conditions')} className="cursor-pointer hover:text-zinc-900">Terms</span></li>
              <li><span onClick={() => navigate('/data-deletion')} className="cursor-pointer hover:text-zinc-900">Delete Account</span></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Social</div>
            <div className="flex gap-3">
              {[Linkedin, Instagram].map((Icon, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-full border border-zinc-900/10 bg-zinc-900/[0.04] hover:bg-zinc-900/[0.06] flex items-center justify-center text-zinc-700 hover:text-zinc-900 transition">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-zinc-900/5 flex items-center justify-between text-xs text-zinc-500">
          <span>© {new Date().getFullYear()} Weez AI · Dexraflow Inc.</span>
          <span>Made with ⚡ for autonomous marketers</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
