// pages/ProspectIntelligence.tsx
//
// Prospect Intelligence — the decision-maker view over the prospects that have been
// **enriched**. It reads the *same* Cosmos-backed workspace Eva does (GET /eva/workspace →
// eva_leads container) and reshapes it: prospects grouped by company, the resolved
// decision-maker per lead, and a dossier that answers who / why them / why now / what to
// open with.
//
// ─── What is on this page, and what is not ────────────────────────────────────
//
// **Only the leads Enrich Now promoted.** Discovery's full output — every qualified
// account Eva found — lives on Revenue Intelligence, which is where Enrich Now is pressed.
// This page is what comes back from it.
//
// That split is not presentational. Every control here beyond the dossier belongs to the
// GTM lifecycle — Activate Intelligence, the ranked next move, Contact Directly — and every
// one of those routes keys on `sales_leads.id`. Enrich Now is the only thing that creates
// that row (`lead_promotion.promote()`, from the `/eva/lead/enrich` route and nowhere else),
// so a lead that has not been enriched has no GTM identity at all. Listing it here would
// mean rendering a dossier with nothing in it above controls certain to 404.
//
// The filter is `evaAPI.isEnrichedProspect`, which reads `gtmLeadId` — the promoted id,
// written back onto the document. It deliberately does *not* read `enrichment.status` or
// `handoffState`: the workspace sweep in `core/eva/service.py` sets both of those for any
// lead that *arrives* carrying a contact email, with no enrichment and no promotion, so
// either one would put unworkable prospects on this page.
//
// `qualifiedLeads` is kept beside `activeLeads` for the empty states, because "discovery
// has found nothing yet" and "discovery found forty accounts and none is enriched" need
// different sentences and different next steps.
//
// Grounding rule: every number and sentence on this page comes from a field on
// the workspace payload. Nothing is scored, invented or rotated client-side.
// When a field is missing we say so instead of filling the gap.
//
// ─── The GTM state overlay (R28.2, R28.7) ─────────────────────────────────────
//
// Each decision-maker row and each dossier also carries where the prospect stands
// in the GTM journey, how urgent the live recommendation is, and what intent has
// been observed. None of that is on the Eva workspace payload — it belongs to the
// prospect state engine — so it is read through `services/gtmAPI.ts` and joined
// onto Eva's leads by `leadId`, which is the same `lead_id` the entry action
// already carries into `GTMProspect`.
//
// **Two reads, both cheap, and neither one per row.**
//
//   `gtmAPI.getActionQueue()`  one read for the whole page. The queue is one row
//                              per prospect with a live recommendation and carries
//                              `journeyState`, `priorityTier`, `actionType` and
//                              `channel` on each, so a single call fills the
//                              journey badge and the tier for every row on screen.
//                              `getProspectState()` also carries `journeyState`,
//                              but only for one lead — firing it per row would be
//                              one request per decision-maker on mount, which is
//                              exactly what a company with twelve contacts must
//                              not cost.
//   `gtmAPI.getProspectState()` one read for the *selected* lead only, because the
//                              eleven Intent records live on `ProspectStateFull`
//                              and on no list payload. So the intent summary is a
//                              dossier field rather than a row field: the dossier
//                              shows one prospect at a time, and that is the whole
//                              reason it is affordable here.
//
// **Absence is absence.** A prospect with no live recommendation has no tier and
// no queue-side journey value, and both render as *absent* — never as `LATER`,
// which is a real tier, and never as `UNKNOWN`, which would be a claim we looked.
// Where the single queue read did not reach the end of the queue we say only that
// the row was not on the page we read, because "not found in a truncated list" and
// "has no live recommendation" are different facts. An intent summary with nothing
// behind it says so rather than showing a zero.
//
// **Neither read can take the dossier down.** Both are secondary: their failures
// are held in their own state, surfaced as a line of text next to the fields they
// would have filled, and never touch `ws`, `loading` or `error`. Eva's rows render
// exactly as they did before whether or not the GTM layer answers.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  Compass,
  Copy,
  ExternalLink,
  Flag,
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
  Route,
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
import { JourneyStateBadge } from "@/components/gtm/JourneyStateBadge";
import { ACTION_CARD_LABELS, PRIORITY_TIER_LABELS } from "@/components/gtm/NextActionPanel";
import { INTENT_PANEL_LABELS } from "@/components/gtm/IntentPanel";
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "@/components/gtm/ObservedValue";
import {
  CreditBalanceBadge,
  CreditPriceTag,
} from "@/components/gtm/CreditBalance";
import { InsufficientCreditsAlert } from "@/components/gtm/InsufficientCreditsAlert";
import { useCredits } from "@/hooks/useCredits";
import {
  CHANNEL_LABEL,
  GTM_INTENT_LABELS,
  GTM_JOURNEY_LABELS,
  GTM_NBA_ACTION_LABELS,
  GTM_PAGE_LABELS,
  GTM_UI_LABELS,
  GTM_IDENTITY_LABELS,
  PROSPECT_STAGE_LABELS,
  PROSPECT_INTELLIGENCE_SECTIONS,
  CONTACT_DIRECTLY_LABELS,
  TONE as GTM_TONE,
} from "@/components/gtm/labels";
// `trackRefusal` lives with the identity block that owns the gate, not in the label table.
import { trackRefusal } from "@/components/gtm/IdentityPanel";
import gtmAPI, {
  type ActionQueueItem,
  type CandidateAction,
  type Intent,
  type NextBestAction,
  type ProspectDetail,
  type ProspectState,
  type ProspectStateFull,
  type ProspectTracking,
} from "@/services/gtmAPI";
import { ProspectDecision } from "@/components/gtm/ProspectDecision";
import { NextBestActionCard } from "@/components/gtm/NextBestActionCard";
// The four intelligence panels, reused as they are. This restructure is composition and
// hierarchy: not one of them is reimplemented, subclassed or wrapped.
import { StateDimensionGrid } from "@/components/gtm/StateDimensionGrid";
import { StateHistoryPanel } from "@/components/gtm/StateHistoryPanel";
import { SignalList } from "@/components/gtm/SignalList";
import { ProspectTimeline } from "@/components/gtm/ProspectTimeline";
import {
  isIntelligenceActive,
  prospectStageOf,
  showsDecision,
  type ProspectStage,
} from "@/components/gtm/prospectStage";
import {
  evaAPI,
  isEnrichedProspect,
  isInsufficientCredits,
  ACTION_META,
  ENRICHMENT_META,
  SIGNAL_META,
  TIER_META,
  tierMeta,
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

// ─── The GTM state overlay ────────────────────────────────────────────────────

/**
 * The strings this overlay needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS` and
 * `GTMActionQueue.tsx`'s `ACTION_QUEUE_LABELS` established, because `labels.ts` was
 * closed for this feature. They belong there beside `GTM_PAGE_LABELS`, and moving
 * them is a one-line change at each use site.
 *
 * Everything already in `labels.ts` is taken from there rather than restated:
 * `GTM_JOURNEY_LABELS`, `GTM_PRIORITY_TIER_LABELS` (through `PRIORITY_TIER_LABELS`),
 * `GTM_INTENT_LABELS`, `GTM_NBA_ACTION_LABELS`, `CHANNEL_LABEL`,
 * `GTM_UI_LABELS.computed` and `.confidence`, `ACTION_CARD_LABELS.priority`,
 * `INTENT_PANEL_LABELS.neverEvaluated`, `GTM_PAGE_LABELS.entryAction`.
 *
 * No entry states or implies that Weez sends anything. The only strings here that
 * name a channel are `CHANNEL_LABEL`'s and the action titles from
 * `GTM_NBA_ACTION_LABELS`, which carry the `Open <channel> & <verb>` form.
 *
 * The three absence strings are three different facts and are deliberately not one
 * string. `noRecommendation` is a statement about the prospect — the queue was read
 * to its end and this lead is not on it. `notOnQueuePage` is a statement about the
 * read — the queue was longer than the one page we took, so we do not know. And
 * `overlayFailed` is a statement about us. None of them is a tier, because `LATER`
 * is a real tier and would be a plausible-looking lie.
 */
export const PROSPECT_GTM_LABELS = {
  sectionTitle: "Journey, priority & intent",
  journeyLabel: "Journey",
  intentHeading: "Intent observed",
  recommendationHeading: "Live recommendation",

  /** What the tier is banded from, so the badge reads as re-derivable and not as a verdict. */
  tierNote:
    "Banded from urgency, expected outcome, business value, signal freshness, action confidence and relationship state. The full ranking is on the prospect's own page.",

  /** The three absences, kept apart. */
  noRecommendation: "No live recommendation — nothing is ranked for this prospect",
  notOnQueuePage: "Not on the page of the queue we read — priority unknown here",
  overlayFailed: "Couldn't read the journey and priority for this prospect",

  /** Absence in a row chip, where there is no room for the sentence above it. */
  noRecommendationShort: "No live recommendation",
  notOnQueuePageShort: "Priority unknown",
  overlayFailedShort: "Journey unavailable",

  /**
   * The intent summary's own absences. `noIntentObserved` is the plural of
   * `INTENT_PANEL_LABELS.noSupport`: every one of the eleven types was evaluated and
   * none is supported, which is a real answer and not an empty state.
   */
  noIntentObserved: "Nothing observed for any intent type",
  intentUnavailable: "Couldn't read the intent records for this prospect",
  intentLoading: "Reading intent records",
  intentNote: "Eleven types are held separately. The strongest observed are shown here.",
} as const;

/** How many of the eleven intent records the dossier summarises. The rest are on `GTMProspect`. */
export const INTENT_SUMMARY_LIMIT = 3;

/**
 * One page of the action queue is all this page reads, and `complete` says whether
 * that page was the whole queue.
 *
 * The distinction is the only thing that keeps the absence honest: a lead missing
 * from a queue we read to the end has no live recommendation, and a lead missing
 * from a truncated page is simply a lead we did not look at.
 */
export interface QueueOverlay {
  byLead: Map<string, ActionQueueItem>;
  complete: boolean;
}

/**
 * How much of the queue one read takes.
 *
 * One page, deliberately: the join has to cost a fixed number of requests no matter
 * how many decision-makers are on screen. A queue longer than this leaves the rows
 * past it reading `notOnQueuePage`, which is the truth, rather than walking the cursor
 * on mount.
 */
export const PROSPECT_QUEUE_PAGE_SIZE = 100;

/** The overlay for one lead: the queue row, or the reason there isn't one. */
export type OverlayState =
  | { kind: "row"; item: ActionQueueItem }
  | { kind: "none" }
  | { kind: "unknown" }
  | { kind: "failed" };

/**
 * Which of the four states a lead is in.
 *
 * `failed` wins over everything: when the read did not land we say so rather than
 * reporting an empty map as an absence of recommendations.
 */
/**
 * One collapsed intelligence section, whose contents are built only once opened.
 *
 * **The gate is about reads, not visibility.** `<details>` already handles showing and
 * hiding; what this adds is that `children` is a *function*, so the panel inside is not
 * constructed until the operator asks for it. `SignalList`, `StateHistoryPanel` and
 * `ProspectTimeline` each fetch a collection on mount, so rendering them closed would put
 * three requests behind every prospect selection for panels nobody opened — which is the
 * cost this page has always refused to pay, and the same reasoning that keeps the queue to
 * one read for the whole page rather than one per row.
 *
 * A native `<summary>` rather than a button: focusable and Enter/Space operable as it
 * stands, with no `aria-expanded` of ours to keep in sync with the element's own `open`.
 */
function IntelligenceSection({
  summary,
  note,
  children,
}: {
  summary: string;
  note: string;
  /** Built on first open. Deliberately a function — see the docblock. */
  children: () => ReactNode;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <details
      className="group rounded-2xl border border-zinc-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      // Latched rather than tracking `open`: closing a section must not throw away a
      // collection the operator already paid a request for, so re-opening it is free.
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary className="flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className="block text-[12.5px] font-semibold text-zinc-900">{summary}</span>
          <span className="block text-[11px] leading-relaxed text-zinc-400">{note}</span>
        </span>
      </summary>
      <div className="border-t border-zinc-100 p-4">{opened ? children() : null}</div>
    </details>
  );
}

/**
 * The `sales_leads.id` for a lead on this page — the only id the GTM layer answers to.
 *
 * **Eva's `lead.id` is not it, and using it was a real bug.** Eva mints `lead_<hex>`
 * document ids; `gtmLeadId` is the SQL row `lead_promotion.promote()` created during
 * Enrich Now, and `evaAPI`'s own docblock says every GTM route keys on that one. Three
 * call sites on this page were passing `lead.id`:
 *
 *   - `getProspectState()` for the intent summary, which 404'd every time and rendered
 *     as "Couldn't read the intent records for this prospect" — reported as a failed
 *     read, which it was, for a reason that had nothing to do with the prospect.
 *   - `overlayFor()`, which joins against `ActionQueueItem.leadId`. A `lead_<hex>` never
 *     matches a `sales_leads.id`, so the journey badge and the priority tier were
 *     silently absent for every row on the page, indistinguishable from a prospect with
 *     no live recommendation.
 *   - the entry into the per-prospect execution surface, which handed the Eva id
 *     straight to `GTMProspect` as its `lead_id` — so every read on the destination page
 *     404'd too.
 *
 * Safe to return a bare string because this page's subject is `activeLeads`, which is
 * filtered by `isEnrichedProspect` — a lead without a `gtmLeadId` is not on screen. The
 * empty-string fallback is for the type, not for a case that reaches a request: the two
 * call sites that fetch both guard on a falsy id before they call.
 */
export function gtmLeadIdOf(lead: QualifiedLead): string {
  return (lead.gtmLeadId ?? "").trim();
}

export function overlayFor(
  leadId: string,
  overlay: QueueOverlay | null,
  failed: boolean
): OverlayState {
  if (failed) return { kind: "failed" };
  if (!overlay) return { kind: "unknown" };
  const item = overlay.byLead.get(leadId);
  if (item) return { kind: "row", item };
  return overlay.complete ? { kind: "none" } : { kind: "unknown" };
}

/** The short absence text for a row chip, or null when there is a queue row to render. */
export function absenceShort(state: OverlayState): string | null {
  switch (state.kind) {
    case "row":
      return null;
    case "none":
      return PROSPECT_GTM_LABELS.noRecommendationShort;
    case "unknown":
      return PROSPECT_GTM_LABELS.notOnQueuePageShort;
    case "failed":
      return PROSPECT_GTM_LABELS.overlayFailedShort;
  }
}

/** The full absence sentence for the dossier, or null when there is a queue row. */
export function absenceSentence(state: OverlayState): string | null {
  switch (state.kind) {
    case "row":
      return null;
    case "none":
      return PROSPECT_GTM_LABELS.noRecommendation;
    case "unknown":
      return PROSPECT_GTM_LABELS.notOnQueuePage;
    case "failed":
      return PROSPECT_GTM_LABELS.overlayFailed;
  }
}

/**
 * The strongest observed intents, and what to say when there are none.
 *
 * A sort over the numbers the server sent, then a filter on `value > 0` — nothing is
 * scored here and no threshold is invented. A row at value zero is not "weak intent",
 * it is *nothing observed for that type* (R5.5), which is why it is summarised as a
 * sentence rather than shown as a zero in a chip.
 *
 * `note` distinguishes the two zeros the engine keeps apart: a type with an
 * `evaluatedAt` was looked at and found unsupported, and a type without one has never
 * been looked at. Where nothing is supported at all, the note says which of those is
 * true rather than picking the friendlier reading.
 */
export function intentSummary(intents: Intent[]): { rows: Intent[]; note: string | null } {
  const ranked = [...(intents || [])].sort((a, b) =>
    b.value !== a.value ? b.value - a.value : b.confidence - a.confidence
  );
  const observed = ranked.filter((i) => i.value > 0);
  if (observed.length > 0) return { rows: observed.slice(0, INTENT_SUMMARY_LIMIT), note: null };
  const everEvaluated = ranked.some((i) => Boolean(i.evaluatedAt));
  return {
    rows: [],
    note: everEvaluated
      ? PROSPECT_GTM_LABELS.noIntentObserved
      : INTENT_PANEL_LABELS.neverEvaluated,
  };
}

/** A number as the server sent it, to two places when it has a fraction. `ActionCard`'s format. */
function formatMeasure(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * The journey projection and the priority tier as two phrasing-level chips.
 *
 * Phrasing-level on purpose: these render inside `ProspectCard`, which is a
 * `<button>`, and a button may only contain phrasing content. The dossier mounts the
 * real `JourneyStateBadge` — with its display-only note — where block content is
 * allowed. Both carry visible text and an `sr-only` name, so neither one leans on its
 * tone to be readable (R18.9).
 */
function JourneyTierChips({ state }: { state: OverlayState }) {
  const absent = absenceShort(state);
  if (absent) {
    return (
      <Chip tone="zinc" icon={Route}>
        <span className="sr-only">{PROSPECT_GTM_LABELS.journeyLabel}: </span>
        {absent}
      </Chip>
    );
  }

  const item = (state as { kind: "row"; item: ActionQueueItem }).item;
  const journey = item.journeyState;
  const journeyUnknown = journey.isUnknown || journey.value == null;

  return (
    <>
      <Chip tone="zinc" icon={Route}>
        <span className="sr-only">
          {GTM_UI_LABELS.computed} {PROSPECT_GTM_LABELS.journeyLabel}:{" "}
        </span>
        {journeyUnknown ? (
          <>
            {UNKNOWN_TEXT}
            <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
          </>
        ) : (
          GTM_JOURNEY_LABELS[journey.value as string] ?? String(journey.value)
        )}
      </Chip>
      <Chip tone="amber" icon={Flag}>
        <span className="sr-only">{ACTION_CARD_LABELS.priority}: </span>
        {PRIORITY_TIER_LABELS[item.priorityTier] ?? item.priorityTier}
      </Chip>
    </>
  );
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

/**
 * The six tiles, and which population each one counts.
 *
 * Three of them are about **this page's** population — the enriched prospects — and three
 * are workspace-wide facts that belong to discovery. Mixing the two without saying so is
 * how a header ends up reading "40 qualified leads" above a list of two, so each tile's
 * `sub` names its own scope.
 *
 * `prospects` is the enriched set the page lists. `qualifiedTotal` is discovery's whole
 * output, carried so the enriched count can be read as a fraction of it — which is the
 * number that actually tells the operator how much of their pipeline they have worked.
 */
function SummaryHeader({
  ws,
  companies,
  prospects,
  qualifiedTotal,
}: {
  ws: EvaWorkspace;
  companies: CompanyGroup[];
  prospects: QualifiedLead[];
  qualifiedTotal: number;
}) {
  const m = ws.metrics;
  // Counted over the enriched prospects, not the workspace: these three describe the rows
  // on screen, and a count that included un-enriched leads would describe a different list.
  const withContact = prospects.filter((l) => l.contact?.name).length;
  const verified = prospects.filter((l) => l.contact?.emailVerified).length;
  const withEmail = prospects.filter((l) => l.contact?.email).length;

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
        <StatTile label="Companies" value={companies.length} sub="on this page" />
        <StatTile
          label="Enriched prospects"
          value={prospects.length}
          sub={`of ${qualifiedTotal} qualified`}
          tone="text-violet-600"
        />
        <StatTile label="Decision-makers" value={withContact} sub="contact resolved" />
        <StatTile
          label="Emails found"
          value={withEmail}
          sub={`${verified} verified`}
          tone="text-emerald-600"
        />
        {/* The two workspace-wide facts, labelled as such. They belong to discovery rather
            than to this page's population, and the `sub` says so rather than leaving a
            reader to assume they are counting the rows below. */}
        <StatTile label="Signals / wk" value={m.signalsThisWeek} sub={`${m.signalsCaptured} workspace total`} />
        <StatTile label="Handed to Max" value={m.handedToMax} sub="workspace total" tone="text-violet-600" />
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
  const tier = tierMeta(group.topTier);
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
  overlay,
  onSelect,
}: {
  lead: QualifiedLead;
  active: boolean;
  /** Where this prospect stands in the GTM journey, or why we can't say. */
  overlay: OverlayState;
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
      {/* Where this prospect stands in the GTM journey, and how urgent the live
          recommendation is. Both come from one action-queue read joined by lead id;
          a prospect with no live recommendation says so rather than showing a tier. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <JourneyTierChips state={overlay} />
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

/**
 * The three per-prospect GTM reads, and which of them failed.
 *
 * A flag per read rather than one shared `failed`, because they are three independent
 * routes and collapsing them would make a page that could not read the ranking claim it
 * could not read the belief either.
 */
export interface SelectedProspectRead {
  loading: boolean;
  detail: ProspectDetail | null;
  detailFailed: boolean;
  state: ProspectStateFull | null;
  stateFailed: boolean;
  ranking: NextBestAction | null;
  rankingFailed: boolean;
}

export const EMPTY_SELECTED_READ: SelectedProspectRead = {
  loading: false,
  detail: null,
  detailFailed: false,
  state: null,
  stateFailed: false,
  ranking: null,
  rankingFailed: false,
};

/** What the dossier knows about the selected lead's intent records, and how it knows. */
export interface IntentReadState {
  loading: boolean;
  failed: boolean;
  state: ProspectStateFull | null;
}

/**
 * The journey projection, the priority tier and the intent summary for one dossier.
 *
 * The journey badge is the shared `JourneyStateBadge`, mounted unchanged and carrying
 * its own display-only note — the projection is recomputed from the dimensions on
 * every read and this panel is not allowed to let it read as an observed fact. The
 * dimensions it summarises live on the relationship intelligence page, which is what
 * the existing entry action below opens.
 *
 * The tier is a band and carries no disclaimer, so the six inputs it was banded from
 * are named beside it in `tierNote` and the ranking itself is one click away. The
 * intent rows are the strongest of the eleven the engine holds; the other eight are on
 * that same page, held separately, because a hiring signal is not a buying signal.
 */
function JourneyPriorityIntentPanel({
  overlay,
  intent,
}: {
  overlay: OverlayState;
  intent: IntentReadState;
}) {
  const sentence = absenceSentence(overlay);
  const item = overlay.kind === "row" ? overlay.item : null;
  const summary = useMemo(
    () => intentSummary(intent.state?.intents ?? []),
    [intent.state]
  );

  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <PanelTitle icon={Route}>{PROSPECT_GTM_LABELS.sectionTitle}</PanelTitle>

      {item ? (
        <div className="space-y-2.5">
          {/* The projection, with the note that keeps it from reading as authority. */}
          <JourneyStateBadge journeyState={item.journeyState} />

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                GTM_TONE.amber
              )}
            >
              <Flag className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">{ACTION_CARD_LABELS.priority}: </span>
              {PRIORITY_TIER_LABELS[item.priorityTier] ?? item.priorityTier}
            </span>
            {/* What the tier is a priority *for*. The action title comes from
                `GTM_NBA_ACTION_LABELS`, which never says Weez sends anything. */}
            <span className="text-[11.5px] font-medium text-zinc-600">
              <span className="sr-only">{PROSPECT_GTM_LABELS.recommendationHeading}: </span>
              {GTM_NBA_ACTION_LABELS[item.actionType] ?? item.actionType}
            </span>
            {item.channel && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  GTM_TONE.zinc
                )}
              >
                {CHANNEL_LABEL[item.channel] ?? item.channel}
              </span>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-zinc-500">{PROSPECT_GTM_LABELS.tierNote}</p>
        </div>
      ) : (
        /* No tier, no queue-side journey value — and the reason, which is a different
           fact in each of the three cases. Never `LATER`, never a zero. */
        <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-center text-[12px] text-zinc-500">
          {sentence}
        </p>
      )}

      {/* Intent, read for this one prospect because the eleven records live on the
          prospect state and on no list payload. */}
      <div className="mt-3.5 border-t border-zinc-100 pt-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          <Compass className="h-3 w-3" aria-hidden="true" /> {PROSPECT_GTM_LABELS.intentHeading}
        </p>
        {intent.loading ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-zinc-400">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {PROSPECT_GTM_LABELS.intentLoading}
          </p>
        ) : intent.failed ? (
          <p className="mt-1.5 text-[12px] text-zinc-500">{PROSPECT_GTM_LABELS.intentUnavailable}</p>
        ) : summary.rows.length > 0 ? (
          <>
            <ul className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {summary.rows.map((row) => (
                <li key={row.intentType} data-intent-type={row.intentType}>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      GTM_TONE.zinc
                    )}
                  >
                    {GTM_INTENT_LABELS[row.intentType] ?? row.intentType}
                    <span className="font-bold tabular-nums">{formatMeasure(row.value)}</span>
                    <span className="font-medium text-zinc-500">
                      <span className="sr-only">{GTM_UI_LABELS.confidence}: </span>
                      {formatMeasure(row.confidence)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
              {PROSPECT_GTM_LABELS.intentNote}
            </p>
          </>
        ) : (
          /* Nothing behind the summary says so — a zero row is "nothing observed for
             that type", never "weak intent", and never a number in a chip. */
          <p className="mt-1.5 text-[12px] text-zinc-500">{summary.note}</p>
        )}
      </div>
    </div>
  );
}

function Dossier({
  lead,
  group,
  icp,
  overlay,
  intent,
  onAction,
  onShowEmail,
  onOpenMax,
  onOpenRelationshipIntelligence,
  enrichPrice = null,
  decision,
  intelligence,
}: {
  lead: QualifiedLead;
  group: CompanyGroup;
  icp?: EvaWorkspace["icp"];
  /** Where this prospect stands in the GTM journey, or why we can't say. */
  overlay: OverlayState;
  /** The selected lead's intent records, or the reason there are none to show. */
  intent: IntentReadState;
  /**
   * The lifecycle stage and the two-way choice that belongs to it.
   *
   * One object rather than eight loose props, because they are one thing: what stage this
   * prospect is in and what the operator can do about it. The dossier renders it; the page
   * decides it.
   */
  decision: {
    stage: ProspectStage;
    onContactDirectly: () => void;
    contactUnavailableReason: string | null;
    contactPrice: number | null;
    onActivate: () => void;
    activating: boolean;
    activateUnavailableReason: string | null;
    activatePrice: number | null;
    /** What the last activation did, or the server's refusal. Never a fabrication. */
    notice: string | null;
    /**
     * The prospect read failed, so no stage can be claimed.
     *
     * Kept apart from the stage rather than folded into it, because a failed read and a
     * prospect nobody has looked for are different facts that happen to look the same from
     * here: with no payload, `verificationStatus` and `profileId` are both null and the
     * stage machine would land on `RESOLVING` — telling the operator an identity search is
     * under way when actually a request errored. Absence is not a stage.
     */
    readFailed: boolean;
    /**
     * The recommended candidate, or null when no evaluation has produced one.
     *
     * Null is a real answer rather than a gap to fill: the backend refuses to fabricate a
     * `WAIT` for a prospect nothing has scored, so the card is simply absent and the stage
     * banner is what says why.
     */
    recommended: CandidateAction | null;
    /** Go and perform the recommended action, on the surface that owns execution. */
    onTakeAction: () => void;
    /**
     * The ranking read failed, so the absence of a recommendation is not an answer.
     *
     * The same absent-versus-failed distinction `readFailed` draws, one level down. Without
     * this the card is simply missing, which is indistinguishable from "nothing is
     * recommended for this prospect" — and those call for different things from the
     * operator: one is a retry, the other is patience.
     */
    rankingFailed: boolean;
  };
  /**
   * What the deeper intelligence sections need: the ids they fetch with, and the state
   * payload the one non-fetching panel renders.
   *
   * Separate from `decision` because it is a different concern. `decision` is what the
   * operator can *do*; this is the evidence for why they should. Keeping them apart is what
   * stops the dossier's prop list from becoming a bag of unrelated flags.
   */
  intelligence: {
    /** The brand. Every GTM route is brand-scoped. */
    brandId: string;
    /** `sales_leads.id`. Empty suppresses the whole region rather than fetching with "". */
    gtmLeadId: string;
    /** `ProspectDetail.state` — the four dimensions. Null when the prospect read failed. */
    state: ProspectState | null;
    /** The engine's full read, which adds the extended dimensions and confidences. */
    stateFull: ProspectStateFull | null;
    /** Bumped to make the three fetching panels re-read their collections. */
    refreshKey: number;
  };
  onAction: (lead: QualifiedLead, action: "hand_to_max" | "reject" | "reset") => void;
  onShowEmail: (lead: QualifiedLead) => Promise<void> | void;
  onOpenMax: () => void;
  /** Open this lead on the LinkedIn GTM execution surface (relationship intelligence). */
  onOpenRelationshipIntelligence: () => void;
  /**
   * What Enrich Now costs, from the server's price list. `null` renders no tag — the page
   * owns the balance read and this dossier is handed the answer rather than making its own.
   */
  enrichPrice?: number | null;
}) {
  const tier = tierMeta(lead.acvTier);
  const action = ACTION_META[lead.recommendedAction];
  const enrichment = ENRICHMENT_META[lead.enrichment?.status];
  const handed = lead.handoffState === "handed_to_max";
  const emailConfidence = toPercent(lead.contact?.emailConfidence);
  // "Show Email" is only offered on a CONFIRMED company (its own domain, a name
  // that isn't an article headline). The server refuses anything else with
  // "unresolved_company" and spends no credit — this only avoids offering an
  // action that would be refused. Undefined (an older stored row) still gets it.
  const enrichable = lead.enrichable !== false;
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
              {/* An unknown industry is an evidence gap, shown as "—" — never
                  filled in with the declared ICP label. */}
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {lead.industry || "—"}
              </span>
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

            {/* Every prospect on this page has already been through Enrich Now, so the
                control below looks redundant and is not. An enrichment that *ran* and found
                nothing still promotes the lead — `enrich_lead_now` answers `no_email` and
                the `sales_leads` row is created either way — so a prospect can legitimately
                be here with no address yet, and re-running the waterfall is the thing to do
                about it. The retry is free: the credit charge is keyed on the lead, so a
                second click on the same one is not billed. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {lead.contact?.email ? (
                <a
                  href={`mailto:${lead.contact.email}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  {lead.contact.emailVerified ? <MailCheck className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                  {lead.contact.email}
                </a>
              ) : enrichable ? (
                <button
                  onClick={revealEmail}
                  disabled={enriching}
                  title="Resolve this decision-maker's email. Counts against the monthly enrichment cap and spends one workspace credit."
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[12px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60"
                >
                  {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  {enriching ? "Finding email…" : "Enrich Now"}
                  {/* The server's price, not a literal. Absent when the balance has not
                      been read, which is honest: a control that looks free and charges is
                      worse than one with no tag. */}
                  <CreditPriceTag credits={enrichPrice} />
                </button>
              ) : (
                <span
                  title="This record has no confirmed company identity (its own domain), so contact enrichment isn't offered."
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[12px] font-medium text-zinc-400"
                >
                  <Mail className="h-3.5 w-3.5" /> Company not confirmed
                </span>
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

      {/* ── Where this prospect stands ──
          One line, always present, naming the stage and what it means. This is what makes
          the page's transformation legible: the same dossier says "Enriched — choose how to
          proceed", then "Activating intelligence", then "Waiting for signals", then
          "Action recommended", and the operator can see which of those they are looking at
          without inferring it from which panels happen to be populated.

          The `WAITING` sentence is the load-bearing one. Bright Data observation is
          asynchronous, so an activated prospect legitimately shows empty state and NBA
          panels for a while — and without this line that reads as a broken product rather
          than as a working one that has not been told anything yet. */}
      {decision.readFailed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-[11.5px] leading-relaxed text-amber-800">
            Couldn't read this prospect's GTM record, so its stage and the actions
            available on it aren't known. Eva's dossier below is unaffected.
          </p>
        </div>
      ) : (() => {
        const meta = PROSPECT_STAGE_LABELS[decision.stage];
        if (!meta) return null;
        const active = isIntelligenceActive(decision.stage);
        return (
          <div
            data-gtm-stage={decision.stage}
            className={cn(
              "rounded-2xl border px-4 py-3",
              active
                ? "border-violet-200 bg-violet-50/50"
                : "border-zinc-200/70 bg-white"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={active ? "violet" : "zinc"}>
                {decision.activating && (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                )}
                {meta.label}
              </Chip>
              <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-zinc-500">
                {meta.body}
              </p>
            </div>
            {/* What activation actually did, read off the acknowledgement rather than
                assumed. Announced politely so the transition is spoken. */}
            {decision.notice && (
              <p
                aria-live="polite"
                className="mt-1.5 text-[11.5px] leading-relaxed text-violet-800"
              >
                {decision.notice}
              </p>
            )}
          </div>
        );
      })()}

      {/* ── The decision, at the one stage it means anything ──
          Rendered only at `ENRICHED`, and never on a failed read: offering a paid choice
          about a prospect whose record could not be read would be guessing with the
          operator's credits. Before `ENRICHED` there is no confirmed identity to act on;
          after activation the choice has been made, and leaving the pair on screen would be
          offering a decision that no longer exists. */}
      {!decision.readFailed && showsDecision(decision.stage) && (
        <ProspectDecision
          onContactDirectly={decision.onContactDirectly}
          contactUnavailableReason={decision.contactUnavailableReason}
          contactPrice={decision.contactPrice}
          onActivate={decision.onActivate}
          activating={decision.activating}
          activateUnavailableReason={decision.activateUnavailableReason}
          activatePrice={decision.activatePrice}
        />
      )}

      {/* ── The primary element of an activated prospect: what to do, and why now ──
          Above the state, the signals and the timeline, deliberately. The operator's first
          question is "what should I do with this person", not "what has Weez observed" —
          the observations are the *argument* for the answer, and they sit behind the card's
          own disclosure and in the sections below it.

          Rendered only when there is a real recommendation. A prospect at `WAITING` or
          `ACTIVE` has none, and the stage banner above already says why in words; a card
          reading "no action recommended" would add a second, emptier statement of the same
          fact. */}
      {/* A ranking that could not be read. One line, not an alert: the dossier around it is
          intact and the operator's next move is to refresh, not to worry. */}
      {isIntelligenceActive(decision.stage) &&
        decision.rankingFailed &&
        !decision.recommended && (
          <p className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[11.5px] leading-relaxed text-amber-800">
            Couldn't read the next best action for this prospect, so there may be a
            recommendation we aren't showing.
          </p>
        )}

      {decision.recommended && (
        <NextBestActionCard
          action={decision.recommended}
          // `"row"` is the one kind that carries an item. The other three are absences —
          // and a tier is never defaulted from one, because `LATER` is a real band and
          // "we didn't read the queue" is not a claim that this prospect is in it.
          priorityTier={overlay.kind === "row" ? overlay.item.priorityTier : null}
          onTakeAction={decision.onTakeAction}
        />
      )}

      {/* Journey, priority and intent — the GTM state overlay for this prospect.
          Only once intelligence is active: before activation there is no belief and no
          ranking, so this panel could only ever report absences, and three "nothing
          observed" rows above the decision would bury the decision. */}
      {isIntelligenceActive(decision.stage) && (
        <JourneyPriorityIntentPanel overlay={overlay} intent={intent} />
      )}

      {/* ── Deeper intelligence ──
          The argument for the recommendation above, and nothing an operator has to read to
          act. Four sections in the order the questions arrive: where do they stand, what
          moved them, what did we read, what happened when.

          Every panel here is the existing component, unmodified. `StateDimensionGrid` reads
          no route so it renders open; the other three each own a collection and a pager, so
          they sit behind `IntelligenceSection` and are not built until asked for — the
          selection stays at three requests however many sections exist. */}
      {isIntelligenceActive(decision.stage) && intelligence.gtmLeadId && (
        <div className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
              {PROSPECT_INTELLIGENCE_SECTIONS.regionHeading}
            </p>
            <p className="min-w-0 text-[11px] text-zinc-400">
              {PROSPECT_INTELLIGENCE_SECTIONS.regionNote}
            </p>
          </div>

          {/* Current state. Rendered from the payload the page already holds, so it costs
              nothing and needs no disclosure. Absent only when the prospect read failed —
              and then the amber line above has already said so. */}
          {intelligence.state && (
            <div className="rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <StateDimensionGrid
                state={intelligence.state}
                stateFull={intelligence.stateFull}
              />
            </div>
          )}

          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.stateHistory}
            note={PROSPECT_INTELLIGENCE_SECTIONS.stateHistoryNote}
          >
            {() => (
              <StateHistoryPanel
                brandId={intelligence.brandId}
                leadId={intelligence.gtmLeadId}
                refreshKey={intelligence.refreshKey}
              />
            )}
          </IntelligenceSection>

          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.signals}
            note={PROSPECT_INTELLIGENCE_SECTIONS.signalsNote}
          >
            {() => (
              <SignalList
                brandId={intelligence.brandId}
                leadId={intelligence.gtmLeadId}
                refreshKey={intelligence.refreshKey}
              />
            )}
          </IntelligenceSection>

          <IntelligenceSection
            summary={PROSPECT_INTELLIGENCE_SECTIONS.timeline}
            note={PROSPECT_INTELLIGENCE_SECTIONS.timelineNote}
          >
            {() => (
              <ProspectTimeline
                brandId={intelligence.brandId}
                leadId={intelligence.gtmLeadId}
                refreshKey={intelligence.refreshKey}
              />
            )}
          </IntelligenceSection>
        </div>
      )}

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
          {/* Entry to the LinkedIn GTM execution surface. Eva qualifies the lead
              here; the relationship-intelligence page acts on it. Offered whether or
              not the lead is with Max, because the two are different jobs. */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
            onClick={onOpenRelationshipIntelligence}
          >
            <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
            {GTM_PAGE_LABELS.entryAction}
          </Button>
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
  // NoInfer keeps `onChange` out of inference for T. React's setState is
  // `Dispatch<SetStateAction<T>>`, so its parameter is `T | ((prev: T) => T)` —
  // as an inference candidate that union violates `T extends string` and TS
  // silently widens T to `string`. Infer T from `value`/`options` only.
  onChange: (v: NoInfer<T>) => void;
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

  /**
   * The prospect a deep link asked for, by `sales_leads.id`.
   *
   * Enrich Now is pressed on Market Intelligence and the prospect becomes workable
   * *here*, so that handoff has to be able to name which one. Without this the link
   * landed on the page and selected whatever sorted first, which made the most important
   * transition in the product feel like it had lost the prospect.
   *
   * Applied once per requested id, in an effect below, rather than used directly as the
   * selection: the operator must be able to click a different prospect afterwards
   * without the URL dragging them back. It is read as the GTM id because that is what
   * every other id on this page now is (see `gtmLeadIdOf`).
   */
  // `urlParams`, not `search`: this page already has a `search` state holding the
  // search-box text.
  const [urlParams] = useSearchParams();
  const requestedGtmLeadId = (urlParams.get("lead_id") ?? "").trim();
  const appliedDeepLinkRef = useRef<string>("");

  // The GTM state overlay. Held apart from `ws` / `loading` / `error` on purpose:
  // these are secondary reads and neither one is allowed to take the dossier down.
  const [queue, setQueue] = useState<QueueOverlay | null>(null);
  const [queueFailed, setQueueFailed] = useState(false);
  /**
   * The three GTM reads for the *selected* prospect, held together.
   *
   * One read per selection rather than per row, which is the same argument this page
   * already made for the intent summary: the dossier shows one prospect at a time, and
   * that is what makes a per-prospect read affordable here at all. Firing these per row
   * would be three requests per decision-maker on mount.
   *
   * `Promise.allSettled`, and a failure flag per read. They are three routes with three
   * failure modes: a ranking that could not be read must not take the belief down with
   * it, and neither may touch `ws` / `loading` / `error` — Eva's rows and the dossier
   * render whether or not the GTM layer answers.
   *
   *   `detail`   `getProspect` — the profile row (the activation flag), the identity
   *              verdict (the activation gate), and the asserted contact.
   *   `state`    `getProspectState` — the belief. Carries `stateVersion`, which is how
   *              "activated and nothing observed yet" is told from "intelligence
   *              working", and the eleven intent records the dossier summarises.
   *   `ranking`  `getNextBestAction` — whether there is a recommendation, and the
   *              explanation behind it.
   */
  const [selected, setSelected] = useState<SelectedProspectRead>(EMPTY_SELECTED_READ);

  const reqRef = useRef(0);
  const queueReqRef = useRef(0);
  const intentReqRef = useRef(0);

  // ── Credits ──
  //
  // Enrich Now is priced at 1 credit and charged on this page. The balance read is a third
  // *secondary* call, on the same terms as the two GTM reads above it: its failure lives in
  // its own state and never touches `ws` / `loading` / `error`. A workspace whose balance
  // could not be read still renders its prospects — it just renders no price tags, which is
  // the honest fallback.
  const {
    balance: creditBalance,
    refresh: refreshCredits,
    priceFor,
  } = useCredits();
  const enrichPrice = priceFor("ENRICH");
  const activatePrice = priceFor("ACTIVATE");
  const contactPrice = priceFor("CONTACT");
  const [paywall, setPaywall] = useState<string | null>(null);

  // ── Activate Intelligence ──
  //
  // The one write this page makes against the GTM layer. `activationAck` holds the
  // acknowledgement so the dossier can report what activation actually started — two
  // queued reads, or none — instead of claiming something nobody queued. `activating` is
  // what makes the transition visible: it drives the `ACTIVATING` stage, so the operator
  // watches the prospect change rather than receiving a toast that says "Activated".
  const [activating, setActivating] = useState(false);
  const [activationAck, setActivationAck] = useState<ProspectTracking | null>(null);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);

  /**
   * Bumped to make the three fetching intelligence panels re-read their collections.
   *
   * Bumped on activation and on a selection change, not on a timer: those are the two
   * moments the ledgers behind them can have gained a row that this page knows about.
   * Polling them would be three requests a cycle for panels that are usually closed.
   */
  const [intelligenceKey, setIntelligenceKey] = useState(0);

  const load = useCallback(
    async (force: boolean, silent = false) => {
      const my = ++reqRef.current;
      if (!silent) {
        setError(null);
        setStage("starting");
        if (force) setRefreshing(true);
        else setLoading(true);
      }
      try {
        const data = await evaAPI.getWorkspace(
          spaceId || "demo",
          force,
          (s) => !silent && my === reqRef.current && setStage(s)
        );
        if (my !== reqRef.current) return;
        setWs(data);
        if (force && !silent) toast.success("Prospect dossiers refreshed");
      } catch (e) {
        // A silent (auto) refresh must never blank the page or nag — keep the
        // current workspace and try again later.
        if (my !== reqRef.current || silent) return;
        const message = e instanceof Error ? e.message : "Couldn't load your qualified accounts";
        setError(message);
        if (force) toast.error("Couldn't refresh prospects");
        else setWs(null);
      } finally {
        if (my === reqRef.current && !silent) {
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

  /**
   * The one action-queue read this page makes, joined onto Eva's leads by lead id.
   *
   * The same monotonic-ticket idiom `load` uses, for the same reason: a slow read must
   * not land on top of a newer one. A failure sets `queueFailed` and nothing else —
   * `ws`, `loading` and `error` are untouched, so the rows and the dossier render
   * exactly as they did before whether or not the GTM layer answers.
   */
  const loadQueue = useCallback(async () => {
    const brandId = spaceId ?? "";
    if (!brandId) {
      setQueue(null);
      setQueueFailed(false);
      return;
    }
    const my = ++queueReqRef.current;
    setQueueFailed(false);
    try {
      const page = await gtmAPI.getActionQueue(brandId, {
        sort: "priority",
        limit: PROSPECT_QUEUE_PAGE_SIZE,
      });
      if (my !== queueReqRef.current) return;
      setQueue({
        byLead: new Map(page.items.map((item) => [item.leadId, item])),
        // Only a page that reached the end licenses "no live recommendation" for a
        // lead that isn't on it.
        complete: !page.hasMore,
      });
    } catch {
      if (my !== queueReqRef.current) return;
      setQueue(null);
      setQueueFailed(true);
    }
  }, [spaceId]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  /** Eva's workspace and the GTM overlay, re-read together when the operator asks. */
  const refreshAll = useCallback(() => {
    void load(true);
    void loadQueue();
  }, [load, loadQueue]);

  /**
   * Every qualified lead in the workspace, rejections aside — discovery's whole output.
   *
   * Not what this page lists. It is kept because the two counts answer different questions
   * and the empty states below need both: "discovery has found nothing yet" and "discovery
   * found accounts and none of them has been enriched" look identical if you only count one.
   */
  const qualifiedLeads = useMemo(
    () => (ws ? ws.leads.filter((l) => l.status !== "rejected") : []),
    [ws]
  );

  /**
   * The prospects this page is about: the ones Enrich Now promoted into the GTM flow.
   *
   * **This is the page's subject, not a filter on it.** Prospect Intelligence is the GTM
   * surface — the dossier, the enriched contact, Activate Intelligence, the ranked next
   * move — and every one of those keys on `sales_leads.id`. A lead that has not been
   * enriched has no such row, so listing it here would offer controls that are certain to
   * 404 and a dossier with nothing in it. Discovery's full output belongs on Revenue
   * Intelligence, which is where Enrich Now is pressed.
   *
   * `isEnrichedProspect` is `evaAPI`'s, stated once there with the reason it reads
   * `gtmLeadId` rather than the enrichment status — which the workspace sweep also sets, for
   * leads that arrive carrying an email with no enrichment at all.
   */
  const activeLeads = useMemo(
    () => qualifiedLeads.filter(isEnrichedProspect),
    [qualifiedLeads]
  );

  // Cold start: Eva publishes a fast-ready (often empty) workspace while it
  // finishes discovery in the background. Silently re-fetch a few times so
  // freshly-found accounts appear without the founder having to hit Refresh.
  const autoRefreshRef = useRef(0);
  useEffect(() => {
    if (!ws || loading || refreshing) return;
    // Keyed on `qualifiedLeads`, not on this page's enriched subset. The retry exists for
    // one thing — Eva publishes a fast-ready empty workspace while discovery finishes — and
    // a workspace full of accounts nobody has enriched is not that. Polling it five times
    // would spend five reads to re-learn something the operator has to act on.
    if (qualifiedLeads.length > 0) {
      autoRefreshRef.current = 0; // discovery landed — stop auto-refreshing
      return;
    }
    if (autoRefreshRef.current >= 5) return; // cap: ~5 tries (~2.5 min)
    const t = setTimeout(() => {
      autoRefreshRef.current += 1;
      load(false, true); // silent re-read (no new scan, no loader/toast)
    }, 30000);
    return () => clearTimeout(t);
  }, [ws, loading, refreshing, qualifiedLeads.length, load]);

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

  /**
   * Honour `?lead_id=` once, then get out of the way.
   *
   * Enrich Now happens on Market Intelligence and the prospect becomes workable here, so
   * that handoff names the prospect it just created. This selects it.
   *
   * **Once**, keyed on the requested id in a ref. The selection is ordinary local state
   * afterwards, so an operator who clicks a different prospect stays there instead of
   * being dragged back by a URL that has not changed. Re-running on every render would
   * make the rest of the list unclickable.
   *
   * It does nothing while the workspace is still loading, and nothing if the requested
   * prospect is not in the current view — a filter can hide it, and silently widening the
   * operator's filters to reveal one row would be a surprising thing for a link to do.
   * The ref is only stamped once the prospect is actually found, so a link that arrives
   * before the workspace does still applies when it lands.
   */
  useEffect(() => {
    if (!requestedGtmLeadId) return;
    if (appliedDeepLinkRef.current === requestedGtmLeadId) return;
    if (companies.length === 0) return;
    const group = companies.find((c) =>
      c.leads.some((l) => gtmLeadIdOf(l) === requestedGtmLeadId)
    );
    const lead = group?.leads.find((l) => gtmLeadIdOf(l) === requestedGtmLeadId);
    if (!group || !lead) return;
    appliedDeepLinkRef.current = requestedGtmLeadId;
    setCompanyKey(group.key);
    // Eva's document id: `leadId` is this page's *local* selection key and is compared
    // against `lead.id` throughout. Only the GTM-bound calls translate through
    // `gtmLeadIdOf`.
    setLeadId(lead.id);
  }, [companies, requestedGtmLeadId]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.key === companyKey) || companies[0] || null,
    [companies, companyKey]
  );

  const prospects = useMemo(() => selectedCompany?.leads || [], [selectedCompany]);

  const selectedLead = useMemo(
    () => prospects.find((p) => p.id === leadId) || prospects[0] || null,
    [prospects, leadId]
  );

  // The GTM id, not Eva's. See `gtmLeadIdOf`.
  const selectedGtmLeadId = selectedLead ? gtmLeadIdOf(selectedLead) : "";

  /**
   * The intent records for the *selected* lead, and only for it.
   *
   * The eleven Intent rows live on `ProspectStateFull` and on no list payload, so this
   * is the one read that has to be keyed on a prospect. Keyed on the *selected* one
   * rather than fired per row: the dossier shows one prospect at a time, so the cost is
   * one request per selection instead of one per decision-maker on mount.
   *
   * Same ticket idiom, same isolation — a failure lands in `intent.failed` and the
   * dossier renders around it.
   */
  const loadSelected = useCallback(
    async (silent = false) => {
      const brandId = spaceId ?? "";
      if (!brandId || !selectedGtmLeadId) {
        setSelected(EMPTY_SELECTED_READ);
        return;
      }
      const my = ++intentReqRef.current;
      // A silent re-read keeps whatever is held on screen. Blanking it would make the
      // dossier flicker back to "nothing observed" every time a write refreshed it.
      if (!silent) setSelected({ ...EMPTY_SELECTED_READ, loading: true });
      const [detail, state, ranking] = await Promise.allSettled([
        gtmAPI.getProspect(brandId, selectedGtmLeadId),
        gtmAPI.getProspectState(brandId, selectedGtmLeadId),
        gtmAPI.getNextBestAction(brandId, selectedGtmLeadId),
      ]);
      if (my !== intentReqRef.current) return;
      setSelected({
        loading: false,
        detail: detail.status === "fulfilled" ? detail.value : null,
        detailFailed: detail.status === "rejected",
        state: state.status === "fulfilled" ? state.value : null,
        stateFailed: state.status === "rejected",
        ranking: ranking.status === "fulfilled" ? ranking.value : null,
        rankingFailed: ranking.status === "rejected",
      });
    },
    [spaceId, selectedGtmLeadId]
  );

  useEffect(() => {
    void loadSelected();
  }, [loadSelected]);

  /**
   * A different prospect is a different decision: nothing from the last one may survive.
   *
   * An activation acknowledgement or notice left behind would be a claim about one person
   * rendered beside another person's name, which is the one mistake this surface must not
   * make.
   */
  useEffect(() => {
    setActivationAck(null);
    setActivationNotice(null);
    setPaywall(null);
    // A different prospect is a different ledger. The panels are keyed on this, so
    // bumping it is what stops an open section from showing the previous person's
    // signals while its own request is in flight.
    setIntelligenceKey((key) => key + 1);
  }, [selectedGtmLeadId]);

  /**
   * Enter the Contact Directly path.
   *
   * A distinct execution path, not part of the intelligence dashboard: pick a channel,
   * draft, review, copy, open. It lives on the per-prospect execution surface, which is
   * where the composer and the open-channel control already are — this is the entry to it
   * rather than a second copy of it.
   */
  const onContactDirectly = useCallback(() => {
    if (!selectedGtmLeadId) return;
    navigate(
      `/relationship-intelligence/${spaceId ?? ""}?lead_id=${encodeURIComponent(
        selectedGtmLeadId
      )}&intent=contact`
    );
  }, [navigate, spaceId, selectedGtmLeadId]);

  /**
   * Perform the recommended action.
   *
   * The same destination as Contact Directly, and that is not an accident: executing a
   * recommendation and reaching out on your own judgement are the same mechanical act —
   * draft, review, open the channel, copy — and the surface that owns the composer and the
   * open-channel control is the one place it should live. What differs is how the operator
   * arrived, which is why the two carry different `intent` values rather than being one
   * handler.
   */
  const onTakeAction = useCallback(() => {
    if (!selectedGtmLeadId) return;
    navigate(
      `/relationship-intelligence/${spaceId ?? ""}?lead_id=${encodeURIComponent(
        selectedGtmLeadId
      )}&intent=act`
    );
  }, [navigate, spaceId, selectedGtmLeadId]);

  /**
   * The intent slice, in the shape the dossier already takes.
   *
   * Derived rather than held separately so there is one read and one source of truth. The
   * dossier's own signature is untouched: the intent summary was always a projection of
   * the belief, and now the belief is fetched beside two other things.
   */
  const intent: IntentReadState = useMemo(
    () => ({
      loading: selected.loading,
      failed: selected.stateFailed,
      state: selected.state,
    }),
    [selected.loading, selected.stateFailed, selected.state]
  );

  /**
   * Where this prospect stands, and therefore what the dossier renders.
   *
   * Every input is a persisted field or an in-flight write of this page's — see
   * `prospectStageOf` for which field each stage is read from. `busy` is what makes the
   * transition legible: activation is a state change, and the operator watches it happen
   * rather than being handed a toast.
   */
  // `prospectStage`, not `stage`: this page already has a `stage` holding Eva's scan
  // progress, which is a fact about a sweep and not about a prospect.
  const prospectStage = useMemo(
    () =>
      prospectStageOf({
        verificationStatus: selected.detail?.profile.linkedinVerificationStatus ?? null,
        profileId:
          activationAck?.profileId ?? selected.detail?.profile.profileId ?? null,
        stateVersion: selected.state?.stateVersion ?? null,
        hasRecommendation: (selected.ranking?.recommended ?? null) !== null,
        busy: activating ? "activating" : null,
      }),
    [selected.detail, selected.state, selected.ranking, activationAck, activating]
  );

  /**
   * Activate Intelligence for the selected prospect.
   *
   * **The `recommendChannel` call afterwards is deliberate and cannot move to the server.**
   * The track route provisions the rows and sets `nba_recompute_requested_at`, and that
   * mark is all it sets — it computes no score and writes no recommendation. Only
   * `recommend-channel` may score, which the backend's own
   * `test_only_the_re_evaluation_route_scores` pins. So without this second call the
   * prospect is activated but invisible to the ranked queue until a worker happens to pick
   * them up. `GTMProspect` has always done exactly this, and the sequence is asserted by
   * `GTMProspect.identity.test.tsx`.
   *
   * A 402 is not a failure and is kept out of the page's error slot: the backend charges
   * before it acts, so nothing was provisioned and nothing was billed. Saying "activation
   * failed" would leave the operator wondering what state their prospect is in.
   */
  const onActivateIntelligence = useCallback(async () => {
    const brandId = spaceId ?? "";
    if (!brandId || !selectedGtmLeadId) return;
    setActivating(true);
    setActivationNotice(null);
    setPaywall(null);
    try {
      const ack = await gtmAPI.trackProspect(brandId, selectedGtmLeadId);
      setActivationAck(ack);
      setActivationNotice(
        ack.createdProfile
          ? GTM_IDENTITY_LABELS.tracked
          : GTM_IDENTITY_LABELS.alreadyTracking
      );
      // Only when something actually moved: a repeat activation comes back
      // `charged: false` and a needless read makes the badge flicker for nothing.
      if (ack.credit?.charged) void refreshCredits();
      // Score, so the prospect can reach the Action Queue. See the docblock.
      try {
        await gtmAPI.recommendChannel(brandId, selectedGtmLeadId);
      } catch {
        // The prospect is activated either way. A ranking that could not be computed
        // yet is what the WAITING stage already says, so this is not worth an error.
      }
      // Re-read silently: the notice above is the message that matters, and the stage
      // should move on the strength of the rows rather than on this page's optimism.
      await loadSelected(true);
      void loadQueue();
      // Activation wrote a genesis signal and opened the belief rows, so any open
      // intelligence section is now describing a prospect one row out of date.
      setIntelligenceKey((key) => key + 1);
    } catch (e) {
      if (isInsufficientCredits(e)) {
        setPaywall(e instanceof Error ? e.message : null);
        void refreshCredits();
      } else {
        setActivationNotice(
          e instanceof Error ? e.message : GTM_IDENTITY_LABELS.trackFailed
        );
        toast.error(GTM_IDENTITY_LABELS.trackFailed);
      }
    } finally {
      setActivating(false);
    }
  }, [spaceId, selectedGtmLeadId, refreshCredits, loadSelected, loadQueue]);

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

  // On-demand enrichment ("Enrich Now"): resolve the email only when the founder asks,
  // because it spends both a provider credit and one of the workspace's own.
  //
  // **Two different limits, and they are reported differently on purpose.** `usage` is the
  // per-brand monthly cap on enrichment *attempts* and the remedy is to wait for the month
  // to roll over; the credit balance is a purchased thing and the remedy is to top up.
  // Telling an operator to wait when they should top up — or the reverse — is the failure
  // this separation exists to prevent.
  const onShowEmail = async (lead: QualifiedLead) => {
    try {
      const res = await evaAPI.enrichLead(spaceId, lead.id);
      if (res.status === "limit_reached") {
        toast.error(
          `Monthly enrichment limit reached (${res.usage?.limit ?? 100}). It resets next month.`
        );
        return;
      }
      if (res.status === "unresolved_company") {
        // Refused before any provider was touched, so no credit was spent. The backend
        // charges first and reverses the charge on this path, so the balance is unchanged
        // rather than merely never debited — but either way there is nothing to re-read.
        toast.info(res.reason || `${lead.company} isn't a confirmed company — no credit spent.`);
        return;
      }
      // A charge landed, so the badge is stale. Only when something was actually charged:
      // a repeat click on the same lead comes back `charged: false`, and an email that was
      // already on file comes back with no `credit` at all.
      if (res.credit?.charged) void refreshCredits();
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
      if (isInsufficientCredits(e)) {
        // No provider was called and nothing was charged. Said as its own thing rather than
        // as an error, because the operator's next step is to top up and not to retry.
        setPaywall(e instanceof Error ? e.message : null);
        void refreshCredits();
        return;
      }
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
              <span className="text-sm font-semibold text-zinc-900">Enriched decision-makers &amp; dossiers</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden gap-1 border-violet-200 bg-violet-50 text-[9px] font-bold uppercase tracking-wider text-violet-700 sm:flex"
            >
              <SignalIcon className="h-3 w-3" /> Eva → Max
            </Badge>
            {/* The balance, in chrome. Enrich Now is on every dossier on this page, so the
                operator can see what they have before they spend it. */}
            <CreditBalanceBadge balance={creditBalance} className="hidden sm:inline-flex" />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={refreshAll}
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
                  onClick={refreshAll}
                  className="mt-1 h-9 gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            ) : ws ? (
              <>
                {/* The paywall (402). Its own surface, not the error state above: nothing
                    broke, no provider was called and nothing was charged. */}
                {paywall !== null && (
                  <InsufficientCreditsAlert detail={paywall} balance={creditBalance} />
                )}
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
                      onClick={refreshAll}
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

                <SummaryHeader
                  ws={ws}
                  companies={companies}
                  prospects={activeLeads}
                  qualifiedTotal={qualifiedLeads.length}
                />

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

                {/* Two different empty states, because they call for two different things.
                    Collapsing them into "Eva is discovering your accounts" would tell an
                    operator with forty qualified accounts to wait for discovery — when what
                    they actually need to do is go and enrich one. */}
                {qualifiedLeads.length === 0 ? (
                  <EmptyPanel
                    icon={Target}
                    title="Eva is discovering your accounts"
                    subtitle="Eva is scanning channels for companies that match your ICP and hitting your trigger events. Good-fit accounts appear on Market Intelligence as she finds them — this can take a few minutes on a fresh campaign."
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
                      onClick={refreshAll}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh now
                    </Button>
                  </EmptyPanel>
                ) : activeLeads.length === 0 ? (
                  <EmptyPanel
                    icon={Mail}
                    title="No prospects enriched yet"
                    subtitle={`Eva has qualified ${qualifiedLeads.length} account${
                      qualifiedLeads.length === 1 ? "" : "s"
                    }. This page is the enriched ones — decision-maker resolved, email and LinkedIn on file, and the GTM lifecycle available. Click Enrich Now on Market Intelligence and the prospect appears here.`}
                  >
                    <Button
                      size="sm"
                      className="mt-1 h-8 gap-1.5 rounded-full text-xs"
                      onClick={() => navigate(`/eva/${spaceId ?? ""}`)}
                    >
                      <SignalIcon className="h-3.5 w-3.5" /> Go to Market Intelligence
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
                              overlay={overlayFor(gtmLeadIdOf(p), queue, queueFailed)}
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
                          overlay={overlayFor(gtmLeadIdOf(selectedLead), queue, queueFailed)}
                          intent={intent}
                          onAction={onLeadAction}
                          onShowEmail={onShowEmail}
                          enrichPrice={enrichPrice}
                          decision={{
                            stage: prospectStage,
                            onContactDirectly: onContactDirectly,
                            // ── THE ONE ISOLATED CONDITION ──
                            //
                            // Contact Directly is a distinct execution path and the product
                            // intends it to be available on an *enriched* prospect, without
                            // paying for intelligence first. The backend does not support
                            // that yet: `request_prospect_action` requires a
                            // `li_gtm_profiles` row (`_require_profile`) and
                            // `generate_message` requires that plus an observed conversation
                            // (`_require_conversation`) — and only the activation route
                            // creates the profile row. So both 404 on an enriched-but-not-
                            // activated prospect, and rendering the control would be
                            // offering something certain to fail.
                            //
                            // This expression is the whole of that gate, deliberately. When
                            // the backend provisions the record on the contact path, this
                            // becomes `null` and the path goes live — no redesign, no other
                            // file touched.
                            contactUnavailableReason: isIntelligenceActive(prospectStage)
                              ? null
                              : CONTACT_DIRECTLY_LABELS.needsActivation,
                            contactPrice,
                            onActivate: () => void onActivateIntelligence(),
                            activating,
                            // The identity gate, from the same rule the route applies, so a
                            // control that would be refused is never on screen and the
                            // reason appears in its place.
                            activateUnavailableReason: trackRefusal(
                              selected.detail?.profile.linkedinVerificationStatus ?? null,
                              selected.detail?.profile.profileUrl ?? null
                            ),
                            activatePrice,
                            notice: activationNotice,
                            // Only the prospect read gates the stage. A ranking or belief
                            // that could not be read is a *narrower* absence the stage
                            // machine already handles honestly — it lands on WAITING, which
                            // claims less rather than more.
                            readFailed: selected.detailFailed,
                            recommended: selected.ranking?.recommended ?? null,
                            onTakeAction: onTakeAction,
                            rankingFailed: selected.rankingFailed,
                          }}
                          intelligence={{
                            brandId: spaceId ?? "",
                            gtmLeadId: gtmLeadIdOf(selectedLead),
                            state: selected.detail?.state ?? null,
                            stateFull: selected.state,
                            refreshKey: intelligenceKey,
                          }}
                          onOpenMax={() => navigate(`/sales/${spaceId}`)}
                          onOpenRelationshipIntelligence={() =>
                            navigate(
                              // `gtmLeadIdOf`, never `selectedLead.id`: the destination
                              // page uses this value as its `lead_id` on every GTM
                              // request, and Eva's document id 404s all of them.
                              `/relationship-intelligence/${spaceId}?lead_id=${encodeURIComponent(
                                gtmLeadIdOf(selectedLead)
                              )}`
                            )
                          }
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
