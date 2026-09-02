// pages/__tests__/GTMProspect.compose.test.tsx
//
// The page is composition and wiring, so these tests are about composition and
// wiring — the panels are already covered on their own, and nothing here re-tests
// what they render.
//
// Six claims:
//
// 1. **Every panel is mounted, once, with the slice it reads.** The five
//    intelligence panels, the next action, and the timeline, all from one payload
//    (R18.1–R18.6).
// 2. **The heading outline is well-formed.** Exactly one `<h1>`, an `<h2>` per
//    panel, no skipped level, one `<ol>` for the timeline and no second `<dl>`
//    around the dimensions.
// 3. **Loading is the real geometry, and a refresh never blanks it.** A skeleton in
//    the page's own two-column shape marked `aria-busy`, and a silent refresh that
//    keeps the content and never nags (R18.8).
// 4. **Failure is layered and recoverable.** A page-level `Alert` with the server's
//    `detail` and a `Try again` that actually re-runs the load; a failed refresh
//    that keeps the last good payload; a failed timeline that leaves the next action
//    reachable (R18.8).
// 5. **A stale response never wins.** The monotonic `reqRef` drops a response whose
//    request was superseded.
// 6. **A GTM socket event patches state in place.** The dimension named by the
//    event moves, with the provenance the event carried, and no refetch is issued.
//
// The transport is stubbed at `fetch` rather than at `gtmAPI`, so the real
// normaliser runs and every assertion is about the whole path from wire to DOM.
// `ConversationSidebar` is stubbed because it is existing chrome that reaches for
// auth context; the page mounts it unchanged and there is nothing here to prove
// about it.

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GTMProspect, { SILENT_REFETCH_MS, applySocketEvent } from "../GTMProspect";
import { GTM_PAGE_LABELS, GTM_UI_LABELS } from "@/components/gtm/labels";
import type { ProspectDetail } from "@/services/gtmAPI";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

// ─── Wire fixtures, exactly as `schemas/gtm.py` serialises them ───────────────

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

/** A fully populated prospect. `over` lets one test change one thing. */
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
      display_summary: "Connected · warm-up ready",
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

function wireTimelinePage(entries: unknown[] = [], next: string | null = null) {
  return { entries, next_cursor: next, has_more: next !== null };
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

/** Just enough WebSocket for the page: a handle to push a frame at it. */
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

  /** Deliver a frame the way the server would. */
  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
}

/**
 * Route responses by URL, so the page's detail request and the timeline's own
 * request are independent — which is what lets one fail while the other succeeds.
 */
function routeFetch(responder: Responder) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const { ok = true, status = 200, body } = responder(String(input));
    return { ok, status, json: async () => body };
  });
}

/** The common case: a good prospect and a good timeline. */
function serveHappyPath(detail: unknown = wireDetail()) {
  routeFetch((url) =>
    url.includes("/timeline") ? { body: wireTimelinePage([TIMELINE_ENTRY]) } : { body: detail },
  );
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

/** Resolved once the payload has landed and the header is on screen. */
async function renderLoaded(detail: unknown = wireDetail()) {
  serveHappyPath(detail);
  const utils = renderPage();
  await screen.findByText("Ada Lovelace");
  return utils;
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

// ─── 1. Composition ───────────────────────────────────────────────────────────

describe("composition", () => {
  it("mounts every panel from one payload", async () => {
    await renderLoaded();

    // The header's identity, through ObservedValue.
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    // The five intelligence panels and the next action, by their own headings.
    [
      GTM_UI_LABELS.prospectTitle,
      GTM_UI_LABELS.activityTitle,
      GTM_UI_LABELS.channelsTitle,
      GTM_UI_LABELS.stateTitle,
      GTM_UI_LABELS.ctaTitle,
      GTM_PAGE_LABELS.timelineTitle,
    ].forEach((heading) => {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Next action" })).toBeInTheDocument();

    // Three channel cards, the server's winner marked.
    expect(screen.getAllByText(GTM_UI_LABELS.recommendedChannel)).toHaveLength(1);
    // The dimension grid's own values.
    expect(screen.getByText("Warm-up ready")).toBeInTheDocument();
    // The next action, with the server's sentence, its why, and the composer.
    const nextAction = screen.getByRole("heading", { name: "Next action" })
      .closest("section") as HTMLElement;
    expect(within(nextAction).getByText("Send a warm-up message on LinkedIn")).toBeInTheDocument();
    expect(within(nextAction).getByText("Posting weekly")).toBeInTheDocument();
    expect(within(nextAction).getByRole("textbox")).toBeInTheDocument();
  });

  it("asks for the prospect and its timeline once each, brand-scoped", async () => {
    await renderLoaded();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes("/prospect/lead-1?"))).toHaveLength(1);
    expect(urls.filter((url) => url.includes("/timeline"))).toHaveLength(1);
    urls.forEach((url) => expect(url).toContain("brand_id=brand-1"));
  });

  it("subscribes to the brand's existing campaign socket", async () => {
    await renderLoaded();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toMatch(/^wss?:\/\/.*\/ws\/campaign\/brand-1$/);
  });

  it("reports a missing prospect as a selection gap rather than a failed request", async () => {
    renderPage("");

    expect(await screen.findByText(GTM_PAGE_LABELS.noLeadTitle)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    // Nothing to retry, so nothing is offered.
    expect(screen.queryByRole("button", { name: GTM_PAGE_LABELS.retry })).not.toBeInTheDocument();
  });
});

// ─── 2. Document structure ────────────────────────────────────────────────────

describe("structure", () => {
  it("has exactly one h1 and an h2 per panel, with no skipped level", async () => {
    const { container } = await renderLoaded();

    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(GTM_PAGE_LABELS.pageTitle);

    // Seven panels: header, channels, activity, state, CTA, next action, timeline.
    expect(container.querySelectorAll("h2")).toHaveLength(7);

    // Levels present must be contiguous from 1: h3 is the channel cards.
    const levels = [...container.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) =>
      Number(node.tagName.slice(1)),
    );
    expect([...new Set(levels)].sort()).toEqual([1, 2, 3]);
  });

  it("renders the timeline as one ordered list and does not wrap it in another", async () => {
    const { container } = await renderLoaded();

    await waitFor(() => expect(screen.getByText("relationship_state -> CONNECTED")).toBeInTheDocument());
    const timeline = screen.getByRole("heading", { name: GTM_PAGE_LABELS.timelineTitle })
      .closest("section") as HTMLElement;
    expect(timeline.querySelectorAll("ol")).toHaveLength(1);
    // The `<ol>` holds the entries directly — no list inside a list.
    const list = timeline.querySelector("ol") as HTMLElement;
    expect(list.querySelectorAll("ol, ul")).toHaveLength(0);
    expect(container.querySelectorAll("ol").length).toBeGreaterThan(0);
  });

  it("leaves the dimension grid's own definition list unwrapped", async () => {
    await renderLoaded();

    const grid = screen.getByRole("heading", { name: GTM_UI_LABELS.stateTitle })
      .closest("section") as HTMLElement;
    const lists = grid.querySelectorAll("dl");
    expect(lists).toHaveLength(1);
    expect(lists[0].querySelectorAll("dl")).toHaveLength(0);
  });

  it("announces status politely through a live region", async () => {
    await renderLoaded();

    const status = screen.getAllByRole("status").find((node) => node.tagName === "P") as HTMLElement;
    expect(status).toHaveAttribute("aria-live", "polite");
    // The server's own summary, passed through — not a status derived here.
    expect(status).toHaveTextContent("Connected · warm-up ready");
  });
});

// ─── 3. Loading and silent refresh ────────────────────────────────────────────

describe("loading", () => {
  it("shows a busy skeleton in the page's real geometry", async () => {
    let release: ((value: unknown) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const { container } = renderPage();

    const busy = container.querySelector('[aria-busy="true"]') as HTMLElement;
    expect(busy).not.toBeNull();
    expect(within(busy).getByText(GTM_PAGE_LABELS.statusLoading)).toBeInTheDocument();
    // The real two-column geometry, not a spinner: six panel placeholders.
    expect(busy.querySelectorAll(".animate-pulse").length).toBeGreaterThan(6);
    // The heading exists while loading, so the outline is never headless.
    expect(container.querySelectorAll("h1")).toHaveLength(1);

    release?.({ ok: true, status: 200, json: async () => wireDetail() });
    await screen.findByText("Ada Lovelace");
  });

  it("keeps the content on screen through a refresh and never blanks it", async () => {
    await renderLoaded();

    // The refresh control the header owns.
    await userEvent.click(screen.getByRole("button", { name: GTM_UI_LABELS.refresh }));

    // The payload never disappears while the newer one is in flight.
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeInTheDocument());
  });
});

// ─── 4. Layered failure ───────────────────────────────────────────────────────

describe("failure", () => {
  it("renders the server detail with a Try again that re-runs the load", async () => {
    routeFetch(() => ({ ok: false, status: 502, body: { detail: "LinkedIn sync is paused" } }));
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("LinkedIn sync is paused"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(GTM_PAGE_LABELS.loadFailedTitle);

    serveHappyPath();
    await userEvent.click(screen.getByRole("button", { name: GTM_PAGE_LABELS.retry }));

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("keeps the last good payload when a refresh fails", async () => {
    await renderLoaded();

    routeFetch(() => ({ ok: false, status: 500, body: { detail: "Prospect read failed" } }));
    await userEvent.click(screen.getByRole("button", { name: GTM_UI_LABELS.refresh }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Prospect read failed"));
    // Layered, not global: the content is still there and still labelled.
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Next action" })).toBeInTheDocument();
  });

  it("leaves the next action reachable when the timeline fails", async () => {
    routeFetch((url) =>
      url.includes("/timeline")
        ? { ok: false, status: 500, body: { detail: "Timeline unavailable" } }
        : { body: wireDetail() },
    );
    renderPage();

    await screen.findByText("Ada Lovelace");
    await waitFor(() =>
      expect(screen.getByText("Timeline unavailable")).toBeInTheDocument(),
    );
    // The panel failed inline; the page did not.
    expect(screen.getByRole("heading", { name: "Next action" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open LinkedIn & Send/ }),
    ).toBeInTheDocument();
  });

  it("reports a failed channel re-evaluation beside the panel, keeping the scores", async () => {
    await renderLoaded();

    routeFetch((url) =>
      url.includes("/recommend-channel")
        ? { ok: false, status: 503, body: { detail: "Scoring is unavailable" } }
        : { body: wireDetail() },
    );
    await userEvent.click(screen.getByRole("button", { name: GTM_UI_LABELS.reevaluate }));

    await waitFor(() => expect(screen.getByText("Scoring is unavailable")).toBeInTheDocument());
    // The panel keeps what it had, and the page keeps everything else.
    expect(screen.getByRole("heading", { name: GTM_UI_LABELS.channelsTitle })).toBeInTheDocument();
    expect(screen.getAllByText(GTM_UI_LABELS.recommendedChannel)).toHaveLength(1);
  });
});

// ─── 5. Stale responses ───────────────────────────────────────────────────────

describe("request ordering", () => {
  /**
   * The race is real rather than contrived: the 60 s fallback fires on a timer, so
   * a slow read can still be in flight when the next cycle comes round. Both are
   * silent, so neither disables a control and neither can be serialised by the UI —
   * settling which one wins is exactly what `reqRef` is for.
   */
  it("drops a superseded response rather than letting it overwrite a newer one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const base = wireDetail();
      const stale = wireDetail({ profile: { ...base.profile, name: wireFact("Stale Name") } });
      const fresh = wireDetail({ profile: { ...base.profile, name: wireFact("Fresh Name") } });

      let releaseStale: ((value: unknown) => void) | undefined;
      let detailCall = 0;
      fetchMock.mockImplementation((input: unknown) => {
        if (String(input).includes("/timeline")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => wireTimelinePage() });
        }
        detailCall += 1;
        if (detailCall === 1) {
          return Promise.resolve({ ok: true, status: 200, json: async () => base });
        }
        if (detailCall === 2) {
          // The earlier cycle hangs until after the later one has landed.
          return new Promise((resolve) => {
            releaseStale = resolve;
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => fresh });
      });

      renderPage();
      await screen.findByText("Ada Lovelace");

      await act(async () => {
        vi.advanceTimersByTime(SILENT_REFETCH_MS); // cycle 1 — hangs
      });
      await act(async () => {
        vi.advanceTimersByTime(SILENT_REFETCH_MS); // cycle 2 — lands
      });

      await waitFor(() => expect(screen.getByText("Fresh Name")).toBeInTheDocument());

      await act(async () => {
        releaseStale?.({ ok: true, status: 200, json: async () => stale });
      });

      expect(screen.getByText("Fresh Name")).toBeInTheDocument();
      expect(screen.queryByText("Stale Name")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never blanks the page when the silent fallback fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let detailCall = 0;
      fetchMock.mockImplementation((input: unknown) => {
        if (String(input).includes("/timeline")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => wireTimelinePage() });
        }
        detailCall += 1;
        return Promise.resolve(
          detailCall === 1
            ? { ok: true, status: 200, json: async () => wireDetail() }
            : { ok: false, status: 500, json: async () => ({ detail: "Prospect read failed" }) },
        );
      });

      renderPage();
      await screen.findByText("Ada Lovelace");

      await act(async () => {
        vi.advanceTimersByTime(SILENT_REFETCH_MS);
      });

      // A background read that failed says nothing and takes nothing away.
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText("Prospect read failed")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── 6. Socket patching ───────────────────────────────────────────────────────

describe("socket events", () => {
  const CONNECTED_EVENT = {
    type: "gtm_event",
    event_type: "CONVERSATION_STATE_CHANGED",
    lead_id: "lead-1",
    outcome: "APPLIED",
    dimension: "conversation_state",
    new_value: "WARMUP_SENT",
    evidence: {
      source_surface: "LINKEDIN_MESSAGING_THREAD",
      observed_at: iso(0),
    },
  };

  it("patches the named dimension in place, without refetching the payload", async () => {
    await renderLoaded();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const before = fetchMock.mock.calls.length;

    expect(screen.getByText("Warm-up ready")).toBeInTheDocument();
    await act(async () => sockets[0].emit(CONNECTED_EVENT));

    // The new value and the provenance the event carried.
    expect(await screen.findByText("Warm-up seen in thread")).toBeInTheDocument();
    expect(screen.queryByText("Warm-up ready")).not.toBeInTheDocument();
    expect(screen.getAllByText(/LinkedIn thread/).length).toBeGreaterThan(0);

    // The ledger is re-read (the event has a row there); the payload is not.
    const detailCalls = fetchMock.mock.calls
      .slice(before)
      .map((c) => String(c[0]))
      .filter((url) => !url.includes("/timeline"));
    expect(detailCalls).toHaveLength(0);
  });

  it("ignores a frame that is not a GTM event, and one for another prospect", async () => {
    await renderLoaded();

    await act(async () => {
      sockets[0].emit({ type: "ping" });
      sockets[0].emit({ ...CONNECTED_EVENT, lead_id: "someone-else" });
    });

    expect(screen.getByText("Warm-up ready")).toBeInTheDocument();
  });
});

// ─── The patcher, directly ────────────────────────────────────────────────────

describe("applySocketEvent", () => {
  /** The normalised payload, produced by the real service from the wire fixture. */
  async function loadedDetail(): Promise<ProspectDetail> {
    const { default: api } = await import("@/services/gtmAPI");
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => wireDetail() });
    return api.getProspect("brand-1", "lead-1");
  }

  it("returns the same payload when nothing applies", async () => {
    const detail = await loadedDetail();

    expect(applySocketEvent(detail, { type: "poster_update" })).toBe(detail);
    expect(applySocketEvent(detail, { type: "gtm_event", lead_id: "other" })).toBe(detail);
    // A refusal changed nothing, so the screen must not move either.
    expect(
      applySocketEvent(detail, {
        type: "gtm_event",
        outcome: "REJECTED_STALE",
        dimension: "relationship_state",
        new_value: "NOT_CONNECTED",
      }),
    ).toBe(detail);
    // A dimension this page does not hold is ignored rather than guessed at.
    expect(
      applySocketEvent(detail, {
        type: "gtm_event",
        outcome: "APPLIED",
        dimension: "confirmation_status",
        new_value: "CONFIRMED",
      }),
    ).toBe(detail);
  });

  it("moves only the named dimension, and carries the event's provenance", async () => {
    const detail = await loadedDetail();
    const patched = applySocketEvent(detail, {
      type: "gtm_event",
      lead_id: "lead-1",
      outcome: "CORRECTED",
      dimension: "relationship_state",
      new_value: "CONNECTION_PENDING",
      evidence: { source_surface: "LINKEDIN_INVITATION_MANAGER", observed_at: iso(0) },
    }) as ProspectDetail;

    expect(patched).not.toBe(detail);
    expect(patched.state.relationshipState.value).toBe("CONNECTION_PENDING");
    expect(patched.state.relationshipState.isUnknown).toBe(false);
    expect(patched.state.relationshipState.sourceSurface).toBe("LINKEDIN_INVITATION_MANAGER");
    // Everything else is the payload the server sent, untouched.
    expect(patched.state.conversationState).toBe(detail.state.conversationState);
    expect(patched.channels).toBe(detail.channels);
    expect(patched.cta).toBe(detail.cta);
  });

  it("reads a cleared value as unknown rather than as an empty string", async () => {
    const detail = await loadedDetail();
    const patched = applySocketEvent(detail, {
      type: "gtm_event",
      outcome: "APPLIED",
      dimension: "activity_level",
      new_value: null,
    }) as ProspectDetail;

    expect(patched.state.activityLevel.value).toBeNull();
    expect(patched.state.activityLevel.isUnknown).toBe(true);
  });
});
