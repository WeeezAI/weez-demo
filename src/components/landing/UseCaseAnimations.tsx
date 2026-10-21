import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Bot, Check, Clock, Database, Globe, Mail, Phone, Radar, Search, type LucideIcon } from "lucide-react";
import { BRAND_ICONS } from "./brandIcons";

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
          <Tile x={256} y={95} name="Clay" icon={Database} active={stage === 1} />
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
          <Tile x={20} y={95} name="Clay" icon={Database} />
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
          <Tile x={256} y={58} h={58} name="Gong" icon={Phone} active={stage === 0} />
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

const AGENTS = [
  { name: "AI SDR", icon: Bot, y: 40 },
  { name: "Clay agent", icon: Database, y: 128 },
  { name: "HubSpot agent", brand: "hubspot", y: 216 },
  { name: "Your Claude agent", brand: "claude", y: 304 },
];
const TOOLS = [
  { name: "HubSpot", brand: "hubspot", y: 24 },
  { name: "Salesforce", brand: "salesforce", y: 88 },
  { name: "Apollo", icon: Database, y: 152 },
  { name: "Outreach", icon: Mail, y: 216 },
  { name: "Gong", icon: Phone, y: 280 },
  { name: "Slack", brand: "slack", y: 344 },
];
const MCP_STEPS = [
  "An AI SDR wants to email jane@acme.com. It asks Dexraflow first.",
  "Dexraflow pulls the account from every tool",
  "A rule says no outreach during an open deal, so it's held for Priya",
  "Another agent asks to update a job title. That's allowed.",
  "Every agent's action lands in one log",
];

const HUB = { x: 330, y: 40, w: 260, h: 336 };

function Bubble({ show, from, to, tone, children }: { show: boolean; from: [number, number]; to: [number, number]; tone: "amber" | "green" | "grey"; children: ReactNode }) {
  const tones = { amber: "bg-dx-signal-soft text-dx-signal-ink border-dx-signal/40", green: "bg-dx-success-soft text-dx-success border-dx-success/25", grey: "bg-white text-neutral-800 border-neutral-200" };
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`absolute z-10 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-medium shadow-sm ${tones[tone]}`}
          initial={{ left: from[0], top: from[1], opacity: 0 }}
          animate={{ left: to[0], top: to[1], opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AgentFlow() {
  const { ref, stage } = useStage(MCP_STEPS.length, 2600);
  const lit = (on: boolean) => ({ stroke: on ? ACCENT : "#d3dcd9", strokeWidth: on ? 2 : 1.25 });
  const stepActive = (i: number) => (i === 0 ? stage <= 1 : i === 1 ? stage === 2 || stage === 3 : stage === 4);
  return (
    <div>
      <div ref={ref} className="rounded-xl border border-neutral-200 bg-[radial-gradient(rgba(10,10,10,0.06)_1px,transparent_1px)] [background-size:16px_16px] bg-white p-3">
        <Canvas w={920} h={400}>
          <p className="absolute text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400" style={{ left: 20, top: 12 }}>Your AI agents</p>
          <p className="absolute text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400" style={{ left: 750, top: 0 }}>Your tools</p>

          <svg className="pointer-events-none absolute left-0 top-0" width="920" height="400" aria-hidden="true">
            {AGENTS.map((a, i) => (
              <motion.line key={a.name} x1={180} y1={a.y + 26} x2={HUB.x} y2={HUB.y + 60 + i * 20} initial={false} animate={lit((stage <= 2 && i === 0) || (stage === 3 && i === 1))} />
            ))}
            {TOOLS.map((t) => (
              <motion.line key={t.name} x1={HUB.x + HUB.w} y1={HUB.y + 120} x2={750} y2={t.y + 24} initial={false} animate={lit(stage === 1 && t.name !== "Slack")} />
            ))}
            <motion.line x1={HUB.x + HUB.w} y1={HUB.y + 160} x2={750} y2={368} initial={false} animate={lit(stage === 2)} />
          </svg>

          {AGENTS.map((a, i) => (
            <Tile key={a.name} x={20} y={a.y} w={160} h={52} row name={a.name} brand={a.brand} icon={a.icon} active={(stage <= 2 && i === 0) || (stage === 3 && i === 1)} />
          ))}
          {TOOLS.map((t) => (
            <Tile key={t.name} x={750} y={t.y} w={150} h={48} row name={t.name} brand={t.brand} icon={t.icon} active={(stage === 1 && t.name !== "Slack") || (stage === 2 && t.name === "Slack")} />
          ))}

          {/* the hub */}
          <div className="absolute rounded-xl p-4 text-white" style={{ left: HUB.x, top: HUB.y, width: HUB.w, height: HUB.h, background: INK }}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} />
              <span className="text-[13px] font-semibold">Dexraflow</span>
              <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 font-geist-mono text-[10px] text-white/70">MCP</span>
            </div>
            <div className="mt-3 flex gap-1.5">
              {["Ask", "Check", "Log"].map((s, i) => (
                <motion.span
                  key={s}
                  className="flex-1 rounded-md py-1 text-center text-[11px] font-semibold"
                  initial={false}
                  animate={{ background: stepActive(i) ? ACCENT : "rgba(255,255,255,0.08)", color: stepActive(i) ? "#fff" : "rgba(255,255,255,0.55)" }}
                >
                  {s}
                </motion.span>
              ))}
            </div>
            <div className="relative mt-3" style={{ height: 232 }}>
              <AnimatePresence mode="wait">
                {stage <= 1 && (
                  <motion.div key="ctx" initial={{ opacity: 0 }} animate={{ opacity: stage === 1 ? 1 : 0.35 }} exit={{ opacity: 0 }} className="space-y-1.5 text-[12px]">
                    <p className="text-white/50">Acme Inc · jane@acme.com</p>
                    <p>Owner: <span className="font-semibold">Priya</span></p>
                    <p>Open deal: <span className="font-semibold">$40K · Negotiation</span></p>
                    <p>Last touch: <span className="font-semibold">Outreach, 2 days ago</span></p>
                  </motion.div>
                )}
                {stage === 2 && (
                  <motion.div key="rule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 text-[12px]">
                    <p className="rounded-md bg-white/10 px-2 py-1.5 font-geist-mono text-[11px] text-white/80">rule: no outreach during an open deal</p>
                    <p className="rounded-md px-2 py-1.5 font-semibold" style={{ background: "rgba(242,162,58,0.18)", color: "#f5b85e" }}>Held · asked Priya in Slack</p>
                  </motion.div>
                )}
                {stage === 3 && (
                  <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 text-[12px]">
                    <p className="rounded-md bg-white/10 px-2 py-1.5 font-geist-mono text-[11px] text-white/80">rule: enrichment updates allowed</p>
                    <p className="rounded-md bg-dx-success-night/20 px-2 py-1.5 font-semibold text-dx-success-night">Allowed ✓</p>
                  </motion.div>
                )}
                {stage === 4 && (
                  <motion.div key="log" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
                    {[
                      ["AI SDR", "email held · open deal"],
                      ["Clay agent", "job title updated"],
                      ["HubSpot agent", "task for Priya"],
                    ].map(([who, what], i) => (
                      <motion.p
                        key={who}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.25 }}
                        className="flex justify-between rounded-md bg-white/10 px-2 py-1.5 font-geist-mono text-[11px] text-white/85"
                      >
                        <span>{who}</span>
                        <span className="text-white/55">{what}</span>
                      </motion.p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <Bubble show={stage === 0} from={[60, 96]} to={[196, 64]} tone="grey">Email jane@acme.com?</Bubble>
          <Bubble show={stage === 2} from={[290, 120]} to={[188, 100]} tone="amber">Held: open deal</Bubble>
          <Bubble show={stage === 3} from={[60, 184]} to={[192, 150]} tone="green">Update title? ✓</Bubble>
        </Canvas>
      </div>
      <Caption stage={stage} lines={MCP_STEPS} />
    </div>
  );
}
