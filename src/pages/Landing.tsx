import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import AccessRequestModal from "@/components/stealth/AccessRequestModal";
import ComplaintWall from "@/components/landing/ComplaintWall";
import { BrandIcon, MissedSignalScene, NoOwnerScene, SilentFailureScene, useStage } from "@/components/landing/UseCaseAnimations";
import { AskScene, CheckScene, HumanFixScene, LogScene, OpenDealScene, TwoAgentsScene, WithoutWith } from "@/components/landing/McpAnimations";
import { ConnectBlock, LogoStrip, ToolsGrid, TrustStrip, useConnectTabs } from "@/components/landing/McpSection";
import { Chapter, Tile, WaveField, Wire, WiredRow } from "@/components/landing/bento/Bento";
import { EASE, FOCUS, PrimaryCTA, Reveal, SecondaryCTA } from "@/components/landing/primitives";
import { CONTACT_EMAIL } from "@/components/stealth/contact";
import type { AccessIntent } from "@/services/earlyAccessAPI";

/* The landing page as one connected story: six numbered chapters of bento tiles, joined
   by wave wires that pulse in sequence. Every number keeps its citation. */

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
  { name: "HubSpot", k: "hubspot", role: "CRM" },
  { name: "Clay", k: "clay", role: "Enrichment" },
  { name: "Apollo", role: "Data" },
  { name: "Outreach", k: "outreach", role: "Sequences" },
  { name: "Gong", k: "gong", role: "Calls" },
  { name: "Slack", k: "slack", role: "Where reps live" },
];

const STATS: { value: string; text: string; cite: SourceId }[] = [
  { value: "80%", text: "of RevOps leaders don't feel they have clean, actionable data. Only 2 in 10 do.", cite: 1 },
  { value: "37%", text: "of CRM users reported losing revenue as a direct result of poor data quality.", cite: 2 },
  { value: "10", text: "tools used, on average, to close a deal", cite: 3 },
];

const SPEED: { value: string; text: string; cite: SourceId }[] = [
  { value: "42 hrs", text: "average time for a company to first respond to an inbound lead", cite: 4 },
  { value: "7×", text: "more likely to qualify a lead when you reach out within the hour", cite: 4 },
  { value: "23%", text: "of companies never responded to the lead at all", cite: 4 },
];

const AGENTS_STATS: { value: string; text: string; cite: SourceId }[] = [
  { value: "10:1", text: "AI agents to sellers by 2028, Gartner predicts", cite: 5 },
  { value: "<40%", text: "of sellers will say those agents actually improved productivity", cite: 5 },
];

const X_POSTS: { name: string; handle: string; date: string; tag: string; quote: string; id: string }[] = [
  { name: "Tech Sales Guy", handle: "TechSalesGuy", date: "Sep 2026", tag: "No owner", quote: "the leads just sat.... and sat there. no owner. no task. no follow up", id: "2102557390440689959" },
  { name: "Joshua Pi'Rwot", handle: "pirwot", date: "Sep 2026", tag: "Silent failure", quote: "an automation … had been quietly doing nothing for eleven days. It ran on schedule. The dashboard was green. … It failed politely.", id: "2100906487312744726" },
  { name: "Alton Syn", handle: "WorkflowWhisper", date: "Apr 2026", tag: "Routing", quote: "a client's lead routing was broken for 6 weeks before they called me … 23 deals routed to a dead inbox. $140k in pipeline gone", id: "2039742868185854146" },
  { name: "Jack", handle: "JackPineRD", date: "Oct 2026", tag: "Handoff", quote: "I've seen solid outbound and content still dump leads into HubSpot with source overwritten and no owner. The gap was the handoff.", id: "2109711708252262883" },
  { name: "Keith", handle: "keithsalins_", date: "Jul 2026", tag: "Broken workflows", quote: "someone set up a Clay workflow in January / it broke in February, nobody fixed it / 14 Zapier automations that nobody documented", id: "2082126440775217350" },
  { name: "Jason Lemkin", handle: "jasonlk", date: "Oct 2026", tag: "AI agents", quote: "Never let your AI SDR send its first 1,000 emails without manually reviewing every single one.", id: "2109289938692784499" },
];

const INSIGHTS = [
  { title: "It's not too many tools. It's tools that disagree.", body: "CRM, billing and support each keep their own record, so one customer shows up three different ways. The most repeated pain in every community we studied." },
  { title: "Routing rules rot.", body: "Inherited CRMs run routing rules written years ago and patched over and over. It was called “by far the biggest gap”." },
  { title: "AI agents make bad data louder.", body: "If the CRM has duplicates or stale fields, an agent writes confident updates on top of them. Teams hesitate to give agents write access for this reason." },
];

const STEPS = [
  { n: "1", title: "Connect", body: "Read-only access to your CRM and GTM tools. Setup takes minutes, not a project." },
  { n: "2", title: "Match", body: "One record per account and contact across every tool, so signals and owners line up." },
  { n: "3", title: "Catch", body: "Leads with no owner, workflows that say success but wrote nothing, and buying signals nobody acted on." },
  { n: "4", title: "Alert & prove", body: "The right rep gets it in Slack with the reason and a deadline. You get a weekly report of pipeline recovered." },
];

/* ───────────────────────── chrome ───────────────────────── */

const Wordmark = ({ reversed = false, className = "h-7" }: { reversed?: boolean; className?: string }) => (
  <img src={reversed ? "/brand/dexraflow-lockup-reversed.svg" : "/brand/dexraflow-lockup.svg"} alt="Dexraflow" width={137} height={28} className={`w-auto ${className}`} />
);

const AcceleratorBadge = ({ onBrand = false }: { onBrand?: boolean }) => {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <span className={`inline-flex items-center gap-2.5 rounded-[8px] border py-1.5 pl-3 pr-3.5 text-[13px] font-medium ${onBrand ? "border-white/25 text-white/85" : "border-dx-line bg-dx-raised text-dx-ink-muted"}`}>
      <span>Accelerated by</span>
      {logoOk ? <img src="/brand/draperu-india.png" alt="DraperU India" className="h-5 w-auto" onError={() => setLogoOk(false)} /> : <span className={`font-semibold ${onBrand ? "text-white" : "text-dx-ink"}`}>DraperU India</span>}
    </span>
  );
};

const NAV_LINKS = [
  { href: "#stack", label: "Your stack" },
  { href: "#slips", label: "Where leads slip" },
  { href: "#catch", label: "How it works" },
  { href: "#mcp", label: "MCP" },
  { href: "#start", label: "Start here" },
];

const Nav = ({ onAccess, onAudit }: { onAccess: () => void; onAudit: () => void }) => (
  <header className="fixed inset-x-0 top-0 z-50">
    <div className="bg-dx-ink text-dx-night-ink">
      <button type="button" onClick={onAudit} className="group mx-auto flex h-10 w-full max-w-7xl items-center justify-center gap-2 px-5 text-[13px] font-medium sm:text-[14px]">
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
        <button type="button" onClick={onAccess} className={`h-9 rounded-[8px] bg-dx-brand px-3.5 text-[14px] font-medium text-white transition hover:bg-dx-brand-hover ${FOCUS}`}>
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
  const enter = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: 0.1 + i * 0.08, ease: EASE } });
  return (
    <section className="mx-auto max-w-6xl px-5 pt-36 sm:px-8 md:pt-40" aria-labelledby="hero-title">
      <div className="grid gap-3 lg:grid-cols-12">
        <Tile className="relative overflow-hidden lg:col-span-7" pad={false}>
          <WaveField className="opacity-70 [mask-image:linear-gradient(to_bottom,transparent,black_35%)]" />
          <div className="relative p-6 sm:p-9">
            <motion.div {...enter(0)}>
              <AcceleratorBadge />
            </motion.div>
            <motion.h1 id="hero-title" {...enter(1)} className="mt-6 max-w-2xl text-[40px] font-semibold leading-[1.04] tracking-[-0.025em] text-dx-ink sm:text-[54px] sm:leading-[58px]">
              Your GTM tools are dropping deals. <span className="text-dx-ink-muted">Silently.</span>
            </motion.h1>
            <motion.p {...enter(2)} className="mt-5 max-w-[560px] text-[17px] leading-[27px] text-dx-ink-muted">
              Dexraflow connects to the tools you already use, catches the leads and deals that slip between them, and tells the right rep in Slack before they go cold.
            </motion.p>
            <motion.div {...enter(3)} className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <a href="#slips" className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-dx-line-strong bg-dx-raised px-4 text-[14px] font-medium text-dx-ink transition hover:bg-dx-surface ${FOCUS}`}>
                See how it works
              </a>
              <PrimaryCTA onClick={onAudit}>Book a 14-day audit</PrimaryCTA>
            </motion.div>
            <motion.p {...enter(4)} className="mt-8 text-[13px] text-dx-ink-muted">
              Built from 1,300+ RevOps community conversations. Real posts shown here, names blurred.
            </motion.p>
          </div>
        </Tile>
        <Tile className="overflow-hidden lg:col-span-5" pad={false}>
          <div className="flex items-center gap-3 border-b border-dx-line px-4 py-3">
            <span className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full bg-dx-line" />
              ))}
            </span>
            <span className="font-dx-mono text-[12px] text-dx-ink"># revops-community</span>
            <span className="ml-auto font-dx-mono text-[11px] text-dx-ink-muted">real posts · names blurred</span>
          </div>
          <div className="bg-dx-night">
            <ComplaintWall className="h-[400px] px-3 sm:h-[480px] lg:h-full lg:min-h-[520px]" />
          </div>
        </Tile>
      </div>
    </section>
  );
};

/* ───────────────────────── 01 · your stack ───────────────────────── */

const StackChapter = () => {
  const { ref, stage } = useStage(STACK.length, 900);
  return (
    <Chapter id="stack" n="01" label="Your stack" title="Every tool does its job." muted="Nobody watches the gaps between them." intro="A lead moves through six tools before a rep sees it. Each hop is a place to slip.">
      <div ref={ref}>
        <WiredRow
          step={stage}
          items={STACK.map((t, i) => (
            <Tile key={t.name} active={stage === i} className="flex items-center gap-3 !p-4">
              {t.k ? <BrandIcon k={t.k} size={22} /> : <span aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] bg-dx-sunken font-dx-mono text-[12px] text-dx-ink-muted">{t.name[0]}</span>}
              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-tight text-dx-ink">{t.name}</p>
                <p className="text-[12px] text-dx-ink-muted">{t.role}</p>
              </div>
            </Tile>
          ))}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {STATS.map((s) => (
          <Tile key={s.value}>
            <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-dx-ink">{s.value}</p>
            <p className="mt-3 text-[14px] leading-relaxed text-dx-ink-muted">
              {s.text}
              <Cite n={s.cite} />
            </p>
          </Tile>
        ))}
      </div>
    </Chapter>
  );
};

/* ───────────────────────── 02 · where leads slip ───────────────────────── */

const QuoteTile = ({ p }: { p: (typeof X_POSTS)[number] }) => (
  <Tile as="a" href={`https://x.com/${p.handle}/status/${p.id}`} target="_blank" rel="noopener noreferrer" className="group flex h-full flex-col !p-4 transition hover:border-dx-line-strong">
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dx-sunken text-[12px] font-semibold text-dx-ink">{p.name.charAt(0)}</span>
        <p className="truncate text-[13px] font-semibold text-dx-ink">
          {p.name} <span className="font-normal text-dx-ink-muted">@{p.handle}</span>
        </p>
      </div>
      <span className="shrink-0 rounded-[4px] border border-dx-brand/20 bg-dx-brand-soft px-1.5 py-0.5 font-dx-mono text-[11px] text-dx-brand">{p.tag}</span>
    </div>
    <blockquote className="mt-3 flex-1 text-[14px] leading-relaxed text-dx-ink">“{p.quote}”</blockquote>
    <p className="mt-3 inline-flex items-center gap-1 text-[12px] text-dx-ink-muted transition group-hover:text-dx-ink">
      {p.date} · View on X <ArrowUpRight className="h-3.5 w-3.5" />
    </p>
  </Tile>
);

const SlipsChapter = () => {
  const { ref, stage } = useStage(3, 7000);
  const rows = [
    { tag: "No owner", title: "A hot lead nobody owns", Scene: NoOwnerScene, post: X_POSTS[0], insight: INSIGHTS[1] },
    { tag: "Silent failure", title: "A workflow that says “success”", Scene: SilentFailureScene, post: X_POSTS[1], insight: INSIGHTS[0] },
    { tag: "Missed signal", title: "A buying signal nobody acted on", Scene: MissedSignalScene, post: X_POSTS[2], insight: INSIGHTS[2] },
  ];
  return (
    <Chapter id="slips" n="02" label="Where leads slip" title="Three failures every stack has." muted="They never throw an error." intro="Illustrative scenes, built from failures RevOps teams have described to us, next to what operators say in public.">
      <div ref={ref} className="grid gap-2">
        {rows.map((c, i) => (
          <div key={c.tag} className="contents">
            <div className="grid gap-3 lg:grid-cols-12">
              <Tile active={stage === i} className="!p-4 lg:col-span-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-[4px] border border-dx-brand/20 bg-dx-brand-soft px-2 py-0.5 text-[12px] font-medium text-dx-brand">{c.tag}</span>
                  <h3 className="text-[15px] font-semibold text-dx-ink">{c.title}</h3>
                </div>
                <c.Scene />
              </Tile>
              <div className="lg:col-span-3">
                <QuoteTile p={c.post} />
              </div>
              <Tile className="!p-4 lg:col-span-3">
                <p className="font-dx-mono text-[11px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">What we learned</p>
                <h4 className="mt-2 text-[15px] font-semibold leading-snug text-dx-ink">{c.insight.title}</h4>
                <p className="mt-2 text-[13px] leading-relaxed text-dx-ink-muted">{c.insight.body}</p>
              </Tile>
            </div>
            {i < rows.length - 1 && <Wire vertical on={stage > i} pulse={stage === i} />}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-dx-ink-muted">Public posts on X, quoted in part with links to the originals. The authors are not Dexraflow customers and have not endorsed Dexraflow. Product names identify tools we connect to; trademarks belong to their owners.</p>
    </Chapter>
  );
};

/* ───────────────────────── 03 · the cost ───────────────────────── */

const NumbersChapter = () => {
  const { ref, stage } = useStage(3, 1600);
  return (
    <Chapter id="numbers" n="03" label="The cost" title="Every hour a lead waits," muted="the deal gets colder." intro="More tools and more AI agents mean more places for leads to slip, and nobody checking the gaps.">
      <div ref={ref}>
        <WiredRow
          step={stage}
          items={SPEED.map((s, i) => (
            <Tile key={s.value} dark active={stage === i}>
              <p className="text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-dx-night-ink">{s.value}</p>
              <p className="mt-3 text-[14px] leading-relaxed text-dx-night-ink-muted">
                {s.text}
                <Cite n={s.cite} dark />
              </p>
            </Tile>
          ))}
        />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-12">
        {AGENTS_STATS.map((s) => (
          <Tile key={s.value} dark className="lg:col-span-3">
            <p className="font-dx-mono text-[11px] font-medium uppercase tracking-[0.08em] text-dx-night-ink-muted">Agents multiply it</p>
            <p className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-dx-night-ink">{s.value}</p>
            <p className="mt-3 text-[14px] leading-relaxed text-dx-night-ink-muted">
              {s.text}
              <Cite n={s.cite} dark />
            </p>
          </Tile>
        ))}
        {X_POSTS.slice(3).map((p) => (
          <div key={p.id} className="lg:col-span-2">
            <QuoteTile p={p} />
          </div>
        ))}
      </div>
    </Chapter>
  );
};

/* ───────────────────────── 04 · dexraflow catches it ───────────────────────── */

const CatchChapter = ({ onAudit }: { onAudit: () => void }) => {
  const { ref, stage } = useStage(STEPS.length, 1500);
  return (
    <Chapter id="catch" n="04" label="How it works" title="Connect your tools." muted="We catch what slips." intro="No new tool to learn and nothing to replace. Read-only by default; alerts arrive in Slack.">
      <div ref={ref}>
        <WiredRow
          step={stage}
          items={STEPS.map((s, i) => (
            <Tile key={s.title} active={stage === i}>
              <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-dx-brand-soft font-dx-mono text-[13px] font-medium text-dx-brand">{s.n}</span>
              <h3 className="mt-4 text-[17px] font-semibold text-dx-ink">{s.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-dx-ink-muted">{s.body}</p>
            </Tile>
          ))}
        />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-12">
        <Tile className="overflow-hidden lg:col-span-7" pad={false}>
          <img src="/brand/plane-diagram.svg" alt="Diagram: Dexraflow as one bar sitting above six GTM tools, with a single alert moving down to one of them." width={1200} height={630} loading="lazy" decoding="async" className="block h-auto w-full" />
        </Tile>
        <div className="grid gap-3 lg:col-span-5">
          <Tile label="What a rep sees">
            <div className="flex items-start gap-2.5 rounded-[8px] border border-dx-line bg-dx-surface px-3 py-2.5">
              <BrandIcon k="slack" size={18} />
              <div className="min-w-0 text-[13px] leading-snug text-dx-ink">
                <p className="font-semibold">
                  Dexraflow <span className="font-normal text-dx-ink-muted">→ Sam</span>
                </p>
                <p className="mt-0.5">Acme Inc asked for pricing twice this week. Owner out of office. Reply by 3pm?</p>
              </div>
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-dx-brand" strokeWidth={1.5} aria-hidden="true" />
            </div>
          </Tile>
          <Tile label="Safe by default">
            <ul className="grid gap-2 text-[14px] text-dx-ink">
              {["Read-only by default", "Writes only 10 essential fields", "Every change logged"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-dx-brand" strokeWidth={1.5} aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <SecondaryCTA onClick={onAudit}>Book an audit</SecondaryCTA>
            </div>
          </Tile>
        </div>
      </div>
    </Chapter>
  );
};

/* ───────────────────────── 05 · agents ask first ───────────────────────── */

const McpChapter = ({ onAccess }: { onAccess: () => void }) => {
  const { tab, setTab, connectRef, goConnect } = useConnectTabs();
  const { ref, stage } = useStage(3, 2200);
  const { ref: ref2, stage: stage2 } = useStage(3, 7000);
  const moves = [
    { t: "Agent asks", Scene: AskScene },
    { t: "Dexraflow checks every tool", Scene: CheckScene },
    { t: "Decision is logged", Scene: LogScene },
  ];
  return (
    <Chapter id="mcp" n="05" label="Dexraflow MCP · Early access" title="Let AI agents into your CRM," muted="without the chaos." intro="Any agent asks Dexraflow before it acts. Dexraflow checks every tool, then says go, hold, or stop.">
      <div className="grid gap-3 lg:grid-cols-12">
        <Tile className="lg:col-span-7 lg:self-start" label="Without vs with Dexraflow">
          <WithoutWith />
        </Tile>
        <div ref={ref} className="grid gap-2 lg:col-span-5">
          {moves.map((m, i) => (
            <div key={m.t} className="contents">
              <Tile active={stage === i} className="!p-4">
                <p className="mb-3 text-[15px] font-semibold text-dx-ink">{m.t}</p>
                <m.Scene />
              </Tile>
              {i < moves.length - 1 && <Wire vertical on={stage > i} pulse={stage === i} />}
            </div>
          ))}
        </div>
      </div>

      <div ref={connectRef} className="mt-3 grid scroll-mt-32 gap-3 lg:grid-cols-12">
        <Tile className="lg:col-span-8" label="Connect any agent · Preview">
          <ConnectBlock tab={tab} setTab={setTab} />
        </Tile>
        <div className="grid gap-3 lg:col-span-4">
          <Tile label="Get your key">
            <p className="text-[15px] text-dx-ink">Join early access to get a workspace and API key.</p>
            <div className="mt-4">
              <PrimaryCTA onClick={onAccess}>Get early access</PrimaryCTA>
            </div>
          </Tile>
          <Tile label="What your agent gets">
            <ToolsGrid single />
          </Tile>
        </div>
      </div>

      <Tile className="mt-3" label="Works with any agent">
        <LogoStrip onPick={goConnect} />
      </Tile>

      <div ref={ref2} className="mt-3 lg:-ml-24">
        <WiredRow
          narrow
          step={stage2}
          items={[
            { t: "Don't email during an open deal", Scene: OpenDealScene },
            { t: "Don't overwrite what a human fixed", Scene: HumanFixScene },
            { t: "Two agents, one account", Scene: TwoAgentsScene },
          ].map((c, i) => (
            <Tile key={c.t} active={stage2 === i} className="!p-3">
              <h3 className="mb-2 px-1 text-[15px] font-semibold text-dx-ink">{c.t}</h3>
              <c.Scene />
            </Tile>
          ))}
        />
      </div>

      <Tile className="mt-3">
        <TrustStrip />
        <p className="mt-3 text-[13px] text-dx-ink-muted">Dexraflow never sends emails or acts on its own. It only informs, allows, holds or logs.</p>
      </Tile>
    </Chapter>
  );
};

/* ───────────────────────── 06 · start here ───────────────────────── */

const StartChapter = ({ onAccess, onFounder }: { onAccess: () => void; onFounder: () => void }) => (
  <Chapter id="start" n="06" label="Start here" title="Seen a deal slip" muted="through your stack?" intro="We're working with a small group of B2B SaaS revenue teams running five or more GTM tools.">
    <div className="grid gap-3 lg:grid-cols-12">
      <Tile dark className="lg:col-span-7">
        <p className="font-dx-mono text-[11px] font-medium uppercase tracking-[0.08em] text-dx-night-ink-muted">The 14-day Missed Pipeline Audit</p>
        <h3 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-dx-night-ink sm:text-[30px]">Find $10K of missed pipeline, or you don't pay.</h3>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-dx-night-ink-muted">
          Connect your tools read-only. We look back 90 days and show you the high-intent accounts nobody worked, leads routed to the wrong owner or no owner, and workflows that failed silently, with what each one was worth.
        </p>
        <div className="mt-6">
          <button type="button" onClick={onFounder} className={`group inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-dx-night-ink px-4 text-[14px] font-medium text-dx-ink transition hover:bg-white ${FOCUS} focus-visible:ring-dx-brand-night focus-visible:ring-offset-dx-night`}>
            Book my audit
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
          </button>
        </div>
      </Tile>
      <Tile className="flex flex-col lg:col-span-5">
        <div>
          <AcceleratorBadge />
        </div>
        <h3 className="mt-5 text-[22px] font-semibold leading-snug tracking-[-0.02em] text-dx-ink">
          Built from conversations, <span className="text-dx-ink-muted">not assumptions.</span>
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-dx-ink-muted">Tell us what slipped, and we'll show you where else it's happening.</p>
        <div className="mt-auto flex flex-col gap-2.5 pt-6 sm:flex-row">
          <PrimaryCTA onClick={onAccess}>Request early access</PrimaryCTA>
          <SecondaryCTA onClick={onFounder}>
            Talk to the founder <ArrowUpRight className="h-4 w-4 opacity-60" />
          </SecondaryCTA>
        </div>
      </Tile>
    </div>
  </Chapter>
);

/* ───────────────────────── footer ───────────────────────── */

const Footer = () => (
  <footer className="mt-24 border-t border-dx-line bg-dx-raised px-5 pb-10 pt-14 sm:px-8">
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
        Community quotes are real posts from public channels of a RevOps practitioner Slack community. Names, photos and mentions are blurred; highlights are ours. Insights summarize our own research and are not statistics.
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
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[8px] focus:bg-dx-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white">
        Skip to content
      </a>
      <Nav onAccess={openAccess} onAudit={openFounder} />
      <main id="main">
        <Hero onAudit={openFounder} />
        <div className="mx-auto max-w-6xl space-y-20 px-5 pt-20 sm:px-8 md:space-y-28 md:pt-28">
          <Reveal>
            <StackChapter />
          </Reveal>
          <Reveal>
            <SlipsChapter />
          </Reveal>
          <Reveal>
            <NumbersChapter />
          </Reveal>
          <Reveal>
            <CatchChapter onAudit={openFounder} />
          </Reveal>
          <Reveal>
            <McpChapter onAccess={openAccess} />
          </Reveal>
          <Reveal>
            <StartChapter onAccess={openAccess} onFounder={openFounder} />
          </Reveal>
        </div>
      </main>
      <Footer />
      <AccessRequestModal intent={intent} onOpenChange={(open) => !open && setIntent(null)} />
    </div>
  );
};

export default Landing;
