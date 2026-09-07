// pages/__tests__/GTMProspect.identity.test.tsx
//
// The identity gate: NULL is not NO_MATCH, and a url is not a verdict (R30.7, R3.2,
// R14.2).
//
// Two backend routes became reachable from the screen — `POST
// /gtm/lead/{lead_id}/resolve-identity` and `POST /gtm/prospect/{lead_id}/track` — and
// the interesting failures they invite are all failures of *claim*, not of plumbing.
// So every assertion here is about what the page tells the operator:
//
// 1. **`Track Prospect` exists exactly where the route would accept it.** `VERIFIED`
//    with an address, and nowhere else. The route answers 409 for the other cases, and
//    a control certain to be refused is a control that should not be on screen — so
//    the absence is asserted three times over, once per verdict that cannot admit it.
// 2. **The four verification states read as four different claims.** The one that
//    matters is the fourth: a NULL verdict means *nobody has tried*, which is a
//    different claim from `NO_MATCH` — the verdict that a search ran and found nobody.
//    `models/lead.py` states the prohibition at the column ("Do not backfill NULL to
//    NO_MATCH"); this file is the screen's half of it, and it asserts the two strings
//    are not equal rather than trusting that they look different.
// 3. **A provider's url never renders as confirmed identity.** A lead can arrive
//    carrying a LinkedIn address nothing has opened, so with a null verdict the whole
//    identity block is checked for the word "verified" as a claim — with a word
//    boundary, because "Unverified candidate profile" is precisely the label that
//    *should* be there.
// 4. **The load contract is untouched.** The gate renders from the prospect payload the
//    page already fetches, so the default load is still the two requests
//    `GTMProspect.compose.test.tsx` pins, and neither write fires until a control is
//    pressed. That is asserted here as well as there, because the regression this file
//    would introduce is a third read in front of the operator's first decision.
// 5. **Tracking is followed by a scoring call, from the client.** The track route sets
//    `nba_recompute_requested_at` and computes nothing — the backend's
//    `test_only_the_re_evaluation_route_scores` pins scoring to `recommend_channel`
//    alone — so a tracked prospect is invisible in the ranked queue until something
//    scores them. The page makes that second call, and the order of the two POSTs is
//    the assertion.
//
// The harness is `GTMProspect.a11y.test.tsx`'s, deliberately: `fetch` is stubbed by URL
// so the real `gtmAPI` normaliser runs from wire to DOM and back, `WebSocket` is a
// fake, and `ConversationSidebar` and `sonner` are mocked because they are existing
// chrome. Stubbing `fetch` rather than mocking `gtmAPI` is what lets "calls
// `trackProspect` then `recommendChannel`" be asserted as two real requests with real
// methods and real URLs, instead of as two spies that could both be wired to nothing.
//
// Nothing here re-tests a claim `GTMProspect.compose.test.tsx`,
// `GTMProspect.a11y.test.tsx` or `panels.test.tsx` already makes. The protected two are
// not touched.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GTMProspect from "../GTMProspect";
import {
  GTM_IDENTITY_LABELS,
  GTM_TRACKING_STATE_LABELS,
  GTM_VERIFICATION_LABELS,
} from "@/components/gtm/labels";
import { UNKNOWN_TEXT } from "@/components/gtm/ObservedValue";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

// ─── Wire fixtures, exactly as `schemas/gtm.py` serialises them ───────────────

const HOUR = 3600_000;
const DISCLAIMER = "A prioritisation signal, not a predicted probability of conversion.";
const CANDIDATE_URL = "https://www.linkedin.com/in/provider-candidate";
const RESOLVED_URL = "https://www.linkedin.com/in/ada-lovelace";

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

function wireChannel(channel: string, value: number) {
  return {
    channel,
    score: wireScore(value),
    confidence: "MEDIUM",
    recommendation: "LINKEDIN_WARMUP_MESSAGE",
    reasoning: [],
    unavailable_factors: [],
    available_weight_mass: 85,
    computed_at: iso(1),
  };
}

/**
 * The prospect payload, with the identity verdict left to the caller.
 *
 * The three `linkedin_*` keys are **absent by default**, which is the shape the server
 * actually serialises for a lead nobody has tried to identify: the model drops them
 * rather than sending nulls, so absence has one spelling on the wire too.
 */
function wireDetail(profileOver: Record<string, unknown> = {}) {
  return {
    lead_id: "lead-1",
    profile: {
      lead_id: "lead-1",
      profile_id: null,
      profile_url: null,
      public_identifier: null,
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
      ...profileOver,
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
      relationship_state: wireFact("CONNECTED"),
      conversation_state: wireFact("WARMUP_READY"),
      conversation_stage: wireFact("WARMUP", { is_derived: true }),
      execution_state: wireFact(null),
      activity_level: wireFact(null),
      confirmation_status: "NOT_APPLICABLE",
      display_summary: "Connected · warm-up ready",
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
    updated_at: iso(1),
  };
}

/** The profile block of a lead whose identity was confirmed against a real page. */
function verifiedProfile() {
  return {
    profile_id: "profile-1",
    profile_url: RESOLVED_URL,
    public_identifier: "ada-lovelace",
    linkedin_verification_status: "VERIFIED",
    linkedin_verified_at: iso(2),
    linkedin_match_confidence: 93,
  };
}

/** `IdentityResolutionOut` for an enqueued search with no verdict yet on record. */
function wireResolution(over: Record<string, unknown> = {}) {
  return {
    outcome: "ENQUEUED",
    job_id: 4101,
    deduped: false,
    reason: null,
    verification_status: null,
    verified_at: null,
    match_confidence: null,
    linkedin_url: null,
    attempt_id: null,
    stage: null,
    engine_used: null,
    candidate_count: null,
    failure_reason: null,
    attempted_at: null,
    ...over,
  };
}

/** `TrackProspectOut` for the first tracking decision on a verified prospect. */
function wireTracking(over: Record<string, unknown> = {}) {
  return {
    outcome: "TRACKING_STARTED",
    tracking_state: "TRACKING",
    profile_id: "profile-1",
    profile_url: RESOLVED_URL,
    created_profile: true,
    created_relationship: true,
    signal_id: "sig-genesis",
    ingest_outcome: "SIGNAL_APPLIED",
    apply_outcome: "DUPLICATE",
    state_version: 0,
    nba_marked: true,
    observation_job_id: 4102,
    observation_outcome: "ENQUEUED",
    ...over,
  };
}

/** `ChannelEvaluationOut` — three channels and the winner among them. */
function wireEvaluation() {
  return {
    evaluation_id: "eval-1",
    channels: [wireChannel("LINKEDIN", 78), wireChannel("EMAIL", 55), wireChannel("PHONE", 31)],
    recommended_channel: "LINKEDIN",
    weight_set_label: "weights-1",
    computed_at: iso(0),
    persisted: true,
  };
}

function wireTimelinePage() {
  return { entries: [], next_cursor: null, has_more: false };
}

// ─── Transport and socket stubs ───────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

/** Just enough WebSocket for the page to mount without one being available. */
class FakeSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(public url: string) {}
  close() {}
}

interface Call {
  url: string;
  method: string;
}

/** Every request the page made, with its method, in the order it made them. */
function calls(): Call[] {
  return fetchMock.mock.calls.map((call) => ({
    url: String(call[0]),
    method: String((call[1] as RequestInit | undefined)?.method ?? "GET"),
  }));
}

/**
 * Serve every route this file's page can reach.
 *
 * `/resolve-identity` and `/track` are matched before the bare prospect read, because
 * both contain the shorter path and matching that first would answer a write with a
 * payload.
 */
function serve(detail: unknown) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);
    let body: unknown = detail;
    if (url.includes("/timeline")) body = wireTimelinePage();
    else if (url.includes("/resolve-identity")) body = wireResolution();
    else if (url.includes("/track")) body = wireTracking();
    else if (url.includes("/recommend-channel")) body = wireEvaluation();
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

/** The loaded page, with the identity block on screen. */
async function renderWith(profileOver: Record<string, unknown> = {}) {
  serve(wireDetail(profileOver));
  const utils = renderPage();
  await screen.findByText("Ada Lovelace");
  return utils;
}

/** The identity block itself, scoped by structure rather than by copy. */
function identityBlock(): HTMLElement {
  return document.querySelector('[data-gtm-block="identity"]') as HTMLElement;
}

function trackButton(): HTMLElement | null {
  return screen.queryByRole("button", { name: GTM_IDENTITY_LABELS.track });
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

// ══════════════════════════════════════════════════════════════════════════════
// 1. VERIFIED — the one state that admits tracking
// ══════════════════════════════════════════════════════════════════════════════

describe("a verified identity", () => {
  it("offers Track Prospect as a real, focusable button", async () => {
    await renderWith(verifiedProfile());

    const track = trackButton() as HTMLElement;
    expect(track).toBeInTheDocument();

    // A real `<button>`, not a `div` with an `onClick`: the one thing that makes it
    // reachable, operable and announced without any of it being reimplemented here.
    expect(track.tagName).toBe("BUTTON");
    expect(track).toHaveAttribute("type", "button");
    track.focus();
    expect(document.activeElement).toBe(track);
    // The design system's focus treatment, which is what a visible ring depends on.
    expect(track).toHaveClass(
      "focus-visible:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "focus-visible:ring-offset-2",
    );

    // The verdict reads as the verdict, and the url reads as this prospect's profile.
    const block = identityBlock();
    expect(within(block).getByText(GTM_VERIFICATION_LABELS.VERIFIED)).toBeInTheDocument();
    expect(within(block).getByText(GTM_IDENTITY_LABELS.verifiedUrl)).toBeInTheDocument();
    expect(within(block).getByText(RESOLVED_URL)).toBeInTheDocument();
    // No refusal sentence, and no Enrich Now: there is nothing to explain away.
    expect(
      within(block).queryByText(GTM_IDENTITY_LABELS.cannotTrack.unresolved),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: GTM_IDENTITY_LABELS.resolve }),
    ).not.toBeInTheDocument();
  });

  it("tracks the prospect and then asks for a score, in that order", async () => {
    await renderWith(verifiedProfile());
    const before = calls().length;

    const user = userEvent.setup();
    await user.click(trackButton() as HTMLElement);

    // Both writes landed, and both are POSTs to the routes they claim to be.
    await waitFor(() =>
      expect(calls().filter((call) => call.url.includes("/recommend-channel"))).toHaveLength(1),
    );
    const writes = calls()
      .slice(before)
      .filter((call) => call.method === "POST");
    expect(writes).toHaveLength(2);

    // The order is the claim. Tracking sets a recompute mark and scores nothing —
    // `test_only_the_re_evaluation_route_scores` pins scoring to `recommend_channel`
    // alone — so the prospect is tracked but invisible in the queue until the second
    // call runs. A `recommend-channel` before the `track` would be scoring a prospect
    // who is not yet tracked.
    expect(writes[0].url).toContain("/prospect/lead-1/track");
    expect(writes[1].url).toContain("/prospect/lead-1/recommend-channel");
    // Brand-scoped, like every other GTM request.
    writes.forEach((call) => expect(call.url).toContain("brand_id=brand-1"));

    // And what the page says afterwards is what the server reported: the rows were
    // provisioned by this call, so the tracking row reads tracked.
    await waitFor(() =>
      expect(within(identityBlock()).getByText(GTM_IDENTITY_LABELS.tracked)).toBeInTheDocument(),
    );
    expect(
      within(identityBlock()).getByText(GTM_TRACKING_STATE_LABELS.TRACKING),
    ).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2 & 3. The three states that do not — and the one that is not a verdict at all
// ══════════════════════════════════════════════════════════════════════════════

describe("an identity that cannot be tracked", () => {
  it("says nobody has looked yet, in copy that is not the no-match copy", async () => {
    // No verdict on the payload at all, which is how every lead starts.
    await renderWith();

    expect(trackButton()).not.toBeInTheDocument();

    const block = identityBlock();
    // Absence reaches the value slot through `ObservedValue`, so it is spelled the way
    // absence is spelled everywhere else on this page.
    expect(within(block).getByText(UNKNOWN_TEXT)).toBeInTheDocument();
    // And the sentence beside it says *which* absence this is.
    expect(within(block).getByText(GTM_VERIFICATION_LABELS.UNRESOLVED)).toBeInTheDocument();
    expect(
      within(block).getByText(GTM_IDENTITY_LABELS.cannotTrack.unresolved),
    ).toBeInTheDocument();

    // The claim this whole file exists to protect: "nobody has looked" is not "we
    // looked and found nobody". Asserted on the strings themselves, so the two cannot
    // be quietly collapsed into one label, and on the DOM, so this state cannot render
    // the other one's copy.
    expect(GTM_VERIFICATION_LABELS.UNRESOLVED).not.toBe(GTM_VERIFICATION_LABELS.NO_MATCH);
    expect(within(block).queryByText(GTM_VERIFICATION_LABELS.NO_MATCH)).not.toBeInTheDocument();
    expect(
      within(block).queryByText(GTM_IDENTITY_LABELS.cannotTrack.noMatch),
    ).not.toBeInTheDocument();

    // The tracking row is "cannot be tracked yet", not "not tracked": one is a
    // precondition that has not been met, the other is a decision nobody has made.
    expect(
      within(block).getByText(GTM_TRACKING_STATE_LABELS.UNRESOLVED),
    ).toBeInTheDocument();
  });

  it("names the ambiguity for a possible match, and offers the search instead", async () => {
    await renderWith({
      linkedin_verification_status: "POSSIBLE_MATCH",
      linkedin_match_confidence: 61,
      profile_url: CANDIDATE_URL,
    });

    expect(trackButton()).not.toBeInTheDocument();

    const block = identityBlock();
    expect(within(block).getByText(GTM_VERIFICATION_LABELS.POSSIBLE_MATCH)).toBeInTheDocument();
    expect(
      within(block).getByText(GTM_IDENTITY_LABELS.cannotTrack.possibleMatch),
    ).toBeInTheDocument();
    // Its own copy, and neither of the other two verdicts'.
    expect(within(block).queryByText(GTM_VERIFICATION_LABELS.NO_MATCH)).not.toBeInTheDocument();
    expect(within(block).queryByText(GTM_VERIFICATION_LABELS.UNRESOLVED)).not.toBeInTheDocument();
    // A candidate was scored, so its confidence is worth showing beside the verdict.
    expect(within(block).getByText("61")).toBeInTheDocument();
    // An unconfirmed url is still an unconfirmed url, whatever the verdict says.
    expect(within(block).getByText(GTM_IDENTITY_LABELS.candidateUrl)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: GTM_IDENTITY_LABELS.resolve }),
    ).toBeInTheDocument();
  });

  it("reports a search that ran and found nobody as exactly that", async () => {
    await renderWith({ linkedin_verification_status: "NO_MATCH" });

    expect(trackButton()).not.toBeInTheDocument();

    const block = identityBlock();
    expect(within(block).getByText(GTM_VERIFICATION_LABELS.NO_MATCH)).toBeInTheDocument();
    expect(
      within(block).getByText(GTM_IDENTITY_LABELS.cannotTrack.noMatch),
    ).toBeInTheDocument();
    // Not the "nobody has tried" copy: an attempt is on record here.
    expect(within(block).queryByText(GTM_VERIFICATION_LABELS.UNRESOLVED)).not.toBeInTheDocument();
    expect(
      within(block).queryByText(GTM_IDENTITY_LABELS.cannotTrack.unresolved),
    ).not.toBeInTheDocument();
    // And no confidence, because no candidate was ever scored. Absent, not zero.
    expect(within(block).queryByText("0")).not.toBeInTheDocument();

    // Each of the three refusals is its own sentence. A table that lost the
    // distinction would satisfy the per-state assertions above by rendering one string
    // in three places.
    const refusals = [
      GTM_IDENTITY_LABELS.cannotTrack.unresolved,
      GTM_IDENTITY_LABELS.cannotTrack.possibleMatch,
      GTM_IDENTITY_LABELS.cannotTrack.noMatch,
    ];
    expect(new Set(refusals).size).toBe(refusals.length);
  });

  it("renders a provider's url as an unverified candidate, never as confirmed identity", async () => {
    // The state R30.7 is careful about: a data provider handed us a LinkedIn address
    // and nothing in this system has opened it. The url is real; the identity is not
    // established.
    await renderWith({ profile_url: CANDIDATE_URL });

    const block = identityBlock();
    // The address is shown — hiding it would be no help to the operator who has to
    // check it — and it is labelled by what we actually know about it.
    expect(within(block).getByText(CANDIDATE_URL)).toBeInTheDocument();
    expect(within(block).getByText(GTM_IDENTITY_LABELS.candidateUrl)).toBeInTheDocument();
    expect(within(block).getByText(GTM_IDENTITY_LABELS.candidateNote)).toBeInTheDocument();
    expect(within(block).queryByText(GTM_IDENTITY_LABELS.verifiedUrl)).not.toBeInTheDocument();

    // Nothing in the block claims this profile is verified. The word boundary is the
    // point: "Unverified candidate profile" is the label that *should* be here, and it
    // is not a claim that anything was verified.
    expect(block.textContent ?? "").not.toMatch(/\bverified\b/i);
    expect(block.textContent).toContain(GTM_IDENTITY_LABELS.candidateUrl);

    // And a url is not a verdict: the gate is still closed.
    expect(trackButton()).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Enrich Now
// ══════════════════════════════════════════════════════════════════════════════

describe("the resolve-identity control", () => {
  it("asks for an identity search, and reports only that a search was queued", async () => {
    await renderWith();
    const before = calls().length;

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: GTM_IDENTITY_LABELS.resolve }));

    await waitFor(() =>
      expect(calls().filter((call) => call.url.includes("/resolve-identity"))).toHaveLength(1),
    );
    const write = calls()
      .slice(before)
      .find((call) => call.url.includes("/resolve-identity")) as Call;
    expect(write.method).toBe("POST");
    expect(write.url).toContain("/lead/lead-1/resolve-identity");
    expect(write.url).toContain("brand_id=brand-1");

    // No body: the lead is the path parameter and the purpose is fixed server-side.
    const body = fetchMock.mock.calls
      .map((call) => call[1] as RequestInit | undefined)
      .filter((init) => init?.method === "POST")
      .map((init) => init?.body);
    expect(body).toEqual([undefined]);

    // The API process navigates nothing — the VM does the search later — so the page
    // reports a queued search and no verdict at all. The verdict slot still reads
    // Unknown, because nothing has come back yet.
    await waitFor(() =>
      expect(
        within(identityBlock()).getByText(GTM_IDENTITY_LABELS.resolveQueued),
      ).toBeInTheDocument(),
    );
    expect(within(identityBlock()).getByText(UNKNOWN_TEXT)).toBeInTheDocument();
    expect(trackButton()).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. The load contract
// ══════════════════════════════════════════════════════════════════════════════

describe("the load contract", () => {
  it("adds no request to the default load, in either identity state", async () => {
    await renderWith();

    // The two the page has always made: the prospect payload and the ledger. The
    // identity gate renders from the first of them.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const observed = calls();
    expect(observed.filter((call) => call.url.includes("/prospect/lead-1?"))).toHaveLength(1);
    expect(observed.filter((call) => call.url.includes("/timeline"))).toHaveLength(1);
    // Every one of them a read. Neither of the gate's writes fires on mount.
    expect(observed.every((call) => call.method === "GET")).toBe(true);
    ["/resolve-identity", "/track", "/recommend-channel"].forEach((path) => {
      expect(observed.filter((call) => call.url.includes(path))).toHaveLength(0);
    });
  });

  it("adds no request when the identity is already verified either", async () => {
    await renderWith(verifiedProfile());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // A verified prospect renders a *write* control, and rendering it must not press
    // it: the operator decides when Weez starts spending a navigation budget on
    // somebody.
    expect(trackButton()).toBeInTheDocument();
    expect(calls().filter((call) => call.method === "POST")).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Accessibility
// ══════════════════════════════════════════════════════════════════════════════

describe("axe", () => {
  it("is clean with a verified identity and the tracking control on screen", async () => {
    const { container } = await renderWith(verifiedProfile());
    expect(trackButton()).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is clean with the identity unresolved", async () => {
    const { container } = await renderWith({ profile_url: CANDIDATE_URL });
    expect(
      within(identityBlock()).getByText(GTM_VERIFICATION_LABELS.UNRESOLVED),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps the page's heading outline contiguous, and adds no h2 of its own", async () => {
    const { container } = await renderWith(verifiedProfile());

    // The identity gate carries no heading: the closed page's outline is one `<h2>` per
    // panel and `GTMProspect.compose.test.tsx` pins the count. A heading here would
    // either add a ninth or invent a name for a group.
    expect(identityBlock().querySelectorAll("h1, h2, h3, h4, h5, h6")).toHaveLength(0);

    const levels = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((node) =>
      Number(node.tagName[1]),
    );
    expect(levels[0]).toBe(1);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    levels.slice(1).forEach((level, index) => {
      expect(level - levels[index]).toBeLessThanOrEqual(1);
    });
  });
});
