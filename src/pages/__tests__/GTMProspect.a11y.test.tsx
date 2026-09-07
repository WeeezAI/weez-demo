// pages/__tests__/GTMProspect.a11y.test.tsx
//
// Property 39: every control this feature introduces is operable and perceivable
// (R18.9).
//
// Four claims, and the first is the only one a tool can make on its own:
//
// 1. **`jest-axe` is clean in all four states the page can be in** — loading,
//    loaded, error, and unknown-heavy. The last one matters most: with every
//    `ObservedFact` unknown, both scores absent, no next action, and an empty
//    ledger, every component takes its absent-value branch, and those branches are
//    the ones written last and reviewed least.
//
// 2. **Keyboard-only traversal reaches every control.** `userEvent.tab()` is driven
//    from the document body and the element focused at each stop is collected, so
//    the assertion is about the real tab order rather than about which elements
//    happen to exist. The reached set is then checked against every control the
//    page rendered, collected by role — a control that is on screen but off the tab
//    order fails here, which is exactly the regression a `div` with an `onClick`
//    would introduce. The walk is bounded, so a focus trap fails in a second
//    instead of hanging the suite, and the count has a floor, so a page that
//    rendered nothing cannot pass by reaching nothing.
//
// 3. **The focus ring is present.** Every stop on the walk carries the project's
//    own focus-visible utilities — the four classes `components/ui/button.tsx` and
//    `components/ui/textarea.tsx` define. That is checkable in jsdom, which cannot
//    compute a rendered outline; what it proves is that every control came from the
//    design system rather than being hand-rolled without a focus style.
//
// 4. **Status changes are announced.** The live region is a real `role="status"`
//    with `aria-live="polite"`, and its text actually moves across two transitions:
//    loading → loaded, and idle → refreshing → idle.
//
// What this file cannot do is what task 20.12 is for. Automated checks catch a
// subset of WCAG 2.1 AA; contrast against a rendered palette, screen-reader output,
// and the question of whether an announcement is *useful* all need a human.
//
// The harness is `GTMProspect.compose.test.tsx`'s, deliberately: `fetch` is stubbed
// by URL so the real `gtmAPI` normaliser runs from wire to DOM, `WebSocket` is a
// fake, and `ConversationSidebar` is stubbed because it is existing chrome that
// reaches for auth context and introduces no control of its own. Nothing here
// re-tests a claim that file already makes.
//
// The state engine's sections
// ---------------------------
// The page is five sections — recommended action, current state, what Weez believes,
// evidence, outcome and learning. The first three render from the prospect payload
// alone; the last two sit behind a native `<details>` / `<summary>` disclosure that is
// **closed on first paint**, which is what keeps the default load at two requests and
// the default outline at eight `<h2>`s. The panels only the dedicated state read can
// feed — the engagement counts, the timing, the buying stage, the intents, the
// per-channel readings, the whole-state confidence — appear in sections 2 and 3 once
// that read has landed, and until then their absence is a sentence rather than a
// fabricated value. So every claim about them is made in its own test, after the
// disclosure has been opened, and the four claims above keep being made about the page
// as it actually arrives.
//
// Two limits of jsdom are worth naming, because they shape what these tests can say
// about the `<summary>` itself. jsdom implements the element's *click* activation
// behaviour, so opening the disclosure with a click is real; it implements neither
// Enter/Space activation nor `<summary>` as a tab stop, so neither can be exercised
// here. What is checkable is that the control is focusable and carries the shared
// focus ring — the rest is the native semantics of the element, which is precisely
// why it is a `<summary>` and not a `<div role="button">`.

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GTMProspect from "../GTMProspect";
import { ACTION_CARD_LABELS, actionCardTestId } from "@/components/gtm/NextActionPanel";
import { ACTION_EXPLANATION_LABELS } from "@/components/gtm/ActionExplanation";
import { BUYING_STAGE_PANEL_LABELS } from "@/components/gtm/BuyingStagePanel";
import { CHANNEL_PANEL_LABELS } from "@/components/gtm/ChannelIntelligencePanel";
import { ENGAGEMENT_TREND_PANEL_LABELS } from "@/components/gtm/EngagementTrendPanel";
import { INTENT_PANEL_LABELS } from "@/components/gtm/IntentPanel";
import { LEARNING_PANEL_LABELS } from "@/components/gtm/LearningInsightsPanel";
import { SIGNAL_LIST_LABELS } from "@/components/gtm/SignalList";
import { STATE_HISTORY_LABELS } from "@/components/gtm/StateHistoryPanel";
import { TIMING_PANEL_LABELS } from "@/components/gtm/TimingPanel";
import {
  GTM_ACTION_LABELS,
  GTM_IDENTITY_LABELS,
  GTM_LIFECYCLE_LABELS,
  GTM_NBA_ACTION_LABELS,
  GTM_PAGE_LABELS,
  GTM_UI_LABELS,
  TIMELINE_LABELS,
} from "@/components/gtm/labels";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

// ─── Wire fixtures, exactly as `schemas/gtm.py` serialises them ───────────────

const HOUR = 3600_000;
const DISCLAIMER = "A prioritisation signal, not a predicted probability of conversion.";
const SUMMARY = "Connected · warm-up ready";

function iso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * HOUR).toISOString();
}

function wireScore(value: number | null) {
  return {
    score: value,
    score_kind: "RECOMMENDATION_SCORE",
    score_disclaimer: DISCLAIMER,
    is_derived: true,
  };
}

function wireFact(value: string | null, over: Record<string, unknown> = {}) {
  return {
    value,
    is_unknown: value === null,
    source_surface: value === null ? null : "LINKEDIN_PROFILE_PAGE",
    observed_at: value === null ? null : iso(3),
    is_stale: false,
    is_derived: false,
    ...over,
  };
}

function wireFactor(over: Record<string, unknown> = {}) {
  return {
    factor: "icp_match",
    available: true,
    weight: 0.2,
    value: 80,
    persisted_value: "STRONG",
    source: "sales_leads",
    contribution_hundredths: 16,
    direction: "RAISES",
    unavailable_reason: null,
    ...over,
  };
}

function wireChannel(channel: string, value: number) {
  return {
    channel,
    score: wireScore(value),
    confidence: "MEDIUM",
    recommendation: "LINKEDIN_WARMUP_MESSAGE",
    reasoning: [wireFactor()],
    unavailable_factors: ["phone_available"],
    available_weight_mass: 85,
    computed_at: iso(1),
  };
}

function wireMessage(over: Record<string, unknown> = {}) {
  return {
    message_id: "msg-1",
    conversation_id: "conv-1",
    direction: "OUTBOUND",
    message_purpose: "WARMUP",
    version: 1,
    generated_content: "Saw the engineering hiring push — how are you sequencing it?",
    edited_content: null,
    sent_content: null,
    generation_failure_reason: null,
    char_limit: 300,
    edited_by_user_id: null,
    edited_at: null,
    observed_text: null,
    reply_classification: null,
    reply_confidence: null,
    needs_human_review: false,
    derived_next_action: null,
    suggested_response: null,
    referral_detail: null,
    source_surface: null,
    observed_at: null,
    created_at: iso(2),
    ...over,
  };
}

/** A fully populated prospect — the loaded state. */
function wireDetail(over: Record<string, unknown> = {}) {
  return {
    lead_id: "lead-1",
    profile: {
      lead_id: "lead-1",
      profile_id: "profile-1",
      profile_url: "https://www.linkedin.com/in/example",
      public_identifier: "example",
      name: wireFact("Ada Lovelace"),
      headline: wireFact("Head of Engineering"),
      company: wireFact("Analytical Engines"),
      role: wireFact("Head of Engineering"),
      location: wireFact("London"),
      seniority: wireFact("EXECUTIVE", { is_derived: true }),
      icp_match: wireFact("STRONG", { is_derived: true }),
      intent_signal: wireFact("HIGH", { is_derived: true }),
      acv_tier: wireFact("MID", { is_derived: true }),
      lead_score: wireScore(82),
    },
    activity: {
      score: wireScore(64),
      level: wireFact("HIGH", { source_surface: "LINKEDIN_ACTIVITY_TAB", is_derived: true }),
      observed_at: iso(5),
      is_stale: false,
      source_surface: "LINKEDIN_ACTIVITY_TAB",
      components: { recency: 40, frequency: 24 },
    },
    channels: [wireChannel("LINKEDIN", 78), wireChannel("EMAIL", 55), wireChannel("PHONE", 31)],
    recommended_channel: "LINKEDIN",
    state: {
      relationship_state: wireFact("CONNECTED"),
      conversation_state: wireFact("WARMUP_READY"),
      conversation_stage: wireFact("WARMUP", { is_derived: true }),
      execution_state: wireFact("NOT_STARTED", { source_surface: "WEEZ_UI_CLICK" }),
      activity_level: wireFact("HIGH", { source_surface: "LINKEDIN_ACTIVITY_TAB", is_derived: true }),
      confirmation_status: "NOT_APPLICABLE",
      display_summary: SUMMARY,
      display_summary_is_derived: true,
    },
    cta: {
      score: wireScore(41),
      cta_state: "NOT_READY",
      recommended_cta: "CONTINUE_WARMUP",
      decided_by: "CTA_SCORE_BAND",
      reasoning: [wireFactor({ factor: "stage", persisted_value: "WARMUP" })],
      computed_at: iso(1),
    },
    next_action: {
      action_type: "SEND_MESSAGE",
      channel: "LINKEDIN",
      recommendation: "Send a warm-up message on LinkedIn",
      reasoning: ["Connected 3 hours ago", "Posting weekly"],
      message_id: "msg-1",
      destination_url: "https://www.linkedin.com/messaging/thread/abc",
      payload_text: "Saw the engineering hiring push — how are you sequencing it?",
      instructions: "Paste the message and send it yourself.",
      latest_action: null,
      is_suppressed: false,
    },
    latest_message: wireMessage(),
    message_versions: [wireMessage()],
    updated_at: iso(1),
    ...over,
  };
}

/**
 * The unknown-heavy payload: nothing observed, nothing scored, nothing prepared.
 *
 * Every fact is `value: null`, which is the *only* spelling of unknown on the wire,
 * so every `ObservedValue` takes its "Unknown" branch and both `DerivedScore`s take
 * theirs. `channels: []` is what the API sends when no evaluation has run — three
 * results or none — and `next_action: null` removes the composer and the action
 * controls with it. `confirmation_status: "UNKNOWN"` is the badge branch that has to
 * read "couldn't confirm" without reading as a failure, and `display_summary: ""`
 * leaves the live region empty, which is a legitimate state and must still be valid.
 */
function unknownDetail() {
  return {
    lead_id: "lead-1",
    profile: {
      lead_id: "lead-1",
      profile_id: null,
      profile_url: null,
      public_identifier: null,
      name: wireFact(null),
      headline: wireFact(null),
      company: wireFact(null),
      role: wireFact(null),
      location: wireFact(null),
      seniority: wireFact(null),
      icp_match: wireFact(null),
      intent_signal: wireFact(null),
      acv_tier: wireFact(null),
      lead_score: wireScore(null),
    },
    activity: {
      score: wireScore(null),
      level: wireFact(null),
      observed_at: null,
      is_stale: false,
      source_surface: null,
      components: {},
    },
    channels: [],
    recommended_channel: null,
    state: {
      relationship_state: wireFact(null),
      conversation_state: wireFact(null),
      conversation_stage: wireFact(null),
      execution_state: wireFact(null),
      activity_level: wireFact(null),
      confirmation_status: "UNKNOWN",
      display_summary: "",
      display_summary_is_derived: true,
    },
    cta: {
      score: wireScore(null),
      cta_state: "NOT_READY",
      recommended_cta: null,
      decided_by: null,
      reasoning: [],
      computed_at: null,
    },
    next_action: null,
    latest_message: null,
    message_versions: [],
    updated_at: null,
  };
}

function wireTimelinePage(entries: unknown[] = [], next: string | null = null) {
  return { entries, next_cursor: next, has_more: next !== null };
}

// ─── The state engine's payloads, as the four new routes serialise them ────────
//
// Only the fields these sections render are set; every wire field is optional and the
// normaliser fills the rest, which is the same contract the payloads above rely on.
// The values are chosen so both branches of each panel are on screen at once: one
// supported intent beside ten unsupported, one channel with no identifier, one signal
// past its retention horizon, and one statistic whose sample was too thin to learn
// from. Those are the branches the absent-value copy lives in.

const INTENT_TYPES_ON_THE_WIRE = [
  "BUYING",
  "HIRING",
  "FUNDING",
  "EXPANSION",
  "PRODUCT_LAUNCH",
  "PAIN_PROBLEM",
  "RESEARCH",
  "COMPETITOR",
  "ENGAGEMENT",
  "CONVERSATION",
  "MEETING",
] as const;

function wireIntent(intentType: string, over: Record<string, unknown> = {}) {
  return {
    intent_type: intentType,
    value: 0,
    confidence: 0,
    source: "DERIVED",
    evaluated_at: null,
    decay_rate: 0,
    signal_ids: [],
    is_derived: true,
    ...over,
  };
}

function wireChannelState(channel: string, over: Record<string, unknown> = {}) {
  return {
    channel,
    availability: "AVAILABLE",
    reachability: 70,
    activity: 55,
    engagement: 40,
    responsiveness: 35,
    response_rate: 20,
    historical_conversion_rate: 8,
    confidence: 60,
    suitability: 66,
    last_interaction_at: iso(4),
    last_inbound_at: null,
    last_outbound_at: iso(4),
    cooldown_until: null,
    consecutive_unanswered: 0,
    provenance: {},
    ...over,
  };
}

function wireStateFull(over: Record<string, unknown> = {}) {
  return {
    lead_id: "lead-1",
    state_version: 7,
    journey_state: wireFact("CONVERSATION_ACTIVE", { is_derived: true }),
    state_confidence: 66,
    state_flags: [],
    dimensions: {},
    identity: {
      confidence: 88,
      verified_at: iso(24),
      source_surface: "LINKEDIN_PROFILE_PAGE",
      observed_at: iso(24),
    },
    icp: {
      score: wireScore(74),
      confidence: 62,
      components: [wireFactor()],
      evaluated_at: iso(1),
      signal_ids: ["sig-1"],
      discovery_icp_passed: true,
      discovery_criteria: "Series B SaaS",
      discovery_acv_tier: "MID",
    },
    intents: [
      wireIntent("BUYING", {
        value: 72,
        confidence: 61,
        evaluated_at: iso(2),
        signal_ids: ["sig-1", "sig-2"],
      }),
      ...INTENT_TYPES_ON_THE_WIRE.filter((each) => each !== "BUYING").map((each) =>
        wireIntent(each),
      ),
    ],
    channels: [
      wireChannelState("LINKEDIN", {
        provenance: { availability: wireFact("AVAILABLE") },
      }),
      wireChannelState("EMAIL", { responsiveness: 5, suitability: 22 }),
      // No contact identifier: the row that has to read as an absence rather than a
      // low score (R6.6).
      wireChannelState("PHONE", {
        availability: "UNAVAILABLE",
        reachability: 0,
        activity: 0,
        engagement: 0,
        responsiveness: 0,
        response_rate: 0,
        historical_conversion_rate: 0,
        confidence: 0,
        suitability: 0,
        last_interaction_at: null,
        last_outbound_at: null,
      }),
    ],
    engagement: {
      count_24h: 2,
      count_7d: 6,
      count_30d: 11,
      trend: "RISING",
      evaluated_at: iso(1),
    },
    buying_stage: {
      value: "EVALUATING",
      confidence: 58,
      signal_ids: ["sig-1"],
      is_derived: true,
    },
    timing: {
      last_meaningful_signal_at: iso(5),
      signal_freshness: 74,
      urgency: 62,
      cooldown_until: null,
      ideal_next_action_window_start: iso(-1),
      ideal_next_action_window_end: iso(-5),
      // No timezone resolved, which is not the same as being outside working hours.
      within_business_hours: "UNKNOWN",
      activity_trend_flag: "SPIKE",
    },
    dimension_confidence: {
      relationship_state: 82,
      buying_stage: 58,
      engagement_trend: 64,
      activity_trend_flag: 49,
    },
    do_not_contact: wireFact(null),
    updated_at: iso(1),
    ...over,
  };
}

function wireExplanation() {
  return {
    why_now: [
      {
        signal_id: "sig-1",
        signal_type: "PROFILE_VIEW",
        event_timestamp: iso(6),
        effective_strength: 34,
        term: "signal_freshness",
        contribution_hundredths: 18,
        evidence_id: "ev-1",
      },
    ],
    why_this_channel: [wireFactor({ factor: "channel_suitability", persisted_value: "66" })],
    why_this_message: {
      message_id: null,
      message_purpose: "WARMUP",
      grounding_signal_ids: ["sig-1"],
      note: "Ground the angle in the hiring push.",
    },
    why_not_the_other_channels: [
      {
        action_type: "CALL",
        channel: "PHONE",
        action_score: wireScore(null),
        exclusion_reason: "CHANNEL_UNAVAILABLE",
        lowering_terms: [],
      },
    ],
    scope: {
      applied_scope: "WORKSPACE",
      sample_size: 48,
      min_sample: 30,
      decision: "APPLIED",
      decision_reason: null,
    },
    versions: {
      policy_version: "policy-v3",
      model_version: "model-v2",
      learning_version: "learning-v1",
      weight_set_id: "weights-1",
    },
  };
}

/**
 * The ranking's winner.
 *
 * `SEND_LINKEDIN_WARMUP` on purpose: it is one of the six candidate types that maps
 * onto a requestable action, so the Action_Card renders its open-channel control and
 * all four controls are in scope. A `WAIT` would render three and the fourth claim of
 * R27.8 would go untested.
 */
function wireCandidate(over: Record<string, unknown> = {}) {
  return {
    recommendation_id: "reco-1",
    action_type: "SEND_LINKEDIN_WARMUP",
    channel: "LINKEDIN",
    rank: 1,
    is_recommended: true,
    action_score: wireScore(77),
    action_confidence: 63,
    state_confidence: 66,
    terms: [wireFactor({ factor: "expected_success_probability", value: 41 })],
    unavailable_terms: ["prior_interaction_outcomes"],
    available_weight_mass: 88,
    exclusion_reason: null,
    explanation: wireExplanation(),
    expires_at: iso(-6),
    computed_at: iso(1),
    ...over,
  };
}

/** A lifecycle ledger row, which is how a recorded position reaches the card. */
function wireLifecycle(eventType: string) {
  return {
    event_id: `ev-${eventType}`,
    event_type: eventType,
    event_at: iso(1),
    summary: `reco-1 · ${eventType}`,
    outcome: "RECORDED",
    dimension: null,
    prior_value: null,
    new_value: null,
    actor_id: "user-1",
    actor_type: "USER",
    evidence_id: null,
    evidence_source_surface: null,
    evidence_observed_value: null,
    evidence_observed_at: null,
    evidence_confidence: null,
    related_action_id: "act-1",
    related_message_id: null,
    recommendation_id: "reco-1",
  };
}

function wireNextBestAction(over: Record<string, unknown> = {}) {
  return {
    lead_id: "lead-1",
    evaluation_id: "eval-1",
    computed_at: iso(1),
    expires_at: iso(-6),
    recommended: wireCandidate(),
    candidates: [wireCandidate()],
    policy_version: "policy-v3",
    model_version: "model-v2",
    learning_version: "learning-v1",
    weight_set_id: "weights-1",
    learning_scope_applied: "WORKSPACE",
    lifecycle: null,
    ...over,
  };
}

function wireSignalPage() {
  const base = {
    source: "LINKEDIN",
    source_surface: "LINKEDIN_PROFILE_PAGE",
    event_timestamp_precision: "EXACT",
    ingested_at: iso(5),
    strength: 60,
    confidence: 80,
    relevance: 70,
    decay_profile: "EXPONENTIAL",
    origin_table: "li_gtm_profiles",
    origin_id: "profile-1",
    payload: {},
  };
  return {
    items: [
      {
        ...base,
        signal_id: "sig-1",
        signal_type: "PROFILE_VIEW",
        event_timestamp: iso(6),
        effective_strength: 34,
        expires_at: iso(-48),
        at_floor: false,
      },
      // Past its retention horizon: retained, contributing its floor and nothing more.
      {
        ...base,
        signal_id: "sig-2",
        signal_type: "POST_ENGAGEMENT",
        event_timestamp: iso(400),
        effective_strength: 5,
        expires_at: iso(1),
        at_floor: true,
      },
    ],
    next_cursor: null,
    has_more: false,
  };
}

function wireStateHistoryPage() {
  return {
    items: [
      {
        snapshot_id: "snap-2",
        recorded_at: iso(1),
        state_version: 7,
        changed_dimensions: ["buying_stage"],
        confidence: 66,
        journey_state: "CONVERSATION_ACTIVE",
        triggering_signal_id: "sig-1",
        triggering_action_id: null,
        state: {},
      },
    ],
    next_cursor: null,
    has_more: false,
  };
}

function wireDebugView() {
  return {
    lead_id: "lead-1",
    state: wireStateFull(),
    signals: wireSignalPage().items,
    signal_outcomes: [],
    state_transitions: [],
    snapshots: wireStateHistoryPage().items,
    lifecycle_events: [],
    outcomes: [],
    candidates: [wireCandidate()],
    recommended: wireNextBestAction(),
    learning_updates: [
      {
        stat_id: "stat-1",
        scope: "USER",
        scope_user_id: "user-1",
        action_type: "REQUEST_MEETING",
        channel: "LINKEDIN",
        sample_size: 4,
        positive_count: 1,
        negative_count: 3,
        excluded_unknown_count: 0,
        success_rate: 25,
        ci_low: 5,
        ci_high: 70,
        mean_reward: 3,
        // The pair that must not read as a missing statistic (R22.3).
        decision: "INSUFFICIENT_SAMPLE_RETAINED",
        decision_reason: "4 outcomes against a minimum of 30",
        applied_scope: "WORKSPACE",
        min_sample: 30,
        learning_version: "learning-v1",
        computed_at: iso(1),
      },
    ],
  };
}

const TIMELINE_ENTRY = {
  event_id: "ev-1",
  event_type: "RELATIONSHIP_STATE_CHANGED",
  event_at: iso(3),
  summary: "relationship_state -> CONNECTED",
  outcome: "APPLIED",
  dimension: "relationship_state",
  prior_value: "NOT_CONNECTED",
  new_value: "CONNECTED",
  actor_id: "gtm_relationship_sync_worker",
  actor_type: "SERVICE",
  evidence_id: "ev_1",
  evidence_source_surface: "LINKEDIN_PROFILE_PAGE",
  evidence_observed_value: "1st",
  evidence_observed_at: iso(3),
  evidence_confidence: "HIGH",
  related_action_id: null,
  related_message_id: null,
};

// ─── Transport and socket stubs ───────────────────────────────────────────────

type Responder = (url: string) => { ok?: boolean; status?: number; body: unknown };

let fetchMock: ReturnType<typeof vi.fn>;
let sockets: FakeSocket[];

/** Just enough WebSocket for the page to mount without one being available. */
class FakeSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(public url: string) {
    sockets.push(this);
  }

  close() {
    this.closed = true;
  }
}

function routeFetch(responder: Responder) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const { ok = true, status = 200, body } = responder(String(input));
    return { ok, status, json: async () => body };
  });
}

function renderPage(query = "?lead_id=lead-1") {
  return render(
    <MemoryRouter initialEntries={[`/relationship-intelligence/brand-1${query}`]}>
      <Routes>
        <Route path="/relationship-intelligence/:spaceId" element={<GTMProspect />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The populated page, with the ledger entry on screen. */
async function renderLoaded() {
  routeFetch((url) =>
    url.includes("/timeline") ? { body: wireTimelinePage([TIMELINE_ENTRY]) } : { body: wireDetail() },
  );
  const utils = renderPage();
  await screen.findByText("Ada Lovelace");
  await screen.findByText(TIMELINE_ENTRY.summary);
  return utils;
}

/** The same page with nothing observed about the prospect and an empty ledger. */
async function renderUnknownHeavy() {
  routeFetch((url) =>
    url.includes("/timeline") ? { body: wireTimelinePage([]) } : { body: unknownDetail() },
  );
  const utils = renderPage();
  await screen.findByText(TIMELINE_LABELS.EMPTY);
  return utils;
}

/** The page with the detail request refused, so the retryable alert is on screen. */
async function renderFailed(detail = "LinkedIn sync is paused") {
  routeFetch(() => ({ ok: false, status: 502, body: { detail } }));
  const utils = renderPage();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(detail));
  return utils;
}

/**
 * Serve every route the page can reach, including the four the sections read.
 *
 * `/state/history` is matched before `/state`, because the first contains the second
 * and matching the shorter one first would answer a history request with a belief.
 */
function routeEverything(lifecycle: unknown = null) {
  routeFetch((url) => {
    if (url.includes("/timeline")) return { body: wireTimelinePage([TIMELINE_ENTRY]) };
    if (url.includes("/state/history")) return { body: wireStateHistoryPage() };
    if (url.includes("/signals")) return { body: wireSignalPage() };
    if (url.includes("/next-best-action")) return { body: wireNextBestAction({ lifecycle }) };
    if (url.includes("/debug")) return { body: wireDebugView() };
    if (url.includes("/lifecycle")) return { body: wireLifecycle("VIEWED") };
    if (url.includes("/feedback")) {
      return {
        body: {
          feedback_id: "fb-1",
          lead_id: "lead-1",
          recommendation_id: "reco-1",
          kind: "NEGATIVE",
          feedback_type: "NOT_RELEVANT",
          classification: "USER_PREFERENCE_SIGNAL",
          suppression_written: true,
          recompute_marked: true,
          recorded_at: iso(0),
        },
      };
    }
    if (url.includes("/state")) return { body: wireStateFull() };
    return { body: wireDetail() };
  });
}

/**
 * The loaded page with the twelve sections **open**.
 *
 * The disclosure is closed on first paint by design — that is what keeps the default
 * load at two requests and the closed-state outline and tab order exactly as the
 * assertions above and in `GTMProspect.compose.test.tsx` describe them. So every claim
 * about the sections starts by activating the `<summary>`, which is the operator's own
 * first move, and waits for both reads to land.
 */
async function renderSectionsOpen(lifecycle: unknown = null) {
  routeEverything(lifecycle);
  const utils = renderPage();
  await screen.findByText("Ada Lovelace");

  const user = userEvent.setup();
  await user.click(screen.getByText(GTM_PAGE_LABELS.subtitle));

  // The belief and the ranking are two routes read in parallel; both have landed once
  // the intent panel and the Action_Card are on screen.
  await screen.findByRole("heading", { name: INTENT_PANEL_LABELS.title });
  await screen.findByTestId(actionCardTestId("reco-1"));
  return utils;
}

/** The disclosure element itself, for the state of the sections. */
function disclosure(container: HTMLElement): HTMLDetailsElement {
  return container.querySelector("details") as HTMLDetailsElement;
}

beforeEach(() => {
  fetchMock = vi.fn();
  sockets = [];
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("WebSocket", FakeSocket);
  sessionStorage.setItem("token", "session-abc");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ─── Keyboard traversal ───────────────────────────────────────────────────────

/**
 * The four focus-visible utilities every control in this design system carries,
 * read off `components/ui/button.tsx` and `components/ui/textarea.tsx` (the version
 * `<select>` in `MessageComposer` repeats them literally, since it is a bare
 * element rather than a primitive).
 *
 * jsdom cannot compute a rendered outline, so this is not a measurement of a
 * visible ring — it is the assertion that every control on the tab order came from
 * the design system's focus treatment instead of being hand-rolled without one.
 */
const FOCUS_VISIBLE_CLASSES = [
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-ring",
  "focus-visible:ring-offset-2",
];

/**
 * The roles a control on this page can have: `<button>`, `<a href>`, the composer's
 * textarea, and the version `<select>`.
 */
const CONTROL_ROLES = ["button", "link", "textbox", "combobox"] as const;

/**
 * Bound on the walk. Nine controls is the widest state, so forty stops is slack
 * enough to be an escape hatch rather than a limit — if the walk ever hits it, a
 * focus trap has been introduced and the test says so in a second rather than
 * hanging the suite.
 */
const TAB_LIMIT = 40;

/**
 * A readable name for a control, for a failure message worth reading.
 *
 * The associated `<label>` is consulted before the element's own text, because a
 * `<textarea>`'s text *is* its value — naming the composer by the draft it happens
 * to hold would make the order assertion depend on the fixture's prose.
 * React's `useId` produces ids containing colons, so the label is found by walking
 * rather than through a selector.
 */
function controlName(node: HTMLElement): string {
  const aria = node.getAttribute("aria-label");
  if (aria) return aria;
  const label = [...document.querySelectorAll("label")].find((each) => each.htmlFor === node.id);
  const labelText = label?.textContent?.trim();
  if (labelText) return labelText;
  const text = node.textContent?.trim();
  if (text) return text;
  return `<${node.tagName.toLowerCase()}>`;
}

/** Every control the page rendered, whatever the tab order thinks. */
function renderedControls(): HTMLElement[] {
  return CONTROL_ROLES.flatMap((role) => screen.queryAllByRole(role)).filter(
    (node) => !node.hasAttribute("disabled") && node.getAttribute("aria-disabled") !== "true",
  );
}

/**
 * Tab from the document body and collect what receives focus at each stop.
 *
 * Terminates on the wrap: user-event's tab passes through the body once it runs off
 * the end of the order, and revisiting an element already collected means the order
 * cycled. Either way the walk is complete.
 */
async function tabOrder(): Promise<HTMLElement[]> {
  const user = userEvent.setup();
  (document.activeElement as HTMLElement | null)?.blur();

  const stops: HTMLElement[] = [];
  for (let step = 0; step < TAB_LIMIT; step += 1) {
    await user.tab();
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) break;
    if (stops.includes(active)) break;
    stops.push(active);
  }
  return stops;
}

/**
 * The shared traversal claim: the walk terminates, every rendered control is on it,
 * it is at least `floor` long, and every stop carries the focus ring.
 */
async function expectFullyTraversable(floor: number): Promise<string[]> {
  const stops = await tabOrder();

  // Terminated of its own accord rather than by running out of budget.
  expect(stops.length).toBeLessThan(TAB_LIMIT);
  // Non-vacuous: a page that rendered nothing reaches nothing and fails here.
  expect(stops.length).toBeGreaterThanOrEqual(floor);

  const reached = new Set(stops);
  const missed = renderedControls().filter((node) => !reached.has(node));
  expect(missed.map(controlName)).toEqual([]);

  stops.forEach((node) => expect(node).toHaveClass(...FOCUS_VISIBLE_CLASSES));

  return stops.map(controlName);
}

/** The page's own live region, in the chrome header that holds the `<h1>`. */
function statusLine(container: HTMLElement): HTMLElement {
  const heading = container.querySelector("h1") as HTMLElement;
  const header = heading.closest("header") as HTMLElement;
  return header.querySelector('p[role="status"]') as HTMLElement;
}

// ─── 1. jest-axe, in all four states ──────────────────────────────────────────

describe("axe", () => {
  it("is clean while the payload is loading", async () => {
    let release: ((value: unknown) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const { container } = renderPage();
    // The skeleton, not a spinner: `aria-busy` with an off-screen announcement.
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    expect(await axe(container)).toHaveNoViolations();

    release?.({ ok: true, status: 200, json: async () => wireDetail() });
    await screen.findByText("Ada Lovelace");
  });

  it("is clean with the whole payload on screen", async () => {
    const { container } = await renderLoaded();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is clean when the prospect could not be read", async () => {
    const { container } = await renderFailed();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is clean when nothing has been observed, scored, or prepared", async () => {
    const { container } = await renderUnknownHeavy();

    // The absent-value branches really are the ones being checked.
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(8);
    expect(screen.getByText(GTM_UI_LABELS.noEvaluation)).toBeInTheDocument();
    expect(screen.getByText(GTM_UI_LABELS.noSummary)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});

// ─── 2 & 3. Keyboard operability and the focus ring ───────────────────────────

describe("keyboard traversal", () => {
  it("reaches every control on the loaded page, in reading order, each with a focus ring", async () => {
    await renderLoaded();

    const order = await expectFullyTraversable(10);

    // Reading order, which is now the decision hierarchy's order: the page chrome,
    // the prospect header, the identity gate, then section 1 — the recommended action,
    // composer first, because the operator reads the draft before deciding to open
    // LinkedIn with it. `Re-evaluate channels` comes last of the ten because its panel
    // is a *belief* and lives in section 3, below the recommendation and the current
    // state.
    //
    // `Enrich Now` is the identity gate's control and sits fourth, directly after the
    // header, because the gate is above the five sections: a recommendation about
    // somebody nobody has identified is a recommendation about a stranger. It is
    // `Enrich Now` rather than `Track Prospect` for this fixture because `wireDetail()`
    // carries no verification verdict at all — nobody has looked for this person on
    // LinkedIn, so the only honest control is the one that starts looking.
    expect(order).toEqual([
      GTM_PAGE_LABELS.backToProspects,
      GTM_UI_LABELS.viewProfile,
      GTM_UI_LABELS.refresh,
      GTM_IDENTITY_LABELS.resolve,
      "Message draft",
      GTM_ACTION_LABELS.EDIT,
      GTM_ACTION_LABELS.REGENERATE,
      GTM_ACTION_LABELS.SEND_MESSAGE,
      GTM_ACTION_LABELS.COPY,
      GTM_UI_LABELS.reevaluate,
    ]);
  });

  it("reaches every control when nothing has been observed", async () => {
    await renderUnknownHeavy();

    // Four, and only four, controls survive an empty payload: leaving the page, asking
    // for a fresh read, asking who this person is on LinkedIn, and asking for an
    // evaluation that has not run. Each is still on the tab order and still carries its
    // ring. `Enrich Now` and not `Track Prospect`: with no verdict on the payload the
    // identity is unresolved, and the gate offers the search rather than a control the
    // route would certainly refuse.
    const order = await expectFullyTraversable(4);
    expect(order).toEqual([
      GTM_PAGE_LABELS.backToProspects,
      GTM_UI_LABELS.refresh,
      GTM_IDENTITY_LABELS.resolve,
      GTM_UI_LABELS.reevaluate,
    ]);
  });

  it("reaches the retry when the page failed, and the retry works from the keyboard", async () => {
    await renderFailed();

    const order = await expectFullyTraversable(2);
    expect(order).toEqual([GTM_PAGE_LABELS.backToProspects, GTM_PAGE_LABELS.retry]);

    // Reachable is not the same as operable: the recovery is driven by keys alone.
    routeFetch((url) =>
      url.includes("/timeline") ? { body: wireTimelinePage([TIMELINE_ENTRY]) } : { body: wireDetail() },
    );
    const user = userEvent.setup();
    screen.getByRole("button", { name: GTM_PAGE_LABELS.retry }).focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  });
});

// ─── 4. The live region ───────────────────────────────────────────────────────

describe("live region", () => {
  it("announces the move from loading to loaded politely, in one region", async () => {
    let release: ((value: unknown) => void) | undefined;
    let detailCall = 0;
    fetchMock.mockImplementation((input: unknown) => {
      if (String(input).includes("/timeline")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => wireTimelinePage() });
      }
      detailCall += 1;
      return new Promise((resolve) => {
        release = resolve;
      });
    });

    const { container } = renderPage();

    const status = statusLine(container);
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(GTM_PAGE_LABELS.statusLoading);

    await act(async () => {
      release?.({ ok: true, status: 200, json: async () => wireDetail() });
    });

    // The same node, with different text: an announcement, not a second region.
    await waitFor(() => expect(status).toHaveTextContent(SUMMARY));
    expect(status).not.toHaveTextContent(GTM_PAGE_LABELS.statusLoading);
    expect(statusLine(container)).toBe(status);
    expect(detailCall).toBe(1);
  });

  it("announces a refresh and then hands the region back to the server's summary", async () => {
    let release: ((value: unknown) => void) | undefined;
    let detailCall = 0;
    fetchMock.mockImplementation((input: unknown) => {
      if (String(input).includes("/timeline")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => wireTimelinePage() });
      }
      detailCall += 1;
      if (detailCall === 1) {
        return Promise.resolve({ ok: true, status: 200, json: async () => wireDetail() });
      }
      return new Promise((resolve) => {
        release = resolve;
      });
    });

    const { container } = renderPage();
    await screen.findByText("Ada Lovelace");

    const status = statusLine(container);
    expect(status).toHaveTextContent(SUMMARY);

    await userEvent.click(screen.getByRole("button", { name: GTM_UI_LABELS.refresh }));
    await waitFor(() => expect(status).toHaveTextContent(GTM_PAGE_LABELS.statusRefreshing));

    await act(async () => {
      release?.({ ok: true, status: 200, json: async () => wireDetail() });
    });

    await waitFor(() => expect(status).toHaveTextContent(SUMMARY));
    expect(status).not.toHaveTextContent(GTM_PAGE_LABELS.statusRefreshing);
  });
});

// ─── 5. The state engine's sections, once they are open ────────────────────────
//
// Every test below opens the disclosure first. None of them changes a closed-state
// assertion, because the closed state is the state the page actually arrives in and
// the four claims above are about that.

describe("the state engine's sections", () => {
  it("is closed on arrival and opens from a focusable native control", async () => {
    routeEverything();
    const { container } = renderPage();
    await screen.findByText("Ada Lovelace");

    // Closed on first paint, and nothing behind it is on screen or has been read.
    const details = disclosure(container);
    expect(details.open).toBe(false);
    expect(
      screen.queryByRole("heading", { name: INTENT_PANEL_LABELS.title }),
    ).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/next-best-action"))).toBe(
      true,
    );

    // A `<summary>`, so it is focusable and Enter/Space operable as it stands, with no
    // `aria-expanded` of ours to keep in sync with the element's own `open`. jsdom
    // implements neither `<summary>` keyboard activation nor `<summary>` as a tab stop,
    // so what is checkable here is that the control takes focus and carries the shared
    // ring — the activation itself is the element's native behaviour.
    const control = screen.getByText(GTM_PAGE_LABELS.subtitle);
    expect(control.tagName).toBe("SUMMARY");
    expect(control).toHaveClass(...FOCUS_VISIBLE_CLASSES);
    control.focus();
    expect(document.activeElement).toBe(control);

    const user = userEvent.setup();
    await user.click(control);
    expect(details.open).toBe(true);

    // Opening is what reads: the belief and the ranking, in parallel.
    await screen.findByRole("heading", { name: INTENT_PANEL_LABELS.title });
    await screen.findByTestId(actionCardTestId("reco-1"));
  });

  it("mounts every added section with its own heading", async () => {
    await renderSectionsOpen();

    // The panels R28.1 names, each owning its own `<h2>` rather than being folded into
    // one section that would leave a reader unable to address any of them.
    [
      GTM_UI_LABELS.confidence,
      INTENT_PANEL_LABELS.title,
      BUYING_STAGE_PANEL_LABELS.title,
      CHANNEL_PANEL_LABELS.title,
      ENGAGEMENT_TREND_PANEL_LABELS.title,
      TIMING_PANEL_LABELS.title,
      SIGNAL_LIST_LABELS.title,
      STATE_HISTORY_LABELS.title,
      ACTION_EXPLANATION_LABELS.title,
    ].forEach((name) =>
      expect(screen.getByRole("heading", { name, level: 2 })).toBeInTheDocument(),
    );

    // The learning read is gated once more behind its own control, because the debug
    // route answers with six ledger collections to feed one panel.
    expect(
      screen.getByRole("button", { name: LEARNING_PANEL_LABELS.title }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("heading", { name: LEARNING_PANEL_LABELS.title, level: 2 }),
    ).not.toBeInTheDocument();
  });

  it("is clean under axe with all twelve sections on screen", async () => {
    const { container } = await renderSectionsOpen();

    // The learning panel too, since it is the one section a reader has to ask for.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: LEARNING_PANEL_LABELS.title }));
    await screen.findByRole("heading", { name: LEARNING_PANEL_LABELS.title, level: 2 });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps the heading outline contiguous, with one banner and one main", async () => {
    const { container } = await renderSectionsOpen();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: LEARNING_PANEL_LABELS.title }));
    await screen.findByRole("heading", { name: LEARNING_PANEL_LABELS.title, level: 2 });

    // One landmark of each. The banner is counted structurally rather than by role:
    // a `<header>` is only a `banner` when it is not scoped inside sectioning content,
    // and Testing Library's role map does not implement that scoping — it would report
    // `ProspectHeader`'s in-`<main>` `<header>` as a second banner, which axe (and a
    // screen reader) correctly does not. Being scoped by `<main>` is exactly what the
    // page relies on, so that is what is asserted.
    const scoped = "main header, section header, article header, aside header, nav header";
    const banners = [...container.querySelectorAll("header")].filter(
      (node) => ![...container.querySelectorAll(scoped)].includes(node),
    );
    expect(banners).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    // And the twelve sections did not bring a landmark of their own along with them.
    expect(container.querySelectorAll("main")).toHaveLength(1);

    // The closed page's eight `<h2>`s — the count `GTMProspect.compose.test.tsx` pins:
    // the prospect header, section 1's next action and why-this-action, section 2's
    // dimension grid, section 3's channel recommendation and meeting readiness, and
    // section 4's LinkedIn activity and timeline. Opening the disclosure adds nine:
    // the four panels the state read feeds in sections 2 and 3 (engagement, timing,
    // buying stage, intents), the per-channel readings, the whole-state confidence,
    // section 4's signal list, section 5's state history, and the learning panel just
    // opened. Asserted here, in the opened state, rather than by moving that number.
    expect(container.querySelectorAll("h2")).toHaveLength(17);

    const levels = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((node) =>
      Number(node.tagName[1]),
    );
    // Starts at the page's one `<h1>` and never skips a level on the way down, so the
    // twelve added sections extend the outline instead of jumping over it.
    expect(levels[0]).toBe(1);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    levels.slice(1).forEach((level, index) => {
      expect(level - levels[index]).toBeLessThanOrEqual(1);
    });
  });

  it("reaches every control in the opened state, in reading order, each with a focus ring", async () => {
    await renderSectionsOpen();

    // A separate test from the closed-state walk, and a separate order: the Action_Card
    // renders above the composer, so opening the sections inserts four controls into
    // section 1 rather than appending to the end of the order.
    const order = await expectFullyTraversable(15);
    expect(order).toEqual([
      GTM_PAGE_LABELS.backToProspects,
      GTM_UI_LABELS.viewProfile,
      GTM_UI_LABELS.refresh,
      // The identity gate, above the five sections and unaffected by the disclosure:
      // it renders from the prospect payload, so opening the sections neither adds nor
      // removes a control here.
      GTM_IDENTITY_LABELS.resolve,
      // Section 1, the recommended action. The Action_Card's four (R27.2, R27.4,
      // R27.8), then the recommendation's composer and its own controls.
      GTM_NBA_ACTION_LABELS.SEND_LINKEDIN_WARMUP,
      ACTION_CARD_LABELS.editReasoning,
      ACTION_CARD_LABELS.notRelevant,
      ACTION_CARD_LABELS.dismiss,
      "Message draft",
      GTM_ACTION_LABELS.EDIT,
      GTM_ACTION_LABELS.REGENERATE,
      GTM_ACTION_LABELS.SEND_MESSAGE,
      GTM_ACTION_LABELS.COPY,
      // Section 3, what Weez believes: the scored channels are a belief, so their
      // re-evaluation control sits below the recommendation rather than above it.
      GTM_UI_LABELS.reevaluate,
      // Sections 4 and 5, inside the disclosure: the `as_of` field, then the gated
      // learning read.
      STATE_HISTORY_LABELS.asOfLabel,
      LEARNING_PANEL_LABELS.title,
    ]);
  });

  it("announces what the Action_Card recorded, politely, in its own region", async () => {
    await renderSectionsOpen();
    const card = screen.getByTestId(actionCardTestId("reco-1"));

    // The region exists before there is anything to say, so the announcement is a text
    // change inside a live region rather than a region appearing with text in it.
    const live = card.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live).not.toBeNull();
    expect(live.textContent).toBe("");

    const user = userEvent.setup();
    await user.click(within(card).getByRole("button", { name: ACTION_CARD_LABELS.notRelevant }));

    // What the server persisted, rendered where it will be read out (R27.4, R27.8).
    await waitFor(() =>
      expect(live.textContent).toContain(ACTION_CARD_LABELS.feedbackRecorded),
    );
    expect(live.textContent).toContain(ACTION_CARD_LABELS.notRelevant);
    expect(card.querySelector('[aria-live="polite"]')).toBe(live);
  });

  it("gives every status indicator in the added sections a text alternative", async () => {
    await renderSectionsOpen(wireLifecycle("CLICKED"));

    // The Action_Card's recorded position, as words. `CLICKED` means a human asked and
    // a tab opened, and the chip says exactly that (R27.3).
    const card = screen.getByTestId(actionCardTestId("reco-1"));
    expect(within(card).getByRole("status").textContent).toBe(GTM_LIFECYCLE_LABELS.CLICKED);

    // Each added section's ambiguous value carries the sentence that disambiguates it,
    // so none of them depends on being a paler shade of its neighbour.
    expect(screen.getByText(CHANNEL_PANEL_LABELS.unavailableNote)).toBeInTheDocument();
    // Scoped to the phone column: `ActionExplanation` uses the same words for the
    // alternative it never scored, and the claim here is about the channel's own row.
    const phone = document.querySelector('[data-channel="PHONE"]') as HTMLElement;
    expect(within(phone).getByText(CHANNEL_PANEL_LABELS.notScored)).toBeInTheDocument();
    expect(screen.getByText(TIMING_PANEL_LABELS.businessHoursUnknownNote)).toBeInTheDocument();
    expect(screen.getAllByText(INTENT_PANEL_LABELS.neverEvaluated).length).toBeGreaterThan(1);
    expect(screen.getByText(SIGNAL_LIST_LABELS.atFloorNote)).toBeInTheDocument();
    expect(screen.getByText(ACTION_EXPLANATION_LABELS.notScoredNote)).toBeInTheDocument();
  });

  it("is clean under axe with the intelligence absent, and keeps the outline contiguous", async () => {
    // The state the honest-empty copy exists for: no belief was ever formed about this
    // prospect. `wireDetail()` carries none of the six additive fields
    // (R26.7) — the server drops the keys rather than sending `null` — and the two
    // fallback reads have no row to answer with, so nothing fills these sections in and
    // every absent-intelligence branch is the one on screen. It is not the
    // unknown-heavy payload above: that one is a belief that places the prospect
    // nowhere, and this one is the absence of any belief at all.
    const detail = wireDetail();
    [
      "journey_state",
      "intents",
      "channel_states",
      "buying_stage",
      "timing",
      "next_best_action",
    ].forEach((key) => expect(key in detail).toBe(false));

    routeFetch((url) => {
      if (url.includes("/timeline")) return { body: wireTimelinePage([TIMELINE_ENTRY]) };
      if (url.includes("/state/history")) return { body: wireStateHistoryPage() };
      if (url.includes("/signals")) return { body: wireSignalPage() };
      if (url.includes("/next-best-action")) {
        return { ok: false, status: 404, body: { detail: "No evaluation for this prospect" } };
      }
      if (url.includes("/state")) {
        return { ok: false, status: 404, body: { detail: "No state for this prospect" } };
      }
      return { body: detail };
    });

    const { container } = renderPage();
    await screen.findByText("Ada Lovelace");

    const user = userEvent.setup();
    await user.click(screen.getByText(GTM_PAGE_LABELS.subtitle));
    expect(disclosure(container).open).toBe(true);

    // Both honest-empty sentences, which also settles that no read is still in flight:
    // the page suppresses them while one is, so their presence is the wait.
    await screen.findByText(GTM_PAGE_LABELS.noIntelligenceRead);
    expect(screen.getByText(GTM_PAGE_LABELS.noStateBelief)).toBeInTheDocument();
    // Sections 4 and 5 are open and reading on their own, unaffected by the refusals.
    expect(
      await screen.findByRole("heading", { name: SIGNAL_LIST_LABELS.title, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: STATE_HISTORY_LABELS.title, level: 2 }),
    ).toBeInTheDocument();
    // Nothing was invented in the recommendation's place.
    expect(screen.queryByTestId(actionCardTestId("reco-1"))).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: INTENT_PANEL_LABELS.title }),
    ).not.toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();

    // The outline still starts at the page's one `<h1>` and never skips a level, so the
    // panels that dropped out took their headings with them without leaving a gap.
    const levels = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((node) =>
      Number(node.tagName[1]),
    );
    expect(levels[0]).toBe(1);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    levels.slice(1).forEach((level, index) => {
      expect(level - levels[index]).toBeLessThanOrEqual(1);
    });
  });
});
