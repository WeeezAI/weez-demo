import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { BrandIcon, MissedSignalScene, NoOwnerScene, SilentFailureScene, useStage } from "@/components/landing/UseCaseAnimations";
import { EASE, FOCUS, Reveal } from "@/components/landing/primitives";
import HeroStory from "@/components/landing/v1/HeroStory";
import McpGateIso from "@/components/landing/v1/McpGateIso";
import { WithoutWith } from "@/components/landing/McpAnimations";
import { IsoAgents, IsoAudit, IsoBrokenZap, IsoDailyCheck, IsoFormDrop, IsoHotLead, IsoNightStack, IsoNoOwner, IsoRadar, IsoShield, IsoStopped } from "@/components/landing/v1/IsoIcons";
import { BorderBeam, CountUp, HeroBackdrop, NightGrid, ScrollProgress, TiltCard, WordReveal } from "@/components/landing/v1/motion";
import { CONTACT_EMAIL } from "@/components/stealth/contact";

/* The landing page. One claim: every tool in the lead path reports success for its own step, and
   none of them knows the lead arrived. Dexraflow checks that it did, every day, read-only.
   Calm, light, lots of whitespace. Amber appears only where something broke. */

const ONE_LINER = "Dexraflow checks that every inbound lead actually reached a rep, across your forms, CRM and outreach tools, and alerts you the same day with the fix.";
const HERO_SUB = "Dexraflow matches every form fill, chat and signup to your CRM, every day, and tells you the same day which leads never reached a rep, what they were worth, and how to fix it.";
const BOOK_CALL = "https://calendar.app.google/Jm892hC4kmMXafec6";
const WRITE_UP = "/blog/how-leads-go-missing-without-an-error";

/* ───────────────────────── content ───────────────────────── */

/* Sentences a practitioner would say. Not attributed quotes. */
const SAID = [
  { q: "We found out from the prospect, three weeks later.", Icon: IsoHotLead },
  { q: "The Zap ran successfully and enrolled nobody.", Icon: IsoBrokenZap },
  { q: "Assigned is not the same as routed.", Icon: IsoNoOwner },
];

const HANDOFFS = [
  { name: "Forms", today: 212, yesterday: 208 },
  { name: "CRM", today: 212, yesterday: 208 },
  { name: "Routing", today: 175, yesterday: 208, missing: 37 },
  { name: "Sequencing", today: 175, yesterday: 208 },
];

const CHECKS = [
  { n: "01", title: "Form fills that never became contacts", body: "Matched by email, per source, across the form tool and the CRM.", Scene: null, Icon: IsoFormDrop },
  { n: "02", title: "Leads with no owner", body: "New contacts still unassigned after the grace period you set.", Scene: NoOwnerScene, Icon: IsoNoOwner },
  { n: "03", title: "Hot leads with no follow-up", body: "Your own definition of hot, with no task, email or call logged.", Scene: MissedSignalScene, Icon: IsoHotLead },
  { n: "04", title: "Workflows that stopped", body: "Volume compared with the same weekday over the trailing weeks, plus a daily test lead through the live path.", Scene: SilentFailureScene, Icon: IsoStopped },
];

const STEPS = [
  { k: "01", t: "Connect, read-only.", d: "HubSpot today. Salesforce next. Your form tool and outreach tool by export or API." },
  { k: "02", t: "We match and count, daily.", d: "Submissions against contacts, contacts against owners, owners against first touch." },
  { k: "03", t: "You get a Slack message, same day.", d: "With the lost leads, their value and the fix. Nothing is written to your CRM." },
];

const TRUST = ["Read-only access", "NDA before any data moves", "Your data never goes into AI models", "Raw exports deleted within 7 days"];

const ROADMAP = [
  { k: "Now", chip: "Available today", live: true, t: "Find and recommend.", d: "Read-only checks, same-day alerts, the fix in every alert.", Icon: IsoRadar },
  { k: "Next", chip: "In design", t: "Fix on approval.", d: "The alert carries an Approve button. Tap it and Dexraflow applies the fix, logs it and can undo it. Starts with narrow, reversible actions: release a filtered submission, assign an unowned lead, re-enroll a dropped contact.", Icon: IsoShield },
  { k: "Later", chip: "Planned", t: "Dexraflow MCP.", d: "Your AI agents and automations call Dexraflow instead of holding CRM credentials. Each write passes one door that checks your rules, asks a human when you say so, logs it, and can roll it back. One policy for every agent, whoever built it.", Icon: IsoAgents },
];

/* How the planned MCP works, told beside the gate animation. */
const MCP_STEPS = [
  { k: "01", t: "The agent asks first", d: "Your agents and automations call Dexraflow instead of holding CRM credentials." },
  { k: "02", t: "Dexraflow checks your rules", d: "Each write passes one door, with one policy for every agent, whoever built it." },
  { k: "03", t: "It allows, holds or waits", d: "And it asks a human when you say so." },
  { k: "04", t: "Every write is logged", d: "So it can be rolled back." },
];

/* Kept word for word in step with the FAQPage schema in index.html. */
const FAQ = [
  { q: "What is lead leakage?", a: "Lead leakage is when a lead enters your GTM stack but never reaches a person who can follow up. A form fill that never became a CRM contact, a contact nobody was assigned to, or a demo request nobody replied to. The lead existed. It just leaked out between two tools." },
  { q: "What are GTM automation failures?", a: "GTM automation failures are breaks in the workflows that move leads between your tools: forms, CRM, routing, enrichment and sequencing. The worst ones are silent. A Zap keeps running with zero rows, a HubSpot workflow stops after a field changes, a webhook reports success before the CRM write happens. Nothing errors, so nobody looks." },
  { q: "How does Dexraflow catch lead leakage?", a: "Dexraflow matches every form fill, chat and signup to your CRM, every day. It runs four checks and tells you the same day which leads never reached a rep, what they were worth and how to fix it. It is read-only. Nothing in your CRM changes." },
  { q: "Which tools does Dexraflow connect to?", a: "HubSpot today. Salesforce next. Your form tool and outreach tool by export or API. Access is read-only." },
  { q: "What is a Missed-Pipeline Audit?", a: "A 14-day review of read-only exports covering the last 90 days, under a mutual NDA. You get the exact records that slipped, where they slipped and what they were worth, and we fix the top three causes with you. The founding price is $1,500, against a list price of $3,000." },
];

/* ───────────────────────── primitives ───────────────────────── */

const MONO = "font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em]";

const Button = ({ onClick, href, to, external = false, children, tone = "primary", className = "" }: { onClick?: () => void; href?: string; to?: string; external?: boolean; children: ReactNode; tone?: "primary" | "ghost" | "light" | "night"; className?: string }) => {
  const tones = {
    primary: "bg-dx-brand text-white hover:bg-dx-brand-hover",
    ghost: "border border-dx-line-strong bg-transparent text-dx-ink hover:bg-dx-sunken",
    light: "bg-white text-dx-ink hover:bg-dx-surface",
    night: "border border-dx-night-line bg-transparent text-dx-night-ink hover:bg-white/5",
  };
  const cls = `group inline-flex h-11 items-center justify-center gap-2 rounded-[8px] px-5 text-[14px] font-medium transition active:scale-[0.98] [&>svg]:transition-transform [&>svg]:duration-300 hover:[&>svg]:translate-x-0.5 ${tones[tone]} ${FOCUS} ${className}`;
  if (to)
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  return href ? (
    <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
};

/** The primary action everywhere on the page: a short call on the founder's calendar. */
const BookCall = ({ tone = "primary", className = "" }: { tone?: "primary" | "light"; className?: string }) => (
  <Button href={BOOK_CALL} external tone={tone} className={className}>
    Book a 15-minute call <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
  </Button>
);

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
  { href: "#faq", label: "FAQ" },
  { href: "/inventory", label: "Free tool" },
  { href: "/blog", label: "Blog" },
];

const Nav = () => (
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
      <Button href={BOOK_CALL} external className="!h-9">
        <span className="sm:hidden">Book a call</span>
        <span className="hidden sm:inline">Book a 15-minute call</span>
      </Button>
    </nav>
    <ScrollProgress />
  </header>
);

/* ───────────────────────── hero ───────────────────────── */

const Hero = () => {
  const reduce = !!useReducedMotion();
  const enter = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.45 + i * 0.08, ease: EASE } });
  return (
    <section className="relative overflow-hidden px-5 pb-10 pt-28 sm:px-8 md:pb-16 md:pt-36" aria-labelledby="hero-title">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-6xl">
        <motion.p {...enter(0)} className={`${MONO} mb-5 text-dx-brand`}>
          For RevOps and marketing ops teams
        </motion.p>
        {/* headline left, the one-liner and actions right, like a magazine spread */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <WordReveal id="hero-title" text="Every tool says success." muted="None of them knows the lead arrived." className="max-w-3xl text-[38px] font-semibold leading-[1.06] tracking-[-0.03em] text-dx-ink sm:text-[50px] sm:leading-[1.04] lg:text-[54px]" />
          <div className="lg:border-l lg:border-dx-line lg:pl-8">
            <motion.p {...enter(1)} className="max-w-xl text-[17px] leading-relaxed text-dx-ink-muted sm:text-[18px]">
              {HERO_SUB}
            </motion.p>
            <motion.div {...enter(2)} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <BookCall />
              <Button to="/inventory" tone="ghost">
                Check your own lead path (free)
              </Button>
            </motion.div>
            <motion.p {...enter(3)} className="mt-5 text-[13px] text-dx-ink-muted">
              Read-only. Nothing in your CRM changes.
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

/* ───────────────────────── 4 · handoff flow ───────────────────────── */

/** Four handoffs with today's and yesterday's counts. The daily check walks the row; the break lights up in amber as it reaches it. Illustrative numbers. */
const HandoffFlow = () => {
  const { ref, stage, reduce } = useStage(HANDOFFS.length + 4, 1200);
  const reached = (i: number) => reduce || stage >= i;
  const breakIdx = HANDOFFS.findIndex((h) => h.missing);
  const showBreak = reduce || stage > breakIdx;
  return (
    <div ref={ref} role="img" aria-label="Forms, CRM, Routing and Sequencing in a row with today's and yesterday's lead counts. Routing shows 175 against 208, with 37 missing, highlighted in amber.">
      {/* the daily check, working through each handoff in turn */}
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
            <p className="mt-1 text-dx-ink-muted">
              <span className="font-medium text-dx-ink">Likely cause:</span> a field value was renamed and no rule matches it. <span className="font-medium text-dx-ink">Fix:</span> add the new value to the routing rule.
            </p>
            <p className="mt-2 font-medium text-dx-brand">View the 37 leads →</p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

/* ───────────────────────── 3 · form-fill mini visual ───────────────────────── */

const FormFillBars = () => {
  const reduce = !!useReducedMotion();
  return (
    <div className="rounded-[8px] border border-dx-line bg-dx-surface p-4" role="img" aria-label="Illustration. Pricing page: 212 submissions, 175 contacts created, 37 missing.">
      <p className={`${MONO} text-dx-ink-muted`}>Pricing page · today</p>
      <dl className="mt-3 space-y-2.5">
        {[
          { k: "Submissions", v: 212, w: 100, tone: "bg-dx-brand" },
          { k: "Contacts created", v: 175, w: 83, tone: "bg-dx-brand/50" },
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
        37 never became contacts
      </motion.p>
    </div>
  );
};

/* ───────────────────────── 7 · roadmap timeline ───────────────────────── */

const RoadmapTimeline = () => {
  const reduce = !!useReducedMotion();
  return (
    <div className="relative mt-10">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 hidden h-px bg-dx-line lg:block">
        <motion.div className="h-px origin-left bg-dx-brand" initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 1.8, ease: EASE }} />
      </div>
      <div className="grid gap-8 lg:grid-cols-3 lg:gap-6">
        {ROADMAP.map((v, i) => (
          <Reveal key={v.k} delay={i * 0.12}>
            <div className="relative border-t border-dx-line pt-5 lg:border-t-0">
              <motion.span aria-hidden="true" className={`absolute -top-[3.5px] left-0 hidden h-[7px] w-[7px] rounded-full lg:block ${v.live ? "bg-dx-brand" : "bg-dx-line-strong"}`} initial={reduce ? false : { scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.4, delay: 0.5 + i * 0.6, ease: EASE }} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className={`${MONO} ${v.live ? "text-dx-brand" : "text-dx-ink-muted"}`}>{v.k}</p>
                    <span className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 ${MONO} ${v.live ? "border-dx-brand/20 bg-dx-brand-soft text-dx-brand" : "border-dx-line bg-dx-sunken text-dx-ink-muted"}`}>{v.chip}</span>
                  </div>
                  <h3 className="mt-3 text-[17px] font-semibold text-dx-ink">{v.t}</h3>
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

/* ───────────────────────── 7 · MCP explainer (planned) ───────────────────────── */

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
        <Link to="/inventory" className="transition hover:text-dx-ink">
          Free tool
        </Link>
        <Link to="/blog" className="transition hover:text-dx-ink">
          Blog
        </Link>
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
      Scenes and numbers in the animations on this page are illustrative. Product names identify tools we connect to; trademarks belong to their owners.
    </p>
    <div className="mx-auto mt-4 max-w-6xl text-[12px] text-dx-ink-muted">© {new Date().getFullYear()} Dexraflow Inc.</div>
  </footer>
);

/* ───────────────────────── page ───────────────────────── */

const Landing = () => {
  const reduce = !!useReducedMotion();

  // Arriving from another route with a hash (e.g. /blog → /#offer): React Router doesn't scroll, so we do.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Dexraflow";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-dx-surface font-dx-sans text-dx-ink antialiased [overflow-x:clip] selection:bg-dx-brand-soft">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[8px] focus:bg-dx-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />

        {/* 2 · the problem, in the buyer's words */}
        <Section id="problem">
          <Reveal>
            <Head id="problem-title" label="The problem" title="A quiet week looks exactly like a broken form" />
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {SAID.map((s, i) => (
              <Reveal key={s.q} delay={i * 0.08} className="h-full min-w-0">
                <TiltCard className="group h-full rounded-[8px]">
                  <Card className="flex h-full flex-col justify-between gap-8 p-6 transition-shadow duration-300 group-hover:shadow-dx-overlay">
                    <div className="flex justify-end">
                      <s.Icon size={64} />
                    </div>
                    <p className="text-[21px] font-semibold leading-snug tracking-[-0.01em] text-dx-ink">&ldquo;{s.q}&rdquo;</p>
                  </Card>
                </TiltCard>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <p className="max-w-2xl text-[20px] font-medium leading-snug text-dx-ink sm:text-[24px]">
              Each tool in the lead path reports success for its own step. <span className="text-dx-brand">Nobody checks that the lead came out the other end.</span>
            </p>
          </Reveal>
        </Section>

        {/* 3 · the four checks */}
        <Section id="catches">
          <Reveal>
            <Head id="catches-title" label="The four checks" title="Four checks, every day" />
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {CHECKS.map((c, i) => (
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
          <Reveal className="mt-10">
            <p className="max-w-2xl text-[20px] font-medium leading-snug text-dx-ink sm:text-[24px]">Every alert names the records, the pipeline value, the likely cause and the exact fix.</p>
          </Reveal>
        </Section>

        {/* 4 · how it works */}
        <Section id="how">
          <Reveal>
            <Head id="how-title" label="How it works" title="Three steps, all read-only" />
          </Reveal>
          <ol className="mt-12 grid gap-4 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.k} delay={i * 0.08} className="h-full">
                <li className="h-full list-none">
                  <Card className="h-full p-6">
                    <span className={`${MONO} text-dx-brand`}>{s.k}</span>
                    <h3 className="mt-3 text-[18px] font-semibold leading-snug text-dx-ink">{s.t}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-dx-ink-muted">{s.d}</p>
                  </Card>
                </li>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-10">
            <HandoffFlow />
            <p className="mt-4 text-[12px] text-dx-ink-muted">Illustration. The counts, the message and the dollar figure are examples, not real data.</p>
          </Reveal>
        </Section>

        {/* 5 · proof: the HubSpot test */}
        <Section id="proof">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
            <Reveal>
              <Head id="proof-title" label="Proof" title="We reproduced one of these in our own HubSpot" />
              <p className="mt-5 text-[16px] leading-relaxed text-dx-ink-muted">
                On 15 November 2026 we submitted a test entry to our own HubSpot form from a domain not in the account's tracked list. HubSpot returned success. No contact was created. The entry appeared only in the form's Spam tab, marked "Unregistered Site Domain", with a deletion date 90 days out. The daily spam digest exists, but its recipient list is empty by default.
              </p>
              <p className="mt-5">
                <Link to={WRITE_UP} className={`group inline-flex items-center gap-1.5 rounded text-[15px] font-medium text-dx-brand underline decoration-dx-brand/40 underline-offset-4 transition hover:decoration-dx-brand ${FOCUS}`}>
                  Read the full write-up <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
                </Link>
              </p>
              <p className="mt-6 rounded-[8px] border border-dx-signal/40 border-l-[3px] border-l-dx-signal bg-dx-signal-soft px-4 py-3 text-[15px] font-medium leading-relaxed text-dx-signal-ink">If you changed your site domain since May 2024, check your forms' Spam tab before the 90 days run out.</p>
            </Reveal>
            <Reveal delay={0.08}>
              <figure>
                <img src="/blog/hubspot-spam-tab.png" width={1568} height={780} loading="lazy" alt="HubSpot form Spam tab showing one blocked submission, type Unregistered Site Domain, with a deletion date 90 days out." className="w-full rounded-[8px] border border-dx-line bg-dx-raised" />
                <figcaption className="mt-2 text-[12px] text-dx-ink-muted">The Spam tab of our own HubSpot form, 15 November 2026.</figcaption>
              </figure>
            </Reveal>
          </div>
        </Section>

        {/* 6 · offers: audit and monthly */}
        <Section id="offer">
          <Reveal>
            <Head id="offer-title" label="Offers" title="Start with the audit. Keep the daily check." />
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <Reveal className="h-full">
              <BorderBeam className="h-full">
                <div id="audit" className="flex h-full scroll-mt-28 flex-col p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <Label>Missed-Pipeline Audit</Label>
                    <IsoAudit size={72} />
                  </div>
                  <h3 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-dx-ink">14 days. Read-only exports of the last 90 days. Under a mutual NDA.</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-dx-ink-muted">You get: the exact records that slipped, where they slipped, what they were worth, and we fix the top three causes with you.</p>
                  <div className="mt-6 flex items-baseline gap-3">
                    <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-dx-ink">
                      $<CountUp to={1500} duration={1.4} />
                    </p>
                    <p className="text-[14px] text-dx-ink-muted">founding price · list $3,000</p>
                  </div>
                  <p className="mt-2 text-[13px] text-dx-ink-muted">Half on signing, half on delivery.</p>
                  <div className="mt-auto pt-6">
                    <BookCall />
                  </div>
                </div>
              </BorderBeam>
            </Reveal>
            <Reveal delay={0.06} className="h-full">
              <Card className="flex h-full flex-col p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <Label>Daily monitoring</Label>
                  <IsoDailyCheck size={72} />
                </div>
                <h3 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-dx-ink">The four checks, every day, with same-day Slack alerts.</h3>
                <div className="mt-6 flex items-baseline gap-3">
                  <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-dx-ink">From $500</p>
                  <p className="text-[14px] text-dx-ink-muted">a month</p>
                </div>
                <p className="mt-2 text-[13px] text-dx-ink-muted">Audit fee credited against the first three months.</p>
                <p className="mt-4 text-[13px] text-dx-ink-muted">Available to audit customers first.</p>
                <div className="mt-auto pt-6">
                  <Button href="#audit" tone="ghost">
                    Start with the audit
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

        {/* 7 · coming next: fix on approval, and Dexraflow MCP */}
        <Section id="mcp">
          <Reveal>
            <Head id="mcp-title" label="Roadmap" title="Find it. Fix it. Then let your agents through safely." />
          </Reveal>
          <RoadmapTimeline />

          {/* the planned MCP, shown working: the gate scene with its four steps, then the same request without and with it */}
          <Reveal className="mt-16">
            <div className="flex flex-wrap items-center gap-2.5">
              <Label>How Dexraflow MCP will work</Label>
              <span className={`inline-flex items-center rounded-[4px] border border-dx-line bg-dx-sunken px-2 py-0.5 ${MONO} text-dx-ink-muted`}>Planned</span>
            </div>
            <div className="mt-6">
              <McpExplainer />
            </div>
          </Reveal>
          <Reveal className="mt-10">
            <Card className="p-4 sm:p-6">
              <div className="mx-auto max-w-[880px]">
                <WithoutWith />
              </div>
            </Card>
            <p className="mt-3 text-[12px] text-dx-ink-muted">Illustration of a planned product. The agents, names and figures are examples.</p>
          </Reveal>

          <Reveal className="mt-12">
            <p className="max-w-2xl text-[17px] leading-relaxed text-dx-ink">We don't build outreach agents, enrichment or routing. We make sure the ones you have hand off to each other.</p>
            <p className="mt-4 text-[14px] text-dx-ink-muted">
              Building agents that write to a CRM?{" "}
              <a href="mailto:shakil@dexraflow.com" className={`rounded font-medium text-dx-brand underline decoration-dx-brand/40 underline-offset-4 transition hover:decoration-dx-brand ${FOCUS}`}>
                Tell us what you'd want checked
              </a>
            </p>
          </Reveal>
        </Section>

        {/* FAQ: kept for the nav item and the FAQ schema; not one of the eight briefed sections */}
        <Section id="faq" tight>
          <Reveal>
            <Head id="faq-title" label="Questions" title="Lead leakage and GTM automation failures, explained" />
          </Reveal>
          <div className="mt-10 grid gap-x-10 gap-y-2 lg:grid-cols-2">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.05}>
                <details className="group border-t border-dx-line py-5 open:pb-6">
                  <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold text-dx-ink [&::-webkit-details-marker]:hidden ${FOCUS} rounded`}>
                    <h3 className="text-[17px] font-semibold">{f.q}</h3>
                    <span aria-hidden="true" className="relative h-4 w-4 shrink-0 text-dx-ink-muted">
                      <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-current" />
                      <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-current transition-transform duration-300 group-open:rotate-90" />
                    </span>
                  </summary>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-dx-ink-muted">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* 8 · final call to action */}
        <Section id="start">
          <Reveal>
            <div className="relative overflow-hidden rounded-[8px] border border-dx-night-line bg-dx-night p-8 text-dx-night-ink sm:p-12">
              <NightGrid />
              <div aria-hidden="true" className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 lg:block xl:right-12">
                <IsoNightStack size={300} />
              </div>
              <div className="relative lg:max-w-[60%]">
                <h2 id="start-title" className="max-w-2xl text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">
                  Find out what you lost this quarter
                </h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-dx-night-ink-muted">14 days, read-only, under NDA. If you changed a domain this autumn, sooner is better.</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <BookCall tone="light" />
                  <Button to="/inventory" tone="night">
                    Check your own lead path first
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </Section>
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
