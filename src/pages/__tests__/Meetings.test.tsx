// pages/__tests__/Meetings.test.tsx
//
// **Property 34 — Meetings presents real meetings and only meeting content.**
//
// One claim about the Meetings_Page, in the five parts R14 breaks it into:
//
//   1. nothing originating in the Demo_Data_Source reaches the screen        (R14.4)
//   2. every rendered meeting cites a persisted Meeting_State_Evidence value (R14.6)
//   3. every meeting sits under the group its status names, and the
//      scheduled-times statement is present above them                       (R14.7)
//   4. preparation and follow-up come from the backend status and the
//      recommended action, and from nothing else — never from an instant      (R14.8)
//   5. no buying-intent detail, no signal detail and no state history renders  (R14.9)
//
// ── Why the demo clause is checked by a tripwire rather than by a payload ──
//
// The Demo_Data_Source is `maxAPI`'s seeded half: `DEMO_SEEDS`, `demo_acc_*` and
// `demo_opp_*` identifiers and the `isSample` flag. Task 18.1 deleted the `maxAPI` import
// from this page, so those values have no route to the screen at all — which means the way
// to state R14.4 as a property is to leave the demo source *reachable* and generated, and
// assert that the page neither touches it nor prints any of it. `maxAPI.getWorkspace` is
// stubbed to record its own call and answer with a freshly drawn demo-shaped workspace, and
// every run asserts (a) it was never called and (b) not one of its drawn values appears
// anywhere in the rendered markup. A regression that re-added the import fails both.
//
// The generated GTM payloads deliberately carry *no* demo-shaped identifiers: a
// `demo_acc_*` company arriving from `GET /gtm/prospects` is the server's own value and
// rendering it would be correct, so planting one there would assert the opposite of R14.4.
//
// ── Why the refused transition is the load-bearing case ──
//
// A refused state transition still writes a ledger entry, and its summary names the target
// it did not reach — `conversation_state -> MEETING_BOOKED refused: …`. A timeline scan
// that ignored `outcome` would therefore read every rejected booking as a booking. The
// `refusedOnly` lead the generator draws is narrowed *in* (its list-payload conversation
// state is `CTA_READY`, so the page spends the three reads on it) and then carries nothing
// but refused entries — one of each of the four timeline shapes. It must establish nothing
// and render no row at all.
//
// ── Why the flags are checked twice, once without a clock ──
//
// R14.8 pins preparation and follow-up to the backend status plus `recommendedCta`. The
// first property checks each flag against that rule directly, including the `"NONE"` arm —
// the server's own "nothing to ask", which must not raise a follow-up on a booked meeting.
// The second mounts the same statuses and asks twice with **every instant in the payload
// moved** — years into the past, years into the future — and asserts the flags are
// identical. There is no scheduled start anywhere in the GTM tables, so a flag that moved
// when a timestamp moved would be this page inventing a schedule out of an observation
// time, which is the specific mistake R14.7 and R14.8 exist to prevent.
//
// ── What "only meeting content" is checked against ──
//
// Every payload field this page has no business rendering carries a `withheld-` marker:
// the state read's flags, its `buying_stage` dimension, its display summary, each ledger
// entry's signal id, evidence id, recommendation id and its whole free-text summary. One
// assertion — no `withheld-` anywhere in the markup — covers the buying-intent detail, the
// signal detail and the state history in the only way that matters, which is that none of
// their material is on the screen. Beside it, the eight GTM reads this page must not make
// are stubbed to record and throw, and the four dossier panel titles are asserted absent.
//
// ── Property-test hygiene these runs depend on ──
//
// 1. **Every query is scoped to its own render.** RTL binds both `screen` and the queries
//    on `render`'s return value to `document.body`, so a document-scoped query inside a
//    hundred-run property answers "what is in the document", not "what did this run
//    render". Everything below goes through `within(container)` or `container.querySelector`.
// 2. **Each run unmounts what it mounted, at the end of the run.** `cleanup()` in a
//    `finally`, not at the top of the next run: fast-check re-runs the predicate while
//    shrinking, and a tree left mounted by run N would be read by run N+1 — a
//    counterexample describing the harness rather than the page.
// 3. **A leak sentinel, checked inside every run.** `mounted()` counts the pages in the
//    document; it is 1 inside a run and 0 once the property is done.
// 4. **An explicit 60s timeout on every mounting test**, as the second argument — the
//    trailing options form is deprecated.
// 5. **At most four narrowed prospects per run.** A run costs `1 + 3×N + 1` requests, so
//    the draw is kept narrow and the run count high rather than the other way round.
//
// ── Stubs, and why each one ───────────────────────────────────────────────────
//
// The five sanctioned reads are stubbed at the client so the generated payloads are the
// subject; the eight unsanctioned ones are stubbed to fail loudly. `ConversationSidebar`,
// `sonner` and `useCredits` are existing chrome the page mounts unchanged: the sidebar
// reaches for auth and the network, the balance comes from a provider this route is not
// wrapped in here, and neither carries anything this file makes a claim about.

import { cleanup, render, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

// ─── Harness state, hoisted above the module mocks that read it ───────────────

const BRAND = "space-meetings";
/** The window the page is mounted for. The counts are summed over it. */
const DAYS = 7;

const harness = vi.hoisted(() => ({
  served: {
    prospects: [] as import("@/services/gtmAPI").ProspectListItem[],
    /** Per lead. A `null` entry means that lead's read **rejects**. */
    state: new Map<string, import("@/services/gtmAPI").ProspectStateFull | null>(),
    cta: new Map<string, import("@/services/gtmAPI").CTA | null>(),
    timeline: new Map<string, import("@/services/gtmAPI").TimelinePage | null>(),
    /** `null` means the analytics read rejects, which is its own arm of R14.3. */
    analytics: null as import("@/services/gtmAPI").DailyAnalytics | null,
    /** What the Demo_Data_Source would hand over if anything asked it. */
    demoWorkspace: null as unknown,
  },
  calls: {
    prospects: [] as number[],
    state: [] as string[],
    cta: [] as string[],
    timeline: [] as string[],
    analytics: [] as number[],
    /** Every read this page is not allowed to make, by name, in the order attempted. */
    forbidden: [] as string[],
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/ConversationSidebar", () => ({
  // The leak sentinel counts these: one per mounted page, whatever state the page is in.
  default: () => <nav data-testid="meetings-sidebar" aria-label="Conversations" />,
}));

vi.mock("@/hooks/useCredits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useCredits")>();
  const unread: import("@/hooks/useCredits").CreditsState = {
    credits: null,
    balance: null,
    loading: false,
    error: null,
    refresh: async () => null,
    priceFor: () => null,
  };
  return { ...actual, useCredits: () => unread };
});

vi.mock("@/services/gtmAPI", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/gtmAPI")>();

  /** A read this page must not make. Recorded, then failed loudly. */
  const refuse = (name: string) => async () => {
    harness.calls.forbidden.push(name);
    throw new Error(`harness: ${name} is not a read the Meetings page may make`);
  };

  // The real client, with the five sanctioned reads served and the rest of the GTM surface
  // left real — so a read that reappears reaches the network and fails rather than
  // resolving to something plausible.
  const stub = {
    ...actual.default,

    listProspects: async (
      _brandId: string,
      query: import("@/services/gtmAPI").ProspectListQuery = {},
    ) => {
      harness.calls.prospects.push(query.limit ?? 0);
      return { items: harness.served.prospects, nextCursor: null, hasMore: false };
    },

    getProspectState: async (_brandId: string, leadId: string) => {
      harness.calls.state.push(leadId);
      const payload = harness.served.state.get(leadId);
      if (!payload) throw new Error(`harness: no state served for ${leadId}`);
      return payload;
    },

    getCTA: async (_brandId: string, leadId: string) => {
      harness.calls.cta.push(leadId);
      const payload = harness.served.cta.get(leadId);
      if (!payload) throw new Error(`harness: no CTA served for ${leadId}`);
      return payload;
    },

    getTimeline: async (_brandId: string, leadId: string) => {
      harness.calls.timeline.push(leadId);
      const payload = harness.served.timeline.get(leadId);
      if (!payload) throw new Error(`harness: no timeline served for ${leadId}`);
      return payload;
    },

    getDailyAnalytics: async (
      _brandId: string,
      query: import("@/services/gtmAPI").DailyAnalyticsQuery = {},
    ) => {
      harness.calls.analytics.push(query.days ?? 0);
      if (!harness.served.analytics) throw new Error("harness: the analytics read refused");
      return harness.served.analytics;
    },

    // The dossier's own reads, the two feed reads and the debug view. None of them belongs
    // to this page, and the buying-intent detail, the signal detail and the state history
    // R14.9 excludes are exactly what the first three of them carry.
    getProspect: refuse("getProspect"),
    getSignals: refuse("getSignals"),
    getStateHistory: refuse("getStateHistory"),
    getNextBestAction: refuse("getNextBestAction"),
    getActionQueue: refuse("getActionQueue"),
    getAttentionFeed: refuse("getAttentionFeed"),
    getDashboard: refuse("getDashboard"),
    getDebugView: refuse("getDebugView"),
  };
  return { ...actual, gtmAPI: stub, default: stub };
});

// The Demo_Data_Source, left reachable so R14.4 has something to be true *about*. It is
// loaded either way — `ninnaAPI` imports it — so the factory runs and the tripwire is live.
vi.mock("@/services/maxAPI", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/maxAPI")>();
  const stub = {
    ...actual.maxAPI,
    getWorkspace: async () => {
      harness.calls.forbidden.push("maxAPI.getWorkspace");
      return harness.served.demoWorkspace as never;
    },
  };
  return { ...actual, maxAPI: stub, default: stub };
});

import Meetings, {
  AFFIRMING_OUTCOMES,
  CTA_READY,
  MEETINGS_COUNT_KEYS,
  MEETINGS_PAGE_LABELS,
  MEETINGS_PROSPECT_LIMIT,
  MEETING_BOOKED,
  MEETING_CTA_READY,
  MEETING_EVIDENCE_READ_LABELS,
  MEETING_GROUP_EMPTY,
  MEETING_REQUESTED,
  MEETING_STATUS_LABELS,
  MEETING_STATUS_NOTES,
  MEETING_STATUS_ORDER,
  REQUEST_MEETING_ACTIONS,
  TIMELINE_OUTCOME_RECORDED,
  isMeetingCandidate,
  meetingCountTestId,
  meetingFrom,
  meetingGroupTestId,
  meetingRowTestId,
  sumMetric,
  type Meeting,
  type MeetingStatus,
} from "../Meetings";
import { BUYING_STAGE_PANEL_LABELS } from "@/components/gtm/BuyingStagePanel";
import { INTENT_PANEL_LABELS } from "@/components/gtm/IntentPanel";
import { SIGNAL_LIST_LABELS } from "@/components/gtm/SignalList";
import { STATE_HISTORY_LABELS } from "@/components/gtm/StateHistoryPanel";
import {
  GTM_UI_LABELS,
  MEETING_LABELS,
  RECOMMENDED_CTA_LABEL,
  STATE_LABEL,
} from "@/components/gtm/labels";
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "@/components/gtm/ObservedValue";
import type {
  AnalyticsMetric,
  CTA,
  CtaState,
  DailyAnalytics,
  DerivedScore,
  EventOutcome,
  ObservedFact,
  ProspectListItem,
  ProspectStateFull,
  TimelineEntry,
  TimelinePage,
} from "@/services/gtmAPI";

// ─── The vocabularies the assertions are made against ─────────────────────────

/**
 * Every token that may appear as a rendered meeting's evidence.
 *
 * Composed from the page's own exported constants rather than restated, so a fifth token
 * cannot be added to the page and pass unnoticed here.
 */
const MEETING_EVIDENCE_TOKENS: readonly string[] = [
  MEETING_BOOKED,
  MEETING_REQUESTED,
  MEETING_CTA_READY,
  ...REQUEST_MEETING_ACTIONS,
];

/** The four reads a citation may name. */
const EVIDENCE_READS = Object.keys(MEETING_EVIDENCE_READ_LABELS);

/** Outcomes that mean the ledger entry does **not** stand. */
const REFUSED_OUTCOMES: readonly EventOutcome[] = [
  "REJECTED_NO_EVIDENCE",
  "REJECTED_STALE",
  "REJECTED_ILLEGAL",
  "DUPLICATE",
];

const ALL_OUTCOMES: readonly EventOutcome[] = [...AFFIRMING_OUTCOMES, ...REFUSED_OUTCOMES];

/** The four dossier regions R14.9 keeps off this page, by the heading each one prints. */
const EXCLUDED_REGION_TITLES: readonly string[] = [
  BUYING_STAGE_PANEL_LABELS.title,
  INTENT_PANEL_LABELS.title,
  SIGNAL_LIST_LABELS.title,
  STATE_HISTORY_LABELS.title,
];

/** Suggested asks, including the server's own "nothing to ask". */
const RECOMMENDED_CTAS: readonly (string | null)[] = [
  null,
  "NONE",
  "DIRECT_MEETING_ASK",
  "AWAIT_RESPONSE",
  "CONTINUE_WARMUP",
];

const CTA_STATES: readonly CtaState[] = [
  "NOT_READY",
  "SOFT_CTA_READY",
  "MEETING_CTA_READY",
  "MEETING_REQUESTED",
  "MEETING_BOOKED",
];

/** Conversation values the narrowing gate lets through, and two it does not. */
const LIST_CONVERSATIONS: readonly (string | null)[] = [
  MEETING_BOOKED,
  MEETING_REQUESTED,
  CTA_READY,
  "CONVERSATION_ACTIVE",
  "WAITING_FOR_REPLY",
  null,
];

const LIST_JOURNEYS: readonly (string | null)[] = [
  MEETING_BOOKED,
  MEETING_REQUESTED,
  "DISCOVERY",
  "CONVERSATION_ACTIVE",
  null,
];

// ─── Payload builders ─────────────────────────────────────────────────────────

const DISCLAIMER = "A prioritisation signal, not a predicted probability of conversion.";
/** 2024-05-01T09:00:00Z, the instant every drawn offset counts from. */
const BASE_MS = Date.UTC(2024, 4, 1, 9);
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function at(offsetHours: number, shiftMs = 0): string {
  return new Date(BASE_MS + offsetHours * HOUR_MS + shiftMs).toISOString();
}

function score(): DerivedScore {
  return { score: 50, scoreKind: "RECOMMENDATION_SCORE", scoreDisclaimer: DISCLAIMER, isDerived: true };
}

/** An observed fact, or the absence — `null` is a dimension nobody observed. */
function fact(value: string | null, observedAt: string | null): ObservedFact {
  return {
    value,
    isUnknown: value === null,
    sourceSurface: value === null ? null : "LINKEDIN_PROFILE_PAGE",
    observedAt: value === null ? null : observedAt,
    isStale: false,
    isDerived: false,
  };
}

/** One drawn ledger entry. `kind` is which of the four timeline shapes it takes. */
interface EntrySpec {
  kind: "moved" | "observed" | "outcome" | "action" | "noise";
  token: typeof MEETING_BOOKED | typeof MEETING_REQUESTED | typeof MEETING_CTA_READY;
  action: string;
  outcome: EventOutcome;
  offsetHours: number;
}

/** One drawn prospect, before it becomes four wire payloads. */
interface LeadSpec {
  id: number;
  named: boolean;
  /** `state.conversationState` on the list row — what the narrowing gate reads. */
  listConversation: string | null;
  listJourney: string | null;
  /** `dimensions.conversation_state` on the state read. `null` omits the dimension. */
  stateConversation: string | null;
  stateJourney: string | null;
  ctaState: CtaState;
  recommendedCta: string | null;
  entries: EntrySpec[];
  stateFails: boolean;
  ctaFails: boolean;
  timelineFails: boolean;
  /**
   * Narrowed in, and carrying nothing but refused entries. The load-bearing negative:
   * four refused ledger shapes, all naming `MEETING_BOOKED`, establishing nothing.
   */
  refusedOnly: boolean;
}

/** One prospect's four payloads, plus what the assertions need to know about them. */
interface Lead {
  spec: LeadSpec;
  item: ProspectListItem;
  /** `null` where the read rejects. */
  state: ProspectStateFull | null;
  cta: CTA | null;
  timeline: TimelinePage | null;
  /** Every instant these payloads carried. Nothing else may render as a time. */
  instants: Set<string>;
}

/** The four refused shapes, for a `refusedOnly` lead. One of each ledger branch. */
function refusedEntries(): EntrySpec[] {
  return [
    { kind: "moved", token: MEETING_BOOKED, action: "REQUEST_MEETING", outcome: "REJECTED_NO_EVIDENCE", offsetHours: 4 },
    { kind: "observed", token: MEETING_BOOKED, action: "REQUEST_MEETING", outcome: "REJECTED_STALE", offsetHours: 3 },
    { kind: "outcome", token: MEETING_BOOKED, action: "REQUEST_MEETING", outcome: "DUPLICATE", offsetHours: 2 },
    { kind: "action", token: MEETING_BOOKED, action: "REQUEST_MEETING", outcome: "REJECTED_ILLEGAL", offsetHours: 1 },
  ];
}

/**
 * One ledger entry.
 *
 * Every field this page has no business rendering carries a `withheld-` marker: the signal
 * id, the evidence id, the recommendation id, the actor and the whole free-text summary.
 * The summary is the interesting one — a refused transition's summary *names* the state it
 * did not reach, so a page that read summaries would surface `MEETING_BOOKED` from an entry
 * that established nothing.
 */
function buildEntry(spec: EntrySpec, id: number, index: number, shiftMs: number): TimelineEntry {
  const eventAt = at(spec.offsetHours, shiftMs);
  const stands = AFFIRMING_OUTCOMES.includes(spec.outcome);
  const marker = `withheld-summary-${id}-${index}`;

  const base = {
    eventId: `withheld-event-${id}-${index}`,
    eventAt,
    outcome: spec.outcome,
    dimension: null as string | null,
    priorValue: null as string | null,
    newValue: null as string | null,
    actorId: `withheld-actor-${id}`,
    actorType: "SYSTEM" as const,
    evidenceId: `withheld-evidence-${id}-${index}`,
    evidenceSourceSurface: "LINKEDIN_PROFILE_PAGE" as const,
    evidenceObservedValue: null as string | null,
    evidenceObservedAt: eventAt,
    evidenceConfidence: "HIGH" as const,
    relatedActionId: null as string | null,
    relatedMessageId: null,
    signalId: `withheld-signal-${id}-${index}`,
    recommendationId: `withheld-recommendation-${id}-${index}`,
  };

  switch (spec.kind) {
    // A moved dimension reports its new value. Refused, the summary still names it.
    case "moved":
      return {
        ...base,
        eventType: "STATE_CHANGED",
        dimension: "conversation_state",
        priorValue: "CONVERSATION_ACTIVE",
        newValue: spec.token,
        summary: `conversation_state -> ${spec.token}${stands ? "" : " refused"}: ${marker}`,
      };
    // The observed value the reconciler applied — the `FACT_MEETING_BOOKED` path.
    case "observed":
      return {
        ...base,
        eventType: "FACT_RECORDED",
        evidenceObservedValue: spec.token,
        summary: `FACT_${spec.token} observed: ${marker}`,
      };
    // A recorded outreach outcome. Its class is the first token of its own summary.
    case "outcome":
      return {
        ...base,
        eventType: TIMELINE_OUTCOME_RECORDED,
        summary: `${spec.token} recorded on LINKEDIN; ${marker}`,
      };
    // The meeting ask, as the operator's own recorded action.
    case "action":
      return {
        ...base,
        eventType: "ACTION_RECORDED",
        relatedActionId: `action-${id}-${index}`,
        summary: `${spec.action} requested on LINKEDIN; ${marker}`,
      };
    // Real ledger traffic that establishes nothing about a meeting.
    default:
      return {
        ...base,
        eventType: "MESSAGE_OBSERVED",
        dimension: "conversation_state",
        newValue: "CONVERSATION_ACTIVE",
        summary: `conversation_state -> CONVERSATION_ACTIVE: ${marker}`,
      };
  }
}

/**
 * One prospect's four payloads.
 *
 * `shiftMs` moves every instant in all four together, which is what the second property
 * varies: the statuses, the asks and the evidence are identical between two shifts, so a
 * flag that moves has been inferred from a clock.
 */
function buildLead(spec: LeadSpec, shiftMs = 0): Lead {
  const { id } = spec;
  const observedAt = at(0, shiftMs);
  const instants = new Set<string>();
  const note = (value: string | null) => {
    if (value) instants.add(value);
    return value;
  };
  note(observedAt);

  const item: ProspectListItem = {
    leadId: `lead-${id}`,
    profileId: null,
    profileUrl: null,
    name: fact(spec.named ? `Prospect-${id}` : null, observedAt),
    headline: fact(null, null),
    company: fact(spec.named ? `Company-${id}` : null, observedAt),
    score: score(),
    recommendedChannel: "LINKEDIN",
    confidence: "MEDIUM",
    recommendation: `withheld-recommendation-text-${id}`,
    activity: {
      score: score(),
      level: fact(null, null),
      observedAt: null,
      isStale: false,
      sourceSurface: null,
      components: {},
    },
    state: {
      relationshipState: fact("CONNECTED", observedAt),
      conversationState: fact(spec.listConversation, observedAt),
      conversationStage: fact(`withheld-stage-${id}`, observedAt),
      executionState: fact(null, null),
      activityLevel: fact(null, null),
      confirmationStatus: "NOT_APPLICABLE",
      displaySummary: `withheld-display-summary-${id}`,
      displaySummaryIsDerived: true,
    },
    nextActionType: null,
    updatedAt: observedAt,
    journeyState: spec.listJourney === null ? null : fact(spec.listJourney, observedAt),
  };

  const stateAt = at(1, shiftMs);
  const dimensions: Record<string, ObservedFact> = {
    // Material from the dossier's regions, present in the payload and never renderable.
    buying_stage: fact(`withheld-buying-stage-${id}`, stateAt),
    relationship_state: fact(`withheld-relationship-${id}`, stateAt),
  };
  if (spec.stateConversation !== null) {
    dimensions.conversation_state = fact(spec.stateConversation, note(stateAt));
  }

  const state: ProspectStateFull | null = spec.stateFails
    ? null
    : {
        leadId: item.leadId,
        stateVersion: 3,
        journeyState: fact(spec.stateJourney, spec.stateJourney === null ? null : note(stateAt)),
        stateConfidence: 61,
        stateFlags: [`withheld-flag-${id}`],
        dimensions,
        identity: { confidence: 70, verifiedAt: null, sourceSurface: null, observedAt: null },
        icp: {
          score: score(),
          confidence: 55,
          components: [],
          evaluatedAt: null,
          signalIds: [`withheld-icp-signal-${id}`],
          discoveryIcpPassed: null,
          discoveryCriteria: `withheld-icp-criteria-${id}`,
          discoveryAcvTier: null,
        },
        intents: [],
        channels: [],
        engagement: { count24h: 0, count7d: 0, count30d: 0, trend: "FLAT", evaluatedAt: null },
        buyingStage: { value: "EVALUATING", confidence: 50, signalIds: [], isDerived: true },
        timing: {
          lastMeaningfulSignalAt: null,
          signalFreshness: 40,
          urgency: 40,
          cooldownUntil: null,
          idealNextActionWindowStart: null,
          idealNextActionWindowEnd: null,
          withinBusinessHours: "UNKNOWN",
          activityTrendFlag: "UNKNOWN",
        },
        dimensionConfidence: {},
        doNotContact: fact(null, null),
        updatedAt: stateAt,
      };

  const ctaAt = at(2, shiftMs);
  const cta: CTA | null = spec.ctaFails
    ? null
    : {
        score: score(),
        ctaState: spec.ctaState,
        recommendedCta: spec.recommendedCta,
        decidedBy: `withheld-decided-by-${id}`,
        reasoning: [],
        computedAt: note(ctaAt),
      };

  // Newest first, which is the order the page asks for and the order `meetingFrom` reads
  // the recorded outcome in.
  const entries = spec.entries
    .map((entry, index) => buildEntry(entry, id, index, shiftMs))
    .sort((a, b) => b.eventAt.localeCompare(a.eventAt));
  entries.forEach((entry) => {
    note(entry.eventAt);
    note(entry.evidenceObservedAt);
  });

  const timeline: TimelinePage | null = spec.timelineFails
    ? null
    : { entries, nextCursor: null, hasMore: false };

  return { spec, item, state, cta, timeline, instants };
}

/** One drawn analytics window: the two counts, per day, in their three states. */
interface CountSpec {
  offset: number;
  booked: "absent" | "zero" | "counted";
  completed: "absent" | "zero" | "counted";
  count: number;
}

function buildMetric(count: number): AnalyticsMetric {
  return { count, leadIds: Array.from({ length: count }, (_, i) => `lead-count-${i}`), criteria: [], trend: null };
}

/**
 * The analytics payload the two figures are summed from.
 *
 * An `absent` measure is a **missing key** — assigned nowhere — because that is what the
 * route emits for a day it could not measure, and `sumMetric` treats it as contributing
 * nothing rather than a zero.
 */
function buildAnalytics(specs: CountSpec[]): DailyAnalytics {
  const rows = specs.map((spec) => {
    const date = new Date(Date.UTC(2024, 4, 1) + spec.offset * DAY_MS).toISOString().slice(0, 10);
    const metrics: DailyAnalytics["rows"][number]["metrics"] = {};
    if (spec.booked !== "absent") metrics.meetings_booked = buildMetric(spec.booked === "zero" ? 0 : spec.count);
    if (spec.completed !== "absent") {
      metrics.meetings_completed = buildMetric(spec.completed === "zero" ? 0 : spec.count);
    }
    return { date, metrics };
  });
  const dates = rows.map((row) => row.date).sort((a, b) => a.localeCompare(b));
  return {
    brandId: BRAND,
    days: DAYS,
    startDate: dates[0] ?? "",
    endDate: dates[dates.length - 1] ?? "",
    computedAt: at(0),
    rows,
  };
}

/**
 * What the Demo_Data_Source would answer with, and the values that must never appear.
 *
 * Shaped like the seeded half it stands for: `demo_acc_*` and `demo_opp_*` identifiers,
 * seed company and contact prose, and rows carrying `isSample`.
 */
interface DemoSpec {
  accounts: number[];
  companies: string[];
  contacts: string[];
}

function buildDemo(spec: DemoSpec): { workspace: unknown; values: string[] } {
  const accounts = spec.accounts.map((n, i) => ({
    id: `demo_acc_${n}`,
    company: spec.companies[i % spec.companies.length],
    status: "meeting",
    isSample: true,
  }));
  const opportunities = spec.accounts.map((n, i) => ({
    id: `demo_opp_${n}`,
    accountId: `demo_acc_${n}`,
    contact: spec.contacts[i % spec.contacts.length],
    tracking: { meetingBooked: true },
    isSample: true,
  }));
  return {
    workspace: {
      acvTier: "medium",
      accounts,
      contacts: spec.contacts.map((name, i) => ({ id: `demo_contact_${i}`, name })),
      opportunities,
      signals: [],
      briefs: {},
      insights: [],
      isDemo: true,
      isSample: true,
      metrics: {},
    },
    values: [
      ...accounts.map((account) => account.id),
      ...opportunities.map((opportunity) => opportunity.id),
      ...spec.companies,
      ...spec.contacts,
    ],
  };
}

/** Installs one run's payloads. Every call history is reset with them. */
function install(leads: Lead[], analytics: DailyAnalytics | null, demoWorkspace: unknown) {
  harness.served.prospects = leads.map((lead) => lead.item);
  harness.served.state = new Map(leads.map((lead) => [lead.item.leadId, lead.state]));
  harness.served.cta = new Map(leads.map((lead) => [lead.item.leadId, lead.cta]));
  harness.served.timeline = new Map(leads.map((lead) => [lead.item.leadId, lead.timeline]));
  harness.served.analytics = analytics;
  harness.served.demoWorkspace = demoWorkspace;
  harness.calls.prospects = [];
  harness.calls.state = [];
  harness.calls.cta = [];
  harness.calls.timeline = [];
  harness.calls.analytics = [];
  harness.calls.forbidden = [];
}

// ─── Generators ───────────────────────────────────────────────────────────────

const entrySpecArb: fc.Arbitrary<EntrySpec> = fc.record({
  kind: fc.constantFrom<EntrySpec["kind"]>("moved", "observed", "outcome", "action", "noise"),
  token: fc.constantFrom(MEETING_BOOKED, MEETING_REQUESTED, MEETING_CTA_READY),
  action: fc.constantFrom(...REQUEST_MEETING_ACTIONS),
  outcome: fc.constantFrom(...ALL_OUTCOMES),
  offsetHours: fc.integer({ min: 1, max: 40 }),
});

/**
 * One prospect.
 *
 * `refusedOnly` overrides the draw: the lead is narrowed in on its list payload and then
 * carries four refused entries and nothing else, which is the case that must render no row.
 * A failed read is drawn at one in five, because the page holds the queue row's own two
 * fields when the three follow-ups fail and that path has to be exercised.
 */
const leadSpecArb: fc.Arbitrary<LeadSpec> = fc
  .record({
    id: fc.integer({ min: 1, max: 20 }),
    named: fc.boolean(),
    listConversation: fc.constantFrom(...LIST_CONVERSATIONS),
    listJourney: fc.constantFrom(...LIST_JOURNEYS),
    stateConversation: fc.constantFrom(MEETING_BOOKED, MEETING_REQUESTED, "CONVERSATION_ACTIVE", null),
    stateJourney: fc.constantFrom(MEETING_BOOKED, MEETING_REQUESTED, "DISCOVERY", null),
    ctaState: fc.constantFrom(...CTA_STATES),
    recommendedCta: fc.constantFrom(...RECOMMENDED_CTAS),
    entries: fc.array(entrySpecArb, { maxLength: 3 }),
    stateFails: fc.nat({ max: 4 }).map((n) => n === 0),
    ctaFails: fc.nat({ max: 4 }).map((n) => n === 0),
    timelineFails: fc.nat({ max: 4 }).map((n) => n === 0),
    refusedOnly: fc.nat({ max: 3 }).map((n) => n === 0),
  })
  .map((spec) =>
    spec.refusedOnly
      ? {
          ...spec,
          listConversation: CTA_READY,
          listJourney: "DISCOVERY",
          stateConversation: "CONVERSATION_ACTIVE",
          stateJourney: "DISCOVERY",
          ctaState: "SOFT_CTA_READY" as CtaState,
          entries: refusedEntries(),
          stateFails: false,
          ctaFails: false,
          timelineFails: false,
        }
      : spec,
  );

/** At most four prospects: a run costs `1 + 3×N + 1` requests. */
const leadsArb = fc.uniqueArray(leadSpecArb, { selector: (spec) => spec.id, maxLength: 4 });

const countSpecArb: fc.Arbitrary<CountSpec> = fc.record({
  offset: fc.integer({ min: 0, max: 6 }),
  booked: fc.constantFrom<CountSpec["booked"]>("absent", "zero", "counted"),
  completed: fc.constantFrom<CountSpec["completed"]>("absent", "zero", "counted"),
  count: fc.integer({ min: 1, max: 4 }),
});

const analyticsArb = fc.uniqueArray(countSpecArb, { selector: (spec) => spec.offset, maxLength: 3 });

const demoArb: fc.Arbitrary<DemoSpec> = fc.record({
  accounts: fc.uniqueArray(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 3 }),
  companies: fc.uniqueArray(
    fc.constantFrom(
      "Brightloop Labs",
      "Northgate Analytics",
      "Sampleworks Robotics",
      "Vantage Freight",
      "Harbourline Health",
    ),
    { minLength: 1, maxLength: 3 },
  ),
  contacts: fc.uniqueArray(
    fc.constantFrom("Dana Seedman", "Marcus Sample", "Priya Demoseed", "Tolu Fixture"),
    { minLength: 1, maxLength: 2 },
  ),
});

// ─── Mounting and reading ─────────────────────────────────────────────────────

const norm = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** How many Meetings pages are in the document. A tree leaked from a previous run is 2. */
const mounted = () => document.querySelectorAll('[data-testid="meetings-sidebar"]').length;

/**
 * Mounts the page and waits for **both** reads to land.
 *
 * The groups replace the skeleton when the meeting read settles; the "Computed" line only
 * renders once the analytics payload is held, so waiting for it is what keeps a late
 * analytics resolution out of the next run.
 */
async function mountMeetings(waitForCounts = true): Promise<HTMLElement> {
  const { container } = render(
    <MemoryRouter initialEntries={[`/sales-workspace/${BRAND}?days=${DAYS}`]}>
      <Routes>
        <Route path="/sales-workspace/:spaceId" element={<Meetings />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => {
    const settled =
      within(container).queryByTestId(meetingGroupTestId("BOOKED")) !== null ||
      within(container).queryByText(MEETING_LABELS.empty) !== null;
    expect(settled).toBe(true);
  });

  if (waitForCounts) {
    await waitFor(() => expect(norm(container.textContent)).toContain(GTM_UI_LABELS.computed));
  }

  return container;
}

/** One `ObservedValue`'s rendered text, found through the label beside it. */
function labelled(row: Element, label: string): string {
  const heading = Array.from(row.querySelectorAll("p")).find((p) => norm(p.textContent) === label);
  expect(heading, `no "${label}" slot in the row`).toBeDefined();
  return norm(heading!.parentElement?.textContent).slice(label.length).trim();
}

/** The rows on screen, in DOM order, keyed by prospect. */
function rowsOf(container: HTMLElement): Map<string, HTMLElement> {
  const found = new Map<string, HTMLElement>();
  container.querySelectorAll<HTMLElement>('li[data-testid^="meeting-"]').forEach((row) => {
    found.set(row.getAttribute("data-testid")!, row);
  });
  return found;
}

/** What a row cites, in the order it cites it. */
function citationsOf(row: Element): { value: string; read: string; text: string }[] {
  return Array.from(row.querySelectorAll("[data-evidence-value]")).map((line) => ({
    value: line.getAttribute("data-evidence-value")!,
    read: line.getAttribute("data-evidence-read")!,
    text: norm(line.textContent),
  }));
}

/** One count figure: whether it was measured, and what it says. */
function countOf(container: HTMLElement, key: (typeof MEETINGS_COUNT_KEYS)[number]) {
  const figure = within(container).getByTestId(meetingCountTestId(key));
  return { state: figure.getAttribute("data-metric-state"), text: norm(figure.textContent) };
}

/**
 * Everything Property 34 claims about one rendered meeting.
 *
 * `meeting` is the reference the page's own exported model produces over the same four
 * payloads; the clauses that must not depend on that model — which tokens may be cited,
 * where the row sits, and which flags are raised — are asserted against the payload
 * directly beside it.
 */
function expectRow(row: HTMLElement, meeting: Meeting, lead: Lead) {
  // ── The status, and the group it will have to sit under ──
  expect(row.getAttribute("data-status")).toBe(meeting.status);
  expect(norm(row.textContent)).toContain(MEETING_STATUS_LABELS[meeting.status]);

  // ── Every rendered meeting cites a meeting-evidence value (R14.6) ──
  const citations = citationsOf(row);
  expect(citations.length).toBeGreaterThan(0);
  citations.forEach((citation) => {
    expect(MEETING_EVIDENCE_TOKENS).toContain(citation.value);
    expect(EVIDENCE_READS).toContain(citation.read);
    // …and the citation names which read carried it, so the row is checkable.
    expect(citation.text).toContain(
      MEETING_EVIDENCE_READ_LABELS[citation.read as keyof typeof MEETING_EVIDENCE_READ_LABELS],
    );
  });
  // The cited set is the payload's evidence, in read order — no value invented, none lost.
  expect(citations.map((citation) => citation.value)).toEqual(meeting.evidence.map((e) => e.value));
  expect(citations.map((citation) => citation.read)).toEqual(meeting.evidence.map((e) => e.read));

  // ── The prospect, the company and the recorded outcome (R14.6) ──
  //
  // An unobserved value reads "Unknown" *with* the note that says why — the whole point of
  // `ObservedValue`'s absence branch — so the expectation carries the note rather than
  // being loosened to a containment check that a bare dash would also satisfy.
  const absent = `${UNKNOWN_TEXT}${UNKNOWN_SR_NOTE}`;
  const expectedName = lead.item.name.value ?? absent;
  const expectedCompany = lead.item.company.value ?? absent;
  expect(labelled(row, MEETINGS_PAGE_LABELS.prospectLabel)).toBe(expectedName);
  expect(labelled(row, MEETINGS_PAGE_LABELS.companyLabel)).toBe(expectedCompany);
  const outcome = labelled(row, MEETINGS_PAGE_LABELS.outcomeLabel);
  if (meeting.outcome?.value) {
    expect(outcome).toContain(STATE_LABEL[meeting.outcome.value] ?? meeting.outcome.value);
  } else {
    // Absent, through `ObservedValue` — never a dash and never a blank.
    expect(outcome).toContain(absent);
  }

  // ── Preparation and follow-up, from the status and the ask alone (R14.8) ──
  //
  // Computed here from the payload rather than taken from the reference, and `"NONE"` is
  // the arm that matters: it is the server saying there is nothing to ask, so it raises no
  // follow-up on a booked meeting.
  const ask = lead.cta?.recommendedCta ?? null;
  const asks = ask !== null && ask !== "NONE";
  const text = norm(row.textContent);
  expect(text.includes(MEETINGS_PAGE_LABELS.needsPreparation)).toBe(meeting.status === "READY");
  expect(text.includes(MEETINGS_PAGE_LABELS.needsFollowUp)).toBe(
    meeting.status === "REQUESTED" || (meeting.status === "BOOKED" && asks),
  );

  // ── No instant this row shows was made up (R14.7) ──
  //
  // There is no scheduled start in any GTM table, so every time on a row has to be an
  // instant one of the four payloads carried.
  Array.from(row.querySelectorAll("time")).forEach((time) => {
    expect([...lead.instants]).toContain(time.getAttribute("datetime"));
  });

  // ── Nothing from the dossier's regions (R14.9) ──
  expect(row.innerHTML).not.toContain("withheld-");
}

// ─── The properties ───────────────────────────────────────────────────────────

/**
 * **Validates: Requirements 14.4, 14.6, 14.7, 14.8, 14.9**
 */
describe("Property 34: Meetings presents real meetings and only meeting content", () => {
  it(
    "cites persisted meeting evidence for every row, groups by status, flags from the status and the ask, and prints nothing demo-sourced",
    // A hundred mounts of the page do not fit the 5s default.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          leadsArb,
          analyticsArb,
          demoArb,
          async (leadSpecs, countSpecs, demoSpec) => {
            const leads = leadSpecs.map((spec) => buildLead(spec));
            const analytics = buildAnalytics(countSpecs);
            const demo = buildDemo(demoSpec);
            install(leads, analytics, demo.workspace);

            // The reference: the narrowing gate first, then the evidence. A prospect the
            // gate refused is never read, so it can never be a meeting however its own
            // `/state` would have read.
            const expected = new Map<string, Meeting>();
            leads.forEach((lead) => {
              if (!isMeetingCandidate(lead.item)) return;
              const meeting = meetingFrom(
                lead.item,
                lead.state,
                lead.cta,
                lead.timeline?.entries ?? [],
              );
              if (meeting) expected.set(lead.item.leadId, meeting);
            });
            const candidates = leads.filter((lead) => isMeetingCandidate(lead.item));

            const container = await mountMeetings();
            try {
              // One page on the screen, so every reading below is this run's answer.
              expect(mounted()).toBe(1);

              // ── The five reads, and only the five (R14.2) ──
              expect(harness.calls.prospects).toEqual([MEETINGS_PROSPECT_LIMIT]);
              expect(harness.calls.analytics).toEqual([DAYS]);
              const readIds = candidates.map((lead) => lead.item.leadId).sort();
              expect([...harness.calls.state].sort()).toEqual(readIds);
              expect([...harness.calls.cta].sort()).toEqual(readIds);
              expect([...harness.calls.timeline].sort()).toEqual(readIds);
              // ── Nothing demo-sourced was even asked for, and no dossier read was made ──
              expect(harness.calls.forbidden).toEqual([]);

              // ── 1. No value originating in the Demo_Data_Source renders (R14.4) ──
              demo.values.forEach((value) => {
                expect(container.innerHTML).not.toContain(value);
              });

              // ── 5. No buying-intent detail, signal detail or state history (R14.9) ──
              expect(container.innerHTML).not.toContain("withheld-");
              EXCLUDED_REGION_TITLES.forEach((title) => {
                expect(norm(container.textContent)).not.toContain(title);
              });

              // ── 3. The scheduled-times statement, in every state (R14.7) ──
              expect(norm(container.textContent)).toContain(MEETING_LABELS.noScheduledTimes);

              const rows = rowsOf(container);
              // The rendered set is exactly the set the evidence establishes: no row
              // without evidence, no meeting dropped.
              expect([...rows.keys()].sort()).toEqual(
                [...expected.keys()].map(meetingRowTestId).sort(),
              );

              // A narrowed prospect the evidence refused renders nothing at all — the
              // refused-transition case among them.
              candidates.forEach((lead) => {
                if (expected.has(lead.item.leadId)) return;
                expect(rows.has(meetingRowTestId(lead.item.leadId))).toBe(false);
                if (lead.spec.refusedOnly) {
                  // …and it was read, so the gate let it through and the evidence decided.
                  expect(harness.calls.state).toContain(lead.item.leadId);
                }
              });

              if (expected.size === 0) {
                // No Meeting_State_Evidence in the workspace: the sentence, not four empty
                // groups (R14.11).
                expect(container.querySelectorAll('[data-testid^="meeting-group-"]')).toHaveLength(0);
                expect(norm(container.textContent)).toContain(MEETING_LABELS.empty);
              } else {
                // ── 3. Four groups, in the declared order, each row under its own ──
                const groups = Array.from(
                  container.querySelectorAll<HTMLElement>('[data-testid^="meeting-group-"]'),
                );
                expect(groups.map((group) => group.getAttribute("data-status"))).toEqual([
                  ...MEETING_STATUS_ORDER,
                ]);

                MEETING_STATUS_ORDER.forEach((status) => {
                  const group = within(container).getByTestId(meetingGroupTestId(status));
                  const inGroup = Array.from(
                    group.querySelectorAll<HTMLElement>('li[data-testid^="meeting-"]'),
                  );
                  const belong = [...expected.entries()].filter(
                    ([, meeting]) => meeting.status === status,
                  );
                  expect(inGroup.map((row) => row.getAttribute("data-testid")).sort()).toEqual(
                    belong.map(([leadId]) => meetingRowTestId(leadId)).sort(),
                  );
                  inGroup.forEach((row) => expect(row.getAttribute("data-status")).toBe(status));
                  // An empty group says so rather than leaving a gap.
                  if (inGroup.length === 0) {
                    expect(norm(group.textContent)).toContain(MEETING_GROUP_EMPTY);
                  }
                  // What membership claims — including that "Ready to ask" is not itself
                  // a meeting.
                  expect(norm(group.textContent)).toContain(MEETING_STATUS_NOTES[status]);
                });

                // Nothing under "Ready to ask" cites anything but a ready CTA: that group
                // holds conversations judged ready for the ask, not meetings.
                const ready = within(container).getByTestId(meetingGroupTestId("READY"));
                Array.from(ready.querySelectorAll<HTMLElement>('li[data-testid^="meeting-"]')).forEach(
                  (row) => {
                    citationsOf(row).forEach((citation) =>
                      expect(citation.value).toBe(MEETING_CTA_READY),
                    );
                  },
                );

                // ── 2 and 4, per row ──
                expected.forEach((meeting, leadId) => {
                  const lead = leads.find((candidate) => candidate.item.leadId === leadId)!;
                  expectRow(rows.get(meetingRowTestId(leadId))!, meeting, lead);
                });
              }

              // ── The counts are the server's arithmetic, and an unmeasured window is
              //    a sentence rather than a zero (R14.3, R14.5) ──
              MEETINGS_COUNT_KEYS.forEach((key) => {
                const total = sumMetric(analytics.rows, key);
                const figure = countOf(container, key);
                if (total === null) {
                  expect(figure.state).toBe("absent");
                  expect(figure.text).toContain(MEETING_LABELS.countsUnavailable);
                  expect(figure.text).not.toMatch(/\d/);
                } else {
                  expect(figure.state).toBe("measured");
                  expect(figure.text).toContain(String(total));
                }
              });
            } finally {
              cleanup();
            }
          },
        ),
        { numRuns: 100 },
      );

      // Nothing outlives the property.
      expect(mounted()).toBe(0);
    },
  );

  it(
    "raises the same preparation and follow-up flags however far every instant moves (R14.8)",
    // Two mounts a run.
    { timeout: 60_000 },
    async () => {
      /** Each row's status and its two flags, which is all this property compares. */
      const flagsOf = (container: HTMLElement) =>
        [...rowsOf(container).entries()]
          .map(([testId, row]) => {
            const text = norm(row.textContent);
            return [
              testId,
              row.getAttribute("data-status"),
              text.includes(MEETINGS_PAGE_LABELS.needsPreparation),
              text.includes(MEETINGS_PAGE_LABELS.needsFollowUp),
            ].join("|");
          })
          .sort();

      await fc.assert(
        fc.asyncProperty(
          leadsArb,
          analyticsArb,
          // Two shifts: one well in the past, one well in the future. A future instant is
          // what a page inferring a schedule from a timestamp would read as "upcoming".
          fc.integer({ min: -900, max: -30 }),
          fc.integer({ min: 30, max: 900 }),
          async (leadSpecs, countSpecs, backwards, forwards) => {
            const analytics = buildAnalytics(countSpecs);
            const demo = buildDemo({ accounts: [0], companies: ["Brightloop Labs"], contacts: ["Dana Seedman"] });

            const readings: string[][] = [];
            for (const shiftDays of [backwards, forwards]) {
              install(
                leadSpecs.map((spec) => buildLead(spec, shiftDays * DAY_MS)),
                analytics,
                demo.workspace,
              );
              const container = await mountMeetings();
              try {
                expect(mounted()).toBe(1);
                readings.push(flagsOf(container));
              } finally {
                cleanup();
              }
            }

            // Same statuses, same asks, two clocks, one answer.
            expect(readings[1]).toEqual(readings[0]);
          },
        ),
        { numRuns: 30 },
      );

      expect(mounted()).toBe(0);
    },
  );

  // ── The readable examples ───────────────────────────────────────────────────
  //
  // The properties answer "which rows, over any payload". These answer "what does it
  // actually say", by sentence, so a refused booking presented as a booking fails with the
  // real string rather than with a generated spec.

  it("establishes nothing from a refused transition whose summary names MEETING_BOOKED", async () => {
    const lead = buildLead({
      id: 1,
      named: true,
      // Narrowed in on the list payload, so the three follow-up reads are spent on it.
      listConversation: CTA_READY,
      listJourney: "DISCOVERY",
      stateConversation: "CONVERSATION_ACTIVE",
      stateJourney: "DISCOVERY",
      ctaState: "SOFT_CTA_READY",
      recommendedCta: "DIRECT_MEETING_ASK",
      entries: refusedEntries(),
      stateFails: false,
      ctaFails: false,
      timelineFails: false,
      refusedOnly: true,
    });
    install([lead], buildAnalytics([]), null);

    const container = await mountMeetings(false);

    // Read, and refused: the gate let it through and no entry stood.
    expect(harness.calls.state).toEqual(["lead-1"]);
    expect(within(container).queryByTestId(meetingRowTestId("lead-1"))).toBeNull();
    expect(within(container).getByText(MEETING_LABELS.empty)).toBeInTheDocument();
    // Not the token, not the summary that names it, nowhere on the page.
    expect(container.innerHTML).not.toContain("withheld-");
    expect(container.querySelectorAll("[data-evidence-value]")).toHaveLength(0);

    // Both figures unavailable, because the analytics read failed — and not a zero.
    MEETINGS_COUNT_KEYS.forEach((key) => {
      const figure = countOf(container, key);
      expect(figure.state).toBe("absent");
      expect(figure.text).toContain(MEETING_LABELS.countsUnavailable);
      expect(figure.text).not.toMatch(/\d/);
    });
  });

  it("raises no follow-up on a booked meeting whose recommended ask is NONE", async () => {
    const booked = buildLead({
      id: 2,
      named: true,
      listConversation: MEETING_BOOKED,
      listJourney: MEETING_BOOKED,
      stateConversation: MEETING_BOOKED,
      stateJourney: MEETING_BOOKED,
      ctaState: "MEETING_BOOKED",
      // The server's own "nothing to ask".
      recommendedCta: "NONE",
      entries: [],
      stateFails: false,
      ctaFails: false,
      timelineFails: false,
      refusedOnly: false,
    });
    const asked = buildLead({
      id: 3,
      named: true,
      listConversation: MEETING_REQUESTED,
      listJourney: MEETING_REQUESTED,
      stateConversation: MEETING_REQUESTED,
      stateJourney: MEETING_REQUESTED,
      ctaState: "MEETING_REQUESTED",
      recommendedCta: "AWAIT_RESPONSE",
      entries: [],
      stateFails: false,
      ctaFails: false,
      timelineFails: false,
      refusedOnly: false,
    });
    install([booked, asked], buildAnalytics([{ offset: 0, booked: "counted", completed: "zero", count: 2 }]), null);

    const container = await mountMeetings();
    const bookedRow = within(container).getByTestId(meetingRowTestId("lead-2"));
    const askedRow = within(container).getByTestId(meetingRowTestId("lead-3"));

    // The ask is stated as the server's sentence, and it raises nothing.
    expect(norm(bookedRow.textContent)).toContain(RECOMMENDED_CTA_LABEL.NONE);
    expect(norm(bookedRow.textContent)).not.toContain(MEETINGS_PAGE_LABELS.needsFollowUp);
    expect(norm(bookedRow.textContent)).not.toContain(MEETINGS_PAGE_LABELS.needsPreparation);
    expect(bookedRow.getAttribute("data-status")).toBe("BOOKED");

    // An unconfirmed request is a follow-up whatever the ask says.
    expect(norm(askedRow.textContent)).toContain(MEETINGS_PAGE_LABELS.needsFollowUp);
    expect(askedRow.getAttribute("data-status")).toBe("REQUESTED");

    // Each row under its own group, and the booked one is not also in Completed.
    expect(
      within(within(container).getByTestId(meetingGroupTestId("BOOKED"))).getByTestId(
        meetingRowTestId("lead-2"),
      ),
    ).toBeInTheDocument();
    expect(
      within(within(container).getByTestId(meetingGroupTestId("COMPLETED"))).queryByTestId(
        meetingRowTestId("lead-2"),
      ),
    ).toBeNull();

    // The two figures are the server's sums: 2 booked, a measured 0 completed.
    expect(countOf(container, "meetings_booked")).toEqual(
      expect.objectContaining({ state: "measured" }),
    );
    expect(countOf(container, "meetings_booked").text).toContain("2");
    expect(countOf(container, "meetings_completed").text).toContain("0");
  });
});
