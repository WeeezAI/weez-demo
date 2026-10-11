import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import AccessRequestModal from "@/components/stealth/AccessRequestModal";
import ComplaintWall from "@/components/landing/ComplaintWall";
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
] as const;

const Cite = ({ n }: { n: 1 | 2 | 3 }) => (
  <a
    href="#sources"
    aria-label={`Source ${n}`}
    className="ml-0.5 align-super text-[10px] font-medium text-neutral-400 transition hover:text-neutral-900"
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

const DexraMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <g fill="currentColor">
      <circle cx="5" cy="5" r="2.2" />
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="19" cy="5" r="2.2" />
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="5" cy="19" r="2.2" />
    </g>
  </svg>
);

const Wordmark = () => (
  <span className="flex items-center gap-2">
    <DexraMark className="h-4 w-4 text-[#F26B3A]" />
    <span className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">Dexraflow</span>
  </span>
);

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#F26B3A]">{children}</p>
);

const PrimaryCTA = ({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-950 px-5 text-[15px] font-medium text-white shadow-sm transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B3A]/50 focus-visible:ring-offset-2 ${className}`}
  >
    {children}
    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
  </button>
);

const SecondaryCTA = ({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-5 text-[15px] font-medium text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B3A]/50 focus-visible:ring-offset-2 ${className}`}
  >
    {children}
  </button>
);

/**
 * "Accelerated by DraperU India" badge.
 * Drop the official logo at public/brand/draperu-india.png and it is used automatically;
 * until then the badge shows the name as text.
 */
const AcceleratorBadge = () => {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white py-1.5 pl-3 pr-4 text-[13px] text-neutral-600 shadow-sm">
      <span>Accelerated by</span>
      {logoOk ? (
        <img
          src="/brand/draperu-india.png"
          alt="DraperU India"
          className="h-5 w-auto"
          onError={() => setLogoOk(false)}
        />
      ) : (
        <span className="font-semibold text-neutral-950">DraperU India</span>
      )}
    </span>
  );
};

/* ───────────────────────── nav ───────────────────────── */

const NAV_LINKS = [
  { href: "#problem", label: "The problem" },
  { href: "#insights", label: "Insights" },
  { href: "#how", label: "How it works" },
];

const Nav = ({ onAccess }: { onAccess: () => void }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300 ${
        scrolled ? "border-b border-neutral-200 bg-white/85 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Primary">
        <Link to="/" aria-label="Dexraflow home" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26B3A]/50">
          <Wordmark />
        </Link>
        <div className="hidden items-center gap-8 text-[14px] text-neutral-600 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-neutral-950">
              {l.label}
            </a>
          ))}
        </div>
        <button
          type="button"
          onClick={onAccess}
          className="h-9 rounded-lg bg-neutral-950 px-4 text-[13px] font-medium text-white transition hover:bg-neutral-800"
        >
          <span className="sm:hidden">Early access</span>
          <span className="hidden sm:inline">Request early access</span>
        </button>
      </nav>
    </header>
  );
};

/* ───────────────────────── hero ───────────────────────── */

const Hero = ({ onAccess, onAudit }: { onAccess: () => void; onAudit: () => void }) => {
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
    <section className="relative isolate overflow-hidden xl:min-h-[100svh]" aria-labelledby="hero-title">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(rgba(10,10,10,0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(60%_60%_at_30%_30%,black,transparent)]"
      />
      <div className="relative mx-auto flex max-w-7xl flex-col px-5 pt-28 sm:px-8 md:pt-36 xl:min-h-[100svh] xl:justify-center xl:pb-24 xl:pt-24">
        <div className="relative z-10 max-w-[600px]">
          <motion.div {...enter(0)}>
            <AcceleratorBadge />
          </motion.div>

          <motion.h1
            id="hero-title"
            {...enter(1)}
            className="mt-7 text-[46px] font-semibold leading-[1.0] tracking-[-0.045em] text-neutral-950 sm:text-[64px] lg:text-[76px]"
          >
            We heard you.
            <br />
            <span className="text-neutral-400">Loud and clear.</span>
          </motion.h1>

          <motion.p {...enter(2)} className="mt-6 max-w-[540px] text-[18px] leading-relaxed text-neutral-600">
            <strong className="font-semibold text-neutral-900">8 in 10 RevOps leaders</strong> don't feel they have clean,
            actionable data.
            <Cite n={1} /> Your tools disagree on who the customer is, so high-intent accounts get spotted too late. Dexraflow
            helps revenue teams <strong className="font-semibold text-neutral-900">recover the pipeline they already own.</strong>
          </motion.p>

          <motion.div {...enter(3)} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PrimaryCTA onClick={onAccess}>Request early access</PrimaryCTA>
            <SecondaryCTA onClick={onAudit}>Get a free pipeline audit</SecondaryCTA>
          </motion.div>

          <motion.p {...enter(4)} className="mt-6 text-[13px] text-neutral-500">
            Built from 1,300+ RevOps community conversations. Real posts shown here, names blurred.
          </motion.p>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: EASE }}
          className="relative mb-12 mt-12 h-[440px] sm:h-[520px] xl:absolute xl:bottom-0 xl:left-[52%] xl:right-[min(0px,calc(640px-50vw))] xl:top-20 xl:mb-0 xl:mt-0 xl:h-auto"
        >
          <ComplaintWall className="h-full" />
        </motion.div>
      </div>
    </section>
  );
};

/* ───────────────────────── problem in numbers ───────────────────────── */

const STATS: { value: string; text: ReactNode; cite: 1 | 2 | 3 }[] = [
  { value: "80%", text: "of RevOps leaders don't feel they have clean, actionable data. Only 2 in 10 do.", cite: 1 },
  { value: "76%", text: "say less than half of their CRM data is accurate and complete.", cite: 2 },
  { value: "37%", text: "of CRM users reported losing revenue as a direct result of poor data quality.", cite: 2 },
  { value: "28%", text: "of a sales rep's week is spent actually selling. Much of the rest goes to admin and data entry.", cite: 3 },
];

const Problem = () => (
  <section id="problem" className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50/70 px-5 py-24 sm:px-8 md:py-32" aria-labelledby="problem-title">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <Eyebrow>The problem</Eyebrow>
        <h2 id="problem-title" className="mt-4 max-w-3xl text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-neutral-950 sm:text-[46px]">
          Your GTM stack is full of signals. Nobody trusts them enough to act.
        </h2>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-neutral-600">
          Intent, enrichment, CRM and sequencer data each hold part of the picture. They rarely agree, so the right account reaches
          the right rep late, or never.
        </p>
      </Reveal>

      <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.value} delay={i * 0.06}>
            <div className="h-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
              <p className="text-[38px] font-semibold leading-none tracking-[-0.04em] text-neutral-950 sm:text-[52px]">{s.value}</p>
              <p className="mt-3 text-[14px] leading-relaxed text-neutral-600 sm:mt-4 sm:text-[15px]">
                {s.text}
                <Cite n={s.cite} />
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <div className="h-full rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
            <p className="text-[15px] font-semibold text-neutral-950">
              The perception gap
              <Cite n={1} />
            </p>
            <p className="mt-1 text-[14px] text-neutral-500">"Our data is clean": who agrees?</p>
            <div className="mt-6 space-y-5">
              {[
                { who: "CROs", pct: 50, tone: "bg-neutral-300" },
                { who: "RevOps leaders", pct: 20, tone: "bg-[#F26B3A]" },
              ].map((r) => (
                <div key={r.who}>
                  <div className="flex justify-between text-[14px]">
                    <span className="text-neutral-700">{r.who}</span>
                    <span className="font-semibold tabular-nums text-neutral-950">{r.pct}%</span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-neutral-100">
                    <div className={`h-2.5 rounded-full ${r.tone}`} style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[14px] leading-relaxed text-neutral-600">
              Leadership thinks the data is fine. The people who run the systems know it isn't.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <div className="h-full rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
            <p className="text-[15px] font-semibold text-neutral-950">
              Tool overload
              <Cite n={3} />
            </p>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-neutral-950">10</p>
                <p className="mt-2 text-[14px] text-neutral-600">tools used, on average, to close a deal</p>
              </div>
              <div>
                <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-neutral-950">66%</p>
                <p className="mt-2 text-[14px] text-neutral-600">of reps feel overwhelmed by their tools</p>
              </div>
            </div>
            <p className="mt-6 text-[14px] leading-relaxed text-neutral-600">
              More tools didn't create more pipeline. It created more places for pipeline to hide.
            </p>
          </div>
        </Reveal>
      </div>
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
  <section id="insights" className="scroll-mt-20 px-5 py-24 sm:px-8 md:py-32" aria-labelledby="insights-title">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <Eyebrow>What we learned</Eyebrow>
        <h2 id="insights-title" className="mt-4 max-w-3xl text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-neutral-950 sm:text-[46px]">
          Six things every revenue leader should know
        </h2>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-neutral-600">
          From 1,300+ posts across two RevOps practitioner communities and 148 CRO Club articles on revenue and sales operations.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
        {INSIGHTS.map((it, i) => (
          <Reveal key={it.title} delay={(i % 3) * 0.05} className="bg-white">
            <div className="h-full p-7">
              <span className="font-geist-mono text-[12px] text-[#F26B3A]">0{i + 1}</span>
              <h3 className="mt-3 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-neutral-950">{it.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">{it.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ───────────────────────── how it works ───────────────────────── */

const STEPS = [
  { n: "1", title: "Match", body: "Every signal is matched to the right account and contacts across your CRM, enrichment and sequencer, with a confidence score." },
  { n: "2", title: "Prioritize", body: "Accounts are ranked by fit, intent and relationship status, with a plain-English reason for each one." },
  { n: "3", title: "Route", body: "The right rep gets it in Slack with the evidence and a response-time target. If nobody acts, it escalates." },
  { n: "4", title: "Prove", body: "Every alert is tracked to meeting, opportunity and pipeline. Leadership gets a weekly recovered-pipeline report." },
];

const TOOLS = ["HubSpot", "Salesforce", "Slack", "Apollo", "Outreach", "Salesloft", "Clay"];

const How = ({ onAudit }: { onAudit: () => void }) => (
  <section id="how" className="scroll-mt-20 border-t border-neutral-200 bg-neutral-50/70 px-5 py-24 sm:px-8 md:py-32" aria-labelledby="how-title">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <Eyebrow>What we're building</Eyebrow>
        <h2 id="how-title" className="mt-4 max-w-3xl text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-neutral-950 sm:text-[46px]">
          Recover pipeline you already own.
        </h2>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-neutral-600">
          We don't replace your tools or sell you more data. We make the tools you already pay for agree, and make sure someone acts.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.06}>
            <div className="h-full rounded-2xl border border-neutral-200 bg-white p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-[13px] font-semibold text-white">{s.n}</span>
              <h3 className="mt-5 text-[18px] font-semibold text-neutral-950">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-10 flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <ul className="grid gap-3 text-[15px] text-neutral-700 sm:grid-cols-3 lg:gap-8">
          {["Read-only by default", "Writes only 10 essential fields", "Every change logged"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[#F26B3A]" /> {t}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {TOOLS.map((t) => (
            <span key={t} className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[13px] text-neutral-600">
              {t}
            </span>
          ))}
        </div>
      </Reveal>

      {/* Audit offer */}
      <Reveal className="mt-4">
        <div className="relative overflow-hidden rounded-2xl bg-neutral-950 p-8 text-white sm:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#F26B3A]/25 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1.5fr_1fr] md:items-end">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#F7A27F]">Free for design partners</p>
              <h3 className="mt-4 text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">The Missed Pipeline Audit</h3>
              <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-white/70">
                We look back 90 days, read-only, and show you the high-intent accounts that never got worked, the ones routed to the
                wrong owner, and the duplicates hiding them.
              </p>
            </div>
            <div className="md:justify-self-end">
              <button
                type="button"
                onClick={onAudit}
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 text-[15px] font-medium text-neutral-950 transition hover:bg-neutral-100 sm:w-auto"
              >
                Book my audit
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
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
    <Reveal className="mx-auto max-w-3xl text-center">
      <div className="flex justify-center">
        <AcceleratorBadge />
      </div>
      <h2 id="closing-title" className="mt-8 text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] text-neutral-950 sm:text-[46px]">
        Built from conversations, not assumptions.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-neutral-600">
        We're working with a small group of Series A–C revenue teams. If good accounts slip through your stack, we'd like to hear
        how.
      </p>
      <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
        <PrimaryCTA onClick={onAccess}>Request early access</PrimaryCTA>
        <SecondaryCTA onClick={onFounder}>
          Talk to the founder <ArrowUpRight className="h-4 w-4 opacity-60" />
        </SecondaryCTA>
      </div>
    </Reveal>
  </section>
);

const Footer = () => (
  <footer className="border-t border-neutral-200 px-5 pb-10 pt-14 sm:px-8">
    <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
      <div>
        <Wordmark />
        <p className="mt-3 text-[13px] text-neutral-500">Recover pipeline you already own.</p>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3 text-[13px] text-neutral-500">
        <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-neutral-950">
          {CONTACT_EMAIL}
        </a>
        <Link to="/privacy-policy" className="transition hover:text-neutral-950">
          Privacy
        </Link>
        <Link to="/terms-conditions" className="transition hover:text-neutral-950">
          Terms
        </Link>
        <Link to="/data-deletion" className="transition hover:text-neutral-950">
          Data deletion
        </Link>
      </nav>
    </div>

    <div id="sources" className="mx-auto mt-12 max-w-6xl scroll-mt-24 border-t border-neutral-200 pt-8">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Sources</p>
      <ol className="mt-3 space-y-1.5 text-[13px] text-neutral-500">
        {SOURCES.map((s) => (
          <li key={s.id}>
            [{s.id}]{" "}
            <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900">
              {s.label}
            </a>
          </li>
        ))}
      </ol>
      <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-neutral-400">
        Community quotes are real posts from public channels of a RevOps practitioner Slack community. Names, photos and mentions are
        blurred; highlights are ours. Insights summarize our own research and are not statistics.
      </p>
    </div>

    <div className="mx-auto mt-10 max-w-6xl text-[12px] text-neutral-400">© {new Date().getFullYear()} Dexraflow Inc.</div>
  </footer>
);

/* ───────────────────────── page ───────────────────────── */

const Landing = () => {
  const [intent, setIntent] = useState<AccessIntent | null>(null);
  const openAccess = () => setIntent("early-access");
  const openFounder = () => setIntent("founder-conversation");

  useEffect(() => {
    const prev = document.title;
    document.title = "Dexraflow — Recover pipeline you already own";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-white font-geist text-neutral-950 antialiased [overflow-x:clip] selection:bg-[#F26B3A]/20">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-neutral-950 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <Nav onAccess={openAccess} />
      <main id="main">
        <Hero onAccess={openAccess} onAudit={openFounder} />
        <Problem />
        <Insights />
        <How onAudit={openFounder} />
        <Closing onAccess={openAccess} onFounder={openFounder} />
      </main>
      <Footer />
      <AccessRequestModal intent={intent} onOpenChange={(open) => !open && setIntent(null)} />
    </div>
  );
};

export default Landing;
