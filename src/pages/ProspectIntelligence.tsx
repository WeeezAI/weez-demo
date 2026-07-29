// pages/ProspectIntelligence.tsx
//
// Prospect Intelligence — the decision-maker view over Eva's qualified leads.
// It reads the *same* Cosmos-backed workspace Eva does (GET /eva/workspace →
// eva_leads container) and reshapes it: leads grouped by company, the resolved
// decision-maker per lead, and a dossier that answers who / why them / why now
// / what to open with.
//
// Grounding rule: every number and sentence on this page comes from a field on
// the workspace payload. Nothing is scored, invented or rotated client-side.
// When a field is missing we say so instead of filling the gap.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  Brain,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Layers,
  Linkedin,
  Loader2,
  Mail,
  MailCheck,
  MapPin,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Signal as SignalIcon,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConversationSidebar from "@/components/ConversationSidebar";
import {
  evaAPI,
  ACTION_META,
  ENRICHMENT_META,
  SIGNAL_META,
  TIER_META,
  type ACVTier,
  type ChannelSignal,
  type EvaAction,
  type EvaWorkspace,
  type QualifiedLead,
  type ScanStage,
} from "@/services/evaAPI";

// ─── Tone → tailwind chip classes (same palette as Eva / Max) ──────────────────

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

function PanelTitle({
  icon: Icon,
  children,
  right,
}: {
  icon: typeof Target;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
        <Icon className="h-3.5 w-3.5" /> {children}
      </p>
      {right}
    </div>
  );
}

function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white/70 px-3.5 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold leading-none text-zinc-900", tone)}>{value}</p>
      {sub && <p className="mt-1 text-[10px] font-medium text-zinc-400">{sub}</p>}
    </div>
  );
}

function LogoMark({ seed, className = "h-9 w-9" }: { seed: string; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white", className)}
      style={{ background: "linear-gradient(135deg,#8b5cf6,#0ea5e9)" }}
    >
      {seed}
    </div>
  );
}

// Brand logo with graceful fallback: backend logoUrl → favicon → initials.
function CompanyLogo({
  logoUrl,
  domain,
  company,
  className = "h-9 w-9",
}: {
  logoUrl?: string;
  domain?: string;
  company: string;
  className?: string;
}) {
  const seed = (company || "AC").slice(0, 2).toUpperCase();
  const favicon = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : "";
  const sources = useMemo(() => [logoUrl, favicon].filter(Boolean) as string[], [logoUrl, favicon]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [logoUrl, domain]);

  if (idx >= sources.length) return <LogoMark seed={seed} className={className} />;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-xl border border-zinc-200/70 bg-white", className)}>
      <img
        src={sources[idx]}
        alt={`${company} logo`}
        onError={() => setIdx((i) => i + 1)}
        className="h-full w-full object-contain p-1"
      />
    </div>
  );
}

// ─── Small grounded formatters ────────────────────────────────────────────────

/** Confidence fields arrive either as 0–1 fractions or 0–100. Normalise, never invent. */
function toPercent(value?: number | null): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value <= 1 ? value * 100 : value);
}

function relTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/** Backend prefixes primaryEvent with "[event_type] " — strip it for display. */
function stripEventPrefix(text?: string | null): string {
  return (text || "").replace(/^\[[^\]]+\]\s*/, "").trim();
}

function hostOf(lead: QualifiedLead): string {
  return (lead.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "") || lead.domain || "";
}

// ─── Company grouping (the only derivation this page performs) ────────────────

const TIER_ORDER: Record<ACVTier, number> = { low: 0, medium: 1, high: 2 };

interface CompanyGroup {
  key: string;
  company: string;
  domain: string;
  website: string;
  logoUrl?: string;
  industry: string;
  employeeRange: string;
  hqLocation: string;
  leads: QualifiedLead[];
  bestFit: number;
  topTier: ACVTier;
  signals: ChannelSignal[];
  contactsWithEmail: number;
  handedCount: number;
  lastActivity: string;
}

function groupByCompany(leads: QualifiedLead[]): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>();

  for (const lead of leads) {
    const key = (lead.domain || lead.company || lead.id).toLowerCase();
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        company: lead.company,
        domain: lead.domain,
        website: lead.website,
        logoUrl: lead.logoUrl,
        industry: lead.industry,
        employeeRange: lead.employeeRange,
        hqLocation: lead.hqLocation,
        leads: [],
        bestFit: lead.icpFit,
        topTier: lead.acvTier,
        signals: [],
        contactsWithEmail: 0,
        handedCount: 0,
        lastActivity: "",
      };
      map.set(key, group);
    }
    group.leads.push(lead);
    group.industry = group.industry || lead.industry;
    group.employeeRange = group.employeeRange || lead.employeeRange;
    group.hqLocation = group.hqLocation || lead.hqLocation;
    group.website = group.website || lead.website;
    group.logoUrl = group.logoUrl || lead.logoUrl;
    if (lead.icpFit > group.bestFit) group.bestFit = lead.icpFit;
    if (TIER_ORDER[lead.acvTier] > TIER_ORDER[group.topTier]) group.topTier = lead.acvTier;
    if (lead.contact?.email) group.contactsWithEmail += 1;
    if (lead.handoffState === "handed_to_max") group.handedCount += 1;
    const stamp = lead.updatedAt || lead.createdAt || "";
    if (stamp > group.lastActivity) group.lastActivity = stamp;
  }

  for (const group of map.values()) {
    const seen = new Set<string>();
    for (const lead of group.leads) {
      for (const signal of lead.signals || []) {
        if (signal?.id && seen.has(signal.id)) continue;
        if (signal?.id) seen.add(signal.id);
        group.signals.push(signal);
      }
    }
    group.signals.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    group.leads.sort((a, b) => b.icpFit - a.icpFit);
  }

  return [...map.values()].sort((a, b) => b.bestFit - a.bestFit);
}

function leadHaystack(lead: QualifiedLead): string {
  return [
    lead.company,
    lead.industry,
    lead.hqLocation,
    lead.employeeRange,
    lead.contact?.name,
    lead.contact?.role,
    lead.contact?.email,
    stripEventPrefix(lead.primaryEvent),
    lead.qualificationReason,
    ...(lead.signals || []).map((s) => `${s.channel} ${s.detail} ${s.person || ""} ${s.personRole || ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// ─── Conversation angle (composed from grounded fields only) ──────────────────

interface AngleBlock {
  label: string;
  value: string;
  source: string;
}

function angleBlocks(lead: QualifiedLead, icp?: EvaWorkspace["icp"]): AngleBlock[] {
  const blocks: AngleBlock[] = [];
  const event = stripEventPrefix(lead.primaryEvent) || lead.signals?.[0]?.detail || "";

  if (event) {
    blocks.push({
      label: "Open with",
      value: event,
      source: lead.eventType
        ? `Eva · ${SIGNAL_META[lead.eventType]?.label || lead.eventType}`
        : "Eva · captured event",
    });
  }
  if (lead.contact?.name || lead.contact?.role) {
    blocks.push({
      label: "Speak to",
      value: [lead.contact.name, lead.contact.role].filter(Boolean).join(" · "),
      source: "Eva · resolved contact",
    });
  }
  if (lead.qualificationReason) {
    blocks.push({ label: "Why them", value: lead.qualificationReason, source: "Eva · qualification" });
  }
  if (icp?.value_prop) {
    blocks.push({ label: "Tie back to", value: icp.value_prop, source: "Your ICP · value prop" });
  }
  return blocks;
}

// ─── Research progress (mirrors Eva's ScanProgress) ───────────────────────────

const SCAN_STEPS: { keys: ScanStage[]; label: string; hint: string; Icon: typeof Layers }[] = [
  {
    keys: ["starting", "context"],
    label: "Reading your ICP",
    hint: "Industry, segments and personas — the bar every decision-maker is matched against.",
    Icon: Layers,
  },
  {
    keys: ["tracking"],
    label: "Tracking channels",
    hint: "Job postings, funding, product launches, tech changes, research engine and LinkedIn VM.",
    Icon: Radar,
  },
  {
    keys: ["qualifying"],
    label: "Qualifying accounts",
    hint: "Deduping signals into orgs and applying the per-ACV qualification matrix.",
    Icon: Target,
  },
  {
    keys: ["enriching"],
    label: "Resolving decision-makers",
    hint: "Finding the person, their role and a verified email for each qualified account.",
    Icon: Mail,
  },
];

function scanStepIndex(stage: ScanStage | null): number {
  if (!stage) return 0;
  const i = SCAN_STEPS.findIndex((s) => s.keys.includes(stage));
  return i === -1 ? 0 : i;
}

function ResearchProgress({ stage }: { stage: ScanStage | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = scanStepIndex(stage);
  return (
    <div className="flex h-[62vh] flex-col items-center justify-center gap-6 text-center">
      <div className="relative">
        <span className="absolute -inset-2 animate-ping rounded-full bg-violet-400/20" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white ring-2 ring-violet-100">
          <Brain className="h-7 w-7" />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-700">Building your prospect dossiers</p>
        <p className="mt-0.5 text-xs text-zinc-400">
          Reading the qualified accounts Eva has captured · {elapsed}s elapsed
        </p>
      </div>
      <div className="w-full max-w-md space-y-3 text-left">
        {SCAN_STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          const Icon = step.Icon;
          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                state === "active" ? "border-violet-200 bg-violet-50/50" : "border-transparent"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  state === "done"
                    ? "bg-emerald-50 text-emerald-600"
                    : state === "active"
                    ? "bg-violet-600 text-white"
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
                <p
                  className={cn(
                    "text-[13px] font-semibold leading-snug",
                    state === "pending" ? "text-zinc-400" : "text-zinc-800"
                  )}
                >
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

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyPanel({
  icon: Icon = Search,
  title,
  subtitle,
  children,
}: {
  icon?: typeof Search;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-zinc-200 px-5 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-400">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-600">{title}</p>
        {subtitle && <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Summary header ──────────────────────────────────────────────────────────

function SummaryHeader({ ws, companies }: { ws: EvaWorkspace; companies: CompanyGroup[] }) {
  const m = ws.metrics;
  const withContact = ws.leads.filter((l) => l.status !== "rejected" && l.contact?.name).length;
  const verified = ws.leads.filter((l) => l.status !== "rejected" && l.contact?.emailVerified).length;

  return (
    <div className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="violet" icon={Brain}>
              Reasoning layer · Eva → Max
            </Chip>
            <span className="text-[10px] font-medium text-zinc-400">
              Who to contact · why them · why now · what to open with
            </span>
          </div>
          {ws.icp ? (
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-zinc-500">
              Matching against <span className="font-semibold text-zinc-700">{ws.icp.industry}</span>
              {ws.icp.segments?.length ? ` · ${ws.icp.segments.join(", ")}` : ""}
              {ws.icp.personas?.length ? ` · personas: ${ws.icp.personas.join(", ")}` : ""}
            </p>
          ) : (
            <p className="mt-1.5 text-[13px] text-zinc-400">No ICP saved for this space yet.</p>
          )}
        </div>
        {ws.last_scan_at && (
          <span className="text-[11px] font-medium text-zinc-400">Last scan {relTime(ws.last_scan_at)}</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Companies" value={companies.length} sub="qualified by Eva" />
        <StatTile
          label="Qualified leads"
          value={m.qualifiedLeads}
          sub={`L${m.byTier.low} · M${m.byTier.medium} · H${m.byTier.high}`}
        />
        <StatTile label="Decision-makers" value={withContact} sub="contact resolved" />
        <StatTile label="Emails found" value={m.emailsFound} sub={`${verified} verified`} tone="text-emerald-600" />
        <StatTile label="Signals / wk" value={m.signalsThisWeek} sub={`${m.signalsCaptured} total`} />
        <StatTile label="Handed to Max" value={m.handedToMax} sub="for outreach" tone="text-violet-600" />
      </div>
    </div>
  );
}

// ─── Company + prospect cards ────────────────────────────────────────────────

function CompanyCard({
  group,
  active,
  onSelect,
}: {
  group: CompanyGroup;
  active: boolean;
  onSelect: () => void;
}) {
  const tier = TIER_META[group.topTier];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full rounded-2xl border p-3 text-left transition-colors",
        active
          ? "border-violet-300 bg-violet-50/60"
          : "border-zinc-200/70 bg-white hover:border-zinc-300 hover:bg-zinc-50/70"
      )}
    >
      <div className="flex items-center gap-2.5">
        <CompanyLogo logoUrl={group.logoUrl} domain={group.domain} company={group.company} className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-zinc-900">{group.company}</p>
          <p className="truncate text-[11px] text-zinc-400">{group.industry || group.domain || "Industry unknown"}</p>
        </div>
        <span className="shrink-0 rounded-md bg-zinc-900 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {group.bestFit}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        <Chip tone={tier.tone}>{tier.label}</Chip>
        {group.handedCount > 0 && (
          <Chip tone="violet" icon={ArrowRight}>
            {group.handedCount} with Max
          </Chip>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[10.5px] text-zinc-400">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" /> {group.leads.length} lead{group.leads.length === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          <SignalIcon className="h-3 w-3" /> {group.signals.length}
        </span>
        {group.lastActivity && <span>{relTime(group.lastActivity)}</span>}
      </div>
    </button>
  );
}

function ProspectCard({
  lead,
  active,
  onSelect,
}: {
  lead: QualifiedLead;
  active: boolean;
  onSelect: () => void;
}) {
  const action = ACTION_META[lead.recommendedAction];
  const enrichment = ENRICHMENT_META[lead.enrichment?.status];
  const handed = lead.handoffState === "handed_to_max";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full rounded-2xl border p-3 text-left transition-colors",
        active
          ? "border-violet-300 bg-violet-50/60"
          : "border-zinc-200/70 bg-white hover:border-zinc-300 hover:bg-zinc-50/70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {lead.contact?.name ? (
            <p className="truncate text-[13px] font-semibold text-zinc-900">{lead.contact.name}</p>
          ) : (
            <p className="truncate text-[13px] font-semibold text-zinc-400">Decision-maker not resolved yet</p>
          )}
          <p className="truncate text-[11px] text-zinc-500">{lead.contact?.role || lead.company}</p>
        </div>
        <span className="shrink-0 rounded-md bg-zinc-900 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {lead.icpFit}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {action && (
          <Chip tone={action.tone} icon={Zap}>
            {action.label}
          </Chip>
        )}
        {enrichment && <Chip tone={enrichment.tone}>{enrichment.label}</Chip>}
        {handed && <Chip tone="violet">With Max</Chip>}
      </div>
      {lead.eventType && (
        <p className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-zinc-500">
          <span className="font-semibold text-zinc-700">{SIGNAL_META[lead.eventType]?.label || lead.eventType}:</span>{" "}
          {stripEventPrefix(lead.primaryEvent) || lead.signals?.[0]?.detail || "No event detail captured."}
        </p>
      )}
    </button>
  );
}

// ─── Dossier ─────────────────────────────────────────────────────────────────

function SignalTimeline({ signals }: { signals: ChannelSignal[] }) {
  if (!signals.length) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-center text-[12px] text-zinc-400">
        No channel signals stored for this lead yet.
      </p>
    );
  }
  return (
    <ol className="relative space-y-2.5 pl-5">
      <span aria-hidden="true" className="absolute bottom-2 left-[6px] top-2 w-px bg-zinc-200" />
      {signals.map((s) => {
        const meta = SIGNAL_META[s.signalType];
        const confidence = toPercent(s.confidence);
        return (
          <li key={s.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-5 top-3 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-violet-400"
            />
            <div className="rounded-xl border border-zinc-200/70 bg-white p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone={meta?.tone || "zinc"}>{meta?.label || s.signalType}</Chip>
                {s.channel && <span className="text-[10.5px] font-medium text-zinc-400">{s.channel}</span>}
                {s.timestamp && <span className="ml-auto text-[10.5px] text-zinc-400">{relTime(s.timestamp)}</span>}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">{s.detail}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-zinc-400">
                {s.person && (
                  <span>
                    Posted by {s.person}
                    {s.personRole ? ` · ${s.personRole}` : ""}
                  </span>
                )}
                {s.fundingStage && <span>Stage {s.fundingStage}</span>}
                {confidence !== null && <span>Confidence {confidence}%</span>}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-violet-600 hover:underline"
                  >
                    Source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Dossier({
  lead,
  group,
  icp,
  onAction,
  onShowEmail,
  onOpenMax,
}: {
  lead: QualifiedLead;
  group: CompanyGroup;
  icp?: EvaWorkspace["icp"];
  onAction: (lead: QualifiedLead, action: "hand_to_max" | "reject" | "reset") => void;
  onShowEmail: (lead: QualifiedLead) => Promise<void> | void;
  onOpenMax: () => void;
}) {
  const tier = TIER_META[lead.acvTier];
  const action = ACTION_META[lead.recommendedAction];
  const enrichment = ENRICHMENT_META[lead.enrichment?.status];
  const handed = lead.handoffState === "handed_to_max";
  const emailConfidence = toPercent(lead.contact?.emailConfidence);
  const blocks = angleBlocks(lead, icp);
  const host = hostOf(lead) || group.domain;
  const [enriching, setEnriching] = useState(false);

  const revealEmail = async () => {
    setEnriching(true);
    try {
      await onShowEmail(lead);
    } finally {
      setEnriching(false);
    }
  };

  const copyBrief = async () => {
    const text = [
      `${lead.contact?.name || "Contact TBD"}${lead.contact?.role ? ` — ${lead.contact.role}` : ""} @ ${lead.company}`,
      `ICP fit ${lead.icpFit} · ${tier.label} (${tier.range}) · ${action?.label || lead.recommendedAction}`,
      ...blocks.map((b) => `${b.label}: ${b.value}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prospect brief copied");
    } catch {
      toast.error("Couldn't copy — clipboard access was blocked");
    }
  };

  return (
    <motion.div
      key={lead.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Identity */}
      <div className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex flex-wrap items-start gap-4">
          <CompanyLogo
            logoUrl={lead.logoUrl}
            domain={lead.domain}
            company={lead.company}
            className="h-12 w-12"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">
                {lead.contact?.name || "Decision-maker not resolved yet"}
              </h2>
              <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                fit {lead.icpFit}
              </span>
              <Chip tone={tier.tone}>
                {tier.label} · {tier.range}
              </Chip>
              {action && (
                <Chip tone={action.tone} icon={Zap}>
                  {action.label}
                </Chip>
              )}
              {handed && <Chip tone="violet">With Max</Chip>}
            </div>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              {[lead.contact?.role, lead.company].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-zinc-500">
              {lead.industry && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {lead.industry}
                </span>
              )}
              {lead.employeeRange && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {lead.employeeRange}
                </span>
              )}
              {lead.hqLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {lead.hqLocation}
                </span>
              )}
              {host && (
                <a
                  href={lead.website || `https://${lead.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-medium text-zinc-500 hover:text-violet-600"
                >
                  <Globe className="h-3 w-3" /> {host}
                </a>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {lead.contact?.email ? (
                <a
                  href={`mailto:${lead.contact.email}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  {lead.contact.emailVerified ? <MailCheck className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                  {lead.contact.email}
                </a>
              ) : (
                <button
                  onClick={revealEmail}
                  disabled={enriching}
                  title="Find this decision-maker's email (uses one monthly enrichment credit)"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[12px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60"
                >
                  {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  {enriching ? "Finding email…" : "Show Email"}
                </button>
              )}
              {lead.contact?.linkedinUrl && (
                <a
                  href={lead.contact.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[12px] font-medium text-sky-700 hover:bg-sky-100"
                >
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-zinc-400">
              {lead.contact?.emailSource && <span>Email source · {lead.contact.emailSource}</span>}
              {emailConfidence !== null && <span>Email confidence · {emailConfidence}%</span>}
              <span>Status · {lead.status}</span>
              <span>Handoff · {lead.handoffState.replace(/_/g, " ")}</span>
              {lead.updatedAt && <span>Updated {relTime(lead.updatedAt)}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Why this prospect */}
      <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <PanelTitle icon={Target}>Why this prospect</PanelTitle>
        {lead.primaryEvent || lead.qualificationReason ? (
          <div className="space-y-2.5">
            {lead.primaryEvent && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {lead.eventType && (
                    <Chip tone={SIGNAL_META[lead.eventType]?.tone || "zinc"}>
                      {SIGNAL_META[lead.eventType]?.label || lead.eventType}
                    </Chip>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Why now</span>
                </div>
                <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-zinc-800">
                  {stripEventPrefix(lead.primaryEvent)}
                </p>
              </div>
            )}
            {lead.qualificationReason && (
              <p className="text-[13px] leading-relaxed text-zinc-600">{lead.qualificationReason}</p>
            )}
            {action?.desc && (
              <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-zinc-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" /> {action.desc}
              </p>
            )}
            {lead.escalation && (
              <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-zinc-500">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" /> {lead.escalation}
              </p>
            )}
            {lead.notes && (
              <p className="rounded-xl bg-zinc-50 p-3 text-[12px] leading-relaxed text-zinc-500">{lead.notes}</p>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-center text-[12px] text-zinc-400">
            Eva hasn't recorded a qualification reason for this lead yet.
          </p>
        )}
      </div>

      {/* Signals */}
      <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <PanelTitle
          icon={Activity}
          right={<span className="text-[10px] font-medium text-zinc-400">{(lead.signals || []).length} captured</span>}
        >
          Signal activity
        </PanelTitle>
        <SignalTimeline signals={[...(lead.signals || [])].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))} />
      </div>

      {/* Conversation angle */}
      <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <PanelTitle
          icon={Sparkles}
          right={
            blocks.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 rounded-full border-zinc-200 text-[11px]"
                onClick={copyBrief}
              >
                <Copy className="h-3 w-3" /> Copy brief
              </Button>
            ) : undefined
          }
        >
          Conversation angle
        </PanelTitle>
        {blocks.length > 0 ? (
          <>
            <div className="space-y-2">
              {blocks.map((b) => (
                <div key={b.label} className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{b.label}</span>
                    <span className="text-[10px] font-medium text-zinc-400">{b.source}</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-700">{b.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[10.5px] leading-relaxed text-zinc-400">
              Assembled from Eva's captured event, her qualification reason and your saved ICP positioning. Max writes
              the actual copy — nothing here is generated.
            </p>
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-center text-[12px] text-zinc-400">
            Not enough grounded context for an angle yet — no event, reason or ICP value prop stored.
          </p>
        )}
      </div>

      {/* Handoff */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-900">
            {handed ? "Handed to Max" : "Ready to hand to Max?"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-zinc-500">
            {handed
              ? "Max owns the outreach for this lead. Pull it back if it shouldn't be in the queue."
              : "Max picks up the company, contact and captured event — no research repeated."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {handed ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
                onClick={() => onAction(lead, "reject")}
              >
                <Ban className="h-3.5 w-3.5" /> Pull back
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-full bg-violet-600 text-xs hover:bg-violet-700"
                onClick={onOpenMax}
              >
                Open in Max <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs text-zinc-500 hover:text-red-600"
                onClick={() => onAction(lead, "reject")}
              >
                <Ban className="h-3.5 w-3.5" /> Not a fit
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-full bg-violet-600 text-xs hover:bg-violet-700"
                onClick={() => onAction(lead, "hand_to_max")}
              >
                Hand to Max <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────────

type TierFilter = "all" | ACVTier;
type QualityFilter = "all" | "latest" | "high" | "low";

const QUALITY_FILTERS: { key: QualityFilter; label: string }[] = [
  { key: "all", label: "All quality" },
  { key: "latest", label: "Latest" },
  { key: "high", label: "High quality" },
  { key: "low", label: "Low quality" },
];
const HIGH_QUALITY_FIT = 70;
const LOW_QUALITY_FIT = 50;

function PillGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex w-fit items-center gap-1 rounded-full bg-zinc-100/80 p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
            value === o.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProspectIntelligence() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();

  const [ws, setWs] = useState<EvaWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ScanStage | null>(null);

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [actionFilter, setActionFilter] = useState<EvaAction | "all">("all");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");

  const [companyKey, setCompanyKey] = useState<string>("");
  const [leadId, setLeadId] = useState<string>("");

  const reqRef = useRef(0);

  const load = useCallback(
    async (force: boolean) => {
      const my = ++reqRef.current;
      setError(null);
      setStage("starting");
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await evaAPI.getWorkspace(
          spaceId || "demo",
          force,
          (s) => my === reqRef.current && setStage(s)
        );
        if (my !== reqRef.current) return;
        setWs(data);
        if (force) toast.success("Prospect dossiers refreshed");
      } catch (e) {
        if (my !== reqRef.current) return;
        const message = e instanceof Error ? e.message : "Couldn't load your qualified accounts";
        setError(message);
        if (force) toast.error("Couldn't refresh prospects");
        else setWs(null);
      } finally {
        if (my === reqRef.current) {
          setStage(null);
          if (force) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [spaceId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const activeLeads = useMemo(() => (ws ? ws.leads.filter((l) => l.status !== "rejected") : []), [ws]);

  // Which recommendations actually exist in this workspace — never show empty filters.
  const actionOptions = useMemo(() => {
    const present = new Set<EvaAction>();
    activeLeads.forEach((l) => present.add(l.recommendedAction));
    const options: { key: EvaAction | "all"; label: string }[] = [{ key: "all", label: "All routing" }];
    (Object.keys(ACTION_META) as EvaAction[]).forEach((key) => {
      if (present.has(key)) options.push({ key, label: ACTION_META[key].label });
    });
    return options;
  }, [activeLeads]);

  const query = search.trim().toLowerCase();

  const filteredLeads = useMemo(() => {
    let list = activeLeads
      .filter((l) => tierFilter === "all" || l.acvTier === tierFilter)
      .filter((l) => actionFilter === "all" || l.recommendedAction === actionFilter)
      .filter((l) => !query || leadHaystack(l).includes(query));
    if (qualityFilter === "high") list = list.filter((l) => l.icpFit >= HIGH_QUALITY_FIT);
    else if (qualityFilter === "low") list = list.filter((l) => l.icpFit < LOW_QUALITY_FIT);
    return [...list].sort((a, b) =>
      qualityFilter === "latest"
        ? +new Date(b.createdAt) - +new Date(a.createdAt)
        : b.icpFit - a.icpFit
    );
  }, [activeLeads, tierFilter, actionFilter, qualityFilter, query]);

  const companies = useMemo(() => groupByCompany(filteredLeads), [filteredLeads]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.key === companyKey) || companies[0] || null,
    [companies, companyKey]
  );

  const prospects = useMemo(() => selectedCompany?.leads || [], [selectedCompany]);

  const selectedLead = useMemo(
    () => prospects.find((p) => p.id === leadId) || prospects[0] || null,
    [prospects, leadId]
  );

  const onLeadAction = (lead: QualifiedLead, action: "hand_to_max" | "reject" | "reset") => {
    setWs((prev) =>
      prev
        ? {
            ...prev,
            leads: prev.leads.map((l) =>
              l.id === lead.id
                ? {
                    ...l,
                    status: action === "reject" ? "rejected" : action === "reset" ? "qualified" : "handed",
                    handoffState:
                      action === "hand_to_max" ? "handed_to_max" : action === "reject" ? "held" : "enriched",
                  }
                : l
            ),
          }
        : prev
    );

    if (action === "hand_to_max") {
      toast.success(`${lead.contact?.name || lead.company} handed to Max for outreach`);
    } else if (action === "reject") {
      toast(`${lead.company} marked not a fit`, {
        action: { label: "Undo", onClick: () => onLeadAction(lead, "reset") },
      });
    }
    void evaAPI.leadAction(spaceId, lead.id, action);
  };

  // On-demand enrichment ("Show Email"): resolve the email only when the founder
  // asks, to conserve enrichment credits. On success the lead is auto-handed to
  // Max. Enforces the monthly cap and reports remaining credits.
  const onShowEmail = async (lead: QualifiedLead) => {
    try {
      const res = await evaAPI.enrichLead(spaceId, lead.id);
      if (res.status === "limit_reached") {
        toast.error(
          `Monthly enrichment limit reached (${res.usage?.limit ?? 100}). It resets next month.`
        );
        return;
      }
      if (res.lead) {
        const updated = res.lead;
        setWs((prev) =>
          prev
            ? {
                ...prev,
                leads: prev.leads.map((l) => (l.id === lead.id ? updated : l)),
                enrichmentUsage: res.usage || prev.enrichmentUsage,
              }
            : prev
        );
      }
      const remaining = res.usage ? ` · ${res.usage.remaining} left this month` : "";
      if (res.found && res.email) {
        toast.success(`Email found — ${res.email}. Handed to Max${remaining}.`);
      } else {
        toast(`No email found for ${lead.company}. That counts as one enrichment${remaining}.`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't enrich this lead right now");
    }
  };

  const tierOptions: { key: TierFilter; label: string }[] = useMemo(() => {
    const counts = ws?.metrics?.byTier;
    return [
      { key: "all", label: `All ${activeLeads.length}` },
      { key: "low", label: `${TIER_META.low.label}${counts ? ` ${counts.low}` : ""}` },
      { key: "medium", label: `${TIER_META.medium.label}${counts ? ` ${counts.medium}` : ""}` },
      { key: "high", label: `${TIER_META.high.label}${counts ? ` ${counts.high}` : ""}` },
    ];
  }, [ws, activeLeads.length]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar spaceId={spaceId!} onNewChat={() => navigate("/spaces")} onSelectConversation={() => {}} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white shadow-sm ring-2 ring-violet-100">
              <Brain className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Prospect Intelligence
              </span>
              <span className="text-sm font-semibold text-zinc-900">ICP decision-makers &amp; dossiers</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden gap-1 border-violet-200 bg-violet-50 text-[9px] font-bold uppercase tracking-wider text-violet-700 sm:flex"
            >
              <SignalIcon className="h-3 w-3" /> Eva → Max
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={() => load(true)}
              disabled={loading || refreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] space-y-5 px-6 pb-10 pt-6 lg:px-8">
            {loading ? (
              <ResearchProgress stage={stage} />
            ) : error && !ws ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-700">We couldn't load your qualified accounts</p>
                  <p className="mx-auto mt-0.5 max-w-md text-xs text-zinc-500">{error}</p>
                </div>
                <Button
                  onClick={() => load(true)}
                  className="mt-1 h-9 gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            ) : ws ? (
              <>
                {refreshing && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-2.5 text-[12px] font-medium text-violet-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Refreshing prospects — {SCAN_STEPS[scanStepIndex(stage)]?.label ?? "working"}…</span>
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12px] text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">{error}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1.5 rounded-full border-amber-200 bg-white text-[11px]"
                      onClick={() => load(true)}
                    >
                      <RotateCcw className="h-3 w-3" /> Try again
                    </Button>
                  </div>
                )}
                {ws.isDemo && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>
                      Showing <span className="font-semibold">sample prospects</span> — this space isn't linked to a
                      real brand, so no live accounts are available here.
                    </span>
                  </div>
                )}

                <SummaryHeader ws={ws} companies={companies} />

                {/* filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full max-w-sm">
                    <label htmlFor="prospect-search" className="sr-only">
                      Search companies, people, roles and events
                    </label>
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                    />
                    <input
                      id="prospect-search"
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search company, person, role, event…"
                      className="h-9 w-full rounded-full border border-zinc-200 bg-white pl-9 pr-3 text-[12.5px] text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-300"
                    />
                  </div>
                  <PillGroup label="ACV tier" value={tierFilter} options={tierOptions} onChange={setTierFilter} />
                  <PillGroup
                    label="Lead quality"
                    value={qualityFilter}
                    options={QUALITY_FILTERS}
                    onChange={setQualityFilter}
                  />
                  {actionOptions.length > 1 && (
                    <PillGroup
                      label="Recommended routing"
                      value={actionFilter}
                      options={actionOptions}
                      onChange={setActionFilter}
                    />
                  )}
                  <span className="ml-auto text-[11px] font-medium text-zinc-400">
                    {companies.length} compan{companies.length === 1 ? "y" : "ies"} · {filteredLeads.length} lead
                    {filteredLeads.length === 1 ? "" : "s"}
                  </span>
                </div>

                {activeLeads.length === 0 ? (
                  <EmptyPanel
                    icon={Target}
                    title="No qualified accounts yet"
                    subtitle="Eva hands accounts over once a channel signal clears your ICP bar. Refresh to check for new ones."
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
                      onClick={() => load(true)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                  </EmptyPanel>
                ) : companies.length === 0 ? (
                  <EmptyPanel
                    title="Nothing matches these filters"
                    subtitle="Clear the search or widen the tier, quality and routing filters."
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8 rounded-full border-zinc-200 text-xs"
                      onClick={() => {
                        setSearch("");
                        setTierFilter("all");
                        setActionFilter("all");
                        setQualityFilter("all");
                      }}
                    >
                      Reset filters
                    </Button>
                  </EmptyPanel>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[280px_320px_minmax(0,1fr)]">
                    {/* companies */}
                    <section aria-label="Qualified companies" className="min-w-0">
                      <PanelTitle
                        icon={Building2}
                        right={<span className="text-[10px] font-medium text-zinc-400">{companies.length}</span>}
                      >
                        Qualified by Eva
                      </PanelTitle>
                      <div className="max-h-[calc(100vh-19rem)] space-y-2 overflow-y-auto pr-1">
                        {companies.map((c) => (
                          <CompanyCard
                            key={c.key}
                            group={c}
                            active={c.key === selectedCompany?.key}
                            onSelect={() => {
                              setCompanyKey(c.key);
                              setLeadId(c.leads[0]?.id || "");
                            }}
                          />
                        ))}
                      </div>
                    </section>

                    {/* prospects */}
                    <section aria-label="Decision makers" className="min-w-0">
                      <PanelTitle
                        icon={Users}
                        right={<span className="text-[10px] font-medium text-zinc-400">{prospects.length}</span>}
                      >
                        {selectedCompany?.company || "Decision-makers"}
                      </PanelTitle>
                      <div className="max-h-[calc(100vh-19rem)] space-y-2 overflow-y-auto pr-1">
                        {prospects.length === 0 ? (
                          <EmptyPanel
                            icon={Users}
                            title="No decision-makers on this account"
                            subtitle="Eva enriches contacts after qualification — check back after the next scan."
                          />
                        ) : (
                          prospects.map((p) => (
                            <ProspectCard
                              key={p.id}
                              lead={p}
                              active={p.id === selectedLead?.id}
                              onSelect={() => setLeadId(p.id)}
                            />
                          ))
                        )}
                      </div>
                    </section>

                    {/* dossier */}
                    <section aria-label="Prospect dossier" className="min-w-0">
                      {selectedLead && selectedCompany ? (
                        <Dossier
                          key={selectedLead.id}
                          lead={selectedLead}
                          group={selectedCompany}
                          icp={ws.icp}
                          onAction={onLeadAction}
                          onShowEmail={onShowEmail}
                          onOpenMax={() => navigate(`/sales/${spaceId}`)}
                        />
                      ) : (
                        <EmptyPanel
                          icon={Brain}
                          title="Select a decision-maker"
                          subtitle="Pick a person to see why they qualified, the signals behind it and the angle to open with."
                        />
                      )}
                    </section>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
