import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ClipboardList, Eye, MailX, Plug, Scale } from "lucide-react";
import AccessRequestModal from "@/components/stealth/AccessRequestModal";
import { BrandIcon, MissedSignalScene, NoOwnerScene, SilentFailureScene, useStage } from "@/components/landing/UseCaseAnimations";
import { WithoutWith } from "@/components/landing/McpAnimations";
import HeroCircuit from "@/components/landing/HeroCircuit";
import { ConnectBlock, useConnectTabs, type TabId } from "@/components/landing/McpSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EASE, FOCUS, Reveal } from "@/components/landing/primitives";
import { CONTACT_EMAIL } from "@/components/stealth/contact";
import type { AccessIntent } from "@/services/earlyAccessAPI";

/* The landing page: a dark hero with one highlighted phrase, then one idea per section,
   each centered with a teal keyword, mono-uppercase labels and buttons, and a flat card grid. */

/* ───────────────────────── sources ───────────────────────── */

const SOURCES = [
  { id: 1, label: "Traction Complete, 2025 CRO Survey", href: "https://tractioncomplete.com/guide/cro-survey-nrr-retention-expansion/" },
  { id: 2, label: "Validity, The State of CRM Data Management in 2025", href: "https://validity.com/resource-center/the-state-of-crm-data-management-in-2025" },
  { id: 3, label: "Salesforce, State of Sales report (2022)", href: "https://www.salesforce.com/news/stories/sales-research-2023/" },
  { id: 4, label: "Harvard Business Review, The Short Life of Online Sales Leads (2011), audit of 2,241 US companies", href: "https://hbr.org/2011/03/the-short-life-of-online-sales-leads" },
  {
    id: 5,
    label: "Gartner, AI agents will outnumber sellers 10 to 1 by 2028 (press release, July 2026)",
    href: "https://www.gartner.com/en/newsroom/press-releases/2026-07-28-gartner-predicts-ai-agents-will-outnumber-sellers-10-to-1-by-2028-yet-fewer-than-40-percent-of-sellers-will-say-agents-improved-productivity",
  },
] as const;
type SourceId = (typeof SOURCES)[number]["id"];

const Cite = ({ n, dark = false }: { n: SourceId; dark?: boolean }) => (
  <a href="#sources" aria-label={`Source ${n}`} className={`ml-0.5 align-super text-[10px] font-medium transition ${dark ? "text-dx-night-ink-muted hover:text-dx-night-ink" : "text-dx-ink-muted hover:text-dx-ink"}`}>
    [{n}]
  </a>
);

/* ───────────────────────── content ───────────────────────── */

const STACK = [
  { name: "HubSpot", k: "hubspot" },
  { name: "Salesforce", k: "salesforce" },
  { name: "Clay", k: "clay" },
  { name: "Apollo", k: "apollo" },
  { name: "Outreach", k: "outreach" },
  { name: "Gong", k: "gong" },
  { name: "Slack", k: "slack" },
];

/** Everything on the stack strip; the diagram keeps the core `STACK` above. */
const TOOLS_ALL = [
  ...STACK,
  { name: "Salesloft", k: "salesloft" },
  { name: "ZoomInfo", k: "zoominfo" },
  { name: "Attio", k: "attio" },
  { name: "Intercom", k: "intercom" },
  { name: "Zendesk", k: "zendesk" },
  { name: "Calendly", k: "calendly" },
  { name: "Google Calendar", k: "googlecalendar" },
  { name: "Zoom", k: "zoom" },
  { name: "Gmail", k: "gmail" },
  { name: "LinkedIn", k: "linkedin" },
  { name: "Zapier", k: "zapier" },
  { name: "n8n", k: "n8n" },
];

const SPEED: { value: string; text: string; cite: SourceId }[] = [
  { value: "42 hrs", text: "average time for a company to first respond to an inbound lead", cite: 4 },
  { value: "7×", text: "more likely to qualify a lead when you reach out within the hour", cite: 4 },
  { value: "23%", text: "of companies never responded to the lead at all", cite: 4 },
];
const MORE_STATS: { value: string; text: string; cite: SourceId }[] = [
  { value: "80%", text: "of RevOps leaders don't feel they have clean, actionable data.", cite: 1 },
  { value: "37%", text: "of CRM users lost revenue as a direct result of poor data quality.", cite: 2 },
  { value: "10", text: "tools used, on average, to close a deal.", cite: 3 },
  { value: "10:1", text: "AI agents to sellers by 2028, Gartner predicts.", cite: 5 },
  { value: "<40%", text: "of sellers will say those agents improved productivity.", cite: 5 },
];

const FAILURES = [
  { tag: "No owner", title: "A hot lead nobody owns", body: "Routing waits on a field that never filled. The lead sits with no owner, no task, no follow-up.", Scene: NoOwnerScene },
  { tag: "Silent failure", title: "A workflow that says “success”", body: "The run completes on schedule and the dashboard stays green. Rows written: zero.", Scene: SilentFailureScene },
  { tag: "Missed signal", title: "A buying signal nobody acted on", body: "Three pricing visits in a week. The owner is out of office. Five days pass with no touch.", Scene: MissedSignalScene },
];

const AGENTS: { id: TabId; name: string; k?: string; action: string }[] = [
  { id: "claude-code", name: "Claude Code", k: "claude", action: "Install" },
  { id: "claude-desktop", name: "Claude Desktop", k: "claude", action: "Add connector" },
  { id: "cursor", name: "Cursor", k: "cursor", action: "Install" },
  { id: "openai", name: "OpenAI Agents SDK", k: "openai", action: "Copy snippet" },
  { id: "langchain", name: "LangChain", k: "langchain", action: "Copy snippet" },
  { id: "n8n", name: "n8n", k: "n8n", action: "Add node" },
  { id: "any", name: "Make / Zapier", k: "make", action: "Use MCP URL" },
  { id: "any", name: "Any MCP client", action: "Copy MCP URL" },
];

const TRUST = [
  { I: Eye, t: "Read-only by default", d: "Connect with read access. Writes are opt-in and limited to 10 essential fields." },
  { I: MailX, t: "Never sends anything itself", d: "Dexraflow informs, allows, holds or logs. It never emails or contacts a prospect." },
  { I: Scale, t: "Neutral across vendors", d: "No tool to replace and nothing to migrate. Every vendor gets the same treatment." },
  { I: ClipboardList, t: "Every change logged", d: "Each alert, hold and write is recorded with the reason, so you can see what happened." },
];

const FAQ = [
  { q: "Do I have to replace any of my tools?", a: "No. Dexraflow connects to the CRM and GTM tools you already use, read-only by default, and catches what slips between them. Nothing is migrated." },
  { q: "Does Dexraflow email or contact my prospects?", a: "Never. It tells the right rep in Slack, with the reason and a deadline. People act; Dexraflow informs, allows, holds or logs." },
  { q: "What does the 14-day audit involve?", a: "You connect your tools read-only. We look back 90 days and show you the high-intent accounts nobody worked, leads routed to the wrong owner or no owner, and workflows that failed silently, with what each one was worth. If we don't find at least $10K of missed pipeline, you don't pay." },
  { q: "Which tools does it work with?", a: "CRMs like HubSpot, Salesforce and Attio; enrichment and data from Clay, Apollo and ZoomInfo; sequencing in Outreach and Salesloft; calls in Gong and Zoom; support in Intercom and Zendesk; plus Slack, Gmail, Google Calendar, Calendly, LinkedIn, Zapier and n8n. More on request. Product names identify the tools we connect to; trademarks belong to their owners." },
  { q: "What is the Dexraflow MCP?", a: "An early-access way for AI agents to ask Dexraflow before they act in your CRM. It checks every tool, applies your rules, then answers allow, hold or wait, and logs the decision. It works with any client that supports remote MCP." },
  { q: "Who is this for?", a: "Heads of RevOps at B2B SaaS companies running a CRM plus five or more GTM tools. We're working with a small group of early-access teams." },
];

/* ───────────────────────── primitives ───────────────────────── */

const MONO = "font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em]";

const MonoButton = ({ onClick, href, children, tone = "dark", className = "" }: { onClick?: () => void; href?: string; children: ReactNode; tone?: "dark" | "light" | "ghost" | "ghostDark"; className?: string }) => {
  const tones = {
    dark: "bg-dx-ink text-dx-night-ink hover:bg-black",
    light: "bg-white text-dx-ink hover:bg-dx-surface",
    ghost: "border border-dx-line-strong bg-transparent text-dx-ink hover:bg-dx-surface",
    ghostDark: "border border-dx-night-line bg-transparent text-dx-night-ink hover:bg-dx-night-raised",
  };
  const cls = `inline-flex h-11 items-center justify-center gap-2 rounded-[4px] px-5 ${MONO} transition ${tones[tone]} ${FOCUS} ${className}`;
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

const Label = ({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) => (
  <p className={`${MONO} ${dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"} ${className}`}>{children}</p>
);

/** Centered section header: label, big headline with one teal phrase, one-line subline, optional mono CTA. */
const Head = ({ id, label, lead, accent, tail, sub, cta, dark = false }: { id: string; label: string; lead: string; accent: string; tail?: string; sub?: ReactNode; cta?: ReactNode; dark?: boolean }) => (
  <div className="mx-auto max-w-3xl text-center">
    <Label dark={dark}>{label}</Label>
    <h2 id={id} className={`mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[44px] sm:leading-[50px] ${dark ? "text-dx-night-ink" : "text-dx-ink"}`}>
      {lead} <span className={dark ? "text-dx-brand-night" : "text-dx-brand"}>{accent}</span>
      {tail ? ` ${tail}` : ""}
    </h2>
    {sub && <p className={`mx-auto mt-4 max-w-2xl text-[17px] leading-relaxed ${dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}`}>{sub}</p>}
    {cta && <div className="mt-7 flex justify-center">{cta}</div>}
  </div>
);

const Card = ({ children, className = "", dark = false }: { children: ReactNode; className?: string; dark?: boolean }) => (
  <div className={`rounded-[8px] border ${dark ? "border-dx-night-line bg-dx-night-raised" : "border-dx-line bg-dx-raised"} ${className}`}>{children}</div>
);

/* ───────────────────────── chrome ───────────────────────── */

const Wordmark = ({ reversed = false, className = "h-6" }: { reversed?: boolean; className?: string }) => (
  <img src={reversed ? "/brand/dexraflow-lockup-reversed.svg" : "/brand/dexraflow-lockup.svg"} alt="Dexraflow" width={137} height={28} className={`w-auto ${className}`} />
);

const NAV_LINKS = [
  { href: "#slips", label: "Problem" },
  { href: "#catch", label: "How it works" },
  { href: "#mcp", label: "MCP" },
  { href: "#audit", label: "Audit" },
  { href: "#faq", label: "FAQ" },
];

const Nav = ({ onAccess, onAudit, dark }: { onAccess: () => void; onAudit: () => void; dark: boolean }) => (
  <header className="fixed inset-x-0 top-0 z-50">
    <button type="button" onClick={onAudit} className={`group flex h-9 w-full items-center justify-center gap-2 bg-dx-brand px-5 text-white ${MONO}`}>
      <span className="rounded-[3px] bg-white/15 px-1.5 py-0.5 text-[10px]">Audit</span>
      <span className="truncate">
        <span className="sm:hidden">14-day Missed Pipeline Audit</span>
        <span className="hidden sm:inline">The 14-day Missed Pipeline Audit · find $10K of missed pipeline, or you don't pay</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
    </button>
    <div className={`border-b backdrop-blur-xl transition-colors duration-500 ${dark ? "border-dx-night-line bg-dx-night/85" : "border-dx-line bg-dx-surface/90"}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Primary">
        <div className="flex items-center gap-10">
          <Link to="/" aria-label="Dexraflow home" className={`rounded ${FOCUS}`}>
            <Wordmark reversed={dark} />
          </Link>
          <div className={`hidden items-center gap-7 lg:flex ${MONO} ${dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}`}>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className={`rounded transition ${dark ? "hover:text-dx-night-ink" : "hover:text-dx-ink"} ${FOCUS}`}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MonoButton onClick={onAudit} tone={dark ? "ghostDark" : "ghost"} className="hidden !h-9 sm:inline-flex">
            Get a demo
          </MonoButton>
          <MonoButton onClick={onAccess} tone={dark ? "light" : "dark"} className="!h-9">
            <span className="sm:hidden">Early access</span>
            <span className="hidden sm:inline">Get early access</span>
          </MonoButton>
        </div>
      </nav>
    </div>
  </header>
);

/* ───────────────────────── hero ───────────────────────── */

const PHRASES = ["drop silently", "route to nobody", "mark as success"];

const Hero = ({ onAccess, onAudit, heroRef }: { onAccess: () => void; onAudit: () => void; heroRef: React.RefObject<HTMLElement> }) => {
  const reduce = !!useReducedMotion();
  const [k, setK] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setK((n) => (n + 1) % PHRASES.length), 2600);
    return () => window.clearInterval(id);
  }, [reduce]);
  const enter = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.1 + i * 0.08, ease: EASE } });
  return (
    <section ref={heroRef} className="relative isolate overflow-hidden bg-dx-night px-5 pb-16 pt-40 text-dx-night-ink sm:px-8 md:pb-20 md:pt-48" aria-labelledby="hero-title">
      {/* workflow circuit behind the copy, masked so the headline stays clear */}
      <HeroCircuit className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-55 [mask-image:radial-gradient(ellipse_90%_60%_at_50%_45%,transparent_40%,black_85%)] sm:opacity-80 sm:[mask-image:radial-gradient(ellipse_55%_50%_at_50%_42%,transparent_22%,black_70%)]" />
      <div className="relative mx-auto max-w-5xl text-center">
        <motion.h1 id="hero-title" {...enter(0)} className="mx-auto text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[60px] sm:leading-[1.02] lg:text-[72px]">
          Catch the deals your GTM tools{" "}
          <span className="relative inline-grid overflow-hidden align-bottom">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={PHRASES[k]}
                className="col-start-1 row-start-1 whitespace-nowrap bg-dx-brand px-3 text-white"
                initial={reduce ? false : { y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? undefined : { y: "-100%", opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                {PHRASES[k]}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.h1>
        <motion.p {...enter(1)} className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-dx-night-ink-muted sm:text-[19px]">
          Dexraflow connects to the tools you already use, catches the leads and deals that slip between them, and tells the right rep in Slack before they go cold.
        </motion.p>
        <motion.div {...enter(2)} className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <MonoButton onClick={onAudit} tone="light">
            Book a 14-day audit
          </MonoButton>
          <MonoButton onClick={onAccess} tone="ghostDark">
            Get early access
          </MonoButton>
        </motion.div>
      </div>

      <motion.div {...enter(3)} className="relative mx-auto mt-20 max-w-6xl">
        <Label dark className="text-center">
          Works with your stack →
        </Label>
        <ToolStrip reduce={reduce} />
      </motion.div>
    </section>
  );
};

/** Path icons whose brand colour is too dark for the night background are drawn in ink. */
const DARK_MARKS = new Set(["zendesk", "notion"]);

const ToolItem = ({ t, hidden = false }: { t: { name: string; k: string }; hidden?: boolean }) => (
  <li aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[15px] font-semibold text-dx-night-ink">
    <BrandIcon k={t.k} size={22} color={DARK_MARKS.has(t.k) ? "#e6eeec" : undefined} />
    {t.name}
  </li>
);

/** Every tool, as a slow pausable marquee; a wrapping grid when motion is reduced. */
const ToolStrip = ({ reduce }: { reduce: boolean }) => {
  if (reduce)
    return (
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-9 gap-y-5">
        {TOOLS_ALL.map((t) => (
          <ToolItem key={t.name} t={t} />
        ))}
      </ul>
    );
  return (
    <div className="group relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]" aria-label="Tools Dexraflow works with">
      <ul className="flex w-max gap-x-10 pr-10 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]" style={{ animation: "mcp-marquee 70s linear infinite" }}>
        {TOOLS_ALL.map((t) => (
          <ToolItem key={t.name} t={t} />
        ))}
        {TOOLS_ALL.map((t) => (
          <ToolItem key={`${t.name}-dup`} t={t} hidden />
        ))}
      </ul>
    </div>
  );
};

/* ───────────────────────── stack diagram ───────────────────────── */

const ROWS = [
  { k: "Match", v: "One record per account" },
  { k: "Catch", v: "No owner · silent failure · missed signal" },
  { k: "Alert", v: "Slack, with a deadline" },
  { k: "Prove", v: "Weekly pipeline recovered" },
  { k: "Log", v: "Every change" },
];

const Connector = ({ on, reduce }: { on: boolean; reduce: boolean }) => {
  const flow = on && !reduce ? "animate-[wire-flow_1.4s_linear_infinite]" : "";
  const dash = on && !reduce ? "5 9" : undefined;
  return (
    <div className="flex justify-center lg:block" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 40 40" className="hidden lg:block">
        <path d="M0 20 H40" stroke="#d3dcd9" strokeWidth="1.5" />
        {on && <path d="M0 20 H40" stroke="#0b6e69" strokeWidth="1.5" strokeDasharray={dash} className={flow} />}
      </svg>
      <svg width="40" height="32" viewBox="0 0 40 32" className="lg:hidden">
        <path d="M20 0 V32" stroke="#d3dcd9" strokeWidth="1.5" />
        {on && <path d="M20 0 V32" stroke="#0b6e69" strokeWidth="1.5" strokeDasharray={dash} className={flow} />}
      </svg>
    </div>
  );
};

/** The signal path: your tools → Dexraflow → the rep. Rows light in sequence as one lead moves through. */
const StackDiagram = () => {
  const { ref, stage, reduce } = useStage(ROWS.length + 2, 1100);
  const lit = (i: number) => reduce || stage >= i;
  const tools = STACK.filter((t) => t.k !== "slack");
  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[1fr_auto_1.2fr_auto_1fr] lg:items-center" role="img" aria-label="A lead moves from your tools through Dexraflow, which matches, catches, alerts, proves and logs, to a rep in Slack.">
      <Card className="p-3">
        <Label className="px-2 pt-1">Your tools</Label>
        <ul className="mt-2 space-y-1">
          {tools.map((t, i) => (
            <motion.li key={t.name} className="flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-[14px] font-medium text-dx-ink" initial={false} animate={{ opacity: lit(0) ? 1 : 0.4, backgroundColor: stage === 0 && !reduce && i === 1 ? "#dcefec" : "rgba(0,0,0,0)" }}>
              <BrandIcon k={t.k} size={18} />
              {t.name}
            </motion.li>
          ))}
        </ul>
      </Card>
      <Connector on={lit(1)} reduce={reduce} />
      <Card className="relative p-3">
        <div className="flex items-center justify-between px-2 pt-1">
          <img src="/brand/dexraflow-lockup.svg" alt="Dexraflow" className="h-5 w-auto" />
          <span className="rounded-[4px] border border-dx-line px-1.5 py-0.5 font-dx-mono text-[11px] text-dx-ink-muted">read-only</span>
        </div>
        <ul className="mt-2 space-y-1">
          {ROWS.map((r, i) => (
            <motion.li key={r.k} className="flex items-center justify-between gap-3 rounded-[6px] border px-3 py-2" initial={false} animate={{ borderColor: stage === i + 1 && !reduce ? "#0b6e69" : "#d3dcd9", opacity: lit(i + 1) ? 1 : 0.4 }} transition={{ duration: 0.3 }}>
              <span className={`${MONO} text-dx-ink`}>{r.k}</span>
              <span className="truncate text-[13px] text-dx-ink-muted">{r.v}</span>
            </motion.li>
          ))}
        </ul>
      </Card>
      <Connector on={lit(ROWS.length + 1)} reduce={reduce} />
      <Card className="p-3">
        <Label className="px-2 pt-1">The rep</Label>
        <motion.div className="mt-2 flex items-start gap-2.5 rounded-[6px] border border-dx-line bg-dx-surface px-3 py-2.5" initial={false} animate={{ opacity: lit(ROWS.length + 1) ? 1 : 0.4 }}>
          <BrandIcon k="slack" size={18} />
          <div className="min-w-0 text-[13px] leading-snug text-dx-ink">
            <p className="font-semibold">
              Dexraflow <span className="font-normal text-dx-ink-muted">→ Sam</span>
            </p>
            <p className="mt-0.5">Acme Inc asked for pricing twice this week. Owner out of office. Reply by 3pm?</p>
          </div>
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-dx-brand" strokeWidth={1.5} aria-hidden="true" />
        </motion.div>
      </Card>
    </div>
  );
};

/* ───────────────────────── sections ───────────────────────── */

const Section = ({ id, children, dark = false, tight = false, wide = false }: { id?: string; children: ReactNode; dark?: boolean; tight?: boolean; wide?: boolean }) => (
  <section id={id} className={`scroll-mt-28 px-5 sm:px-8 ${tight ? "py-16 md:py-20" : "py-24 md:py-32"} ${dark ? "bg-dx-night text-dx-night-ink" : ""}`} aria-labelledby={id ? `${id}-title` : undefined}>
    <div className={`mx-auto ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-dx-line bg-dx-raised px-5 pb-10 pt-14 sm:px-8">
    <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
      <div>
        <Wordmark />
        <p className="mt-3 text-[13px] text-dx-ink-muted">Catch the deals your GTM tools silently dropped.</p>
      </div>
      <nav aria-label="Footer" className={`flex flex-wrap gap-x-7 gap-y-3 ${MONO} text-dx-ink-muted`}>
        <a href={`mailto:${CONTACT_EMAIL}`} className="normal-case tracking-normal transition hover:text-dx-ink">
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
    <div id="sources" className="mx-auto mt-12 max-w-6xl scroll-mt-24 border-t border-dx-line pt-8">
      <Label>Sources</Label>
      <ol className="mt-3 space-y-1.5 text-[13px] text-dx-ink-muted">
        {SOURCES.map((s) => (
          <li key={s.id}>
            [{s.id}]{" "}
            <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline decoration-dx-line-strong underline-offset-2 hover:text-dx-ink">
              {s.label}
            </a>
          </li>
        ))}
      </ol>
      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-dx-ink-muted">
        Scenes are illustrative, built from failures RevOps teams have described to us. Product names identify tools we connect to; trademarks belong to their owners.
      </p>
    </div>
    <div className="mx-auto mt-10 max-w-6xl text-[12px] text-dx-ink-muted">© {new Date().getFullYear()} Dexraflow Inc.</div>
  </footer>
);

/* ───────────────────────── page ───────────────────────── */

const Landing = () => {
  const [intent, setIntent] = useState<AccessIntent | null>(null);
  const openAccess = () => setIntent("early-access");
  const openFounder = () => setIntent("founder-conversation");
  const { tab, setTab, connectRef, goConnect } = useConnectTabs();
  const heroRef = useRef<HTMLElement>(null);
  const heroInView = useInView(heroRef, { amount: 0.15 });
  const { ref: speedRef, stage: speedStage } = useStage(3, 1600);

  useEffect(() => {
    const prev = document.title;
    document.title = "Dexraflow — Catch the deals your GTM tools silently dropped";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-dx-surface font-dx-sans text-dx-ink antialiased [overflow-x:clip] selection:bg-dx-brand-soft">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[4px] focus:bg-dx-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white">
        Skip to content
      </a>
      <Nav onAccess={openAccess} onAudit={openFounder} dark={heroInView} />
      <main id="main">
        <Hero onAccess={openAccess} onAudit={openFounder} heroRef={heroRef} />

        {/* 1 · what it does */}
        <Section id="what">
          <Reveal>
            <Head id="what-title" label="What Dexraflow does" lead="Every tool says success." accent="Your pipeline says otherwise." sub="Your CRM, enrichment, intent and outreach tools each keep their own version of the customer. Dexraflow reads all of them, catches what falls in between, and tells a rep." cta={<MonoButton href="#slips" tone="ghost">See where leads slip →</MonoButton>} />
          </Reveal>
          <Reveal className="mt-14">
            <StackDiagram />
          </Reveal>
        </Section>

        {/* 2 · three failures */}
        <Section id="slips" wide>
          <Reveal>
            <Head id="slips-title" label="Where leads slip" lead="Three failures every stack has." accent="They never throw an error." />
          </Reveal>
          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {FAILURES.map((f, i) => (
              <Reveal key={f.tag} delay={i * 0.06}>
                <Card className="h-full p-5">
                  <span className={`inline-block rounded-[4px] border border-dx-brand/20 bg-dx-brand-soft px-2 py-0.5 ${MONO} text-dx-brand`}>{f.tag}</span>
                  <div className="mt-4">
                    <f.Scene />
                  </div>
                  <h3 className="mt-5 text-[18px] font-semibold text-dx-ink">{f.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-dx-ink-muted">{f.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* 3 · the cost */}
        <Section id="cost" dark>
          <Reveal>
            <Head id="cost-title" label="The cost" lead="Every hour a lead waits," accent="the deal gets colder." dark />
          </Reveal>
          <div ref={speedRef} className="mt-14 grid gap-4 sm:grid-cols-3">
            {SPEED.map((s, i) => (
              <Reveal key={s.value} delay={i * 0.06}>
                <motion.div className="h-full rounded-[8px] border bg-dx-night-raised p-6" initial={false} animate={{ borderColor: speedStage === i ? "#3bbfaf" : "#24333a" }} transition={{ duration: 0.3 }}>
                  <p className="text-[52px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-dx-night-ink">{s.value}</p>
                  <p className="mt-4 text-[14px] leading-relaxed text-dx-night-ink-muted">
                    {s.text}
                    <Cite n={s.cite} dark />
                  </p>
                </motion.div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-4">
            <dl className="grid gap-x-8 gap-y-5 rounded-[8px] border border-dx-night-line p-6 sm:grid-cols-3 lg:grid-cols-5">
              {MORE_STATS.map((s) => (
                <div key={s.value}>
                  <dt className="text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-dx-night-ink">{s.value}</dt>
                  <dd className="mt-1.5 text-[12px] leading-snug text-dx-night-ink-muted">
                    {s.text}
                    <Cite n={s.cite} dark />
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </Section>

        {/* 4 · how it works */}
        <Section id="catch">
          <Reveal>
            <Head id="catch-title" label="How it works" lead="Connect your tools." accent="We catch what slips." sub="No new tool to learn and nothing to replace. Read-only by default, and alerts arrive where your team already works: Slack." cta={<MonoButton onClick={openFounder}>Book an audit →</MonoButton>} />
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "01", t: "Connect", d: "Read-only access to your CRM and GTM tools. Setup takes minutes, not a project." },
              { n: "02", t: "Match", d: "One record per account and contact across every tool, so signals and owners line up." },
              { n: "03", t: "Catch", d: "Leads with no owner, workflows that say success but wrote nothing, and buying signals nobody acted on." },
              { n: "04", t: "Alert & prove", d: "The right rep gets it in Slack with the reason and a deadline. You get a weekly report of pipeline recovered." },
            ].map((s, i) => (
              <Reveal key={s.t} delay={i * 0.05}>
                <Card className="h-full p-5">
                  <span className={`${MONO} text-dx-brand`}>{s.n}</span>
                  <h3 className="mt-3 text-[18px] font-semibold text-dx-ink">{s.t}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-dx-ink-muted">{s.d}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* 5 · MCP: works with any agent */}
        <Section id="mcp" dark>
          <Reveal>
            <Head id="mcp-title" label="Dexraflow MCP · Early access" lead="Let AI agents into your CRM," accent="without the chaos." sub="Any agent asks Dexraflow before it acts. Dexraflow checks every tool, then says go, hold, or stop. It never sends anything itself." dark />
          </Reveal>
          <Reveal className="mt-14">
            <Card className="p-4 sm:p-6">
              <div className="mx-auto max-w-[880px]">
                <WithoutWith />
              </div>
            </Card>
          </Reveal>

          <Reveal className="mt-20">
            <Head id="agents-title" label="Works with any agent" lead="Connect yours" accent="in a minute." sub="Pick your agent. Every snippet is a preview; the API may change before launch." dark />
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AGENTS.map((a, i) => (
              <Reveal key={a.name} delay={i * 0.04}>
                <Card dark className="flex h-full flex-col gap-4 p-4">
                  <div className="flex items-center gap-2.5 text-[15px] font-semibold text-dx-night-ink">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-white">
                      {a.k ? <BrandIcon k={a.k} size={18} /> : <Plug className="h-[18px] w-[18px] text-dx-ink" strokeWidth={1.5} aria-hidden="true" />}
                    </span>
                    {a.name}
                  </div>
                  <button type="button" onClick={() => goConnect(a.id)} className={`mt-auto inline-flex h-9 items-center justify-center rounded-[4px] bg-white px-3 ${MONO} text-dx-ink transition hover:bg-dx-surface ${FOCUS} focus-visible:ring-offset-dx-night`}>
                    {a.action}
                  </button>
                </Card>
              </Reveal>
            ))}
          </div>
          <div ref={connectRef} className="mt-6 scroll-mt-28">
            <Reveal>
              <Card dark className="p-4 sm:p-6">
                <ConnectBlock tab={tab} setTab={setTab} />
              </Card>
            </Reveal>
          </div>
          <p className="mt-4 text-center text-[12px] text-dx-night-ink-muted">Product names identify tools we connect to; trademarks belong to their owners.</p>
        </Section>

        {/* 6 · trust */}
        <Section id="trust">
          <Reveal>
            <Head id="trust-title" label="Safe by default" lead="Your tools, your rules." accent="Dexraflow stays in its lane." />
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ I, t, d }, i) => (
              <Reveal key={t} delay={i * 0.05}>
                <Card className="h-full p-5">
                  <I className="h-6 w-6 text-dx-brand" strokeWidth={1.5} aria-hidden="true" />
                  <h3 className="mt-4 text-[17px] font-semibold text-dx-ink">{t}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-dx-ink-muted">{d}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* 7 · audit */}
        <Section id="audit" tight>
          <Reveal>
            <div className="grid gap-4 lg:grid-cols-12">
              <Card dark className="p-8 sm:p-10 lg:col-span-7">
                <Label dark>The 14-day Missed Pipeline Audit</Label>
                <h2 id="audit-title" className="mt-4 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-dx-night-ink sm:text-[34px]">
                  Find $10K of missed pipeline, <span className="text-dx-brand-night">or you don't pay.</span>
                </h2>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-dx-night-ink-muted">Connect your tools read-only. We look back 90 days and show you the high-intent accounts nobody worked, leads routed to the wrong owner or no owner, and workflows that failed silently, with what each one was worth.</p>
                <div className="mt-7">
                  <MonoButton onClick={openFounder} tone="light">
                    Book my audit →
                  </MonoButton>
                </div>
              </Card>
              <Card className="flex flex-col p-8 lg:col-span-5">
                <Label>Built from conversations</Label>
                <h3 className="mt-4 text-[22px] font-semibold leading-snug tracking-[-0.02em] text-dx-ink">Tell us what slipped, and we'll show you where else it's happening.</h3>
                <p className="mt-3 text-[14px] leading-relaxed text-dx-ink-muted">We're working with a small group of B2B SaaS revenue teams running five or more GTM tools.</p>
                <div className="mt-auto pt-6">
                  <MonoButton onClick={openFounder} tone="ghost">
                    Talk to the founder
                  </MonoButton>
                </div>
              </Card>
            </div>
          </Reveal>
        </Section>

        {/* 8 · FAQ */}
        <Section id="faq">
          <Reveal>
            <Head id="faq-title" label="FAQ" lead="Frequently asked" accent="questions." />
          </Reveal>
          <Reveal className="mx-auto mt-12 max-w-3xl">
            <Accordion type="single" collapsible className="rounded-[8px] border border-dx-line bg-dx-raised px-5">
              {FAQ.map((f, i) => (
                <AccordionItem key={f.q} value={`q${i}`} className="border-dx-line">
                  <AccordionTrigger className="py-4 text-left text-[16px] font-semibold text-dx-ink hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="pb-5 text-[15px] leading-relaxed text-dx-ink-muted">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </Section>

        {/* 9 · closing */}
        <Section dark>
          <Reveal>
            <Head id="closing-title" label="Start here" lead="Seen a deal slip" accent="through your stack?" sub="Free to start the conversation. Early access for a small group of revenue teams." dark />
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <MonoButton onClick={openAccess} tone="light">
                Get early access
              </MonoButton>
              <MonoButton onClick={openFounder} tone="ghostDark">
                Book a 14-day audit
              </MonoButton>
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
