import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, Check, ClipboardList, Copy, Eye, MailX, Scale } from "lucide-react";
import { BRAND_ICONS, BRAND_LOGOS } from "./brandIcons";
import { BrandIcon } from "./UseCaseAnimations";
import { AskScene, CheckScene, HumanFixScene, LogScene, OpenDealScene, RUNS, Terminal, TwoAgentsScene, WithoutWith } from "./McpAnimations";
import { Eyebrow, FOCUS, PrimaryCTA, Reveal, SecondaryCTA, SectionTitle } from "./primitives";

/* The Dexraflow MCP section: what it does, how it works, and how to connect an agent.
   Everything here is early access; every sign-up button goes to the existing flow. */

const ENDPOINT = "https://mcp.dexraflow.com/mcp";

/* ───────────── snippets (checked against each tool's current docs) ───────────── */

type TabId = "claude-code" | "claude-desktop" | "cursor" | "openai" | "langchain" | "n8n" | "any";
type Tab = { id: TabId; label: string; brand?: string; lang?: "bash" | "json" | "python"; code?: string };

const TABS: Tab[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    brand: "claude",
    lang: "bash",
    code: `claude mcp add --transport http dexraflow ${ENDPOINT} \\
  --header "Authorization: Bearer $DEXRAFLOW_API_KEY"`,
  },
  { id: "claude-desktop", label: "Claude Desktop / claude.ai", brand: "claude" },
  {
    id: "cursor",
    label: "Cursor",
    lang: "json",
    code: `{
  "mcpServers": {
    "dexraflow": {
      "url": "${ENDPOINT}",
      "headers": { "Authorization": "Bearer \${env:DEXRAFLOW_API_KEY}" }
    }
  }
}`,
  },
  {
    id: "openai",
    label: "OpenAI Agents SDK",
    lang: "python",
    code: `from agents import Agent, Runner
from agents.mcp import MCPServerStreamableHttp

async with MCPServerStreamableHttp(
    name="Dexraflow",
    params={
        "url": "${ENDPOINT}",
        "headers": {"Authorization": f"Bearer {DEXRAFLOW_API_KEY}"},
    },
) as dexraflow:
    sdr = Agent(
        name="AI SDR",
        instructions="Before any outreach or CRM write, call check_action and follow the decision.",
        mcp_servers=[dexraflow],
    )
    result = await Runner.run(sdr, "Follow up with jane@acme.com")`,
  },
  {
    id: "langchain",
    label: "LangChain / LangGraph",
    lang: "python",
    code: `from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "dexraflow": {
        "transport": "http",
        "url": "${ENDPOINT}",
        "headers": {"Authorization": f"Bearer {DEXRAFLOW_API_KEY}"},
    }
})
tools = await client.get_tools()`,
  },
  { id: "n8n", label: "n8n", brand: "n8n" },
  { id: "any", label: "Any MCP client" },
];

/** Minimal syntax colouring: strings, comments and keywords, nothing heavier. */
function highlight(code: string, lang: Tab["lang"]): ReactNode[] {
  const kw = lang === "python" ? /\b(from|import|async|with|as|await|def|return|True|False|None)\b/ : lang === "bash" ? /^(claude)\b|\b(mcp|add)\b/ : null;
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|#[^\n]*)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  const plain = (text: string) => {
    if (!kw) return text;
    return text.split(/(\s+|[(){}[\],=:])/).map((part) => (kw.test(part) ? <span key={k++} className="font-semibold text-dx-night-ink">{part}</span> : part));
  };
  for (const m of code.matchAll(re)) {
    out.push(<span key={k++}>{plain(code.slice(last, m.index))}</span>);
    const tok = m[0];
    out.push(
      <span key={k++} className={tok.startsWith("#") ? "text-dx-night-ink-muted" : "text-dx-brand-night"}>
        {tok}
      </span>,
    );
    last = (m.index ?? 0) + tok.length;
  }
  out.push(<span key={k++}>{plain(code.slice(last))}</span>);
  return out;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}
      className={`inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-dx-night-line px-2 font-dx-mono text-[11px] text-dx-night-ink-muted transition hover:border-dx-line-strong hover:text-dx-night-ink ${FOCUS} focus-visible:ring-dx-brand-night focus-visible:ring-offset-dx-night`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-dx-success-night" strokeWidth={2} aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}

function Window({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-dx-night-line bg-dx-night text-dx-night-ink">
      <div className="flex items-center gap-2 border-b border-dx-night-line px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-dx-night-line" />
          ))}
        </span>
        <span className="font-dx-mono text-[12px] text-dx-night-ink-muted">{title}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="rounded-[4px] border border-dx-night-line px-1.5 py-0.5 font-dx-mono text-[11px] uppercase tracking-[0.08em] text-dx-night-ink-muted">Preview: API may change</span>
          {action}
        </span>
      </div>
      {children}
    </div>
  );
}

/** A small mock of the Claude connector flow, instead of a code block. */
function ClaudeDesktopMock() {
  const steps = [
    { t: "Customize → Connectors", d: "Click + Add, then Add custom connector." },
    { t: "Paste the server URL", d: ENDPOINT },
    { t: "Add a request header", d: "Authorization: Bearer <your key>" },
  ];
  return (
    <ol className="space-y-2 p-3 sm:p-4">
      {steps.map((s, i) => (
        <li key={s.t} className="flex items-start gap-3 rounded-[6px] bg-dx-night-raised px-3 py-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-dx-brand font-dx-mono text-[12px] font-medium text-white">{i + 1}</span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-dx-night-ink">{s.t}</p>
            <p className="mt-0.5 break-all font-dx-mono text-[12px] text-dx-night-ink-muted">{s.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A small mock of the n8n MCP Client Tool node attached to an AI Agent node. */
function N8nMock() {
  const field = (k: string, v: string) => (
    <div key={k} className="flex items-center justify-between gap-3 border-t border-dx-night-line py-1.5 text-[12px]">
      <span className="text-dx-night-ink-muted">{k}</span>
      <span className="truncate font-dx-mono text-dx-night-ink">{v}</span>
    </div>
  );
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto_1.3fr] sm:items-center sm:p-4">
      <div className="rounded-[6px] border border-dx-night-line bg-dx-night-raised px-3 py-2.5">
        <p className="text-[13px] font-medium">AI Agent</p>
        <p className="text-[12px] text-dx-night-ink-muted">Tool input</p>
      </div>
      <span aria-hidden="true" className="mx-auto h-6 w-px bg-dx-brand-night sm:h-px sm:w-8" />
      <div className="rounded-[6px] border border-dx-brand-night/60 bg-dx-night-raised px-3 py-2.5">
        <div className="flex items-center gap-2">
          <BrandIcon k="n8n" size={16} />
          <p className="text-[13px] font-medium">MCP Client Tool</p>
        </div>
        <div className="mt-2">
          {field("Endpoint", ENDPOINT)}
          {field("Authentication", "Bearer Auth")}
          {field("Tools to include", "All")}
        </div>
      </div>
    </div>
  );
}

/* ───────────── logos ───────────── */

type Logo = { name: string; k?: string; tab?: TabId };
const LOGOS: Logo[] = [
  { name: "Claude", k: "claude", tab: "claude-code" },
  { name: "Cursor", tab: "cursor" },
  { name: "OpenAI", tab: "openai" },
  { name: "LangChain", tab: "langchain" },
  { name: "n8n", k: "n8n", tab: "n8n" },
  { name: "Make" },
  { name: "Zapier", k: "zapier" },
  { name: "Clay", k: "clay" },
  { name: "HubSpot", k: "hubspot" },
  { name: "Salesforce", k: "salesforce" },
  { name: "Slack", k: "slack" },
  { name: "Gong", k: "gong" },
  { name: "Outreach", k: "outreach" },
  { name: "Apollo" },
];
const hasMark = (k?: string) => !!k && (k in BRAND_ICONS || k in BRAND_LOGOS);

function LogoTile({ l, onPick }: { l: Logo; onPick?: () => void }) {
  const inner = (
    <>
      {hasMark(l.k) ? (
        <BrandIcon k={l.k!} size={18} />
      ) : (
        <span aria-hidden="true" className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-dx-sunken font-dx-mono text-[11px] font-medium text-dx-ink-muted">
          {l.name[0]}
        </span>
      )}
      <span className="whitespace-nowrap text-[13px] font-medium text-dx-ink">{l.name}</span>
    </>
  );
  const cls = "flex h-10 items-center gap-2 rounded-[8px] border border-dx-line bg-dx-raised px-3";
  return onPick ? (
    <button type="button" onClick={onPick} className={`${cls} transition hover:border-dx-brand ${FOCUS}`} aria-label={`${l.name}: see how to connect`}>
      {inner}
    </button>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

/* ───────────── tools ───────────── */

const TOOLS: { name: string; line: string; sample: string[] }[] = [
  { name: "get_account_context", line: "Who owns it, open deals, last touch, everywhere.", sample: ['owner: "Raj"', 'open_deal: { value: 80000, stage: "Negotiation" }', 'last_touch: { by: "AI SDR", ago: "2d" }'] },
  { name: "check_action", line: "Is this safe to do right now?", sample: ['decision: "hold"', 'reason: "Open deal · owner Raj"', 'next: "Notify owner"'] },
  { name: "log_action", line: "Record what the agent did and why.", sample: ['ok: true', 'id: "act_8f21"', 'logged_at: "10:42:07Z"'] },
  { name: "get_recent_actions", line: "What other agents did to this account.", sample: ['[ { agent: "AI SDR", action: "send_email", ago: "1h" },', '  { agent: "Clay agent", action: "update_title", ago: "2d" } ]'] },
];

/* ───────────── section ───────────── */

export default function McpSection({ onAccess }: { onAccess: () => void }) {
  const reduce = !!useReducedMotion();
  const [tab, setTab] = useState<TabId>("claude-code");
  const [run, setRun] = useState<keyof typeof RUNS>("Hold");
  const connectRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const goConnect = (t?: TabId) => {
    if (t) setTab(t);
    connectRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <section id="mcp" className="scroll-mt-32 border-t border-dx-line bg-dx-surface px-5 py-24 sm:px-8 md:py-32" aria-labelledby="mcp-title">
      <div className="mx-auto max-w-6xl">
        {/* 1. header */}
        <Reveal>
          <Eyebrow>Dexraflow MCP · Early access</Eyebrow>
          <SectionTitle id="mcp-title" lead="Let AI agents into your CRM," muted="without the chaos." />
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dx-ink-muted">Any agent asks Dexraflow before it acts. Dexraflow checks every tool, then says go, hold, or stop.</p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <PrimaryCTA onClick={onAccess}>Get early access</PrimaryCTA>
            <SecondaryCTA onClick={() => goConnect()}>
              See how to connect <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </SecondaryCTA>
          </div>
        </Reveal>

        {/* 2. without vs with */}
        <Reveal className="mt-14">
          <WithoutWith />
        </Reveal>

        {/* 3. three moves */}
        <Reveal className="mt-20">
          <Eyebrow>How it works</Eyebrow>
          <h3 className="mt-4 text-[24px] font-semibold tracking-[-0.02em] text-dx-ink sm:text-[28px]">Three moves: ask, check, log.</h3>
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            { title: "Agent asks", line: "A tiny request before any outreach or CRM write.", Scene: AskScene },
            { title: "Dexraflow checks every tool", line: "Reads context, then matches your rules.", Scene: CheckScene },
            { title: "Decision is logged", line: "Go, hold or stop, with the reason, in one log.", Scene: LogScene },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 0.06}>
              <div className="h-full rounded-[8px] border border-dx-line bg-dx-raised p-4">
                <c.Scene />
                <h4 className="mt-4 text-[17px] font-semibold text-dx-ink">{c.title}</h4>
                <p className="mt-1 text-[14px] text-dx-ink-muted">{c.line}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* 4. four tools */}
        <Reveal className="mt-20">
          <Eyebrow>What your agent gets</Eyebrow>
          <h3 className="mt-4 text-[24px] font-semibold tracking-[-0.02em] text-dx-ink sm:text-[28px]">Four tools. Hover for a sample answer.</h3>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.05}>
              <div tabIndex={0} className={`group h-full rounded-[8px] border border-dx-line bg-dx-raised p-5 transition hover:border-dx-brand ${FOCUS}`}>
                <p className="font-dx-mono text-[14px] font-medium text-dx-brand">{t.name}</p>
                <p className="mt-1.5 text-[15px] text-dx-ink">{t.line}</p>
                <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]">
                  <div className="overflow-hidden">
                    <pre className="mt-3 overflow-x-auto rounded-[6px] bg-dx-night px-3 py-2.5 font-dx-mono text-[12px] leading-5 text-dx-night-ink">{t.sample.join("\n")}</pre>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* 5. get started */}
        <div ref={connectRef} className="scroll-mt-32">
          <Reveal className="mt-20">
            <Eyebrow>Get started · Early access</Eyebrow>
            <h3 className="mt-4 text-[24px] font-semibold tracking-[-0.02em] text-dx-ink sm:text-[28px]">Connect any agent in three steps.</h3>
          </Reveal>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.5fr] lg:gap-10 [&>*]:min-w-0">
            <ol className="space-y-6">
              {[
                { n: 1, t: "Get your key", d: "Join early access to get a workspace and API key.", cta: <SecondaryCTA onClick={onAccess}>Get early access</SecondaryCTA> },
                { n: 2, t: "Connect your agent", d: "Pick your framework and paste one snippet." },
                { n: 3, t: "Your agent asks first", d: "Every risky action gets a decision it can follow." },
              ].map((s) => (
                <Reveal key={s.n}>
                  <li className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-dx-brand-soft font-dx-mono text-[13px] font-medium text-dx-brand">{s.n}</span>
                    <div>
                      <p className="text-[17px] font-semibold text-dx-ink">{s.t}</p>
                      <p className="mt-1 text-[15px] text-dx-ink-muted">{s.d}</p>
                      {s.cta && <div className="mt-3">{s.cta}</div>}
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>

            <Reveal className="min-w-0">
              <div role="tablist" aria-label="Agent platform" onKeyDown={onTabKey} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
                {TABS.map((t, i) => (
                  <button
                    key={t.id}
                    ref={(el) => (tabRefs.current[i] = el)}
                    type="button"
                    role="tab"
                    id={`mcp-tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls="mcp-tabpanel"
                    tabIndex={tab === t.id ? 0 : -1}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] border px-3 text-[13px] font-medium transition ${FOCUS} ${
                      tab === t.id ? "border-dx-brand bg-dx-brand text-white" : "border-dx-line bg-dx-raised text-dx-ink-muted hover:border-dx-line-strong hover:text-dx-ink"
                    }`}
                  >
                    {t.brand && <BrandIcon k={t.brand} size={14} />}
                    {t.label}
                  </button>
                ))}
              </div>
              <div id="mcp-tabpanel" role="tabpanel" aria-labelledby={`mcp-tab-${tab}`} className="mt-2">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={tab} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Window title={active.id === "cursor" ? ".cursor/mcp.json" : active.label} action={active.code ? <CopyButton text={active.code} /> : undefined}>
                      {active.code ? (
                        <pre className="max-w-full overflow-x-auto p-3 font-dx-mono text-[12px] leading-5 text-dx-night-ink sm:p-4 sm:text-[13px]">
                          <code>{highlight(active.code, active.lang)}</code>
                        </pre>
                      ) : active.id === "claude-desktop" ? (
                        <ClaudeDesktopMock />
                      ) : active.id === "n8n" ? (
                        <N8nMock />
                      ) : (
                        <p className="p-4 text-[14px] leading-relaxed text-dx-night-ink-muted">
                          Works with any client that supports remote MCP (Streamable HTTP). Point it at <span className="font-dx-mono text-dx-night-ink">{ENDPOINT}</span> with an <span className="font-dx-mono text-dx-night-ink">Authorization: Bearer</span> header.
                        </p>
                      )}
                    </Window>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-6">
                <Terminal run={run} />
                <div className="mt-2 flex items-center gap-1.5" role="group" aria-label="Example run">
                  {(Object.keys(RUNS) as (keyof typeof RUNS)[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRun(r)}
                      aria-pressed={run === r}
                      className={`h-8 rounded-[6px] border px-3 text-[13px] font-medium transition ${FOCUS} ${run === r ? "border-dx-brand bg-dx-brand-soft text-dx-brand" : "border-dx-line bg-dx-raised text-dx-ink-muted hover:text-dx-ink"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
          <p className="mt-6 text-[13px] text-dx-ink-muted">Build with any framework: custom code, Claude, OpenAI, LangChain, n8n, Clay, Make or Zapier agents.</p>
        </div>

        {/* 6. works with any agent */}
        <Reveal className="mt-20">
          <Eyebrow>Works with any agent</Eyebrow>
          <div className="group relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]" aria-label="Agent platforms and GTM tools Dexraflow works with">
            {reduce ? (
              <div className="flex flex-wrap gap-3">
                {LOGOS.map((l) => (
                  <LogoTile key={l.name} l={l} onPick={l.tab ? () => goConnect(l.tab) : undefined} />
                ))}
              </div>
            ) : (
              <div className="flex w-max gap-3 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]" style={{ animation: "mcp-marquee 48s linear infinite" }}>
                {LOGOS.map((l) => (
                  <LogoTile key={l.name} l={l} onPick={l.tab ? () => goConnect(l.tab) : undefined} />
                ))}
                <div aria-hidden="true" className="flex gap-3">
                  {LOGOS.map((l) => (
                    <LogoTile key={`${l.name}-dup`} l={l} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-[12px] text-dx-ink-muted">Product names identify tools we connect to; trademarks belong to their owners.</p>
        </Reveal>

        {/* 7. scenarios */}
        <Reveal className="mt-20">
          <Eyebrow>Three things it stops</Eyebrow>
        </Reveal>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {[
            { t: "Don't email during an open deal", Scene: OpenDealScene },
            { t: "Don't overwrite what a human fixed", Scene: HumanFixScene },
            { t: "Two agents, one account", Scene: TwoAgentsScene },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 0.06}>
              <h4 className="mb-3 text-[17px] font-semibold text-dx-ink">{c.t}</h4>
              <c.Scene />
            </Reveal>
          ))}
        </div>

        {/* 8. trust strip */}
        <Reveal className="mt-16">
          <ul className="grid gap-3 rounded-[8px] border border-dx-line bg-dx-raised p-4 sm:grid-cols-4 sm:p-5">
            {[
              { I: Eye, t: "Read-only by default" },
              { I: MailX, t: "Never sends anything itself" },
              { I: Scale, t: "Neutral: works with every vendor" },
              { I: ClipboardList, t: "Every decision logged" },
            ].map(({ I, t }) => (
              <li key={t} className="flex items-center gap-2.5 text-[14px] text-dx-ink">
                <I className="h-5 w-5 shrink-0 text-dx-brand" strokeWidth={1.5} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-dx-ink-muted">Dexraflow never sends emails or acts on its own. It only informs, allows, holds or logs.</p>
        </Reveal>

        {/* 9. closing */}
        <Reveal className="mt-16">
          <div className="flex flex-col items-start gap-5 rounded-[12px] bg-dx-night p-8 text-dx-night-ink sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <p className="max-w-xl text-[22px] font-semibold leading-snug tracking-[-0.02em] sm:text-[26px]">
              Your agents do the selling. <span className="text-dx-night-ink-muted">Dexraflow makes sure they work together.</span>
            </p>
            <PrimaryCTA onClick={onAccess} className="shrink-0">
              Get early access
            </PrimaryCTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
