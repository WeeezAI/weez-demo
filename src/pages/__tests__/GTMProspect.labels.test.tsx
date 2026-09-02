// pages/__tests__/GTMProspect.labels.test.tsx
//
// Property 30 — no action control is labelled as sending by Weez (R12.1, R12.2).
//
// R12.2 does not ask for a claim in a comment, it asks for "an automated test
// [that] SHALL assert that no GTM action control label equals `Send`". This file is
// that test, and its whole value is that it fails the day somebody relabels a
// control. So it is written to be *hard to satisfy vacuously*:
//
//   • It renders the real page over the real `gtmAPI` normaliser, not a component in
//     isolation, so every control the operator can actually reach is in scope —
//     including the ones a panel only mounts under a particular payload.
//   • It reaches the controls that mount behind an interaction. Save and Cancel do
//     not exist until Edit is pressed, and a scan that never pressed Edit would be
//     blind to exactly the two labels a careless refactor is most likely to touch.
//     The collection therefore runs in both composer modes and takes the union.
//   • It asserts a floor on how many controls it found. A scan over an empty set
//     satisfies "none is `Send`" trivially, so "we rendered nothing" and "we
//     rendered nothing wrong" have to be distinguishable — and they are only
//     distinguishable by counting.
//   • It names the controls it expects to have reached. The floor stops the set from
//     collapsing to zero; this stops it from collapsing to two.
//   • It walks `GTM_ACTION_LABELS` exhaustively with `Object.entries`, so a key
//     added to the table next month is covered without anybody remembering to edit
//     this file. That is the reason `labels.ts` keeps the strings in one object.
//
// What counts as a label here is the *accessible name*, not the visible text: a
// button whose text is an icon and whose name lives in `aria-label` is as capable of
// lying to the operator as one with a text node, and R12.2 is about what the
// operator is told. So each control contributes its `aria-label`, its `title`, its
// `aria-labelledby` target, its associated `<label>`, and — for anything that is not
// a form control — its text content. A textarea's `textContent` is its *value* and
// not its name, which is why form controls read their `<label>` instead: scanning a
// draft's body for the word `Send` would flag the message rather than the control.
//
// The harness is `GTMProspect.compose.test.tsx`'s, deliberately unchanged: `fetch`
// stubbed by URL so the real normaliser runs, `WebSocket` stubbed, and
// `ConversationSidebar` and `sonner` mocked because they are existing chrome. None
// of that is re-tested here.
//
// The state engine's controls
// ---------------------------
// The prospect state engine adds an Action_Card and twelve sections, and every one of
// them sits behind a native `<details>` / `<summary>` disclosure that is closed on
// first paint. A scan that never opened it would be blind to the four controls most
// able to mislead an operator — the card's open-channel control above all — for
// exactly the reason the scan already presses `Edit`: a control that is not mounted
// cannot be read, and the labels a refactor is most likely to touch are the ones
// behind an interaction. So the scan is run a second time with the sections open, and
// the two lifecycle positions that mean "a human asked and a tab opened" are checked
// to read as that and nothing more (R27.3).
//
// The added strings live in ten exported objects rather than in `labels.ts`, because
// task 14.3 closed that file for this feature. They are walked here with
// `Object.entries` in exactly the way `GTM_ACTION_LABELS` is, so a string added to any
// of them next month is covered without anybody remembering this file exists.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  GTM_ACTION_LABEL_BY_TYPE,
  GTM_EXCLUSION_LABELS,
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

// ─── The forbidden label ──────────────────────────────────────────────────────

/**
 * The exact string R12.2 forbids.
 *
 * Exact and trimmed, as the requirement is written: `Open LinkedIn & Send` contains
 * the word and is the label R12.1 *mandates*, so the assertion is equality and not
 * a substring match. What is banned is a control that claims Weez sends.
 */
const FORBIDDEN_LABEL = "Send";

/**
 * The smallest number of controls a populated page can be rendering and still be
 * worth scanning.
 *
 * Set below the count the fixture actually produces so a legitimate change to the
 * UI does not trip it, and far enough above zero that a refactor which stops
 * mounting the panels fails here instead of passing silently.
 */
const CONTROL_FLOOR = 8;

/** The roles a GTM control can hold. Anything interactive the operator can label. */
const CONTROL_ROLES = ["button", "link", "textbox", "combobox"] as const;

// ─── Wire fixtures ────────────────────────────────────────────────────────────
//
// A payload chosen so that *every* control is reachable: a prepared next action, a
// draft, two retained versions (the version selector), an action already requested
// and unconfirmed ("I sent it"), a profile URL (the profile link), and a timeline
// page that has more behind it ("Load earlier activity").

const HOUR = 3600_000;
const DISCLAIMER = "A prioritisation signal, not a predicted probability of conversion.";

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

/**
 * A requested, unconfirmed action.
 *
 * `WAITING_FOR_CONFIRMATION` is what makes the confirmation control mount: it is
 * offered only while there is a request whose outcome nobody has observed, which is
 * precisely the state in which an operator might be tempted to read the primary
 * control as having sent something.
 */
function wireAction(over: Record<string, unknown> = {}) {
  return {
    action_id: "act-1",
    profile_id: "profile-1",
    conversation_id: "conv-1",
    message_id: "msg-2",
    action_type: "SEND_MESSAGE",
    channel: "LINKEDIN",
    execution_state: "ACTION_REQUESTED",
    confirmation_status: "WAITING_FOR_CONFIRMATION",
    is_verified: false,
    requested_by_user_id: "user-1",
    requested_at: iso(1),
    destination_url: "https://www.linkedin.com/messaging/thread/abc",
    payload_text: "Saw the engineering hiring push — how are you sequencing it?",
    instructions: "Paste the message and send it yourself.",
    linkedin_opened_at: null,
    verification_attempts: 1,
    verification_budget: 3,
    attempts_remaining: 2,
    next_verification_at: iso(-1),
    verified_at: null,
    outcome_evidence_id: null,
    failure_reason: null,
    ...over,
  };
}

/** Everything populated: no control is absent because a field was missing. */
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
      execution_state: wireFact("ACTION_REQUESTED", { source_surface: "WEEZ_UI_CLICK" }),
      activity_level: wireFact("HIGH", {
        source_surface: "LINKEDIN_ACTIVITY_TAB",
        is_derived: true,
      }),
      confirmation_status: "WAITING_FOR_CONFIRMATION",
      display_summary: "Connected · warm-up requested",
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
      message_id: "msg-2",
      destination_url: "https://www.linkedin.com/messaging/thread/abc",
      payload_text: "Saw the engineering hiring push — how are you sequencing it?",
      instructions: "Paste the message and send it yourself.",
      // Already requested and unconfirmed → the confirmation control is offered.
      latest_action: wireAction(),
      is_suppressed: false,
    },
    latest_message: wireMessage({ message_id: "msg-2", version: 2 }),
    // Two retained versions → the version selector is rendered.
    message_versions: [wireMessage({ message_id: "msg-2", version: 2 }), wireMessage()],
    updated_at: iso(1),
    ...over,
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

/** A page with a cursor behind it, so the paging control mounts. */
function wireTimelinePage(entries: unknown[] = [TIMELINE_ENTRY], next: string | null = "cursor-1") {
  return { entries, next_cursor: next, has_more: next !== null };
}

// ─── The state engine's payloads ──────────────────────────────────────────────
//
// Only what the added controls need to mount: a belief so the sections render, a
// ranking whose winner is one of the six candidate types that maps onto a requestable
// action (so the card's open-channel control exists at all), and a signal page and a
// history page so both of those panels reach their loaded state rather than their
// skeleton. Every wire field is optional and the normaliser fills the rest.

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

function wireStateFull() {
  return {
    lead_id: "lead-1",
    state_version: 7,
    journey_state: wireFact("CONVERSATION_ACTIVE", { is_derived: true }),
    state_confidence: 66,
    state_flags: [],
    dimensions: {},
    identity: { confidence: 88, verified_at: iso(24), source_surface: null, observed_at: null },
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
    intents: INTENT_TYPES_ON_THE_WIRE.map((intentType) => ({
      intent_type: intentType,
      value: intentType === "BUYING" ? 72 : 0,
      confidence: intentType === "BUYING" ? 61 : 0,
      source: "DERIVED",
      evaluated_at: intentType === "BUYING" ? iso(2) : null,
      decay_rate: 0,
      signal_ids: [],
      is_derived: true,
    })),
    channels: ["LINKEDIN", "EMAIL", "PHONE"].map((channel) => ({
      channel,
      availability: channel === "PHONE" ? "UNAVAILABLE" : "AVAILABLE",
      reachability: 70,
      activity: 55,
      engagement: 40,
      responsiveness: 35,
      response_rate: 20,
      historical_conversion_rate: 8,
      confidence: 60,
      suitability: channel === "PHONE" ? 0 : 66,
      last_interaction_at: iso(4),
      last_inbound_at: null,
      last_outbound_at: iso(4),
      cooldown_until: null,
      consecutive_unanswered: 0,
      provenance: {},
    })),
    engagement: { count_24h: 2, count_7d: 6, count_30d: 11, trend: "RISING", evaluated_at: iso(1) },
    buying_stage: { value: "EVALUATING", confidence: 58, signal_ids: ["sig-1"], is_derived: true },
    timing: {
      last_meaningful_signal_at: iso(5),
      signal_freshness: 74,
      urgency: 62,
      cooldown_until: null,
      ideal_next_action_window_start: iso(-1),
      ideal_next_action_window_end: iso(-5),
      within_business_hours: "WITHIN",
      activity_trend_flag: "SPIKE",
    },
    dimension_confidence: { buying_stage: 58, engagement_trend: 64, activity_trend_flag: 49 },
    do_not_contact: wireFact(null),
    updated_at: iso(1),
  };
}

/**
 * The ranking's winner, and the recorded position the card should be reading.
 *
 * `SEND_LINKEDIN_WARMUP` maps onto a requestable action, so the open-channel control
 * is rendered; `lifecycle` is how a recorded `CLICKED` or `STARTED` reaches the card
 * without the test having to drive a request to produce one.
 */
function wireNextBestAction(lifecyclePosition: string | null = null) {
  const candidate = {
    recommendation_id: "reco-1",
    action_type: "SEND_LINKEDIN_WARMUP",
    channel: "LINKEDIN",
    rank: 1,
    is_recommended: true,
    action_score: wireScore(77),
    action_confidence: 63,
    state_confidence: 66,
    terms: [wireFactor({ factor: "expected_success_probability", value: 41 })],
    unavailable_terms: [],
    available_weight_mass: 88,
    exclusion_reason: null,
    explanation: {
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
      why_this_channel: [wireFactor()],
      why_this_message: {
        message_id: null,
        message_purpose: "WARMUP",
        grounding_signal_ids: ["sig-1"],
        note: null,
      },
      why_not_the_other_channels: [],
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
    },
    expires_at: iso(-6),
    computed_at: iso(1),
  };

  return {
    lead_id: "lead-1",
    evaluation_id: "eval-1",
    computed_at: iso(1),
    expires_at: iso(-6),
    recommended: candidate,
    candidates: [candidate],
    policy_version: "policy-v3",
    model_version: "model-v2",
    learning_version: "learning-v1",
    weight_set_id: "weights-1",
    learning_scope_applied: "WORKSPACE",
    lifecycle: lifecyclePosition
      ? {
          event_id: `ev-${lifecyclePosition}`,
          event_type: lifecyclePosition,
          event_at: iso(1),
          summary: `reco-1 · ${lifecyclePosition}`,
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
        }
      : null,
  };
}

/** A signal page with one live fact and one retained past its horizon. */
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
      { ...base, signal_id: "sig-1", signal_type: "PROFILE_VIEW", event_timestamp: iso(6), effective_strength: 34, expires_at: iso(-48), at_floor: false },
      { ...base, signal_id: "sig-2", signal_type: "POST_ENGAGEMENT", event_timestamp: iso(400), effective_strength: 5, expires_at: iso(1), at_floor: true },
    ],
    // A cursor, so this panel's own pager mounts and is in the scan's scope.
    next_cursor: "signals-cursor-1",
    has_more: true,
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
    next_cursor: "history-cursor-1",
    has_more: true,
  };
}

// ─── Transport and socket stubs (compose.test.tsx's, unchanged) ────────────────

let fetchMock: ReturnType<typeof vi.fn>;

class FakeSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(public url: string) {}
  close() {}
}

function serveHappyPath(detail: unknown = wireDetail()) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const body = String(input).includes("/timeline") ? wireTimelinePage() : detail;
    return { ok: true, status: 200, json: async () => body };
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/relationship-intelligence/brand-1?lead_id=lead-1"]}>
      <Routes>
        <Route path="/relationship-intelligence/:spaceId" element={<GTMProspect />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Resolved once the payload has landed and the timeline has finished its own read. */
async function renderPopulated() {
  serveHappyPath();
  const utils = renderPage();
  await screen.findByText("Ada Lovelace");
  await screen.findByRole("button", { name: TIMELINE_LABELS.LOAD_EARLIER });
  return utils;
}

/**
 * The same page, plus the four routes the state engine's sections read.
 *
 * `/state/history` is matched before `/state`, because the first contains the second
 * and matching the shorter one first would answer a history request with a belief.
 */
function serveWithSections(lifecyclePosition: string | null = null) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);
    const body = url.includes("/timeline")
      ? wireTimelinePage()
      : url.includes("/state/history")
        ? wireStateHistoryPage()
        : url.includes("/signals")
          ? wireSignalPage()
          : url.includes("/next-best-action")
            ? wireNextBestAction(lifecyclePosition)
            : url.includes("/lifecycle")
              ? TIMELINE_ENTRY
              : url.includes("/state")
                ? wireStateFull()
                : wireDetail();
    return { ok: true, status: 200, json: async () => body };
  });
}

/**
 * The populated page with the twelve sections **open**.
 *
 * The disclosure is closed on arrival by design, so the operator's own first move is
 * the test's first move. Nothing here changes what the closed-state scan above asserts.
 */
async function renderWithSections(lifecyclePosition: string | null = null) {
  serveWithSections(lifecyclePosition);
  const utils = renderPage();
  await screen.findByText("Ada Lovelace");

  await userEvent.click(screen.getByText(GTM_PAGE_LABELS.subtitle));

  // Both reads have landed once the belief's first panel and the ranking's card are on
  // screen; they are two routes, read in parallel.
  await screen.findByRole("heading", { name: INTENT_PANEL_LABELS.title });
  await screen.findByTestId(actionCardTestId("reco-1"));
  return utils;
}

// ─── Accessible-name collection ───────────────────────────────────────────────

function normalise(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

const FORM_CONTROLS = ["INPUT", "TEXTAREA", "SELECT"];

/**
 * Every string this control could be presenting to the operator as its name.
 *
 * More than one, because there is more than one way to name a control and a scan
 * that read only `textContent` would miss an icon button, while one that read only
 * `aria-label` would miss every text button on the page. `textContent` is skipped
 * for form controls: a textarea's text content is its *value*, so reading it would
 * scan the draft rather than the control.
 */
function namesOf(element: HTMLElement): string[] {
  const names: string[] = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
  ];

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    labelledBy
      .split(/\s+/)
      .forEach((id) => names.push(document.getElementById(id)?.textContent ?? null));
  }

  // The `<label for>` association, which is how the textarea and the version
  // selector get their names.
  const labels = (element as HTMLInputElement).labels;
  if (labels) [...labels].forEach((label) => names.push(label.textContent));

  if (!FORM_CONTROLS.includes(element.tagName)) names.push(element.textContent);

  return [...new Set(names.map(normalise).filter(Boolean))];
}

interface CollectedControl {
  role: string;
  tag: string;
  names: string[];
}

/** Every control currently on screen, with every name it carries. */
function collectControls(): CollectedControl[] {
  return CONTROL_ROLES.flatMap((role) =>
    screen.queryAllByRole(role).map((element) => ({
      role,
      tag: element.tagName.toLowerCase(),
      names: namesOf(element as HTMLElement),
    })),
  );
}

/** Deduplicated on the (role, name) pair, so the same control is counted once. */
function mergeControls(...batches: CollectedControl[][]): CollectedControl[] {
  const byKey = new Map<string, CollectedControl>();
  batches.flat().forEach((control) => {
    byKey.set(`${control.role}::${control.names.join("|")}`, control);
  });
  return [...byKey.values()];
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("WebSocket", FakeSocket);
  sessionStorage.setItem("token", "session-abc");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ─── The scan ─────────────────────────────────────────────────────────────────

describe("Property 30: no action control is labelled as sending by Weez", () => {
  /**
   * The scan itself.
   *
   * Two passes over the page — the composer read-only, then editing — because Save
   * and Cancel do not exist in the first and Edit does not exist in the second. The
   * union is every label the operator can be shown.
   */
  it("presents no control named exactly Send, in either composer mode", async () => {
    await renderPopulated();

    const readOnly = collectControls();
    await userEvent.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.EDIT }));
    await screen.findByRole("button", { name: GTM_ACTION_LABELS.SAVE });
    const editing = collectControls();

    const controls = mergeControls(readOnly, editing);

    controls.forEach((control) => {
      control.names.forEach((name) => {
        expect(
          name,
          `${control.role} <${control.tag}> is named "${name}"`,
        ).not.toBe(FORBIDDEN_LABEL);
      });
    });

    // A scan over an empty set would satisfy the assertion above without proving
    // anything, so the size of the set is part of the claim (R12.2).
    expect(controls.length).toBeGreaterThanOrEqual(CONTROL_FLOOR);
    expect(controls.every((control) => control.names.length > 0)).toBe(true);
  });

  /**
   * The floor stops the scanned set collapsing to zero; this stops it collapsing to
   * a couple of pieces of page chrome. Each name below is a control the scan has to
   * have walked for the guard to mean what it claims — and three of them exist only
   * because the test drove an interaction to mount them.
   */
  it("reaches every GTM control, including the ones that mount behind an interaction", async () => {
    await renderPopulated();

    const buttons = [
      GTM_PAGE_LABELS.backToProspects, // page chrome
      GTM_UI_LABELS.refresh, // header refresh
      GTM_UI_LABELS.reevaluate, // channel panel
      GTM_ACTION_LABELS.SEND_MESSAGE, // the primary control
      GTM_ACTION_LABELS.COPY,
      GTM_ACTION_LABELS.CONFIRM_SENT, // only because an action was requested
      GTM_ACTION_LABELS.EDIT,
      GTM_ACTION_LABELS.REGENERATE,
      TIMELINE_LABELS.LOAD_EARLIER, // only because the page has a cursor
    ];
    buttons.forEach((name) => {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    });

    // The profile link is an anchor, not a button, and a scan restricted to buttons
    // would not see it.
    expect(screen.getByRole("link", { name: GTM_UI_LABELS.viewProfile })).toBeInTheDocument();

    // The version selector, which mounts only because two versions were retained.
    expect(screen.getByRole("combobox", { name: /Version/ })).toBeInTheDocument();
    // The draft itself, named by its label rather than by its content.
    expect(screen.getByRole("textbox", { name: /Message draft/ })).toBeInTheDocument();

    // Save and Cancel exist only in edit mode — the mode a scan is most likely to
    // never enter, and therefore the one it most needs to.
    await userEvent.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.EDIT }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: GTM_ACTION_LABELS.SAVE })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: GTM_ACTION_LABELS.CANCEL })).toBeInTheDocument();
    });
  });

  /** R12.1 — the label the requirement names, on a real control, spelled exactly. */
  it("labels the LinkedIn message control Open LinkedIn & Send", async () => {
    await renderPopulated();

    const control = screen.getByRole("button", { name: "Open LinkedIn & Send" });
    expect(control).toBeInTheDocument();
    expect(normalise(control.textContent)).toBe("Open LinkedIn & Send");
  });
});

// ─── The table, exhaustively ──────────────────────────────────────────────────

describe("the action-label table", () => {
  /**
   * Walked with `Object.entries` rather than key by key, so a label added to
   * `GTM_ACTION_LABELS` next month is covered without anybody remembering this file
   * exists. That is the entire reason the strings live in one object.
   */
  it("contains no entry equal to Send", () => {
    const entries = Object.entries(GTM_ACTION_LABELS);

    // A table that lost its entries would pass the loop below vacuously.
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach(([key, label]) => {
      expect(label.trim(), `GTM_ACTION_LABELS.${key}`).not.toBe(FORBIDDEN_LABEL);
    });
  });

  it("labels the message action Open LinkedIn & Send", () => {
    expect(GTM_ACTION_LABELS.SEND_MESSAGE).toBe("Open LinkedIn & Send");
  });

  /**
   * `GTM_ACTION_LABEL_BY_TYPE` is documented as a projection of the table, not a
   * second table. If it ever stopped being one it would become a place a control
   * could be labelled outside the scan's reach, so the projection is asserted rather
   * than trusted.
   */
  it("is the only source the per-type action labels draw from", () => {
    const known: string[] = Object.values(GTM_ACTION_LABELS);
    Object.entries(GTM_ACTION_LABEL_BY_TYPE).forEach(([actionType, label]) => {
      expect(known, `GTM_ACTION_LABEL_BY_TYPE.${actionType}`).toContain(label);
    });
  });
});

// ─── The state engine's controls (R27.3) ──────────────────────────────────────

/**
 * The claims a control label is not allowed to make.
 *
 * Every pattern is about *who acts*, which is the only thing R27.3 is about. What is
 * forbidden is a label asserting that Weez performed the action or that it happened:
 * a bare `Send`, an imperative Weez appears to be carrying out itself, and any first
 * person claim about sending. `Open LinkedIn & Send a warm-up` matches none of them
 * and is the form the requirement *mandates* — the conjunction is what names the tab
 * Weez opens and leaves the sending with the operator.
 */
const SENDING_CLAIM_PATTERNS: readonly [string, RegExp][] = [
  ["a bare send imperative", /^sending\b/i],
  ["an imperative with no channel to open", /^send\b/i],
  ["a first-person claim about sending", /\b(we|weez|i)\s+(send|sends|sent|will send|have sent)\b/i],
  ["a claim the message went out", /\b(message|it)\s+(was|has been)\s+sent\b/i],
  ["an automation claim", /\b(automatically|on your behalf)\s+(send|sent|sends)\b/i],
];

/**
 * The ten objects this feature's strings live in, plus the two vocabularies in
 * `labels.ts` it added. Walked with `Object.entries` rather than key by key, for the
 * same reason the table above is: a string added next month is covered by default.
 */
const ADDED_LABEL_TABLES: readonly [string, Record<string, unknown>][] = [
  ["ACTION_CARD_LABELS", ACTION_CARD_LABELS],
  ["INTENT_PANEL_LABELS", INTENT_PANEL_LABELS],
  ["CHANNEL_PANEL_LABELS", CHANNEL_PANEL_LABELS],
  ["SIGNAL_LIST_LABELS", SIGNAL_LIST_LABELS],
  ["STATE_HISTORY_LABELS", STATE_HISTORY_LABELS],
  ["LEARNING_PANEL_LABELS", LEARNING_PANEL_LABELS],
  ["ACTION_EXPLANATION_LABELS", ACTION_EXPLANATION_LABELS],
  ["BUYING_STAGE_PANEL_LABELS", BUYING_STAGE_PANEL_LABELS],
  ["TIMING_PANEL_LABELS", TIMING_PANEL_LABELS],
  ["ENGAGEMENT_TREND_PANEL_LABELS", ENGAGEMENT_TREND_PANEL_LABELS],
  ["GTM_NBA_ACTION_LABELS", GTM_NBA_ACTION_LABELS],
  ["GTM_LIFECYCLE_LABELS", GTM_LIFECYCLE_LABELS],
  ["GTM_EXCLUSION_LABELS", GTM_EXCLUSION_LABELS],
];

/** Every string in a table, flattened, since two of them nest a `fields` object. */
function stringsIn(table: Record<string, unknown>, prefix = ""): [string, string][] {
  return Object.entries(table).flatMap(([key, value]) => {
    if (typeof value === "string") return [[`${prefix}${key}`, value] as [string, string]];
    if (value && typeof value === "object") {
      return stringsIn(value as Record<string, unknown>, `${prefix}${key}.`);
    }
    return [];
  });
}

describe("the state engine's added label tables", () => {
  it("contains no entry equal to Send, and none that says Weez sends", () => {
    ADDED_LABEL_TABLES.forEach(([tableName, table]) => {
      const entries = stringsIn(table);
      // A table that lost its entries would satisfy the loop below vacuously.
      expect(entries.length, tableName).toBeGreaterThan(0);

      entries.forEach(([key, label]) => {
        expect(label.trim(), `${tableName}.${key}`).not.toBe(FORBIDDEN_LABEL);
        SENDING_CLAIM_PATTERNS.forEach(([why, pattern]) => {
          expect(pattern.test(label.trim()), `${tableName}.${key} reads as ${why}: "${label}"`).toBe(
            false,
          );
        });
      });
    });
  });

  it("keeps the Open-and-Send form on every channel-touching recommendation", () => {
    // The form R27.3 mandates rather than tolerates: the conjunction names the tab
    // Weez opens and leaves the sending with the operator.
    ["SEND_LINKEDIN_WARMUP", "SEND_LINKEDIN_FOLLOWUP", "SEND_EMAIL", "SEND_EMAIL_FOLLOWUP"].forEach(
      (actionType) => {
        expect(GTM_NBA_ACTION_LABELS[actionType], actionType).toMatch(/^Open .+ & /);
      },
    );
    // And the two that touch no channel read as answers rather than as empty states.
    expect(GTM_NBA_ACTION_LABELS.WAIT).toBe("Wait — nothing to do yet");
    expect(GTM_NBA_ACTION_LABELS.RESEARCH_MORE).toBe("Find out more first");
  });

  it("reads CLICKED and STARTED as requested and opened, never as performed", () => {
    // The sensitive pair. Both mean a human asked for the action and a tab opened, and
    // the strings stop there — the settled claim they are allowed to make.
    expect(GTM_LIFECYCLE_LABELS.CLICKED).toBe("Action requested");
    expect(GTM_LIFECYCLE_LABELS.STARTED).toBe("Channel opened");

    // Neither borrows the wording of a position that *is* a claim about doing.
    [GTM_LIFECYCLE_LABELS.CLICKED, GTM_LIFECYCLE_LABELS.STARTED].forEach((label) => {
      expect(label).not.toMatch(/\bsent\b/i);
      expect(label).not.toBe(GTM_LIFECYCLE_LABELS.EXECUTED);
      expect(label).not.toBe(GTM_LIFECYCLE_LABELS.CONFIRMED);
    });
  });
});

describe("Property 30, with the state engine's sections open", () => {
  /**
   * The scan again, over the state the twelve sections put the page in.
   *
   * The floor is raised because the opened page renders strictly more than the closed
   * one: the same reasoning as `CONTROL_FLOOR`, applied to a bigger set. Both composer
   * modes again, because `Save` and `Cancel` still only exist in the second.
   */
  it("presents no control named exactly Send, with the Action_Card on screen", async () => {
    await renderWithSections();

    const readOnly = collectControls();
    await userEvent.click(screen.getByRole("button", { name: GTM_ACTION_LABELS.EDIT }));
    await screen.findByRole("button", { name: GTM_ACTION_LABELS.SAVE });
    const editing = collectControls();

    const controls = mergeControls(readOnly, editing);

    controls.forEach((control) => {
      control.names.forEach((name) => {
        expect(name, `${control.role} <${control.tag}> is named "${name}"`).not.toBe(
          FORBIDDEN_LABEL,
        );
      });
    });

    expect(controls.length).toBeGreaterThanOrEqual(CONTROL_FLOOR + 6);
    expect(controls.every((control) => control.names.length > 0)).toBe(true);
  });

  /**
   * The floor stops the scanned set collapsing; this names the controls the sections
   * actually contributed, so a refactor that stops mounting the card fails here rather
   * than passing a smaller scan.
   */
  it("reaches the Action_Card's four controls and the added sections' own", async () => {
    await renderWithSections();

    const card = within(screen.getByTestId(actionCardTestId("reco-1")));
    [
      // The open-channel control, labelled with the action's own recommendation string.
      GTM_NBA_ACTION_LABELS.SEND_LINKEDIN_WARMUP,
      ACTION_CARD_LABELS.editReasoning,
      ACTION_CARD_LABELS.notRelevant,
      ACTION_CARD_LABELS.dismiss,
    ].forEach((name) => expect(card.getByRole("button", { name })).toBeInTheDocument());

    // And the controls the sections themselves own.
    [
      SIGNAL_LIST_LABELS.loadEarlier,
      STATE_HISTORY_LABELS.loadEarlier,
      LEARNING_PANEL_LABELS.title,
    ].forEach((name) => expect(screen.getByRole("button", { name })).toBeInTheDocument());

    // The `as_of` field, named by its label rather than by whatever it holds.
    expect(screen.getByLabelText(STATE_HISTORY_LABELS.asOfLabel)).toBeInTheDocument();
  });

  it("shows a recorded CLICKED as Action requested and claims nothing more", async () => {
    await renderWithSections("CLICKED");

    const card = screen.getByTestId(actionCardTestId("reco-1"));
    expect(within(card).getByRole("status").textContent).toBe(GTM_LIFECYCLE_LABELS.CLICKED);

    // R27.3 — a human asked and a tab opened, and the card prints no sentence saying
    // the action was performed. Scoped to the card: the confirm ladder below it is the
    // operator's own assertion and is allowed to say "I sent it".
    const text = card.textContent ?? "";
    expect(text).not.toMatch(/\bsent\b/i);
    expect(text).not.toContain(GTM_LIFECYCLE_LABELS.EXECUTED);
    expect(text).not.toContain(GTM_LIFECYCLE_LABELS.CONFIRMED);
    // The one string on the card that names a channel is the action title, in the
    // mandated Open-and-Send form.
    expect(within(card).getByRole("heading", { level: 3 }).textContent).toBe(
      GTM_NBA_ACTION_LABELS.SEND_LINKEDIN_WARMUP,
    );
  });

  it("shows a recorded STARTED as Channel opened and claims nothing more", async () => {
    await renderWithSections("STARTED");

    const card = screen.getByTestId(actionCardTestId("reco-1"));
    expect(within(card).getByRole("status").textContent).toBe(GTM_LIFECYCLE_LABELS.STARTED);
    expect(card.textContent ?? "").not.toMatch(/\bsent\b/i);

    // Opening a channel is not acting in it: the confirm ladder is still where the
    // operator says otherwise, and it is outside this card.
    expect(within(card).queryByRole("button", { name: GTM_ACTION_LABELS.CONFIRM_SENT })).toBeNull();
    expect(screen.getByRole("button", { name: GTM_ACTION_LABELS.CONFIRM_SENT })).toBeInTheDocument();
  });
});
