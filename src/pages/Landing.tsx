import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import AccessRequestModal from "@/components/stealth/AccessRequestModal";
import ComplaintWall from "@/components/landing/ComplaintWall";
import { AgentFlow, MissedSignalScene, NoOwnerScene, SilentFailureScene } from "@/components/landing/UseCaseAnimations";
import { CONTACT_EMAIL } from "@/components/stealth/contact";
import type { AccessIntent } from "@/services/earlyAccessAPI";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ───────────────────────── sources ───────────────────────── */

const SOURCES = [
  {
    id: 1,
    label: "Traction Complete, 2025 CRO Survey",
    href: "https://tractioncomplete.com/guide/cro-survey-nrr-retention-expansion/",
  },
  {
    id: 2,
    label: "Validity, The State of CRM Data Management in 2025",
    href: "https://validity.com/resource-center/the-state-of-crm-data-management-in-2025",
  },
  {
    id: 3,
    label: "Salesforce, State of Sales report (2022)",
    href: "https://www.salesforce.com/news/stories/sales-research-2023/",
  },
  {
    id: 4,
    label: "Harvard Business Review, The Short Life of Online Sales Leads (2011), audit of 2,241 US companies",
    href: "https://hbr.org/2011/03/the-short-life-of-online-sales-leads",
  },
  {
    id: 5,
    label: "Gartner, AI agents will outnumber sellers 10 to 1 by 2028 (press release, July 2026)",
    href: "https://www.gartner.com/en/newsroom/press-releases/2026-07-28-gartner-predicts-ai-agents-will-outnumber-sellers-10-to-1-by-2028-yet-fewer-than-40-percent-of-sellers-will-say-agents-improved-productivity",
  },
] as const;

type SourceId = (typeof SOURCES)[number]["id"];

const Cite = ({ n }: { n: SourceId }) => (
  <a
    href="#sources"
    aria-label={`Source ${n}`}
    className="ml-0.5 align-super text-[10px] font-medium text-dx-ink-muted transition hover:text-dx-ink"
  >
    [{n}]
  </a>
);

/* ───────────────────────── primitives ───────────────────────── */

const Reveal = ({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
};

/** The official lockup from the design system (public/brand). Never retyped or redrawn. */
const Wordmark = ({ reversed = false, className = "h-7" }: { reversed?: boolean; className?: string }) => (
  <img
    src={reversed ? "/brand/dexraflow-lockup-reversed.svg" : "/brand/dexraflow-lockup.svg"}
    alt="Dexraflow"
    width={137}
    height={28}
    className={`w-auto ${className}`}
  />
);

/** Mono uppercase `eyebrow`, led by a short brand "plane" bar. */
const Eyebrow = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
  <p className={`flex items-center gap-2.5 font-dx-mono text-[12px] font-medium uppercase leading-4 tracking-[0.08em] ${dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}`}>
    <span aria-hidden="true" className={`h-[3px] w-4 rounded-[1px] ${dark ? "bg-dx-brand-night" : "bg-dx-brand"}`} />
    {children}
  </p>
);

/** Two-tone `display` heading: an ink lead sentence, then an ink-muted continuation. */
const SectionTitle = ({
  id,
  lead,
  muted,
  dark = false,
  className = "",
}: {
  id: string;
  lead: ReactNode;
  muted?: ReactNode;
  dark?: boolean;
  className?: string;
}) => (
  <h2
    id={id}
    className={`mt-5 max-w-3xl text-[30px] font-semibold leading-[1.14] tracking-[-0.02em] sm:text-[44px] sm:leading-[50px] ${dark ? "text-dx-night-ink" : "text-dx-ink"} ${className}`}
  >
    {lead}
    {muted && <span className={dark ? "text-dx-night-ink-muted" : "text-dx-ink-muted"}> {muted}</span>}
  </h2>
);

/** Focus ring per the system: 2px solid `focus`, 2px offset. */
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-focus focus-visible:ring-offset-2";

const PrimaryCTA = ({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-dx-brand px-4 text-[14px] font-medium text-white transition hover:bg-dx-brand-hover ${FOCUS} ${className}`}
  >
    {children}
    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
  </button>
);

const SecondaryCTA = ({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-dx-line-strong bg-dx-raised px-4 text-[14px] font-medium text-dx-ink transition hover:bg-dx-surface ${FOCUS} ${className}`}
  >
    {children}
  </button>
);

/** Button for `night` bands: raised ink-on-light. */
const InverseCTA = ({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[8px] bg-dx-night-ink px-4 text-[14px] font-medium text-dx-ink transition hover:bg-dx-raised ${FOCUS} focus-visible:ring-dx-brand-night focus-visible:ring-offset-dx-night ${className}`}
  >
    {children}
    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
  </button>
);

/**
 * "Accelerated by DraperU India" badge.
 * Drop the official logo at public/brand/draperu-india.png and it is used automatically;
 * until then the badge shows the name as text.
 */
const AcceleratorBadge = ({ onBrand = false }: { onBrand?: boolean }) => {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-[8px] border py-1.5 pl-3 pr-3.5 text-[13px] font-medium ${
        onBrand ? "border-white/25 text-white/85" : "border-dx-line bg-dx-raised text-dx-ink-muted"
      }`}
    >
      <span>Accelerated by</span>
      {logoOk ? (
        <img src="/brand/draperu-india.png" alt="DraperU India" className="h-5 w-auto" onError={() => setLogoOk(false)} />
      ) : (
        <span className={`font-semibold ${onBrand ? "text-white" : "text-dx-ink"}`}>DraperU India</span>
      )}
    </span>
  );
};

/* ───────────────────────── nav ───────────────────────── */

const NAV_LINKS = [
  { href: "#problem", label: "The problem" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#how", label: "How it works" },
  { href: "#on-x", label: "Heard on X" },
];

const Nav = ({ onAccess, onAudit }: { onAccess: () => void; onAudit: () => void }) => (
  <header className="fixed inset-x-0 top-0 z-50">
    {/* announcement bar */}
    <div className="bg-dx-ink text-dx-night-ink">
      <button
        type="button"
        onClick={onAudit}
        className="group mx-auto flex h-10 w-full max-w-7xl items-center justify-center gap-2 px-5 text-[13px] font-medium sm:text-[14px]"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-dx-signal" />
        <span className="truncate">
          <span className="sm:hidden">The 14-day Missed Pipeline Audit</span>
          <span className="hidden sm:inline">The 14-day Missed Pipeline Audit: find $10K of missed pipeline, or you don't pay</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
      </button>
    </div>
    <div className="border-b border-dx-line bg-dx-surface/90 backdrop-blur-xl">
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
        <button
          type="button"
          onClick={onAccess}
          className={`h-9 rounded-[8px] bg-dx-brand px-3.5 text-[14px] font-medium text-white transition hover:bg-dx-brand-hover ${FOCUS}`}
        >
          <span className="sm:hidden">Early access</span>
          <span className="hidden sm:inline">Request early access</span>
        </button>
      </nav>
    </div>
  </header>
);

/* ───────────────────────── hero ───────────────────────── */

const Hero = ({ onAudit }: { onAudit: () => void }) => {
  const reduce = useReducedMotion();
  const enter = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay: 0.1 + i * 0.1, ease: EASE },
        };

  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-title">
      <div className="mx-auto max-w-7xl px-5 pt-40 text-center sm:px-8 md:pt-48">
        <motion.div {...enter(0)} className="flex justify-center">
          <AcceleratorBadge />
        </motion.div>

        <motion.h1
          id="hero-title"
          {...enter(1)}
          className="mx-auto mt-7 max-w-6xl text-[40px] font-semibold leading-[1.06] tracking-[-0.025em] text-dx-ink sm:text-[52px] sm:leading-[58px] lg:text-[64px] lg:leading-[68px]"
        >
          Your GTM tools are dropping deals.{" "}
          <br className="hidden sm:block" />
          <span className="text-dx-ink-muted">Silently.</span>
        </motion.h1>

        <motion.p {...enter(2)} className="mx-auto mt-6 max-w-[640px] text-[18px] leading-[28px] text-dx-ink-muted">
          Dexraflow connects to the tools you already use, like HubSpot, Salesforce, Clay, Apollo and Outreach, catches the leads and
          deals that slip between them, and tells the right rep in Slack before they go cold.
        </motion.p>

        <motion.div {...enter(3)} className="mt-9 flex flex-col justify-center gap-2.5 sm:flex-row">
          <a
            href="#use-cases"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("use-cases")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
            }}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-dx-line-strong bg-dx-raised px-4 text-[14px] font-medium text-dx-ink transition hover:bg-dx-surface ${FOCUS}`}
          >
            See how it works
          </a>
          <PrimaryCTA onClick={onAudit}>Book a 14-day audit</PrimaryCTA>
        </motion.div>
      </div>

      {/* Framed "app window": real RevOps community posts, scrolling */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 0.45, ease: EASE }}
        className="mx-auto mt-16 max-w-6xl px-3 sm:px-8 md:mt-20"
      >
        <div className="relative">
          {/* the brand dot grid, behind the visual only (never behind running text) */}
          <div aria-hidden="true" className="pointer-events-none absolute -inset-x-6 -inset-y-8 bg-[url('/brand/dot-grid-tile.svg')] bg-[length:24px_24px] [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] sm:-inset-x-12" />
          <div className="relative rounded-[12px] border border-dx-line bg-dx-raised p-1.5 sm:p-2">
            <div className="overflow-hidden rounded-[8px] border border-dx-night-line bg-dx-night">
              <div className="flex items-center gap-3 border-b border-dx-night-line px-4 py-3">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-dx-night-line" />
                  <span className="h-2.5 w-2.5 rounded-full bg-dx-night-line" />
                  <span className="h-2.5 w-2.5 rounded-full bg-dx-night-line" />
                </span>
                <span className="font-dx-mono text-[13px] text-dx-night-ink"># revops-community</span>
                <span className="ml-auto hidden font-dx-mono text-[12px] text-dx-night-ink-muted sm:inline">real posts · names blurred</span>
              </div>
              <ComplaintWall className="h-[420px] px-3 sm:h-[520px] sm:px-4" />
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-[13px] text-dx-ink-muted">
          Built from 1,300+ RevOps community conversations. Real posts shown here, names blurred.
        </p>
      </motion.div>
    </section>
  );
};

/* ───────────────────────── problem in numbers ───────────────────────── */

const STATS: { value: string; text: ReactNode; cite: SourceId }[] = [
  { value: "80%", text: "of RevOps leaders don't feel they have clean, actionable data. Only 2 in 10 do.", cite: 1 },
  { value: "37%", text: "of CRM users reported losing revenue as a direct result of poor data quality.", cite: 2 },
  { value: "10", text: "tools used, on average, to close a deal", cite: 3 },
];

const Problem = () => (
  <section id="problem" className="scroll-mt-32 border-t border-dx-line bg-dx-surface px-5 py-24 sm:px-8 md:py-32" aria-labelledby="problem-title">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <Eyebrow>The problem</Eyebrow>
        <SectionTitle id="problem-title" lead="Every tool says “success.”" muted="Your pipeline says otherwise." />
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dx-ink-muted">
          Your CRM, enrichment, intent and outreach tools each keep their own version of the customer. Workflows between them break
          without an error, leads sit with no owner, and buying signals go unseen. Nobody is checking what falls in between.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {STATS.map((s, i) => (
          <Reveal key={s.value} delay={i * 0.06}>
            <div className="h-full rounded-[8px] border border-dx-line bg-dx-raised p-5 sm:p-6">
              <p className="text-[38px] font-semibold leading-none tracking-[-0.04em] text-dx-ink sm:text-[52px]">{s.value}</p>
              <p className="mt-3 text-[14px] leading-relaxed text-dx-ink-muted sm:mt-4 sm:text-[15px]">
                {s.text}
                <Cite n={s.cite} />
              </p>
            </div>
          </Reveal>
        ))}
      </div>

    </div>
  </section>
);

/* ───────────────────────── the numbers (bold band) ───────────────────────── */

const BIG_GROUPS: { label: string; cols: string; stats: { value: string; text: string; cite: SourceId }[] }[] = [
  {
    label: "Speed decides the deal",
    cols: "sm:grid-cols-3",
    stats: [
      { value: "42 hrs", text: "average time for a company to first respond to an inbound lead", cite: 4 },
      { value: "7×", text: "more likely to qualify a lead when you reach out within the hour", cite: 4 },
      { value: "23%", text: "of companies never responded to the lead at all", cite: 4 },
    ],
  },
  {
    label: "Agents are about to multiply it",
    cols: "sm:grid-cols-2",
    stats: [
      { value: "10:1", text: "AI agents to sellers by 2028, Gartner predicts", cite: 5 },
      { value: "<40%", text: "of sellers will say those agents actually improved productivity", cite: 5 },
    ],
  },
];

const BigNumbers = () => (
  <section className="bg-dx-surface px-5 pb-24 sm:px-8 md:pb-32" aria-labelledby="numbers-title">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <div className="relative overflow-hidden rounded-[12px] bg-dx-night px-6 py-12 text-dx-night-ink sm:px-12 sm:py-16">
          <div className="relative">
            <Eyebrow dark>By the numbers</Eyebrow>
            <SectionTitle id="numbers-title" dark lead="Every hour a lead waits," muted="the deal gets colder." />
            <div className="mt-12 space-y-12">
              {BIG_GROUPS.map((g) => (
                <div key={g.label}>
                  <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-night-ink-muted">{g.label}</p>
                  <div className={`mt-5 grid gap-8 ${g.cols}`}>
                    {g.stats.map((s) => (
                      <div key={s.value} className="border-t border-dx-night-line pt-5">
                        <p className="text-[52px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-dx-night-ink sm:text-[64px]">{s.value}</p>
                        <p className="mt-4 text-[15px] leading-relaxed text-dx-night-ink-muted">
                          {s.text}
                          <a
                            href="#sources"
                            aria-label={`Source ${s.cite}`}
                            className="ml-0.5 align-super text-[10px] font-medium text-dx-night-ink-muted transition hover:text-dx-night-ink"
                          >
                            [{s.cite}]
                          </a>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-12 max-w-2xl text-[16px] leading-relaxed text-dx-night-ink-muted">
              More tools and more AI agents mean more places for leads to slip, and nobody checking the gaps.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

/* ───────────────────────── use cases ───────────────────────── */

const SCENARIOS: { tag: string; title: string; Scene: () => JSX.Element; result: string }[] = [
  { tag: "No owner", title: "A hot lead nobody owns", Scene: NoOwnerScene, result: "Worked the same day, not found in a report next month." },
  { tag: "Silent failure", title: "A workflow that says “success” but did nothing", Scene: SilentFailureScene, result: "Fixed in hours, with a list of leads to re-route." },
  { tag: "Missed signal", title: "A buying signal nobody acted on", Scene: MissedSignalScene, result: "The account gets a touch while it’s still in-market." },
];

const UseCases = ({ onAudit, onAccess }: { onAudit: () => void; onAccess: () => void }) => (
  <section id="use-cases" className="scroll-mt-32 px-5 py-24 sm:px-8 md:py-32" aria-labelledby="usecases-title">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <Eyebrow>Use cases</Eyebrow>
        <SectionTitle id="usecases-title" lead="What Dexraflow does for a revenue team." />
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dx-ink-muted">
          Dexraflow sits on top of the tools you already use, catches what slips between them, and never emails your prospects.
        </p>
      </Reveal>

      {/* Use case 1: live now */}
      <Reveal className="mt-14">
        <div className="rounded-[8px] border border-dx-line bg-dx-raised p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-dx-success-soft px-2 py-1 font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-success"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-dx-success" />Available now</span>
            <span className="text-[13px] text-dx-ink-muted">Use case 1</span>
          </div>
          <h3 className="mt-4 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-dx-ink sm:text-[32px]">
            Catch the leads and deals your GTM tools silently dropped
          </h3>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {SCENARIOS.map(({ tag, title, Scene, result }) => (
              <div key={tag} className="flex h-full flex-col">
                <span className="w-fit rounded-[4px] border border-dx-brand/20 bg-dx-brand-soft px-2 py-0.5 text-[12px] font-medium text-dx-brand">{tag}</span>
                <h4 className="mb-4 mt-3 min-h-[50px] text-[18px] font-semibold leading-snug text-dx-ink">{title}</h4>
                <Scene />
                <div className="flex-1" />
                <p className="mt-5 flex items-start gap-2 border-t border-dx-line pt-4 text-[15px] font-medium text-dx-ink">
                  <Check strokeWidth={1.5} className="mt-0.5 h-4 w-4 shrink-0 text-dx-brand" /> {result}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[12px] text-dx-ink-muted">
            Examples are illustrative, based on failures RevOps teams and operators have described to us. Product names identify the tools we connect
            to; they are trademarks of their owners.
          </p>

          <div className="mt-8 flex flex-col gap-6 rounded-[8px] bg-dx-night p-6 text-dx-night-ink sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <Eyebrow dark>How it starts</Eyebrow>
              <p className="mt-3 text-[16px] leading-relaxed text-dx-night-ink-muted">
                A 14-day Missed Pipeline Audit: connect your tools read-only, and we show you what slipped in the last 90 days, what it was worth and why.
                Then the same checks run live, with Slack alerts and a weekly recovered-pipeline report.
              </p>
            </div>
            <InverseCTA onClick={onAudit}>Book an audit</InverseCTA>
          </div>
        </div>
      </Reveal>

      {/* Use case 2: coming soon */}
      <Reveal className="mt-6">
        <div className="rounded-[12px] border border-dashed border-dx-line-strong bg-dx-surface p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-dx-signal-soft px-2 py-1 font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-signal-ink"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-dx-signal" />Coming soon</span>
            <span className="text-[13px] text-dx-ink-muted">Use case 2</span>
          </div>
          <h3 className="mt-4 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-dx-ink sm:text-[32px]">
            Your AI agents check with Dexraflow before they act
          </h3>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-dx-ink-muted">
            Agents from different tools can’t see each other. With Dexraflow, they ask first.
          </p>
          <div className="mt-8">
            <AgentFlow />
          </div>
          <div className="mt-8 flex flex-col gap-4 border-t border-dx-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-[15px] text-dx-ink-muted">For teams running AI agents, and GTM engineers building their own. Works through MCP.</p>
            <SecondaryCTA onClick={onAccess} className="shrink-0">
              Get early access
            </SecondaryCTA>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

/* ───────────────────────── insights ───────────────────────── */

const INSIGHTS: { title: string; body: ReactNode }[] = [
  {
    title: "It's not too many tools. It's tools that disagree.",
    body: "CRM, billing and support each keep their own record, so one customer shows up three different ways. This was the most repeated pain in every community we studied.",
  },
  {
    title: "The buying moment happens before your CRM knows.",
    body: 'Teams told us they found projects "after the client had already selected a vendor". The signal was there. Nobody connected the dots in time.',
  },
  {
    title: "Dashboards get ignored. Actions get done.",
    body: 'Leaders don\'t want another view of activity. They want "this account moved, act now", with the reason why.',
  },
  {
    title: "Routing rules rot.",
    body: "Inherited CRMs run routing rules written years ago and patched over and over. It was called \"by far the biggest gap\".",
  },
  {
    title: "AI agents make bad data louder.",
    body: "If the CRM has duplicates or stale fields, an agent writes confident updates on top of them. Teams are hesitant to give agents write access for this reason.",
  },
  {
    title: "Consolidation is coming.",
    body: (
      <>
        9 in 10 sales organizations plan to consolidate their tech stack.
        <Cite n={3} /> Any new tool has to replace work or prove pipeline, not add another tab.
      </>
    ),
  },
];

const Insights = () => (
  <section id="insights" className="scroll-mt-32 px-5 py-24 sm:px-8 md:py-32" aria-labelledby="insights-title">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <Eyebrow>What we learned</Eyebrow>
        <SectionTitle id="insights-title" lead="Six things every revenue leader should know." />
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dx-ink-muted">
          From 1,300+ posts across two RevOps practitioner communities and 148 CRO Club articles on revenue and sales operations.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-px overflow-hidden rounded-[8px] border border-dx-line bg-dx-line sm:grid-cols-2 lg:grid-cols-3">
        {INSIGHTS.map((it, i) => (
          <Reveal key={it.title} delay={(i % 3) * 0.05} className="bg-dx-raised">
            <div className="h-full p-7">
              <span className="font-dx-mono text-[12px] font-medium text-dx-brand">0{i + 1}</span>
              <h3 className="mt-3 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-dx-ink">{it.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-dx-ink-muted">{it.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ───────────────────────── heard on X ───────────────────────── */

const X_POSTS: { name: string; handle: string; date: string; tag: string; quote: string; id: string }[] = [
  {
    name: "Alton Syn",
    handle: "WorkflowWhisper",
    date: "Apr 2026",
    tag: "Routing",
    quote: "a client's lead routing was broken for 6 weeks before they called me … 23 deals routed to a dead inbox. $140k in pipeline gone",
    id: "2039742868185854146",
  },
  {
    name: "Joshua Pi'Rwot",
    handle: "pirwot",
    date: "Sep 2026",
    tag: "Silent failure",
    quote: "an automation … had been quietly doing nothing for eleven days. It ran on schedule. The dashboard was green. … It failed politely.",
    id: "2100906487312744726",
  },
  {
    name: "Tech Sales Guy",
    handle: "TechSalesGuy",
    date: "Sep 2026",
    tag: "No owner",
    quote: "the leads just sat.... and sat there. no owner. no task. no follow up",
    id: "2102557390440689959",
  },
  {
    name: "Jack",
    handle: "JackPineRD",
    date: "Oct 2026",
    tag: "Handoff",
    quote: "I've seen solid outbound and content still dump leads into HubSpot with source overwritten and no owner. The gap was the handoff.",
    id: "2109711708252262883",
  },
  {
    name: "Keith",
    handle: "keithsalins_",
    date: "Jul 2026",
    tag: "Broken workflows",
    quote: "someone set up a Clay workflow in January / it broke in February, nobody fixed it / 14 Zapier automations that nobody documented",
    id: "2082126440775217350",
  },
  {
    name: "Jason Lemkin",
    handle: "jasonlk",
    date: "Oct 2026",
    tag: "AI agents",
    quote: "Never let your AI SDR send its first 1,000 emails without manually reviewing every single one.",
    id: "2109289938692784499",
  },
];

const XLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="currentColor"
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    />
  </svg>
);

const HeardOnX = () => (
  <section id="on-x" className="scroll-mt-32 border-t border-dx-line px-5 py-24 sm:px-8 md:py-32" aria-labelledby="onx-title">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <Eyebrow>Heard on X</Eyebrow>
        <SectionTitle id="onx-title" lead="The dashboard says success." muted="The pipeline says otherwise." />
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dx-ink-muted">
          Operators and founders on X describe the same failure: workflows that run, report green, and quietly drop the leads that
          matter.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {X_POSTS.map((p, i) => (
          <Reveal key={p.id} delay={(i % 3) * 0.05}>
            <a
              href={`https://x.com/${p.handle}/status/${p.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col rounded-[8px] border border-dx-line bg-dx-raised p-6 transition hover:border-dx-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-focus"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dx-sunken text-[13px] font-semibold text-dx-ink">
                    {p.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-dx-ink">{p.name}</p>
                    <p className="truncate text-[13px] text-dx-ink-muted">@{p.handle}</p>
                  </div>
                </div>
                <XLogo className="h-4 w-4 shrink-0 text-dx-ink" />
              </div>
              <blockquote className="mt-5 flex-1 text-[16px] leading-relaxed text-dx-ink">“{p.quote}”</blockquote>
              <div className="mt-6 flex items-center justify-between text-[12px]">
                <span className="rounded-[4px] border border-dx-brand/20 bg-dx-brand-soft px-2 py-0.5 font-medium text-dx-brand">{p.tag}</span>
                <span className="inline-flex items-center gap-1 text-dx-ink-muted transition group-hover:text-dx-ink">
                  {p.date} · View on X <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-[12px] leading-relaxed text-dx-ink-muted">
        Public posts on X, quoted in part with links to the originals. The authors are not Dexraflow customers and have not endorsed
        Dexraflow.
      </p>
    </div>
  </section>
);

/* ───────────────────────── how it works ───────────────────────── */

const STEPS = [
  { n: "1", title: "Connect", body: "Read-only access to your CRM and GTM tools. Setup takes minutes, not a project." },
  { n: "2", title: "Match", body: "One record per account and contact across every tool, so signals and owners line up." },
  { n: "3", title: "Catch", body: "Leads with no owner, workflows that say success but wrote nothing, and buying signals nobody acted on." },
  { n: "4", title: "Alert & prove", body: "The right rep gets it in Slack with the reason and a deadline. You get a weekly report of pipeline recovered." },
];

const TOOLS = ["HubSpot", "Salesforce", "Slack", "Apollo", "Outreach", "Salesloft", "Clay"];

const How = ({ onAudit }: { onAudit: () => void }) => (
  <section id="how" className="scroll-mt-32 border-t border-dx-line bg-dx-surface px-5 py-24 sm:px-8 md:py-32" aria-labelledby="how-title">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <Eyebrow>How it works</Eyebrow>
        <SectionTitle id="how-title" lead="Connect your tools." muted="We catch what slips." />
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dx-ink-muted">
          No new tool to learn and nothing to replace. Read-only by default, and alerts arrive where your team already works: Slack.
        </p>
      </Reveal>

      {/* The brand's signature image: one plane above the tools, one signal moving through. */}
      <Reveal className="mt-14">
        <figure className="overflow-hidden rounded-[12px] border border-dx-line bg-dx-raised">
          <img
            src="/brand/plane-diagram.svg"
            alt="Diagram: Dexraflow as one bar sitting above six GTM tools, with a single alert moving down to one of them."
            width={1200}
            height={630}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        </figure>
      </Reveal>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.06}>
            <div className="h-full rounded-[8px] border border-dx-line bg-dx-raised p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-dx-brand-soft font-dx-mono text-[13px] font-medium text-dx-brand">{s.n}</span>
              <h3 className="mt-5 text-[18px] font-semibold text-dx-ink">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-dx-ink-muted">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-10 flex flex-col gap-6 rounded-[8px] border border-dx-line bg-dx-raised p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <ul className="grid gap-3 text-[15px] text-dx-ink sm:grid-cols-3 lg:gap-8">
          {["Read-only by default", "Writes only 10 essential fields", "Every change logged"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check strokeWidth={1.5} className="h-4 w-4 text-dx-brand" /> {t}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {TOOLS.map((t) => (
            <span key={t} className="rounded-[4px] border border-dx-line bg-dx-surface px-2 py-1 font-dx-mono text-[12px] text-dx-ink-muted">
              {t}
            </span>
          ))}
        </div>
      </Reveal>

      {/* Audit offer */}
      <Reveal className="mt-4">
        <div className="relative overflow-hidden rounded-[12px] bg-dx-night p-8 text-dx-night-ink sm:p-12">
          <div className="relative grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-end">
            <div>
              <Eyebrow dark>Start here</Eyebrow>
              <h3 className="mt-4 text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">The 14-day Missed Pipeline Audit</h3>
              <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-dx-night-ink-muted">
                Connect your tools read-only. We look back 90 days and show you the high-intent accounts nobody worked, leads routed to
                the wrong owner or no owner, and workflows that failed silently, with what each one was worth. If we don't find at least
                $10K of missed pipeline, you don't pay.
              </p>
            </div>
            <div className="md:justify-self-end">
              <InverseCTA onClick={onAudit} className="w-full sm:w-auto">Book my audit</InverseCTA>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

/* ───────────────────────── founder / closing ───────────────────────── */

const Closing = ({ onAccess, onFounder }: { onAccess: () => void; onFounder: () => void }) => (
  <section className="px-5 py-24 sm:px-8 md:py-32" aria-labelledby="closing-title">
    <Reveal className="mx-auto max-w-6xl">
      {/* The page's one full `brand` band, as the brand book allows on marketing pages. */}
      <div className="rounded-[12px] bg-dx-brand px-6 py-16 text-center text-white sm:px-12 md:py-24">
        <div className="flex justify-center">
          <AcceleratorBadge onBrand />
        </div>
        <h2 id="closing-title" className="mx-auto mt-8 max-w-3xl text-[36px] font-semibold leading-[1.08] tracking-[-0.025em] sm:text-[52px] sm:leading-[58px]">
          Seen a deal slip{" "}
          <br className="hidden sm:block" />
          <span className="text-white/80">through your stack?</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[18px] leading-[28px] text-white/85">
          We're working with a small group of B2B SaaS revenue teams running five or more GTM tools. Tell us what slipped, and we'll show
          you where else it's happening.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onAccess}
            className="group inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-white px-4 text-[14px] font-medium text-dx-brand transition hover:bg-dx-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-dx-brand"
          >
            Request early access
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onFounder}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-white/40 px-4 text-[14px] font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-dx-brand"
          >
            Talk to the founder <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </Reveal>
  </section>
);

const Footer = () => (
  <footer className="border-t border-dx-line bg-dx-raised px-5 pb-10 pt-14 sm:px-8">
    <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
      <div>
        <Wordmark />
        <p className="mt-3 text-[13px] text-dx-ink-muted">Catch the deals your GTM tools silently dropped.</p>
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

    <div id="sources" className="mx-auto mt-12 max-w-6xl scroll-mt-24 border-t border-dx-line pt-8">
      <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">Sources</p>
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
        Community quotes are real posts from public channels of a RevOps practitioner Slack community. Names, photos and mentions are
        blurred; highlights are ours. Insights summarize our own research and are not statistics.
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

  useEffect(() => {
    const prev = document.title;
    document.title = "Dexraflow — Catch the deals your GTM tools silently dropped";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-dx-surface font-dx-sans text-dx-ink antialiased [overflow-x:clip] selection:bg-dx-brand-soft">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[8px] focus:bg-dx-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <Nav onAccess={openAccess} onAudit={openFounder} />
      <main id="main">
        <Hero onAudit={openFounder} />
        <Problem />
        <BigNumbers />
        <UseCases onAudit={openFounder} onAccess={openAccess} />
        <Insights />
        <HeardOnX />
        <How onAudit={openFounder} />
        <Closing onAccess={openAccess} onFounder={openFounder} />
      </main>
      <Footer />
      <AccessRequestModal intent={intent} onOpenChange={(open) => !open && setIntent(null)} />
    </div>
  );
};

export default Landing;
