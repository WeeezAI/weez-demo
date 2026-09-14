// components/gtm/__tests__/ProspectTimeline.test.tsx
//
// The timeline is tested for the promises it makes about the record, not for its
// markup.
//
// 1. **The server owns the order.** The rendered `<li>` order is exactly the order
//    the server sent, and the component holds those entries in the ledger's
//    canonical ascending order and reverses only to display them (R17.4, R18.6).
//    Asserted as a *full equality* against whatever order the server chose, not as
//    "descending by timestamp" — see the block below for why the difference matters.
// 2. **Every entry is legible and precise.** An `<li>` per entry, a `<time
//    dateTime>` carrying the machine instant with the absolute value in `title` and
//    the relative value as text, the server's summary, and the evidence surface and
//    observation time where present (R18.6, R14.3).
// 3. **A refusal is part of the record.** Rejected and stale transitions render
//    muted with their reason as real DOM text, not a tooltip (R18.6).
// 4. **No message body reaches the DOM.** A payload carrying every key in the
//    backend's `BODY_KEYS` set renders none of them (R17.6).
// 5. **Paging walks backwards.** `Load earlier activity` fetches with the server's
//    cursor and appends earlier entries beneath what is already shown, without
//    reordering or duplicating it.
//
// The transport is stubbed at `fetch` rather than at `gtmAPI`, so the real
// normaliser runs and claim 4 is a statement about the whole path from wire to DOM.
//
// ─── Where this component now sits (R20.8, §15.3) ─────────────────────────────
//
// Behaviourally unchanged by the restructure, and that is the point of updating this
// file: the dossier renders `ProspectTimeline` inside the "Everything that happened"
// disclosure — `PROSPECT_INTELLIGENCE_SECTIONS.timeline` — whose `children` is a
// function, so the component is constructed on the first open and holds its own read,
// its own pager and its own failure exactly as it always did. Nothing about that
// changes the claims below, because none of them was ever about who mounted it.
//
// What the fold-in *does* change is which of these claims is load-bearing. The
// timeline is now the dossier's whole "what happened" record — the retired page's
// activity list is gone — so the order the operator reads is this component's order
// and nothing else re-sorts it downstream. Design §15.3 asks for that as an example
// here rather than as a second copy of property 21, which
// `ProspectDossier.labels.test.tsx` owns, and the mounting-and-request half is
// `ProspectDossier.compose.test.tsx`'s property 6. So this file states the ordering
// claim and neither of those two.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProspectTimeline } from "../ProspectTimeline";
import { absTime, relTime } from "../labels";

// ─── Fixtures: wire shapes, exactly as `TimelineEntryOut` serialises them ─────

const HOUR = 3600_000;

function iso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * HOUR).toISOString();
}

/** An applied transition, with evidence. */
function appliedEntry(id: string, hoursAgo: number, over: Record<string, unknown> = {}) {
  return {
    event_id: id,
    event_type: "RELATIONSHIP_STATE_CHANGED",
    event_at: iso(hoursAgo),
    summary: `relationship_state -> CONNECTED (${id})`,
    outcome: "APPLIED",
    dimension: "relationship_state",
    prior_value: "NOT_CONNECTED",
    new_value: "CONNECTED",
    actor_id: "gtm_relationship_sync_worker",
    actor_type: "SERVICE",
    evidence_id: `ev_${id}`,
    evidence_source_surface: "LINKEDIN_PROFILE_PAGE",
    evidence_observed_value: "1st",
    evidence_observed_at: iso(hoursAgo),
    evidence_confidence: "HIGH",
    related_action_id: null,
    related_message_id: null,
    ...over,
  };
}

/**
 * One page as the server sends it for `newest_first=true`: newest entry first.
 * `entries` is handed over untouched, so a test can assert the rendered order
 * against the order the server chose.
 */
function timelinePage(entries: unknown[], next: string | null) {
  return { entries, next_cursor: next, has_more: next !== null };
}

let fetchMock: ReturnType<typeof vi.fn>;

function respondWith(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  fetchMock.mockResolvedValueOnce({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  });
}

function requestedUrls(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function renderTimeline(props: Partial<Parameters<typeof ProspectTimeline>[0]> = {}) {
  return render(<ProspectTimeline brandId="brand-1" leadId="lead_1" {...props} />);
}

/** The summaries of the rendered `<li>` elements, in document order. */
function renderedSummaries(): string[] {
  return screen.getAllByRole("listitem").map((item) => item.querySelector("p")?.textContent ?? "");
}

/**
 * The `event_id` each rendered entry is carrying, in document order, read inside one
 * mount rather than off the body.
 *
 * `appliedEntry` writes the id into the summary in parentheses, so this is the server's
 * own identifier for the row and not a position this file assigned.
 */
function renderedIds(root: HTMLElement): (string | undefined)[] {
  return within(root)
    .getAllByRole("listitem")
    .map((item) => (item.querySelector("p")?.textContent ?? "").match(/\(([^)]+)\)/)?.[1]);
}

/**
 * The machine instant each rendered entry is carrying, in document order.
 *
 * The entry's own `event_at`: it is the first `<time>` in the `<li>`, ahead of the
 * optional evidence instant further down, which is why `querySelector` is the right
 * reach here. Read alongside `renderedIds` so an ordering claim is made about the
 * timestamps as well as the identifiers — a component that re-sorted would have to
 * disagree with one of the two.
 */
function renderedInstants(root: HTMLElement): (string | null)[] {
  return Array.from(root.querySelectorAll("li")).map(
    (item) => item.querySelector("time")?.getAttribute("dateTime") ?? null,
  );
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

// ─── 1. Order ─────────────────────────────────────────────────────────────────

describe("order", () => {
  it("renders the server's order, newest first, without re-sorting", async () => {
    // Newest first, as the server's reverse keyset walk returns it. Note the two
    // middle entries share a millisecond: a client-side sort could not separate
    // them, which is why the server's order is the only order.
    const shared = iso(5);
    respondWith(
      timelinePage(
        [
          appliedEntry("e4", 1),
          appliedEntry("e3", 5, { event_at: shared }),
          appliedEntry("e2", 5, { event_at: shared }),
          appliedEntry("e1", 40),
        ],
        null,
      ),
    );

    renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(4));
    expect(renderedSummaries().map((text) => text.match(/\(([^)]+)\)/)?.[1])).toEqual([
      "e4",
      "e3",
      "e2",
      "e1",
    ]);
  });

  it("asks the server for the newest page of the brand's ledger", async () => {
    respondWith(timelinePage([appliedEntry("e1", 2)], null));
    renderTimeline({ pageSize: 10 });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = requestedUrls()[0];
    expect(url).toContain("/prospect/lead_1/timeline?");
    expect(url).toContain("brand_id=brand-1");
    expect(url).toContain("limit=10");
    expect(url).toContain("newest_first=true");
  });

  it("renders exactly the sequence the server sent, whatever order that is", async () => {
    // The claim design §15.3 asks for, stated as an equality rather than as
    // "descending by timestamp" — and the two are not the same assertion.
    //
    // A component that sorted the page itself on `event_at` would still satisfy a
    // descending-order check, while silently overriding the one thing only the server
    // can decide: the ledger's keyset walk is what separates two rows and what fixes
    // their tie-break, and the browser holds nothing it could reconstruct that from.
    // So the page below is deliberately *not* chronological. `e2` is the oldest row in
    // it and sits second because that is where the server put it, and `e4`/`e5` share a
    // millisecond, which no client-side comparator could order at all.
    //
    // Now that the dossier's activity list is gone and this component is the whole
    // "Everything that happened" record, the order an operator reads is this order.
    const shared = iso(9);
    const served = [
      appliedEntry("e1", 2),
      appliedEntry("e2", 40),
      appliedEntry("e3", 1),
      appliedEntry("e4", 9, { event_at: shared }),
      appliedEntry("e5", 9, { event_at: shared }),
    ];
    respondWith(timelinePage(served, null));
    const { container } = renderTimeline();

    await waitFor(() => expect(within(container).getAllByRole("listitem")).toHaveLength(5));

    // Entry for entry, with no entry dropped, added or moved.
    expect(renderedIds(container)).toEqual(served.map((entry) => entry.event_id));
    // And the instants in the same sequence, which is what says no re-sort happened
    // anywhere between the wire and the `<time>` elements.
    expect(renderedInstants(container)).toEqual(served.map((entry) => entry.event_at));
  });

  it("keeps the server's order across a page boundary, appending page two as it arrived", async () => {
    // Paging is where an ordering guarantee is easiest to lose: the second page is
    // merged into state the component already holds, and a merge that sorted would
    // rewrite the first page too. Page two is out of chronological order for the same
    // reason page one is above.
    const first = [appliedEntry("p1", 1), appliedEntry("p2", 12)];
    const second = [appliedEntry("p3", 30), appliedEntry("p4", 90), appliedEntry("p5", 45)];

    respondWith(timelinePage(first, "cursor-1"));
    const { container } = renderTimeline({ pageSize: 2 });

    await waitFor(() => expect(within(container).getAllByRole("listitem")).toHaveLength(2));

    respondWith(timelinePage(second, null));
    await userEvent.click(
      within(container).getByRole("button", { name: "Load earlier activity" }),
    );

    await waitFor(() => expect(within(container).getAllByRole("listitem")).toHaveLength(5));
    expect(renderedIds(container)).toEqual(
      [...first, ...second].map((entry) => entry.event_id),
    );
    expect(renderedInstants(container)).toEqual(
      [...first, ...second].map((entry) => entry.event_at),
    );
  });

  it("puts the entries in an ordered list of list items", async () => {
    respondWith(timelinePage([appliedEntry("e1", 2)], null));
    const { container } = renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    const list = container.querySelector("ol");
    expect(list).not.toBeNull();
    expect(within(list as HTMLElement).getAllByRole("listitem")).toHaveLength(1);
  });
});

// ─── 2. Entry content ─────────────────────────────────────────────────────────

describe("entry content", () => {
  it("renders the timestamp as a machine-readable time with the absolute value in title", async () => {
    const entry = appliedEntry("e1", 3);
    respondWith(timelinePage([entry], null));
    const { container } = renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    const time = container.querySelector("time") as HTMLTimeElement;
    expect(time).toHaveAttribute("dateTime", entry.event_at);
    expect(time).toHaveAttribute("title", absTime(entry.event_at));
    expect(time.textContent).toBe(relTime(entry.event_at));
  });

  it("renders the server summary, the transition, and the evidence surface", async () => {
    respondWith(timelinePage([appliedEntry("e1", 3)], null));
    renderTimeline();

    const item = await screen.findByRole("listitem");
    expect(item.textContent).toContain("relationship_state -> CONNECTED (e1)");
    expect(item.textContent).toContain("Relationship");
    expect(item.textContent).toContain("Not connected");
    expect(item.textContent).toContain("Connected");
    expect(item.textContent).toContain("LinkedIn profile");
  });

  it("gives each entry a decorative, hidden icon", async () => {
    respondWith(timelinePage([appliedEntry("e1", 3)], null));
    renderTimeline();

    const item = await screen.findByRole("listitem");
    expect(item.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("omits the evidence line entirely when no evidence was recorded", async () => {
    respondWith(
      timelinePage(
        [
          appliedEntry("e1", 3, {
            event_type: "CTA_READINESS_COMPUTED",
            outcome: "RECORDED",
            dimension: null,
            prior_value: null,
            new_value: null,
            evidence_id: null,
            evidence_source_surface: null,
            evidence_observed_value: null,
            evidence_observed_at: null,
            evidence_confidence: null,
            summary: "CTA readiness computed",
          }),
        ],
        null,
      ),
    );
    renderTimeline();

    const item = await screen.findByRole("listitem");
    expect(item.textContent).toContain("CTA readiness computed");
    expect(item.textContent).not.toContain("Unknown");
    expect(item.textContent).not.toContain("Relationship");
  });
});

// ─── 3. Refusals ──────────────────────────────────────────────────────────────

describe("rejected and stale transitions", () => {
  const staleWire = appliedEntry("stale", 2, {
    event_type: "TRANSITION_REJECTED_STALE",
    outcome: "REJECTED_STALE",
    new_value: "NOT_CONNECTED",
    summary:
      "relationship_state -> NOT_CONNECTED refused: evidence observed 2025-01-01T00:00:00+00:00 " +
      "is not newer than the current state observed 2025-01-04T00:00:00+00:00",
  });

  const noEvidenceWire = appliedEntry("noev", 4, {
    event_type: "TRANSITION_REJECTED_NO_EVIDENCE",
    outcome: "REJECTED_NO_EVIDENCE",
    summary: "relationship_state -> CONNECTED refused: no evidence was supplied",
    evidence_id: null,
    evidence_source_surface: null,
    evidence_observed_value: null,
    evidence_observed_at: null,
    evidence_confidence: null,
  });

  it("renders the reason as visible text rather than a tooltip", async () => {
    respondWith(timelinePage([staleWire, noEvidenceWire], null));
    renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));

    expect(screen.getByText("Declined — evidence older than the current value")).toBeInTheDocument();
    expect(screen.getByText("Declined — no evidence")).toBeInTheDocument();
    // The server's summary carries the specific reason, including both timestamps
    // for a stale refusal.
    expect(screen.getByText(/is not newer than the current state observed/)).toBeInTheDocument();
    expect(screen.getByText(/no evidence was supplied/)).toBeInTheDocument();
  });

  it("renders a refusal in a muted tone", async () => {
    respondWith(timelinePage([staleWire, appliedEntry("ok", 1)], null));
    renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    const [refused, applied] = screen.getAllByRole("listitem");

    expect(refused).toHaveAttribute("data-outcome", "REJECTED_STALE");
    expect(refused.querySelector("p")?.className).toContain("text-slate-500");
    expect(applied).toHaveAttribute("data-outcome", "APPLIED");
    expect(applied.querySelector("p")?.className).toContain("text-zinc-800");
  });

  it("does not render a refusal as a failure", async () => {
    respondWith(timelinePage([noEvidenceWire], null));
    renderTimeline();

    const item = await screen.findByRole("listitem");
    expect(item.innerHTML).not.toContain("rose");
    expect(item.textContent).not.toContain("Error");
  });
});

// ─── 4. No message body (R17.6) ───────────────────────────────────────────────

describe("message bodies", () => {
  it("renders no body content even when the payload carries it", async () => {
    const BODY = "Congrats on the Series B, I had a question about your GTM stack.";
    const REPLY = "Sure, send me a note next week.";
    const EXCERPT = "…seen in the thread…";

    // Every key in the backend's BODY_KEYS set, on the entry and nested under a
    // `detail` mapping, plus the evidence excerpt the schema does project.
    respondWith(
      timelinePage(
        [
          appliedEntry("e1", 1, {
            event_type: "MESSAGE_VERSION_CREATED",
            summary: "Warm-up draft version 2 created",
            evidence_observed_value: EXCERPT,
            generated_content: BODY,
            edited_content: BODY,
            sent_content: BODY,
            observed_text: REPLY,
            suggested_response: REPLY,
            payload_text: BODY,
            raw_excerpt: EXCERPT,
            html: `<p>${BODY}</p>`,
            detail: {
              generated_content: BODY,
              observed_text: REPLY,
              nested: { sent_content: BODY },
            },
          }),
        ],
        null,
      ),
    );

    const { container } = renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    const markup = container.innerHTML;
    [BODY, REPLY, EXCERPT].forEach((text) => expect(markup).not.toContain(text));
    // The summary the server wrote is still rendered.
    expect(screen.getByText("Warm-up draft version 2 created")).toBeInTheDocument();
  });
});

// ─── 5. Cursor pagination ─────────────────────────────────────────────────────

describe("paging backwards", () => {
  it("appends earlier entries beneath what is already shown, without duplicating it", async () => {
    respondWith(timelinePage([appliedEntry("new2", 1), appliedEntry("new1", 2)], "cursor-1"));
    renderTimeline({ pageSize: 2 });

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));

    // The second page repeats `new1` — a keyset walk should not overlap, and if it
    // ever does the operator must not see one event as two.
    respondWith(timelinePage([appliedEntry("new1", 2), appliedEntry("old1", 30)], null));

    await userEvent.click(screen.getByRole("button", { name: "Load earlier activity" }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
    expect(renderedSummaries().map((text) => text.match(/\(([^)]+)\)/)?.[1])).toEqual([
      "new2",
      "new1",
      "old1",
    ]);

    const secondUrl = requestedUrls()[1];
    expect(secondUrl).toContain("cursor=cursor-1");
    expect(secondUrl).toContain("newest_first=true");
  });

  it("offers the control only while the server reports more entries", async () => {
    respondWith(timelinePage([appliedEntry("e1", 1)], null));
    renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Load earlier activity" })).not.toBeInTheDocument();
  });

  it("withholds the control when the server reports more entries but hands back no cursor", async () => {
    // The cursor is what the next keyset walk is made of. Without one there is
    // nothing to load, and a control that did nothing would be worse than none.
    respondWith({ entries: [appliedEntry("e1", 1)], next_cursor: null, has_more: true });
    renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Load earlier activity" })).not.toBeInTheDocument();
  });

  it("keeps the entries on screen when an earlier page fails", async () => {
    respondWith(timelinePage([appliedEntry("e1", 1)], "cursor-1"));
    renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));

    respondWith({ detail: "Prospect not found" }, { ok: false, status: 404 });
    await userEvent.click(screen.getByRole("button", { name: "Load earlier activity" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Prospect not found"));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});

// ─── Empty, error, and accessibility ──────────────────────────────────────────

describe("empty and failed states", () => {
  it("states the absence rather than filling it", async () => {
    respondWith(timelinePage([], null));
    renderTimeline();

    expect(await screen.findByText("No activity recorded yet")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("renders the server detail with a retry that reloads", async () => {
    respondWith({ detail: "Timeline unavailable" }, { ok: false, status: 500 });
    renderTimeline();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Timeline unavailable"));

    respondWith(timelinePage([appliedEntry("e1", 1)], null));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("marks the loading placeholder as busy", async () => {
    let resolve: ((value: unknown) => void) | undefined;
    fetchMock.mockReturnValueOnce(
      new Promise((res) => {
        resolve = res;
      }),
    );
    const { container } = renderTimeline();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText("Loading prospect activity")).toBeInTheDocument();

    resolve?.({ ok: true, status: 200, json: async () => timelinePage([], null) });
    await waitFor(() => expect(screen.getByText("No activity recorded yet")).toBeInTheDocument());
  });
});

describe("accessibility", () => {
  it("is clean over applied, refused, and evidence-free entries", async () => {
    respondWith(
      timelinePage(
        [
          appliedEntry("e3", 1),
          appliedEntry("e2", 2, {
            event_type: "TRANSITION_REJECTED_STALE",
            outcome: "REJECTED_STALE",
            summary: "relationship_state -> NOT_CONNECTED refused: evidence is not newer",
          }),
          appliedEntry("e1", 3, {
            event_type: "CTA_READINESS_COMPUTED",
            outcome: "RECORDED",
            dimension: null,
            prior_value: null,
            new_value: null,
            evidence_source_surface: null,
            evidence_observed_at: null,
            summary: "CTA readiness computed",
          }),
        ],
        "cursor-1",
      ),
    );
    const { container } = renderTimeline();

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
    expect(await axe(container)).toHaveNoViolations();
  });
});
