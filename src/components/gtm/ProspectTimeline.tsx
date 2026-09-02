// components/gtm/ProspectTimeline.tsx
//
// The prospect's append-only record, rendered (R18.6, R17.4, R17.6).
//
// Four rules govern this component, and each one is a rule about *not* doing
// something the browser would find convenient.
//
// **The server owns the order.** `li_gtm_state_events` is keyset-paged on
// `(event_at, id)` and the ledger's canonical order is ascending — that is the
// order R17.4 states and the order a replay wants. This component holds the
// entries it has fetched in exactly that order and reverses the array once, at
// render, because the screen reads newest-first. Nothing is sorted here: there is
// no comparator, no `Date` arithmetic on a sort key, and no client-side notion of
// which of two entries came first. A millisecond timestamp is not unique in this
// table, which is precisely why re-deriving the order in the browser would be a
// bug rather than a shortcut.
//
// **Paging walks backwards in time.** The first page is the newest activity
// (`newestFirst: true` — the same keyset walk with both comparisons flipped, not a
// different query), and each further page is strictly earlier. `Load earlier
// activity` says so. Each arriving page is turned back into canonical ascending
// order and prepended, so the accumulated array stays the server's order and the
// entries already on screen never move.
//
// **No message body reaches the DOM.** The API omits body content from timeline
// entries by construction — `TimelineEntryOut` does not project the row's `detail`
// JSON at all — and this component renders only the server's `summary`, the event
// timestamp, the dimension transition, and the evidence *surface* and observation
// time. It deliberately does not render `evidenceObservedValue`: an observed value
// is a marker, not a body, but rendering it would put a server-supplied excerpt on
// the screen and R17.6's guarantee is worth more than the detail.
//
// **One sequence, three ledgers.** `TimelineEntry` is the shape `li_gtm_state_events`,
// `gtm_signal_outcomes` and `gtm_action_lifecycle_events` all travel in, so a Signal
// arriving, the belief it moved, the recommendation that followed, the click, the
// confirmation and the outcome are entries in one chronological list rather than
// three lists a reader has to interleave by eye (R28.4). This component learns that
// vocabulary in `EVENT_ICON` and nowhere else: it does not branch on which table an
// entry came from, and an event type it has never heard of still renders honestly.
//
// **A refusal is part of the record.** Rejected, stale, and duplicate transitions
// render muted with their reason as real text (the outcome class from
// `EVENT_OUTCOME_LABEL`, plus the server's summary, which names the attempted value
// and — for a stale rejection — both timestamps). "A late observation arrived and
// was declined" is information the operator wants, and a tooltip would hide it.
//
// Structure: one `<ol>` of `<li>` entries, rendered by this component so the list
// semantics are always well-formed wherever it is mounted. A page composing it
// mounts it directly and does not wrap it in a second `<ol>`; `ProspectTimelineEntry`
// is exported for a caller that owns its own list element.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock,
  Compass,
  Contact,
  Crosshair,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Gauge,
  Hash,
  Hourglass,
  Inbox,
  Layers,
  Lightbulb,
  ListOrdered,
  Loader2,
  MessageSquare,
  MousePointerClick,
  Pencil,
  Radar,
  Reply,
  RefreshCw,
  Route,
  Scale,
  Signal,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import gtmAPI, { type TimelineEntry } from "@/services/gtmAPI";
import { UNKNOWN_TEXT } from "./ObservedValue";
import {
  DIMENSION_LABEL,
  EVENT_OUTCOME_LABEL,
  EVENT_OUTCOME_TONE,
  GTM_LIFECYCLE_LABELS,
  MUTED_OUTCOMES,
  STATE_LABEL,
  SURFACE_LABEL,
  TIMELINE_LABELS,
  TONE,
  absTime,
  relTime,
} from "./labels";

/** The default page size — the server's own default for this ledger. */
export const TIMELINE_PAGE_SIZE = 25;

// ─── Icons, keyed by event type ───────────────────────────────────────────────
//
// Decoration: every icon is `aria-hidden` and the meaning lives in the summary
// text beside it. An event type with no entry here falls back to a neutral dot
// rather than borrowing another type's icon, so a new event type shipped by the
// backend renders honestly without a frontend release.

type TimelineIcon = typeof CircleDot;

const EVENT_ICON: Record<string, TimelineIcon> = {
  CHANNEL_RECOMMENDATION_COMPUTED: Target,
  CTA_READINESS_COMPUTED: Target,

  ACTIVITY_INTELLIGENCE_COMPUTED: TrendingUp,
  ACTIVITY_LEVEL_CHANGED: TrendingUp,

  RELATIONSHIP_STATE_CHANGED: UserPlus,
  CONNECT_ACTION_REQUESTED: UserPlus,

  CONVERSATION_STATE_CHANGED: MessageSquare,
  SEND_ACTION_REQUESTED: MessageSquare,
  CONVERSATION_STATE_CORRECTED: RefreshCw,

  EXECUTION_STATE_CHANGED: Zap,
  LINKEDIN_PROFILE_OPENED: ExternalLink,
  LINKEDIN_CHAT_OPENED: ExternalLink,
  PREPARED_ACTION_DELIVERED: ClipboardCheck,

  MESSAGE_VERSION_CREATED: FileText,
  MESSAGE_EDITED: Pencil,
  MESSAGE_GENERATION_FAILED: AlertTriangle,
  MESSAGE_SEND_CONFIRMED: CheckCircle2,

  REPLY_OBSERVED: Reply,
  REPLY_CLASSIFIED: Sparkles,
  REFERRAL_RECORDED: Users,

  OBSERVATION_ENQUEUED: Eye,
  OBSERVATION_DEFERRED: Clock,
  OBSERVATION_FAILED: EyeOff,
  PARSER_NO_MATCH: EyeOff,

  OUTCOME_RECORDED: Flag,
  WEIGHT_SET_APPLIED: Scale,

  CONVERSATION_STATE_MEETING_REQUESTED: Calendar,
  CONVERSATION_STATE_MEETING_BOOKED: Calendar,

  // ── The state engine's own two broadcasts ──────────────────────────────────
  //
  // `PROSPECT_STATE_CHANGED` is the whole belief moving, which is why it does not
  // borrow a dimension's icon: the per-dimension rows are the entries above it in
  // the same sequence. `NBA_RANKING_COMPUTED` is the *following* recommendation
  // R28.4 asks for — a ranking, hence a list.
  PROSPECT_STATE_CHANGED: Route,
  NBA_RANKING_COMPUTED: ListOrdered,

  // ── The four extended dimensions ───────────────────────────────────────────
  BUYING_STAGE_CHANGED: Wallet,
  ENGAGEMENT_TREND_CHANGED: Activity,
  ACTIVITY_TREND_FLAG_CHANGED: TrendingUp,
  CHANNEL_AVAILABILITY_CHANGED: Signal,

  // ── The nine measure groups ────────────────────────────────────────────────
  IDENTITY_MEASURES_CHANGED: Contact,
  ICP_MEASURES_CHANGED: Crosshair,
  ENGAGEMENT_COUNTS_CHANGED: Hash,
  BUYING_MEASURES_CHANGED: Wallet,
  TIMING_MEASURES_CHANGED: CalendarClock,
  STATE_CONFIDENCE_CHANGED: Gauge,
  INTENT_MEASURES_CHANGED: Compass,
  CHANNEL_SCORES_CHANGED: BarChart3,
  CHANNEL_COUNTS_CHANGED: Hash,

  // ── The signal-reconciliation ledger, keyed by its stage ───────────────────
  //
  // `gtm_signal_outcomes.stage` travels as the event type, so a Signal arriving
  // (`INGEST`) and the same fact being folded into the belief (`APPLY`) are two
  // entries in the one sequence rather than one entry that means both.
  INGEST: Inbox,
  APPLY: Layers,

  // ── The eleven lifecycle positions ─────────────────────────────────────────
  //
  // A lifecycle ledger row carries its `position` as the event type. `CLICKED` and
  // `STARTED` are the sensitive pair and their icons say only what happened: a
  // pointer was clicked, and a tab was opened. Neither is a paper plane, and
  // nothing here depicts a send — Weez does not send (R27.3).
  //
  // `EXECUTED` is `UserCheck` because it is the *operator's* claim, the way
  // `SURFACE_LABEL.HUMAN_CONFIRMATION` reads it; only `CONFIRMED` gets the settled
  // tick, because only `CONFIRMED` needed an observation to reach.
  RECOMMENDED: Lightbulb,
  VIEWED: Eye,
  CLICKED: MousePointerClick,
  STARTED: ExternalLink,
  EXECUTED: UserCheck,
  CONFIRMED: CheckCircle2,
  FAILED: AlertTriangle,
  CANCELLED: XCircle,
  EXPIRED: Hourglass,
  SYSTEM_OBSERVED: Radar,
  OUTCOME_RECEIVED: Flag,
};

/**
 * The event types that read as a footnote whatever outcome they carry.
 *
 * `MUTED_OUTCOMES` in `labels.ts` is keyed by the reconciler's *outcome* — the four
 * entries there are what a declined or duplicate transition looks like, and their
 * meaning is unchanged. Two of the lifecycle positions are muted for a different
 * reason: they carry `RECORDED`, because nothing was reconciled, and yet neither is
 * ordinary activity. `CANCELLED` is a recommendation the operator dismissed and
 * `EXPIRED` is one that lapsed untouched — both retire a suggestion without
 * anything having happened to the prospect, which is a footnote in the record and
 * not an error to act on (R18.6).
 *
 * Kept here rather than added to the outcome table because an event type is not an
 * outcome: folding the two vocabularies into one list would make `CANCELLED` look
 * like something the reconciler decided.
 */
const MUTED_EVENT_TYPES: readonly string[] = ["CANCELLED", "EXPIRED"];

/** Muted covers both halves: a declined outcome, or a retiring event type. */
function isMutedEntry(entry: TimelineEntry): boolean {
  return MUTED_OUTCOMES.includes(entry.outcome) || MUTED_EVENT_TYPES.includes(entry.eventType);
}

/** A refusal reads as a refusal whatever it was refusing. */
function iconFor(entry: TimelineEntry): TimelineIcon {
  if (MUTED_OUTCOMES.includes(entry.outcome) && entry.outcome !== "DUPLICATE") return Ban;
  return EVENT_ICON[entry.eventType] ?? CircleDot;
}

/** Dictionary lookup, never a guess: an unmapped value renders raw. */
function valueLabel(value: string | null): string {
  if (!value) return UNKNOWN_TEXT;
  return STATE_LABEL[value] ?? value;
}

// ─── One entry ────────────────────────────────────────────────────────────────

export interface ProspectTimelineEntryProps {
  entry: TimelineEntry;
  className?: string;
}

/**
 * One `<li>`: icon, timestamp, the server's summary, the transition it recorded,
 * and the evidence that justified it.
 *
 * The timestamp is a `<time dateTime>` carrying the machine-readable instant, the
 * absolute value in `title`, and the relative value as its text, so the entry is
 * legible at a glance and precise on inspection.
 */
export function ProspectTimelineEntry({ entry, className }: ProspectTimelineEntryProps) {
  const Icon = iconFor(entry);
  const isMuted = isMutedEntry(entry);
  const outcomeLabel = EVENT_OUTCOME_LABEL[entry.outcome];
  const outcomeTone = TONE[EVENT_OUTCOME_TONE[entry.outcome] ?? "zinc"] ?? TONE.zinc;

  /**
   * The lifecycle position in words, where the entry is one (R27.3, R18.9).
   *
   * A lifecycle row's `summary` is composed server-side from the row's own enum
   * values, so this chip is the only human text beside the icon — which is what
   * makes the icon decoration rather than the carrier. `undefined` for every other
   * event type, so nothing is rendered there and no event type is given a label it
   * does not have.
   */
  const lifecycleLabel = GTM_LIFECYCLE_LABELS[entry.eventType];

  // A non-transition entry ("RECORDED") has no dimension and no values, and shows
  // neither rather than a `null -> null` row.
  const hasTransition = Boolean(entry.dimension);
  const hasEvidence = Boolean(entry.evidenceSourceSurface || entry.evidenceObservedAt);

  return (
    <li
      className={cn("flex gap-3 py-3", className)}
      data-outcome={entry.outcome}
      data-event-type={entry.eventType}
    >
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          isMuted ? "border-zinc-200 bg-zinc-50 text-slate-500" : "border-zinc-200 bg-white text-zinc-700",
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {entry.eventAt && (
            <time
              dateTime={entry.eventAt}
              title={absTime(entry.eventAt)}
              className="text-[11px] font-medium text-slate-500"
            >
              {relTime(entry.eventAt)}
            </time>
          )}

          {/* Where the action stands, as text. Zinc for every position: the tone is
              decoration and the label carries the meaning, so a dismissed
              recommendation and a confirmed one are told apart by their words
              rather than by their colour (R18.9). */}
          {lifecycleLabel && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                TONE.zinc,
              )}
            >
              {lifecycleLabel}
            </span>
          )}

          {/* The reason a refusal was refused, as text (R18.6). Rendered for every
              outcome that is not a plain application, so `CORRECTED` explains
              itself too. */}
          {outcomeLabel && entry.outcome !== "APPLIED" && entry.outcome !== "RECORDED" && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                outcomeTone,
              )}
            >
              {outcomeLabel}
            </span>
          )}
        </div>

        {/* The server's summary, verbatim. It names the attempted value and, for a
            stale rejection, both timestamps. */}
        <p className={cn("mt-0.5 text-[13px] leading-relaxed", isMuted ? "text-slate-500" : "text-zinc-800")}>
          {entry.summary}
        </p>

        {hasTransition && (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {DIMENSION_LABEL[entry.dimension as string] ?? entry.dimension}
            {": "}
            {valueLabel(entry.priorValue)}
            <span aria-hidden="true"> → </span>
            <span className="sr-only"> changed to </span>
            {valueLabel(entry.newValue)}
          </p>
        )}

        {/* Provenance (R14.3): where the fact was seen and when. The observed value
            itself is deliberately not rendered (R17.6). */}
        {hasEvidence && (
          <p className="mt-0.5 text-[11px] text-slate-500">
            <span className="sr-only">{TIMELINE_LABELS.EVIDENCE_PREFIX}</span>
            {entry.evidenceSourceSurface
              ? SURFACE_LABEL[entry.evidenceSourceSurface] ?? entry.evidenceSourceSurface
              : UNKNOWN_TEXT}
            {entry.evidenceObservedAt && (
              <>
                {" · "}
                {TIMELINE_LABELS.OBSERVED_PREFIX}
                <time dateTime={entry.evidenceObservedAt} title={absTime(entry.evidenceObservedAt)}>
                  {relTime(entry.evidenceObservedAt)}
                </time>
              </>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

// ─── The list ─────────────────────────────────────────────────────────────────

export interface ProspectTimelineProps {
  /** The brand that owns the prospect. Every GTM route is brand-scoped. */
  brandId: string;
  leadId: string;
  /** Entries per page. Defaults to the ledger's own page size. */
  pageSize?: number;
  /**
   * Change to refetch from the newest entry — what the page does when a GTM
   * WebSocket event arrives or a silent refresh comes round.
   */
  refreshKey?: number | string;
  className?: string;
}

/**
 * The prospect timeline, newest first, paged backwards through the ledger.
 *
 * Fetches its own data and owns its own failure: a timeline that cannot load
 * renders an inline error with a retry rather than taking the page down, because
 * the next action must stay reachable when the history does not (R18.8).
 */
export function ProspectTimeline({
  brandId,
  leadId,
  pageSize = TIMELINE_PAGE_SIZE,
  refreshKey,
  className,
}: ProspectTimelineProps) {
  /**
   * The entries held so far, in the server's canonical ascending order.
   *
   * Reversed once at render and never sorted. Appending an earlier page prepends
   * to this array, so an entry already on screen keeps its position.
   */
  const [ascending, setAscending] = useState<TimelineEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [earlierError, setEarlierError] = useState<string | null>(null);

  // The monotonic request counter from `ProspectIntelligence.tsx`: a response from
  // a superseded request is dropped rather than allowed to overwrite a newer one.
  const reqRef = useRef(0);

  const loadNewest = useCallback(async () => {
    const req = ++reqRef.current;
    setLoading(true);
    setError(null);
    setEarlierError(null);
    try {
      const page = await gtmAPI.getTimeline(brandId, leadId, {
        limit: pageSize,
        newestFirst: true,
      });
      if (req !== reqRef.current) return;
      // The page arrived newest-first; reversing restores the ledger's ascending
      // order, which is the order this component keeps.
      setAscending([...page.entries].reverse());
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      if (req !== reqRef.current) return;
      setError(err instanceof Error ? err.message : "Couldn't load the activity timeline");
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, [brandId, leadId, pageSize]);

  useEffect(() => {
    void loadNewest();
  }, [loadNewest, refreshKey]);

  const loadEarlier = useCallback(async () => {
    if (!cursor) return;
    const req = reqRef.current;
    setLoadingEarlier(true);
    setEarlierError(null);
    try {
      const page = await gtmAPI.getTimeline(brandId, leadId, {
        limit: pageSize,
        cursor,
        newestFirst: true,
      });
      if (req !== reqRef.current) return;
      const earlierAscending = [...page.entries].reverse();
      setAscending((held) => {
        const seen = new Set(held.map((entry) => entry.eventId));
        // Every entry in this page is earlier than everything already held, so it
        // goes in front. An id already on screen is skipped rather than shown
        // twice — a keyset walk should not overlap, and if it ever does the
        // operator must not see the same event as two events.
        return [...earlierAscending.filter((entry) => !seen.has(entry.eventId)), ...held];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      if (req !== reqRef.current) return;
      setEarlierError(err instanceof Error ? err.message : "Couldn't load earlier activity");
    } finally {
      if (req === reqRef.current) setLoadingEarlier(false);
    }
  }, [brandId, cursor, leadId, pageSize]);

  /** Display order: the reverse of the server's order, computed nowhere else. */
  const display = useMemo(() => [...ascending].reverse(), [ascending]);

  if (loading && ascending.length === 0) {
    return (
      <div className={cn("min-w-0", className)} aria-busy="true">
        <span className="sr-only">{TIMELINE_LABELS.LOADING}</span>
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex gap-3 py-3">
            <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && ascending.length === 0) {
    return (
      <div className={cn("min-w-0", className)}>
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span className="text-[13px]">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void loadNewest()}>
              {TIMELINE_LABELS.RETRY}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      {display.length === 0 ? (
        <p className="py-3 text-[13px] text-slate-500">{TIMELINE_LABELS.EMPTY}</p>
      ) : (
        <ol className="divide-y divide-zinc-100" aria-label={TIMELINE_LABELS.LIST}>
          {display.map((entry) => (
            <ProspectTimelineEntry key={entry.eventId} entry={entry} />
          ))}
        </ol>
      )}

      {earlierError && (
        <Alert variant="destructive" role="alert" className="mt-3">
          <AlertDescription className="text-[13px]">{earlierError}</AlertDescription>
        </Alert>
      )}

      {/* Both conditions, not just `hasMore`: the cursor is what the next walk is
          made of, so without one there is nothing to load and a control that did
          nothing would be worse than no control. */}
      {hasMore && cursor && (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => void loadEarlier()} disabled={loadingEarlier}>
            {loadingEarlier && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {TIMELINE_LABELS.LOAD_EARLIER}
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {loadingEarlier ? TIMELINE_LABELS.LOADING_EARLIER : ""}
          </span>
        </div>
      )}
    </div>
  );
}

export default ProspectTimeline;
