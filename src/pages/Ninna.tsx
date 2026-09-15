// pages/Ninna.tsx
//
// Nina — the page that tells a representative what to do today.
//
// This is the default homepage of every workspace. Its **GTM presentation** is the
// four blocks §8 describes, and they come from three reads and three only (R13.8):
//
//   gtmAPI.getAttentionFeed(spaceId, { limit: 50 })
//   gtmAPI.getActionQueue(spaceId, { sort: "priority", limit: 25 })
//   gtmAPI.getDashboard(spaceId, { periodDays: 7 })
//
//   1. Immediate priorities   the `IMMEDIATE`-tier feed items, one line each
//   2. Attention summary      `feed.summary`, counts only, plus a way into the queue
//   3. Opportunities          `MATERIAL`-tier items joined by `leadId` to their queue row
//   4. Suggested actions      the queue's executable rows, verb then prospect
//
// **Nothing here holds a count.** Block 2 reads `feed.summary` — which exists so a
// summary surface reads its counts rather than re-deriving them — and blocks 1, 3 and 4
// filter the payload on render. There is no tally, no counter and no derived list in
// component state, which is what keeps R20.4 true on this page: nothing mirrors a state
// the GTM API already reports.
//
// **What this page no longer does.** It used to poll `weezAPI.getActiveCampaignStatus`
// for ten minutes and route the founder by campaign state, and to hand off to the
// outbound workforce through `weezAPI.activateOutboundWorkforce`. Both are marketing
// campaign orchestration rather than GTM sales, and R13.9 keeps them out of this
// presentation. This page imports `weezAPI` for neither, and for nothing else — creating
// and launching a campaign is `pages/GtmSetup.tsx`'s job now. `NinaGoalIntake` stays,
// behind a disclosure, because re-aiming a workspace that already has a goal is a thing a
// rep does on the page where they read their day; it owns its own launch, so this page
// still orchestrates nothing.
//
// ── First run, and where the four blocks step aside ──
//
// The four blocks are the right presentation for a workspace that is running. They were
// the *only* presentation, which made a workspace that had never been started look like a
// workspace that had been started and found nobody: four absence statements and a `0`. A
// founder ten minutes into the product read that as an empty product and went looking for
// something to press.
//
// So when `useWorkspaceSetup` says the workforce is not running *and* the two GTM reads
// came back with nothing waiting, the blocks step aside for the three setup steps, whose
// control goes to `/gtm-setup`. The moment there is real work waiting, or the moment the
// workforce is live, the blocks are back and the setup rail is either a one-line strip
// above them or gone entirely.
//
// Left: the brief and the four blocks. Right: Nina's conversation, where every message
// can carry the same interactive cards.

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUp,
  ArrowUpRight,
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  Gauge,
  Lightbulb,
  ListChecks,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ConversationSidebar from "@/components/ConversationSidebar";
import NinaGoalIntake from "@/components/NinaGoalIntake";
import { WhyNowList } from "@/components/gtm/ActionExplanation";
import {
  ATTENTION_LABELS,
  ATTENTION_TRIGGER_LABELS,
  CONSEQUENCE_TIER_LABELS,
  FIELD_LABEL,
  GTM_ACTION_LABELS,
  GTM_PAGE_LABELS,
  GTM_UI_LABELS,
  TONE as GTM_TONE,
} from "@/components/gtm/labels";
import { MEASURE_MEANINGS, measureParts } from "@/components/gtm/measure";
import { ObservedValue, UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "@/components/gtm/ObservedValue";
import { CreditBalanceBadge } from "@/components/gtm/CreditBalance";
import {
  ACTIVE_CAMPAIGN_LABELS,
  ActiveCampaignSummary,
} from "@/components/setup/ActiveCampaignSummary";
import { WorkspaceSetupChecklist } from "@/components/setup/WorkspaceSetupChecklist";
import { useCredits } from "@/hooks/useCredits";
import { useWorkspaceSetup } from "@/hooks/useWorkspaceSetup";
import gtmAPI, {
  type ActionQueueItem,
  type ActionQueuePage,
  type AttentionFeed,
  type AttentionItem,
  type AttentionTrigger,
  type ConsequenceTier,
  type ObservedFact,
} from "@/services/gtmAPI";
import {
  ninnaAPI,
  getCachedBrief,
  NINNA,
  NINNA_QUICK_PROMPTS,
  healthMeta,
  type AgentKey,
  type AgentSummary,
  type CampaignHealth,
  type DailyBrief,
  type DecisionItem,
  type LeadCardData,
  type MeetingCardData,
  type NinnaCard,
  type NinnaChatMessage,
  type Priority,
  type RecommendationData,
  type TimelineEntry,
} from "@/services/ninnaAPI";

// ─── Tone palette (literal classes so Tailwind keeps them) ────────────────────

const TONE: Record<
  string,
  { bg: string; softBg: string; text: string; border: string; dot: string; solid: string }
> = {
  emerald: { bg: "bg-emerald-500", softBg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", solid: "bg-emerald-600" },
  sky: { bg: "bg-sky-500", softBg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500", solid: "bg-sky-600" },
  violet: { bg: "bg-violet-500", softBg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500", solid: "bg-violet-600" },
  amber: { bg: "bg-amber-500", softBg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", solid: "bg-amber-600" },
  rose: { bg: "bg-rose-500", softBg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500", solid: "bg-rose-600" },
  zinc: { bg: "bg-zinc-500", softBg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-200", dot: "bg-zinc-400", solid: "bg-zinc-600" },
  indigo: { bg: "bg-indigo-500", softBg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500", solid: "bg-indigo-600" },
};

const AGENT_TONE: Record<AgentKey, string> = { eva: "sky", max: "emerald" };
const AGENT_ICON: Record<AgentKey, typeof FileText> = { eva: Target, max: Mail };
const PRIORITY_TONE: Record<Priority, string> = { critical: "rose", important: "amber", informational: "zinc" };
const PRIORITY_LABEL: Record<Priority, string> = { critical: "Critical", important: "Important", informational: "FYI" };

const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── The four blocks' own chrome (R13.10, R18.2, R18.4) ───────────────────────

/**
 * The page-scoped copy the GTM blocks need, in `ACTION_QUEUE_LABELS`' precedent:
 * `labels.ts` holds the vocabularies keyed by a value the server sends, and a page holds
 * the chrome around them.
 *
 * Nothing here restates a string that already exists there. The band words are
 * `CONSEQUENCE_TIER_LABELS` — block 1's own heading is the `IMMEDIATE` band, so it is read
 * from that table rather than spelled again — the trigger words are
 * `ATTENTION_TRIGGER_LABELS`, the verbs are `GTM_ACTION_LABELS`, and the task separator and
 * the nothing-needs-you sentence are `ATTENTION_LABELS`.
 *
 * The two absence lines are the ones `labels.ts` does not hold, because they are narrower
 * claims than `ATTENTION_LABELS.empty`: that sentence says the whole checklist is clear,
 * while these say the feed has items and none of them is *this* kind of item. Each names
 * what is absent and what would put something there, and neither shows a zero in place of
 * a value nobody has (R18.2, R18.4).
 */
export const NINA_GTM_LABELS = {
  summaryTitle: "What's waiting",
  summaryTotal: "Prospects needing attention",
  byTier: "By consequence",
  byTrigger: "What happened",
  openQueue: "Open the action queue",

  opportunitiesTitle: "Where you could change the outcome",
  expectedOutcome: "Expected outcome",
  businessValue: "Business value",

  suggestedTitle: "Suggested actions",

  loading: "Reading what needs you today",

  noImmediate:
    "Nothing needs you in the next few minutes. Anything less urgent is counted below and listed in full on the action queue.",
  noOpportunities:
    "Nothing in your feed is at a point where acting would change the outcome. An entry appears here when a prospect moves toward a decision and a ranked action is live for them.",
  noRankedAction:
    "No live recommendation for this prospect yet, so there is nothing here about why now or what it is worth.",
  noSuggestedActions:
    "No prepared action is ready to run. One appears here once a prospect's recommendation is live and Weez has a channel to reach them on.",

  goalTitle: "Your GTM goal",
  goalNote:
    "Nina reads your product, customers and industry context, asks only for what is missing, then lays out the strategy she would run.",
  goalOpen: "Set your GTM goal",
  goalClose: "Hide",

  // ── First run ──
  //
  // A workspace that has not launched has, by definition, nothing in the attention feed
  // and nothing in the queue — so the four blocks above would be four absences and a
  // `0`, which reads as "Weez looked and found nobody" rather than "nobody has told Weez
  // what to look for". These labels are the second sentence, and they are separate copy
  // because they are a different claim: not an absence of prospects, an absence of a goal.
  /**
   * The hero, on a workspace that has never launched.
   *
   * The brief's own headline and narrative are assembled in `ninnaAPI` from Eva's and
   * Max's workspaces, and with both of those empty they land on "the workforce is
   * executing — nothing's blocked on you". For a running workspace that is true and
   * reassuring. For one created ten minutes ago it is the single most misleading sentence
   * on the page: it tells a founder the product is working when nothing has been started,
   * which is why the empty blocks below read as "Weez looked and found nobody" instead of
   * "Weez has not been told what to look for". So on a first run the hero says the true
   * thing instead, and says whose move it is.
   */
  firstRunEyebrow: "Welcome to your workspace",
  firstRunHeadline: "Nothing is running yet — let's start your first campaign.",
  firstRunNarrative:
    "I haven't been given a goal for this workspace yet, so there is nothing for me to report and nobody for Eva to go after. Tell me what you want more of and I'll show you the strategy I would run — then Eva starts finding accounts that fit and Max starts preparing the outreach.",
} as const;

/** One test hook per block, so a suite can address a block without matching its prose. */
export const NINA_BLOCK_TEST_IDS = {
  priorities: "nina-immediate-priorities",
  summary: "nina-attention-summary",
  opportunities: "nina-opportunities",
  suggestedActions: "nina-suggested-actions",
} as const;

/** The Consequence_Tier the feed's highest band is, named once. */
const IMMEDIATE_TIER = "IMMEDIATE" as const;

/** The band block 3 is about: action here could materially affect conversion. */
const MATERIAL_TIER = "MATERIAL" as const;

/**
 * A prospect's name inside a control, with absence spelled the way this app spells it.
 *
 * `ObservedValue` is what renders a fact everywhere it can, and block 3 uses it. Blocks 1
 * and 4 cannot: their entries *are* buttons, so their content has to stay phrasing content,
 * and `ObservedValue` renders a `<dt>`/`<dd>` pair or a `<p>`. This mirrors its unknown
 * branch from the same two exported constants — the word, plus the screen-reader note that
 * says why — which is the idiom `pages/ProspectIntelligence.tsx` already uses for the same
 * reason. Never an empty slot, never a lead id standing in for a name.
 */
function ProspectName({ fact }: { fact: ObservedFact }) {
  if (fact.isUnknown || fact.value == null) {
    return (
      <span className="font-semibold text-slate-500">
        {UNKNOWN_TEXT}
        <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
      </span>
    );
  }
  return <span className="font-semibold text-gray-900">{fact.value}</span>;
}

// ─── Ninna avatar ─────────────────────────────────────────────────────────────

function NinnaAvatar({ className = "w-10 h-10" }: { className?: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className={cn("rounded-full overflow-hidden ring-2 ring-indigo-100 shrink-0 shadow-sm", className)}>
      {ok ? (
        <img src={NINNA.avatar} alt={NINNA.name} onError={() => setOk(false)} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center font-black">
          N
        </div>
      )}
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-indigo-600">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Embedded cards (shared by the dashboard and the chat) ────────────────────

function AgentSummaryCard({ summary, onOpen }: { summary: AgentSummary; onOpen: (link: string) => void }) {
  const tone = TONE[AGENT_TONE[summary.agent]];
  const Icon = AGENT_ICON[summary.agent];
  const statusText =
    summary.status === "attention"
      ? "Needs you"
      : summary.status === "working"
        ? "Working…"
        : summary.status === "error"
          ? "Unreachable"
          : summary.status === "quiet"
            ? "Standing by"
            : "On track";
  const statusTone =
    summary.status === "attention" ? "amber" : summary.status === "error" ? "rose" : summary.status === "working" ? "indigo" : "emerald";
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", tone.softBg)}>
            <Icon className={cn("w-5 h-5", tone.text)} />
          </div>
          <div>
            <p className="text-sm font-black text-gray-900 leading-none">{summary.name}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">{summary.role}</p>
          </div>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
            TONE[statusTone].softBg,
            TONE[statusTone].text
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", TONE[statusTone].dot, summary.status === "working" && "animate-pulse")} />
          {statusText}
        </span>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">{summary.headline}</p>

      {summary.metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {summary.metrics.map((mt) => (
            <div key={mt.label} className="rounded-2xl bg-gray-50 px-3 py-2.5 text-center">
              <p className="text-lg font-black text-gray-900 leading-none tabular-nums">{mt.value}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1">{mt.label}</p>
            </div>
          ))}
        </div>
      )}

      {summary.bullets.length > 0 && (
        <ul className="space-y-1.5">
          {summary.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
              <span className={cn("mt-1.5 h-1 w-1 rounded-full shrink-0", tone.dot)} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => onOpen(summary.link)}
        className={cn(
          "mt-auto flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-bold text-white transition-transform active:scale-95",
          tone.solid
        )}
      >
        Open {summary.name}
        {summary.pendingCount > 0 && (
          <span className="ml-2 flex items-center gap-1">
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black">{summary.pendingCount} pending</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        )}
        {summary.pendingCount === 0 && <ArrowUpRight className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function CampaignHealthCard({ health }: { health: CampaignHealth }) {
  const meta = healthMeta(health.label);
  const tone = TONE[meta.tone];
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-gray-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Campaign Health</span>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", tone.softBg, tone.text)}>
          {meta.text}
        </span>
      </div>

      <div className="flex items-end gap-3 mb-2">
        <span className="text-5xl font-black tracking-tighter text-gray-900 tabular-nums">{health.score}</span>
        <span className="text-sm font-bold text-gray-400 mb-1.5">/ 100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className={cn("h-full rounded-full transition-all duration-700", tone.bg)} style={{ width: `${Math.max(4, health.score)}%` }} />
      </div>

      <p className="text-xs text-gray-600 leading-relaxed mb-4">{health.summary}</p>

      <div className="space-y-2">
        {health.drivers.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-gray-500">
              <span className={cn("h-1.5 w-1.5 rounded-full", d.positive ? "bg-emerald-500" : "bg-amber-500")} />
              {d.label}
            </span>
            <span className="font-bold text-gray-800 tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionRow({ item, onOpen }: { item: DecisionItem; onOpen: (link: string) => void }) {
  const pTone = TONE[PRIORITY_TONE[item.priority]];
  const aTone = TONE[AGENT_TONE[item.agent]];
  const Icon = AGENT_ICON[item.agent];
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 hover:border-gray-200 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", aTone.softBg)}>
          <Icon className={cn("w-4 h-4", aTone.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest", pTone.softBg, pTone.text)}>
              {PRIORITY_LABEL[item.priority]}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300 capitalize">{item.agent}</span>
          </div>
          <p className="text-sm font-bold text-gray-900 leading-snug truncate">{item.title}</p>
          <p className="text-xs text-gray-500 leading-relaxed mt-0.5 line-clamp-2">{item.impact}</p>
        </div>
        <button
          onClick={() => onOpen(item.link)}
          className="shrink-0 flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-black transition-colors active:scale-95"
        >
          {item.actionLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function LeadRow({ lead, onOpen }: { lead: LeadCardData; onOpen: (link: string) => void }) {
  return (
    <button
      onClick={() => onOpen(lead.link)}
      className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 hover:border-sky-200 transition-colors group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-gray-900 truncate">{lead.company}</p>
            <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-sky-50 text-sky-700">{lead.tier}</span>
          </div>
          {lead.event && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{lead.event}</p>}
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{lead.reason}</p>
        </div>
        <div className="shrink-0 flex flex-col items-center">
          <div className="text-lg font-black text-sky-600 tabular-nums leading-none">{lead.fit}</div>
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">Fit</div>
        </div>
      </div>
    </button>
  );
}

function MeetingRow({ meeting, onOpen }: { meeting: MeetingCardData; onOpen: (link: string) => void }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
          <CalendarClock className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-gray-900 truncate">{meeting.company}</p>
          <p className="text-xs text-gray-600 truncate">
            {meeting.contact}
            {meeting.role ? ` · ${meeting.role}` : ""}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mt-1">
            {meeting.when} · {meeting.source}
          </p>
        </div>
        <button onClick={() => onOpen(meeting.link)} className="shrink-0 text-emerald-700 hover:text-emerald-900">
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function RecommendationCard({ rec, onOpen }: { rec: RecommendationData; onOpen: (link: string) => void }) {
  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-5">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 text-indigo-500" />
        <p className="text-sm font-black text-gray-900">{rec.title}</p>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{rec.body}</p>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          {rec.agents.map((a) => (
            <span
              key={a}
              className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest capitalize", TONE[AGENT_TONE[a]].softBg, TONE[AGENT_TONE[a]].text)}
            >
              {a}
            </span>
          ))}
        </div>
        {rec.actionLabel && rec.link && (
          <button
            onClick={() => onOpen(rec.link!)}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
          >
            {rec.actionLabel}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function TimelineList({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="relative pl-4">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-200" />
      <div className="space-y-4">
        {entries.map((e) => {
          const tone = e.agent === "ninna" ? TONE.indigo : TONE[AGENT_TONE[e.agent as AgentKey]] || TONE.zinc;
          return (
            <div key={e.id} className="relative">
              <span className={cn("absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-white", tone.bg)} />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-800 leading-snug">{e.label}</p>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-300 shrink-0">
                  {timeAgo(e.at)}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5 line-clamp-2">{e.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// Renders any embedded card inside a chat message.
function ChatCard({ card, onOpen }: { card: NinnaCard; onOpen: (link: string) => void }) {
  switch (card.type) {
    case "agent_summary":
      return <AgentSummaryCard summary={card.summary} onOpen={onOpen} />;
    case "decisions":
      return (
        <div className="space-y-2">
          {card.items.map((it) => (
            <DecisionRow key={it.id} item={it} onOpen={onOpen} />
          ))}
        </div>
      );
    case "campaign_health":
      return <CampaignHealthCard health={card.health} />;
    case "leads":
      return (
        <div className="space-y-2">
          {card.leads.map((l) => (
            <LeadRow key={l.id} lead={l} onOpen={onOpen} />
          ))}
        </div>
      );
    case "meetings":
      return (
        <div className="space-y-2">
          {card.meetings.map((m) => (
            <MeetingRow key={m.id} meeting={m} onOpen={onOpen} />
          ))}
        </div>
      );
    case "recommendation":
      return <RecommendationCard rec={card.rec} onOpen={onOpen} />;
    case "timeline":
      return (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <TimelineList entries={card.entries} />
        </div>
      );
    default:
      return null;
  }
}

// ─── Section shell ────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Activity;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-gray-500">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function BriefLoading({ spaceName, balance }: { spaceName: string; balance: number | null }) {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center gap-8 bg-[#FDFBFF]">
      {/* The balance is chrome, not content (R17.1): the brief is still being gathered
          here, and a rep who opened this page still has the same credits. Passed in rather
          than read again — the provider above `Routes` is the one read per workspace. */}
      <div className="absolute right-6 top-4 lg:right-8">
        <CreditBalanceBadge balance={balance} className="hidden sm:inline-flex" />
      </div>
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
        <NinnaAvatar className="w-20 h-20 relative" />
      </div>
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Gathering your workforce</span>
        </div>
        <p className="text-sm font-medium text-gray-500 max-w-xs leading-relaxed">
          Nina is checking in with EVA and MAX to build your brief for <span className="font-bold text-gray-800">{spaceName}</span>.
        </p>
      </div>
      <div className="flex items-center gap-6">
        {(["EVA", "MAX"] as const).map((n, i) => (
          <div key={n} className="flex flex-col items-center gap-2 opacity-60" style={{ animationDelay: `${i * 200}ms` }}>
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── The four GTM blocks (§8) ─────────────────────────────────────────────────
//
// Each block takes the payload it is a view of and filters it here, at render. None of
// them takes a count, a tally or a pre-filtered list, because none of those may exist:
// holding one would be a client-side copy of a state the GTM API already reports (R20.4),
// and the point of `feed.summary` is that block 2 *reads* its counts.

/** Where a queue-sourced entry goes: the prospect's own page, in one step (R13.7). */
export function prospectRoute(spaceId: string, leadId: string): string {
  return `/prospect-intelligence/${spaceId}?lead_id=${encodeURIComponent(leadId)}`;
}

/**
 * Block 1 — what needs the representative now (R13.1, R13.7, R13.10).
 *
 * The `IMMEDIATE` band, in the server's order, one line each in the same
 * `prospect → reason → required response` form the checklist uses, and the separator comes
 * from `ATTENTION_LABELS` rather than from this markup so the two surfaces cannot drift.
 * The whole line is the control's accessible name, and activating it follows `item.route`
 * as the server sent it — never a path rebuilt here.
 *
 * Two different absences, because they are two different pieces of news: an empty feed
 * means nothing needs you at all, which is `ATTENTION_LABELS.empty` and is the same
 * sentence the Action Queue says; a feed with no `IMMEDIATE` item means the urgent band is
 * clear while other bands are not, which is a narrower claim and gets its own line.
 */
function ImmediatePriorities({
  feed,
  onOpen,
}: {
  feed: AttentionFeed;
  onOpen: (route: string) => void;
}) {
  const items = feed.items.filter((item) => item.consequenceTier === IMMEDIATE_TIER);

  return (
    <Section icon={CheckCircle2} title={CONSEQUENCE_TIER_LABELS[IMMEDIATE_TIER]}>
      <div data-testid={NINA_BLOCK_TEST_IDS.priorities}>
        {feed.items.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white p-5 text-xs leading-relaxed text-gray-500">
            {ATTENTION_LABELS.empty}
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white p-5 text-xs leading-relaxed text-gray-500">
            {NINA_GTM_LABELS.noImmediate}
          </p>
        ) : (
          <ul aria-label={ATTENTION_LABELS.list} className="space-y-2">
            {items.map((item: AttentionItem) => (
              <li key={`${item.leadId}-${item.trigger}`}>
                <button
                  type="button"
                  data-lead-id={item.leadId}
                  data-consequence-tier={item.consequenceTier}
                  data-attention-trigger={item.trigger}
                  onClick={() => onOpen(item.route)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-colors hover:border-rose-200"
                >
                  <span className="min-w-0 flex-1 text-sm leading-relaxed text-gray-600">
                    <ProspectName fact={item.prospectName} />{" "}
                    <span>{item.reason}</span>
                    <span>{ATTENTION_LABELS.taskSeparator}</span>
                    <span className="font-semibold text-gray-900">{item.requiredResponse}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

/**
 * Block 2 — the attention summary (R13.2, R13.3, R13.4).
 *
 * Counts and only counts. No prospect, no reason, no required response: the full task
 * detail is the Action Queue's job and restating it here would be the same information in
 * two places, so the block ends with the control that goes there.
 *
 * Every number is `feed.summary`'s, read and rendered. `total` is a genuine measured zero
 * on a clear workspace and renders `0` — nothing about it was uncomputable. The two maps
 * carry only the keys the server counted, so a band or a trigger it did not count is
 * *absent from this list* rather than shown as zero: "we counted none" and "we did not
 * count" are different statements and only one of them is a finding.
 */
function AttentionSummaryBlock({
  summary,
  onOpenQueue,
}: {
  summary: AttentionFeed["summary"];
  onOpenQueue: () => void;
}) {
  // Declared band and trigger order, narrowed to the keys the server sent. Ordering, not
  // counting — the numbers are the payload's.
  const tiers = (Object.keys(CONSEQUENCE_TIER_LABELS) as ConsequenceTier[]).filter(
    (tier) => summary.byTier[tier] !== undefined
  );
  const triggers = (Object.keys(ATTENTION_TRIGGER_LABELS) as AttentionTrigger[]).filter(
    (trigger) => summary.byTrigger[trigger] !== undefined
  );

  return (
    <Section
      icon={Gauge}
      title={NINA_GTM_LABELS.summaryTitle}
      action={
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onOpenQueue}>
          <ListChecks className="h-3.5 w-3.5" />
          {NINA_GTM_LABELS.openQueue}
        </Button>
      }
    >
      <div
        data-testid={NINA_BLOCK_TEST_IDS.summary}
        className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <p className="text-4xl font-black leading-none tracking-tighter text-gray-900 tabular-nums">
          {summary.total}
        </p>
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {NINA_GTM_LABELS.summaryTotal}
        </p>

        {tiers.length > 0 && (
          <>
            <h3 className="mt-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {NINA_GTM_LABELS.byTier}
            </h3>
            <dl className="mt-2 space-y-1.5">
              {tiers.map((tier) => (
                <div key={tier} data-consequence-tier={tier} className="flex items-baseline justify-between gap-3 text-xs">
                  <dt className="min-w-0 text-gray-600">{CONSEQUENCE_TIER_LABELS[tier]}</dt>
                  <dd className="font-bold text-gray-900 tabular-nums">{summary.byTier[tier]}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {triggers.length > 0 && (
          <>
            <h3 className="mt-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {NINA_GTM_LABELS.byTrigger}
            </h3>
            <dl className="mt-2 space-y-1.5">
              {triggers.map((trigger) => (
                <div
                  key={trigger}
                  data-attention-trigger={trigger}
                  className="flex items-baseline justify-between gap-3 text-xs"
                >
                  <dt className="min-w-0 text-gray-600">{ATTENTION_TRIGGER_LABELS[trigger]}</dt>
                  <dd className="font-bold text-gray-900 tabular-nums">{summary.byTrigger[trigger]}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </Section>
  );
}

/**
 * Block 3 — where acting could materially affect conversion (R13.5, R13.7).
 *
 * The `MATERIAL` band, joined by `leadId` to its `ActionQueueItem` for the why-now bullets
 * and the ranking's dimensions. The join is a lookup over the payload at render — two
 * reads, one screen — and a prospect the queue has no live row for says so rather than
 * showing an empty reasoning list.
 *
 * `WhyNowList` renders the bullets, so the signals read here exactly as they read on the
 * prospect's own page, and the two measures render band-first through `measureParts` with
 * an unread measure stating its absence instead of showing a zero.
 */
function Opportunities({
  feed,
  queue,
  onOpen,
}: {
  feed: AttentionFeed;
  queue: ActionQueueItem[];
  onOpen: (route: string) => void;
}) {
  const items = feed.items.filter((item) => item.consequenceTier === MATERIAL_TIER);

  return (
    <Section icon={TrendingUp} title={NINA_GTM_LABELS.opportunitiesTitle}>
      <div data-testid={NINA_BLOCK_TEST_IDS.opportunities}>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white p-5 text-xs leading-relaxed text-gray-500">
            {feed.items.length === 0 ? ATTENTION_LABELS.empty : NINA_GTM_LABELS.noOpportunities}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item: AttentionItem) => {
              const row = queue.find((candidate) => candidate.leadId === item.leadId) ?? null;
              return (
                <li
                  key={`${item.leadId}-${item.trigger}`}
                  data-lead-id={item.leadId}
                  data-consequence-tier={item.consequenceTier}
                  className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
                    <ObservedValue
                      label={FIELD_LABEL.name}
                      fact={item.prospectName}
                      variant="inline"
                      hideProvenance
                    />
                    <ObservedValue
                      label={FIELD_LABEL.company}
                      fact={item.company}
                      variant="inline"
                      hideProvenance
                    />
                  </div>

                  <p className="text-sm leading-relaxed text-gray-600">
                    {item.reason}
                    {ATTENTION_LABELS.taskSeparator}
                    <span className="font-semibold text-gray-900">{item.requiredResponse}</span>
                  </p>

                  {row === null ? (
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      {NINA_GTM_LABELS.noRankedAction}
                    </p>
                  ) : (
                    <>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {(
                          [
                            [
                              "expected_success_probability",
                              NINA_GTM_LABELS.expectedOutcome,
                              row.expectedSuccessProbability,
                            ],
                            ["business_value", NINA_GTM_LABELS.businessValue, row.businessValue],
                          ] as const
                        ).map(([key, label, raw]) => {
                          const measure = measureParts(raw);
                          return (
                            <div key={key} className="min-w-0">
                              <dt
                                title={MEASURE_MEANINGS[key]}
                                className="cursor-help text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400"
                              >
                                {label}
                              </dt>
                              <dd className="mt-0.5 flex items-baseline gap-1.5">
                                {measure.label === null ? (
                                  <span className="text-[12px] text-slate-500">
                                    {GTM_UI_LABELS.unavailableHeading}
                                  </span>
                                ) : (
                                  <>
                                    <span
                                      className={cn(
                                        "inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold",
                                        GTM_TONE[measure.tone] ?? GTM_TONE.zinc
                                      )}
                                    >
                                      {measure.label}
                                    </span>
                                    <span className="text-[11px] text-slate-500 tabular-nums">
                                      {measure.value}
                                    </span>
                                  </>
                                )}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>

                      <WhyNowList bullets={row.whyNow} />
                    </>
                  )}

                  <Button type="button" variant="outline" size="sm" onClick={() => onOpen(item.route)}>
                    {GTM_PAGE_LABELS.entryAction}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Section>
  );
}

/**
 * Block 4 — suggested actions (R13.6, R13.7).
 *
 * "Contact Kerri": the queue row's `executionVerb` through `GTM_ACTION_LABELS`, then the
 * prospect's name, in that order and in one control. The verb is the table's — Weez opens
 * LinkedIn and the human sends, and this page does not get to phrase that differently.
 *
 * Only `executable` rows appear, because those are the ones a control can actually run. An
 * `ADVISORY` row is a real recommendation and is not a suggested action.
 */
function SuggestedActions({
  queue,
  spaceId,
  onOpen,
}: {
  queue: ActionQueueItem[];
  spaceId: string;
  onOpen: (route: string) => void;
}) {
  const items = queue.filter((item) => item.executable && item.executionVerb !== null);

  return (
    <Section icon={Lightbulb} title={NINA_GTM_LABELS.suggestedTitle}>
      <div data-testid={NINA_BLOCK_TEST_IDS.suggestedActions}>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-white p-5 text-xs leading-relaxed text-gray-500">
            {NINA_GTM_LABELS.noSuggestedActions}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.leadId}>
                <button
                  type="button"
                  data-lead-id={item.leadId}
                  data-action-type={item.actionType}
                  onClick={() => onOpen(prospectRoute(spaceId, item.leadId))}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-colors hover:border-indigo-200"
                >
                  <span className="min-w-0 flex-1 text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">
                      {GTM_ACTION_LABELS[item.executionVerb as keyof typeof GTM_ACTION_LABELS]}
                    </span>{" "}
                    <ProspectName fact={item.name} />
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Ninna() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentSpace, user, selectSpace, spaces } = useAuth();

  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<NinnaChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  /**
   * Whether the goal intake is expanded.
   *
   * Seeded from `?start=goal`, which is how the connections page hands a new founder over:
   * the whole failure this fixes is that the control existed and could not be found, so
   * arriving here from setup must never land on a collapsed section. `useState`'s initialiser
   * rather than an effect, so the section is open on the first paint and not after a flash of
   * the closed state. Once the page is up this is the founder's own toggle again — the
   * first-run branch below opens the intake by rendering it, not by writing to this.
   */
  const [goalIntakeOpen, setGoalIntakeOpen] = useState(
    () => searchParams.get("start") === "goal"
  );

  /**
   * Whether this workspace has been started, from the provider above the routes.
   *
   * Read, never derived: this page does not ask the campaign whether it is live, and a
   * failed or outstanding read answers "unread", which keeps `needsSetup` false and leaves
   * the four blocks exactly as they were. The one thing a stale answer must never do is
   * tell a founder mid-campaign to go start their campaign.
   */
  const {
    needsSetup,
    websiteConnected,
    goalSet,
    launched,
    nextStep,
    goal,
    campaign,
    refresh: refreshSetup,
  } = useWorkspaceSetup();

  /**
   * Whether this workspace has a goal to describe.
   *
   * `goalSet === true` is the flag, and it is deliberately the whole condition — not
   * `goal !== null`. The workflow marks a goal as set the moment it persists a strategy,
   * before anything has read the document back, so there is a real window where the flag is
   * true and the content is not there yet. `ActiveCampaignSummary` states that case; asking
   * for the content here instead would put "Set your GTM goal" back on screen for a founder
   * who had just finished setting one.
   *
   * `null` — unread, or the read failed — keeps the copy that shipped, for the same
   * fail-open reason `needsSetup` exists.
   */
  const hasGoal = goalSet === true;

  /**
   * The two GTM payloads, exactly as the API returned them, and whether the read failed.
   *
   * Payloads, not projections. There is no `immediateCount`, no `byTier` copy and no
   * pre-filtered opportunity list beside them, because each of those would be a second,
   * staler copy of something `getAttentionFeed` already reports (R20.4). The blocks filter
   * these on render and block 2 reads `feed.summary`.
   */
  const [feed, setFeed] = useState<AttentionFeed | null>(null);
  const [queue, setQueue] = useState<ActionQueuePage | null>(null);
  const [gtmFailed, setGtmFailed] = useState(false);

  // The balance, in chrome, from the provider that already wraps `Routes` (R17.1). This
  // page spends nothing, so there is nothing to refresh it after. Rendered
  // unconditionally: `CreditBalanceBadge` is what decides that an unread balance shows
  // nothing, and a `balance && …` guard here would hide a genuine 0 (R17.7).
  const { balance } = useCredits();

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);
  const userInteractedRef = useRef(false);
  const loadTokenRef = useRef(0);
  const gtmTokenRef = useRef(0);
  const spaceName = currentSpace?.name || spaces.find((s) => s.id === spaceId)?.name || "your workspace";
  const firstName = (user?.name || "").trim().split(" ")[0] || "";

  // Keep the space context in sync if a user deep-links straight into Ninna.
  useEffect(() => {
    if (spaceId && currentSpace?.id !== spaceId) {
      const match = spaces.find((s) => s.id === spaceId);
      if (match) selectSpace(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId, spaces]);

  const openLink = (link: string) => navigate(link);

  const loadBrief = async (isRefresh = false) => {
    if (!spaceId) return;
    const token = ++loadTokenRef.current;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      // Paint instantly from cache (if any); otherwise show the loader until the
      // first specialist reports in.
      const cached = getCachedBrief(spaceId);
      if (cached) {
        setBrief(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    try {
      const b = await ninnaAPI.getDailyBrief(spaceId, {
        onProgress: (partial) => {
          if (loadTokenRef.current !== token) return; // a newer load superseded this one
          setBrief(partial);
          setLoading(false);
        },
      });
      if (loadTokenRef.current !== token) return;
      setBrief(b);
    } catch (e) {
      // getDailyBrief is designed never to throw, but guard anyway.
      console.error("[ninna] brief load failed", e);
    } finally {
      if (loadTokenRef.current === token) {
        setLoading(false);
        setRefreshing(false);
      }
      // Record the visit AFTER we've computed "since your last visit".
      ninnaAPI.recordVisit(spaceId);
    }
  };

  /**
   * The three reads behind the four blocks, and nothing else on this page (R13.8).
   *
   * The feed and the queue are awaited together, because block 3 joins one to the other.
   * The dashboard is issued alongside them and its result is deliberately not kept: block 2
   * states `feed.summary`'s counts, so no rendered value on this page is a dashboard
   * derivation — which is the invariant Property 33 checks, and keeping the payload would be
   * the first step toward breaking it. Its failure is ignored for the same reason: a read
   * nothing renders from must not be able to blank a block.
   *
   * A failed feed or queue read is a failure and not an absence — the page says so and
   * offers the retry (R18.5) rather than showing a list assembled from somewhere else.
   */
  const loadGtm = async () => {
    if (!spaceId) return;
    const token = ++gtmTokenRef.current;
    setGtmFailed(false);

    void gtmAPI.getDashboard(spaceId, { periodDays: 7 }).catch(() => undefined);

    try {
      const [feedRead, queueRead] = await Promise.all([
        gtmAPI.getAttentionFeed(spaceId, { limit: 50 }),
        gtmAPI.getActionQueue(spaceId, { sort: "priority", limit: 25 }),
      ]);
      if (gtmTokenRef.current !== token) return; // a newer load superseded this one
      setFeed(feedRead);
      setQueue(queueRead);
    } catch (error) {
      if (gtmTokenRef.current !== token) return;
      console.error("[nina] attention read failed", error);
      setGtmFailed(true);
    }
  };

  useEffect(() => {
    if (!spaceId) {
      setLoading(false);
      return;
    }

    setBrief(null);
    setMessages([]);
    setFeed(null);
    setQueue(null);
    seededRef.current = false;
    userInteractedRef.current = false;

    loadBrief(false);
    loadGtm();

    return () => {
      loadTokenRef.current += 1;
      gtmTokenRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || thinking || !brief || !spaceId) return;
    userInteractedRef.current = true; // stop the brief from re-seeding the thread
    setMessages((prev) => [...prev, { role: "user", content: prompt, time: nowTime() }]);
    setInput("");
    setThinking(true);
    try {
      const res = await ninnaAPI.chat(prompt, brief, spaceId);
      setMessages((prev) => [...prev, { role: "ninna", content: res.text, cards: res.cards, time: nowTime() }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ninna", content: "I hit a snag reaching my reasoning model — mind trying that again in a moment?", time: nowTime() },
      ]);
    } finally {
      setThinking(false);
    }
  };

  /**
   * The header control: every source this page presents, re-read together.
   *
   * The setup read is in here because the campaign's day count is on screen now, and a
   * founder pressing Refresh on a page showing "Day 3 of 30" means that number too. It is
   * the provider's own `refresh`, so this stays one read per workspace rather than this page
   * fetching campaign state for itself — which is the thing R13.9 took off this page.
   */
  const refreshAll = () => {
    loadBrief(true);
    loadGtm();
    void refreshSetup();
  };

  // ── First run ───────────────────────────────────────────────────────────────

  /**
   * Whether anything is actually waiting on the representative.
   *
   * Read off the two payloads rather than tracked, for the reason the header states: this
   * page holds no counts. It is the difference between "this workspace has not started"
   * and "this workspace has started and has work" — and a workspace can be both mid-setup
   * and holding real work, if a founder set a goal, launched, and then a later read said
   * the campaign row had gone inactive. Work wins in that case.
   */
  const hasWaitingWork = useMemo(
    () => (feed?.items.length ?? 0) > 0 || (queue?.items.length ?? 0) > 0,
    [feed, queue]
  );

  /**
   * The blocks step aside for the setup steps.
   *
   * Four conditions, and each one is load-bearing:
   *
   *   `needsSetup`        the server said the workforce is not running. False while any of
   *                       the three reads is outstanding or failed, so this branch cannot
   *                       be taken on a guess.
   *   `!gtmFailed`        a failed GTM read has its own statement and a retry, and hiding
   *                       that behind a setup panel would hide a real fault.
   *   `feed !== null`     the feed has actually been read. Without this, "nothing waiting"
   *                       would also be true of a feed that has not arrived.
   *   `!hasWaitingWork`   there is genuinely nothing to show. A prospect who needs a reply
   *                       outranks a setup checklist every time.
   */
  const firstRun = needsSetup && !gtmFailed && feed !== null && !hasWaitingWork;

  /** Mid-setup, but with real work on screen. The steps compress to a strip above it. */
  const showSetupRail = needsSetup && !firstRun;

  /**
   * The chat's opening message, and the reason the seeding moved out of `loadBrief`.
   *
   * It used to be pushed from inside the brief load, three call sites deep. That worked
   * while the text was a pure function of the brief, and stopped working the moment it also
   * depended on whether the workspace had launched: the setup answers and the brief land in
   * either order, so a push from the brief's completion could write "the workforce is
   * executing" *after* the page had already worked out that nothing was running.
   *
   * Derived and then applied, so it cannot be stale. The memo is the whole opening message
   * for whatever is currently known, and the effect below is the only writer of it — which
   * also keeps the "stop re-seeding once the founder starts typing" rule in one place.
   */
  const seedText = useMemo(() => {
    if (!brief) return null;
    if (firstRun) return `${brief.greeting} ${NINA_GTM_LABELS.firstRunNarrative}`;
    return `${brief.greeting} Here's everything that happened ${brief.sinceLabel}.\n\n${brief.narrative}`;
  }, [brief, firstRun]);

  // Prose only. The opening message used to carry a decision-queue card and a
  // campaign-health card off the brief; both are GTM statements from outside the three
  // sanctioned reads (R13.8), and the campaign health is campaign orchestration besides
  // (R13.9). The four blocks are where the page states what needs doing. `ChatCard` still
  // renders every card type, because a reply from `ninnaAPI.chat` may carry one.
  useEffect(() => {
    if (seedText === null || userInteractedRef.current) return;
    setMessages([{ role: "ninna", content: seedText, time: nowTime() }]);
    seededRef.current = true;
  }, [seedText]);

  return (
    <div className="flex h-screen bg-[#FDFBFF] overflow-hidden">
      {/* Shared workspace shell — Ninna is a first-class workspace page and the
          home the sidebar's top item now points to (replacing the old dashboard). */}
      <ConversationSidebar
        spaceId={spaceId!}
        onNewChat={() => navigate("/spaces")}
        onSelectConversation={() => {}}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {loading || !brief ? (
          <BriefLoading spaceName={spaceName} balance={balance} />
        ) : (
          <>
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200/70 bg-white/80 backdrop-blur-xl px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <NinnaAvatar className="w-9 h-9" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-900 leading-none">{NINNA.name}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">{NINNA.short}</span>
              {brief.isDemo && (
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Demo</span>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 truncate block">{spaceName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <CreditBalanceBadge balance={balance} className="hidden sm:inline-flex" />
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            title="Refresh brief"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      {/* Body: dashboard + chat */}
      <div className="flex-1 flex min-h-0">
        {/* Daily Brief dashboard */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-8 py-8">
          <div className="max-w-3xl mx-auto space-y-10">
            {/* Hero.
                The eyebrow, the headline and Nina's line all come from the brief for a
                running workspace, and all three are replaced on a first run. Replaced
                rather than suppressed: a founder still needs a greeting and still needs to
                know whose move it is — what they must not be told is that a workforce
                nobody has started is executing. */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px w-8 bg-indigo-500/30" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600/70">
                  {firstRun
                    ? NINA_GTM_LABELS.firstRunEyebrow
                    : `Daily Brief · ${brief.sinceLabel}`}
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 leading-tight">
                {brief.greeting}
                {firstName ? ` ${firstName}.` : ""}
              </h1>
              <p className="text-base text-gray-600 leading-relaxed">
                {firstRun ? NINA_GTM_LABELS.firstRunHeadline : brief.headline}
              </p>
              <div className="rounded-3xl border border-indigo-100 bg-white p-5 flex items-start gap-3 shadow-sm">
                <NinnaAvatar className="w-9 h-9" />
                <p className="text-sm text-gray-700 leading-relaxed pt-1">
                  {renderInline(
                    firstRun ? NINA_GTM_LABELS.firstRunNarrative : brief.narrative
                  )}
                </p>
              </div>
            </div>

            {/* ── Setup, while it is outstanding ──
                Two shapes, because they answer two different situations. With nothing
                waiting, this is the whole content of the page: the three steps, stated,
                with the live one carrying its control. With work waiting, it compresses to
                a strip so it never stands in front of a prospect who needs a reply. */}
            {(firstRun || showSetupRail) && (
              <WorkspaceSetupChecklist
                variant={firstRun ? "panel" : "rail"}
                headingLevel="h2"
                completed={{ website: websiteConnected, goal: goalSet, launch: launched }}
                activeStep={nextStep}
                // Every remaining step is the campaign-creation workflow, and that workflow
                // is `/gtm-setup` — one canonical place, which is also where a new workspace
                // lands. Nina keeps the same workflow behind the disclosure below for
                // re-aiming a running workspace; she does not compete with it for creating
                // the first campaign.
                onAdvance={() => navigate(`/gtm-setup/${spaceId}`)}
              />
            )}

            {/* The four blocks. One failure state for the two reads they share, and one
                announcement while they are being read — a block never fills the wait with
                a zero or with a list from another source.

                Skipped entirely on a first run: all four would be absence statements about
                prospects, and the thing that is absent is a goal. */}
            {firstRun ? null : gtmFailed ? (
              <Section icon={CheckCircle2} title={ATTENTION_LABELS.pageTitle}>
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3">
                  <p className="min-w-0 flex-1 text-xs text-gray-500">{ATTENTION_LABELS.loadFailed}</p>
                  <Button type="button" variant="outline" size="sm" onClick={loadGtm}>
                    {GTM_PAGE_LABELS.retry}
                  </Button>
                </div>
              </Section>
            ) : !feed ? (
              <p
                aria-live="polite"
                className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white p-5 text-xs font-semibold text-gray-500"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {NINA_GTM_LABELS.loading}
              </p>
            ) : (
              <>
                <ImmediatePriorities feed={feed} onOpen={openLink} />
                <AttentionSummaryBlock
                  summary={feed.summary}
                  onOpenQueue={() => navigate(`/action-queue/${spaceId}`)}
                />
                <Opportunities feed={feed} queue={queue?.items ?? []} onOpen={openLink} />
                <SuggestedActions queue={queue?.items ?? []} spaceId={spaceId!} onOpen={openLink} />
              </>
            )}

            {/* The workspace's goal, and — once there is one — the campaign running against
                it.

                This section used to say the same thing forever: "Set your GTM goal", over
                copy describing what Nina *would* do. A founder who had set a full target,
                launched, and come back the next morning read that as though their campaign
                did not exist. So when a goal exists the heading, the control's verb and the
                body all change: the section names what the workspace is going after, states
                that the campaign is live and where it is in its window, and the control says
                "Change goal" rather than asking for one that is already set.

                Both new values are read, never derived. `goal` is the strategy this workspace
                persisted when it was built, which nothing had ever read back; `campaign` is
                the active-status payload the provider above the routes already fetched to
                decide a boolean. Neither comes from the dashboard read, so the four blocks
                above are still sourced exactly as R13.8 requires, and nothing here polls,
                starts, stops or reconfigures a campaign — it reports one.

                Re-aiming stays behind the disclosure, because the day's work comes first.
                Creating the *first* campaign is not this control's job — that is
                `/gtm-setup`, which is where the setup panel above sends a founder and where
                a new workspace lands.

                No `onProceed`: the workflow owns its own launch. It used to render its
                approve-and-launch button only when a caller passed that prop, and this page
                never did — which is how a founder could set a goal, read a full strategy and
                find nothing to press. The control is unconditional now, so no caller can
                delete it by omission. */}
            <Section
              icon={Target}
              // "Your active campaign" only when one is actually running. A workspace that
              // has a goal but was never launched — the founder read the strategy and closed
              // the tab — has a goal to show and no campaign to call active, and the setup
              // rail above is already telling them the launch step is outstanding.
              title={
                launched === true
                  ? ACTIVE_CAMPAIGN_LABELS.sectionTitle
                  : NINA_GTM_LABELS.goalTitle
              }
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={goalIntakeOpen}
                  onClick={() => setGoalIntakeOpen((open) => !open)}
                >
                  {goalIntakeOpen
                    ? NINA_GTM_LABELS.goalClose
                    : hasGoal
                      ? ACTIVE_CAMPAIGN_LABELS.changeGoal
                      : NINA_GTM_LABELS.goalOpen}
                </Button>
              }
            >
              {goalIntakeOpen ? (
                <NinaGoalIntake spaceId={spaceId!} />
              ) : hasGoal ? (
                <ActiveCampaignSummary goal={goal} campaign={campaign} />
              ) : (
                <p className="rounded-2xl border border-gray-100 bg-white p-5 text-xs leading-relaxed text-gray-500">
                  {NINA_GTM_LABELS.goalNote}
                </p>
              )}
            </Section>

            <div className="h-4" />
          </div>
        </main>

        {/* Ninna chat dock */}
        <aside className="hidden lg:flex w-[400px] xl:w-[440px] shrink-0 border-l border-gray-200/70 bg-white flex-col min-h-0">
          <div className="shrink-0 px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600">Ask Nina</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-gray-900 text-white text-sm leading-relaxed">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <NinnaAvatar className="w-8 h-8" />
                    <div className="min-w-0 flex-1">
                      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {renderInline(m.content)}
                      </div>
                    </div>
                  </div>
                  {m.cards && m.cards.length > 0 && (
                    <div className="pl-10 space-y-3">
                      {m.cards.map((c, ci) => (
                        <ChatCard key={ci} card={c} onOpen={openLink} />
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
            {thinking && (
              <div className="flex items-start gap-2.5">
                <NinnaAvatar className="w-8 h-8" />
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 inline-flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Nina is thinking…
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick prompts */}
          <div className="shrink-0 px-4 pt-3 flex flex-wrap gap-1.5">
            {NINNA_QUICK_PROMPTS.slice(0, 4).map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={thinking}
                className="px-2.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Composer */}
          <div className="shrink-0 p-4">
            <div className="flex items-center gap-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-1.5 pl-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask Nina about your pipeline…"
                disabled={thinking}
                className="flex-1 bg-transparent px-1 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none border-0 focus:ring-0 disabled:opacity-60"
              />
              <Button
                onClick={() => send()}
                disabled={thinking || !input.trim()}
                className="h-9 w-9 p-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
              >
                {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </aside>
      </div>
          </>
        )}
      </div>

    </div>
  );
}
