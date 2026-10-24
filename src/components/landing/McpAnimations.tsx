import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Bot, Check, Pencil, User } from "lucide-react";
import { Appear, BrandIcon, Canvas, Caption, Chip, SceneFrame, SlackCard, Stamp, Tile, useStage, useTr } from "./UseCaseAnimations";

/* Scenes for the MCP section. Each one explains itself in motion, loops while in view,
   pauses off-screen, and shows its final readable state under prefers-reduced-motion. */

const TEAL = "#0b6e69";
const LINE = "#d3dcd9";

/** Types `text` out while `active`; shows it whole under reduced motion. */
export function useTyped(text: string, active: boolean, cps = 45) {
  const reduce = !!useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) {
      setN(text.length);
      return;
    }
    if (!active) return;
    setN(0);
    const id = window.setInterval(() => setN((k) => (k >= text.length ? k : k + 1)), 1000 / cps);
    return () => window.clearInterval(id);
  }, [text, active, reduce, cps]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

/** A decision word with its colour: the word always carries the meaning, the colour only echoes it. */
export const DECISION = {
  HOLD: { cls: "border-dx-signal text-dx-signal-ink bg-dx-signal-soft", dark: "text-dx-signal" },
  ALLOW: { cls: "border-dx-success/40 text-dx-success bg-dx-success-soft", dark: "text-dx-success-night" },
  WAIT: { cls: "border-dx-signal text-dx-signal-ink bg-dx-signal-soft", dark: "text-dx-signal" },
  BLOCK: { cls: "border-dx-danger/40 text-dx-danger bg-dx-danger-soft", dark: "text-[#f2766d]" },
} as const;
export type Decision = keyof typeof DECISION;

export function DecisionChip({ d, delay = 0, children }: { d: Decision; delay?: number; children?: ReactNode }) {
  return (
    <Appear delay={delay} className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[12px] font-medium ${DECISION[d].cls}`}>
      <span className="font-dx-mono font-semibold tracking-[0.06em]">{d}</span>
      {children && <span className="text-dx-ink">{children}</span>}
    </Appear>
  );
}

/* ───────────── 2. Without vs with Dexraflow ───────────── */

const HERO_AGENTS = [
  { name: "AI SDR", icon: Bot, y: 30 },
  { name: "Clay agent", brand: "clay", y: 118 },
  { name: "Your Claude agent", brand: "claude", y: 206 },
];
const W = 760;
const H = 330;
const HUB_ROWS = [
  { who: "AI SDR", d: "HOLD", why: "Open deal, Raj owns it", at: 0.6 },
  { who: "Clay agent", d: "ALLOW", why: "Title updated, logged", at: 1.8 },
  { who: "Claude agent", d: "WAIT", why: "Emailed 1h ago by AI SDR", at: 3.0 },
] as const;

function ContactCard({ x, y, w, calm, shaking, stacked = false, children }: { x: number; y: number; w: number; calm: boolean; shaking: boolean; stacked?: boolean; children?: ReactNode }) {
  return (
    <motion.div
      className={`rounded-[8px] border bg-dx-raised p-3 ${stacked ? "" : "absolute"} ${calm ? "border-dx-success/40" : "border-dx-line"}`}
      style={stacked ? undefined : { left: x, top: y, width: w }}
      animate={shaking ? { x: [0, -3, 3, -2, 2, 0] } : { x: 0 }}
      transition={shaking ? { duration: 0.5, repeat: Infinity, repeatDelay: 1.4 } : { duration: 0.3 }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-dx-sunken">
          <User className="h-4 w-4 text-dx-ink-muted" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-dx-ink">Jane · Acme</p>
          <p className="text-[12px] text-dx-ink-muted">Open deal $80K · owner Raj</p>
        </div>
      </div>
      <div className="mt-2.5 space-y-1.5">{children}</div>
    </motion.div>
  );
}

export function WithoutWith() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = !!useReducedMotion();
  const [mode, setMode] = useState<"without" | "with">(reduce ? "with" : "without");
  const [run, setRun] = useState(0);
  const { tr } = useTr();
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // auto-flip every 6s while in view; a click resets the clock
  useEffect(() => {
    if (reduce || !inView) return;
    const id = window.setTimeout(() => {
      setMode((m) => (m === "without" ? "with" : "without"));
      setRun((r) => r + 1);
    }, 6000);
    return () => window.clearTimeout(id);
  }, [mode, run, reduce, inView]);
  const pick = (m: "without" | "with") => {
    setMode(m);
    setRun((r) => r + 1);
  };

  const without = mode === "without";
  const hubX = 300;
  const hubW = 220;
  const cardX = without ? 470 : 580;
  const cardW = without ? 260 : 170;
  const line = (lit: boolean, delay = 0) => ({ animate: { stroke: lit ? (without ? "#b8322b" : TEAL) : LINE, strokeWidth: lit ? 2 : 1.25 }, transition: tr(delay, 0.3) });

  return (
    <div ref={ref}>
      <div className="flex gap-1.5 rounded-[8px] border border-dx-line bg-dx-surface p-1" role="tablist" aria-label="Without or with Dexraflow">
        {(["without", "with"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => pick(m)}
            className={`relative h-9 flex-1 overflow-hidden rounded-[6px] text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-focus ${
              mode === m ? "bg-dx-raised text-dx-ink shadow-[0_1px_2px_rgba(15,26,31,0.08)]" : "text-dx-ink-muted hover:text-dx-ink"
            }`}
          >
            {m === "without" ? "Without Dexraflow" : "With Dexraflow"}
            {mode === m && !reduce && inView && (
              <motion.span key={run} aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] bg-dx-brand" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 6, ease: "linear" }} />
            )}
          </button>
        ))}
      </div>

      <div
        className="mt-3 rounded-[8px] border border-dx-line bg-dx-raised bg-[url('/brand/dot-grid-tile.svg')] bg-[length:24px_24px] p-3 sm:p-4"
        role="img"
        aria-label={without ? "Three AI agents act on the same contact at once, causing duplicate emails and overwritten data." : "The same three agents ask Dexraflow first; it holds one, allows one and tells one to wait, so the contact gets a single touch."}
      >
        {narrow ? (
          <div key={`m-${mode}-${run}`} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {HERO_AGENTS.map((a) => (
                <div key={a.name} className="flex flex-col items-center gap-1 rounded-[8px] border border-dx-brand bg-dx-raised px-1.5 py-2 text-center">
                  {a.brand ? <BrandIcon k={a.brand} size={18} /> : <a.icon className="h-[18px] w-[18px] text-dx-ink-muted" strokeWidth={1.5} aria-hidden="true" />}
                  <span className="text-[12px] font-medium leading-tight text-dx-ink">{a.name}</span>
                </div>
              ))}
            </div>
            <p className="text-center font-dx-mono text-[11px] text-dx-ink-muted">{without ? "↓ all three act at once" : "↓ all three ask first"}</p>
            {without ? (
              <ContactCard x={0} y={0} w={0} calm={false} shaking={!reduce} stacked>
                {["2 emails in 1 hour", "Job title overwritten", "Emailed during an open $80K deal"].map((t, i) => (
                  <Appear key={t} delay={0.5 + i * 0.55} className="flex items-center gap-1.5 rounded-[4px] border border-dx-danger/40 bg-dx-danger-soft px-2 py-1 text-[12px] font-medium text-dx-danger">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-dx-danger" />
                    {t}
                  </Appear>
                ))}
              </ContactCard>
            ) : (
              <>
                <div className="rounded-[8px] border border-dx-night-line bg-dx-night p-3 text-dx-night-ink">
                  <div className="flex items-center justify-between">
                    <img src="/brand/dexraflow-lockup-reversed.svg" alt="" className="h-4 w-auto" />
                    <span className="rounded-[4px] border border-dx-night-line px-1.5 py-0.5 font-dx-mono text-[11px] text-dx-night-ink-muted">MCP</span>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {HUB_ROWS.map((r) => (
                      <Appear key={r.who} delay={r.at} className="rounded-[4px] bg-dx-night-raised px-2 py-1.5 text-[12px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-dx-night-ink-muted">{r.who}</span>
                          <span className={`font-dx-mono text-[12px] font-semibold tracking-[0.06em] ${DECISION[r.d].dark}`}>{r.d}</span>
                        </div>
                        <p className="mt-0.5 text-dx-night-ink">{r.why}</p>
                      </Appear>
                    ))}
                  </div>
                </div>
                <Appear delay={1.2} y={10} className="flex items-start gap-2 rounded-[8px] border border-dx-line bg-dx-raised px-3 py-2 shadow-dx-overlay">
                  <BrandIcon k="slack" size={16} />
                  <p className="text-[12px] leading-snug text-dx-ink">
                    <span className="font-semibold">Raj</span>, approve email to Jane?
                  </p>
                </Appear>
                <ContactCard x={0} y={0} w={0} calm shaking={false} stacked>
                  <Appear delay={3.6} className="flex items-center gap-1.5 rounded-[4px] border border-dx-success/40 bg-dx-success-soft px-2 py-1 text-[12px] font-medium text-dx-success">
                    <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />1 touch, owner informed
                  </Appear>
                </ContactCard>
              </>
            )}
          </div>
        ) : (
        <Canvas w={W} h={H}>
          <div key={`${mode}-${run}`}>
            <svg className="pointer-events-none absolute left-0 top-0" width={W} height={H} aria-hidden="true">
              {HERO_AGENTS.map((a, i) =>
                without ? (
                  <motion.line key={a.name} x1={176} y1={a.y + 26} x2={cardX} y2={60 + i * 18} initial={false} {...line(true, 0.2 + i * 0.5)} />
                ) : (
                  <motion.line key={a.name} x1={176} y1={a.y + 26} x2={hubX} y2={70 + i * 22} initial={false} {...line(true, 0.2 + i * 1.2)} />
                ),
              )}
              {!without && <motion.line x1={hubX + hubW} y1={120} x2={cardX} y2={70} initial={false} {...line(true, 1.2)} />}
            </svg>

            {HERO_AGENTS.map((a) => (
              <Tile key={a.name} x={16} y={a.y} w={160} h={52} row name={a.name} brand={a.brand} icon={a.icon} active />
            ))}

            {without ? (
              <ContactCard x={cardX} y={24} w={cardW} calm={false} shaking={!reduce}>
                {["2 emails in 1 hour", "Job title overwritten", "Emailed during an open $80K deal"].map((t, i) => (
                  <Appear key={t} delay={0.5 + i * 0.55} className="flex items-center gap-1.5 rounded-[4px] border border-dx-danger/40 bg-dx-danger-soft px-2 py-1 text-[12px] font-medium text-dx-danger">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-dx-danger" />
                    {t}
                  </Appear>
                ))}
              </ContactCard>
            ) : (
              <>
                <div className="absolute rounded-[8px] border border-dx-night-line bg-dx-night p-3 text-dx-night-ink" style={{ left: hubX, top: 24, width: hubW }}>
                  <div className="flex items-center justify-between">
                    <img src="/brand/dexraflow-lockup-reversed.svg" alt="" className="h-4 w-auto" />
                    <span className="rounded-[4px] border border-dx-night-line px-1.5 py-0.5 font-dx-mono text-[11px] text-dx-night-ink-muted">MCP</span>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {HUB_ROWS.map((r) => (
                      <Appear key={r.who} delay={r.at} className="rounded-[4px] bg-dx-night-raised px-2 py-1.5 text-[12px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-dx-night-ink-muted">{r.who}</span>
                          <span className={`font-dx-mono text-[12px] font-semibold tracking-[0.06em] ${DECISION[r.d].dark}`}>{r.d}</span>
                        </div>
                        <p className="mt-0.5 text-dx-night-ink">{r.why}</p>
                      </Appear>
                    ))}
                  </div>
                </div>
                <ContactCard x={cardX} y={24} w={cardW} calm shaking={false}>
                  <Appear delay={3.6} className="flex items-center gap-1.5 rounded-[4px] border border-dx-success/40 bg-dx-success-soft px-2 py-1 text-[12px] font-medium text-dx-success">
                    <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />1 touch, owner informed
                  </Appear>
                </ContactCard>
                <Appear delay={1.2} y={10} className="absolute flex items-start gap-2 rounded-[8px] border border-dx-line bg-dx-raised px-3 py-2 shadow-dx-overlay" style={{ left: hubX, top: 262, width: 250 }}>
                  <BrandIcon k="slack" size={16} />
                  <p className="text-[12px] leading-snug text-dx-ink">
                    <span className="font-semibold">Raj</span>, approve email to Jane?
                  </p>
                </Appear>
              </>
            )}
          </div>
        </Canvas>
        )}
      </div>
      <p className="mt-3 text-[15px] font-medium text-dx-ink" aria-live="polite">
        Same agents. One referee they all check with.
      </p>
    </div>
  );
}

/* ───────────── 3. Ask → Check → Log ───────────── */

const CODE = "font-dx-mono text-[12px] leading-5";

export function AskScene() {
  const { ref, stage, reduce } = useStage(3, 1800);
  const { shown, done } = useTyped('check_action({ action: "send_email", to: "jane@acme.com" })', stage === 0 || reduce, 55);
  return (
    <div ref={ref} role="img" aria-label="An AI agent sends Dexraflow a check_action request before emailing a contact." className="rounded-[8px] border border-dx-line bg-dx-raised bg-[url('/brand/dot-grid-tile.svg')] bg-[length:24px_24px] p-3">
      <Canvas w={300} h={120}>
        <Tile x={8} y={32} w={100} h={48} row name="AI SDR" icon={Bot} active />
        <svg className="pointer-events-none absolute left-0 top-0" width={300} height={120} aria-hidden="true">
          <motion.line x1={108} y1={56} x2={130} y2={56} stroke={TEAL} strokeWidth={2} initial={false} animate={{ opacity: done ? 1 : 0.3 }} />
        </svg>
        <div className={`absolute rounded-[6px] border border-dx-line bg-dx-raised px-2.5 py-2 ${CODE} text-dx-ink`} style={{ left: 130, top: 22, width: 162, minHeight: 68 }}>
          <span className="text-dx-brand">{shown.slice(0, 12)}</span>
          {shown.slice(12)}
          {!done && !reduce && <span className="ml-px inline-block h-3.5 w-1.5 animate-pulse bg-dx-brand align-middle" />}
        </div>
        <Appear delay={0} className="absolute left-2 top-[98px] font-dx-mono text-[11px] text-dx-ink-muted">{stage >= 1 || reduce ? "sent → dexraflow" : "typing…"}</Appear>
      </Canvas>
    </div>
  );
}

const CHECK_TOOLS = [
  { k: "hubspot", name: "HubSpot" },
  { k: "salesforce", name: "Salesforce" },
  { k: "gong", name: "Gong" },
  { k: "outreach", name: "Outreach" },
  { k: "slack", name: "Slack" },
];

export function CheckScene() {
  const { ref, stage, reduce } = useStage(8, 550);
  const lit = (i: number) => reduce || stage >= i;
  return (
    <div ref={ref} role="img" aria-label="Dexraflow reads HubSpot, Salesforce, Gong, Outreach and Slack, then matches the rule: no outreach during an open deal." className="rounded-[8px] border border-dx-line bg-dx-raised bg-[url('/brand/dot-grid-tile.svg')] bg-[length:24px_24px] p-3">
      <Canvas w={300} h={120}>
        <p className="absolute left-2 top-1 font-dx-mono text-[11px] uppercase tracking-[0.08em] text-dx-ink-muted">reading context</p>
        {CHECK_TOOLS.map((t, i) => (
          <motion.div
            key={t.k}
            className="absolute flex h-11 w-[57px] flex-col items-center justify-center gap-0.5 rounded-[6px] border bg-dx-raised"
            style={{ left: 4 + i * 59, top: 22 }}
            initial={false}
            animate={{ borderColor: lit(i) ? TEAL : LINE, opacity: lit(i) ? 1 : 0.45 }}
            transition={{ duration: 0.3 }}
          >
            <BrandIcon k={t.k} size={18} />
            <span className="text-[12px] font-medium leading-none tracking-[-0.02em] text-dx-ink">{t.name}</span>
          </motion.div>
        ))}
        <div className="absolute left-2 top-[82px] flex items-center gap-2">
          <motion.span
            className={`rounded-[4px] border px-2 py-0.5 ${CODE} ${lit(5) ? "border-dx-brand text-dx-ink" : "border-dx-line text-dx-ink-muted"}`}
            initial={false}
            animate={{ opacity: lit(5) ? 1 : 0.5 }}
          >
            No outreach during an open deal
          </motion.span>
          {lit(6) && (
            <Appear delay={0} className="flex items-center gap-1 text-[12px] font-medium text-dx-brand">
              <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> matched
            </Appear>
          )}
        </div>
      </Canvas>
    </div>
  );
}

export function LogScene() {
  const { ref, stage, reduce } = useStage(4, 1700);
  const { shown, done } = useTyped('{ decision: "hold", reason: "Open deal · owner Raj", next: "Notify owner" }', stage === 0 || reduce, 60);
  const rowIn = reduce || stage >= 1;
  return (
    <div ref={ref} role="img" aria-label="Dexraflow answers with a hold decision and its reason, and the decision is added to the log." className="rounded-[8px] border border-dx-line bg-dx-raised bg-[url('/brand/dot-grid-tile.svg')] bg-[length:24px_24px] p-3">
      <Canvas w={300} h={140}>
        <div className={`absolute left-2 top-2 rounded-[6px] bg-dx-night px-2.5 py-2 ${CODE} text-dx-night-ink`} style={{ width: 284, minHeight: 44 }}>
          <span className="text-dx-brand-night">{shown.slice(0, 20)}</span>
          {shown.slice(20)}
          {!done && !reduce && <span className="ml-px inline-block h-3.5 w-1.5 animate-pulse bg-dx-brand-night align-middle" />}
        </div>
        <p className="absolute left-2 top-[88px] font-dx-mono text-[11px] uppercase tracking-[0.08em] text-dx-ink-muted">log</p>
        <div className="absolute left-2 top-[106px] w-[284px] border-t border-dx-line">
          <AnimatePresence>
            {rowIn && (
              <motion.div initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="flex items-center gap-2 pt-1.5 text-[12px]">
                <Bot className="h-3.5 w-3.5 text-dx-ink-muted" strokeWidth={1.5} aria-hidden="true" />
                <span className="font-medium text-dx-ink">AI SDR</span>
                <span className="text-dx-ink-muted">· email to Jane</span>
                <span className="ml-auto rounded-[4px] border border-dx-signal/40 bg-dx-signal-soft px-1.5 font-dx-mono text-[12px] font-medium text-dx-signal-ink">hold</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Canvas>
    </div>
  );
}

/* ───────────── 5c. Terminal ───────────── */

export type TermLine = { t: string; tone?: "in" | "out" | "ok" | Decision };
export const RUNS: Record<"Hold" | "Allow" | "Wait", TermLine[]> = {
  Hold: [
    { t: "› AI SDR: drafting email to jane@acme.com", tone: "in" },
    { t: "› calling dexraflow.check_action …", tone: "in" },
    { t: "← decision: HOLD", tone: "HOLD" },
    { t: "  reason: open deal ($80K) · owner: Raj · last touch 2 days ago", tone: "out" },
    { t: "  next:   notify owner in Slack", tone: "out" },
    { t: "› AI SDR: email paused, Raj notified ✓", tone: "ok" },
  ],
  Allow: [
    { t: "› Clay agent: updating title for jane@acme.com", tone: "in" },
    { t: "› calling dexraflow.check_action …", tone: "in" },
    { t: "← decision: ALLOW", tone: "ALLOW" },
    { t: "  reason: enrichment field · no human edit in 30 days", tone: "out" },
    { t: "  next:   log the change", tone: "out" },
    { t: "› Clay agent: title updated, logged ✓", tone: "ok" },
  ],
  Wait: [
    { t: "› Claude agent: emailing jane@acme.com", tone: "in" },
    { t: "› calling dexraflow.check_action …", tone: "in" },
    { t: "← decision: WAIT", tone: "WAIT" },
    { t: "  reason: touched 1h ago by AI SDR", tone: "out" },
    { t: "  next:   retry after 24h", tone: "out" },
    { t: "› Claude agent: queued for tomorrow ✓", tone: "ok" },
  ],
};

export function Terminal({ run }: { run: keyof typeof RUNS }) {
  const lines = RUNS[run];
  const { ref, stage, reduce } = useStage(lines.length + 4, 650);
  const shown = reduce ? lines.length : Math.min(stage + 1, lines.length);
  const toneCls = (tone?: TermLine["tone"]) =>
    tone === "HOLD" || tone === "WAIT" ? "text-dx-signal font-semibold" : tone === "ALLOW" ? "text-dx-success-night font-semibold" : tone === "BLOCK" ? "text-[#f2766d] font-semibold" : tone === "ok" ? "text-dx-success-night" : tone === "out" ? "text-dx-night-ink-muted" : "text-dx-night-ink";
  return (
    <div ref={ref} role="img" aria-label={`An agent run where Dexraflow answers ${run.toUpperCase()} and the agent follows the decision.`} className="overflow-hidden rounded-[8px] border border-dx-night-line bg-dx-night">
      <div className="flex items-center gap-2 border-b border-dx-night-line px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-dx-night-line" />
          ))}
        </span>
        <span className="font-dx-mono text-[12px] text-dx-night-ink-muted">agent run · {run.toLowerCase()}</span>
      </div>
      <div key={run} className="min-h-[164px] px-3 py-3 font-dx-mono text-[12px] leading-[22px]">
        {lines.slice(0, shown).map((l, i) => (
          <motion.p key={i} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className={`whitespace-pre-wrap ${toneCls(l.tone)}`}>
            {l.t}
          </motion.p>
        ))}
        {!reduce && shown < lines.length && <span className="inline-block h-3.5 w-1.5 animate-pulse bg-dx-night-ink-muted align-middle" />}
      </div>
    </div>
  );
}

/* ───────────── 7. Three mini scenarios ───────────── */

const OPEN_DEAL_STEPS = ["AI SDR wants to email Jane", "Dexraflow checks: open $80K deal, Raj owns it", "Held. Raj gets a Slack ping"];

export function OpenDealScene() {
  const { ref, stage, reduce } = useStage(3, 2200);
  return (
    <div>
      <SceneFrame refEl={ref}>
        <div role="img" aria-label="An AI SDR is held from emailing a contact with an open deal, and the deal owner is pinged in Slack.">
          <Canvas w={300} h={290}>
            <Tile x={12} y={58} h={58} big name="AI SDR" icon={Bot} active={stage === 0} />
            <Tile x={108} y={58} h={58} big name="Dexraflow" brand="dexraflow" active={stage >= 1} />
            <Tile x={204} y={58} h={58} big name="Jane · Acme" icon={User} />
            <Chip x={12} y={124} show={stage >= 0} tone="grey" w={96}>
              send_email
            </Chip>
            <Chip x={104} y={124} show={stage >= 1} tone="amber" w={118}>
              Open deal · Raj
            </Chip>
            <div className="absolute" style={{ left: 108, top: 160 }}>{stage >= 2 || reduce ? <Stamp tone="hold" delay={0}>HOLD</Stamp> : null}</div>
            <SlackCard show={stage >= 2} to="Raj" text="AI SDR wants to email Jane at Acme. Approve?" x={8} w={284} />
          </Canvas>
        </div>
      </SceneFrame>
      <Caption stage={stage} lines={OPEN_DEAL_STEPS} />
    </div>
  );
}

const HUMAN_FIX_STEPS = ["A rep fixed Jane's title yesterday", "Enrichment agent tries to overwrite it", "Blocked and logged. The rep's edit stays"];

export function HumanFixScene() {
  const { ref, stage, reduce } = useStage(3, 2200);
  return (
    <div>
      <SceneFrame refEl={ref}>
        <div role="img" aria-label="An enrichment agent tries to overwrite a job title a rep edited yesterday; the change is blocked and logged.">
          <Canvas w={300} h={290}>
            <Tile x={12} y={58} h={58} big name="Rep" icon={Pencil} active={stage === 0} />
            <Tile x={108} y={58} h={58} big name="Clay agent" brand="clay" active={stage === 1} />
            <Tile x={204} y={58} h={58} big name="HubSpot" brand="hubspot" />
            <Chip x={12} y={124} show tone="green" w={110}>
              Title: VP Sales ✓
            </Chip>
            <Chip x={104} y={124} show={stage >= 1} tone="grey" w={112}>
              Title → Director
            </Chip>
            <div className="absolute flex items-center gap-2" style={{ left: 12, top: 168 }}>
              {(stage >= 2 || reduce) && (
                <>
                  <Appear delay={0} className={`inline-flex rounded-[4px] border-2 px-2 py-0.5 font-dx-mono text-[13px] font-semibold tracking-[0.08em] ${DECISION.BLOCK.cls}`}>BLOCK</Appear>
                  <Appear delay={0.3} className="text-[12px] text-dx-ink-muted">human edit, 1 day old · logged</Appear>
                </>
              )}
            </div>
          </Canvas>
        </div>
      </SceneFrame>
      <Caption stage={stage} lines={HUMAN_FIX_STEPS} />
    </div>
  );
}

const TWO_AGENTS_STEPS = ["AI SDR emails Jane at 9:00", "At 10:00, the Claude agent asks to email her too", "It sees: touched 1h ago. It waits"];

export function TwoAgentsScene() {
  const { ref, stage, reduce } = useStage(3, 2200);
  return (
    <div>
      <SceneFrame refEl={ref}>
        <div role="img" aria-label="A second agent asks to email a contact another agent touched an hour ago, and waits instead.">
          <Canvas w={300} h={290}>
            <Tile x={12} y={58} h={58} big name="AI SDR" icon={Bot} active={stage === 0} />
            <Tile x={108} y={58} h={58} big name="Dexraflow" brand="dexraflow" active={stage >= 1} />
            <Tile x={204} y={58} h={58} big name="Claude agent" brand="claude" active={stage === 1} />
            <Chip x={12} y={124} show tone="green" w={96}>
              Emailed 9:00
            </Chip>
            <Chip x={200} y={124} show={stage >= 1} tone="grey" w={92}>
              send_email?
            </Chip>
            <div className="absolute flex items-center gap-2" style={{ left: 108, top: 168 }}>
              {(stage >= 2 || reduce) && (
                <>
                  <Appear delay={0} className={`inline-flex rounded-[4px] border-2 px-2 py-0.5 font-dx-mono text-[13px] font-semibold tracking-[0.08em] ${DECISION.WAIT.cls}`}>WAIT</Appear>
                  <Appear delay={0.3} className="text-[12px] text-dx-ink-muted">touched 1h ago by AI SDR</Appear>
                </>
              )}
            </div>
          </Canvas>
        </div>
      </SceneFrame>
      <Caption stage={stage} lines={TWO_AGENTS_STEPS} />
    </div>
  );
}
