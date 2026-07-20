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
  Users as UsersIcon,
  Send,
  Loader2,
  RefreshCw,
  Check,
  CheckCheck,
  X,
  MessageSquare,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Target,
  Clock,
  Mail,
  Flame,
  Info,
  Pencil,
  Trash2,
  CalendarClock,
  Layers,
  Activity,
  BellRing,
  Eye,
  TrendingUp,
  Gauge,
  Briefcase,
  GitBranch,
  Sparkles,
  Brain,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ConversationSidebar from "@/components/ConversationSidebar";
import {
  maxAPI,
  computeMetrics,
  TIER_CONFIG,
  SIGNAL_META,
  CONFIDENCE_META,
  ACTION_META,
  QUICK_PROMPTS,
  type ACVTier,
  type MaxWorkspace,
  type MaxMetrics,
  type AccountRecord,
  type ContactRecord,
  type OutboundOpportunity,
  type AccountBrief,
  type SignalEvent,
  type SignalBundleItem,
  type MaxChatMessage,
  type MonitorStage,
  type ConfidenceLabel,
  type ReasoningArtifact,
  type ReasoningStageSummary,
} from "@/services/maxAPI";

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
  zinc: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const MOMENTUM_META: Record<AccountRecord["momentum"], { label: string; tone: string; icon: typeof Flame }> = {
  accelerating: { label: "Accelerating", tone: "rose", icon: Flame },
  steady: { label: "Steady", tone: "sky", icon: Activity },
  quiet: { label: "Quiet", tone: "zinc", icon: Clock },
};

function Chip({
  tone = "zinc",
  icon: Icon,
  children,
  className,
}: {
  tone?: string;
  icon?: typeof Target;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE[tone] || TONE.zinc,
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

function ConfidenceChip({ label }: { label: ConfidenceLabel }) {
  const meta = CONFIDENCE_META[label];
  return (
    <Chip tone={meta.tone} icon={Gauge}>
      {meta.label}
    </Chip>
  );
}

// ─── Max avatar ──────────────────────────────────────────────────────────────────

const MAX_AVATAR = "/assets/max.png";

function MaxAvatar({ className = "h-9 w-9" }: { className?: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-full", className)}>
      {ok ? (
        <img
          src={MAX_AVATAR}
          alt="Max, Outbound Head"
          onError={() => setOk(false)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-500 to-rose-600 text-white">
          <Radar className="h-1/2 w-1/2" />
        </div>
      )}
    </div>
  );
}

// ─── Monitoring progress ─────────────────────────────────────────────────────────

const GEN_STEPS: { keys: MonitorStage[]; label: string; hint: string; Icon: typeof Layers }[] = [
  {
    keys: ["starting", "context"],
    label: "Reading your ICP & brand context",
    hint: "Pulling industry, segments, personas and known customers to qualify against.",
    Icon: Layers,
  },
  {
    keys: ["scanning"],
    label: "Scanning event sources",
    hint: "Job boards, funding, product launches, tech-stack, leadership hires and engagement.",
    Icon: Radar,
  },
  {
    keys: ["qualifying"],
    label: "Consolidating signals into accounts",
    hint: "Deduping across sources, scoring ICP fit and ACV tier, ranking priority.",
    Icon: Target,
  },
  {
    keys: ["reasoning", "drafting"],
    label: "Reasoning through each opportunity",
    hint: "Research → problem → solution → strategy → email → quality review → approval for the top accounts.",
    Icon: Brain,
  },
];

function genStepIndex(stage: MonitorStage | null): number {
  if (!stage) return 0;
  const i = GEN_STEPS.findIndex((s) => s.keys.includes(stage));
  return i === -1 ? 0 : i;
}

function MonitorProgress({ stage }: { stage: MonitorStage | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = genStepIndex(stage);
  return (
    <div className="flex h-[62vh] flex-col items-center justify-center gap-6 text-center">
      <div className="relative">
        <span className="absolute -inset-2 animate-ping rounded-full bg-orange-400/20" />
        <MaxAvatar className="relative h-16 w-16 ring-2 ring-orange-100" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-700">Max is monitoring your market</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Tracking accounts across every event source · {elapsed}s elapsed
        </p>
      </div>
      <div className="w-full max-w-md space-y-3 text-left">
        {GEN_STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          const Icon = step.Icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                state === "active" ? "border-orange-200 bg-orange-50/50" : "border-transparent"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  state === "done"
                    ? "bg-emerald-50 text-emerald-600"
                    : state === "active"
                    ? "bg-orange-600 text-white"
                    : "bg-zinc-100 text-zinc-400"
                )}
              >
                {state === "done" ? (
                  <Check className="h-4 w-4" />
                ) : state === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px] font-semibold leading-snug", state === "pending" ? "text-zinc-400" : "text-zinc-800")}>
                  {step.label}
                </p>
                {state === "active" && <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{step.hint}</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Company logo mark ─────────────────────────────────────────────────────────

function LogoMark({ seed, tone = "orange", className = "h-9 w-9" }: { seed: string; tone?: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white",
        className
      )}
      style={{
        background:
          tone === "orange"
            ? "linear-gradient(135deg,#f97316,#e11d48)"
            : "linear-gradient(135deg,#6366f1,#0ea5e9)",
      }}
    >
      {seed}
    </div>
  );
}

function SignalChips({ bundle, max = 4 }: { bundle: SignalBundleItem[]; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {bundle.slice(0, max).map((b, i) => (
        <Chip key={i} tone={SIGNAL_META[b.type]?.tone || "zinc"}>
          {SIGNAL_META[b.type]?.label || b.type}
          <span className="ml-1 font-normal normal-case text-zinc-400">· {b.recency}</span>
        </Chip>
      ))}
      {bundle.length > max && (
        <span className="text-[10px] font-medium text-zinc-400">+{bundle.length - max} more</span>
      )}
    </div>
  );
}

// ─── Top summary header ────────────────────────────────────────────────────────

function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white/70 px-3.5 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold leading-none text-zinc-900", tone)}>{value}</p>
      {sub && <p className="mt-1 text-[10px] font-medium text-zinc-400">{sub}</p>}
    </div>
  );
}

function EffortBar({ effort, tier }: { effort?: MaxWorkspace["effort"]; tier: ACVTier }) {
  const e = effort || { low: 17, medium: 38, high: 50, note: "" };
  const total = e.low + e.medium + e.high || 1;
  const parts: { key: ACVTier; value: number; color: string }[] = [
    { key: "low", value: e.low, color: "bg-cyan-400" },
    { key: "medium", value: e.medium, color: "bg-violet-400" },
    { key: "high", value: e.high, color: "bg-orange-400" },
  ];
  return (
    <div>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">Effort split</p>
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {parts.map((p) => (
          <div
            key={p.key}
            className={cn(p.color, p.key === tier && "ring-1 ring-inset ring-black/10")}
            style={{ width: `${(p.value / total) * 100}%` }}
            title={`${p.key} ${p.value}%`}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-2.5 text-[10px] font-medium text-zinc-400">
        <span className={cn(tier === "low" && "text-cyan-600")}>L {e.low}</span>
        <span className={cn(tier === "medium" && "text-violet-600")}>M {e.medium}</span>
        <span className={cn(tier === "high" && "text-orange-600")}>H {e.high}</span>
      </div>
    </div>
  );
}

function SummaryHeader({
  workspace,
  metrics,
  acvTier,
  onTierChange,
}: {
  workspace: MaxWorkspace;
  metrics: MaxMetrics;
  acvTier: ACVTier;
  onTierChange: (t: ACVTier) => void;
}) {
  const cfg = TIER_CONFIG[acvTier];
  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Chip tone="orange" icon={Radar} className="border-orange-200 bg-orange-50 text-orange-700">
              {cfg.mode.replace("-", " ")} mode
            </Chip>
            <span className="text-[10px] font-medium text-zinc-400">{cfg.mentalModel}</span>
          </div>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-zinc-500">{cfg.goal}.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">ACV tier</span>
          <Select value={acvTier} onValueChange={(v) => onTierChange(v as ACVTier)}>
            <SelectTrigger className="h-9 w-[190px] rounded-xl border-zinc-200 text-sm font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low · {TIER_CONFIG.low.range}</SelectItem>
              <SelectItem value="medium">Medium · {TIER_CONFIG.medium.range}</SelectItem>
              <SelectItem value="high">High · {TIER_CONFIG.high.range}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-zinc-400">{cfg.buyer}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Monitored" value={metrics.accountsMonitored} sub="accounts in tier" />
        <StatTile label="Queued" value={metrics.accountsQueued} sub={`${metrics.autoSent} auto-sent`} />
        <StatTile label="Active" value={metrics.accountsActive} sub="contacted / in play" />
        <StatTile label="Meetings" value={metrics.meetingsBooked} sub="booked" tone="text-emerald-600" />
        <StatTile
          label="Replies"
          value={metrics.repliesAwaiting}
          sub="awaiting you"
          tone={metrics.repliesAwaiting > 0 ? "text-rose-600" : undefined}
        />
        <StatTile label="Signals / wk" value={metrics.activeSignalsThisWeek} sub="across sources" />
      </div>

      <div className="mt-4 grid gap-2.5 lg:grid-cols-[1fr_auto]">
        <div className="flex gap-2.5 rounded-2xl bg-orange-50/60 p-3.5">
          <MaxAvatar className="h-7 w-7 ring-2 ring-white" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-orange-600">Max's recommended focus</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-600">
              {metrics.recommendedFocus || "Scanning sources — focus guidance will appear once accounts qualify."}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white/70 px-3.5 py-2.5">
          <EffortBar effort={workspace.effort} tier={acvTier} />
        </div>
      </div>

      {metrics.learnedThisWeek && (
        <div className="mt-2.5 flex items-start gap-2 rounded-2xl border border-zinc-100 bg-white/60 p-3">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
          <p className="text-[12px] leading-relaxed text-zinc-500">
            <span className="font-semibold text-zinc-600">What Max learned:</span> {metrics.learnedThisWeek}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Shared panels ─────────────────────────────────────────────────────────────

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

function SourceHealth({ workspace }: { workspace: MaxWorkspace }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    workspace.signals.forEach((s) => {
      c[s.signalType] = (c[s.signalType] || 0) + 1;
    });
    return c;
  }, [workspace.signals]);
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
      <PanelTitle icon={Radar}>Source health</PanelTitle>
      <div className="space-y-1.5">
        {(workspace.sources || []).map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex items-center gap-1.5 text-zinc-600">
              <span className={cn("h-1.5 w-1.5 rounded-full", s.live ? "bg-emerald-500" : "bg-amber-400")} />
              {s.displayName}
            </span>
            <span className="font-semibold text-zinc-500">{counts[s.signalType] || 0}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
        Amber = simulated feed (drop in a live integration per source without changing anything downstream).
      </p>
    </div>
  );
}

function ThroughputPanel({ metrics }: { metrics: MaxMetrics }) {
  const rows: { label: string; value: string; tone?: string }[] = [
    { label: "Auto-sent", value: String(metrics.autoSent) },
    { label: "Reply rate", value: `${metrics.replyRate}%`, tone: "text-emerald-600" },
    { label: "Bounce rate", value: `${metrics.bounceRate}%`, tone: metrics.bounceRate > 3 ? "text-rose-600" : undefined },
    { label: "Opt-out rate", value: `${metrics.optOutRate}%`, tone: metrics.optOutRate > 1 ? "text-rose-600" : undefined },
  ];
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
      <PanelTitle icon={Gauge}>Throughput &amp; deliverability</PanelTitle>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-zinc-50 px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-400">{r.label}</p>
            <p className={cn("mt-0.5 text-base font-semibold text-zinc-800", r.tone)}>{r.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExceptionsPanel({ metrics }: { metrics: MaxMetrics }) {
  const clear = metrics.repliesAwaiting === 0 && metrics.bounceRate < 3 && metrics.optOutRate < 1;
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
      <PanelTitle icon={BellRing}>Exceptions</PanelTitle>
      {clear ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-[12px] font-medium text-zinc-500">All clear — automation is healthy.</p>
          <p className="text-[10.5px] text-zinc-400">Max only surfaces bounces, opt-outs and unusual replies here.</p>
        </div>
      ) : (
        <div className="space-y-2 text-[12px]">
          {metrics.repliesAwaiting > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
              <Mail className="h-4 w-4" /> {metrics.repliesAwaiting} repl{metrics.repliesAwaiting > 1 ? "ies" : "y"} awaiting attention
            </div>
          )}
          {metrics.bounceRate >= 3 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Bounce rate elevated ({metrics.bounceRate}%)
            </div>
          )}
          {metrics.optOutRate >= 1 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Opt-out rate elevated ({metrics.optOutRate}%)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LiveSignalFeed({ signals, companies }: { signals: SignalEvent[]; companies?: Set<string> }) {
  const feed = useMemo(
    () => (companies ? signals.filter((s) => companies.has(s.company)) : signals).slice(0, 40),
    [signals, companies]
  );
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
      <PanelTitle icon={Activity} right={<span className="text-[10px] font-medium text-zinc-400">{feed.length} recent</span>}>
        Live signal feed
      </PanelTitle>
      <ScrollArea className="h-[420px] pr-2">
        <div className="space-y-1.5">
          {feed.map((s) => (
            <div key={s.id} className="flex items-start gap-2.5 rounded-xl border border-zinc-100 px-3 py-2">
              <Chip tone={SIGNAL_META[s.signalType]?.tone || "zinc"}>{SIGNAL_META[s.signalType]?.label || s.signalType}</Chip>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-zinc-700">
                  <span className="font-semibold text-zinc-900">{s.company}</span> · {s.detail}
                </p>
                <p className="text-[10px] text-zinc-400">{s.source}</p>
              </div>
            </div>
          ))}
          {feed.length === 0 && <p className="py-8 text-center text-[12px] text-zinc-400">No signals in this tier yet.</p>}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Queue quality / recency filter (shared by Low + Medium modes) ───────────────

type QueueFilter = "all" | "latest" | "high" | "low";

const QUEUE_FILTERS: { key: QueueFilter; label: string }[] = [
  { key: "all", label: "All quality" },
  { key: "latest", label: "Latest" },
  { key: "high", label: "High quality" },
  { key: "low", label: "Low quality" },
];
const HIGH_QUALITY_SCORE = 70;
const LOW_QUALITY_SCORE = 50;

// Quality = Max's own review score when available, else the fit score.
function oppQuality(o: OutboundOpportunity): number {
  return typeof o.qualityReview?.overall === "number" ? o.qualityReview.overall : o.fitScore;
}

function applyQueueFilter(opps: OutboundOpportunity[], filter: QueueFilter): OutboundOpportunity[] {
  let list = opps;
  if (filter === "high") list = list.filter((o) => oppQuality(o) >= HIGH_QUALITY_SCORE);
  else if (filter === "low") list = list.filter((o) => oppQuality(o) < LOW_QUALITY_SCORE);
  return [...list].sort((a, b) =>
    filter === "latest"
      ? +new Date(b.createdAt) - +new Date(a.createdAt)
      : b.fitScore - a.fitScore
  );
}

function QueueFilterBar({ value, onChange }: { value: QueueFilter; onChange: (f: QueueFilter) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-zinc-100/80 p-1 w-fit">
      {QUEUE_FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
            value === f.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ─── Low ACV mode — monitoring & exception ───────────────────────────────────────

function AutoRow({
  opp,
  account,
  onToggle,
}: {
  opp: OutboundOpportunity;
  account?: AccountRecord;
  onToggle: () => void;
}) {
  const running = opp.approvalState === "approved" || opp.approvalState === "sent";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <LogoMark seed={account?.logoSeed || "AC"} className="h-8 w-8" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-zinc-800">{account?.company || "Account"}</p>
          <p className="truncate text-[11px] text-zinc-400">{opp.signalBundle[0]?.detail || opp.whyNow}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("flex items-center gap-1 text-[11px] font-semibold", running ? "text-emerald-600" : "text-zinc-400")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", running ? "bg-emerald-500" : "bg-zinc-300")} />
          {running ? "Auto-running" : "Paused"}
        </span>
        <button
          onClick={onToggle}
          className="rounded-lg border border-zinc-200 px-2 py-1 text-[10.5px] font-semibold text-zinc-500 hover:bg-zinc-50"
        >
          {running ? "Pause" : "Resume"}
        </button>
      </div>
    </div>
  );
}

function LowMode({
  workspace,
  metrics,
  onOppAction,
}: {
  workspace: MaxWorkspace;
  metrics: MaxMetrics;
  onOppAction: (opp: OutboundOpportunity, action: string) => void;
}) {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const accById = useMemo(() => new Map(workspace.accounts.map((a) => [a.id, a])), [workspace.accounts]);
  const lowCompanies = useMemo(
    () => new Set(workspace.accounts.filter((a) => a.acvTier === "low").map((a) => a.company)),
    [workspace.accounts]
  );
  const lowOpps = useMemo(
    () => applyQueueFilter(workspace.opportunities.filter((o) => o.acvTier === "low"), filter),
    [workspace.opportunities, filter]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <LiveSignalFeed signals={workspace.signals} companies={lowCompanies} />
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
          <PanelTitle icon={Zap} right={<span className="text-[10px] font-medium text-zinc-400">{lowOpps.length} sequences</span>}>
            Auto-sequences (inspect on exception)
          </PanelTitle>
          <div className="mb-3">
            <QueueFilterBar value={filter} onChange={setFilter} />
          </div>
          <div className="space-y-1.5">
            {lowOpps.map((o) => (
              <AutoRow
                key={o.id}
                opp={o}
                account={accById.get(o.accountId)}
                onToggle={() => onOppAction(o, o.approvalState === "approved" ? "skip" : "approve")}
              />
            ))}
            {lowOpps.length === 0 && (
              <p className="py-8 text-center text-[12px] text-zinc-400">No low-ACV accounts enrolled yet.</p>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <ThroughputPanel metrics={metrics} />
        <ExceptionsPanel metrics={metrics} />
        <SourceHealth workspace={workspace} />
      </div>
    </div>
  );
}

// ─── Medium ACV mode — prioritized queue & judgment ──────────────────────────────

function IconAction({
  title,
  onClick,
  icon: Icon,
  spinning,
  danger,
}: {
  title: string;
  onClick: () => void;
  icon: typeof Pencil;
  spinning?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700",
        danger && "hover:bg-red-50 hover:text-red-600"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
    </button>
  );
}

// ─── Reasoning inspector (multi-stage pipeline) ──────────────────────────────────

const STAGE_ICON: Record<string, typeof Layers> = {
  research: Layers,
  problem: AlertTriangle,
  solution: GitBranch,
  strategy: Target,
  generation: Mail,
  review: ShieldCheck,
  approval: CheckCheck,
};

const SCORE_BAR_COLOR: Record<string, string> = {
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

const DEFAULT_STAGE_ORDER: ReasoningStageSummary[] = [
  { id: "research", label: "Research", status: "complete", headline: "" },
  { id: "problem", label: "Problem Inference", status: "complete", headline: "" },
  { id: "solution", label: "Solution Mapping", status: "complete", headline: "" },
  { id: "strategy", label: "Email Strategy", status: "complete", headline: "" },
  { id: "generation", label: "Email Generation", status: "complete", headline: "" },
  { id: "review", label: "Quality Review", status: "complete", headline: "" },
  { id: "approval", label: "Approval Decision", status: "complete", headline: "" },
];

function scoreTone(v: number): string {
  if (v >= 80) return "emerald";
  if (v >= 70) return "sky";
  if (v >= 50) return "amber";
  return "rose";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
        <span className="capitalize">{label.replace(/([A-Z])/g, " $1")}</span>
        <span className="tabular-nums">{v}</span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={cn("h-full rounded-full", SCORE_BAR_COLOR[scoreTone(v)])} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
      <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-700">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[12px] leading-relaxed text-zinc-600">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function SafeConfidence({ label }: { label?: string }) {
  if (!label || !(label in CONFIDENCE_META)) return null;
  return <ConfidenceChip label={label as ConfidenceLabel} />;
}

function CheckChip({ ok, yes, no }: { ok?: boolean; yes: string; no: string }) {
  return (
    <Chip tone={ok ? "emerald" : "rose"} icon={ok ? Check : X}>
      {ok ? yes : no}
    </Chip>
  );
}

function StageDetail({ stageId, reasoning }: { stageId: string; reasoning: ReasoningArtifact }) {
  if (stageId === "research") {
    const r = reasoning.research || {};
    return (
      <div className="space-y-2.5">
        <KV label="Business summary">{r.businessSummary}</KV>
        <div className="flex flex-wrap gap-1.5">
          {r.productCategory && <Chip tone="indigo">{r.productCategory}</Chip>}
          {r.productMaturity && <Chip tone="sky">{r.productMaturity}</Chip>}
          {r.likelyGtmMotion && <Chip tone="violet">{r.likelyGtmMotion}</Chip>}
          <SafeConfidence label={r.confidence} />
        </div>
        {r.observed?.length ? <KV label="Observed"><Bullets items={r.observed} /></KV> : null}
        {r.inferred?.length ? <KV label="Inferred"><Bullets items={r.inferred} /></KV> : null}
        {r.growthSignals?.length ? <KV label="Growth signals"><Bullets items={r.growthSignals} /></KV> : null}
        {r.gaps ? <KV label="Gaps / unknowns">{r.gaps}</KV> : null}
      </div>
    );
  }
  if (stageId === "problem") {
    const p = reasoning.problem || {};
    return (
      <div className="space-y-2.5">
        <KV label="Primary problem">{p.primaryProblem}</KV>
        <KV label="Business impact">{p.businessImpact}</KV>
        {p.possibleProblems?.length ? (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-400">Possible problems</p>
            <div className="mt-1 space-y-1.5">
              {p.possibleProblems.map((pp, i) => (
                <div key={i} className="rounded-lg border border-zinc-100 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-zinc-700">{pp.problem}</p>
                    <SafeConfidence label={pp.confidence} />
                  </div>
                  {pp.rationale && <p className="mt-0.5 text-[11px] text-zinc-500">{pp.rationale}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {p.observedEvidence?.length ? <KV label="Observed evidence"><Bullets items={p.observedEvidence} /></KV> : null}
      </div>
    );
  }
  if (stageId === "solution") {
    const s = reasoning.solution || {};
    return (
      <div className="space-y-2.5">
        <KV label="Strongest angle">{s.strongestAngle}</KV>
        {s.mappings?.length ? (
          <div className="space-y-1.5">
            {s.mappings.map((m, i) => (
              <div key={i} className="rounded-lg border border-zinc-100 p-2 text-[12px] text-zinc-600">
                <p className="font-medium text-zinc-700">{m.problem}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px]">
                  <ArrowRight className="h-3 w-3 text-zinc-400" /> {m.capability}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-600">
                  <ArrowRight className="h-3 w-3" /> {m.expectedOutcome}
                </p>
                {typeof m.strength === "number" && (
                  <div className="mt-1">
                    <ScoreBar label="strength" value={m.strength} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
        {s.rationale ? <KV label="Rationale">{s.rationale}</KV> : null}
      </div>
    );
  }
  if (stageId === "strategy") {
    const st = reasoning.strategy || {};
    return (
      <div className="space-y-2.5">
        <KV label="Conversation goal">{st.conversationGoal}</KV>
        <KV label="Opening angle">{st.openingAngle}</KV>
        <div className="grid grid-cols-2 gap-2">
          <KV label="Primary pain">{st.primaryPain}</KV>
          <KV label="Secondary pain">{st.secondaryPain}</KV>
        </div>
        <KV label="Product mapping">{st.productMapping}</KV>
        <div className="flex flex-wrap items-center gap-1.5">
          {st.ctaType && <Chip tone="sky">CTA: {st.ctaType}</Chip>}
          {st.riskLevel && (
            <Chip tone={st.riskLevel === "high" ? "rose" : st.riskLevel === "medium" ? "amber" : "emerald"}>
              {st.riskLevel} risk
            </Chip>
          )}
          {(st.focus || []).map((f, i) => (
            <Chip key={i} tone="indigo">{f}</Chip>
          ))}
        </div>
        {st.avoid?.length ? <KV label="Avoid"><Bullets items={st.avoid} /></KV> : null}
      </div>
    );
  }
  if (stageId === "generation") {
    const e = reasoning.email || {};
    return (
      <div className="space-y-2.5">
        <KV label="Chosen subject">{e.subject}</KV>
        {e.subjectAlternatives?.length ? (
          <KV label="Subject alternatives"><Bullets items={e.subjectAlternatives} /></KV>
        ) : null}
        {e.whyNow ? <KV label="Why now">{e.whyNow}</KV> : null}
        {e.cta ? <KV label="CTA">{e.cta}</KV> : null}
        <div className="flex items-center gap-1.5">
          <SafeConfidence label={e.confidenceLabel} />
          <Chip tone={e.ctaReady ? "emerald" : "zinc"}>{e.ctaReady ? "CTA ready" : "CTA held"}</Chip>
        </div>
        <p className="text-[10px] text-zinc-400">The full email body is shown in the card above.</p>
      </div>
    );
  }
  if (stageId === "review") {
    const rv = reasoning.review || {};
    const scores = rv.scores;
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-lg px-2 py-0.5 text-[12px] font-bold text-white", SCORE_BAR_COLOR[scoreTone(rv.overall || 0)])}>
            {rv.overall ?? 0}
          </span>
          <span className="text-[11px] text-zinc-500">overall quality {rv.wouldSend ? "· would send" : "· would NOT send"}</span>
        </div>
        {scores && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {Object.entries(scores).map(([k, v]) => (
              <ScoreBar key={k} label={k} value={v as number} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <CheckChip ok={rv.hasRealObservation} yes="Real observation" no="No real observation" />
          <CheckChip ok={!rv.soundsAiGenerated} yes="Human tone" no="Sounds AI" />
          <CheckChip ok={rv.connectsProblemToSolution} yes="Problem→solution" no="Weak link" />
          <CheckChip ok={rv.leadsToConversation} yes="Starts a convo" no="No hook" />
        </div>
        {rv.issues?.length ? <KV label="Issues"><Bullets items={rv.issues} /></KV> : null}
        {rv.improvementHints?.length ? <KV label="Improvement hints"><Bullets items={rv.improvementHints} /></KV> : null}
      </div>
    );
  }
  if (stageId === "approval") {
    const d = reasoning.disposition || {};
    const auto = d.decision === "auto_send";
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Chip tone={auto ? "emerald" : "amber"} icon={auto ? Zap : ShieldCheck}>
            {auto ? "Auto-send" : "Queue for approval"}
          </Chip>
          {d.mode && <Chip tone="zinc">{d.mode} mode</Chip>}
        </div>
        <KV label="Reason">{d.reason}</KV>
        <div className="flex flex-wrap gap-1.5">
          <CheckChip ok={d.qualityOk} yes="Quality OK" no="Below bar" />
          <CheckChip ok={d.confidenceOk} yes="Confidence OK" no="Low confidence" />
          <CheckChip ok={d.mailboxOk} yes="Mailbox healthy" no="Mailbox risk" />
        </div>
      </div>
    );
  }
  return null;
}

function ReasoningInspector({ reasoning }: { reasoning: ReasoningArtifact }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const stages = reasoning.stages && reasoning.stages.length ? reasoning.stages : DEFAULT_STAGE_ORDER;
  const overall = reasoning.review?.overall;

  return (
    <div className="rounded-xl border border-zinc-100 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
          <Brain className="h-3.5 w-3.5 text-orange-500" /> How Max reasoned this
        </span>
        <span className="flex items-center gap-2">
          {typeof overall === "number" && (
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white", SCORE_BAR_COLOR[scoreTone(overall)])}>
              {overall}
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-100 p-2">
          <div className="space-y-1">
            {stages.map((stage) => {
              const Icon = STAGE_ICON[stage.id] || Layers;
              const isOpen = expanded === stage.id;
              const skipped = stage.status === "skipped";
              return (
                <div key={stage.id} className="rounded-lg border border-zinc-100">
                  <button
                    onClick={() => setExpanded(isOpen ? null : stage.id)}
                    className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        skipped ? "bg-zinc-100 text-zinc-400" : "bg-orange-50 text-orange-600"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-zinc-800">{stage.label}</p>
                      {stage.headline && <p className="truncate text-[11px] text-zinc-500">{stage.headline}</p>}
                    </div>
                    <ChevronDown className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-zinc-100 px-2.5 py-2.5">
                      <StageDetail stageId={stage.id} reasoning={reasoning} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {reasoning.regenerated && (
            <p className="mt-2 flex items-center gap-1 px-1 text-[10px] text-zinc-400">
              <RefreshCw className="h-3 w-3" /> Max regenerated this after its own quality review.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SendTo({ opp, contact }: { opp: OutboundOpportunity; contact?: ContactRecord }) {
  const email = opp.recipientEmail || contact?.email || "";
  const verified = opp.recipientEmailVerified || contact?.emailVerified;
  return (
    <div className="mt-1 flex items-center gap-1.5 pl-5">
      <Mail className="h-3 w-3 shrink-0 text-zinc-400" />
      {email ? (
        <span className="truncate text-[11px] text-zinc-500">
          Send to <span className="font-medium text-zinc-700">{email}</span>
          {verified && <span className="ml-1 text-emerald-600">· verified</span>}
        </span>
      ) : (
        <span className="text-[11px] font-medium text-amber-600">
          Email not found yet — Eva is still enriching this contact.
        </span>
      )}
    </div>
  );
}

// Live "Max is writing" state shown in place of a lead's message while its
// personalized email is still being reasoned in the background — so the queue
// feels alive (Max working on THIS company) instead of showing a bare template.
function GeneratingDraft({ company }: { company?: string }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3.5">
      <div className="flex items-center gap-2">
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300/50" />
          <Sparkles className="relative h-4 w-4 text-violet-500" />
        </span>
        <p className="text-[12.5px] font-semibold text-violet-700">
          Max is writing a personalized email{company ? <> for {company}</> : null}…
        </p>
      </div>
      <div className="mt-3 space-y-2" aria-hidden>
        {["94%", "100%", "86%", "72%", "60%"].map((w, i) => (
          <div
            key={i}
            className="h-2.5 animate-pulse rounded-full bg-violet-200/70"
            style={{ width: w, animationDelay: `${i * 160}ms` }}
          />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-violet-500/90">
        <span className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
        Researching the account and drafting the angle
      </p>
    </div>
  );
}

function OpportunityCard({
  opp,
  account,
  contact,
  accountContacts,
  generating = false,
  onAction,
  onRegenerate,
  onChangeContact,
}: {
  opp: OutboundOpportunity;
  account?: AccountRecord;
  contact?: ContactRecord;
  accountContacts: ContactRecord[];
  generating?: boolean;
  onAction: (action: string, payload?: Record<string, unknown>) => void;
  onRegenerate: () => Promise<void>;
  onChangeContact: (contactId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(opp.draft);
  const [regenerating, setRegenerating] = useState(false);
  useEffect(() => setDraft(opp.draft), [opp.draft]);

  const action = ACTION_META[opp.recommendedAction];
  const sent = opp.approvalState === "sent";
  const approved = opp.approvalState === "approved";
  const skipped = opp.approvalState === "skipped";

  const handleRegen = async () => {
    setRegenerating(true);
    try {
      await onRegenerate();
      toast.success("Max rewrote this draft");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rewrite the draft");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: skipped ? 0.5 : 1, y: 0 }}
      className={cn(
        "flex flex-col rounded-2xl border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        sent ? "border-emerald-200 ring-1 ring-emerald-100" : "border-zinc-200/80"
      )}
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark seed={account?.logoSeed || "AC"} className="h-10 w-10" />
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-zinc-900">{account?.company || "Account"}</h3>
              <p className="truncate text-[11px] text-zinc-400">
                {account?.segment} · {account?.employeeRange} · {account?.hqLocation}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded-lg bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white">{opp.fitScore}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-400">fit</span>
            </div>
            <Chip tone={action.tone}>{action.label}</Chip>
          </div>
        </div>

        {/* contact + send-to */}
        <div className="flex items-start justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px]">
              <UsersIcon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              {contact ? (
                <span className="text-zinc-600">
                  <span className="font-semibold text-zinc-800">{contact.name || opp.recipientName || "Contact"}</span>
                  {contact.role ? <> · {contact.role}</> : null}
                  <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-400">
                    {contact.entryPointType.replace("_", " ")}
                  </span>
                </span>
              ) : (
                <span className="font-semibold text-zinc-800">{opp.recipientName || "No contact selected"}</span>
              )}
            </div>
            <SendTo opp={opp} contact={contact} />
          </div>
          {accountContacts.length > 1 && (
            <Select value={contact?.id} onValueChange={onChangeContact}>
              <SelectTrigger className="h-7 w-[130px] shrink-0 rounded-lg border-zinc-200 text-[11px]">
                <SelectValue placeholder="Change" />
              </SelectTrigger>
              <SelectContent>
                {accountContacts.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-[12px]">
                    {c.name} · {c.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* why now + signals */}
        <div>
          <p className="mb-1.5 text-[13px] leading-relaxed text-zinc-600">
            <span className="font-semibold text-zinc-700">Why now:</span> {opp.whyNow}
          </p>
          <SignalChips bundle={opp.signalBundle} />
        </div>

        {/* draft — while Max is still reasoning this lead, show a live "generating"
            animation with the company name instead of the bare template message, so
            the user sees Max actively working on THIS lead rather than feeling stuck. */}
        {generating ? (
          <GeneratingDraft company={account?.company} />
        ) : (
        <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3.5">
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
                className="resize-none border-zinc-200 bg-white text-[13px] leading-relaxed"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDraft(opp.draft); setEditing(false); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 bg-zinc-900 text-xs hover:bg-zinc-800"
                  onClick={() => { onAction("edit", { draft }); setEditing(false); toast.success("Draft updated"); }}
                >
                  Save draft
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-300">
                Subject · {opp.subject}
              </p>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-700">{opp.draft}</p>
              <div className="mt-2.5 flex items-center gap-1.5 border-t border-zinc-200/70 pt-2.5 text-[12px] font-medium text-zinc-500">
                <CalendarClock className="h-3.5 w-3.5 text-zinc-400" />
                {opp.ctaReady ? (
                  <span><span className="font-semibold text-zinc-600">CTA:</span> {opp.ctaDraft}</span>
                ) : (
                  <span className="text-zinc-400">CTA held — {TIER_CONFIG[opp.acvTier].ctaDelay}</span>
                )}
              </div>
            </>
          )}
        </div>
        )}

        {/* multi-stage reasoning inspector */}
        {opp.reasoning && <ReasoningInspector reasoning={opp.reasoning} />}
      </div>

      {/* action bar */}
      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <ConfidenceChip label={opp.confidenceLabel} />
          {opp.draftSource === "pipeline" ? (
            <Chip tone="violet" icon={Brain}>Max reasoned</Chip>
          ) : opp.draftSource === "llm" ? (
            <span className="text-[10px] font-medium text-zinc-400">· Max-written</span>
          ) : null}
          {typeof opp.qualityReview?.overall === "number" && (
            <Chip tone={scoreTone(opp.qualityReview.overall)} icon={Gauge}>
              Q {opp.qualityReview.overall}
            </Chip>
          )}
          {opp.disposition?.decision === "auto_send" && (
            <Chip tone="emerald" icon={Zap}>Auto-send</Chip>
          )}
        </div>
        <div className="flex items-center gap-1">
          {generating ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Personalizing…
            </span>
          ) : (
            <>
              <IconAction title="Edit draft" onClick={() => setEditing((e) => !e)} icon={Pencil} />
              <IconAction title="Regenerate angle" onClick={handleRegen} icon={RefreshCw} spinning={regenerating} />
              <IconAction title="Skip" onClick={() => onAction("skip")} icon={Trash2} danger />
              {sent ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <CheckCheck className="h-3.5 w-3.5" /> Sent
                </span>
              ) : approved ? (
                <Button size="sm" className="h-7 gap-1 bg-emerald-600 text-[11px] font-semibold hover:bg-emerald-700" onClick={() => onAction("send")}>
                  <Send className="h-3.5 w-3.5" /> Send now
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="h-7 gap-1 border-zinc-200 text-[11px]" onClick={() => onAction("approve")}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" className="h-7 gap-1 bg-zinc-900 text-[11px] font-semibold hover:bg-zinc-800" onClick={() => onAction("send")}>
                    <Send className="h-3.5 w-3.5" /> Send
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MediumMode({
  workspace,
  onOppAction,
  onRegenerate,
}: {
  workspace: MaxWorkspace;
  onOppAction: (opp: OutboundOpportunity, action: string, payload?: Record<string, unknown>) => void;
  onRegenerate: (opp: OutboundOpportunity) => Promise<void>;
}) {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const accById = useMemo(() => new Map(workspace.accounts.map((a) => [a.id, a])), [workspace.accounts]);
  const conById = useMemo(() => new Map(workspace.contacts.map((c) => [c.id, c])), [workspace.contacts]);
  const contactsByAccount = useMemo(() => {
    const m = new Map<string, ContactRecord[]>();
    workspace.contacts.forEach((c) => {
      const list = m.get(c.accountId) || [];
      list.push(c);
      m.set(c.accountId, list);
    });
    return m;
  }, [workspace.contacts]);

  const queue = useMemo(
    () =>
      applyQueueFilter(
        workspace.opportunities.filter((o) => o.acvTier === "medium" && o.approvalState !== "skipped"),
        filter
      ),
    [workspace.opportunities, filter]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <QueueFilterBar value={filter} onChange={setFilter} />
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 py-16 text-zinc-400">
            <Info className="h-5 w-5" />
            <p className="text-sm font-medium">No medium-ACV opportunities queued yet.</p>
          </div>
        ) : (
          <AnimatePresence>
            {queue.map((o) => (
              <OpportunityCard
                key={o.id}
                opp={o}
                account={accById.get(o.accountId)}
                contact={conById.get(o.contactId || "") || (contactsByAccount.get(o.accountId) || [])[0]}
                accountContacts={contactsByAccount.get(o.accountId) || []}
                generating={!!workspace.reasoningInProgress && o.draftSource !== "pipeline"}
                onAction={(action, payload) => onOppAction(o, action, payload)}
                onRegenerate={() => onRegenerate(o)}
                onChangeContact={(cid) => onOppAction(o, "change_contact_local", { contact_id: cid })}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
      <div className="space-y-4">
        <InsightsPanel workspace={workspace} />
        <SourceHealth workspace={workspace} />
      </div>
    </div>
  );
}

function InsightsPanel({ workspace }: { workspace: MaxWorkspace }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
      <PanelTitle icon={Sparkles}>What Max is learning</PanelTitle>
      <div className="space-y-2.5">
        {workspace.insights.map((ins) => (
          <div key={ins.id} className="rounded-xl border border-zinc-100 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <ConfidenceChip label={ins.confidenceLabel} />
              {ins.tier && <span className="text-[9px] font-semibold uppercase text-zinc-400">{ins.tier} ACV</span>}
            </div>
            <p className="text-[12px] font-medium leading-snug text-zinc-700">{ins.pattern}</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-400">{ins.evidence}</p>
            {ins.recommendedChange && (
              <p className="mt-1.5 flex gap-1.5 text-[11px] text-zinc-500">
                <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-orange-400" />
                {ins.recommendedChange}
              </p>
            )}
          </div>
        ))}
        {workspace.insights.length === 0 && (
          <p className="py-6 text-center text-[12px] text-zinc-400">Not enough data to form a pattern yet.</p>
        )}
      </div>
    </div>
  );
}

// ─── High ACV mode — account intelligence workspace ──────────────────────────────

function AccountListItem({ account, active, onClick }: { account: AccountRecord; active: boolean; onClick: () => void }) {
  const mom = MOMENTUM_META[account.momentum];
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        active ? "border-orange-300 bg-orange-50/60 ring-1 ring-orange-100" : "border-zinc-100 hover:bg-zinc-50"
      )}
    >
      <LogoMark seed={account.logoSeed} tone="indigo" className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-zinc-800">{account.company}</p>
        <p className="truncate text-[10.5px] text-zinc-400">{account.segment} · {account.employeeRange}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-[11px] font-bold text-zinc-700">{account.priority}</span>
        <Chip tone={mom.tone} icon={mom.icon}>{mom.label}</Chip>
      </div>
    </button>
  );
}

function BriefSection({ icon: Icon, title, children }: { icon: typeof Radar; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
      <PanelTitle icon={Icon}>{title}</PanelTitle>
      {children}
    </div>
  );
}

function AccountBriefView({
  account,
  brief,
  loading,
  onRefresh,
  onAddJournal,
}: {
  account: AccountRecord;
  brief: AccountBrief | null;
  loading: boolean;
  onRefresh: () => void;
  onAddJournal: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onAddJournal(note.trim());
      setNote("");
      toast.success("Note added to the account journal");
    } catch {
      toast.error("Couldn't save the note");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !brief) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        <p className="text-sm font-medium">Max is assembling the account brief…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* narrative + recommended action */}
      <BriefSection icon={Briefcase} title="Account narrative">
        <p className="text-[13px] leading-relaxed text-zinc-600">{brief.narrative}</p>
        <div className="mt-3 rounded-xl bg-orange-50/60 p-3">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-orange-600">Recommended angle</p>
            <ConfidenceChip label={brief.angleConfidence} />
          </div>
          <p className="text-[13px] font-medium leading-relaxed text-zinc-700">{brief.recommendedAngle}</p>
          {brief.angleRationale && <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">{brief.angleRationale}</p>}
        </div>
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-zinc-100 p-3">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Recommended next action</p>
            <p className="text-[13px] leading-relaxed text-zinc-700">{brief.recommendedNextAction}</p>
          </div>
        </div>
        {brief.whyNotNow && (
          <p className="mt-2 flex gap-1.5 text-[12px] leading-relaxed text-amber-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span><span className="font-semibold">Why not now:</span> {brief.whyNotNow}</span>
          </p>
        )}
      </BriefSection>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* buying committee / multi-thread */}
        <BriefSection icon={GitBranch} title="Buying committee & threads">
          <div className="space-y-2">
            {brief.buyingCommittee.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-zinc-800">{m.name}</p>
                  <p className="truncate text-[10.5px] text-zinc-400">{m.role} · {m.department}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Chip tone={m.influence === "high" ? "rose" : "sky"}>{m.influence}</Chip>
                  <Chip tone="zinc">{m.entryPointType.replace("_", " ")}</Chip>
                </div>
              </div>
            ))}
            {brief.buyingCommittee.length === 0 && (
              <p className="py-4 text-center text-[12px] text-zinc-400">No committee mapped yet.</p>
            )}
          </div>
        </BriefSection>

        {/* signal timeline */}
        <BriefSection icon={Activity} title="Signal timeline">
          <div className="space-y-2.5">
            {brief.signalTimeline.map((t, i) => (
              <div key={i} className="relative border-l-2 border-zinc-100 pl-3.5">
                <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-orange-400" />
                <div className="mb-0.5 flex items-center gap-1.5">
                  <Chip tone={SIGNAL_META[t.type]?.tone || "zinc"}>{SIGNAL_META[t.type]?.label || t.type}</Chip>
                </div>
                <p className="text-[12px] font-medium text-zinc-700">{t.detail}</p>
                {t.interpretation && <p className="text-[10.5px] leading-relaxed text-zinc-400">{t.interpretation}</p>}
              </div>
            ))}
            {brief.signalTimeline.length === 0 && (
              <p className="py-4 text-center text-[12px] text-zinc-400">No signals recorded yet.</p>
            )}
          </div>
        </BriefSection>
      </div>

      {/* journal */}
      <BriefSection icon={Pencil} title="Account journal">
        <div className="flex items-end gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={1}
            placeholder="Add a call note, observation or next step…"
            className="max-h-24 min-h-[38px] resize-none border-zinc-200 text-[13px]"
          />
          <Button size="sm" className="h-9 shrink-0 bg-zinc-900 text-xs hover:bg-zinc-800" onClick={addNote} disabled={saving || !note.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {(brief.journal || []).map((j, i) => (
            <div key={i} className="rounded-xl bg-zinc-50 px-3 py-2">
              <p className="text-[12.5px] text-zinc-700">{j.note}</p>
              <p className="mt-0.5 text-[10px] text-zinc-400">{new Date(j.at).toLocaleString()} · {j.author}</p>
            </div>
          ))}
          {(!brief.journal || brief.journal.length === 0) && (
            <p className="py-3 text-center text-[11.5px] text-zinc-400">No journal notes yet.</p>
          )}
        </div>
      </BriefSection>
    </div>
  );
}

function HighMode({
  workspace,
  selectedId,
  brief,
  briefLoading,
  onSelect,
  onRefreshBrief,
  onAddJournal,
}: {
  workspace: MaxWorkspace;
  selectedId: string | null;
  brief: AccountBrief | null;
  briefLoading: boolean;
  onSelect: (id: string) => void;
  onRefreshBrief: () => void;
  onAddJournal: (note: string) => Promise<void>;
}) {
  const highAccounts = useMemo(
    () => workspace.accounts.filter((a) => a.acvTier === "high").sort((a, b) => b.priority - a.priority),
    [workspace.accounts]
  );
  const selected = highAccounts.find((a) => a.id === selectedId) || null;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-4">
          <PanelTitle icon={Target} right={<span className="text-[10px] font-medium text-zinc-400">{highAccounts.length}</span>}>
            Target accounts
          </PanelTitle>
          <div className="space-y-2">
            {highAccounts.map((a) => (
              <AccountListItem key={a.id} account={a} active={a.id === selectedId} onClick={() => onSelect(a.id)} />
            ))}
            {highAccounts.length === 0 && (
              <p className="py-8 text-center text-[12px] text-zinc-400">No high-ACV accounts tracked yet.</p>
            )}
          </div>
        </div>
      </div>
      <div>
        {selected ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl border border-zinc-200/70 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <LogoMark seed={selected.logoSeed} tone="indigo" className="h-10 w-10" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{selected.company}</p>
                  <p className="text-[11px] text-zinc-400">{selected.industry} · {selected.hqLocation}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs" onClick={onRefreshBrief}>
                <RefreshCw className={cn("h-3.5 w-3.5", briefLoading && "animate-spin")} /> Refresh brief
              </Button>
            </div>
            <AccountBriefView
              account={selected}
              brief={brief}
              loading={briefLoading}
              onRefresh={onRefreshBrief}
              onAddJournal={onAddJournal}
            />
          </>
        ) : (
          <div className="flex h-[50vh] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 text-zinc-400">
            <Eye className="h-5 w-5" />
            <p className="text-sm font-medium">Select a target account to open its brief.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Max chat sidebar ────────────────────────────────────────────────────────────

function MaxChat({
  workspace,
  spaceId,
  open,
  onClose,
}: {
  workspace: MaxWorkspace;
  spaceId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<MaxChatMessage[]>([
    {
      role: "max",
      content:
        "I'm Max, your outbound head. I monitor signals across sources, qualify accounts by ACV, draft the outreach, and explain every call I make. Ask me who to contact, whether a signal matters, or when to ask for the meeting.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (forced?: string) => {
    const text = (forced ?? input).trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await maxAPI.chat(text, workspace, spaceId);
      setMessages((m) => [...m, { role: "max", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "max", content: "I hit a snag answering that. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className={cn("fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden", open ? "block" : "hidden")}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-zinc-200/70 bg-white shadow-2xl transition-transform duration-300",
          "lg:static lg:z-auto lg:w-[380px] lg:max-w-none lg:shrink-0 lg:bg-white/70 lg:shadow-none lg:backdrop-blur-xl lg:transition-none",
          open ? "translate-x-0" : "translate-x-full lg:hidden"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <MaxAvatar className="h-9 w-9 ring-2 ring-orange-100" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">Max</p>
              <p className="text-[10px] font-medium text-zinc-400">Outbound Head · always on</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 py-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                    m.role === "user"
                      ? "whitespace-pre-line rounded-br-sm bg-zinc-900 text-white"
                      : "rounded-bl-sm bg-zinc-100 text-zinc-700"
                  )}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
                        li: ({ children }) => <li className="marker:text-zinc-400">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-zinc-900">{children}</strong>,
                        code: ({ children }) => <code className="rounded bg-zinc-200 px-1 py-0.5 text-[11px]">{children}</code>,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 px-4 py-2.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={loading}
              className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10.5px] font-medium text-zinc-500 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="border-t border-zinc-100 p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 focus-within:border-orange-300">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder="Ask Max about the accounts…"
              className="max-h-28 min-h-[36px] resize-none border-0 bg-transparent p-1 text-[13px] shadow-none focus-visible:ring-0"
            />
            <Button
              size="icon"
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="h-9 w-9 shrink-0 rounded-xl bg-orange-600 hover:bg-orange-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function Max() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const [acvTier, setAcvTier] = useState<ACVTier>("medium");
  const [workspace, setWorkspace] = useState<MaxWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genStage, setGenStage] = useState<MonitorStage | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [modeBusy, setModeBusy] = useState(false);
  const [confirmAutopilot, setConfirmAutopilot] = useState(false);

  const [selectedHighId, setSelectedHighId] = useState<string | null>(null);
  const [brief, setBrief] = useState<AccountBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const reqRef = useRef(0);

  const loadWorkspace = useCallback(
    async (force: boolean, isScan: boolean) => {
      const my = ++reqRef.current;
      setError(null);
      setGenStage("starting");
      if (isScan) setScanning(true);
      else setLoading(true);
      try {
        const ws = isScan
          ? await maxAPI.scan(spaceId || "demo", acvTier, (s) => my === reqRef.current && setGenStage(s))
          : await maxAPI.getWorkspace(spaceId || "demo", acvTier, force, (s) => my === reqRef.current && setGenStage(s));
        if (my !== reqRef.current) return;
        setWorkspace(ws);
        if (isScan) toast.success("Max refreshed the signal feed");
      } catch (e) {
        if (my !== reqRef.current) return;
        const msg = e instanceof Error ? e.message : "Couldn't load your outbound workspace";
        setError(msg);
        if (isScan) toast.error("Couldn't scan sources");
        else setWorkspace(null);
      } finally {
        if (my !== reqRef.current) return;
        setGenStage(null);
        if (isScan) setScanning(false);
        else setLoading(false);
      }
    },
    [spaceId, acvTier]
  );

  // Initial load only (tier switches are client-side — the workspace holds all tiers).
  useEffect(() => {
    loadWorkspace(false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  // Max marks the workspace ready fast (template drafts), then reasons the top
  // opportunities in the background. While that runs, silently refetch so the
  // personalized drafts replace the templates live — no manual reload needed.
  useEffect(() => {
    if (!workspace?.reasoningInProgress) return;
    let cancelled = false;
    const deadline = Date.now() + 5 * 60 * 1000;
    (async () => {
      while (!cancelled && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        if (cancelled) break;
        try {
          const ws = await maxAPI.getWorkspace(spaceId || "demo", acvTier, false);
          if (cancelled) break;
          setWorkspace(ws);
          if (!ws.reasoningInProgress) break;
        } catch {
          /* transient hiccup — keep polling until the deadline */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.reasoningInProgress]);

  const metrics = useMemo<MaxMetrics | null>(
    () => (workspace ? computeMetrics(workspace, acvTier) : null),
    [workspace, acvTier]
  );

  // High-ACV: keep a selected account + load its brief.
  const loadBrief = useCallback(
    async (account: AccountRecord) => {
      setBriefLoading(true);
      setBrief(null);
      try {
        const accContacts = (workspace?.contacts || []).filter((c) => c.accountId === account.id);
        const accSignals = workspace?.signals || [];
        const cached = workspace?.briefs?.[account.id];
        if (cached) {
          setBrief(cached);
        } else {
          const b = await maxAPI.getBrief(spaceId, account, accContacts, accSignals);
          setBrief(b);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't load the account brief");
      } finally {
        setBriefLoading(false);
      }
    },
    [spaceId, workspace]
  );

  useEffect(() => {
    if (acvTier !== "high" || !workspace) return;
    const highAccounts = workspace.accounts.filter((a) => a.acvTier === "high");
    if (highAccounts.length === 0) {
      setSelectedHighId(null);
      setBrief(null);
      return;
    }
    const stillValid = selectedHighId && highAccounts.some((a) => a.id === selectedHighId);
    const target = stillValid ? highAccounts.find((a) => a.id === selectedHighId)! : highAccounts[0];
    if (!stillValid) setSelectedHighId(target.id);
    loadBrief(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acvTier, workspace, selectedHighId]);

  // ── mutations ──
  const setOpp = (oppId: string, patch: Partial<OutboundOpportunity>) =>
    setWorkspace((ws) =>
      ws ? { ...ws, opportunities: ws.opportunities.map((o) => (o.id === oppId ? { ...o, ...patch } : o)) } : ws
    );
  const setAccStatus = (accId: string, status: AccountRecord["status"]) =>
    setWorkspace((ws) =>
      ws ? { ...ws, accounts: ws.accounts.map((a) => (a.id === accId ? { ...a, status } : a)) } : ws
    );

  const onOppAction = (opp: OutboundOpportunity, action: string, payload?: Record<string, unknown>) => {
    if (action === "approve") setOpp(opp.id, { approvalState: "approved" });
    else if (action === "send") {
      setOpp(opp.id, { approvalState: "sent" });
      setAccStatus(opp.accountId, "contacted");
      toast.success("Warm email sent");
    } else if (action === "skip") setOpp(opp.id, { approvalState: "skipped" });
    else if (action === "edit") setOpp(opp.id, { draft: String(payload?.draft ?? opp.draft) });
    else if (action === "change_contact_local") {
      setOpp(opp.id, { contactId: String(payload?.contact_id) });
      void maxAPI.opportunityAction(spaceId, opp.id, "change_contact", payload);
      return;
    }
    const backendAction = action === "change_contact_local" ? "change_contact" : action;
    void maxAPI.opportunityAction(spaceId, opp.id, backendAction, payload);
  };

  const onRegenerateOpp = async (opp: OutboundOpportunity) => {
    const updated = await maxAPI.regenerateMessage(spaceId, opp.id);
    if (updated) setOpp(opp.id, updated);
  };

  const onAddJournal = async (note: string) => {
    if (!selectedHighId) return;
    const updated = await maxAPI.addJournalNote(spaceId, selectedHighId, note);
    if (updated) setBrief(updated);
    else if (brief) {
      // demo: append locally
      setBrief({ ...brief, journal: [{ note, at: new Date().toISOString(), author: "founder" }, ...(brief.journal || [])] });
    }
  };

  const cfg = TIER_CONFIG[acvTier];
  const outboundMode = workspace?.outboundMode ?? "approval";
  const autopilotOn = outboundMode === "autopilot";

  // Toggle Max's outbound autonomy. Autopilot sends quality-checked drafts
  // directly (each still passes the review + deliverability double-check on the
  // backend); approval queues every draft for a human. Optimistic with revert.
  const applyOutboundMode = async (next: "autopilot" | "approval") => {
    const prev = workspace?.outboundMode ?? "approval";
    setConfirmAutopilot(false);
    setModeBusy(true);
    setWorkspace((ws) => (ws ? { ...ws, outboundMode: next } : ws));
    try {
      const res = await maxAPI.setOutboundMode(spaceId, next, true);
      if (next === "autopilot") {
        const sent = res.sent ?? 0;
        toast.success(
          sent > 0
            ? `Autopilot on — Max sent ${sent} quality-checked email${sent === 1 ? "" : "s"}.`
            : "Autopilot on — Max will send quality-checked emails as leads qualify."
        );
        void loadWorkspace(false, false); // refresh so freshly-sent items reflect
      } else {
        toast.success("Autopilot paused — Max will queue every draft for your approval.");
      }
    } catch (e) {
      setWorkspace((ws) => (ws ? { ...ws, outboundMode: prev } : ws)); // revert
      toast.error(e instanceof Error ? e.message : "Couldn't update autopilot mode");
    } finally {
      setModeBusy(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar spaceId={spaceId!} onNewChat={() => navigate("/spaces")} onSelectConversation={() => {}} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="z-30 flex h-16 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <MaxAvatar className="h-9 w-9 ring-2 ring-orange-100 shadow-sm" />
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Outbound Head</span>
              <span className="text-sm font-semibold text-zinc-900">Max · Outbound command center</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 border-orange-200 bg-orange-50 text-[9px] font-bold uppercase tracking-wider text-orange-700">
              <Radar className="h-3 w-3" /> {cfg.label}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 rounded-full text-xs transition-colors",
                autopilotOn
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                  : "border-zinc-200"
              )}
              onClick={() => (autopilotOn ? applyOutboundMode("approval") : setConfirmAutopilot(true))}
              disabled={modeBusy || loading || !workspace}
              title={
                autopilotOn
                  ? "Autopilot is on — Max sends quality-checked emails automatically. Click to switch back to approval."
                  : "Turn on autopilot — Max sends each draft automatically after a quality + deliverability double-check."
              }
            >
              {modeBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : autopilotOn ? (
                <Zap className="h-3.5 w-3.5" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{autopilotOn ? "Autopilot on" : "Autopilot off"}</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  autopilotOn ? "bg-emerald-500" : "bg-zinc-300"
                )}
              />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={() => loadWorkspace(true, true)}
              disabled={scanning || loading}
              title="Force a fresh scan across all event sources"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", scanning && "animate-spin")} />
              <span className="hidden sm:inline">Scan sources</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs lg:hidden"
              onClick={() => setChatOpen((o) => !o)}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Max
            </Button>
          </div>
        </header>

        <AlertDialog open={confirmAutopilot} onOpenChange={setConfirmAutopilot}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600" /> Turn on autopilot?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2.5 text-left">
                <span className="block">
                  Max will send outbound emails automatically — including the leads already approved
                  in your queue.
                </span>
                <span className="block rounded-lg bg-zinc-50 p-3 text-[12.5px] leading-relaxed text-zinc-600">
                  <span className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-700">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Every email is
                    double-checked before it goes out:
                  </span>
                  <span className="block">• a quality review scores the draft and only sends if it passes;</span>
                  <span className="block">• the recipient address is verified (syntax + deliverability) at send time.</span>
                </span>
                <span className="block">You can switch back to approval anytime.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep approval</AlertDialogCancel>
              <AlertDialogAction
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => applyOutboundMode("autopilot")}
              >
                Turn on autopilot
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-5 px-6 pb-10 pt-6 lg:px-8">
            {loading ? (
              <MonitorProgress stage={genStage} />
            ) : error && !workspace ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-700">Max couldn't reach your workspace</p>
                  <p className="mx-auto mt-0.5 max-w-md text-xs text-zinc-500">{error}</p>
                </div>
                <Button onClick={() => loadWorkspace(true, false)} className="mt-1 h-9 gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold hover:bg-zinc-800">
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            ) : workspace && metrics ? (
              <>
                {scanning && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50/70 px-4 py-2.5 text-[12px] font-medium text-orange-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Max is scanning event sources — {GEN_STEPS[genStepIndex(genStage)]?.label ?? "working"}…</span>
                  </div>
                )}
                {workspace.isDemo && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>
                      Showing <span className="font-semibold">sample accounts</span> — this space isn't linked to a real brand,
                      so Max can't monitor live sources here. Open a real workspace to track your market.
                    </span>
                  </div>
                )}
                {!workspace.isDemo && workspace.isSample && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>
                      Showing <span className="font-semibold">illustrative sample accounts</span> — Eva hasn't handed off real
                      qualified leads yet. Once discovery produces real leads, Max replaces these with your actual market and
                      writes a personalized message for each one.
                    </span>
                  </div>
                )}
                {!workspace.isDemo && workspace.reasoningInProgress && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-2.5 text-[12px] font-medium text-violet-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Max is researching each lead and personalizing its message — drafts refine themselves as it finishes.</span>
                  </div>
                )}

                <SummaryHeader workspace={workspace} metrics={metrics} acvTier={acvTier} onTierChange={setAcvTier} />

                {acvTier === "low" && <LowMode workspace={workspace} metrics={metrics} onOppAction={(o, a) => onOppAction(o, a)} />}
                {acvTier === "medium" && (
                  <MediumMode workspace={workspace} onOppAction={onOppAction} onRegenerate={onRegenerateOpp} />
                )}
                {acvTier === "high" && (
                  <HighMode
                    workspace={workspace}
                    selectedId={selectedHighId}
                    brief={brief}
                    briefLoading={briefLoading}
                    onSelect={setSelectedHighId}
                    onRefreshBrief={() => {
                      const acc = workspace.accounts.find((a) => a.id === selectedHighId);
                      if (acc) {
                        // Force a fresh brief.
                        setBriefLoading(true);
                        setBrief(null);
                        maxAPI
                          .getBrief(spaceId, acc, workspace.contacts.filter((c) => c.accountId === acc.id), workspace.signals, true)
                          .then(setBrief)
                          .catch(() => toast.error("Couldn't refresh the brief"))
                          .finally(() => setBriefLoading(false));
                      }
                    }}
                    onAddJournal={onAddJournal}
                  />
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {workspace && <MaxChat workspace={workspace} spaceId={spaceId} open={chatOpen} onClose={() => setChatOpen(false)} />}

      {workspace && !chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 hidden h-12 items-center gap-2 rounded-full bg-gradient-to-br from-orange-500 to-rose-600 pl-2 pr-5 text-sm font-semibold text-white shadow-xl transition-transform hover:scale-105 lg:flex"
        >
          <MaxAvatar className="h-8 w-8 ring-1 ring-white/40" /> Ask Max
        </button>
      )}
    </div>
  );
}
