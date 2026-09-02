// pages/GTMProspect.tsx
//
// The GTM prospect screen: one page that says what was observed about a LinkedIn
// prospect, what the engines made of it, and what to do next (R18.4, R18.7, R18.8).
//
// This file is composition and wiring. Every panel below already exists, owns its
// own semantics, and was tested on its own; the page's job is to fetch one payload,
// hand each panel the slice it reads, and keep the whole thing honest while data is
// in flight. It computes nothing: no score, no level, no state, no band. The only
// transforms in this file are a dictionary lookup and an array reversal, and both
// happen inside the components it mounts.
//
// Where the ids come from
// -----------------------
// `:spaceId` *is* the brand id — the same identity `evaAPI` sends as `brand_id`,
// which is why the route matches the other space-scoped routes rather than
// introducing a second notion of workspace. The prospect is the `lead_id` query
// parameter, put there by the entry action in `pages/ProspectIntelligence.tsx`:
// Eva qualifies the lead, this page executes against it. Arriving without one is
// not an error to retry, so it is reported as a missing selection rather than a
// failed request.
//
// Loading, refreshing, failing
// ----------------------------
// The idiom is `pages/ProspectIntelligence.tsx`'s, deliberately unchanged:
// `loading` / `refreshing` / `error`, a monotonic `reqRef` so a response from a
// superseded request can never overwrite a newer one, and `load(force, silent)`
// where a silent refresh never blanks the page, never shows a loader, and never
// raises a toast. A background refresh that fails leaves the last good payload on
// screen, because stale-but-labelled beats empty.
//
// Failure is layered rather than global:
//   • the whole payload failed with nothing held  → the page-level `Alert` with the
//     server's `detail` and a `Try again` that re-runs `load(true)`
//   • the payload failed with something held      → the same alert *above* the
//     content, which stays on screen
//   • one panel's own request failed              → that panel's inline error. The
//     timeline owns this itself, so a ledger that cannot load never hides the next
//     action; channel re-evaluation reports beside the channel panel
//
// Staying current
// ---------------
// GTM events already reach the browser: `timeline.publish()` broadcasts on the
// brand topic and the existing `/ws/campaign/{brand_id}` route forwards it
// untouched. An applied dimension transition is therefore patched in place — the
// value and its provenance, from the event's own evidence block — instead of
// triggering a refetch. A 60 s silent refetch is the fallback that covers a closed
// socket, a missed frame, and every event this page cannot patch (a recomputed
// score, a new draft).
//
// The state engine's sections
// ---------------------------
// R28.1 names sixteen sections, and the twelve this file did not already hold are
// composed here from panels that already exist. They sit inside one native
// disclosure — `<details>` with a `<summary>` — and three things follow from that,
// all deliberate:
//
//   • **Nothing is read until it is asked for.** The default load stays two
//     requests: the prospect payload and the ledger. Opening the disclosure runs
//     `loadState()`, which reads `GET /prospect/{lead_id}/state` and
//     `GET /prospect/{lead_id}/next-best-action` in parallel through
//     `Promise.allSettled`, so a ranking that failed cannot blank the belief. The
//     debug read behind `LearningInsightsPanel` is gated *again*, behind its own
//     control, because `getDebugView` returns six ledger collections and the whole
//     state to feed one panel — that is a deliberate read, not a page load.
//   • **The two panels the reads extend get richer once it is open.**
//     `StateDimensionGrid` takes `stateFull` and `NextActionPanel` takes
//     `nextBestAction`; both are additive and both render exactly as before while
//     the page holds neither (R9.6, R27.5).
//   • **The control is native markup rather than a `<button>`.** A `<summary>` is
//     focusable and Enter/Space operable without a keydown handler, an
//     `aria-expanded` of our own, or a second thing to keep in sync.
//
// Structure and announcements
// ---------------------------
// The chrome bar is the page's one `banner` and the scrollable content region is
// its one `main`, which is also what keeps `ProspectHeader`'s `<header>` scoped
// rather than resolving to a second banner.
//
// One `<h1>`, present in every state, and an `<h2>` per panel — most of them the
// panels' own, plus one this page supplies for the timeline section it wraps. Both
// page-level alerts pass `as="h2"` so the outline never jumps from `h1` to the
// alert primitive's default `h5`. The
// dimensions are a `<dl>` inside `StateDimensionGrid` and the timeline is an `<ol>`
// inside `ProspectTimeline`; neither is wrapped again here. The status line is
// `role="status" aria-live="polite"` so a move from "Refreshing" to the server's
// summary is announced, and every failure is an `Alert`, which is `role="alert"`.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Brain, Loader2 } from "lucide-react";
import { toast } from "sonner";

import ConversationSidebar from "@/components/ConversationSidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import CONFIG from "@/services/config";
import gtmAPI, {
  type Action,
  type CandidateAction,
  type FeedbackRecorded,
  type LearningUpdate,
  type Message,
  type NextBestAction,
  type ObservedFact,
  type ProspectDetail,
  type ProspectState,
  type ProspectStateFull,
  type RecommendationExplanation,
  type SourceSurface,
  type TimelineEntry,
} from "@/services/gtmAPI";

import { ActionExplanation } from "@/components/gtm/ActionExplanation";
import { ActivityPanel } from "@/components/gtm/ActivityPanel";
import { BuyingStagePanel } from "@/components/gtm/BuyingStagePanel";
import { CTAReadinessPanel } from "@/components/gtm/CTAReadinessPanel";
import { ChannelIntelligencePanel } from "@/components/gtm/ChannelIntelligencePanel";
import { ChannelRecommendationPanel } from "@/components/gtm/ChannelRecommendationPanel";
import { EngagementTrendPanel } from "@/components/gtm/EngagementTrendPanel";
import { IntentPanel } from "@/components/gtm/IntentPanel";
import { JourneyStateBadge } from "@/components/gtm/JourneyStateBadge";
import { LEARNING_PANEL_LABELS, LearningInsightsPanel } from "@/components/gtm/LearningInsightsPanel";
import { NextActionPanel } from "@/components/gtm/NextActionPanel";
import { ProspectHeader } from "@/components/gtm/ProspectHeader";
import { ProspectTimeline } from "@/components/gtm/ProspectTimeline";
import { SignalList } from "@/components/gtm/SignalList";
import { StateDimensionGrid } from "@/components/gtm/StateDimensionGrid";
import { StateHistoryPanel } from "@/components/gtm/StateHistoryPanel";
import { TimingPanel } from "@/components/gtm/TimingPanel";
import { GTM_PAGE_LABELS, GTM_UI_LABELS, TONE } from "@/components/gtm/labels";

// ─── The WebSocket the app already has ────────────────────────────────────────

/** How long the page waits before reading the payload again on its own (ms). */
export const SILENT_REFETCH_MS = 60_000;

/** The `type` discriminator `timeline.audit_payload()` puts on every GTM event. */
const GTM_EVENT_TYPE = "gtm_event";

/** Outcomes that actually moved a value. Everything else changed nothing. */
const APPLIED_OUTCOMES = ["APPLIED", "CORRECTED"];

/**
 * The state engine's two broadcasts, both values of the payload's own `event_type`.
 *
 * They travel on the bus this page is already subscribed to, inside the same
 * `type: "gtm_event"` envelope `timeline.audit_payload()` puts on every GTM frame —
 * which is why reading them is a branch on a field one level down rather than a new
 * socket, a new route, or a new discriminator.
 *
 *   `PROSPECT_STATE_CHANGED`  `prospect_state.apply_signal()` (R10.4). Carries
 *                             `changed_dimensions` and the whole `new_state`, so the
 *                             dimensions it names can be patched in place.
 *   `NBA_RANKING_COMPUTED`    `gtm_nba_worker`, when a recommended action or its
 *                             rank moved. Carries nothing about `ProspectDetail`:
 *                             the ranking is a different read, and the page answers
 *                             it by re-reading that read rather than by patching.
 */
export const PROSPECT_STATE_CHANGED = "PROSPECT_STATE_CHANGED";
export const NBA_RANKING_COMPUTED = "NBA_RANKING_COMPUTED";

/** How many rows each debug collection may return. One panel reads one of them. */
export const DEBUG_VIEW_LIMIT = 25;

/**
 * The dimension names the ledger uses, mapped to the fields the payload carries.
 *
 * A lookup, so an event naming a dimension this page does not hold is ignored
 * rather than guessed at — and a dimension the backend adds later reaches the
 * screen through the 60 s refetch instead of being mis-patched.
 */
const DIMENSION_FIELD: Record<string, keyof ProspectState> = {
  relationship_state: "relationshipState",
  conversation_state: "conversationState",
  conversation_stage: "conversationStage",
  execution_state: "executionState",
  activity_level: "activityLevel",
};

/**
 * One dimension's fact as `prospect_state._fact()` writes it into `new_state`.
 *
 * Snake_case, because this is the broadcast body rather than a normalised response:
 * the socket does not go through `gtmAPI`, so nothing has renamed these keys.
 */
export interface GtmSocketDimensionFact {
  value?: string | null;
  is_unknown?: boolean | null;
  source_surface?: SourceSurface | null;
  observed_at?: string | null;
  is_stale?: boolean | null;
}

/** The subset of the audit payload this page reads. Everything else is ignored. */
export interface GtmSocketEvent {
  type?: string;
  event_type?: string;
  lead_id?: string | null;
  /**
   * The prospect, as `PROSPECT_STATE_CHANGED` names it.
   *
   * The envelope carries `lead_id` off the ledger row and that payload carries the
   * same identity again under its own key, so both are read and `lead_id` wins.
   */
  prospect_id?: string | null;
  outcome?: string;
  dimension?: string | null;
  new_value?: string | null;
  /** `PROSPECT_STATE_CHANGED` — what moved in the change this frame reports. */
  changed_dimensions?: string[] | null;
  /** `PROSPECT_STATE_CHANGED` — the belief as it stands, in `state_payload()` shape. */
  new_state?: {
    dimensions?: Record<string, GtmSocketDimensionFact | null> | null;
  } | null;
  evidence?: {
    source_surface?: SourceSurface | null;
    observed_at?: string | null;
  } | null;
}

/** The prospect a frame is about, however that frame spells the identity. */
export function eventLeadId(event: GtmSocketEvent): string | null {
  return event.lead_id ?? event.prospect_id ?? null;
}

/** True for the two `event_type` values the state engine broadcasts. */
export function isStateEngineEvent(event: GtmSocketEvent): boolean {
  return event.event_type === PROSPECT_STATE_CHANGED || event.event_type === NBA_RANKING_COMPUTED;
}

function socketUrl(brandId: string): string {
  return `${CONFIG.WEEZ_BASE_URL.replace(/^http/, "ws")}/ws/campaign/${encodeURIComponent(brandId)}`;
}

/**
 * The fact after an applied transition: the new value, and the provenance the
 * event's evidence block carried.
 *
 * `isStale` and `isDerived` are carried over from the fact already held rather than
 * recomputed. Staleness is a server verdict against a freshness window and the
 * event does not contain one, so patching it here would be this page asserting a
 * freshness judgement it did not make. A badge that lags for up to a minute is a
 * display lag; an invented verdict would be a lie, and the silent refetch replaces
 * the whole payload with the server's own answer either way.
 */
function patchedFact(previous: ObservedFact, event: GtmSocketEvent): ObservedFact {
  const value = event.new_value ?? null;
  return {
    ...previous,
    value,
    isUnknown: value === null,
    sourceSurface: event.evidence?.source_surface ?? previous.sourceSurface,
    observedAt: event.evidence?.observed_at ?? previous.observedAt,
  };
}

/** The fact a dimension block in `new_state` describes, over the fact held. */
function patchedDimension(previous: ObservedFact, block: GtmSocketDimensionFact): ObservedFact {
  // `patchedFact` already knows how to take a value and a provenance pair, so the
  // block is read through it rather than through a second copy of that reasoning.
  const patched = patchedFact(previous, {
    new_value: block.value ?? null,
    evidence: {
      source_surface: block.source_surface ?? null,
      observed_at: block.observed_at ?? null,
    },
  });
  // Two verdicts this frame *does* carry, unlike a bare transition: the server said
  // whether the fact reads unknown and whether it is stale, so its answer is taken
  // over anything inferred here.
  return {
    ...patched,
    isUnknown: typeof block.is_unknown === "boolean" ? block.is_unknown : patched.isUnknown,
    isStale: typeof block.is_stale === "boolean" ? block.is_stale : patched.isStale,
  };
}

/**
 * The payload with every dimension `PROSPECT_STATE_CHANGED` moved patched in place.
 *
 * The whole belief travels on this frame, so the patch is per named dimension and
 * not per event: `changed_dimensions` says what moved and `new_state.dimensions`
 * holds each new value with its own provenance. A name this page does not hold is
 * skipped rather than guessed at, and a frame that moved nothing this page holds
 * returns the same reference so it costs no re-render.
 *
 * What is *not* patched from here is everything else in `new_state` — the intents,
 * the channel states, the buying stage. Those are the state read's, and the page
 * re-reads it rather than reassembling a normalised payload from a socket frame.
 */
function applyStateChange(detail: ProspectDetail, event: GtmSocketEvent): ProspectDetail {
  const blocks = event.new_state?.dimensions;
  if (!blocks) return detail;

  const named = event.changed_dimensions ?? Object.keys(blocks);
  let state = detail.state;
  let moved = false;

  for (const name of named) {
    const field = DIMENSION_FIELD[name];
    if (!field) continue;
    const block = blocks[name];
    if (!block) continue;
    const previous = state[field];
    if (!previous || typeof previous !== "object" || !("isUnknown" in previous)) continue;
    state = { ...state, [field]: patchedDimension(previous as ObservedFact, block) };
    moved = true;
  }

  return moved ? { ...detail, state } : detail;
}

/**
 * The payload with what the frame carried patched in, or the payload unchanged.
 *
 * Returns the same object reference when nothing applies, so an event for another
 * prospect — or an event this page cannot patch — costs no re-render.
 *
 * Two stages, and the second is the one that was here first:
 *
 *   1. the state engine's branch, keyed on the payload's own `event_type`. It patches
 *      the dimensions `PROSPECT_STATE_CHANGED` names; `NBA_RANKING_COMPUTED` says
 *      nothing about this payload, so it patches nothing and the page re-reads the
 *      ranking instead of inventing one here.
 *   2. **falling through** to the existing dimension/outcome handling, which is
 *      unchanged and still the only thing that reads `event.dimension`. It runs
 *      against whatever stage 1 produced, because the envelope carries the ledger
 *      row's own `dimension` block when the row had one — so a frame is never
 *      claimed by the first stage at the expense of the second.
 */
export function applySocketEvent(
  detail: ProspectDetail | null,
  event: GtmSocketEvent,
): ProspectDetail | null {
  if (!detail) return detail;
  if (event.type !== GTM_EVENT_TYPE) return detail;
  const subject = eventLeadId(event);
  if (subject && subject !== detail.leadId) return detail;

  // ── 1. The state engine's branch (R28.1, R10.4) ──
  let carried = detail;
  if (
    event.event_type === PROSPECT_STATE_CHANGED &&
    event.outcome &&
    APPLIED_OUTCOMES.includes(event.outcome)
  ) {
    carried = applyStateChange(carried, event);
  }

  // ── 2. Falling through: the existing handling, unchanged ──
  if (!event.outcome || !APPLIED_OUTCOMES.includes(event.outcome)) return carried;

  const field = event.dimension ? DIMENSION_FIELD[event.dimension] : undefined;
  if (!field) return carried;

  const previous = carried.state[field];
  // `ProspectState` also holds `confirmationStatus` and `displaySummary`, which are
  // not `ObservedFact`s and are never reached by a dimension transition.
  if (!previous || typeof previous !== "object" || !("isUnknown" in previous)) return carried;

  return {
    ...carried,
    state: { ...carried.state, [field]: patchedFact(previous as ObservedFact, event) },
  };
}

/** A failure's own message, or the page's own wording when it carries none. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : GTM_PAGE_LABELS.loadFailedTitle;
}

/**
 * A confidence as the server sent it, to two places when it has a fraction.
 *
 * `StateDimensionGrid`'s convention, repeated because it is a format and not a
 * computation: no band is derived from the number here, because a band is a
 * judgement and this page does not make any.
 */
function formatConfidence(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// ─── Loading placeholder, in the page's real geometry ─────────────────────────

function PanelSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}>
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, row) => (
          <Skeleton key={row} className={cn("h-3", row === rows - 1 ? "w-1/2" : "w-full")} />
        ))}
      </div>
    </div>
  );
}

/**
 * The same two-column layout the loaded page uses, with the content replaced.
 *
 * Real geometry rather than a spinner, so the page does not jump when the payload
 * lands, and `aria-busy` plus an off-screen announcement so the wait is legible to
 * a reader who cannot see the pulse.
 */
function ProspectSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only">{GTM_PAGE_LABELS.statusLoading}</span>
      <PanelSkeleton rows={4} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="min-w-0 space-y-4">
          <PanelSkeleton rows={5} />
          <PanelSkeleton rows={2} />
          <PanelSkeleton rows={4} />
          <PanelSkeleton rows={3} />
        </div>
        <div className="min-w-0 space-y-4">
          <PanelSkeleton rows={5} />
          <PanelSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}

// ─── The page ─────────────────────────────────────────────────────────────────

export default function GTMProspect() {
  // The space is the brand: the same id `evaAPI` sends as `brand_id`.
  const { spaceId } = useParams<{ spaceId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const brandId = spaceId ?? "";
  const leadId = search.get("lead_id") ?? "";

  const [detail, setDetail] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Panel-local failures. A channel re-evaluation that fails must not disturb the
  // rest of the page, and the timeline owns its own failure inside the component.
  const [channelError, setChannelError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  /** Bumped to make `ProspectTimeline` re-read the ledger. */
  const [timelineKey, setTimelineKey] = useState(0);

  // ── The state engine's reads (R28.1, R28.7) ──
  //
  // Held beside the prospect payload rather than merged into it: three routes with
  // three failure modes, and a ranking that could not be read must not take the
  // belief down with it. Both are null until the disclosure is opened, and every
  // panel that takes one is additive, so the page renders as it always did until
  // then.
  const [stateFull, setStateFull] = useState<ProspectStateFull | null>(null);
  const [nextBestAction, setNextBestAction] = useState<NextBestAction | null>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [stateOpen, setStateOpen] = useState(false);
  /** Bumped to make `SignalList` and `StateHistoryPanel` re-read their collections. */
  const [stateKey, setStateKey] = useState(0);
  /** The candidate whose reasoning the operator opened, when they opened one. */
  const [explained, setExplained] = useState<CandidateAction | null>(null);

  // The debug read, gated again behind its own control. `getDebugView` answers with
  // six ledger collections and the whole state to feed one panel, which is a
  // deliberate read and not a page load.
  const [learningUpdates, setLearningUpdates] = useState<LearningUpdate[] | null>(null);
  const [learningOpen, setLearningOpen] = useState(false);
  const [learningLoading, setLearningLoading] = useState(false);
  const [learningError, setLearningError] = useState<string | null>(null);

  /**
   * The monotonic request counter from `ProspectIntelligence.tsx`. Every load takes
   * a ticket; a response holding a superseded ticket is dropped rather than allowed
   * to overwrite a newer one.
   */
  const reqRef = useRef(0);
  /** The same idiom, one counter per collection, so the three cannot cross. */
  const stateReqRef = useRef(0);
  const debugReqRef = useRef(0);
  /**
   * Whether the sections are on screen, readable from a callback without making the
   * socket subscription and the refetch timer depend on the disclosure — reconnecting
   * a socket because somebody opened a panel would be a real bug.
   */
  const stateOpenRef = useRef(false);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  const load = useCallback(
    async (force: boolean, silent = false) => {
      if (!brandId || !leadId) {
        setLoading(false);
        return;
      }
      const my = ++reqRef.current;
      if (!silent) {
        setError(null);
        if (force) setRefreshing(true);
        else setLoading(true);
      }
      try {
        const data = await gtmAPI.getProspect(brandId, leadId);
        if (my !== reqRef.current) return;
        setDetail(data);
        if (force && !silent) toast.success(GTM_PAGE_LABELS.refreshedToast);
      } catch (e) {
        // A silent (background) refresh must never blank the page or nag — the last
        // good payload stays, and the next cycle tries again.
        if (my !== reqRef.current || silent) return;
        const message = e instanceof Error ? e.message : GTM_PAGE_LABELS.loadFailedTitle;
        setError(message);
        if (force) toast.error(GTM_PAGE_LABELS.refreshFailedToast);
        else setDetail(null);
      } finally {
        if (my === reqRef.current && !silent) {
          if (force) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [brandId, leadId],
  );

  /**
   * The state engine's two reads, in the idiom above (R28.7).
   *
   * `Promise.allSettled` rather than `Promise.all`: the belief and the ranking are
   * two routes, and one of them failing must leave the other on screen. A silent
   * refresh keeps whatever is held and says nothing, exactly as `load` does.
   */
  const loadState = useCallback(
    async (silent = false) => {
      if (!brandId || !leadId) return;
      const my = ++stateReqRef.current;
      if (!silent) {
        setStateError(null);
        setStateLoading(true);
      }
      try {
        const [state, ranking] = await Promise.allSettled([
          gtmAPI.getProspectState(brandId, leadId),
          gtmAPI.getNextBestAction(brandId, leadId),
        ]);
        if (my !== stateReqRef.current) return;

        if (state.status === "fulfilled") setStateFull(state.value);
        if (ranking.status === "fulfilled") setNextBestAction(ranking.value);

        if (!silent) {
          const refused = [state, ranking].find((result) => result.status === "rejected");
          setStateError(
            refused && refused.status === "rejected" ? messageOf(refused.reason) : null,
          );
        }
      } finally {
        if (my === stateReqRef.current && !silent) setStateLoading(false);
      }
    },
    [brandId, leadId],
  );

  /** The debug read, for the one collection `LearningInsightsPanel` renders. */
  const loadLearning = useCallback(async () => {
    if (!brandId || !leadId) return;
    const my = ++debugReqRef.current;
    setLearningError(null);
    setLearningLoading(true);
    try {
      const debug = await gtmAPI.getDebugView(brandId, leadId, { limit: DEBUG_VIEW_LIMIT });
      if (my !== debugReqRef.current) return;
      setLearningUpdates(debug.learningUpdates);
    } catch (e) {
      if (my !== debugReqRef.current) return;
      setLearningError(messageOf(e));
    } finally {
      if (my === debugReqRef.current) setLearningLoading(false);
    }
  }, [brandId, leadId]);

  /** Opening the sections is what reads them; closing them stops nothing in flight. */
  const onSectionsToggle = useCallback(
    (open: boolean) => {
      setStateOpen(open);
      stateOpenRef.current = open;
      if (open && !stateFull && !nextBestAction && !stateLoading) void loadState();
    },
    [loadState, nextBestAction, stateFull, stateLoading],
  );

  const onLearningToggle = useCallback(() => {
    setLearningOpen((open) => !open);
    if (!learningUpdates && !learningLoading) void loadLearning();
  }, [learningLoading, learningUpdates, loadLearning]);

  useEffect(() => {
    void load(false);
  }, [load]);

  // A different prospect is a different belief: nothing read for the last one may
  // survive into the next. Where the sections are already open they are re-read,
  // because a disclosure that stays open must not keep showing the prospect before.
  useEffect(() => {
    setStateFull(null);
    setNextBestAction(null);
    setStateError(null);
    setExplained(null);
    setLearningUpdates(null);
    setLearningOpen(false);
    setLearningError(null);
    if (stateOpenRef.current) void loadState();
  }, [brandId, leadId, loadState]);

  // The fallback read (R18.7). Silent by construction: no loader, no toast, and no
  // blanking if it fails. It covers a closed socket, a dropped frame, and every
  // event this page cannot patch in place.
  useEffect(() => {
    if (!brandId || !leadId) return;
    const timer = setInterval(() => {
      void load(true, true);
      // The state engine's sections get the same fallback, and only while they are
      // on screen: nothing is re-read for a disclosure nobody opened.
      if (stateOpenRef.current) {
        void loadState(true);
        setStateKey((key) => key + 1);
      }
    }, SILENT_REFETCH_MS);
    return () => clearInterval(timer);
  }, [brandId, leadId, load, loadState]);

  // The events the app already delivers. Patch in place; do not poll.
  useEffect(() => {
    if (!brandId || !leadId) return;
    if (typeof WebSocket === "undefined") return;

    let socket: WebSocket;
    try {
      socket = new WebSocket(socketUrl(brandId));
    } catch {
      return; // No socket is a degraded page, not a broken one: the timer covers it.
    }

    socket.onmessage = (frame: MessageEvent) => {
      let event: GtmSocketEvent;
      try {
        event = JSON.parse(String(frame.data)) as GtmSocketEvent;
      } catch {
        return;
      }
      if (event?.type !== GTM_EVENT_TYPE) return; // ping / pong / poster updates
      const subject = eventLeadId(event);
      if (subject && subject !== leadId) return;
      setDetail((held) => applySocketEvent(held, event));
      // Whatever the event was, the ledger now has a row for it.
      setTimelineKey((key) => key + 1);

      // The two the patch above cannot finish. `PROSPECT_STATE_CHANGED` moved the
      // dimensions in place, but the rest of the belief — intents, channels, the
      // buying stage — is the state read's; `NBA_RANKING_COMPUTED` is entirely the
      // ranking read's. So the reads are re-run, silently, and only while the
      // sections they feed are on screen.
      if (isStateEngineEvent(event)) {
        setStateKey((key) => key + 1);
        if (stateOpenRef.current) void loadState(true);
      }
    };
    // A socket that cannot connect is not an error the operator has to see.
    socket.onerror = () => undefined;

    return () => {
      socket.onmessage = null;
      socket.onerror = null;
      try {
        socket.close();
      } catch {
        /* already closing */
      }
    };
  }, [brandId, leadId]);

  const onReevaluate = useCallback(async () => {
    if (!brandId || !leadId) return;
    setEvaluating(true);
    setChannelError(null);
    try {
      const evaluation = await gtmAPI.recommendChannel(brandId, leadId);
      setDetail((held) =>
        held
          ? {
              ...held,
              channels: evaluation.channels,
              recommendedChannel: evaluation.recommendedChannel,
            }
          : held,
      );
      setTimelineKey((key) => key + 1);
      toast.success(GTM_PAGE_LABELS.reevaluatedToast);
    } catch (e) {
      setChannelError(e instanceof Error ? e.message : GTM_PAGE_LABELS.reevaluateFailed);
    } finally {
      setEvaluating(false);
    }
  }, [brandId, leadId]);

  /** A fresher action row from the next-action panel, merged without a refetch. */
  const onActionRequested = useCallback((action: Action) => {
    setDetail((held) =>
      held?.nextAction ? { ...held, nextAction: { ...held.nextAction, latestAction: action } } : held,
    );
    setTimelineKey((key) => key + 1);
  }, []);

  /**
   * A lifecycle position the Action_Card recorded — `VIEWED`, `CANCELLED`.
   *
   * The row is already persisted and already on the ledger, so the page's answer is
   * to re-read the ledger. It does not patch a dimension: none of the positions
   * route 10 admits moves one (R27.2).
   */
  const onLifecycleRecorded = useCallback((_entry: TimelineEntry) => {
    setTimelineKey((key) => key + 1);
  }, []);

  /**
   * The feedback row the card's not-relevant control persisted.
   *
   * The route reports what it did besides writing the row, and either of those makes
   * the ranking on screen the older one — so the read is re-run rather than the card
   * being edited in place.
   */
  const onFeedbackRecorded = useCallback(
    (recorded: FeedbackRecorded) => {
      setTimelineKey((key) => key + 1);
      if (recorded.recomputeMarked || recorded.suppressionWritten) void loadState(true);
    },
    [loadState],
  );

  /**
   * The operator opened a candidate's reasoning.
   *
   * The explanation is already on the candidate, so this selects it and makes sure
   * the section that renders it is open — it asks for nothing and edits nothing.
   */
  const onEditReasoning = useCallback(
    (action: CandidateAction) => {
      setExplained(action);
      if (detailsRef.current) detailsRef.current.open = true;
      setStateOpen(true);
      stateOpenRef.current = true;
      if (!stateFull) void loadState();
    },
    [loadState, stateFull],
  );

  /** A message row the server rewrote: a saved edit, or a new version. */
  const onMessagePersisted = useCallback((message: Message) => {
    setDetail((held) => {
      if (!held) return held;
      const known = held.messageVersions.some((row) => row.messageId === message.messageId);
      const versions = known
        ? held.messageVersions.map((row) => (row.messageId === message.messageId ? message : row))
        : [message, ...held.messageVersions];
      return { ...held, messageVersions: versions, latestMessage: versions[0] ?? held.latestMessage };
    });
    setTimelineKey((key) => key + 1);
  }, []);

  /**
   * What the live region says.
   *
   * The page's own two states are announcements about the page. Anything else is
   * the server's `displaySummary`, passed through — the page does not derive a
   * status from `executionState` and `confirmationStatus`, because that projection
   * is computed once, server-side, and rendered with its provenance by
   * `StateDimensionGrid`.
   */
  const statusText = useMemo(() => {
    if (loading && !detail) return GTM_PAGE_LABELS.statusLoading;
    if (refreshing) return GTM_PAGE_LABELS.statusRefreshing;
    return detail?.state.displaySummary?.trim() || "";
  }, [detail, loading, refreshing]);

  const hasLead = Boolean(brandId && leadId);

  /**
   * The reasoning `ActionExplanation` renders: the candidate the operator opened, and
   * the ranking's own winner otherwise.
   *
   * Null is a real answer — nothing has been argued for this prospect yet — and the
   * panel says so rather than showing four empty sections.
   */
  const explanation: RecommendationExplanation | null = useMemo(() => {
    const candidate = explained ?? nextBestAction?.recommended ?? null;
    return candidate?.explanation ?? null;
  }, [explained, nextBestAction]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar
        spaceId={spaceId!}
        onNewChat={() => navigate("/spaces")}
        onSelectConversation={() => {}}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white shadow-sm ring-2 ring-violet-100">
              <Brain className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {GTM_PAGE_LABELS.eyebrow}
              </span>
              {/* The page's single `<h1>`, present in every state. */}
              <h1 className="truncate text-sm font-semibold text-zinc-900">
                {GTM_PAGE_LABELS.pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* The live region (R18.8). Announced politely, so a transition from
                "Refreshing" to the server's summary is spoken without interrupting. */}
            <p
              role="status"
              aria-live="polite"
              className="hidden max-w-[22rem] truncate text-[11.5px] font-medium text-slate-500 sm:block"
            >
              {refreshing && (
                <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin align-[-1px]" aria-hidden="true" />
              )}
              {statusText}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={() => navigate(`/prospect-intelligence/${spaceId ?? ""}`)}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{GTM_PAGE_LABELS.backToProspects}</span>
            </Button>
          </div>
        </header>

        {/* The content region, as a `<main>` landmark.
            Two reasons, and the second is the one a checker catches. A page with no
            `main` has no way for a reader to skip the chrome to the content. And
            without it, `ProspectHeader`'s own `<header>` sits outside every
            sectioning element, so it maps to a *second* `banner` role alongside the
            chrome header above — two banners on one document, which is a violation
            rather than a preference. Scoping the content here leaves exactly one. */}
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] space-y-4 px-6 pb-10 pt-6 lg:px-8">
            {!hasLead ? (
              // Nothing to retry: the route is missing the prospect it needs.
              // `as="h2"` on both page-level alert titles: the alert primitive
              // defaults to `h5`, and this page's outline is `h1` → panels at `h2`,
              // so the default would skip three levels and fail `heading-order`.
              <Alert>
                <AlertTitle as="h2">{GTM_PAGE_LABELS.noLeadTitle}</AlertTitle>
                <AlertDescription>{GTM_PAGE_LABELS.noLeadBody}</AlertDescription>
              </Alert>
            ) : loading && !detail ? (
              <ProspectSkeleton />
            ) : error && !detail ? (
              <Alert variant="destructive">
                <AlertTitle as="h2">{GTM_PAGE_LABELS.loadFailedTitle}</AlertTitle>
                <AlertDescription className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="text-[13px]">{error}</span>
                  <Button size="sm" variant="outline" onClick={() => void load(true)}>
                    {GTM_PAGE_LABELS.retry}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : detail ? (
              <>
                {/* A failed refresh with a payload still held: the alert sits above
                    the content, and the content stays. */}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="flex flex-wrap items-center gap-3">
                      <span className="text-[13px]">{error}</span>
                      <Button size="sm" variant="outline" onClick={() => void load(true)}>
                        {GTM_PAGE_LABELS.retry}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* `headingAs="h2"` — the page owns the `<h1>`, so the header is a
                    panel like the others and the outline stays flat. */}
                <ProspectHeader
                  profile={detail.profile}
                  onRefresh={() => void load(true)}
                  refreshing={refreshing}
                  updatedAt={detail.updatedAt}
                  headingAs="h2"
                />

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
                  {/* Left: what we know and what it means. */}
                  <div className="min-w-0 space-y-4">
                    {channelError && (
                      <Alert variant="destructive">
                        <AlertDescription className="flex flex-wrap items-center gap-3">
                          <span className="text-[13px]">{channelError}</span>
                          <Button size="sm" variant="outline" onClick={() => void onReevaluate()}>
                            {GTM_PAGE_LABELS.retry}
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    <ChannelRecommendationPanel
                      channels={detail.channels}
                      recommendedChannel={detail.recommendedChannel}
                      onReevaluate={() => void onReevaluate()}
                      evaluating={evaluating}
                    />
                    <ActivityPanel activity={detail.activity} />
                    {/* `stateFull` is additive (R9.6, R28.3): null until the sections
                        below are opened, and the four dimensions never move. With it,
                        the added dimensions, the per-dimension confidence and the
                        journey badge appear beside them. */}
                    <StateDimensionGrid state={detail.state} stateFull={stateFull} />
                    <CTAReadinessPanel cta={detail.cta} />
                  </div>

                  {/* Right: what to do, and the record of what has happened. */}
                  <div className="min-w-0 space-y-4">
                    {/* `nextBestAction` is additive in the same way (R27.5): without
                        it this panel is what it always was, and with it the
                        Action_Card for the ranking's winner appears above the
                        recommendation, which keeps its composer and its confirm
                        ladder. */}
                    <NextActionPanel
                      brandId={brandId}
                      leadId={detail.leadId}
                      nextAction={detail.nextAction}
                      nextBestAction={nextBestAction}
                      confirmationStatus={detail.state.confirmationStatus}
                      messageVersions={detail.messageVersions}
                      onActionRequested={onActionRequested}
                      onLifecycleRecorded={onLifecycleRecorded}
                      onFeedbackRecorded={onFeedbackRecorded}
                      onEditReasoning={onEditReasoning}
                      onMessagePersisted={onMessagePersisted}
                    />

                    {/* The timeline fetches, pages, and fails on its own. The `<ol>`
                        is the component's; this section only supplies the heading. */}
                    <section
                      aria-labelledby="gtm-timeline-heading"
                      className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                    >
                      <h2
                        id="gtm-timeline-heading"
                        className="text-sm font-semibold text-zinc-900"
                      >
                        {GTM_PAGE_LABELS.timelineTitle}
                      </h2>
                      <ProspectTimeline
                        brandId={brandId}
                        leadId={detail.leadId}
                        refreshKey={timelineKey}
                        className="mt-2"
                      />
                    </section>
                  </div>
                </div>

                {/* ── The state engine's sections (R28.1, R28.3) ──
                    Twelve panels, each owning its own semantics and its own `<h2>`,
                    behind one native disclosure. The disclosure is what keeps the
                    default load at two requests: `loadState()` runs on the first
                    open, `SignalList` and `StateHistoryPanel` read their own
                    collections when they mount, and the debug read behind
                    `LearningInsightsPanel` is gated once more inside.

                    A `<summary>` rather than a `<Button>`: it is focusable and
                    Enter/Space operable as it stands, with no `aria-expanded` of ours
                    to keep in sync with the element's own `open`. */}
                <details
                  ref={detailsRef}
                  className="rounded-lg border border-zinc-200 bg-white shadow-sm"
                  onToggle={(event) => onSectionsToggle(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer rounded-lg px-5 py-4 text-[13px] font-semibold text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    {GTM_PAGE_LABELS.subtitle}
                    {stateLoading && (
                      <Loader2
                        className="ml-2 inline h-3 w-3 animate-spin align-[-1px]"
                        aria-hidden="true"
                      />
                    )}
                  </summary>

                  {stateOpen && (
                    <div className="space-y-4 border-t border-zinc-200 p-4">
                      {/* One read failing is this section's failure, not the page's:
                          the alert sits here and whatever landed stays on screen. */}
                      {stateError && (
                        <Alert variant="destructive">
                          <AlertDescription className="flex flex-wrap items-center gap-3">
                            <span className="text-[13px]">{stateError}</span>
                            <Button size="sm" variant="outline" onClick={() => void loadState()}>
                              {GTM_PAGE_LABELS.retry}
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {stateLoading && !stateFull ? (
                        <div aria-busy="true" className="space-y-4">
                          <span className="sr-only">{GTM_PAGE_LABELS.statusLoading}</span>
                          <PanelSkeleton rows={4} />
                          <PanelSkeleton rows={3} />
                        </div>
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
                          {/* Left: what the engine believes, and what it read. */}
                          <div className="min-w-0 space-y-4">
                            {stateFull && (
                              <>
                                {/* Confidence (R28.1). The whole-state number, and the
                                    projection it qualifies. The per-dimension
                                    confidences are chips in the grid above, because a
                                    dimension's confidence belongs on that dimension. */}
                                <section
                                  aria-labelledby="gtm-confidence-heading"
                                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                                >
                                  <h2
                                    id="gtm-confidence-heading"
                                    className="text-sm font-semibold text-zinc-900"
                                  >
                                    {GTM_UI_LABELS.confidence}
                                  </h2>
                                  <div className="mt-3 flex flex-wrap items-start gap-3">
                                    <span
                                      className={cn(
                                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                        TONE.zinc,
                                      )}
                                    >
                                      <span className="sr-only">{GTM_UI_LABELS.confidence}: </span>
                                      {formatConfidence(stateFull.stateConfidence)}
                                    </span>
                                    <JourneyStateBadge journeyState={stateFull.journeyState} />
                                  </div>
                                </section>

                                <IntentPanel intents={stateFull.intents} />
                                <BuyingStagePanel buyingStage={stateFull.buyingStage} />
                                <ChannelIntelligencePanel channels={stateFull.channels} />
                                {/* Neither payload carries a confidence of its own; the
                                    engine reports one per dimension, so the map goes
                                    with them rather than a number invented here. */}
                                <EngagementTrendPanel
                                  engagement={stateFull.engagement}
                                  dimensionConfidence={stateFull.dimensionConfidence}
                                />
                                <TimingPanel
                                  timing={stateFull.timing}
                                  dimensionConfidence={stateFull.dimensionConfidence}
                                />
                              </>
                            )}

                            {/* These two fetch, page and fail on their own, so neither
                                depends on the state read having landed. */}
                            <SignalList
                              brandId={brandId}
                              leadId={detail.leadId}
                              refreshKey={stateKey}
                            />
                            <StateHistoryPanel
                              brandId={brandId}
                              leadId={detail.leadId}
                              refreshKey={stateKey}
                            />
                          </div>

                          {/* Right: why this action, and what the outcomes say. */}
                          <div className="min-w-0 space-y-4">
                            <ActionExplanation explanation={explanation} />

                            {/* The debug read, behind its own control. `getDebugView`
                                answers with six ledger collections and the whole state
                                to feed this one panel, so it is asked for rather than
                                fired on load. */}
                            <div className="space-y-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-expanded={learningOpen}
                                aria-controls="gtm-learning-region"
                                onClick={onLearningToggle}
                              >
                                {learningLoading && (
                                  <Loader2
                                    className="h-3.5 w-3.5 animate-spin"
                                    aria-hidden="true"
                                  />
                                )}
                                {LEARNING_PANEL_LABELS.title}
                              </Button>

                              <div id="gtm-learning-region" className="space-y-2">
                                {learningError && (
                                  <Alert variant="destructive">
                                    <AlertDescription className="flex flex-wrap items-center gap-3">
                                      <span className="text-[13px]">{learningError}</span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void loadLearning()}
                                      >
                                        {GTM_PAGE_LABELS.retry}
                                      </Button>
                                    </AlertDescription>
                                  </Alert>
                                )}
                                {learningOpen && learningUpdates && (
                                  <LearningInsightsPanel
                                    updates={learningUpdates}
                                    scope={explanation?.scope ?? null}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </details>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
