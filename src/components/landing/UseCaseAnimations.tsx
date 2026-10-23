import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { AlertTriangle, Bot, Check, Clock, Globe, Mail, Radar, RotateCcw, Search, type LucideIcon } from "lucide-react";
import { BRAND_ICONS, BRAND_LOGOS } from "./brandIcons";

/* ───────────── shared pieces ───────────── */

const ACCENT = "#0b6e69"; // brand: flows and active state
const SIGNAL = "#e8962e"; // signal: the one item moving through the flow
const INK = "#0a0a0a";

/** Cycles 0..count-1 while in view; the last stage holds for an extra beat. Reduced motion shows the final stage. */
function useStage(count: number, ms = 2100) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useReducedMotion();
  const [raw, setRaw] = useState(0);
  useEffect(() => {
    if (reduce || !inView) return;
    const id = window.setInterval(() => setRaw((s) => (s + 1) % (count + 1)), ms);
    return () => window.clearInterval(id);
  }, [inView, reduce, count, ms]);
  const stage = reduce ? count - 1 : Math.min(raw, count - 1);
  return { ref, stage, reduce: !!reduce };
}

/** A fixed-size drawing surface scaled to the container's width, so positions stay exact on every screen. */
function Canvas({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1.4, e.contentRect.width / w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={outer} className="w-full" style={{ height: h * scale }}>
      <div className="relative" style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

export function BrandIcon({ k, size = 20 }: { k: keyof typeof BRAND_ICONS | string; size?: number }) {
  const logo = BRAND_LOGOS[k];
  if (logo)
    return <img src={logo.src} alt={logo.title} width={size} height={size} draggable={false} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  const i = BRAND_ICONS[k];
  if (!i) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={i.title}>
      <path d={i.path} fill={i.hex} />
    </svg>
  );
}

type TileProps = {
  x: number;
  y: number;
  w?: number;
  h?: number;
  name: string;
  brand?: string;
  icon?: LucideIcon;
  active?: boolean;
  row?: boolean;
};

/** A tool tile: the vendor's icon where one is available, else a neutral category icon, always with the name. */
function Tile({ x, y, w = 84, h = 64, name, brand, icon: Icon, active, row }: TileProps) {
  return (
    <motion.div
      className={`absolute flex items-center rounded-lg border bg-white ${row ? "flex-row gap-2.5 px-3" : "flex-col justify-center gap-1.5"}`}
      style={{ left: x, top: y, width: w, height: h }}
      animate={{
        borderColor: active ? ACCENT : "#d3dcd9",
        boxShadow: active ? "0 0 0 3px rgba(11,110,105,0.16)" : "0 1px 2px rgba(0,0,0,0.04)",
      }}
      transition={{ duration: 0.35 }}
    >
      {brand ? <BrandIcon k={brand} size={row ? 20 : 22} /> : Icon ? <Icon className="h-5 w-5 text-neutral-500" strokeWidth={1.75} /> : null}
      <span className={`font-medium text-neutral-800 ${row ? "text-[13px]" : "text-[11px]"}`}>{name}</span>
    </motion.div>
  );
}

/** A small label pinned to the canvas. */
function Chip({ x, y, show, tone = "amber", children, w }: { x: number; y: number; show: boolean; tone?: "amber" | "green" | "grey"; children: ReactNode; w?: number }) {
  const tones = {
    amber: "border-dx-signal/40 bg-dx-signal-soft text-dx-signal-ink",
    green: "border-dx-success/25 bg-dx-success-soft text-dx-success",
    grey: "border-neutral-200 bg-neutral-50 text-neutral-600",
  };
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={String(children)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`absolute whitespace-nowrap rounded-md border px-2 py-0.5 text-center text-[11px] font-medium ${tones[tone]}`}
          style={{ left: x, top: y, width: w }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The Dexraflow bar that appears above the tools when it steps in. */
function PlaneBar({ show, label = "Dexraflow", w = 320 }: { show: boolean; label?: string; w?: number }) {
  return (
    <motion.div
      className="absolute flex items-center gap-2 overflow-hidden rounded-md px-3"
      style={{ left: 20, top: 14, width: w, height: 30, background: INK }}
      initial={false}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : -6 }}
      transition={{ duration: 0.4 }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} />
      <span className="text-[12px] font-semibold text-white">{label}</span>
      {show && (
        <motion.span
          className="absolute inset-y-0 w-16"
          style={{ background: "linear-gradient(90deg, transparent, rgba(232,150,46,0.55), transparent)" }}
          initial={{ left: -64 }}
          animate={{ left: w }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

/** Thin lines dropping from the bar to the tiles. */
function Drops({ show, xs, to = 95 }: { show: boolean; xs: number[]; to?: number }) {
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width="360" height="290" aria-hidden="true">
      {xs.map((x) => (
        <motion.line
          key={x}
          x1={x}
          x2={x}
          y1={44}
          y2={to}
          stroke={ACCENT}
          strokeWidth={1.5}
          initial={false}
          animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        />
      ))}
    </svg>
  );
}

/** The Slack message at the end of each scene. */
function SlackCard({ show, to, text }: { show: boolean; to: string; text: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]"
          style={{ left: 20, top: 214, width: 320 }}
        >
          <BrandIcon k="slack" size={18} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-neutral-900">
              Dexraflow <span className="font-normal text-neutral-500">→ {to}</span>
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-700">{text}</p>
          </div>
          <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Caption({ stage, lines }: { stage: number; lines: string[] }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="flex gap-1">
        {lines.map((_, i) => (
          <span key={i} className="h-1.5 w-4 rounded-full transition-colors" style={{ background: i <= stage ? ACCENT : "#d3dcd9" }} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="text-[13px] font-medium text-neutral-800"
        >
          {lines[stage]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function SceneFrame({ refEl, children }: { refEl: React.RefObject<HTMLDivElement>; children: ReactNode }) {
  return (
    <div ref={refEl} className="rounded-xl border border-neutral-200 bg-[radial-gradient(rgba(10,10,10,0.06)_1px,transparent_1px)] [background-size:16px_16px] bg-white p-3">
      {children}
    </div>
  );
}

/* ───────────── Scene 1: a hot lead nobody owns ───────────── */

const NO_OWNER_STEPS = [
  "A demo request lands in HubSpot",
  "Routing waits on a field Clay never filled",
  "Two hours later, still no owner",
  "Dexraflow spots the unowned lead",
  "The right rep gets it in Slack, with a deadline",
];

export function NoOwnerScene() {
  const { ref, stage, reduce } = useStage(NO_OWNER_STEPS.length);
  return (
    <div>
      <SceneFrame refEl={ref}>
        <Canvas w={360} h={290}>
          <PlaneBar show={stage >= 3} />
          <Drops show={stage === 3} xs={[180, 298]} />
          <Tile x={20} y={95} name="Web form" icon={Globe} />
          <Tile x={138} y={95} name="HubSpot" brand="hubspot" active={stage >= 1 && stage <= 3} />
          <Tile x={256} y={95} name="Clay" brand="clay" active={stage === 1} />
          {/* routing line HubSpot → Clay */}
          <svg className="pointer-events-none absolute left-0 top-0" width="360" height="290" aria-hidden="true">
            <motion.line x1={222} x2={256} y1={127} y2={127} stroke="#a3a3a3" strokeDasharray="4 4" initial={false} animate={{ opacity: stage >= 1 ? 1 : 0 }} />
          </svg>
          {/* the lead */}
          <motion.div
            className="absolute h-3.5 w-3.5 rounded-full"
            style={{ top: 121, background: SIGNAL }}
            initial={false}
            animate={reduce ? { left: 173, opacity: 0 } : stage === 0 ? { left: [56, 173], opacity: 1 } : { left: 173, opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          />
          <Chip x={248} y={166} show={stage >= 1} tone="amber">Region: empty</Chip>
          <Chip x={130} y={166} show={stage === 1} tone="amber">Unassigned</Chip>
          <Chip x={118} y={166} show={stage >= 2} tone="amber">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> No owner · 2h 14m</span>
          </Chip>
          <SlackCard show={stage >= 4} to="@Priya" text="Acme Inc · demo request · no owner for 2h · reply by 3:00 PM" />
        </Canvas>
      </SceneFrame>
      <Caption stage={stage} lines={NO_OWNER_STEPS} />
    </div>
  );
}

/* ───────────── Scene 2: a workflow that says success but did nothing ───────────── */

const SILENT_STEPS = [
  "Clay syncs new leads into HubSpot",
  "Someone renames a field in HubSpot",
  "Every run still says “Success”, but writes nothing",
  "Dexraflow checks the destination, not the status",
  "RevOps hears what broke, and when",
];

export function SilentFailureScene() {
  const { ref, stage, reduce } = useStage(SILENT_STEPS.length);
  const empty = stage >= 2;
  return (
    <div>
      <SceneFrame refEl={ref}>
        <Canvas w={360} h={290}>
          <PlaneBar show={stage >= 3} />
          <Drops show={stage === 3} xs={[288]} />
          <Tile x={20} y={95} name="Clay" brand="clay" />
          <Tile x={256} y={95} name="HubSpot" brand="hubspot" active={stage === 1 || stage === 3} />
          <svg className="pointer-events-none absolute left-0 top-0" width="360" height="290" aria-hidden="true">
            <line x1={104} x2={256} y1={127} y2={127} stroke="#d3dcd9" strokeWidth={2} />
          </svg>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute h-3 w-3 rounded-full"
              style={{ top: 121, border: `2px solid ${SIGNAL}`, background: empty ? "white" : SIGNAL }}
              animate={reduce ? { left: 180 } : { left: [104, 244] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: "linear" }}
            />
          ))}
          <Chip x={128} y={82} show tone="green">Run status: Success ✓</Chip>
          <Chip x={118} y={150} show tone={empty ? "amber" : "grey"} w={124}>
            {empty ? "Rows written: 0" : "Rows written: 128"}
          </Chip>
          <Chip x={238} y={166} show={stage >= 1} tone="amber">Region → Territory</Chip>
          <AnimatePresence>
            {stage === 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute flex h-9 w-9 items-center justify-center rounded-full bg-white shadow"
                style={{ left: 318, top: 78, border: `2px solid ${ACCENT}` }}
              >
                <Search className="h-4 w-4" style={{ color: ACCENT }} />
              </motion.div>
            )}
          </AnimatePresence>
          <SlackCard show={stage >= 4} to="#revops" text="Clay → HubSpot · 0 records written since 12 Oct · field “Region” was renamed" />
        </Canvas>
      </SceneFrame>
      <Caption stage={stage} lines={SILENT_STEPS} />
    </div>
  );
}

/* ───────────── Scene 3: a buying signal nobody acted on ───────────── */

const SIGNAL_STEPS = [
  "Buying signals show up in three different tools",
  "The account owner is out of office",
  "Five days pass with no touch",
  "Dexraflow ties every signal to the same account",
  "Escalated to the manager before the window closes",
];

export function MissedSignalScene() {
  const { ref, stage } = useStage(SIGNAL_STEPS.length);
  return (
    <div>
      <SceneFrame refEl={ref}>
        <Canvas w={360} h={290}>
          <PlaneBar show={stage >= 3} />
          <Tile x={20} y={58} h={58} name="6sense" icon={Radar} active={stage === 0} />
          <Tile x={138} y={58} h={58} name="Website" icon={Globe} active={stage === 0} />
          <Tile x={256} y={58} h={58} name="Gong" brand="gong" active={stage === 0} />
          <Chip x={18} y={122} show tone="amber" w={88}>Surging</Chip>
          <Chip x={130} y={122} show tone="amber" w={100}>3 pricing visits</Chip>
          <Chip x={250} y={122} show tone="amber" w={96}>Asked pricing</Chip>
          <svg className="pointer-events-none absolute left-0 top-0" width="360" height="290" aria-hidden="true">
            {[62, 180, 298].map((x) => (
              <motion.line
                key={x}
                x1={x}
                y1={142}
                x2={180}
                y2={160}
                stroke={ACCENT}
                strokeWidth={1.5}
                initial={false}
                animate={{ pathLength: stage >= 3 ? 1 : 0, opacity: stage >= 3 ? 1 : 0 }}
                transition={{ duration: 0.5 }}
              />
            ))}
          </svg>
          <AnimatePresence>
            {stage < 4 && (
              <motion.div
                exit={{ opacity: 0 }}
                className="absolute rounded-lg border bg-white px-3 py-2"
                style={{ left: 95, top: 160, width: 170, borderColor: stage >= 3 ? ACCENT : "#d3dcd9" }}
              >
                <p className="text-[12px] font-semibold text-neutral-900">Acme Inc</p>
                <p className={`text-[11px] ${stage >= 1 ? "text-dx-signal-ink" : "text-neutral-500"}`}>
                  Owner: Sam {stage >= 1 ? "· out of office" : ""}
                </p>
                <p className="text-[11px] text-neutral-500">{stage >= 2 ? "Last touch: 5 days ago" : "Last touch: —"}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <SlackCard show={stage >= 4} to="@Maya (manager)" text="Acme Inc · intent surging · 3 pricing visits · no touch in 5 days · owner away" />
        </Canvas>
      </SceneFrame>
      <Caption stage={stage} lines={SIGNAL_STEPS} />
    </div>
  );
}

/* ───────────── Use case 2: AI agents ask Dexraflow before they act ───────────── */
//
// A five-step story: the problem without Dexraflow, then Ask → Look up → Check → Log.
// One thing happens at a time; everything not in the current step drops to 30%.
// Desktop draws on a fixed 880px canvas scaled to fit; when that would push text
// under 11px it switches to a vertical layout that never scales.

const STORY = [
  { label: "The problem", caption: "Agents can't see each other.", ms: 3600 },
  { label: "Ask", caption: "Before acting, the agent asks Dexraflow.", ms: 3000 },
  { label: "Look up", caption: "Dexraflow pulls the account from every tool.", ms: 3800 },
  { label: "Check", caption: "Your rules decide: allowed, held, or ask a human.", ms: 6200 },
  { label: "Log", caption: "Every agent's action, in one log.", ms: 4000 },
] as const;

type AgentId = "sdr" | "hubspotAgent" | "clay";
type ToolId = "hubspot" | "salesforce" | "outreach" | "gong" | "slack";
type Glyph = { name: string; brand?: string; icon?: LucideIcon };

const FLOW_AGENTS: (Glyph & { id: AgentId })[] = [
  { id: "sdr", name: "AI SDR", icon: Bot },
  { id: "hubspotAgent", name: "HubSpot agent", brand: "hubspot" },
  { id: "clay", name: "Clay agent", brand: "clay" },
];
const FLOW_TOOLS: (Glyph & { id: ToolId })[] = [
  { id: "hubspot", name: "HubSpot", brand: "hubspot" },
  { id: "salesforce", name: "Salesforce", brand: "salesforce" },
  { id: "outreach", name: "Outreach", brand: "outreach" },
  { id: "gong", name: "Gong", brand: "gong" },
  { id: "slack", name: "Slack", brand: "slack" },
];
/** Look-up order; each tool lights at 0.2s + i × LOOKUP_GAP. */
const LOOKUP: ToolId[] = ["hubspot", "salesforce", "outreach", "gong"];
const LOOKUP_GAP = 0.7;
const ACCOUNT_ROWS: { label: string; value: string; tool: ToolId }[] = [
  { label: "Owner", value: "Priya", tool: "hubspot" },
  { label: "Open deal", value: "$40K, Negotiation", tool: "salesforce" },
  { label: "Last touch", value: "2 days ago", tool: "outreach" },
];
const LOG_ROWS: { agent: AgentId; action: string; verdict: "held" | "allowed" | "done" }[] = [
  { agent: "sdr", action: "Email to Jane", verdict: "held" },
  { agent: "clay", action: "Job title", verdict: "allowed" },
  { agent: "hubspotAgent", action: "Task for Priya", verdict: "done" },
];
// Check-step beats (seconds into the step).
const T = { rule: 0.2, hold: 0.8, reply: 1.3, slack: 2.3, clayAsk: 3.5, allowed: 4.4 };

const DIM = 0.3;
const agentOn = (id: AgentId, step: number) =>
  step === 0 ? id !== "clay" : step === 1 ? id === "sdr" : step === 3 ? id !== "hubspotAgent" : step === 4;
const toolOn = (id: ToolId, step: number) => (step === 2 ? id !== "slack" : step === 3 ? id === "slack" : false);
/** When (seconds into the step) a tool's line lights, or null if it stays idle this step. */
const toolLitAt = (id: ToolId, step: number) =>
  step === 2 && id !== "slack" ? 0.2 + LOOKUP.indexOf(id) * LOOKUP_GAP : step === 3 && id === "slack" ? T.slack - 0.2 : null;
const agentLitAt = (id: AgentId, step: number) =>
  step === 0 && id !== "clay" ? 0 : step === 1 && id === "sdr" ? 0 : step === 3 && id === "sdr" ? 0 : step === 3 && id === "clay" ? T.clayAsk : null;

function GlyphIcon({ g, size = 18, className = "text-dx-ink-muted" }: { g: Glyph; size?: number; className?: string }) {
  if (g.brand) return <BrandIcon k={g.brand} size={size} />;
  const Icon = g.icon;
  return Icon ? <Icon className={className} style={{ width: size, height: size }} strokeWidth={1.5} aria-hidden="true" /> : null;
}

/** Transition helper: instant under reduced motion, otherwise eased with a delay. */
function useTr() {
  const reduce = !!useReducedMotion();
  return {
    reduce,
    tr: (delay = 0, duration = 0.45) => (reduce ? { duration: 0 } : { delay, duration, ease: [0.22, 1, 0.36, 1] as const }),
  };
}

/** Agent or tool tile: dims when not involved, takes a teal border when its line is lit. */
function FlowTile({ g, on, litAt, compact = false }: { g: Glyph; on: boolean; litAt: number | null; compact?: boolean }) {
  const { tr } = useTr();
  return (
    <motion.div
      className={`flex items-center rounded-[8px] border bg-dx-raised ${compact ? "flex-col justify-center gap-1 px-1.5 py-2 text-center" : "h-full gap-2.5 px-3"}`}
      initial={false}
      animate={{ opacity: on ? 1 : DIM, borderColor: litAt !== null ? ACCENT : "#d3dcd9" }}
      transition={{ opacity: tr(0, 0.35), borderColor: tr(litAt ?? 0, 0.3) }}
    >
      <GlyphIcon g={g} size={compact ? 18 : 20} />
      <span className="text-[13px] font-medium leading-tight text-dx-ink">{g.name}</span>
    </motion.div>
  );
}

function Stamp({ tone, delay, children }: { tone: "hold" | "allowed"; delay: number; children: ReactNode }) {
  const { tr, reduce } = useTr();
  const cls = tone === "hold" ? "border-dx-signal text-dx-signal" : "border-dx-success-night text-dx-success-night";
  return (
    <motion.span
      className={`inline-flex items-center gap-1 rounded-[4px] border-2 px-2 py-0.5 font-dx-mono text-[13px] font-semibold tracking-[0.08em] ${cls}`}
      initial={reduce ? false : { opacity: 0, scale: 1.7, rotate: -10 }}
      animate={{ opacity: 1, scale: 1, rotate: -4 }}
      transition={tr(delay, 0.35)}
    >
      {children}
    </motion.span>
  );
}

function Appear({ delay, children, className = "", y = 6 }: { delay: number; children: ReactNode; className?: string; y?: number }) {
  const { tr, reduce } = useTr();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={tr(delay)}>
      {children}
    </motion.div>
  );
}

/** Step 1's middle: the contact both agents email, with the collision they cause. */
function ContactCard() {
  return (
    <div className="rounded-[8px] border border-dx-line bg-dx-raised p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-dx-sunken text-[13px] font-semibold text-dx-ink">J</span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-dx-ink">Jane · Acme Inc</p>
          <p className="text-[12px] text-dx-ink-muted">Open deal $40K</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { who: "AI SDR", delay: 1.1 },
          { who: "HubSpot agent", delay: 1.4 },
        ].map((e) => (
          <Appear key={e.who} delay={e.delay} className="flex items-center gap-2 rounded-[4px] bg-dx-surface px-2 py-1 text-[12px] text-dx-ink">
            <Mail className="h-3.5 w-3.5 text-dx-ink-muted" strokeWidth={1.5} aria-hidden="true" />
            Email from {e.who}
          </Appear>
        ))}
      </div>
      <Appear delay={1.9} className="mt-3 flex items-center gap-1.5 rounded-[4px] border border-dx-signal/40 bg-dx-signal-soft px-2 py-1 text-[12px] font-medium text-dx-signal-ink">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />2 emails · same day · deal in progress
      </Appear>
    </div>
  );
}

/** The Dexraflow hub, sized to whatever the current step puts in it. */
function Hub({ step }: { step: number }) {
  return (
    <div className="rounded-[8px] border border-dx-night-line bg-dx-night p-3.5 text-dx-night-ink">
      <div className="flex items-center justify-between">
        <img src="/brand/dexraflow-lockup-reversed.svg" alt="Dexraflow" className="h-5 w-auto" />
        <span className="rounded-[4px] border border-dx-night-line px-1.5 py-0.5 font-dx-mono text-[12px] text-dx-night-ink-muted">MCP</span>
      </div>

      {step === 1 && (
        <Appear delay={1.2} className="mt-3 rounded-[4px] bg-dx-night-raised px-2.5 py-2 text-[12px]">
          <p className="text-dx-night-ink-muted">AI SDR asks</p>
          <p className="mt-0.5 font-dx-mono text-[12px] text-dx-night-ink">email jane@acme.com?</p>
        </Appear>
      )}

      {step === 2 && (
        <div className="mt-3 rounded-[6px] bg-dx-raised p-3 text-dx-ink">
          <p className="text-[14px] font-semibold">Acme Inc</p>
          <p className="text-[12px] text-dx-ink-muted">jane@acme.com</p>
          <div className="mt-2 space-y-1">
            {ACCOUNT_ROWS.map((r, i) => (
              <Appear key={r.label} delay={0.45 + i * LOOKUP_GAP} y={4} className="flex items-center gap-2 border-t border-dx-line pt-1 text-[12px]">
                <GlyphIcon g={FLOW_TOOLS.find((t) => t.id === r.tool)!} size={14} />
                <span className="text-dx-ink-muted">{r.label}:</span>
                <span className="font-medium">{r.value}</span>
              </Appear>
            ))}
          </div>
          <Appear delay={0.45 + 3 * LOOKUP_GAP} y={0} className="mt-2 font-dx-mono text-[12px] text-dx-ink-muted">
            4 tools checked
          </Appear>
        </div>
      )}

      {step === 3 && (
        <div className="mt-3 space-y-2.5">
          <p className="rounded-[4px] bg-dx-night-raised px-2.5 py-1.5 text-[12px] text-dx-night-ink-muted">Acme Inc · Owner Priya · Open deal $40K</p>
          <Appear delay={T.rule} className="rounded-[4px] border border-dx-night-line px-2.5 py-1.5 font-dx-mono text-[12px] text-dx-night-ink">
            Rule: no outreach during an open deal
          </Appear>
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] text-dx-night-ink-muted">AI SDR email</span>
            <Stamp tone="hold" delay={T.hold}>HOLD</Stamp>
          </div>
          <Appear delay={T.clayAsk + 0.6} y={0} className="flex items-center gap-2.5 border-t border-dx-night-line pt-2.5">
            <span className="text-[12px] text-dx-night-ink-muted">Clay agent · job title</span>
            <Stamp tone="allowed" delay={T.allowed}>
              ALLOWED <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            </Stamp>
          </Appear>
        </div>
      )}

      {step === 4 && (
        <p className="mt-3 text-[12px] text-dx-night-ink-muted">3 agent actions checked today</p>
      )}
    </div>
  );
}

const VERDICT_CLS = {
  held: "border-dx-signal/40 bg-dx-signal-soft text-dx-signal-ink",
  allowed: "border-dx-success/25 bg-dx-success-soft text-dx-success",
  done: "border-dx-line bg-dx-surface text-dx-ink-muted",
};

/** Step 5: the timeline that slides in under the hub. */
function LogCard() {
  return (
    <Appear delay={0.1} y={-8} className="rounded-[8px] border border-dx-line bg-dx-raised p-3">
      <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">Agent log</p>
      <div className="mt-2 space-y-1.5">
        {LOG_ROWS.map((r, i) => {
          const g = FLOW_AGENTS.find((a) => a.id === r.agent)!;
          return (
            <Appear key={r.agent} delay={0.35 + i * 0.3} y={4} className="flex items-center gap-2 border-t border-dx-line pt-1.5 text-[12px]">
              <GlyphIcon g={g} size={15} />
              <span className="font-medium text-dx-ink">{g.name}</span>
              <span className="truncate text-dx-ink-muted">· {r.action}</span>
              <span className={`ml-auto shrink-0 rounded-[4px] border px-1.5 py-0.5 font-dx-mono text-[12px] font-medium ${VERDICT_CLS[r.verdict]}`}>{r.verdict}</span>
            </Appear>
          );
        })}
      </div>
    </Appear>
  );
}

function SlackApproval() {
  return (
    <Appear delay={T.slack} y={10} className="rounded-[8px] border border-dx-line bg-dx-raised p-3 shadow-dx-overlay">
      <div className="flex items-start gap-2.5">
        <BrandIcon k="slack" size={18} />
        <p className="text-[12px] leading-snug text-dx-ink">
          <span className="font-semibold">Priya</span>, AI SDR wants to email Jane at Acme.
        </p>
      </div>
      <div className="mt-2.5 flex gap-2 pl-[28px]">
        <span className="rounded-[6px] bg-dx-brand px-2.5 py-1 text-[12px] font-medium text-white">Approve</span>
        <span className="rounded-[6px] border border-dx-line-strong px-2.5 py-1 text-[12px] font-medium text-dx-ink">Skip</span>
      </div>
    </Appear>
  );
}

function Middle({ step }: { step: number }) {
  return (
    <div className="space-y-2.5">
      <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">{step === 0 ? "Without Dexraflow" : "With Dexraflow"}</p>
      {step === 0 ? <ContactCard /> : <Hub step={step} />}
      {step === 4 && <LogCard />}
    </div>
  );
}

/** A message bubble that flies between two canvas points; optional fade on landing. */
function Flyer({ from, to, delay, tone = "grey", fade = false, children }: { from: [number, number]; to: [number, number]; delay: number; tone?: "grey" | "amber"; fade?: boolean; children: ReactNode }) {
  const { reduce } = useTr();
  if (reduce && fade) return null;
  const cls = tone === "amber" ? "border-dx-signal/40 bg-dx-signal-soft text-dx-signal-ink" : "border-dx-line bg-dx-raised text-dx-ink";
  return (
    <motion.div
      className={`absolute z-10 flex items-center gap-1.5 whitespace-nowrap rounded-[6px] border px-2.5 py-1 text-[12px] font-medium shadow-dx-overlay ${cls}`}
      initial={reduce ? { left: to[0], top: to[1], opacity: 1 } : { left: from[0], top: from[1], opacity: 0 }}
      animate={reduce ? { left: to[0], top: to[1], opacity: 1 } : { left: [from[0], to[0]], top: [from[1], to[1]], opacity: fade ? [0, 1, 1, 0] : [0, 1, 1] }}
      transition={reduce ? { duration: 0 } : { delay, duration: fade ? 1.1 : 0.9, ease: "easeInOut", times: fade ? [0, 0.15, 0.8, 1] : [0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Bubbles({ step }: { step: number }) {
  if (step === 0)
    return (
      <>
        <Flyer from={[150, 70]} to={[300, 120]} delay={0.2} fade>
          <Mail className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Email
        </Flyer>
        <Flyer from={[150, 158]} to={[300, 150]} delay={0.5} fade>
          <Mail className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Email
        </Flyer>
      </>
    );
  if (step === 1)
    return (
      <Flyer from={[120, 70]} to={[300, 80]} delay={0.25} fade>
        Can I email jane@acme.com?
      </Flyer>
    );
  if (step === 3)
    return (
      <>
        <Flyer from={[290, 150]} to={[20, 101]} delay={T.reply} tone="amber">
          Held: ask Priya
        </Flyer>
        <Flyer from={[120, 246]} to={[296, 196]} delay={T.clayAsk} fade>
          Update Jane's job title?
        </Flyer>
      </>
    );
  return null;
}

/* — desktop canvas geometry — */
const D = { w: 880, h: 400, agentX: 0, agentW: 176, agentH: 52, midX: 286, midW: 308, toolX: 704, toolW: 176, toolH: 46 };
const AGENT_Y: Record<AgentId, number> = { sdr: 44, hubspotAgent: 132, clay: 220 };
const TOOL_Y: Record<ToolId, number> = { hubspot: 28, salesforce: 82, outreach: 136, gong: 190, slack: 250 };
const MID_ANCHOR: Record<AgentId, number> = { sdr: 84, hubspotAgent: 104, clay: 124 };

function DesktopStory({ step, beat }: { step: number; beat: string }) {
  const { tr } = useTr();
  const line = (litAt: number | null) => ({
    animate: { stroke: litAt !== null ? ACCENT : "#d3dcd9", strokeWidth: litAt !== null ? 2 : 1.25 },
    transition: tr(litAt ?? 0, 0.3),
  });
  return (
    <div className="relative" style={{ width: D.w, height: D.h }}>
      <p className="absolute font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted" style={{ left: D.agentX, top: 16 }}>
        Your AI agents
      </p>
      <p className="absolute font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted" style={{ left: D.toolX, top: 0 }}>
        Your tools
      </p>

      <svg className="pointer-events-none absolute left-0 top-0" width={D.w} height={D.h} aria-hidden="true">
        {FLOW_AGENTS.map((a) => (
          <motion.line key={a.id} x1={D.agentW} y1={AGENT_Y[a.id] + D.agentH / 2} x2={D.midX} y2={MID_ANCHOR[a.id]} initial={false} {...line(agentLitAt(a.id, step))} />
        ))}
        {step > 0 &&
          FLOW_TOOLS.map((t) => (
            <motion.line key={t.id} x1={D.midX + D.midW} y1={t.id === "slack" ? 120 : 90} x2={D.toolX} y2={TOOL_Y[t.id] + D.toolH / 2} initial={false} {...line(toolLitAt(t.id, step))} />
          ))}
      </svg>

      {FLOW_AGENTS.map((a) => (
        <div key={a.id} className="absolute" style={{ left: D.agentX, top: AGENT_Y[a.id], width: D.agentW, height: D.agentH }}>
          <FlowTile g={a} on={agentOn(a.id, step)} litAt={agentLitAt(a.id, step)} />
        </div>
      ))}
      {FLOW_TOOLS.map((t) => (
        <div key={t.id} className="absolute" style={{ left: D.toolX, top: TOOL_Y[t.id], width: D.toolW, height: D.toolH }}>
          <FlowTile g={t} on={toolOn(t.id, step)} litAt={toolLitAt(t.id, step)} />
        </div>
      ))}

      <div className="absolute" style={{ left: D.midX, top: 12, width: D.midW }}>
        <Middle key={beat} step={step} />
      </div>

      {step === 3 && (
        <div className="absolute" style={{ left: D.toolX - 88, top: TOOL_Y.slack + D.toolH + 10, width: D.toolW + 88 }}>
          <SlackApproval key={beat} />
        </div>
      )}

      <Bubbles key={beat} step={step} />
    </div>
  );
}

/** Vertical layout for narrow screens: agents on top, Dexraflow in the middle, tools below. Never scaled. */
function MobileStory({ step, beat }: { step: number; beat: string }) {
  const { tr } = useTr();
  const lane = (litTeal: boolean) => (
    <motion.span className="mx-auto block h-4 w-px" initial={false} animate={{ backgroundColor: litTeal ? ACCENT : "#d3dcd9" }} transition={tr(0, 0.3)} />
  );
  return (
    <div className="space-y-2.5">
      <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">Your AI agents</p>
      <div className="grid grid-cols-3 gap-2">
        {FLOW_AGENTS.map((a) => (
          <FlowTile key={a.id} g={a} compact on={agentOn(a.id, step)} litAt={agentLitAt(a.id, step)} />
        ))}
      </div>

      {/* message lane: what travels between the agents and the middle in this step */}
      <div key={beat} className="flex min-h-[64px] flex-col items-center justify-center gap-1.5">
        {step === 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {["AI SDR", "HubSpot agent"].map((w, i) => (
              <Appear key={w} delay={0.2 + i * 0.3} className="flex items-center gap-1.5 rounded-[6px] border border-dx-line bg-dx-raised px-2 py-1 text-[12px] font-medium text-dx-ink">
                <Mail className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> {w}: email ↓
              </Appear>
            ))}
          </div>
        )}
        {step === 1 && (
          <Appear delay={0.25} className="rounded-[6px] border border-dx-line bg-dx-raised px-2.5 py-1 text-[12px] font-medium text-dx-ink">
            Can I email jane@acme.com? ↓
          </Appear>
        )}
        {step === 3 && (
          <>
            <Appear delay={T.reply} className="rounded-[6px] border border-dx-signal/40 bg-dx-signal-soft px-2.5 py-1 text-[12px] font-medium text-dx-signal-ink">
              ↑ Held: ask Priya
            </Appear>
            <Appear delay={T.clayAsk} className="rounded-[6px] border border-dx-line bg-dx-raised px-2.5 py-1 text-[12px] font-medium text-dx-ink">
              Clay agent: update Jane's job title? ↓
            </Appear>
          </>
        )}
        {(step === 2 || step === 4) && lane(false)}
      </div>

      <div className="min-h-[268px]">
        <Middle key={beat} step={step} />
      </div>

      {lane(step === 2 || step === 3)}
      <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">Your tools</p>
      <div className="flex flex-wrap gap-2">
        {FLOW_TOOLS.map((t) => (
          <div key={t.id} className="w-[calc(33.333%-6px)]">
            <FlowTile g={t} compact on={toolOn(t.id, step)} litAt={toolLitAt(t.id, step)} />
          </div>
        ))}
      </div>
      <div className="min-h-[92px]">{step === 3 && <SlackApproval key={beat} />}</div>
    </div>
  );
}

/** Plays the story: auto-advances while in view, pauses on hover or focus, never auto-plays under reduced motion. */
function useStory() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = !!useReducedMotion();
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const playing = inView && !hover && !focus && !reduce;
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      setStep((s) => (s + 1) % STORY.length);
      setRun((r) => r + 1);
    }, STORY[step].ms);
    return () => window.clearTimeout(id);
  }, [playing, step, run]);
  const go = (i: number) => {
    setStep(i);
    setRun((r) => r + 1);
  };
  return { ref, step, run, go, playing, reduce, inView, setHover, setFocus };
}

/** Desktop canvas scale, or "mobile" when scaling would push 12px text under 11px. */
function useLayout() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = width ? Math.min(1.1, width / D.w) : 1;
  const mobile = width > 0 && 12 * scale < 11;
  return { ref, scale, mobile, ready: width > 0 };
}

export function AgentFlow() {
  const { ref, step, run, go, playing, reduce, inView, setHover, setFocus } = useStory();
  const { ref: boxRef, scale, mobile, ready } = useLayout();
  return (
    <figure
      ref={ref}
      aria-label="Animation: AI agents check with Dexraflow before acting. It pulls the account from every tool, applies your rules, holds or allows the action, and logs it."
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) setFocus(true);
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
    >
      {/* stepper */}
      <div className="flex flex-wrap items-center gap-2">
        <ol className="flex flex-wrap gap-1.5" aria-label="Steps">
          {STORY.map((s, i) => {
            const active = i === step;
            return (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={active ? "step" : undefined}
                  className={`relative inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-[8px] border px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-focus focus-visible:ring-offset-2 ${
                    active ? "border-dx-brand bg-dx-brand text-white" : "border-dx-line bg-dx-raised text-dx-ink-muted hover:border-dx-line-strong hover:text-dx-ink"
                  }`}
                >
                  <span className={`font-dx-mono text-[12px] ${active ? "text-white/80" : i < step ? "text-dx-brand" : ""}`}>{i + 1}</span>
                  {s.label}
                  {active && playing && (
                    <motion.span
                      key={`${run}-${i}`}
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 h-[2px] bg-white/70"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: s.ms / 1000, ease: "linear" }}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="ml-auto flex items-center gap-2">
          {!reduce && inView && !playing && <span className="font-dx-mono text-[12px] text-dx-ink-muted">paused</span>}
          <button
            type="button"
            onClick={() => go(0)}
            aria-label="Replay animation"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-dx-line bg-dx-raised text-dx-ink-muted transition hover:border-dx-line-strong hover:text-dx-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dx-focus focus-visible:ring-offset-2"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* the story */}
      <div
        ref={boxRef}
        aria-hidden="true"
        className="mt-3 rounded-[8px] border border-dx-line bg-dx-raised bg-[url('/brand/dot-grid-tile.svg')] bg-[length:24px_24px] p-3 sm:p-4"
      >
        {ready &&
          (mobile ? (
            <MobileStory step={step} beat={`${run}-${step}`} />
          ) : (
            <div style={{ height: D.h * scale }}>
              <div style={{ width: D.w, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <DesktopStory step={step} beat={`${run}-${step}`} />
              </div>
            </div>
          ))}
      </div>

      <figcaption aria-live="polite" className="mt-3 flex items-baseline gap-2 text-[15px] font-medium text-dx-ink sm:text-[16px]">
        <span className="font-dx-mono text-[12px] text-dx-ink-muted">
          {step + 1}/{STORY.length}
        </span>
        {STORY[step].caption}
      </figcaption>
    </figure>
  );
}
