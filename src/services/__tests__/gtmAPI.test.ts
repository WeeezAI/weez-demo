// services/__tests__/gtmAPI.test.ts
//
// Three things are checked here, and they are the three things the service module
// is responsible for.
//
// 1. **Transport.** The bearer token reaches the `Authorization` header, `brand_id`
//    reaches the query string on every route, and a non-`ok` response becomes an
//    `Error` carrying the server's `detail` rather than a status code.
//
// 2. **Renaming, and only renaming.** The wire's snake_case becomes the camelCase
//    the components read, an absent value stays absent, and no value is invented on
//    the way through. `is_unknown` is re-asserted when a value is null, which is the
//    same rule the server applies before sending.
//
// 3. **No credential field (R15.2).** Every field declared on every type in
//    `gtmAPI.ts`, and every key of a fully-populated normalised payload, is scanned
//    with the expression `schemas/gtm.py` uses. The session token has exactly one
//    shape in that module — a request header — and this asserts it never becomes a
//    field on a type or a key in a payload.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import gtmAPI, { GTM_BASE_URL, unknownFact } from "../gtmAPI";

// The same expression as `schemas.gtm.CREDENTIAL_FIELD_PATTERN`, matched as a
// substring so `access_token`, `li_at_cookie`, and `session_state` are all caught.
const CREDENTIAL_FIELD_PATTERN =
  /(token|secret|password|credential|cookie|session|api[_-]?key|bearer|authorization|private[_-]?key)/i;

// ─── Fixtures: the wire shapes, exactly as the backend serialises them ────────

const OBSERVED = {
  value: "CONNECTED",
  is_unknown: false,
  source_surface: "LINKEDIN_PROFILE_PAGE",
  observed_at: "2025-01-04T10:00:00+00:00",
  is_stale: false,
  is_derived: false,
};

const UNKNOWN_WIRE = {
  value: null,
  // Deliberately contradictory: a null value with `is_unknown` false. The
  // normaliser must still report unknown.
  is_unknown: false,
  source_surface: null,
  observed_at: null,
  is_stale: false,
  is_derived: false,
};

const SCORE_WIRE = {
  score: 72,
  score_kind: "RECOMMENDATION_SCORE",
  score_disclaimer: "A prioritisation signal, not a probability of success.",
  is_derived: true,
};

const STATE_WIRE = {
  relationship_state: OBSERVED,
  conversation_state: { ...OBSERVED, value: "WAITING_FOR_REPLY" },
  conversation_stage: { ...OBSERVED, value: "WARMUP", is_derived: true },
  execution_state: { ...OBSERVED, value: "ACTION_REQUESTED" },
  activity_level: UNKNOWN_WIRE,
  confirmation_status: "WAITING_FOR_CONFIRMATION",
  display_summary: "Connected · waiting for a reply",
  display_summary_is_derived: true,
};

const ACTIVITY_WIRE = {
  score: { ...SCORE_WIRE, score: null },
  level: UNKNOWN_WIRE,
  observed_at: null,
  is_stale: false,
  source_surface: null,
  components: { recency: 40, frequency: 20, breadth: 10, consistency: 5 },
};

const MESSAGE_WIRE = {
  message_id: "msg_1",
  conversation_id: "conv_1",
  direction: "OUTBOUND",
  message_purpose: "WARMUP",
  version: 2,
  generated_content: "Congrats on the launch.",
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
  created_at: "2025-01-04T09:00:00+00:00",
};

const ACTION_WIRE = {
  action_id: "act_1",
  profile_id: "prof_1",
  conversation_id: "conv_1",
  message_id: "msg_1",
  action_type: "SEND_MESSAGE",
  channel: "LINKEDIN",
  execution_state: "ACTION_REQUESTED",
  confirmation_status: "WAITING_FOR_CONFIRMATION",
  is_verified: false,
  requested_by_user_id: "user_1",
  requested_at: "2025-01-04T11:00:00+00:00",
  destination_url: "https://www.linkedin.com/in/example/",
  payload_text: "Congrats on the launch.",
  instructions: "Paste this into the LinkedIn thread and press Send.",
  linkedin_opened_at: null,
  verification_attempts: 0,
  verification_budget: 3,
  attempts_remaining: 3,
  next_verification_at: null,
  verified_at: null,
  outcome_evidence_id: null,
  failure_reason: null,
};

const PROSPECT_WIRE = {
  lead_id: "lead_1",
  profile: {
    lead_id: "lead_1",
    profile_id: "prof_1",
    profile_url: "https://www.linkedin.com/in/example/",
    public_identifier: "example",
    name: { ...OBSERVED, value: "Priya Patel" },
    headline: UNKNOWN_WIRE,
    company: { ...OBSERVED, value: "Brightloop" },
    role: UNKNOWN_WIRE,
    location: UNKNOWN_WIRE,
    seniority: { ...OBSERVED, value: "HEAD", is_derived: true },
    icp_match: { ...OBSERVED, value: "STRONG", is_derived: true },
    intent_signal: UNKNOWN_WIRE,
    acv_tier: { ...OBSERVED, value: "medium", is_derived: true },
    lead_score: SCORE_WIRE,
  },
  activity: ACTIVITY_WIRE,
  channels: [
    {
      channel: "LINKEDIN",
      score: SCORE_WIRE,
      confidence: "MEDIUM",
      recommendation: "LINKEDIN_WARMUP_MESSAGE",
      reasoning: [
        {
          factor: "icp_match",
          available: true,
          weight: 0.2,
          value: 80,
          persisted_value: "STRONG",
          source: "leads.icp_match",
          contribution_hundredths: 1600,
          direction: "RAISES",
          unavailable_reason: null,
        },
        {
          factor: "phone_available",
          available: false,
          weight: null,
          value: null,
          persisted_value: null,
          source: null,
          contribution_hundredths: null,
          direction: "UNAVAILABLE",
          unavailable_reason: "no phone on the lead record",
        },
      ],
      unavailable_factors: ["phone_available"],
      available_weight_mass: 85,
      computed_at: "2025-01-04T10:30:00+00:00",
    },
  ],
  recommended_channel: "LINKEDIN",
  state: STATE_WIRE,
  cta: {
    score: { ...SCORE_WIRE, score: 30 },
    cta_state: "NOT_READY",
    recommended_cta: null,
    decided_by: "score_band",
    reasoning: [],
    computed_at: "2025-01-04T10:30:00+00:00",
  },
  next_action: {
    action_type: "SEND_MESSAGE",
    channel: "LINKEDIN",
    recommendation: "LINKEDIN_WARMUP_MESSAGE",
    reasoning: ["Connected, and the thread has not started."],
    message_id: "msg_1",
    destination_url: "https://www.linkedin.com/in/example/",
    payload_text: "Congrats on the launch.",
    instructions: "Paste this into the LinkedIn thread and press Send.",
    latest_action: ACTION_WIRE,
    is_suppressed: false,
  },
  latest_message: MESSAGE_WIRE,
  message_versions: [MESSAGE_WIRE, { ...MESSAGE_WIRE, message_id: "msg_0", version: 1 }],
  updated_at: "2025-01-04T11:00:00+00:00",
};

// ─── Test transport helpers ───────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function respondWith(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  fetchMock.mockResolvedValueOnce({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  });
}

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
}

function headerOf(name: string): string | undefined {
  const [, options] = lastCall();
  return (options.headers as Record<string, string>)[name];
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.setItem("token", "session-abc");
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

// ─── 1. Transport ─────────────────────────────────────────────────────────────

describe("gtmFetch", () => {
  it("attaches the session token as a bearer header", async () => {
    respondWith(PROSPECT_WIRE);
    await gtmAPI.getProspect("brand-1", "lead_1");
    expect(headerOf("Authorization")).toBe("Bearer session-abc");
  });

  it("omits the Authorization header when no session token is held", async () => {
    sessionStorage.clear();
    respondWith(PROSPECT_WIRE);
    await gtmAPI.getProspect("brand-1", "lead_1");
    expect(headerOf("Authorization")).toBeUndefined();
  });

  it("sends brand_id on every route, url-encoded", async () => {
    respondWith(PROSPECT_WIRE);
    await gtmAPI.getProspect("brand 1/2", "lead_1");
    const [url] = lastCall();
    expect(url).toBe(`${GTM_BASE_URL}/prospect/lead_1?brand_id=brand+1%2F2`);
  });

  it("raises the server's detail rather than a status code", async () => {
    respondWith({ detail: "Prospect not found" }, { ok: false, status: 404 });
    await expect(gtmAPI.getProspect("brand-1", "lead_1")).rejects.toThrow(
      "Prospect not found"
    );
  });

  it("falls back to the status line when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(gtmAPI.getProspect("brand-1", "lead_1")).rejects.toThrow(
      "GTM backend error 502"
    );
  });

  it("stringifies a structured detail rather than rendering [object Object]", async () => {
    respondWith({ detail: [{ msg: "field required" }] }, { ok: false, status: 422 });
    await expect(gtmAPI.getProspect("brand-1", "lead_1")).rejects.toThrow(
      '[{"msg":"field required"}]'
    );
  });
});

// ─── 2. Renaming, and only renaming ───────────────────────────────────────────

describe("getProspect", () => {
  it("renames the wire's keys without changing what it says", async () => {
    respondWith(PROSPECT_WIRE);
    const detail = await gtmAPI.getProspect("brand-1", "lead_1");

    expect(detail.leadId).toBe("lead_1");
    expect(detail.profile.profileUrl).toBe("https://www.linkedin.com/in/example/");
    expect(detail.profile.name.value).toBe("Priya Patel");
    expect(detail.profile.name.sourceSurface).toBe("LINKEDIN_PROFILE_PAGE");
    expect(detail.profile.name.observedAt).toBe("2025-01-04T10:00:00+00:00");
    expect(detail.profile.acvTier.isDerived).toBe(true);
    expect(detail.recommendedChannel).toBe("LINKEDIN");
    expect(detail.updatedAt).toBe("2025-01-04T11:00:00+00:00");
  });

  it("keeps the four dimensions as four fields beside the summary", async () => {
    respondWith(PROSPECT_WIRE);
    const { state } = await gtmAPI.getProspect("brand-1", "lead_1");

    expect(state.relationshipState.value).toBe("CONNECTED");
    expect(state.conversationState.value).toBe("WAITING_FOR_REPLY");
    expect(state.conversationStage.value).toBe("WARMUP");
    expect(state.executionState.value).toBe("ACTION_REQUESTED");
    expect(state.activityLevel.isUnknown).toBe(true);
    expect(state.confirmationStatus).toBe("WAITING_FOR_CONFIRMATION");
    expect(state.displaySummary).toBe("Connected · waiting for a reply");
    expect(state.displaySummaryIsDerived).toBe(true);
  });

  it("reports a null value as unknown even when the payload claims otherwise", async () => {
    respondWith(PROSPECT_WIRE);
    const { profile } = await gtmAPI.getProspect("brand-1", "lead_1");
    expect(profile.headline.value).toBeNull();
    expect(profile.headline.isUnknown).toBe(true);
  });

  it("carries an absent score as null, never as zero", async () => {
    respondWith(PROSPECT_WIRE);
    const { activity } = await gtmAPI.getProspect("brand-1", "lead_1");
    expect(activity.score.score).toBeNull();
    expect(activity.score.isDerived).toBe(true);
    expect(activity.score.scoreDisclaimer).toBe(SCORE_WIRE.score_disclaimer);
    expect(activity.level.isUnknown).toBe(true);
  });

  it("passes the activity component keys through untouched", async () => {
    respondWith(PROSPECT_WIRE);
    const { activity } = await gtmAPI.getProspect("brand-1", "lead_1");
    expect(Object.keys(activity.components)).toEqual([
      "recency",
      "frequency",
      "breadth",
      "consistency",
    ]);
  });

  it("keeps unavailable factors listed rather than dropped", async () => {
    respondWith(PROSPECT_WIRE);
    const [linkedin] = (await gtmAPI.getProspect("brand-1", "lead_1")).channels;

    expect(linkedin.unavailableFactors).toEqual(["phone_available"]);
    expect(linkedin.availableWeightMass).toBe(85);
    expect(linkedin.reasoning).toHaveLength(2);
    expect(linkedin.reasoning[1]).toMatchObject({
      factor: "phone_available",
      available: false,
      direction: "UNAVAILABLE",
      unavailableReason: "no phone on the lead record",
      contributionHundredths: null,
    });
  });

  it("keeps the three message content fields separate and retains prior versions", async () => {
    respondWith(PROSPECT_WIRE);
    const detail = await gtmAPI.getProspect("brand-1", "lead_1");

    expect(detail.latestMessage?.generatedContent).toBe("Congrats on the launch.");
    expect(detail.latestMessage?.editedContent).toBeNull();
    expect(detail.latestMessage?.sentContent).toBeNull();
    expect(detail.latestMessage?.charLimit).toBe(300);
    expect(detail.messageVersions.map((m) => m.version)).toEqual([2, 1]);
  });

  it("carries the next action's payload and the confirmation beside it", async () => {
    respondWith(PROSPECT_WIRE);
    const { nextAction } = await gtmAPI.getProspect("brand-1", "lead_1");

    expect(nextAction?.actionType).toBe("SEND_MESSAGE");
    expect(nextAction?.payloadText).toBe("Congrats on the launch.");
    expect(nextAction?.destinationUrl).toBe("https://www.linkedin.com/in/example/");
    expect(nextAction?.reasoning).toEqual(["Connected, and the thread has not started."]);
    expect(nextAction?.latestAction?.actionId).toBe("act_1");
    expect(nextAction?.latestAction?.confirmationStatus).toBe("WAITING_FOR_CONFIRMATION");
    expect(nextAction?.latestAction?.attemptsRemaining).toBe(3);
    expect(nextAction?.isSuppressed).toBe(false);
  });

  it("reports no channels and no winner when no evaluation has run", async () => {
    respondWith({
      ...PROSPECT_WIRE,
      channels: [],
      recommended_channel: null,
      next_action: null,
      latest_message: null,
      message_versions: [],
    });
    const detail = await gtmAPI.getProspect("brand-1", "lead_1");

    expect(detail.channels).toEqual([]);
    expect(detail.recommendedChannel).toBeNull();
    expect(detail.nextAction).toBeNull();
    expect(detail.latestMessage).toBeNull();
    expect(detail.messageVersions).toEqual([]);
  });
});

describe("unknownFact", () => {
  it("is absence, not a value", () => {
    expect(unknownFact()).toEqual({
      value: null,
      isUnknown: true,
      sourceSurface: null,
      observedAt: null,
      isStale: false,
      isDerived: false,
    });
  });
});

describe("the write routes", () => {
  it("requests an action with a snake_case body and its idempotency key", async () => {
    respondWith(ACTION_WIRE);
    const action = await gtmAPI.requestAction("brand-1", "lead_1", {
      actionType: "SEND_MESSAGE",
      messageId: "msg_1",
      idempotencyKey: "lead_1:SEND_MESSAGE:msg_1:2",
    });

    const [url, options] = lastCall();
    expect(url).toBe(
      `${GTM_BASE_URL}/prospect/lead_1/action/request?brand_id=brand-1`
    );
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({
      action_type: "SEND_MESSAGE",
      message_id: "msg_1",
      idempotency_key: "lead_1:SEND_MESSAGE:msg_1:2",
    });
    expect(action?.destinationUrl).toBe("https://www.linkedin.com/in/example/");
    expect(action?.executionState).toBe("ACTION_REQUESTED");
    expect(action?.linkedinOpenedAt).toBeNull();
  });

  it("marks a destination as opened without a body", async () => {
    respondWith({ ...ACTION_WIRE, execution_state: "ACTION_IN_PROGRESS" });
    const action = await gtmAPI.markOpened("brand-1", "act_1");

    const [url, options] = lastCall();
    expect(url).toBe(`${GTM_BASE_URL}/action/act_1/opened?brand_id=brand-1`);
    expect(options.method).toBe("POST");
    expect(options.body).toBeUndefined();
    expect(action?.executionState).toBe("ACTION_IN_PROGRESS");
  });

  it("confirms an outcome with the operator's own text", async () => {
    respondWith({ ...ACTION_WIRE, execution_state: "VERIFIED", confirmation_status: "CONFIRMED" });
    const action = await gtmAPI.confirmAction("brand-1", "act_1", {
      sentText: "Congrats on the launch.",
      observedAt: "2025-01-04T12:00:00+00:00",
    });

    expect(JSON.parse((lastCall()[1].body as string) ?? "{}")).toEqual({
      sent_text: "Congrats on the launch.",
      observed_at: "2025-01-04T12:00:00+00:00",
    });
    expect(action?.confirmationStatus).toBe("CONFIRMED");
    expect(action?.executionState).toBe("VERIFIED");
  });

  it("saves an edit through PATCH, to edited_content and nowhere else", async () => {
    respondWith({ ...MESSAGE_WIRE, edited_content: "My own words." });
    const message = await gtmAPI.saveEdit("brand-1", "msg_1", "My own words.");

    const [url, options] = lastCall();
    expect(url).toBe(`${GTM_BASE_URL}/message/msg_1?brand_id=brand-1`);
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body as string)).toEqual({
      edited_content: "My own words.",
    });
    expect(message?.editedContent).toBe("My own words.");
    expect(message?.generatedContent).toBe("Congrats on the launch.");
  });

  it("returns a failed generation as a record rather than raising", async () => {
    respondWith({
      ...MESSAGE_WIRE,
      generated_content: null,
      generation_failure_reason: "the fabrication guard rejected two claims",
    });
    const message = await gtmAPI.generateMessage("brand-1", "lead_1", { purpose: "CTA" });

    expect(JSON.parse((lastCall()[1].body as string) ?? "{}")).toEqual({ purpose: "CTA" });
    expect(message?.generatedContent).toBeNull();
    expect(message?.generationFailureReason).toBe(
      "the fabrication guard rejected two claims"
    );
  });

  it("defaults a generation to the warmup purpose", async () => {
    respondWith(MESSAGE_WIRE);
    await gtmAPI.generateMessage("brand-1", "lead_1");
    expect(JSON.parse((lastCall()[1].body as string) ?? "{}")).toEqual({ purpose: "WARMUP" });
  });

  it("regenerates as a new version, leaving the predecessor alone", async () => {
    respondWith({ ...MESSAGE_WIRE, message_id: "msg_2", version: 3 });
    const message = await gtmAPI.regenerate("brand-1", "msg_1");

    expect(lastCall()[0]).toBe(`${GTM_BASE_URL}/message/msg_1/regenerate?brand_id=brand-1`);
    expect(message?.version).toBe(3);
  });

  it("reports a deduped observation as an outcome, not a failure", async () => {
    respondWith({
      outcome: "DEDUPED",
      purpose: "ACTIVITY",
      job_id: 41,
      source_surface: "LINKEDIN_ACTIVITY_TAB",
      deduped: true,
      reason: "an identical read is already queued",
    });
    const enqueued = await gtmAPI.observe("brand-1", "lead_1", {
      purpose: "ACTIVITY",
      url: "https://www.linkedin.com/in/example/recent-activity/all/",
    });

    expect(JSON.parse((lastCall()[1].body as string) ?? "{}")).toEqual({
      purpose: "ACTIVITY",
      url: "https://www.linkedin.com/in/example/recent-activity/all/",
      priority: 0,
    });
    expect(enqueued).toEqual({
      outcome: "DEDUPED",
      purpose: "ACTIVITY",
      jobId: 41,
      sourceSurface: "LINKEDIN_ACTIVITY_TAB",
      deduped: true,
      reason: "an identical read is already queued",
    });
  });

  it("records an outcome with its evidence, and reports a re-record as not recorded", async () => {
    respondWith({
      outcome_id: "out_1",
      channel_used: "LINKEDIN",
      outcome_class: "REPLIED",
      observed_at: "2025-01-05T08:00:00+00:00",
      source_surface: "LINKEDIN_MESSAGING_THREAD",
      recorded: false,
    });
    const recorded = await gtmAPI.recordOutcome("brand-1", "lead_1", {
      channelUsed: "LINKEDIN",
      outcomeClass: "REPLIED",
      sourceSurface: "LINKEDIN_MESSAGING_THREAD",
      observedAt: "2025-01-05T08:00:00+00:00",
      actionId: "act_1",
    });

    expect(JSON.parse((lastCall()[1].body as string) ?? "{}")).toEqual({
      channel_used: "LINKEDIN",
      outcome_class: "REPLIED",
      source_surface: "LINKEDIN_MESSAGING_THREAD",
      observed_at: "2025-01-05T08:00:00+00:00",
      observed_value: null,
      confidence: "MEDIUM",
      observation_ref: null,
      recommendation_id: null,
      action_id: "act_1",
    });
    expect(recorded.recorded).toBe(false);
    expect(recorded.outcomeId).toBe("out_1");
  });

  it("returns an unchanged re-evaluation with persisted false", async () => {
    respondWith({
      evaluation_id: "eval_1",
      channels: PROSPECT_WIRE.channels,
      recommended_channel: "LINKEDIN",
      weight_set_label: "default_v1",
      computed_at: "2025-01-04T10:30:00+00:00",
      persisted: false,
    });
    const evaluation = await gtmAPI.recommendChannel("brand-1", "lead_1");

    expect(lastCall()[0]).toBe(
      `${GTM_BASE_URL}/prospect/lead_1/recommend-channel?brand_id=brand-1`
    );
    expect(evaluation.persisted).toBe(false);
    expect(evaluation.weightSetLabel).toBe("default_v1");
    expect(evaluation.channels[0].channel).toBe("LINKEDIN");
  });
});

describe("the read routes", () => {
  it("reads CTA readiness without recomputing it", async () => {
    respondWith(PROSPECT_WIRE.cta);
    const cta = await gtmAPI.getCTA("brand-1", "lead_1");

    expect(lastCall()[0]).toBe(`${GTM_BASE_URL}/prospect/lead_1/cta?brand_id=brand-1`);
    expect(cta.ctaState).toBe("NOT_READY");
    expect(cta.decidedBy).toBe("score_band");
    expect(cta.score.score).toBe(30);
  });

  it("pages the timeline on the server's opaque cursor", async () => {
    respondWith({
      entries: [
        {
          event_id: "evt_1",
          event_type: "SEND_ACTION_REQUESTED",
          event_at: "2025-01-04T11:00:00+00:00",
          summary: "Send requested by the operator",
          outcome: "APPLIED",
          dimension: "execution_state",
          prior_value: "NOT_STARTED",
          new_value: "ACTION_REQUESTED",
          actor_id: "user_1",
          actor_type: "USER",
          evidence_id: "ev_1",
          evidence_source_surface: "WEEZ_UI_CLICK",
          evidence_observed_value: "clicked",
          evidence_observed_at: "2025-01-04T11:00:00+00:00",
          evidence_confidence: "HIGH",
          related_action_id: "act_1",
          related_message_id: "msg_1",
        },
      ],
      next_cursor: "2025-01-04T11:00:00+00:00|evt_1",
      has_more: true,
    });
    const page = await gtmAPI.getTimeline("brand-1", "lead_1", {
      limit: 25,
      cursor: "2025-01-03T00:00:00+00:00|evt_0",
      newestFirst: true,
    });

    const [url] = lastCall();
    expect(url).toContain("/prospect/lead_1/timeline?");
    expect(url).toContain("brand_id=brand-1");
    expect(url).toContain("limit=25");
    expect(url).toContain("newest_first=true");
    expect(url).toContain("cursor=2025-01-03T00%3A00%3A00%2B00%3A00%7Cevt_0");

    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("2025-01-04T11:00:00+00:00|evt_1");
    expect(page.entries[0]).toMatchObject({
      eventId: "evt_1",
      eventType: "SEND_ACTION_REQUESTED",
      priorValue: "NOT_STARTED",
      newValue: "ACTION_REQUESTED",
      actorType: "USER",
      evidenceSourceSurface: "WEEZ_UI_CLICK",
      relatedActionId: "act_1",
    });
  });

  it("drops absent query parameters rather than sending them as strings", async () => {
    respondWith({ entries: [], next_cursor: null, has_more: false });
    await gtmAPI.getTimeline("brand-1", "lead_1");

    const [url] = lastCall();
    expect(url).toBe(`${GTM_BASE_URL}/prospect/lead_1/timeline?brand_id=brand-1`);
  });

  it("reads one action's execution state and confirmation status together", async () => {
    respondWith({
      ...ACTION_WIRE,
      execution_state: "VERIFICATION_PENDING",
      confirmation_status: "UNKNOWN",
      verification_attempts: 3,
      attempts_remaining: 0,
    });
    const action = await gtmAPI.getAction("brand-1", "act_1");

    expect(lastCall()[0]).toBe(`${GTM_BASE_URL}/action/act_1?brand_id=brand-1`);
    expect(action?.executionState).toBe("VERIFICATION_PENDING");
    expect(action?.confirmationStatus).toBe("UNKNOWN");
    expect(action?.attemptsRemaining).toBe(0);
    expect(action?.isVerified).toBe(false);
    expect(action?.failureReason).toBeNull();
  });

  it("pages the ranked queue with the four dimensions on every row", async () => {
    respondWith({
      items: [
        {
          lead_id: "lead_1",
          profile_id: "prof_1",
          profile_url: "https://www.linkedin.com/in/example/",
          name: { ...OBSERVED, value: "Priya Patel" },
          headline: UNKNOWN_WIRE,
          company: { ...OBSERVED, value: "Brightloop" },
          score: SCORE_WIRE,
          recommended_channel: "LINKEDIN",
          confidence: "MEDIUM",
          recommendation: "LINKEDIN_WARMUP_MESSAGE",
          activity: ACTIVITY_WIRE,
          state: STATE_WIRE,
          next_action_type: "SEND_MESSAGE",
          updated_at: "2025-01-04T11:00:00+00:00",
        },
      ],
      next_cursor: "72|lead_1",
      has_more: true,
    });
    const page = await gtmAPI.listProspects("brand-1", { sort: "score", limit: 25 });

    const [url] = lastCall();
    expect(url).toContain("sort=score");
    expect(url).toContain("limit=25");
    expect(page.items[0].score.score).toBe(72);
    expect(page.items[0].nextActionType).toBe("SEND_MESSAGE");
    expect(page.items[0].state.relationshipState.value).toBe("CONNECTED");
    expect(page.items[0].state.activityLevel.isUnknown).toBe(true);
    expect(page.nextCursor).toBe("72|lead_1");
  });
});

// ─── 3. No credential field, anywhere (R15.2) ─────────────────────────────────

describe("the credential prohibition", () => {
  // Resolved from the project root rather than from `import.meta.url`: the jsdom
  // environment gives this module an http-scheme URL, which `readFileSync` refuses.
  const source = readFileSync(resolve(process.cwd(), "src/services/gtmAPI.ts"), "utf8");

  /**
   * Every field name declared inside an `interface` block of the module.
   *
   * Comments are stripped first: the module's own docblocks discuss tokens and the
   * `Authorization` header on purpose, and a scan that cannot tell prose from a
   * declaration would fail on the very text that explains the rule.
   */
  function declaredFieldNames(): string[] {
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const names: string[] = [];
    const blocks = stripped.matchAll(/\binterface\s+\w+\s*\{([\s\S]*?)\n\}/g);
    for (const [, body] of blocks) {
      for (const line of body.split("\n")) {
        const field = line.match(/^\s{2}(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/);
        if (field) names.push(field[1]);
      }
    }
    return names;
  }

  it("declares a field on every payload type, so the scan has something to read", () => {
    const names = declaredFieldNames();
    expect(names.length).toBeGreaterThan(150);
    // A spot check that both vocabularies were reached: the camelCase types the
    // components read, and the snake_case wire shapes they are mapped from.
    expect(names).toContain("isUnknown");
    expect(names).toContain("is_unknown");
    expect(names).toContain("destinationUrl");
  });

  it("declares no credential-shaped field on any type", () => {
    const offenders = declaredFieldNames().filter((name) =>
      CREDENTIAL_FIELD_PATTERN.test(name)
    );
    expect(offenders).toEqual([]);
  });

  it("carries no credential-shaped key through a fully populated payload", async () => {
    respondWith(PROSPECT_WIRE);
    const detail = await gtmAPI.getProspect("brand-1", "lead_1");

    const keys = new Set<string>();
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === "object") {
        Object.entries(node as Record<string, unknown>).forEach(([key, value]) => {
          keys.add(key);
          walk(value);
        });
      }
    };
    walk(detail);

    expect(keys.size).toBeGreaterThan(40);
    expect([...keys].filter((key) => CREDENTIAL_FIELD_PATTERN.test(key))).toEqual([]);
  });

  it("carries no credential-shaped key into a request body", async () => {
    respondWith(ACTION_WIRE);
    await gtmAPI.requestAction("brand-1", "lead_1", {
      actionType: "SEND_MESSAGE",
      messageId: "msg_1",
      idempotencyKey: "lead_1:SEND_MESSAGE:msg_1:2",
    });
    const body = JSON.parse((lastCall()[1].body as string) ?? "{}");
    expect(
      Object.keys(body).filter((key) => CREDENTIAL_FIELD_PATTERN.test(key))
    ).toEqual([]);
  });
});
