import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import AccessRequestModal from "@/components/stealth/AccessRequestModal";
import { BrandIcon, MissedSignalScene, NoOwnerScene, SilentFailureScene, useStage } from "@/components/landing/UseCaseAnimations";
import { EASE, FOCUS, Reveal } from "@/components/landing/primitives";
import HeroStory from "@/components/landing/v1/HeroStory";
import McpGateIso from "@/components/landing/v1/McpGateIso";
import { ConnectBlock, LogoStrip, ToolsGrid, TrustStrip, useConnectTabs } from "@/components/landing/McpSection";
import { WithoutWith } from "@/components/landing/McpAnimations";
import { IsoAgents, IsoAudit, IsoBrokenZap, IsoCoverage, IsoDailyCheck, IsoEmptyRows, IsoFormDrop, IsoHotLead, IsoNightStack, IsoNoOwner, IsoRadar, IsoSchemaShift, IsoShield, IsoStopped, IsoTestLead } from "@/components/landing/v1/IsoIcons";
import { BorderBeam, CountUp, ElapsedBar, HeroBackdrop, NightGrid, ScrollProgress, TiltCard, WordReveal } from "@/components/landing/v1/motion";
import { CONTACT_EMAIL } from "@/components/stealth/contact";
import type { AccessIntent } from "@/services/earlyAccessAPI";

/* V1 landing page. One problem: lead workflows break silently and teams find out weeks later.
   Calm, light, lots of whitespace. Amber appears only where something broke.
   Motion tells the same story: leads move, a handoff breaks silently, the plane catches it. */

const ONE_LINER = "Dexraflow catches workflows that silently break and tells you which leads you lost, the same day, not three weeks later.";

/* ───────────────────────── content ───────────────────────── */

const STORIES = [
  { n: 3, unit: "weeks", days: 21, title: "A Zap broke after an update.", body: "A $30k deal was lost. The prospect wrote back to ask why nobody had followed up.", Icon: IsoBrokenZap },
  { n: 11, unit: "days", days: 11, title: "The workflow kept running with zero rows.", body: "Every run reported success. From the dashboard, it looked exactly like a quiet week.", Icon: IsoEmptyRows },
  { n: 8, unit: "days", days: 8, title: "A schema change broke routing.", body: "The webhook reported success before the CRM write happened. Nothing was assigned.", Icon: IsoSchemaShift },
];

const HANDOFFS = [
  { name: "Forms", today: 212, yesterday: 208 },
  { name: "CRM", today: 212, yesterday: 208 },
  { name: "Routing", today: 175, yesterday: 208, missing: 37 },
  { name: "Sequencing", today: 175, yesterday: 208 },
];

const CATCHES = [
  { n: "01", title: "A workflow stopped", body: "Volume drops to zero and nothing errors. The run still says success.", Scene: SilentFailureScene, Icon: IsoStopped },
  { n: "02", title: "Form fills that never became leads", body: "Submissions against leads created, per source, so a broken form-to-CRM step shows up the same day.", Scene: null, Icon: IsoFormDrop },
  { n: "03", title: "Leads with no owner", body: "Routing stopped matching. New leads sit unassigned, with no task and no follow-up.", Scene: NoOwnerScene, Icon: IsoNoOwner },
  { n: "04", title: "Hot leads with no follow-up", body: "Demo requests and repeat submissions nobody contacted.", Scene: MissedSignalScene, Icon: IsoHotLead },
];

const TRUST = ["Read-only access", "NDA before any data moves", "Your data never goes into AI models", "Raw exports deleted within 7 days"];

const MCP_STEPS = [
  { k: "01", t: "The agent asks", d: "Before any outreach or CRM write, it calls check_action with what it wants to do." },
  { k: "02", t: "Dexraflow checks every tool", d: "Owner, open deals, last touch, what other agents did, your rules." },
  { k: "03", t: "It answers allow, hold or wait", d: "With the reason. It never sends anything itself." },
  { k: "04", t: "Every decision is logged", d: "Allowed writes go through and are recorded. Held ones go to the owner in Slack." },
];

const VISION = [
  { k: "Now", t: "Catch silent breaks.", d: "A daily check across every handoff, with the leads you lost and what they were worth.", Icon: IsoRadar },
  { k: "Next", t: "Warn before a change breaks something.", d: "Know when a field, form or rule change will stop a workflow before it does.", Icon: IsoShield },
  { k: "Then", t: "Every AI agent checks Dexraflow first.", d: "Before it writes to your CRM or sends a message.", Icon: IsoAgents },
];

/* ───────────────────────── primitives ───────────────────────── */

const MONO = "font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em]";

const Button = ({ onClick, href, children, tone = "primary", className = "" }: { onClick?: () => void; href?: string; children: ReactNode; tone?: "primary" | "ghost" | "light"; className?: string }) => {
  const tones = {
    primary: "bg-dx-brand text-white hover:bg-dx-brand-hover",
    ghost: "border border-dx-line-strong bg-transparent text-dx-ink hover:bg-dx-sunken",
    light: "bg-white text-dx-ink hover:bg-dx-surface",
  };
  const cls = `group inline-flex h-11 items-center justify-center gap-2 rounded-[8px] px-5 text-[14px] font-medium transition active:scale-[0.98] [&>svg]:transition-transform [&>svg]:duration-300 hover:[&>svg]:translate-x-0.5 ${tones[tone]} ${FOCUS} ${className}`;
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
};

const Label = ({ children, className = "" }: { children: ReactNode; className?: string }) => <p className={`${MONO} text-dx-ink-muted ${className}`}>{children}</p>;

/** Section header: a mono label, a short headline, an optional one-line subline. Left-aligned, calm. */
const Head = ({ id, label, title, sub }: { id: string; label: string; title: string; sub?: ReactNode }) => (
  <div className="max-w-3xl">
    <Label>{label}</Label>
    <h2 id={id} className="mt-4 text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-dx-ink sm:text-[40px] sm:leading-[46px]">
      {title}
    </h2>
    {sub && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-dx-ink-muted">{sub}</p>}
  </div>
);

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`rounded-[8px] border border-dx-line bg-dx-raised ${className}`}>{children}</div>;

const Section = ({ id, children, tight = false }: { id?: string; children: ReactNode; tight?: boolean }) => (
  <section id={id} className={`scroll-mt-24 px-5 sm:px-8 ${tight ? "py-16 md:py-20" : "py-20 md:py-28"}`} aria-labelledby={id ? `${id}-title` : undefined}>
    <div className="mx-auto max-w-6xl">{children}</div>
  </section>
);

/* ───────────────────────── chrome ───────────────────────── */

const Wordmark = ({ className = "h-6" }: { className?: string }) => <img src="/brand/dexraflow-lockup.svg" alt="Dexraflow" width={137} height={28} className={`w-auto ${className}`} />;

const NAV_LINKS = [
  { href: "#problem", label: "The problem" },
  { href: "#how", label: "How it works" },
  { href: "#catches", label: "What it catches" },
  { href: "#offer", label: "The offer" },
  { href: "#mcp", label: "MCP" },
];

const Nav = ({ onAudit }: { onAudit: () => void }) => (
  <header className="fixed inset-x-0 top-0 z-50 border-b border-dx-line bg-dx-surface/90 backdrop-blur-xl">
    <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Primary">
      <div className="flex items-center gap-10">
        <Link to="/" aria-label="Dexraflow home" className={`rounded ${FOCUS}`}>
          <Wordmark />
        </Link>
        <div className="hidden items-center gap-7 text-[14px] font-medium text-dx-ink-muted lg:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={`rounded transition hover:text-dx-ink ${FOCUS}`}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
      <Button onClick={onAudit} className="!h-9">
        <span className="sm:hidden">Book an audit</span>
        <span className="hidden sm:inline">Book a Missed Pipeline Audit</span>
      </Button>
    </nav>
    <ScrollProgress />
  </header>
);

/* ───────────────────────── hero ───────────────────────── */

const Hero = ({ onAudit }: { onAudit: () => void }) => {
  const reduce = !!useReducedMotion();
  const enter = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.45 + i * 0.08, ease: EASE } });
  return (
    <section className="relative overflow-hidden px-5 pb-10 pt-28 sm:px-8 md:pb-16 md:pt-36" aria-labelledby="hero-title">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-6xl">
        {/* headline left, the one-liner and actions right, like a magazine spread */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <WordReveal id="hero-title" text="Your GTM tools are dropping leads." muted="Silently." className="max-w-3xl text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-dx-ink sm:text-[54px] sm:leading-[1.02] lg:text-[58px]" />
          <div className="lg:border-l lg:border-dx-line lg:pl-8">
            <motion.p {...enter(1)} className="max-w-xl text-[17px] leading-relaxed text-dx-ink-muted sm:text-[18px]">
              {ONE_LINER}
            </motion.p>
            <motion.div {...enter(2)} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={onAudit}>
                Book a Missed Pipeline Audit <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Button>
              <Button href="#how" tone="ghost">
                See how it works
              </Button>
            </motion.div>
            <motion.p {...enter(3)} className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-dx-ink-muted">
              <span>Read-only.</span>
              <span className="inline-flex items-center gap-3">
                {["hubspot", "salesforce", "zapier"].map((k) => (
                  <BrandIcon key={k} k={k} size={16} />
                ))}
              </span>
              <span>HubSpot, Salesforce and Zapier first.</span>
            </motion.p>
          </div>
        </div>

        {/* the stage: one lead's journey in three chapters */}
        <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.5, ease: EASE }} className="mt-10 md:mt-14">
          <HeroStory />
        </motion.div>
      </div>
    </section>
  );
};

/* ───────────────────────── 3 · handoff flow ───────────────────────── */

/** Four handoffs with today's and yesterday's counts. The control bar's check walks the row; the break lights up in amber as it reaches it. */
const HandoffFlow = () => {
  const { ref, stage, reduce } = useStage(HANDOFFS.length + 4, 1200);
  const reached = (i: number) => reduce || stage >= i;
  const breakIdx = HANDOFFS.findIndex((h) => h.missing);
  const showBreak = reduce || stage > breakIdx;
  return (
    <div ref={ref} role="img" aria-label="Forms, CRM, Routing and Sequencing in a row with today's and yesterday's lead counts. Routing shows 175 against 208, with 37 missing, highlighted in amber.">
      {/* the control plane, checking each handoff in turn */}
      <div className="mb-3 flex items-center justify-between rounded-[8px] bg-dx-ink px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dx-brand-night opacity-60" />}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-dx-brand-night" />
          </span>
          <span className={`${MONO} text-white`}>Dexraflow · daily check</span>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {HANDOFFS.map((h, i) => (
            <motion.span key={h.name} className="h-1 w-5 rounded-full" initial={false} animate={{ background: reached(i) ? (h.missing && showBreak ? "#e8962e" : "#3bbfaf") : "rgba(255,255,255,0.18)" }} transition={{ duration: 0.3 }} />
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
        {HANDOFFS.map((h, i) => (
          <div key={h.name} className="contents">
            <motion.div
              className="relative overflow-hidden rounded-[8px] border bg-dx-raised p-4"
              initial={false}
              animate={{ borderColor: h.missing && showBreak ? "#e8962e" : reached(i) && stage === i && !reduce ? "#0b6e69" : "#d3dcd9", opacity: reached(i) ? 1 : 0.45 }}
              transition={{ duration: 0.35 }}
            >
              {stage === i && !reduce && (
                <motion.div key={`scan-${stage}`} aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,transparent,rgba(11,110,105,0.12),transparent)]" initial={{ x: "-100%" }} animate={{ x: "300%" }} transition={{ duration: 0.9, ease: "easeInOut" }} />
              )}
              <p className={`${MONO} text-dx-ink-muted`}>{h.name}</p>
              <div className="mt-3 flex items-end gap-3">
                <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-dx-ink">{h.today}</p>
                <p className="pb-1 font-dx-mono text-[12px] text-dx-ink-muted">
                  <span className="text-dx-ink">today</span> · {h.yesterday} yesterday
                </p>
              </div>
              <div className="mt-3 h-6">
                {h.missing && showBreak && (
                  <motion.span initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`inline-flex items-center gap-1.5 rounded-[4px] border border-dx-signal/40 bg-dx-signal-soft px-2 py-0.5 ${MONO} text-dx-signal-ink`}>
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-dx-signal" />
                    {h.missing} missing
                  </motion.span>
                )}
              </div>
            </motion.div>
            {i < HANDOFFS.length - 1 && (
              <div className="flex items-center justify-center" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 32 32" className="hidden lg:block">
                  <path d="M0 16 H32" stroke="#d3dcd9" strokeWidth="1.5" />
                  {reached(i + 1) && <path d="M0 16 H32" stroke={i + 1 === breakIdx && showBreak ? "#e8962e" : "#0b6e69"} strokeWidth="1.5" strokeDasharray={reduce ? undefined : "5 9"} className={reduce ? "" : "animate-[wire-flow_1.4s_linear_infinite]"} />}
                </svg>
                <svg width="32" height="28" viewBox="0 0 32 28" className="lg:hidden">
                  <path d="M16 0 V28" stroke="#d3dcd9" strokeWidth="1.5" />
                  {reached(i + 1) && <path d="M16 0 V28" stroke={i + 1 === breakIdx && showBreak ? "#e8962e" : "#0b6e69"} strokeWidth="1.5" strokeDasharray={reduce ? undefined : "5 9"} className={reduce ? "" : "animate-[wire-flow_1.4s_linear_infinite]"} />}
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* the Slack alert that follows */}
      <motion.div className="mt-6 max-w-2xl" initial={false} animate={{ opacity: showBreak ? 1 : 0.35, y: showBreak || reduce ? 0 : 6 }} transition={{ duration: 0.4 }}>
        <Card className="flex items-start gap-3 p-4">
          <BrandIcon k="slack" size={20} />
          <div className="min-w-0 text-[14px] leading-relaxed text-dx-ink">
            <p className="font-semibold">
              Dexraflow <span className="font-normal text-dx-ink-muted">→ #revops · today 09:00</span>
            </p>
            <p className="mt-1">
              Routing stopped assigning demo requests from the pricing page at 14:02 on Tuesday. <span className="font-semibold">37 leads have no owner</span>, about <span className="font-semibold">$46k</span> in pipeline.
            </p>
            <p className="mt-2 font-medium text-dx-brand">View the 37 leads →</p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

/* ───────────────────────── 4 · form-fill mini visual ───────────────────────── */

const FormFillBars = () => {
  const reduce = !!useReducedMotion();
  return (
    <div className="rounded-[8px] border border-dx-line bg-dx-surface p-4" role="img" aria-label="Pricing page: 212 submissions, 175 leads created, 37 missing.">
      <p className={`${MONO} text-dx-ink-muted`}>Pricing page · today</p>
      <dl className="mt-3 space-y-2.5">
        {[
          { k: "Submissions", v: 212, w: 100, tone: "bg-dx-brand" },
          { k: "Leads created", v: 175, w: 83, tone: "bg-dx-brand/50" },
        ].map((r, i) => (
          <div key={r.k}>
            <div className="flex justify-between font-dx-mono text-[12px]">
              <dt className="text-dx-ink-muted">{r.k}</dt>
              <dd className="tabular-nums text-dx-ink">
                <CountUp to={r.v} duration={1.2} />
              </dd>
            </div>
            <div className="mt-1 h-2 rounded-[2px] bg-dx-sunken">
              <motion.div className={`h-2 rounded-[2px] ${r.tone}`} initial={reduce ? false : { width: 0 }} whileInView={{ width: `${r.w}%` }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 1.2, delay: i * 0.15, ease: EASE }} />
            </div>
          </div>
        ))}
      </dl>
      <motion.p initial={reduce ? false : { opacity: 0, y: 4 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 1.3 }} className={`mt-3 inline-flex items-center gap-1.5 rounded-[4px] border border-dx-signal/40 bg-dx-signal-soft px-2 py-0.5 ${MONO} text-dx-signal-ink`}>
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-dx-signal" />
        37 never became leads
      </motion.p>
    </div>
  );
};

/* ───────────────────────── 7 · vision timeline ───────────────────────── */

const VisionTimeline = () => {
  const reduce = !!useReducedMotion();
  return (
    <div className="relative mt-10">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 hidden h-px bg-dx-line lg:block">
        <motion.div className="h-px origin-left bg-dx-brand" initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1.8, ease: EASE }} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {VISION.map((v, i) => (
          <Reveal key={v.k} delay={i * 0.12}>
            <div className="relative border-t border-dx-line pt-5 lg:border-t-0">
              <motion.span aria-hidden="true" className={`absolute -top-[3.5px] left-0 hidden h-[7px] w-[7px] rounded-full lg:block ${i === 0 ? "bg-dx-brand" : "bg-dx-line-strong"}`} initial={reduce ? false : { scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.4, delay: 0.5 + i * 0.6, ease: EASE }} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`${MONO} ${i === 0 ? "text-dx-brand" : "text-dx-ink-muted"}`}>{v.k}</p>
                  <h3 className="mt-2 text-[17px] font-semibold text-dx-ink">{v.t}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-dx-ink-muted">{v.d}</p>
                </div>
                <v.Icon size={64} />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────── 8 · MCP explainer ───────────────────────── */

/** The four steps beside the gate scene. The scene reports which step it is on; under reduced motion all four read as one. */
const McpExplainer = () => {
  const [phase, setPhase] = useState(-1);
  const onPhase = useCallback((p: number) => setPhase(p), []);
  const live = phase >= 0;
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
      <ol className="space-y-1">
        {MCP_STEPS.map((s, i) => {
          const on = !live || phase === i;
          return (
            <li key={s.k} className="relative rounded-[8px] px-4 py-3.5 transition-colors duration-300" style={{ background: live && phase === i ? "rgba(11,110,105,0.06)" : "transparent" }}>
              <motion.span aria-hidden="true" className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-dx-brand" initial={false} animate={{ opacity: live && phase === i ? 1 : 0, scaleY: live && phase === i ? 1 : 0.4 }} transition={{ duration: 0.3 }} />
              <div className="flex items-baseline gap-3">
                <span className={`${MONO} ${on ? "text-dx-brand" : "text-dx-ink-muted"}`}>{s.k}</span>
                <h3 className={`text-[17px] font-semibold transition-colors ${on ? "text-dx-ink" : "text-dx-ink-muted"}`}>{s.t}</h3>
              </div>
              <p className={`mt-1 text-[14px] leading-relaxed transition-colors ${on ? "text-dx-ink-muted" : "text-dx-ink-muted/70"}`}>{s.d}</p>
            </li>
          );
        })}
      </ol>
      <McpGateIso onPhase={onPhase} />
    </div>
  );
};

/* ───────────────────────── footer ───────────────────────── */

const Footer = () => (
  <footer className="border-t border-dx-line bg-dx-raised px-5 pb-10 pt-14 sm:px-8">
    <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
      <div>
        <Wordmark />
        <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-dx-ink-muted">{ONE_LINER}</p>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3 text-[13px] text-dx-ink-muted">
        <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-dx-ink">
          {CONTACT_EMAIL}
        </a>
        <Link to="/privacy-policy" className="transition hover:text-dx-ink">
          Privacy
        </Link>
        <Link to="/terms-conditions" className="transition hover:text-dx-ink">
          Terms
        </Link>
        <Link to="/data-deletion" className="transition hover:text-dx-ink">
          Data deletion
        </Link>
      </nav>
    </div>
    <p className="mx-auto mt-10 max-w-6xl text-[12px] leading-relaxed text-dx-ink-muted">
      Stories are shared by RevOps practitioners and anonymised. Scenes and numbers on this page are illustrative. Product names identify tools we connect to; trademarks belong to their owners.
    </p>
    <div className="mx-auto mt-4 max-w-6xl text-[12px] text-dx-ink-muted">© {new Date().getFullYear()} Dexraflow Inc.</div>
  </footer>
);

/* ───────────────────────── page ───────────────────────── */

const Landing = () => {
  const [intent, setIntent] = useState<AccessIntent | null>(null);
  const reduce = !!useReducedMotion();
  const openAudit = () => setIntent("audit");
  const openFounder = () => setIntent("founder-conversation");
  const openEarlyAccess = () => setIntent("early-access");
  const { tab, setTab, connectRef, goConnect } = useConnectTabs();

  useEffect(() => {
    const prev = document.title;
    document.title = "Dexraflow — Catch workflows that silently break";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-dx-surface font-dx-sans text-dx-ink antialiased [overflow-x:clip] selection:bg-dx-brand-soft">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[8px] focus:bg-dx-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white">
        Skip to content
      </a>
      <Nav onAudit={openAudit} />
      <main id="main">
        <Hero onAudit={openAudit} />

        {/* 2 · the problem */}
        <Section id="problem">
          <Reveal>
            <Head id="problem-title" label="The problem" title="The worst breaks don't throw an error." />
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {STORIES.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08} className="h-full min-w-0">
                <TiltCard className="group h-full rounded-[8px]">
                  <Card className="h-full p-6 transition-shadow duration-300 group-hover:shadow-dx-overlay">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-dx-mono text-[28px] font-medium leading-none tracking-[-0.02em] text-dx-signal-ink">
                          <CountUp to={s.n} duration={1.2} /> {s.unit}
                        </p>
                        <p className={`mt-1 ${MONO} text-dx-ink-muted`}>before anyone noticed</p>
                      </div>
                      <s.Icon size={64} />
                    </div>
                    <ElapsedBar days={s.days} label={`${s.days} days passed before anyone noticed.`} />
                    <h3 className="mt-5 text-[18px] font-semibold leading-snug text-dx-ink">{s.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-dx-ink-muted">{s.body}</p>
                  </Card>
                </TiltCard>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-4">
            <p className="text-[12px] text-dx-ink-muted">Real stories shared by RevOps practitioners, anonymised.</p>
            <p className="mt-8 max-w-2xl text-[20px] font-medium leading-snug text-dx-ink sm:text-[24px]">
              Every tool alerts you when something breaks. <span className="text-dx-brand">Dexraflow catches what should have happened and didn't.</span>
            </p>
          </Reveal>
        </Section>

        {/* 3 · how it works */}
        <Section id="how">
          <Reveal>
            <Head id="how-title" label="How it works" title="One daily check across every handoff." sub="Dexraflow compares what each tool received with what the next one should have, every day, and tells you the moment they stop matching." />
          </Reveal>
          <Reveal className="mt-12">
            <HandoffFlow />
          </Reveal>
          <Reveal className="mt-8">
            <div className="flex max-w-2xl items-center gap-5">
              <IsoTestLead size={88} />
              <p className="text-[15px] leading-relaxed text-dx-ink-muted">
                <span className="font-medium text-dx-ink">Plus a daily test lead</span> runs through your real form, CRM, routing and sequence, so a break shows up even on a quiet day.
              </p>
            </div>
          </Reveal>
        </Section>

        {/* 4 · what it catches */}
        <Section id="catches">
          <Reveal>
            <Head id="catches-title" label="What it catches" title="Four ways a lead disappears." />
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {CATCHES.map((c, i) => (
              <Reveal key={c.n} delay={i * 0.05} className="h-full min-w-0">
                <TiltCard className="group h-full rounded-[8px]" max={2.5}>
                  <Card className="flex h-full flex-col p-5 transition-shadow duration-300 group-hover:shadow-dx-overlay">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className={`${MONO} text-dx-brand`}>{c.n}</span>
                        <h3 className="mt-2 text-[18px] font-semibold text-dx-ink">{c.title}</h3>
                        <p className="mt-2 text-[14px] leading-relaxed text-dx-ink-muted">{c.body}</p>
                      </div>
                      <motion.div className="shrink-0" initial={reduce ? false : { opacity: 0, y: 8, scale: 0.9 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.7, delay: 0.2 + i * 0.05, ease: EASE }}>
                        <c.Icon size={72} />
                      </motion.div>
                    </div>
                    <div className="mt-5 flex flex-1 flex-col justify-center">{c.Scene ? <c.Scene /> : <FormFillBars />}</div>
                  </Card>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* 5 · why not build it */}
        <Section id="why" tight>
          <Reveal>
            <Card className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:gap-12 lg:items-center">
              <Label>Why not just build it?</Label>
              <div className="max-w-2xl space-y-4 text-[17px] leading-relaxed text-dx-ink">
                <p>A script covers one pipe. Dexraflow checks every handoff, every day, across every tool, puts a dollar figure on what was lost, and nobody has to maintain it.</p>
                <p className="text-dx-ink-muted">We watch the automations you build. We don't replace them.</p>
              </div>
              <div className="hidden lg:block">
                <IsoCoverage size={120} />
              </div>
            </Card>
          </Reveal>
        </Section>

        {/* 6 · the offer */}
        <Section id="offer">
          <Reveal>
            <Head id="offer-title" label="The offer" title="Start with the audit. Keep the daily check." />
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <Reveal className="h-full">
              <BorderBeam className="h-full">
                <div className="flex h-full flex-col p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <Label>Missed Pipeline Audit</Label>
                    <IsoAudit size={72} />
                  </div>
                  <h3 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-dx-ink">14 days. Read-only exports. The last 90 days.</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-dx-ink-muted">You get the exact leads that slipped, what they were worth and why. Then we fix the top issues with you.</p>
                  <div className="mt-6 flex items-baseline gap-3">
                    <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-dx-ink">
                      $<CountUp to={1500} duration={1.4} />
                    </p>
                    <p className="text-[14px] text-dx-ink-muted">
                      founding price · <span className="line-through">$3,000</span>
                    </p>
                  </div>
                  <p className="mt-2 text-[13px] text-dx-ink-muted">Billed even if nothing is found.</p>
                  <div className="mt-auto pt-6">
                    <Button onClick={openAudit}>
                      Book a Missed Pipeline Audit <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </BorderBeam>
            </Reveal>
            <Reveal delay={0.06} className="h-full">
              <Card className="flex h-full flex-col p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Label>Daily monitoring</Label>
                  <span className={`inline-flex items-center gap-1.5 rounded-[4px] border border-dx-brand/20 bg-dx-brand-soft px-2 py-0.5 ${MONO} text-dx-brand`}>
                    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                      {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dx-brand opacity-60" />}
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-dx-brand" />
                    </span>
                    Now taking 3 design partners
                  </span>
                  </div>
                  <IsoDailyCheck size={72} />
                </div>
                <h3 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-dx-ink">After the audit, Dexraflow keeps checking every day.</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-dx-ink-muted">You get an alert in Slack the same day something stops, with the leads affected and what they're worth. The audit fee is credited.</p>
                <div className="mt-auto pt-6">
                  <Button onClick={openFounder} tone="ghost">
                    Talk to the founder
                  </Button>
                </div>
              </Card>
            </Reveal>
          </div>
          <Reveal className="mt-4">
            <ul className="grid gap-3 rounded-[8px] border border-dx-line bg-dx-raised p-5 text-[14px] text-dx-ink sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map((t, i) => (
                <motion.li key={t} className="flex items-center gap-2" initial={reduce ? false : { opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, delay: 0.1 + i * 0.1, ease: EASE }}>
                  <Check className="h-4 w-4 shrink-0 text-dx-brand" strokeWidth={1.5} aria-hidden="true" />
                  {t}
                </motion.li>
              ))}
            </ul>
          </Reveal>
        </Section>

        {/* 7 · where we're going */}
        <Section id="vision" tight>
          <Reveal>
            <Head id="vision-title" label="Where we're going" title="Catch it. Then prevent it." />
          </Reveal>
          <VisionTimeline />
        </Section>

        {/* 8 · the MCP */}
        <Section id="mcp">
          <Reveal>
            <Head id="mcp-title" label="Dexraflow MCP · Early access" title="Let AI agents into your CRM, without the chaos." sub="Any agent asks Dexraflow before it acts. Dexraflow checks every tool, then answers allow, hold or wait, and logs the decision. It never sends anything itself." />
          </Reveal>
          <Reveal className="mt-12">
            <McpExplainer />
          </Reveal>
          <Reveal className="mt-12">
            <Card className="p-4 sm:p-6">
              <div className="mx-auto max-w-[880px]">
                <WithoutWith />
              </div>
            </Card>
          </Reveal>
          <Reveal className="mt-12">
            <Label>Four tools, one question: is this safe to do right now?</Label>
            <div className="mt-4">
              <ToolsGrid />
            </div>
          </Reveal>
          <div ref={connectRef} className="mt-14 scroll-mt-28">
            <Reveal>
              <Label>Connect your agent</Label>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-dx-ink-muted">Pick your agent. Every snippet is a preview; the API may change before launch.</p>
              <div className="mt-5">
                <ConnectBlock tab={tab} setTab={setTab} />
              </div>
            </Reveal>
          </div>
          <Reveal className="mt-10">
            <LogoStrip onPick={goConnect} />
          </Reveal>
          <Reveal className="mt-8">
            <Card className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
              <TrustStrip />
              <Button onClick={openEarlyAccess} tone="ghost" className="shrink-0">
                Get early access <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            </Card>
          </Reveal>
        </Section>

        {/* 9 · final CTA */}
        <Section id="start">
          <Reveal>
            <div className="relative overflow-hidden rounded-[8px] border border-dx-night-line bg-dx-night p-8 text-dx-night-ink sm:p-12">
              <NightGrid />
              <div aria-hidden="true" className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 lg:block xl:right-12">
                <IsoNightStack size={300} />
              </div>
              <div className="relative lg:max-w-[60%]">
                <h2 id="start-title" className="max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">
                  Find out what your stack dropped last quarter.
                </h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-dx-night-ink-muted">14 days, read-only. You get the exact leads, what they were worth and why.</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button onClick={openAudit} tone="light">
                    Book a Missed Pipeline Audit <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </Section>
      </main>
      <Footer />
      <AccessRequestModal intent={intent} onOpenChange={(open) => !open && setIntent(null)} />
    </div>
  );
};

export default Landing;
