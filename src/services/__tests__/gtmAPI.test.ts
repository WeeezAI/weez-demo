// services/__tests__/gtmAPI.test.ts
//
// Five things are checked here, and they are the five things the service module
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
//
// 4. **One route, one wrapper (property 45).** Every member of the client is invoked
//    and the request path it issues is read off the transport, so no route ends up
//    with a second wrapper and each of the two new routes has exactly one.
//
// 5. **The two new wrappers (R15.5, R15.6, R20.9).** `getAttentionFeed` and
//    `getDailyAnalytics`: what reaches the query string when a parameter is set and
//    what leaves it when one is not, and the wire→domain mapping — above all that a
//    metric the server did not compute arrives as a *missing map entry* rather than
//    as `null` or `0`, which is property 36's client half.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import gtmAPI, {
  GTM_BASE_URL,
  unknownFact,
  type AnalyticsMetricKey,
} from "../gtmAPI";

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

// ─── 4. One route, one wrapper (R10.10, R15.10, R20.3) ────────────────────────

/**
 * Feature: sales-workflow-frontend-restructure, Property 45: One route, one wrapper.
 *
 * *For any* GTM route path, at most one member of the API client issues a request to
 * it, and each of the two new routes has exactly one.
 *
 * The scan is deliberately **programmatic rather than a list of member names**. A
 * hard-coded list asserts what somebody remembered to write down; the failure this
 * property exists to catch is a *second* wrapper added later for a route that already
 * has one, and a list would grow to accommodate it. So every function-valued member of
 * the default export is invoked against a stubbed transport and the path it actually
 * requested is read back off `fetch`.
 *
 * Two things make the invocation generic. Every member takes the brand as its first
 * argument and, at most, a path identifier and one options object after it, so the same
 * three arguments reach all of them: a member that reads `query.limit` off a string
 * finds `undefined` and drops the parameter, which is the behaviour `gtmQuery` already
 * has for an unset value. And the request leaves the module *before* the response is
 * mapped, so a mapping that rejects an empty stub body has already told the scan what
 * it needed — the throw is caught and discarded.
 *
 * The route is the path with the query string removed and the generated identifier
 * folded back to `{id}`. The brand travels as a query parameter on every route and is
 * not part of any route's identity; the identifier is a path segment and is.
 */
describe("Feature: sales-workflow-frontend-restructure, Property 45: One route, one wrapper", () => {
  /** The two routes this feature adds, as the design fixes their paths (§5.1, §5.2). */
  const NEW_ROUTES = ["/attention-feed", "/analytics/daily"] as const;

  type ClientMember = (...args: unknown[]) => Promise<unknown>;

  /**
   * Identifiers carry an `id-` prefix so a generated value can never collide with a
   * literal path segment — `/credits` normalising to `/{id}` because the generator
   * happened to produce "credits" would invent a duplicate that does not exist.
   */
  const idTokenArb = fc.string().map((suffix) => `id-${suffix}`);
  const brandIdArb = fc.string({ minLength: 1 });

  function clientMembers(): [string, ClientMember][] {
    return Object.entries(gtmAPI as unknown as Record<string, unknown>).filter(
      (entry): entry is [string, ClientMember] => typeof entry[1] === "function"
    );
  }

  /** The path a request went to, with the brand's query string and the id folded out. */
  function routeOf(url: string, idToken: string): string {
    expect(url.startsWith(`${GTM_BASE_URL}/`)).toBe(true);
    const [path] = url.slice(GTM_BASE_URL.length).split("?");
    const encodedId = encodeURIComponent(idToken);
    return path
      .split("/")
      .map((segment) => (segment === encodedId ? "{id}" : segment))
      .join("/");
  }

  /** Route → the members that issued a request to it, each labelled with its verb. */
  async function scanRoutes(
    brandId: string,
    idToken: string
  ): Promise<Map<string, string[]>> {
    const routes = new Map<string, string[]>();

    for (const [name, member] of clientMembers()) {
      fetchMock.mockClear();
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

      try {
        await member(brandId, idToken, idToken);
      } catch {
        // The mapping rejected the empty stub body. Irrelevant here: the request had
        // already left, and its url is the whole of what this scan reads.
      }

      const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
      // Not a formality. A member that issued nothing would be invisible to the
      // uniqueness check below, which is how a scan silently stops covering the client.
      expect(calls.length, `${name} issued no request`).toBe(1);

      const [url, options] = calls[0];
      const route = routeOf(String(url), idToken);
      const label = `${name} (${options?.method ?? "GET"})`;
      routes.set(route, [...(routes.get(route) ?? []), label]);
    }

    return routes;
  }

  it("reaches every member of the client, so the scan is not vacuous", async () => {
    const members = clientMembers();
    expect(members.length).toBeGreaterThan(25);

    const routes = await scanRoutes("brand-1", "id-lead_1");
    // One route recorded per member: no member was skipped, and none was double-counted.
    expect([...routes.values()].flat()).toHaveLength(members.length);
  });

  it("issues at most one member's request to any route path", async () => {
    await fc.assert(
      fc.asyncProperty(brandIdArb, idTokenArb, async (brandId, idToken) => {
        const routes = await scanRoutes(brandId, idToken);
        const duplicated = [...routes.entries()].filter(
          ([, members]) => members.length > 1
        );
        // Reported as route → members so a failure names the second wrapper rather
        // than only counting it.
        expect(Object.fromEntries(duplicated)).toEqual({});
      }),
      { numRuns: 100 }
    );
  });

  it("exposes exactly one wrapper for the attention feed and one for the daily analytics", async () => {
    await fc.assert(
      fc.asyncProperty(brandIdArb, idTokenArb, async (brandId, idToken) => {
        const routes = await scanRoutes(brandId, idToken);
        for (const route of NEW_ROUTES) {
          expect(routes.get(route) ?? [], `wrappers for ${route}`).toHaveLength(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("names the one wrapper each new route has", async () => {
    const routes = await scanRoutes("brand-1", "id-lead_1");
    expect(routes.get("/attention-feed")).toEqual(["getAttentionFeed (GET)"]);
    expect(routes.get("/analytics/daily")).toEqual(["getDailyAnalytics (GET)"]);
  });
});

// ─── 5. The two new wrappers (R15.5, R15.6, R20.9) ────────────────────────────
//
// Two halves, and they fail for different reasons. Serialisation is about what the
// server is asked: an unset parameter must be *absent* from the query string, because
// the server owns the defaults and a client-side copy of them is a second opinion that
// drifts. Mapping is about what the answer is allowed to say, and the one statement
// that matters is absence — see the property-36 block below.

/** The six metric keys, in the order the type declares them. */
const ALL_METRIC_KEYS: readonly AnalyticsMetricKey[] = [
  "prospects_contacted",
  "state_changed",
  "most_likely_to_close",
  "at_risk",
  "meetings_booked",
  "meetings_completed",
];

const ATTENTION_ITEM_WIRE = {
  lead_id: "lead_1",
  prospect_name: { ...OBSERVED, value: "Priya Patel" },
  company: { ...OBSERVED, value: "Brightloop" },
  trigger: "PROSPECT_REPLIED",
  reason: "Priya replied yesterday and the thread is waiting on you.",
  required_response: "Review and respond",
  consequence_tier: "IMMEDIATE",
  escalated_from: null,
  escalation_reason: null,
  due_at: "2025-01-04T09:00:00+00:00",
  computed_at: "2025-01-04T12:00:00+00:00",
  route: "/prospect/lead_1",
  criteria: [{ field: "trigger", operator: "EQUALS", values: ["PROSPECT_REPLIED"] }],
};

const ATTENTION_FEED_WIRE = {
  period_days: 7,
  computed_at: "2025-01-04T12:00:00+00:00",
  summary: {
    total: 2,
    // Two of the four bands and two of the nine triggers: the keys the server counted
    // and no others.
    by_tier: { IMMEDIATE: 1, MATERIAL: 1 },
    by_trigger: { PROSPECT_REPLIED: 1, AT_RISK_OR_LOSING: 1 },
  },
  items: [
    ATTENTION_ITEM_WIRE,
    {
      ...ATTENTION_ITEM_WIRE,
      lead_id: "lead_2",
      prospect_name: { ...OBSERVED, value: "Dev Rao" },
      trigger: "AT_RISK_OR_LOSING",
      consequence_tier: "MATERIAL",
      escalated_from: "IMPORTANT",
      escalation_reason: "the deal value moved this into the material band",
      due_at: "2025-01-03T09:00:00+00:00",
      route: "/prospect/lead_2",
    },
  ],
};

/**
 * The analytics fixture, built so every case property 36 cares about is present in one
 * payload and can be told from the others:
 *
 * | metric | day 1 (`2025-01-01`) | day 2 (`2025-01-02`) |
 * |---|---|---|
 * | `prospects_contacted` | measured `3` | measured `1` |
 * | `state_changed` | **measured `0`** — the query ran and found nobody | measured `2` |
 * | `most_likely_to_close` | present, `trend: null` (no prior day) | present, `trend: "RISING"` |
 * | `at_risk` | **key omitted** by the server | measured `0` |
 * | `meetings_booked` | **key sent as `null`** | measured `1` |
 * | `meetings_completed` | present with **no `count`**, two lead ids | measured `0` |
 */
const ANALYTICS_WIRE = {
  brand_id: "brand-1",
  days: 2,
  start_date: "2025-01-01",
  end_date: "2025-01-02",
  computed_at: "2025-01-04T12:00:00+00:00",
  rows: [
    {
      date: "2025-01-01",
      metrics: {
        prospects_contacted: {
          count: 3,
          lead_ids: ["lead_1", "lead_2", "lead_3"],
          criteria: [{ field: "outreach_sent_at", operator: "WITHIN_DAYS", values: ["1"] }],
        },
        state_changed: {
          count: 0,
          lead_ids: [],
          criteria: [{ field: "state_changed_at", operator: "WITHIN_DAYS", values: ["1"] }],
        },
        most_likely_to_close: {
          count: 1,
          lead_ids: ["lead_1"],
          criteria: [{ field: "lead_score", operator: "AT_LEAST", values: ["70"] }],
          trend: null,
        },
        // `at_risk` is absent: no key at all.
        meetings_booked: null,
        meetings_completed: {
          // No `count`: the list's own length is the count the server held.
          lead_ids: ["lead_1", "lead_2"],
          criteria: [{ field: "meeting_completed_at", operator: "WITHIN_DAYS", values: ["1"] }],
        },
      },
    },
    {
      date: "2025-01-02",
      metrics: {
        prospects_contacted: { count: 1, lead_ids: ["lead_4"], criteria: [] },
        state_changed: { count: 2, lead_ids: ["lead_1", "lead_4"], criteria: [] },
        most_likely_to_close: {
          count: 2,
          lead_ids: ["lead_1", "lead_4"],
          criteria: [{ field: "lead_score", operator: "AT_LEAST", values: ["70"] }],
          trend: "RISING",
        },
        at_risk: { count: 0, lead_ids: [], criteria: [] },
        meetings_booked: { count: 1, lead_ids: ["lead_1"], criteria: [] },
        meetings_completed: { count: 0, lead_ids: [], criteria: [] },
      },
    },
  ],
};

describe("getAttentionFeed", () => {
  it("serialises the lookback, the band and the cap beside the brand", async () => {
    respondWith(ATTENTION_FEED_WIRE);
    await gtmAPI.getAttentionFeed("brand-1", {
      periodDays: 30,
      tier: "IMMEDIATE",
      limit: 10,
    });

    const [url] = lastCall();
    expect(url).toBe(
      `${GTM_BASE_URL}/attention-feed?brand_id=brand-1&period_days=30&tier=IMMEDIATE&limit=10`
    );
  });

  it("sends the brand alone when nothing was asked for, so the server's defaults are the only defaults", async () => {
    respondWith(ATTENTION_FEED_WIRE);
    await gtmAPI.getAttentionFeed("brand-1");

    const [url] = lastCall();
    expect(url).toBe(`${GTM_BASE_URL}/attention-feed?brand_id=brand-1`);
    // The failure this guards against is `period_days=undefined`, which the server
    // reads as a malformed integer rather than as an omission.
    expect(url).not.toContain("undefined");
    expect(url).not.toContain("period_days");
    expect(url).not.toContain("tier");
    expect(url).not.toContain("limit");
  });

  it("carries the parameters that were set and drops the ones that were not", async () => {
    respondWith(ATTENTION_FEED_WIRE);
    await gtmAPI.getAttentionFeed("brand-1", { tier: "MATERIAL" });

    const [url] = lastCall();
    expect(url).toBe(`${GTM_BASE_URL}/attention-feed?brand_id=brand-1&tier=MATERIAL`);
  });

  it("drops a null tier rather than narrowing to the string 'null'", async () => {
    respondWith(ATTENTION_FEED_WIRE);
    await gtmAPI.getAttentionFeed("brand-1", { tier: null, periodDays: 14 });

    const [url] = lastCall();
    expect(url).toBe(`${GTM_BASE_URL}/attention-feed?brand_id=brand-1&period_days=14`);
  });

  it("renames the feed's keys and keeps the server's order", async () => {
    respondWith(ATTENTION_FEED_WIRE);
    const feed = await gtmAPI.getAttentionFeed("brand-1");

    expect(feed.periodDays).toBe(7);
    expect(feed.computedAt).toBe("2025-01-04T12:00:00+00:00");
    expect(feed.items.map((item) => item.leadId)).toEqual(["lead_1", "lead_2"]);
    expect(feed.items[0]).toMatchObject({
      trigger: "PROSPECT_REPLIED",
      reason: "Priya replied yesterday and the thread is waiting on you.",
      requiredResponse: "Review and respond",
      consequenceTier: "IMMEDIATE",
      escalatedFrom: null,
      escalationReason: null,
      dueAt: "2025-01-04T09:00:00+00:00",
      route: "/prospect/lead_1",
    });
    expect(feed.items[0].prospectName.value).toBe("Priya Patel");
    expect(feed.items[0].criteria).toEqual([
      { field: "trigger", operator: "EQUALS", values: ["PROSPECT_REPLIED"] },
    ]);
    expect(feed.items[1].escalatedFrom).toBe("IMPORTANT");
    expect(feed.items[1].escalationReason).toBe(
      "the deal value moved this into the material band"
    );
  });

  it("leaves an uncounted band and an uncounted trigger missing from the summary", async () => {
    respondWith(ATTENTION_FEED_WIRE);
    const { summary } = await gtmAPI.getAttentionFeed("brand-1");

    expect(summary.total).toBe(2);
    expect(summary.byTier).toEqual({ IMMEDIATE: 1, MATERIAL: 1 });
    // Not counted is not counted-none: filling the two absent bands with `0` would
    // state a finding the server never made.
    expect("IMPORTANT" in summary.byTier).toBe(false);
    expect("OTHER" in summary.byTier).toBe(false);
    expect(Object.keys(summary.byTrigger)).toEqual([
      "PROSPECT_REPLIED",
      "AT_RISK_OR_LOSING",
    ]);
  });

  it("echoes the requested lookback only when the payload carried none", async () => {
    respondWith({ ...ATTENTION_FEED_WIRE, period_days: undefined });
    const echoed = await gtmAPI.getAttentionFeed("brand-1", { periodDays: 30 });
    expect(echoed.periodDays).toBe(30);

    // And the payload wins when both are present: the window the server actually
    // looked over is the one a surface states.
    respondWith({ ...ATTENTION_FEED_WIRE, period_days: 7 });
    const served = await gtmAPI.getAttentionFeed("brand-1", { periodDays: 30 });
    expect(served.periodDays).toBe(7);
  });

  it("reads an empty workspace as a success with no items", async () => {
    respondWith({ period_days: 7, computed_at: null, summary: { total: 0 }, items: [] });
    const feed = await gtmAPI.getAttentionFeed("brand-1");

    expect(feed.items).toEqual([]);
    expect(feed.computedAt).toBeNull();
    expect(feed.summary.total).toBe(0);
    expect(feed.summary.byTier).toEqual({});
  });
});

describe("getDailyAnalytics", () => {
  it("serialises the range length and the inclusive last day beside the brand", async () => {
    respondWith(ANALYTICS_WIRE);
    await gtmAPI.getDailyAnalytics("brand-1", { days: 30, endDate: "2025-01-31" });

    const [url] = lastCall();
    expect(url).toBe(
      `${GTM_BASE_URL}/analytics/daily?brand_id=brand-1&days=30&end_date=2025-01-31`
    );
  });

  it("sends the brand alone when nothing was asked for", async () => {
    respondWith(ANALYTICS_WIRE);
    await gtmAPI.getDailyAnalytics("brand-1");

    const [url] = lastCall();
    expect(url).toBe(`${GTM_BASE_URL}/analytics/daily?brand_id=brand-1`);
    expect(url).not.toContain("undefined");
    expect(url).not.toContain("days");
    expect(url).not.toContain("end_date");
  });

  it("carries a range with no end date, and an end date with no range", async () => {
    respondWith(ANALYTICS_WIRE);
    await gtmAPI.getDailyAnalytics("brand-1", { days: 14 });
    expect(lastCall()[0]).toBe(
      `${GTM_BASE_URL}/analytics/daily?brand_id=brand-1&days=14`
    );

    respondWith(ANALYTICS_WIRE);
    await gtmAPI.getDailyAnalytics("brand-1", { endDate: "2025-02-01" });
    expect(lastCall()[0]).toBe(
      `${GTM_BASE_URL}/analytics/daily?brand_id=brand-1&end_date=2025-02-01`
    );
  });

  it("drops a null end date rather than sending the string 'null'", async () => {
    respondWith(ANALYTICS_WIRE);
    await gtmAPI.getDailyAnalytics("brand-1", { days: 7, endDate: null });

    expect(lastCall()[0]).toBe(
      `${GTM_BASE_URL}/analytics/daily?brand_id=brand-1&days=7`
    );
  });

  it("renames the envelope and keeps one row per day in the server's order", async () => {
    respondWith(ANALYTICS_WIRE);
    const analytics = await gtmAPI.getDailyAnalytics("brand-1", { days: 2 });

    expect(analytics.brandId).toBe("brand-1");
    expect(analytics.days).toBe(2);
    expect(analytics.startDate).toBe("2025-01-01");
    expect(analytics.endDate).toBe("2025-01-02");
    expect(analytics.computedAt).toBe("2025-01-04T12:00:00+00:00");
    expect(analytics.rows.map((row) => row.date)).toEqual(["2025-01-01", "2025-01-02"]);
  });

  it("echoes the requested range only when the payload carried none", async () => {
    respondWith({ ...ANALYTICS_WIRE, days: undefined });
    const echoed = await gtmAPI.getDailyAnalytics("brand-1", { days: 30 });
    expect(echoed.days).toBe(30);

    respondWith({ ...ANALYTICS_WIRE, days: undefined });
    const neither = await gtmAPI.getDailyAnalytics("brand-1");
    expect(neither.days).toBe(7);
  });

  it("renames one present metric and links it to the prospects behind it", async () => {
    respondWith(ANALYTICS_WIRE);
    const [day1] = (await gtmAPI.getDailyAnalytics("brand-1")).rows;

    expect(day1.metrics.prospects_contacted).toEqual({
      count: 3,
      leadIds: ["lead_1", "lead_2", "lead_3"],
      criteria: [{ field: "outreach_sent_at", operator: "WITHIN_DAYS", values: ["1"] }],
      trend: null,
    });
  });

  it("reads an empty range as no rows rather than as invented ones", async () => {
    respondWith({ ...ANALYTICS_WIRE, rows: [], computed_at: null });
    const analytics = await gtmAPI.getDailyAnalytics("brand-1");

    expect(analytics.rows).toEqual([]);
    expect(analytics.computedAt).toBeNull();
  });
});

/**
 * Feature: sales-workflow-frontend-restructure, Property 36 (client half): an
 * uncomputable metric is absent, a computed zero is zero.
 *
 * *For any* wire payload, the client maps a missing metric key to a **missing map
 * entry** rather than to `null` or `0`.
 *
 * Three cases, and the whole point is that they stay three: a key the server omitted,
 * a key the server sent as `null`, and a key carrying a measured `0`. The first two are
 * the same statement — "this was never computed" — and must collapse to one
 * representation, absence. The third is a finding and must survive as a number.
 *
 * A zero-filling mapper passes every other test in this file. It fails here, which is
 * why these assertions read the map's *own* keys rather than only its values: a
 * `metrics.at_risk` of `undefined` is indistinguishable by value from an entry
 * explicitly set to `undefined`, and only one of the two is absence.
 *
 * **Validates: Requirements 15.5, 15.6**
 */
describe("Feature: sales-workflow-frontend-restructure, Property 36 (client half): an uncomputable metric is absent", () => {
  /** Present as an own key of the metrics map — not merely non-`undefined`. */
  function has(row: { metrics: object }, key: AnalyticsMetricKey): boolean {
    return Object.prototype.hasOwnProperty.call(row.metrics, key);
  }

  it("maps a key the server omitted to a missing entry, not to null and not to zero", async () => {
    respondWith(ANALYTICS_WIRE);
    const [day1] = (await gtmAPI.getDailyAnalytics("brand-1")).rows;

    expect(has(day1, "at_risk")).toBe(false);
    expect(day1.metrics.at_risk).toBeUndefined();
    // Spelled out because these are the two wrong answers, not the same wrong answer:
    // a `null` says "computed, and the result was nothing", a `0` says "found nobody".
    expect(day1.metrics.at_risk).not.toBeNull();
    expect(day1.metrics.at_risk?.count).not.toBe(0);
  });

  it("maps a key the server sent as null to the same missing entry", async () => {
    respondWith(ANALYTICS_WIRE);
    const [day1] = (await gtmAPI.getDailyAnalytics("brand-1")).rows;

    expect(has(day1, "meetings_booked")).toBe(false);
    expect(day1.metrics.meetings_booked).toBeUndefined();
    // The two spellings of absence produce one shape, so a call site has one branch
    // to write rather than three.
    expect(Object.keys(day1.metrics)).not.toContain("meetings_booked");
    expect(Object.keys(day1.metrics)).not.toContain("at_risk");
  });

  it("keeps a measured zero as a present zero", async () => {
    respondWith(ANALYTICS_WIRE);
    const [day1] = (await gtmAPI.getDailyAnalytics("brand-1")).rows;

    expect(has(day1, "state_changed")).toBe(true);
    expect(day1.metrics.state_changed?.count).toBe(0);
    expect(day1.metrics.state_changed?.leadIds).toEqual([]);
    // A zero with its criteria attached is a query that ran, which is the difference
    // between it and the two absences above.
    expect(day1.metrics.state_changed?.criteria).toEqual([
      { field: "state_changed_at", operator: "WITHIN_DAYS", values: ["1"] },
    ]);
  });

  it("distinguishes the three cases within one day row", async () => {
    respondWith(ANALYTICS_WIRE);
    const [day1] = (await gtmAPI.getDailyAnalytics("brand-1")).rows;

    // Exactly the keys the payload carried a metric object for: the two absences are
    // gone and nothing was added to replace them.
    expect(Object.keys(day1.metrics).sort()).toEqual(
      ["prospects_contacted", "state_changed", "most_likely_to_close", "meetings_completed"].sort()
    );
    expect(Object.keys(day1.metrics)).toHaveLength(4);
  });

  it("holds no null value under any present key, on any row", async () => {
    respondWith(ANALYTICS_WIRE);
    const { rows } = await gtmAPI.getDailyAnalytics("brand-1");

    for (const row of rows) {
      for (const key of ALL_METRIC_KEYS) {
        const metric = row.metrics[key];
        // Either the key is not there, or it carries a metric object. There is no
        // third state — no `null`, no placeholder.
        if (has(row, key)) {
          expect(metric, `${row.date}.${key}`).not.toBeNull();
          expect(typeof metric?.count, `${row.date}.${key}`).toBe("number");
          expect(Array.isArray(metric?.leadIds), `${row.date}.${key}`).toBe(true);
        } else {
          expect(metric, `${row.date}.${key}`).toBeUndefined();
        }
      }
    }
  });

  it("counts a metric with no count from its own identifier list rather than as zero", async () => {
    respondWith(ANALYTICS_WIRE);
    const [day1] = (await gtmAPI.getDailyAnalytics("brand-1")).rows;

    // `count == len(lead_ids)` holds server-side, so the length is what the count was.
    // Falling back to `0` would report two counted prospects as none.
    expect(day1.metrics.meetings_completed?.count).toBe(2);
    expect(day1.metrics.meetings_completed?.leadIds).toEqual(["lead_1", "lead_2"]);
  });

  it("keeps count and leadIds in agreement on every present metric", async () => {
    respondWith(ANALYTICS_WIRE);
    const { rows } = await gtmAPI.getDailyAnalytics("brand-1");

    const seen: string[] = [];
    for (const row of rows) {
      for (const key of ALL_METRIC_KEYS) {
        const metric = row.metrics[key];
        if (!metric) continue;
        seen.push(`${row.date}.${key}`);
        expect(metric.count, `${row.date}.${key}`).toBe(metric.leadIds.length);
      }
    }
    // The scan is not vacuous: four metrics on day 1 and six on day 2.
    expect(seen).toHaveLength(10);
  });

  it("reports no direction rather than a flat one", async () => {
    respondWith(ANALYTICS_WIRE);
    const [day1, day2] = (await gtmAPI.getDailyAnalytics("brand-1")).rows;

    // The first day of a range has no prior day to compare against.
    expect(day1.metrics.most_likely_to_close?.trend).toBeNull();
    // And from the second day the server's own value travels through unchanged.
    expect(day2.metrics.most_likely_to_close?.trend).toBe("RISING");

    // The other five metrics carry no direction at all, and none of them acquired one.
    for (const row of [day1, day2]) {
      for (const key of ALL_METRIC_KEYS) {
        if (key === "most_likely_to_close") continue;
        const metric = row.metrics[key];
        if (!metric) continue;
        expect(metric.trend, `${row.date}.${key}`).toBeNull();
      }
    }
  });

  it("leaves every metric missing on a day the server could compute nothing for", async () => {
    respondWith({
      ...ANALYTICS_WIRE,
      rows: [{ date: "2025-01-03", metrics: {} }],
    });
    const [row] = (await gtmAPI.getDailyAnalytics("brand-1")).rows;

    // A day with nothing computable is still a row — it is the metrics that are
    // absent, not the day.
    expect(row.date).toBe("2025-01-03");
    expect(row.metrics).toEqual({});
    expect(Object.keys(row.metrics)).toEqual([]);
    for (const key of ALL_METRIC_KEYS) {
      expect(has(row, key), key).toBe(false);
    }
  });

  it("leaves every metric missing when the row carried no metrics object at all", async () => {
    respondWith({ ...ANALYTICS_WIRE, rows: [{ date: "2025-01-03" }] });
    const [row] = (await gtmAPI.getDailyAnalytics("brand-1")).rows;

    expect(row.metrics).toEqual({});
    for (const key of ALL_METRIC_KEYS) {
      expect(has(row, key), key).toBe(false);
    }
  });
});
