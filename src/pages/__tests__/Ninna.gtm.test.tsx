// pages/__tests__/Ninna.gtm.test.tsx
//
// **Property 33 — Nina's counts are the feed's counts and nothing else.**
//
// One claim in five parts, all of them about the four GTM blocks §8 puts on Nina and
// none of them about the brief, the chat or the sidebar:
//
//   1. every count the page presents is the payload's count      (R13.2)
//   2. the highest band's block holds exactly the highest band's items   (R13.1)
//   3. no full task line appears in the summary                   (R13.3)
//   4. no rendered value changes when the dashboard payload does  (R10.11)
//   5. neither retired `weezAPI` call is issued                   (R13.9)
//
// ── Why the dashboard clause is the interesting one ──
//
// `loadGtm()` issues `getDashboard` and throws the result away. That is deliberate: the
// three sanctioned reads are the three the page makes (R13.8), and block 2 states
// `feed.summary`'s counts rather than a dashboard aggregate. R10.11 is the rule that no
// attention list may be composed from those aggregates, and the only way to check a
// discarded read is to vary it: two mounts over the same feed and queue with different
// dashboards — including a *failed* dashboard read — have to read identically, character
// for character. A page that started sourcing a number from `getDashboard` fails here with
// the two readings side by side.
//
// ── Why the counts are checked twice ──
//
// Each presented number is compared against two independently-computed references: the
// count the payload *declares* (`feed.summary.*`) and a tally taken over `feed.items` in
// this file. Both have to hold. The first pins the page to reading rather than deriving —
// the generator sometimes sends a summary whose `total` exceeds the item list, which is
// what a capped feed looks like, and the page must show the workspace's total and not the
// length of what it was handed. The second pins that number to being true of the payload
// rather than merely present in it.
//
// A band or a trigger the server did not count is asserted *absent* rather than zero:
// `AttentionSummary`'s two maps are `Partial` because "we counted none" and "we did not
// count" are different statements, and only one of them is a finding (R18.2).
//
// ── What is mocked, and why ──
//
// The three GTM reads are stubbed at `gtmAPI` so the generated payload is the subject.
// Nina's brief, visit record and chat are stubbed because the page renders `BriefLoading`
// until a brief arrives — no block is queryable before then — and because a hundred real
// brief loads would make this a benchmark of `ninnaAPI`. `ConversationSidebar` and
// `NinaGoalIntake` are existing chrome that reach for auth and the network; the page mounts
// them unchanged and there is nothing here to prove about either. `weezAPI` is stubbed
// *only* so clause 5 has something to observe: if either retired call comes back, the spy
// records it.
//
// ── Two harness rules these properties depend on ──
//
// Every query is scoped with `within(container)`, because RTL binds `screen` and the
// returned queries to `document.body` and a hundred mounts in one test would otherwise read
// each other's DOM. And `cleanup()` runs at the *end* of every run, in a `finally`:
// fast-check re-runs the predicate while shrinking, so a run that left its tree mounted
// would hand the shrinker a document with two pages in it and a counterexample describing
// the harness rather than the page.

import { cleanup, render, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import Ninna, { NINA_BLOCK_TEST_IDS, NINA_GTM_LABELS } from "../Ninna";
import {
  ATTENTION_LABELS,
  ATTENTION_TRIGGER_LABELS,
  CONSEQUENCE_TIER_LABELS,
} from "@/components/gtm/labels";
import {
  CONSEQUENCE_TIER_ORDER,
  type ActionQueueItem,
  type ActionQueuePage,
  type AttentionFeed,
  type AttentionItem,
  type AttentionTrigger,
  type CandidateActionType,
  type ConsequenceTier,
  type Dashboard,
  type DashboardAggregateKey,
  type ObservedFact,
} from "@/services/gtmAPI";

// ─── Harness state, hoisted above the module mocks that read it ───────────────

/** The workspace the page is mounted for. Hoisted, because the auth mock names it. */
const SPACE = vi.hoisted(() => ({ id: "space-42", name: "Northwind Robotics" }));

/**
 * What the three reads return on the next mount.
 *
 * Mutated between mounts rather than re-mocked, so the implementations installed in the
 * factory below survive `restoreMocks` and every run reads the payload it just set.
 * `dashboard: null` means the dashboard read *rejects* — the page ignores that by design,
 * and clause 4 has to hold for it too.
 */
const served = vi.hoisted(() => ({
  feed: null as import("@/services/gtmAPI").AttentionFeed | null,
  queue: null as import("@/services/gtmAPI").ActionQueuePage | null,
  dashboard: null as import("@/services/gtmAPI").Dashboard | null,
}));

const gtmSpies = vi.hoisted(() => ({
  getAttentionFeed: vi.fn(async () => served.feed!),
  getActionQueue: vi.fn(async () => served.queue!),
  getDashboard: vi.fn(async () => {
    if (served.dashboard === null) throw new Error("dashboard unavailable");
    return served.dashboard;
  }),
}));

/** The two calls task 17.2 removed. Clause 5 is that neither of them is issued. */
const weezSpies = vi.hoisted(() => ({
  getActiveCampaignStatus: vi.fn(async () => ({})),
  activateOutboundWorkforce: vi.fn(async () => ({})),
}));

vi.mock("@/services/gtmAPI", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/gtmAPI")>();
  // Spread the real client so every wrapper the page does not use is still the real one:
  // a read that reappears reaches the network and fails loudly rather than resolving.
  const stub = { ...actual.gtmAPI, ...gtmSpies };
  return { ...actual, gtmAPI: stub, default: stub };
});

vi.mock("@/services/weezAPI", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/weezAPI")>();
  return { ...actual, weezAPI: { ...actual.weezAPI, ...weezSpies } };
});

vi.mock("@/services/ninnaAPI", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ninnaAPI")>();
  const brief: import("@/services/ninnaAPI").DailyBrief = {
    greeting: "Good morning.",
    headline: "brief-headline",
    narrative: "brief-narrative",
    sinceLabel: "since your last visit",
    agentSummaries: [],
    decisions: [],
    health: { label: "healthy", score: 50, summary: "brief-health", drivers: [] },
    timeline: [],
    recommendations: [],
    meetings: [],
    topLeads: [],
    revenueMetrics: [],
    gtmSummary: [],
    generatedAt: "2024-05-01T09:00:00.000Z",
    isDemo: false,
  };
  return {
    ...actual,
    // A cache hit would paint a brief this suite did not write. Always the stub above.
    getCachedBrief: () => null,
    ninnaAPI: {
      ...actual.ninnaAPI,
      getDailyBrief: vi.fn(async () => brief),
      recordVisit: vi.fn(),
      chat: vi.fn(async () => ({ text: "", cards: [] })),
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentSpace: { id: SPACE.id, name: SPACE.name },
    user: { name: "Rep Example" },
    selectSpace: vi.fn(),
    spaces: [{ id: SPACE.id, name: SPACE.name }],
  }),
}));

vi.mock("@/components/ConversationSidebar", () => ({ default: () => null }));
vi.mock("@/components/NinaGoalIntake", () => ({ default: () => null }));

// ─── Payload builders ─────────────────────────────────────────────────────────

const ISO = "2024-05-01T09:00:00.000Z";
const DISCLAIMER = "A prioritisation signal, not a predicted probability of conversion.";

/** The nine triggers, declared here so the generator's universe is not a label table. */
const TRIGGERS: readonly AttentionTrigger[] = [
  "PROSPECT_REPLIED",
  "BUYING_STATE_CHANGED",
  "STAGE_CHANGED",
  "HIGH_INTENT_SIGNAL",
  "MOVED_TOWARD_CONVERSION",
  "AT_RISK_OR_LOSING",
  "WINNING_NEEDS_FOLLOWUP",
  "MEANINGFUL_TRANSITION",
  "ACTION_MANDATORY",
];

const ACTION_TYPES: readonly CandidateActionType[] = [
  "CONNECT_LINKEDIN",
  "SEND_LINKEDIN_WARMUP",
  "REQUEST_MEETING",
  "WAIT",
];

const AGGREGATE_KEYS: readonly DashboardAggregateKey[] = [
  "state_changed",
  "newly_high_intent",
  "went_cold",
  "needs_followup",
];

function fact(value: string | null): ObservedFact {
  return {
    value,
    isUnknown: value === null,
    sourceSurface: value === null ? null : "LINKEDIN_PROFILE_PAGE",
    observedAt: value === null ? null : ISO,
    isStale: false,
    isDerived: false,
  };
}

/** One drawn attention item, before it becomes wire-shaped. */
interface ItemSpec {
  id: number;
  trigger: AttentionTrigger;
  tier: ConsequenceTier;
  named: boolean;
}

/** One drawn queue row. `id` shares the item pool, so joins land and misses happen. */
interface RowSpec {
  id: number;
  named: boolean;
  executable: boolean;
  verb: "SEND_MESSAGE" | "CONNECT" | "MEETING_REQUEST" | null;
  actionType: CandidateActionType;
  expected: number;
  value: number;
  bullets: number;
}

interface FeedSpec {
  items: ItemSpec[];
  /** How many items the workspace holds beyond the ones this page was sent. */
  totalOffset: number;
  /** Bands the server did not count, so their key is absent from `byTier`. */
  dropTiers: ConsequenceTier[];
  /** Triggers the server did not count. */
  dropTriggers: AttentionTrigger[];
}

/**
 * Distinctive prose per item, so clause 3's containment checks mean something: a token
 * like `reason-7-PROSPECT_REPLIED` cannot appear in a block that renders counts and
 * vocabulary labels, and it does not collide with `"Prospects needing attention"` the way
 * a bare word would.
 */
function attentionItem(spec: ItemSpec): AttentionItem {
  return {
    leadId: `lead-${spec.id}`,
    prospectName: fact(spec.named ? `Kerri-${spec.id}` : null),
    company: fact(spec.named ? `Northwind-${spec.id}` : null),
    trigger: spec.trigger,
    reason: `reason-${spec.id}-${spec.trigger}`,
    requiredResponse: `respond-${spec.id}-${spec.trigger}`,
    consequenceTier: spec.tier,
    escalatedFrom: null,
    escalationReason: null,
    dueAt: ISO,
    computedAt: ISO,
    route: `/prospect-intelligence/${SPACE.id}?lead_id=lead-${spec.id}`,
    criteria: [],
  };
}

function queueRow(spec: RowSpec): ActionQueueItem {
  return {
    leadId: `lead-${spec.id}`,
    recommendationId: `rec-${spec.id}`,
    profileId: null,
    profileUrl: null,
    name: fact(spec.named ? `Kerri-${spec.id}` : null),
    headline: fact(null),
    company: fact(spec.named ? `Northwind-${spec.id}` : null),
    journeyState: fact(null),
    relationshipState: fact(null),
    actionType: spec.actionType,
    channel: "LINKEDIN",
    executionVerb: spec.verb,
    executable: spec.executable,
    unexecutableReason: spec.executable ? null : "ADVISORY",
    actionScore: {
      score: 50,
      scoreKind: "RECOMMENDATION_SCORE",
      scoreDisclaimer: DISCLAIMER,
      isDerived: true,
    },
    actionConfidence: 60,
    stateConfidence: 60,
    priorityTier: "TODAY",
    urgency: 40,
    expectedSuccessProbability: spec.expected,
    businessValue: spec.value,
    signalFreshness: 30,
    // `eventTimestamp` stays null on purpose: `WhyNowList` renders a *relative* time from
    // it, and a clock-dependent string would make clause 4's two readings differ across a
    // minute boundary rather than because of the dashboard.
    whyNow: Array.from({ length: spec.bullets }, (_, i) => ({
      signalId: `sig-${spec.id}-${i}`,
      signalType: null,
      eventTimestamp: null,
      effectiveStrength: 50,
      term: null,
      contributionHundredths: null,
      evidenceId: null,
    })),
    expiresAt: null,
    computedAt: ISO,
  };
}

/**
 * A server-consistent feed: the two maps carry a true tally of `items`, minus the keys
 * the draw says the server did not count, and `total` may exceed `items.length` because
 * `limit` capped the list the page was handed.
 */
function buildFeed(spec: FeedSpec): AttentionFeed {
  const items = spec.items.map(attentionItem);
  const byTier: Partial<Record<ConsequenceTier, number>> = {};
  const byTrigger: Partial<Record<AttentionTrigger, number>> = {};

  items.forEach((item) => {
    if (!spec.dropTiers.includes(item.consequenceTier)) {
      byTier[item.consequenceTier] = (byTier[item.consequenceTier] ?? 0) + 1;
    }
    if (!spec.dropTriggers.includes(item.trigger)) {
      byTrigger[item.trigger] = (byTrigger[item.trigger] ?? 0) + 1;
    }
  });

  return {
    periodDays: 7,
    computedAt: ISO,
    summary: { total: items.length + spec.totalOffset, byTier, byTrigger },
    items,
  };
}

function buildQueue(rows: RowSpec[]): ActionQueuePage {
  return { items: rows.map(queueRow), nextCursor: null, hasMore: false };
}

// ─── Generators ───────────────────────────────────────────────────────────────
//
// Both id pools are 1–12 so feed items and queue rows collide often: block 3's join by
// `leadId` then exercises both branches — a row found, and a prospect the queue has no
// live recommendation for.

const itemSpecArb: fc.Arbitrary<ItemSpec> = fc.record({
  id: fc.integer({ min: 1, max: 12 }),
  trigger: fc.constantFrom(...TRIGGERS),
  tier: fc.constantFrom(...CONSEQUENCE_TIER_ORDER),
  named: fc.boolean(),
});

const feedSpecArb: fc.Arbitrary<FeedSpec> = fc.record({
  // One item per prospect per trigger (R10.2), which is also what keeps the rendered
  // entries individually addressable by `${leadId}|${trigger}`.
  items: fc.uniqueArray(itemSpecArb, {
    selector: (s) => `${s.id}|${s.trigger}`,
    maxLength: 8,
  }),
  totalOffset: fc.integer({ min: 0, max: 40 }),
  dropTiers: fc.subarray([...CONSEQUENCE_TIER_ORDER]),
  dropTriggers: fc.subarray([...TRIGGERS]),
});

const rowSpecArb: fc.Arbitrary<RowSpec> = fc.record({
  id: fc.integer({ min: 1, max: 12 }),
  named: fc.boolean(),
  executable: fc.boolean(),
  verb: fc.constantFrom<RowSpec["verb"]>("SEND_MESSAGE", "CONNECT", "MEETING_REQUEST", null),
  actionType: fc.constantFrom(...ACTION_TYPES),
  expected: fc.integer({ min: 0, max: 100 }),
  value: fc.integer({ min: 0, max: 100 }),
  bullets: fc.integer({ min: 0, max: 2 }),
});

const queueArb: fc.Arbitrary<RowSpec[]> = fc.uniqueArray(rowSpecArb, {
  selector: (r) => r.id,
  maxLength: 6,
});

/** A dashboard, or `null` for a dashboard read that fails. Both are ignored by the page. */
const dashboardArb: fc.Arbitrary<Dashboard | null> = fc.option(
  fc.record({
    periodDays: fc.constantFrom(7, 14, 30),
    computedAt: fc.constant(ISO),
    aggregates: fc.uniqueArray(
      fc.record({
        key: fc.constantFrom(...AGGREGATE_KEYS),
        count: fc.integer({ min: 0, max: 500 }),
        filter: fc.constant({ route: "/action-queue", criteria: [], periodDays: 7 }),
      }),
      { selector: (a) => a.key, maxLength: 4 },
    ),
  }),
  { nil: null },
);

// ─── Mounting and reading ─────────────────────────────────────────────────────

const norm = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** How many Nina summary blocks are in the document. A leak from a previous run is 2. */
const mounted = () =>
  document.querySelectorAll(`[data-testid="${NINA_BLOCK_TEST_IDS.summary}"]`).length;

async function mountNina(): Promise<HTMLElement> {
  const { container } = render(
    <MemoryRouter initialEntries={[`/nina/${SPACE.id}`]}>
      <Routes>
        <Route path="/nina/:spaceId" element={<Ninna />} />
      </Routes>
    </MemoryRouter>,
  );

  // The blocks appear once the brief and the feed have both arrived; before that the page
  // is `BriefLoading` and nothing below is queryable.
  await waitFor(() =>
    expect(within(container).queryByTestId(NINA_BLOCK_TEST_IDS.summary)).not.toBeNull(),
  );

  return container;
}

/** One count row of the summary: the band or trigger it is for, its label and its number. */
interface CountRow {
  key: string;
  label: string;
  count: number;
}

/** One entry of blocks 1, 3 or 4, addressed by the hooks the entry carries. */
interface Entry {
  leadId: string;
  tier: string | null;
  trigger: string | null;
  actionType: string | null;
  text: string;
}

/** Everything Property 33 makes a claim about, read off one mount. */
interface Reading {
  total: number;
  tiers: CountRow[];
  triggers: CountRow[];
  summaryText: string;
  summaryControls: number;
  summaryEntries: number;
  priorities: Entry[];
  opportunities: Entry[];
  suggested: Entry[];
  /** All four blocks' text, for the character-for-character dashboard comparison. */
  blocksText: string;
}

function entriesOf(block: Element, selector: string): Entry[] {
  return Array.from(block.querySelectorAll(selector)).map((node) => ({
    leadId: node.getAttribute("data-lead-id") ?? "",
    tier: node.getAttribute("data-consequence-tier"),
    trigger: node.getAttribute("data-attention-trigger"),
    actionType: node.getAttribute("data-action-type"),
    text: norm(node.textContent),
  }));
}

function countRows(block: Element, attribute: string): CountRow[] {
  return Array.from(block.querySelectorAll(`[${attribute}]`)).map((row) => ({
    key: row.getAttribute(attribute)!,
    label: norm(row.querySelector("dt")?.textContent),
    count: Number(norm(row.querySelector("dd")?.textContent)),
  }));
}

function read(container: HTMLElement): Reading {
  const q = within(container);
  const summary = q.getByTestId(NINA_BLOCK_TEST_IDS.summary);
  const priorities = q.getByTestId(NINA_BLOCK_TEST_IDS.priorities);
  const opportunities = q.getByTestId(NINA_BLOCK_TEST_IDS.opportunities);
  const suggested = q.getByTestId(NINA_BLOCK_TEST_IDS.suggestedActions);

  // The total, found through the label beside it rather than through a class or a position:
  // the figure is the element immediately before the words that name it.
  const labelled = Array.from(summary.querySelectorAll("p")).filter(
    (p) => norm(p.textContent) === NINA_GTM_LABELS.summaryTotal,
  );
  expect(labelled).toHaveLength(1);

  return {
    total: Number(norm(labelled[0].previousElementSibling?.textContent)),
    tiers: countRows(summary, "data-consequence-tier"),
    triggers: countRows(summary, "data-attention-trigger"),
    summaryText: norm(summary.textContent),
    summaryControls: summary.querySelectorAll("button, a[href]").length,
    summaryEntries: summary.querySelectorAll("[data-lead-id]").length,
    priorities: entriesOf(priorities, "button[data-lead-id]"),
    opportunities: entriesOf(opportunities, "li[data-lead-id]"),
    suggested: entriesOf(suggested, "button[data-lead-id]"),
    blocksText: [priorities, summary, opportunities, suggested]
      .map((block) => norm(block.textContent))
      .join(" | "),
  };
}

const entryKey = (entry: Entry) => `${entry.leadId}|${entry.trigger}`;
const itemKey = (item: AttentionItem) => `${item.leadId}|${item.trigger}`;

// ─── The properties ───────────────────────────────────────────────────────────

beforeAll(() => {
  // jsdom has no scroll implementation and Nina scrolls the chat dock on every message.
  Element.prototype.scrollIntoView = vi.fn();
});

/**
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.9, 10.11**
 */
describe("Property 33: Nina's counts are the feed's counts and nothing else", () => {
  it(
    "presents the payload's counts, the top band's items, and no task line in the summary",
    // A hundred mounts of the page do not fit the 5s default.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(feedSpecArb, queueArb, dashboardArb, async (feedSpec, rows, dashboard) => {
          const feed = buildFeed(feedSpec);
          const queue = buildQueue(rows);
          served.feed = feed;
          served.queue = queue;
          served.dashboard = dashboard;

          const container = await mountNina();
          try {
            // One page on the screen, so every count below is this run's answer. A leaked
            // tree fails here saying it leaked, rather than three runs later as an
            // inexplicable entry count.
            expect(mounted()).toBe(1);

            const reading = read(container);

            // ── 1. Every count is the payload's count (R13.2) ──
            expect(reading.total).toBe(feed.summary.total);
            if (feedSpec.totalOffset > 0) {
              // A capped list: the workspace's total is the number to show, and the length
              // of what this page happened to be handed is not.
              expect(reading.total).not.toBe(feed.items.length);
            }

            const declaredTiers = CONSEQUENCE_TIER_ORDER.filter(
              (tier) => feed.summary.byTier[tier] !== undefined,
            );
            expect(reading.tiers.map((row) => row.key)).toEqual([...declaredTiers]);
            reading.tiers.forEach((row) => {
              const tier = row.key as ConsequenceTier;
              expect(row.count).toBe(feed.summary.byTier[tier]);
              // …and that declared count is true of the payload it came with.
              expect(row.count).toBe(
                feed.items.filter((item) => item.consequenceTier === tier).length,
              );
              expect(row.label).toBe(CONSEQUENCE_TIER_LABELS[tier]);
            });

            expect([...reading.triggers.map((row) => row.key)].sort()).toEqual(
              Object.keys(feed.summary.byTrigger).sort(),
            );
            reading.triggers.forEach((row) => {
              const trigger = row.key as AttentionTrigger;
              expect(row.count).toBe(feed.summary.byTrigger[trigger]);
              expect(row.count).toBe(
                feed.items.filter((item) => item.trigger === trigger).length,
              );
              expect(row.label).toBe(ATTENTION_TRIGGER_LABELS[trigger]);
            });

            // A key the server did not count is absent, never a zero (R18.2).
            CONSEQUENCE_TIER_ORDER.filter(
              (tier) => feed.summary.byTier[tier] === undefined,
            ).forEach((tier) => {
              expect(reading.tiers.some((row) => row.key === tier)).toBe(false);
            });
            TRIGGERS.filter((trigger) => feed.summary.byTrigger[trigger] === undefined).forEach(
              (trigger) => {
                expect(reading.triggers.some((row) => row.key === trigger)).toBe(false);
              },
            );

            // ── 2. The top band's block holds exactly the top band's items (R13.1) ──
            const top = CONSEQUENCE_TIER_ORDER[0];
            const expectedTop = feed.items.filter((item) => item.consequenceTier === top);
            expect(reading.priorities.map(entryKey)).toEqual(expectedTop.map(itemKey));
            reading.priorities.forEach((entry) => expect(entry.tier).toBe(top));

            // The block and the summary agree with each other, since they are two views of
            // one payload: where the server counted the top band, the block is that long.
            if (feed.summary.byTier[top] !== undefined) {
              expect(reading.priorities).toHaveLength(feed.summary.byTier[top]!);
            }

            // …and nothing else: the second band's block carries none of the first band's
            // items, so the two blocks partition the feed rather than overlapping it.
            reading.opportunities.forEach((entry) =>
              expect(entry.tier).toBe(CONSEQUENCE_TIER_ORDER[1]),
            );

            // ── 3. No full task line in the summary (R13.3) ──
            expect(reading.summaryEntries).toBe(0);
            // Not one control inside the block either: the way to the full detail is the
            // Action Queue control beside the heading, not a task in the counts.
            expect(reading.summaryControls).toBe(0);
            expect(reading.summaryText).not.toContain(ATTENTION_LABELS.taskSeparator.trim());
            feed.items.forEach((item) => {
              expect(reading.summaryText).not.toContain(item.reason);
              expect(reading.summaryText).not.toContain(item.requiredResponse);
              if (item.prospectName.value !== null) {
                expect(reading.summaryText).not.toContain(item.prospectName.value);
              }
              if (item.company.value !== null) {
                expect(reading.summaryText).not.toContain(item.company.value);
              }
            });

            // ── 5. Neither retired campaign call is issued (R13.9) ──
            expect(weezSpies.getActiveCampaignStatus).not.toHaveBeenCalled();
            expect(weezSpies.activateOutboundWorkforce).not.toHaveBeenCalled();
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 },
      );

      // Nothing outlives the property.
      expect(mounted()).toBe(0);
    },
  );

  it(
    "renders identically whatever the dashboard read returns, or fails to (R10.11)",
    // Two mounts a run, forty runs.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          feedSpecArb,
          queueArb,
          dashboardArb,
          dashboardArb,
          async (feedSpec, rows, first, second) => {
            const feed = buildFeed(feedSpec);
            const queue = buildQueue(rows);
            served.feed = feed;
            served.queue = queue;

            served.dashboard = first;
            let before: Reading | null = null;
            try {
              before = read(await mountNina());
            } finally {
              cleanup();
            }

            served.dashboard = second;
            try {
              const after = read(await mountNina());
              // Every value, every count and every entry hook — one payload varied, one
              // reading. A number sourced from `getDashboard` would move here.
              expect(after).toEqual(before);
            } finally {
              cleanup();
            }

            // The read is still issued: it is discarded, not dropped.
            expect(gtmSpies.getDashboard).toHaveBeenCalled();
          },
        ),
        { numRuns: 40 },
      );

      expect(mounted()).toBe(0);
    },
  );

  // ── The readable examples ───────────────────────────────────────────────────
  //
  // The properties answer "which numbers, over any payload". These two answer "what does
  // it actually say", by sentence, so a changed absence line or a zero standing in for a
  // count fails with the real string rather than with a generated spec.

  it("states a measured zero as 0 and says nothing needs the representative", async () => {
    served.feed = buildFeed({ items: [], totalOffset: 0, dropTiers: [], dropTriggers: [] });
    served.queue = buildQueue([]);
    served.dashboard = null;

    const container = await mountNina();
    const reading = read(container);
    const q = within(container);

    // A clear workspace is a measurement, not an absence: `0` and not "Unknown".
    expect(reading.total).toBe(0);
    expect(reading.tiers).toHaveLength(0);
    expect(reading.triggers).toHaveLength(0);

    expect(
      within(q.getByTestId(NINA_BLOCK_TEST_IDS.priorities)).getByText(ATTENTION_LABELS.empty),
    ).toBeInTheDocument();
    expect(
      within(q.getByTestId(NINA_BLOCK_TEST_IDS.opportunities)).getByText(ATTENTION_LABELS.empty),
    ).toBeInTheDocument();
    expect(
      within(q.getByTestId(NINA_BLOCK_TEST_IDS.suggestedActions)).getByText(
        NINA_GTM_LABELS.noSuggestedActions,
      ),
    ).toBeInTheDocument();
  });

  it("presents the workspace's total rather than the length of the page it was sent", async () => {
    served.feed = buildFeed({
      items: [
        { id: 1, trigger: "PROSPECT_REPLIED", tier: "IMMEDIATE", named: true },
        { id: 2, trigger: "AT_RISK_OR_LOSING", tier: "MATERIAL", named: true },
      ],
      totalOffset: 498,
      dropTiers: [],
      dropTriggers: [],
    });
    served.queue = buildQueue([]);
    served.dashboard = null;

    const reading = read(await mountNina());

    expect(reading.total).toBe(500);
    expect(reading.tiers).toEqual([
      { key: "IMMEDIATE", label: CONSEQUENCE_TIER_LABELS.IMMEDIATE, count: 1 },
      { key: "MATERIAL", label: CONSEQUENCE_TIER_LABELS.MATERIAL, count: 1 },
    ]);
    expect(reading.priorities.map((entry) => entry.leadId)).toEqual(["lead-1"]);
    expect(reading.opportunities.map((entry) => entry.leadId)).toEqual(["lead-2"]);
  });
});
