import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Radar,
  Send,
  Loader2,
  RefreshCw,
  Check,
  CheckCheck,
  X,
  MessageSquare,
  AlertTriangle,
  Info,
  Activity,
  Mail,
  MailCheck,
  Building2,
  Target,
  Gauge,
  Layers,
  ArrowRight,
  Ban,
  Sparkles,
  Signal as SignalIcon,
  Zap,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ConversationSidebar from "@/components/ConversationSidebar";
import {
  evaAPI,
  SIGNAL_META,
  ACTION_META,
  TIER_META,
  ENRICHMENT_META,
  QUICK_PROMPTS,
  type ACVTier,
  type EvaAction,
  type EvaWorkspace,
  type EvaMetrics,
  type QualifiedLead,
  type ChannelSignal,
  type EvaChatMessage,
  type ScanStage,
} from "@/services/evaAPI";

// ─── Tone → tailwind chip classes ────────────────────────────────────────────────

const TONE: Record<string, string> = {
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  zinc: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

function Chip({ tone = "zinc", icon: Icon, children, className }: { tone?: string; icon?: typeof Target; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", TONE[tone] || TONE.zinc, className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

// ─── Eva avatar ──────────────────────────────────────────────────────────────────

const EVA_AVATAR = "/assets/eva.png";

function EvaAvatar({ className = "h-9 w-9" }: { className?: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full", className)}>
      {ok ? (
        <img src={EVA_AVATAR} alt="Eva, Lead Analyst" onError={() => setOk(false)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <Radar className="h-1/2 w-1/2" />
        </div>
      )}
    </div>
  );
}

function LogoMark({ seed, className = "h-9 w-9" }: { seed: string; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white", className)}
      style={{ background: "linear-gradient(135deg,#10b981,#0ea5e9)" }}>
      {seed}
    </div>
  );
}

// ─── Scan progress ─────────────────────────────────────────────────────────────

const SCAN_STEPS: { keys: ScanStage[]; label: string; hint: string; Icon: typeof Layers }[] = [
  { keys: ["starting", "context"], label: "Reading your ICP", hint: "Industry, segments, personas and known customers to qualify against.", Icon: Layers },
  { keys: ["tracking"], label: "Tracking channels", hint: "Job postings, funding, product launches, tech changes + research engine + LinkedIn VM.", Icon: Radar },
  { keys: ["qualifying"], label: "Qualifying by ACV", hint: "Deduping into orgs/people and applying the signal-to-action matrix.", Icon: Target },
  { keys: ["enriching"], label: "Enriching leads", hint: "Resolving the decision-maker, email and website for qualified leads.", Icon: Mail },
];

function scanStepIndex(stage: ScanStage | null): number {
  if (!stage) return 0;
  const i = SCAN_STEPS.findIndex((s) => s.keys.includes(stage));
  return i === -1 ? 0 : i;
}

function ScanProgress({ stage }: { stage: ScanStage | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = scanStepIndex(stage);
  return (
    <div className="flex h-[62vh] flex-col items-center justify-center gap-6 text-center">
      <div className="relative">
        <span className="absolute -inset-2 animate-ping rounded-full bg-emerald-400/20" />
        <EvaAvatar className="relative h-16 w-16 ring-2 ring-emerald-100" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-700">Eva is scanning your market</p>
        <p className="mt-0.5 text-xs text-zinc-400">Tracking events across every channel · {elapsed}s elapsed</p>
      </div>
      <div className="w-full max-w-md space-y-3 text-left">
        {SCAN_STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          const Icon = step.Icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={cn("flex items-start gap-3 rounded-2xl border p-3 transition-colors", state === "active" ? "border-emerald-200 bg-emerald-50/50" : "border-transparent")}>
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                state === "done" ? "bg-emerald-50 text-emerald-600" : state === "active" ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-400")}>
                {state === "done" ? <Check className="h-4 w-4" /> : state === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px] font-semibold leading-snug", state === "pending" ? "text-zinc-400" : "text-zinc-800")}>{step.label}</p>
                {state === "active" && <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{step.hint}</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Summary header ────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white/70 px-3.5 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold leading-none text-zinc-900", tone)}>{value}</p>
      {sub && <p className="mt-1 text-[10px] font-medium text-zinc-400">{sub}</p>}
    </div>
  );
}

function SummaryHeader({ ws, metrics }: { ws: EvaWorkspace; metrics: EvaMetrics }) {
  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Chip tone="emerald" icon={Radar}>Lead analyst · event-driven</Chip>
            <span className="text-[10px] font-medium text-zinc-400">ICP-first discovery → qualify → enrich → hand to Max</span>
          </div>
          {ws.icp && (
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-zinc-500">
              Tracking <span className="font-semibold text-zinc-700">{ws.icp.industry}</span> · {ws.icp.segments?.join(", ")} · personas: {ws.icp.personas?.join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Channels" value={metrics.channelsMonitored} sub="monitored" />
        <StatTile label="Signals / wk" value={metrics.signalsThisWeek} sub={`${metrics.signalsCaptured} total`} />
        <StatTile label="Orgs tracked" value={metrics.orgsTracked} />
        <StatTile label="Qualified" value={metrics.qualifiedLeads} sub={`L${metrics.byTier.low} · M${metrics.byTier.medium} · H${metrics.byTier.high}`} />
        <StatTile label="Emails found" value={metrics.emailsFound} sub={`${metrics.enrichedLeads} enriched`} tone="text-emerald-600" />
        <StatTile label="Handed to Max" value={metrics.handedToMax} sub="for outreach" tone="text-violet-600" />
      </div>
    </div>
  );
}

// ─── Channels + signal feed ──────────────────────────────────────────────────

function PanelTitle({ icon: Icon, children, right }: { icon: typeof Radar; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
        <Icon className="h-3.5 w-3.5" /> {children}
      </p>
      {right}
    </div>
  );
}

function ChannelsPanel({ ws }: { ws: EvaWorkspace }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
      <PanelTitle icon={Radar}>Channels monitored</PanelTitle>
      <div className="space-y-1.5">
        {(ws.channels || []).map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex items-center gap-1.5 text-zinc-600">
              <span className={cn("h-1.5 w-1.5 rounded-full", c.live ? "bg-emerald-500" : "bg-amber-400")} />
              {c.displayName}
            </span>
            <span className="font-semibold text-zinc-400">{ws.metrics.bySignalType[c.signalType] || 0}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">Green = live connector · amber = not yet wired.</p>
    </div>
  );
}

function SignalFeed({ signals }: { signals: ChannelSignal[] }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
      <PanelTitle icon={Activity} right={<span className="text-[10px] font-medium text-zinc-400">{signals.length}</span>}>Live signal feed</PanelTitle>
      <ScrollArea className="h-[360px] pr-2">
        <div className="space-y-1.5">
          {signals.slice(0, 40).map((s) => (
            <div key={s.id} className="flex items-start gap-2.5 rounded-xl border border-zinc-100 px-3 py-2">
              <Chip tone={SIGNAL_META[s.signalType]?.tone || "zinc"}>{SIGNAL_META[s.signalType]?.label || s.signalType}</Chip>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-zinc-700">
                  <span className="font-semibold text-zinc-900">{s.company}</span> · {s.detail}
                </p>
                <p className="text-[10px] text-zinc-400">{s.channel}</p>
              </div>
            </div>
          ))}
          {signals.length === 0 && <p className="py-8 text-center text-[12px] text-zinc-400">No signals captured yet.</p>}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Qualified lead card ─────────────────────────────────────────────────────

function LeadCard({ lead, onAction }: { lead: QualifiedLead; onAction: (action: "hand_to_max" | "reject" | "reset") => void }) {
  const action = ACTION_META[lead.recommendedAction];
  const tier = TIER_META[lead.acvTier];
  const enrich = ENRICHMENT_META[lead.enrichment?.status] || ENRICHMENT_META.pending;
  const handed = lead.handoffState === "handed_to_max";
  const rejected = lead.status === "rejected";

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: rejected ? 0.5 : 1, y: 0 }}
      className={cn("flex flex-col rounded-2xl border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        handed ? "border-violet-200 ring-1 ring-violet-100" : "border-zinc-200/80")}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark seed={(lead.company || "AC").slice(0, 2).toUpperCase()} className="h-10 w-10" />
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-zinc-900">{lead.company}</h3>
              <p className="truncate text-[11px] text-zinc-400">{lead.industry} · {lead.employeeRange} · {lead.hqLocation}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded-lg bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white">{lead.icpFit}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-400">fit</span>
            </div>
            <Chip tone={tier.tone}>{tier.label}</Chip>
          </div>
        </div>

        {/* event + why now */}
        <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            {lead.eventType && <Chip tone={SIGNAL_META[lead.eventType]?.tone || "zinc"}>{SIGNAL_META[lead.eventType]?.label || lead.eventType}</Chip>}
            <span className="text-[11px] font-medium text-zinc-500">{lead.primaryEvent?.replace(/^\[[^\]]+\]\s*/, "")}</span>
          </div>
          <p className="text-[12px] leading-relaxed text-zinc-600"><span className="font-semibold text-zinc-700">Why it qualified:</span> {lead.qualificationReason}</p>
        </div>

        {/* routing + enrichment */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={action.tone} icon={Zap}>{action.label}</Chip>
          <Chip tone={enrich.tone} icon={lead.contact?.emailVerified ? MailCheck : Mail}>{enrich.label}</Chip>
          {lead.escalation && <span className="text-[10px] text-zinc-400" title={lead.escalation}><ShieldCheck className="mr-1 inline h-3 w-3" />escalation set</span>}
        </div>

        {/* contact */}
        {(lead.contact?.name || lead.contact?.email) && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 text-[12px]">
            <div className="min-w-0">
              <span className="font-semibold text-zinc-800">{lead.contact.name || "Contact"}</span>
              {lead.contact.role && <span className="text-zinc-500"> · {lead.contact.role}</span>}
            </div>
            {lead.contact.email ? (
              <span className="inline-flex items-center gap-1 truncate text-[11px] font-medium text-emerald-600">
                <MailCheck className="h-3.5 w-3.5" /> {lead.contact.email}
              </span>
            ) : (
              <span className="text-[11px] text-zinc-400">email pending</span>
            )}
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3">
        <span className="text-[11px] font-medium text-zinc-400">{lead.website?.replace(/^https?:\/\//, "") || lead.domain}</span>
        <div className="flex items-center gap-1.5">
          {rejected ? (
            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-zinc-500" onClick={() => onAction("reset")}>Restore</Button>
          ) : handed ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-violet-600"><CheckCheck className="h-3.5 w-3.5" /> With Max</span>
          ) : (
            <>
              <button title="Not a fit" onClick={() => onAction("reject")} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600"><Ban className="h-3.5 w-3.5" /></button>
              <Button size="sm" className="h-7 gap-1 bg-violet-600 text-[11px] font-semibold hover:bg-violet-700" onClick={() => onAction("hand_to_max")}>
                Hand to Max <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Eva chat sidebar ────────────────────────────────────────────────────────

function EvaChat({ ws, spaceId, open, onClose }: { ws: EvaWorkspace; spaceId?: string; open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<EvaChatMessage[]>([
    { role: "eva", content: "I'm Eva, your lead analyst. I track events across channels for your ICP, qualify orgs and people by ACV, enrich them, and hand qualified leads to Max. Ask me why a lead qualified, which channel is working, or which leads are ready for Max." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (forced?: string) => {
    const text = (forced ?? input).trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await evaAPI.chat(text, ws, spaceId);
      setMessages((m) => [...m, { role: "eva", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "eva", content: "I hit a snag answering that. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <>
      <div onClick={onClose} className={cn("fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden", open ? "block" : "hidden")} />
      <aside className={cn("fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-zinc-200/70 bg-white shadow-2xl transition-transform duration-300",
        "lg:static lg:z-auto lg:w-[380px] lg:max-w-none lg:shrink-0 lg:bg-white/70 lg:shadow-none lg:backdrop-blur-xl lg:transition-none",
        open ? "translate-x-0" : "translate-x-full lg:hidden")}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <EvaAvatar className="h-9 w-9 ring-2 ring-emerald-100" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">Eva</p>
              <p className="text-[10px] font-medium text-zinc-400">Lead Analyst · always on</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><X className="h-4 w-4" /></button>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 py-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                  m.role === "user" ? "whitespace-pre-line rounded-br-sm bg-zinc-900 text-white" : "rounded-bl-sm bg-zinc-100 text-zinc-700")}>
                  {m.role === "user" ? m.content : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
                      li: ({ children }) => <li className="marker:text-zinc-400">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
                    }}>{m.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3">
                  <div className="flex gap-1">{[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${d}ms` }} />)}</div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 px-4 py-2.5">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} onClick={() => send(p)} disabled={loading}
              className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10.5px] font-medium text-zinc-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50">
              {p}
            </button>
          ))}
        </div>

        <div className="border-t border-zinc-100 p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 focus-within:border-emerald-300">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} rows={1}
              placeholder="Ask Eva about the leads…" className="max-h-28 min-h-[36px] resize-none border-0 bg-transparent p-1 text-[13px] shadow-none focus-visible:ring-0" />
            <Button size="icon" onClick={() => send()} disabled={!input.trim() || loading} className="h-9 w-9 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

type TierFilter = "all" | ACVTier;

export default function Eva() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const [ws, setWs] = useState<EvaWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ScanStage | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const reqRef = useRef(0);

  const load = useCallback(async (force: boolean, isScan: boolean) => {
    const my = ++reqRef.current;
    setError(null);
    setStage("starting");
    if (isScan) setScanning(true); else setLoading(true);
    try {
      const data = isScan
        ? await evaAPI.scan(spaceId || "demo", (s) => my === reqRef.current && setStage(s))
        : await evaAPI.getWorkspace(spaceId || "demo", force, (s) => my === reqRef.current && setStage(s));
      if (my !== reqRef.current) return;
      setWs(data);
      if (isScan) toast.success("Eva refreshed the lead list");
    } catch (e) {
      if (my !== reqRef.current) return;
      setError(e instanceof Error ? e.message : "Couldn't load Eva's workspace");
      if (isScan) toast.error("Couldn't scan channels"); else setWs(null);
    } finally {
      if (my !== reqRef.current) return;
      setStage(null);
      if (isScan) setScanning(false); else setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => { load(false, false); }, [load]);

  const leads = useMemo(() => {
    if (!ws) return [];
    return ws.leads
      .filter((l) => l.status !== "rejected")
      .filter((l) => tierFilter === "all" || l.acvTier === tierFilter)
      .sort((a, b) => b.icpFit - a.icpFit);
  }, [ws, tierFilter]);

  const onLeadAction = (lead: QualifiedLead, action: "hand_to_max" | "reject" | "reset") => {
    setWs((prev) => prev ? {
      ...prev,
      leads: prev.leads.map((l) => l.id === lead.id ? {
        ...l,
        status: action === "reject" ? "rejected" : action === "reset" ? "qualified" : "handed",
        handoffState: action === "hand_to_max" ? "handed_to_max" : action === "reject" ? "held" : "enriched",
      } : l),
    } : prev);
    if (action === "hand_to_max") toast.success(`${lead.company} handed to Max for outreach`);
    void evaAPI.leadAction(spaceId, lead.id, action);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar spaceId={spaceId!} onNewChat={() => navigate("/spaces")} onSelectConversation={() => {}} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-16 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <EvaAvatar className="h-9 w-9 ring-2 ring-emerald-100 shadow-sm" />
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Lead Analyst</span>
              <span className="text-sm font-semibold text-zinc-900">Eva · Signal &amp; lead discovery</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
              <SignalIcon className="h-3 w-3" /> Event-driven
            </Badge>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs" onClick={() => load(true, true)} disabled={scanning || loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", scanning && "animate-spin")} />
              <span className="hidden sm:inline">Scan channels</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs lg:hidden" onClick={() => setChatOpen((o) => !o)}>
              <MessageSquare className="h-3.5 w-3.5" /> Eva
            </Button>
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-5 px-6 pb-10 pt-6 lg:px-8">
            {loading ? (
              <ScanProgress stage={stage} />
            ) : error && !ws ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50"><AlertTriangle className="h-6 w-6 text-amber-500" /></div>
                <div>
                  <p className="text-sm font-semibold text-zinc-700">Eva couldn't reach your workspace</p>
                  <p className="mx-auto mt-0.5 max-w-md text-xs text-zinc-500">{error}</p>
                </div>
                <Button onClick={() => load(true, false)} className="mt-1 h-9 gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold hover:bg-zinc-800"><RefreshCw className="h-4 w-4" /> Try again</Button>
              </div>
            ) : ws ? (
              <>
                {scanning && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-[12px] font-medium text-emerald-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Eva is scanning channels — {SCAN_STEPS[scanStepIndex(stage)]?.label ?? "working"}…</span>
                  </div>
                )}
                {ws.isDemo && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>Showing <span className="font-semibold">sample leads</span> — this space isn't linked to a real brand, so Eva can't scan live channels here.</span>
                  </div>
                )}

                <SummaryHeader ws={ws} metrics={ws.metrics} />

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-4 lg:col-span-2">
                    {/* tier filter */}
                    <div className="flex items-center gap-1 rounded-full bg-zinc-100/80 p-1 w-fit">
                      {(["all", "low", "medium", "high"] as TierFilter[]).map((t) => (
                        <button key={t} onClick={() => setTierFilter(t)}
                          className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                            tierFilter === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>
                          {t === "all" ? `All ${ws.leads.filter((l) => l.status !== "rejected").length}` : `${TIER_META[t as ACVTier].label} ${ws.metrics.byTier[t as ACVTier]}`}
                        </button>
                      ))}
                    </div>

                    {leads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 py-16 text-zinc-400">
                        <Target className="h-5 w-5" />
                        <p className="text-sm font-medium">No qualified leads in this view yet.</p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {leads.map((l) => <LeadCard key={l.id} lead={l} onAction={(a) => onLeadAction(l, a)} />)}
                      </AnimatePresence>
                    )}
                  </div>

                  <div className="space-y-4">
                    <ChannelsPanel ws={ws} />
                    <SignalFeed signals={ws.signals} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {ws && <EvaChat ws={ws} spaceId={spaceId} open={chatOpen} onClose={() => setChatOpen(false)} />}

      {ws && !chatOpen && (
        <button onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 hidden h-12 items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 pl-2 pr-5 text-sm font-semibold text-white shadow-xl transition-transform hover:scale-105 lg:flex">
          <EvaAvatar className="h-8 w-8 ring-1 ring-white/40" /> Ask Eva
        </button>
      )}
    </div>
  );
}
