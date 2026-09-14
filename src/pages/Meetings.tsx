// pages/Meetings.tsx
//
// The Meetings_Page, at `/sales-workspace/:spaceId` (R14.1–R14.11, design §9).
//
// ── What replaced what ──
//
// This page used to call `maxAPI.getWorkspace()` and derive its rows from
// `account.status === "meeting"` and `opportunity.tracking.meetingBooked`, with
// `DEMO_SEEDS`, `demo_acc_*` / `demo_opp_*` identifiers, `isRealBrandId()` guards and an
// `isSample` flag in the mix, and it counted `meetingsBooked` in the browser. All of that
// is gone — the derivation helpers, the funnel, the animated empty state and the `maxAPI`
// import with them (R14.4, R14.5).
//
// Every meeting on this screen is now assembled from persisted GTM state read through
// `gtmAPI` (R14.1, R14.2):
//
//   GET /gtm/prospects?limit=100                → the tracked population
//   GET /gtm/prospect/{lead_id}/state           → journeyState, conversationState
//   GET /gtm/prospect/{lead_id}/cta             → ctaState, recommendedCta
//   GET /gtm/prospect/{lead_id}/timeline        → the recorded outcome
//   GET /gtm/analytics/daily?days=…             → the two counts
//
// **Only four prospects are read, not five hundred.** Three per-prospect reads for every
// tracked prospect would be a request per row, so the population is narrowed first on the
// list payload the page already holds: `ProspectListItem.state.conversationState` and
// `.journeyState` travel on `GET /gtm/prospects`, and only the leads whose list-payload
// state is in the meeting set get the three follow-up reads. A workspace with 500 tracked
// prospects and 4 meetings costs `1 + 3×4 = 13` requests (design §9.1).
//
// ── A meeting is a persisted value, and nothing else makes one ──
//
// `MEETING_EVIDENCE` below is the whole table (R14.1, design §9.2). A prospect who is
// narrowed in and then turns out to carry none of those values renders nothing: the
// narrowing is a cheap gate, and the evidence is the decision.
//
// ── Grouped by status, because there is no time to group by ──
//
// No GTM table holds a meeting's start instant. `li_gtm_conversations` carries
// `last_inbound_observed_at` and `last_outbound_observed_at`, `LinkedInAction` carries
// `requested_at` and `delivered_at`, and none of them is when the meeting is due. Sorting
// by any of those would present the freshest *observation* as the soonest *meeting*, which
// is a fabricated schedule built from real timestamps. So the page groups by status and
// says so once, in `MEETING_LABELS.noScheduledTimes` (R14.7).
//
// ── The counts are the server's arithmetic, not ours ──
//
// `meetings_booked` and `meetings_completed` are summed across the day rows the analytics
// read returned, and an absent metric on a day contributes **nothing** rather than a zero —
// `analytics_metric_series` omits a key it could not compute, so a key that never arrives
// means the measurement was never taken. A window in which neither metric was ever
// computable renders `MEETING_LABELS.countsUnavailable` instead of a number (R14.3, R14.5,
// design §9.3). Presence is tested with `hasMetric()` imported from `Analytics.tsx` — the
// same own-property check that surface uses, so the two cannot disagree about what absent
// means.
//
// Nothing on this page counts meetings. There is no group tally, no header count and no
// "N shown" line, because a number this page computed would be a second answer to a
// question the Analytics_Endpoint already answers (R14.5, R20.4).
//
// ── What this page is not ──
//
// The buying-intent detail, the signal detail and the state history are the dossier's and
// are not read here (R14.9). Selecting a meeting goes there in one step, through
// `prospectRoute()` — the same builder Nina's blocks use, so the destination is one string
// (R14.10).

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarCheck, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ConversationSidebar from "@/components/ConversationSidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import gtmAPI from "@/services/gtmAPI";
import type {
  AnalyticsDayRow,
  AnalyticsMetricKey,
  CTA,
  DailyAnalytics,
  EventOutcome,
  ObservedFact,
  ProspectListItem,
  ProspectStateFull,
  TimelineEntry,
} from "@/services/gtmAPI";

import { CreditBalanceBadge } from "@/components/gtm/CreditBalance";
import { useCredits } from "@/hooks/useCredits";
import ObservedValue from "@/components/gtm/ObservedValue";
import {
  GTM_ABSENCE_LABELS,
  GTM_PAGE_LABELS,
  GTM_UI_LABELS,
  MEETING_LABELS,
  RECOMMENDED_CTA_LABEL,
  STATE_LABEL,
  STATE_TONE,
  TONE,
  absTime,
  relTime,
} from "@/components/gtm/labels";
// The analytics vocabulary and its one presence test, from the surface that publishes
// them. `hasMetric()` in particular is imported rather than rewritten: a second presence
// check would let this page and the Analytics page disagree about whether a metric is
// absent, and that disagreement is exactly what turns an unmeasured day into a zero.
import {
  ANALYTICS_METRIC_LABELS,
  ANALYTICS_RANGE_OPTIONS,
  hasMetric,
  rangeOptionLabel,
  readRangeParam,
} from "./Analytics";
// Where selecting a meeting goes (R14.10). One builder for the dossier destination, so the
// three surfaces that send a reader there cannot spell it three ways.
import { prospectRoute } from "./Ninna";

// ─── The evidence vocabulary (R14.1, design §9.2) ─────────────────────────────

/** `ConversationState` / `CtaState` / `JourneyState` / signal / outcome: the ask. */
export const MEETING_REQUESTED = "MEETING_REQUESTED";
/** The same four vocabularies, plus `FACT_MEETING_BOOKED` and `OUTCOME_MEETING_BOOKED`. */
export const MEETING_BOOKED = "MEETING_BOOKED";
/** `CtaState.MEETING_CTA_READY` — ready to ask, and **not** itself a meeting. */
export const MEETING_CTA_READY = "MEETING_CTA_READY";

/**
 * The `ConversationState` value that mirrors a meeting-ready CTA.
 *
 * Used for the *narrowing* only, never as evidence: `CtaState.MEETING_CTA_READY` is banded
 * from the CTA score and does not travel on the queue row, so a page that narrowed on the
 * two meeting conversation states alone could never reach the "Ready to ask" group at all.
 * Widening the gate by this one value keeps that group reachable at one extra pair of reads
 * per ready conversation, and the `/cta` read is still what decides.
 */
export const CTA_READY = "CTA_READY";

/**
 * The action that asks for a meeting, in both persisted spellings.
 *
 * `REQUEST_MEETING` is the Candidate_Action the ranking recommends; `MEETING_REQUEST` is
 * the `ActionType` the execution tracker writes onto the ledger entry for it. One thing,
 * two vocabularies, and the timeline speaks the second — so both are named here rather
 * than one of them being quietly assumed.
 */
export const REQUEST_MEETING_ACTIONS: readonly string[] = ["REQUEST_MEETING", "MEETING_REQUEST"];

/** The `event_type` the learning loop writes an outreach outcome under. */
export const TIMELINE_OUTCOME_RECORDED = "OUTCOME_RECORDED";

/**
 * The ledger outcomes that mean the entry *stands*.
 *
 * The load-bearing filter of the timeline scan. A refused transition still writes an entry,
 * and its summary reads `conversation_state -> MEETING_BOOKED refused: …` — so a scan that
 * ignored `outcome` would read every rejected booking as a booking. `DUPLICATE` is excluded
 * too: the fact it duplicates has its own applied entry.
 */
export const AFFIRMING_OUTCOMES: readonly EventOutcome[] = ["APPLIED", "CORRECTED", "RECORDED"];

/** The four statuses, and the order the groups are presented in (design §9.3). */
export type MeetingStatus = "BOOKED" | "REQUESTED" | "READY" | "COMPLETED";

export const MEETING_STATUS_ORDER: readonly MeetingStatus[] = [
  "BOOKED",
  "REQUESTED",
  "READY",
  "COMPLETED",
];

/**
 * Which status wins when one prospect carries evidence for several.
 *
 * A booked meeting with a recorded `MEETING_BOOKED` outcome is a meeting that *happened*,
 * so it belongs under Completed rather than under Booked as well: one prospect is one
 * meeting and one meeting sits in one group, or the page would show the same meeting twice
 * and no count on it could be trusted. Higher wins.
 */
const STATUS_PRECEDENCE: Record<MeetingStatus, number> = {
  COMPLETED: 4,
  BOOKED: 3,
  REQUESTED: 2,
  READY: 1,
};

/** The group headings, in the design's own words. */
export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  BOOKED: "Booked",
  REQUESTED: "Requested, not confirmed",
  READY: "Ready to ask",
  COMPLETED: "Completed",
};

/**
 * What membership of each group actually claims.
 *
 * The "Ready to ask" note is the one that has to be there: that group holds no meeting at
 * all — it is a conversation the CTA read judged ready for the ask — and a heading in a
 * list of meeting groups would otherwise imply one exists.
 */
export const MEETING_STATUS_NOTES: Record<MeetingStatus, string> = {
  BOOKED: "A booking is recorded for these. Weez doesn't hold the time it was booked for.",
  REQUESTED: "A meeting has been asked for and nothing has confirmed it yet.",
  READY:
    "No meeting yet — Weez read these conversations as ready for the ask, so this is where one starts.",
  COMPLETED: "The thread recorded a booked meeting as its outcome.",
};

/** No meeting stands in this group right now. Said, rather than left as a gap. */
export const MEETING_GROUP_EMPTY = "Nothing stands here right now.";

/** Which read supplied a piece of evidence, for the line that cites it. */
export type MeetingEvidenceRead = "prospects" | "state" | "cta" | "timeline";

export const MEETING_EVIDENCE_READ_LABELS: Record<MeetingEvidenceRead, string> = {
  prospects: "the prospect list",
  state: "the state read",
  cta: "the CTA read",
  timeline: "the timeline",
};

/** One persisted value that establishes something about a meeting. */
export interface MeetingEvidence {
  /** Which of the four reads carried it. */
  read: MeetingEvidenceRead;
  /** The field or entry it sat in, named as the payload names it. */
  field: string;
  /** The persisted token, verbatim. Never a phrase composed here. */
  value: string;
  /** What it establishes. */
  establishes: MeetingStatus;
  /** The fact, where the read carries provenance for the value. `null` where it does not. */
  fact: ObservedFact | null;
  /** When, where the read carries an instant of its own. Never a meeting's start time. */
  at: string | null;
}

/** One meeting, as this page presents it. */
export interface Meeting {
  leadId: string;
  /** The queue row it came from — `name` and `company` are its `ObservedFact`s. */
  item: ProspectListItem;
  status: MeetingStatus;
  /** Every value that established something, in read order. Never empty. */
  evidence: MeetingEvidence[];
  /** The recorded outcome the timeline supplied, or `null` where it supplied none. */
  outcome: ObservedFact | null;
  /** The server's suggested ask, from `/cta`. `null` when the read carried none. */
  recommendedCta: string | null;
  /** From the backend status alone (R14.8). */
  needsPreparation: boolean;
  /** From the backend status plus `recommendedCta`, and from nothing else (R14.8). */
  needsFollowUp: boolean;
}

/**
 * The strings this page needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `ACTION_QUEUE_LABELS` and `ANALYTICS_LABELS`
 * established: page-scoped copy lives with the page, because `labels.ts` holds the
 * vocabularies more than one surface reads. The three sentences that *are* shared —
 * `MEETING_LABELS.noScheduledTimes`, `.countsUnavailable` and `.empty` — are taken from
 * there rather than restated here, and so is every absence about a prospect
 * (`GTM_ABSENCE_LABELS.prospectReadFailed`) and every piece of chrome
 * (`GTM_PAGE_LABELS.eyebrow`, `.retry`, `.backToProspects`, `GTM_UI_LABELS.refresh`,
 * `.computed`, `.recommendedCta`).
 */
export const MEETINGS_PAGE_LABELS = {
  pageTitle: "Meetings",

  // The counts panel. Named for what it is — a measurement over a window — rather than
  // for the meetings below it, which are a different read.
  countsTitle: "What Weez measured",
  countsWindowLabel: "Window",
  countsNote:
    "Both figures are added up from what Weez measured day by day over this window. A day it could not measure adds nothing rather than a zero.",

  // The list.
  groupsTitle: "Where each meeting stands",
  statusLabel: "Status",
  prospectLabel: "Prospect",
  companyLabel: "Company",
  outcomeLabel: "Recorded outcome",
  evidenceLabel: "What establishes this",
  needsPreparation: "Needs preparation",
  needsFollowUp: "Needs follow-up",

  /** The selection control, per meeting. `{prospect}` is substituted by the caller. */
  open: "Open {prospect} in Prospect Intelligence",
  openHint:
    "The thread, the signals and the state behind a meeting are on the prospect's own page.",

  // Failures. Each says which read failed, because the two are independent.
  loadFailed: "Couldn't read your meetings",
  refreshedToast: "Meetings refreshed",
  refreshFailedToast: "Couldn't refresh your meetings",

  /** Reached without a workspace. Nothing to retry — the route is missing its brand. */
  noWorkspace: "Open Meetings from inside a workspace, so it knows whose meetings to read.",

  // Live-region announcements about the page itself. Deliberately no count of meetings:
  // a number this page derived is the one thing R14.5 forbids.
  statusLoading: "Loading your meetings",
  statusRefreshing: "Refreshing your meetings",
} as const;

/** How many prospects the narrowing reads from. The design's own cap (§9.1). */
export const MEETINGS_PROSPECT_LIMIT = 100;

/** How much of each narrowed prospect's ledger is read, newest first. */
export const MEETINGS_TIMELINE_LIMIT = 50;

/**
 * The two measures this page presents, narrowed out of `AnalyticsMetricKey`.
 *
 * `Extract` rather than a fresh string union: the key type is the one the server pins, so a
 * renamed metric is a type error here rather than a figure that quietly stops arriving.
 */
export type MeetingCountKey = Extract<
  AnalyticsMetricKey,
  "meetings_booked" | "meetings_completed"
>;

/** The two figures, in the order it presents them. */
export const MEETINGS_COUNT_KEYS: readonly MeetingCountKey[] = [
  "meetings_booked",
  "meetings_completed",
];

/** One meeting's test hook, keyed by its prospect. */
export function meetingRowTestId(leadId: string): string {
  return `meeting-${leadId}`;
}

/** One status group's test hook. */
export function meetingGroupTestId(status: MeetingStatus): string {
  return `meeting-group-${status}`;
}

/** One count figure's test hook. */
export function meetingCountTestId(key: AnalyticsMetricKey): string {
  return `meeting-count-${key}`;
}

// ─── Reading a token out of a payload ─────────────────────────────────────────

/**
 * A fact's value, or `null` where the fact says nothing.
 *
 * `isUnknown` and a null value are the same answer here: a dimension nobody observed
 * establishes no meeting. Deliberately not `String(fact.value)` on an unknown fact — that
 * would let the literal string "null" become a token.
 */
function tokenOf(fact: ObservedFact | null | undefined): string | null {
  if (!fact || fact.isUnknown || fact.value == null) return null;
  const value = String(fact.value);
  return value.length > 0 ? value : null;
}

/**
 * Whether `text` names `token` as a whole token.
 *
 * Underscore-aware on purpose. `\b` treats `_` as a word character, so `\bMEETING_BOOKED\b`
 * would *not* match inside `OUTCOME_MEETING_BOOKED` — the exact place the token has to be
 * found. So the boundary here is "not a letter and not a digit", which matches
 * `OUTCOME_MEETING_BOOKED` and `FACT_MEETING_BOOKED` while still refusing
 * `MEETING_REQUESTED` for the token `MEETING_REQUEST`.
 */
export function namesToken(text: string | null | undefined, token: string): boolean {
  if (!text) return false;
  let from = 0;
  for (;;) {
    const at = text.indexOf(token, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : text[at - 1];
    const after = text[at + token.length] ?? "";
    if (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after)) return true;
    from = at + 1;
  }
}

/** What a meeting token establishes, or `null` when it is not one. */
function statusOfToken(token: string | null): MeetingStatus | null {
  if (token === MEETING_BOOKED) return "BOOKED";
  if (token === MEETING_REQUESTED) return "REQUESTED";
  if (token === MEETING_CTA_READY) return "READY";
  return null;
}

/**
 * Whether this queue row is worth three more reads (design §9.1).
 *
 * The gate, and only the gate: a row that passes it is *read*, not presented. What is
 * presented is decided by `meetingEvidenceFor()` over the three payloads that come back.
 */
export function isMeetingCandidate(item: ProspectListItem): boolean {
  const conversation = tokenOf(item.state.conversationState);
  const journey = tokenOf(item.journeyState);
  return (
    conversation === MEETING_BOOKED ||
    conversation === MEETING_REQUESTED ||
    conversation === CTA_READY ||
    journey === MEETING_BOOKED ||
    journey === MEETING_REQUESTED
  );
}

/**
 * The outcome class one `OUTCOME_RECORDED` entry recorded, or `null`.
 *
 * The class is the first token of the entry's own summary — `learning_loop._summary()`
 * writes `"{outcome_class} recorded on {channel}; …"` — because the row's free-form
 * `detail` JSON is deliberately not projected onto the timeline entry (R15.2). Anything
 * that is not an upper-case token is refused rather than guessed at.
 */
export function recordedOutcomeClass(entry: TimelineEntry): string | null {
  if (entry.eventType !== TIMELINE_OUTCOME_RECORDED) return null;
  if (!AFFIRMING_OUTCOMES.includes(entry.outcome)) return null;
  const [first] = entry.summary.trim().split(/\s+/);
  return first && /^[A-Z][A-Z0-9_]*$/.test(first) ? first : null;
}

/**
 * A timeline entry's own evidence, as an `ObservedFact` carrying `value`.
 *
 * Not a fabrication: the value is the persisted token and the provenance is the entry's
 * own `evidence_source_surface` and `evidence_observed_at`. Where the entry carries no
 * provenance the fact carries none either — `ObservedValue` then reads "Unknown" for the
 * surface and the instant, which is the truth. `isDerived` is false because nothing here
 * was computed, and `isStale` is false because staleness is the server's judgement and
 * this page has none to offer.
 */
function factFromEntry(entry: TimelineEntry, value: string): ObservedFact {
  return {
    value,
    isUnknown: false,
    sourceSurface: entry.evidenceSourceSurface,
    observedAt: entry.evidenceObservedAt,
    isStale: false,
    isDerived: false,
  };
}

/** The absence, as the one shape `ObservedValue` renders "Unknown" for. */
const ABSENT_FACT: ObservedFact = {
  value: null,
  isUnknown: true,
  sourceSurface: null,
  observedAt: null,
  isStale: false,
  isDerived: false,
};

/**
 * Every piece of Meeting_State_Evidence the four reads carried for one prospect (R14.1).
 *
 * This is design §9.2's table, in code, and it is the *only* thing that puts a row on this
 * page. Nine sources, in read order:
 *
 *   `/gtm/prospects`  `state.conversationState`, `journeyState`
 *   `/state`          `dimensions.conversation_state`, `journeyState`
 *   `/cta`            `ctaState`
 *   `/timeline`       a moved dimension's `newValue`, the observed value behind it,
 *                     an `OUTCOME_RECORDED` outcome class, and a meeting-request action
 *
 * The timeline scan only ever considers an entry whose `outcome` is in
 * `AFFIRMING_OUTCOMES`, which is what keeps a *refused* transition to `MEETING_BOOKED` —
 * an entry whose summary names the target it did not reach — from establishing a booking.
 */
export function meetingEvidenceFor(
  item: ProspectListItem,
  state: ProspectStateFull | null,
  cta: CTA | null,
  entries: readonly TimelineEntry[],
): MeetingEvidence[] {
  const found: MeetingEvidence[] = [];

  const push = (
    read: MeetingEvidenceRead,
    field: string,
    token: string | null,
    fact: ObservedFact | null,
    at: string | null,
  ) => {
    const establishes = statusOfToken(token);
    if (token === null || establishes === null) return;
    found.push({ read, field, value: token, establishes, fact, at });
  };

  // 1. The queue row. The same two fields the narrowing gate read, now as evidence.
  push(
    "prospects",
    "state.conversationState",
    tokenOf(item.state.conversationState),
    item.state.conversationState,
    item.state.conversationState.observedAt,
  );
  push("prospects", "journeyState", tokenOf(item.journeyState), item.journeyState, item.journeyState?.observedAt ?? null);

  // 2. The state read: the reconciled dimension, and the projection beside it.
  if (state) {
    const conversation = state.dimensions.conversation_state ?? null;
    push("state", "conversation_state", tokenOf(conversation), conversation, conversation?.observedAt ?? null);
    push("state", "journeyState", tokenOf(state.journeyState), state.journeyState, state.journeyState.observedAt);
  }

  // 3. The CTA read. A banded projection with no surface of its own, so no fact — its
  //    instant is when it was computed, which is not when anything was observed.
  if (cta) {
    push("cta", "ctaState", cta.ctaState, null, cta.computedAt);
  }

  // 4. The ledger. Four shapes, all of them refused unless the entry stands.
  for (const entry of entries) {
    if (!AFFIRMING_OUTCOMES.includes(entry.outcome)) continue;

    // A moved dimension — including one a signal moved — reports its new value.
    const moved = entry.newValue;
    if (moved && statusOfToken(moved)) {
      push("timeline", entry.dimension ?? entry.eventType, moved, factFromEntry(entry, moved), entry.eventAt);
    }

    // The observed value the reconciler applied, where it names a meeting itself. This is
    // the `FACT_MEETING_BOOKED` path: a booking observed on a calendar surface.
    const observed = entry.evidenceObservedValue;
    if (observed && statusOfToken(observed) && observed !== moved) {
      push("timeline", "evidenceObservedValue", observed, factFromEntry(entry, observed), entry.eventAt);
    }

    // A recorded outreach outcome of `MEETING_BOOKED` is a meeting that happened.
    const outcomeClass = recordedOutcomeClass(entry);
    if (outcomeClass === MEETING_BOOKED) {
      found.push({
        read: "timeline",
        field: TIMELINE_OUTCOME_RECORDED,
        value: outcomeClass,
        establishes: "COMPLETED",
        fact: factFromEntry(entry, outcomeClass),
        at: entry.eventAt,
      });
    }

    // The meeting ask, as the operator's own recorded action.
    if (entry.relatedActionId) {
      const named = REQUEST_MEETING_ACTIONS.find((action) => namesToken(entry.summary, action));
      if (named) {
        found.push({
          read: "timeline",
          field: entry.eventType,
          value: named,
          establishes: "REQUESTED",
          fact: factFromEntry(entry, named),
          at: entry.eventAt,
        });
      }
    }
  }

  return found;
}

/** The status the evidence adds up to, or `null` when there is none. */
export function statusFromEvidence(evidence: readonly MeetingEvidence[]): MeetingStatus | null {
  let winner: MeetingStatus | null = null;
  for (const item of evidence) {
    if (winner === null || STATUS_PRECEDENCE[item.establishes] > STATUS_PRECEDENCE[winner]) {
      winner = item.establishes;
    }
  }
  return winner;
}

/**
 * One prospect's four payloads, as a meeting or as nothing.
 *
 * Preparation and follow-up come from the status and `recommendedCta` and from nowhere
 * else (R14.8). `"NONE"` is the server's own way of saying there is nothing to ask —
 * `RECOMMENDED_CTA_LABEL` reads it as "Nothing to ask — the meeting is booked" — so it does
 * not raise a follow-up flag on a booked meeting. Neither flag is ever inferred from a
 * date, because there is no date.
 */
export function meetingFrom(
  item: ProspectListItem,
  state: ProspectStateFull | null,
  cta: CTA | null,
  entries: readonly TimelineEntry[],
): Meeting | null {
  const evidence = meetingEvidenceFor(item, state, cta, entries);
  const status = statusFromEvidence(evidence);
  if (status === null) return null;

  // The newest recorded outcome the ledger holds, whatever class it is: what the timeline
  // supplies, not what this page would prefer it said. The entries are read newest-first.
  let outcome: ObservedFact | null = null;
  for (const entry of entries) {
    const outcomeClass = recordedOutcomeClass(entry);
    if (outcomeClass) {
      outcome = factFromEntry(entry, outcomeClass);
      break;
    }
  }

  const recommendedCta = cta?.recommendedCta ?? null;
  const asks = recommendedCta !== null && recommendedCta !== "NONE";

  return {
    leadId: item.leadId,
    item,
    status,
    evidence,
    outcome,
    recommendedCta,
    needsPreparation: status === "READY",
    needsFollowUp: status === "REQUESTED" || (status === "BOOKED" && asks),
  };
}

/**
 * One metric, summed across the day rows the read returned, or `null` (R14.3, design §9.3).
 *
 * `null` and `0` are different answers and the whole function exists to keep them apart. A
 * day whose row does not carry the key contributes nothing — not a zero — so a window in
 * which the metric was never computable sums to `null` and the caller renders
 * `MEETING_LABELS.countsUnavailable`. A window in which it was computable and measured
 * nothing sums to `0`, and `0` renders as `0`.
 *
 * `hasMetric()` is the Analytics page's own presence test, imported. `row.metrics[key] ?? 0`
 * would collapse both cases into the second one, which is the mistake this page and that
 * one both exist to avoid.
 */
export function sumMetric(
  rows: readonly AnalyticsDayRow[],
  key: AnalyticsMetricKey,
): number | null {
  let total: number | null = null;
  for (const row of rows) {
    if (!hasMetric(row, key)) continue;
    const metric = row.metrics[key];
    if (metric === undefined) continue;
    total = (total ?? 0) + metric.count;
  }
  return total;
}

// ─── Chrome ───────────────────────────────────────────────────────────────────

/** A small labelled chip. Decoration; the text beside it carries the meaning. */
function Chip({ tone = "zinc", children }: { tone?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE[tone] ?? TONE.zinc,
      )}
    >
      {children}
    </span>
  );
}

/** The page's identity mark, in the amber key the sidebar's Meetings entry uses. */
function MeetingsMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm",
        className,
      )}
    >
      <CalendarCheck className="h-4 w-4" aria-hidden="true" />
    </div>
  );
}

// ─── One count figure ─────────────────────────────────────────────────────────

interface CountFigureProps {
  metricKey: AnalyticsMetricKey;
  /** The sum, or `null` when no returned day carried the metric. */
  total: number | null;
}

/**
 * One of the two figures, or the sentence that stands in for it.
 *
 * A measured `0` renders `0`. An absent metric renders `MEETING_LABELS.countsUnavailable`
 * and never a number — the same sentence covers a failed analytics read, because the
 * reader's position is identical either way: there is no figure to show, and the meetings
 * below stand regardless (design §9.3).
 */
function CountFigure({ metricKey, total }: CountFigureProps) {
  const label = ANALYTICS_METRIC_LABELS[metricKey];
  return (
    <div
      data-testid={meetingCountTestId(metricKey)}
      data-metric-state={total === null ? "absent" : "measured"}
      className="min-w-0 rounded-lg border border-zinc-100 bg-white/70 px-3.5 py-2.5"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</p>
      {total === null ? (
        <p className="mt-1 max-w-[60ch] text-[11.5px] leading-relaxed text-slate-500">
          {MEETING_LABELS.countsUnavailable}
        </p>
      ) : (
        <p className="mt-0.5 text-lg font-semibold leading-none tabular-nums text-zinc-900">
          {total}
        </p>
      )}
    </div>
  );
}

// ─── One meeting ──────────────────────────────────────────────────────────────

interface MeetingCardProps {
  meeting: Meeting;
  onOpen: () => void;
}

/**
 * One meeting: its status, its prospect, its company, its recorded outcome (R14.6).
 *
 * Every one of the four goes through `ObservedValue`, so an absent value reads "Unknown"
 * with the screen-reader note that says why, rather than as a dash or a blank. The status
 * is rendered from the fact that *established* it where one carries provenance — a booking
 * read off a surface says which surface and when it was seen — and the evidence lines below
 * cite each persisted value by name, which is what makes the row checkable against the
 * record rather than a claim the page makes.
 *
 * The selection control is a real `<button>` beside the facts rather than around them: a
 * `<button>` may only hold phrasing content, and the facts are definition groups.
 */
function MeetingCard({ meeting, onOpen }: MeetingCardProps) {
  const { item, status, evidence } = meeting;

  // The fact behind the status, preferring one with provenance. Where no read carried any
  // — a `/cta` band, for instance — the status still shows, and the evidence line says
  // which read it came from.
  const statusFact = evidence.find((entry) => entry.establishes === status && entry.fact)?.fact ?? null;
  const statusToken = evidence.find((entry) => entry.establishes === status)?.value ?? null;

  const prospect = tokenOf(item.name);
  const openLabel = MEETINGS_PAGE_LABELS.open.replace(
    "{prospect}",
    prospect ?? GTM_UI_LABELS.unavailableHeading,
  );

  return (
    <li
      data-testid={meetingRowTestId(meeting.leadId)}
      data-status={status}
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={statusToken ? STATE_TONE[statusToken] ?? "amber" : "amber"}>
          {MEETING_STATUS_LABELS[status]}
        </Chip>
        {meeting.needsPreparation && (
          <Chip tone="sky">{MEETINGS_PAGE_LABELS.needsPreparation}</Chip>
        )}
        {meeting.needsFollowUp && <Chip tone="amber">{MEETINGS_PAGE_LABELS.needsFollowUp}</Chip>}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ObservedValue
          label={MEETINGS_PAGE_LABELS.prospectLabel}
          fact={item.name}
          variant="inline"
          hideProvenance
        />
        <ObservedValue
          label={MEETINGS_PAGE_LABELS.companyLabel}
          fact={item.company}
          variant="inline"
          hideProvenance
        />
        {/* The status, as the fact that established it. `ABSENT_FACT` where no read
            carried one, which reads "Unknown" rather than implying a reading. */}
        <ObservedValue
          label={MEETINGS_PAGE_LABELS.statusLabel}
          fact={statusFact ?? ABSENT_FACT}
          variant="inline"
        />
        {/* The recorded outcome, where the timeline supplied one (R14.6). */}
        <ObservedValue
          label={MEETINGS_PAGE_LABELS.outcomeLabel}
          fact={meeting.outcome ?? ABSENT_FACT}
          variant="inline"
        />
      </div>

      {meeting.recommendedCta && (
        <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
          <span className="font-semibold text-zinc-800">{GTM_UI_LABELS.recommendedCta}: </span>
          {RECOMMENDED_CTA_LABEL[meeting.recommendedCta] ?? meeting.recommendedCta}
        </p>
      )}

      {/* Every value that put this row here, cited by the read it came from. */}
      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {MEETINGS_PAGE_LABELS.evidenceLabel}
        </p>
        <ul className="mt-1 space-y-0.5">
          {evidence.map((entry, index) => (
            <li
              key={`${entry.read}-${entry.field}-${entry.value}-${index}`}
              data-evidence-value={entry.value}
              data-evidence-read={entry.read}
              className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-relaxed text-slate-600"
            >
              <span className="font-semibold text-zinc-800" title={entry.value}>
                {STATE_LABEL[entry.value] ?? entry.value}
              </span>
              <span className="text-slate-500">
                {entry.field} · {MEETING_EVIDENCE_READ_LABELS[entry.read]}
              </span>
              {entry.at && (
                <time dateTime={entry.at} title={absTime(entry.at)} className="text-slate-500">
                  {relTime(entry.at)}
                </time>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
          onClick={onOpen}
        >
          {openLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

// ─── One status group ─────────────────────────────────────────────────────────

interface MeetingGroupProps {
  status: MeetingStatus;
  meetings: readonly Meeting[];
  onOpen: (meeting: Meeting) => void;
}

/**
 * One of the four groups (design §9.3).
 *
 * All four render whenever the page holds any meeting at all, in the declared order, with
 * an empty one saying so — the order is the page's whole organising idea, and a group that
 * vanished when it emptied would leave a reader unable to tell "nothing is booked" from
 * "there is no such thing as booked". Deliberately no count in the heading: a tally of
 * these rows is a meeting count this page derived (R14.5).
 */
function MeetingGroup({ status, meetings, onOpen }: MeetingGroupProps) {
  return (
    <section
      data-testid={meetingGroupTestId(status)}
      data-status={status}
      className="mt-5 first:mt-0"
    >
      <h3 className="text-[12px] font-bold uppercase tracking-[0.15em] text-zinc-500">
        {MEETING_STATUS_LABELS[status]}
      </h3>
      <p className="mt-1 max-w-[80ch] text-[11.5px] leading-relaxed text-slate-500">
        {MEETING_STATUS_NOTES[status]}
      </p>
      {meetings.length === 0 ? (
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{MEETING_GROUP_EMPTY}</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.leadId}
              meeting={meeting}
              onOpen={() => onOpen(meeting)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Loading placeholder, in the page's real geometry ─────────────────────────

function MeetingsSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true">
      <span className="sr-only">{MEETINGS_PAGE_LABELS.statusLoading}</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="space-y-2 rounded-lg border border-zinc-100 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

// ─── The page ─────────────────────────────────────────────────────────────────

export default function Meetings() {
  // The space is the brand: the same id the whole GTM layer keys on.
  const { spaceId } = useParams<{ spaceId: string }>();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const countsTitleId = useId();
  const groupsTitleId = useId();

  const brandId = spaceId ?? "";
  const days = readRangeParam(search.get("days"));

  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A narrowed prospect whose own three reads failed. Never a page failure. */
  const [partial, setPartial] = useState(false);

  const [analytics, setAnalytics] = useState<DailyAnalytics | null>(null);

  // The balance, in chrome, from the provider that already wraps `Routes`. This page
  // spends nothing, so there is nothing to refresh it after.
  const { balance } = useCredits();

  /**
   * The monotonic request counter the sibling pages use. A response holding a superseded
   * ticket is dropped rather than allowed to overwrite a newer one.
   */
  const reqRef = useRef(0);
  const countsRef = useRef(0);

  /**
   * The meeting list: one queue read, then three reads per narrowed prospect (R14.2).
   *
   * `Promise.allSettled` per prospect, because one prospect's `/state` can 404 — a
   * conversation can carry `MEETING_BOOKED` before the state engine has formed any belief
   * about the lead — and losing the whole page over one lead's missing belief would be
   * worse than showing the rest and saying one read failed. A prospect whose three reads
   * all fail still has the queue row's own two fields, which is real evidence from the
   * same server.
   */
  const loadMeetings = useCallback(
    async (force: boolean) => {
      if (!brandId) {
        setLoading(false);
        return;
      }
      const my = ++reqRef.current;
      setError(null);
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        const page = await gtmAPI.listProspects(brandId, { limit: MEETINGS_PROSPECT_LIMIT });
        if (my !== reqRef.current) return;

        const candidates = page.items.filter(isMeetingCandidate);
        const read = await Promise.all(
          candidates.map(async (item) => {
            const [state, cta, timeline] = await Promise.allSettled([
              gtmAPI.getProspectState(brandId, item.leadId),
              gtmAPI.getCTA(brandId, item.leadId),
              gtmAPI.getTimeline(brandId, item.leadId, {
                limit: MEETINGS_TIMELINE_LIMIT,
                newestFirst: true,
              }),
            ]);
            return { item, state, cta, timeline };
          }),
        );
        if (my !== reqRef.current) return;

        let anyFailed = false;
        const next: Meeting[] = [];
        for (const { item, state, cta, timeline } of read) {
          if (
            state.status === "rejected" ||
            cta.status === "rejected" ||
            timeline.status === "rejected"
          ) {
            anyFailed = true;
          }
          const meeting = meetingFrom(
            item,
            state.status === "fulfilled" ? state.value : null,
            cta.status === "fulfilled" ? cta.value : null,
            timeline.status === "fulfilled" ? timeline.value.entries : [],
          );
          if (meeting) next.push(meeting);
        }

        setMeetings(next);
        setPartial(anyFailed);
        if (force) toast.success(MEETINGS_PAGE_LABELS.refreshedToast);
      } catch (e) {
        if (my !== reqRef.current) return;
        setError(e instanceof Error ? e.message : MEETINGS_PAGE_LABELS.loadFailed);
        if (force) toast.error(MEETINGS_PAGE_LABELS.refreshFailedToast);
        else setMeetings(null);
      } finally {
        if (my === reqRef.current) {
          if (force) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [brandId],
  );

  /**
   * The two counts, over the selected window (R14.3).
   *
   * Its own read with its own failure, because the counts and the meetings are independent:
   * a failed analytics read leaves `analytics` null, both figures fall back to
   * `MEETING_LABELS.countsUnavailable`, and the list below is untouched — which is what
   * that sentence promises the reader.
   */
  const loadCounts = useCallback(async () => {
    if (!brandId) return;
    const my = ++countsRef.current;
    try {
      const payload = await gtmAPI.getDailyAnalytics(brandId, { days });
      if (my !== countsRef.current) return;
      setAnalytics(payload);
    } catch {
      if (my !== countsRef.current) return;
      setAnalytics(null);
    }
  }, [brandId, days]);

  useEffect(() => {
    void loadMeetings(false);
  }, [loadMeetings]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  /** The window, written to the URL so the view is linkable and Back works. */
  const onRange = useCallback(
    (next: number) => {
      const params = new URLSearchParams(search);
      params.set("days", String(next));
      setSearch(params);
    },
    [search, setSearch],
  );

  /** The two figures. `null` for a metric no returned day carried, and for a failed read. */
  const totals = useMemo<Record<MeetingCountKey, number | null>>(() => {
    const rows = analytics?.rows ?? [];
    return {
      meetings_booked: sumMetric(rows, "meetings_booked"),
      meetings_completed: sumMetric(rows, "meetings_completed"),
    };
  }, [analytics]);

  /** The four groups, in the declared order (design §9.3). */
  const grouped = useMemo(() => {
    const held = meetings ?? [];
    return MEETING_STATUS_ORDER.map((status) => ({
      status,
      meetings: held.filter((meeting) => meeting.status === status),
    }));
  }, [meetings]);

  const onOpen = useCallback(
    (meeting: Meeting) => {
      // One navigation, to the dossier, with this meeting's prospect selected (R14.10).
      navigate(prospectRoute(brandId, meeting.leadId));
    },
    [brandId, navigate],
  );

  /**
   * What the live region says.
   *
   * The page's own two states and nothing else. A count of the meetings on screen would be
   * a meeting count this page derived, which is the one number R14.5 forbids it.
   */
  const statusText = loading ? MEETINGS_PAGE_LABELS.statusLoading : refreshing ? MEETINGS_PAGE_LABELS.statusRefreshing : "";

  const held = meetings ?? [];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar
        spaceId={spaceId!}
        onNewChat={() => navigate("/spaces")}
        onSelectConversation={() => {}}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* The page's one `banner`. */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <MeetingsMark className="h-9 w-9 ring-2 ring-amber-100" />
            <div className="min-w-0 leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {GTM_PAGE_LABELS.eyebrow}
              </span>
              {/* The page's single `<h1>`, present in every state. */}
              <h1 className="truncate text-sm font-semibold text-zinc-900">
                {MEETINGS_PAGE_LABELS.pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <p
              role="status"
              aria-live="polite"
              className="hidden max-w-[22rem] truncate text-[11.5px] font-medium text-slate-500 sm:block"
            >
              {refreshing && (
                <Loader2
                  className="mr-1.5 inline h-3 w-3 animate-spin align-[-1px]"
                  aria-hidden="true"
                />
              )}
              {statusText}
            </p>
            <CreditBalanceBadge balance={balance} className="hidden sm:inline-flex" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={() => {
                void loadMeetings(true);
                void loadCounts();
              }}
              disabled={refreshing}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{GTM_UI_LABELS.refresh}</span>
            </Button>
            <Button
              type="button"
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

        {/* The content region, as the page's one `main` landmark. */}
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] space-y-4 px-6 pb-10 pt-6 lg:px-8">
            {!brandId ? (
              // Nothing to retry: the route is missing the workspace it needs.
              <Alert>
                <AlertTitle as="h2">{MEETINGS_PAGE_LABELS.loadFailed}</AlertTitle>
                <AlertDescription>{MEETINGS_PAGE_LABELS.noWorkspace}</AlertDescription>
              </Alert>
            ) : (
              <>
                {/* ── The counts, from the Analytics_Endpoint and from nowhere else ── */}
                <section
                  aria-labelledby={countsTitleId}
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 id={countsTitleId} className="text-sm font-semibold text-zinc-900">
                        {MEETINGS_PAGE_LABELS.countsTitle}
                      </h2>
                      <p className="mt-1 max-w-[70ch] text-[11px] leading-relaxed text-slate-500">
                        {MEETINGS_PAGE_LABELS.countsNote}
                      </p>
                      {analytics && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {GTM_UI_LABELS.computed}
                          {": "}
                          {analytics.computedAt ? (
                            <time
                              dateTime={analytics.computedAt}
                              title={absTime(analytics.computedAt)}
                            >
                              {relTime(analytics.computedAt)}
                            </time>
                          ) : (
                            GTM_UI_LABELS.unavailableHeading
                          )}
                        </p>
                      )}
                    </div>

                    {/* The window. Four real buttons with `aria-pressed`, so the range in
                        view is announced rather than only shown as a filled chip — and so
                        "widen the window", which `countsUnavailable` names as the next
                        step, is a control the reader actually has. */}
                    <div
                      role="group"
                      aria-label={MEETINGS_PAGE_LABELS.countsWindowLabel}
                      className="flex shrink-0 flex-wrap items-center gap-1.5"
                    >
                      {ANALYTICS_RANGE_OPTIONS.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          size="sm"
                          variant={option === days ? "default" : "outline"}
                          aria-pressed={option === days}
                          onClick={() => onRange(option)}
                        >
                          {rangeOptionLabel(option)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {MEETINGS_COUNT_KEYS.map((key) => (
                      <CountFigure key={key} metricKey={key} total={totals[key]} />
                    ))}
                  </div>
                </section>

                {/* ── The meetings, grouped by where each one stands ── */}
                <section
                  aria-labelledby={groupsTitleId}
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <h2 id={groupsTitleId} className="text-sm font-semibold text-zinc-900">
                    {MEETINGS_PAGE_LABELS.groupsTitle}
                  </h2>
                  {/* Why there are groups and not times (R14.7). Rendered once, above them. */}
                  <p className="mt-1 max-w-[80ch] text-[12.5px] leading-relaxed text-slate-600">
                    {MEETING_LABELS.noScheduledTimes}
                  </p>
                  <p className="mt-1 max-w-[80ch] text-[11px] leading-relaxed text-slate-500">
                    {MEETINGS_PAGE_LABELS.openHint}
                  </p>

                  {loading && meetings === null ? (
                    <MeetingsSkeleton />
                  ) : error && meetings === null ? (
                    // Our failure, not an empty workspace — and it takes a retry (R18.5).
                    <Alert variant="destructive" className="mt-4">
                      <AlertTitle as="h3">{MEETINGS_PAGE_LABELS.loadFailed}</AlertTitle>
                      <AlertDescription className="mt-1 flex flex-wrap items-center gap-3">
                        <span className="text-[13px]">{error}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void loadMeetings(true)}
                        >
                          {GTM_PAGE_LABELS.retry}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {/* A failed refresh with meetings still held: the alert sits above
                          them and they stay. Stale-but-labelled beats empty. */}
                      {error && (
                        <Alert variant="destructive" className="mt-4">
                          <AlertDescription className="flex flex-wrap items-center gap-3">
                            <span className="text-[13px]">{error}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void loadMeetings(true)}
                            >
                              {GTM_PAGE_LABELS.retry}
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* One prospect's own reads failed. A narrower claim than the page
                          failing, and it is the sentence `labels.ts` already publishes for
                          exactly this gap. */}
                      {partial && (
                        <Alert className="mt-4">
                          <AlertDescription className="flex flex-wrap items-center gap-3">
                            <span className="text-[13px]">
                              {GTM_ABSENCE_LABELS.prospectReadFailed}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void loadMeetings(true)}
                            >
                              {GTM_PAGE_LABELS.retry}
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {held.length === 0 ? (
                        // No Meeting_State_Evidence anywhere in the workspace (R14.11).
                        <p className="mt-4 max-w-[70ch] text-[13px] leading-relaxed text-slate-600">
                          {MEETING_LABELS.empty}
                        </p>
                      ) : (
                        <div className="mt-4">
                          {grouped.map((group) => (
                            <MeetingGroup
                              key={group.status}
                              status={group.status}
                              meetings={group.meetings}
                              onOpen={onOpen}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
