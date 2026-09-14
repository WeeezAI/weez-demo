// pages/__tests__/GTMActionQueue.attention.test.tsx
//
// The Attention_Checklist, tested for the three claims the design makes about it. All
// three are claims about *the same rendered list*, which is why they share one file and
// one harness rather than three copies of the same mount:
//
//   Property 30  the checklist is exactly the feed, grouped and ordered
//                (R11.1, R11.3, R11.4, R11.5, R11.6, R11.7)
//   Property 31  every task is reachable and says what it is
//                (R11.2, R11.10, R13.6, R19.1)
//   Property 32  selecting anything lands on its prospect in one step
//                (R11.8, R13.7, R14.10)
//
// ── What "exactly the feed" is measured against ────────────────────────────────
//
// The feed payload the harness serves *is* the reference. Every assertion compares the
// DOM against that payload — the item set, each item's due day, each item's band, each
// item's composed line — so a page that added a row from the ranked read, dropped an
// item into today's bucket because its `due_at` was unreadable, or re-sorted a day's
// items by its own opinion of urgency fails with the item it invented or moved. The
// ranked read is served alongside and is deliberately never allowed to be the reason a
// row exists: R11.5 is the whole point of task 16.1, so the queue payload in these runs
// holds rows for leads the feed never mentions, and none of them may appear.
//
// The two orderings are asserted apart, because only one of them belongs to the page.
// The *days* are the page's: newest first, the undated bucket last. The *items inside a
// day* are the server's, so the generator produces a legally ordered feed (tier, then
// newest, then lead id — the endpoint's own key) and the property asserts both that the
// rendered bands are non-increasing within each group and that the rendered sequence is
// the payload's own subsequence for that day. The second half is what catches a re-sort
// that happens to agree with the tier order; the first is what R11.4 actually says.
//
// ── Three surfaces, one destination ───────────────────────────────────────────
//
// Property 31 and Property 32 both reach past the Action Queue, because both design
// statements do: R13.6 is Nina's suggested-action label and R13.7 / R14.10 are her
// entries' and a meeting's destination. So Nina is mounted here too, from the same
// payloads, and the navigation instrument is shared. What that buys is that "one step to
// the prospect" is measured the same way on every surface that claims it, rather than
// three surfaces each proving it their own way.
//
// **The one arm with no rendered surface yet.** R14.10 is the Meetings page's selection,
// and `pages/Meetings.tsx` is still the pre-task-18 page — it derives its rows from the
// demo workspace and its one control opens Max. Mounting it here would assert against a
// page task 18.1 is about to delete. What *is* fixed and testable today is the
// destination those rows will carry: `prospectRoute()`, the composer task 18.2 names,
// which Nina's block 4 already uses. So the meeting arm below is that contract — the
// composed path resolves to the dossier with that prospect selected, and to one history
// entry — and the rendered-row arm belongs to task 18.3's suite, where the rows exist.
//
// ── Property-test hygiene, learned the hard way on this feature ────────────────
//
// 1. **Every query is scoped to its own render.** RTL binds both `screen` and the queries
//    on `render`'s return value to `document.body`, so a document-scoped query inside a
//    hundred-run property answers "what is on the page", not "what did this run render".
//    Everything below goes through `within(container)` or through `container.querySelector`.
// 2. **Each run unmounts what it mounted, at the end of the run.** `cleanup()` in a
//    `finally`, not at the start of the next run: fast-check re-runs the predicate while
//    shrinking, and an un-unmounted tree from run N would be counted by run N+1.
// 3. **Each mounting test carries an explicit 60s timeout.** A hundred page mounts do not
//    fit the 5s default, which is the same reason `routes.test.tsx` and
//    `ProspectDecision.test.tsx` carry theirs.
//
// ── Stubs, and why each one ────────────────────────────────────────────────────
//
// `gtmAPI`'s three reads are stubbed at the client rather than at `fetch`: the subject
// here is presentation over a payload, the normaliser has its own property suite
// (`services/__tests__/gtmAPI.test.ts`), and a wire fixture per run would put a hundred
// JSON round-trips inside each property for no assertion's benefit. Everything else in
// the module is the real thing. `ConversationSidebar`, `NinaGoalIntake`, `sonner` and
// `useAuth` are existing chrome around the surfaces under test, and `scrollIntoView` is a
// jsdom gap Nina's chat dock walks into — the same gap `ProspectIntelligence.tsx` guards
// against inline.

import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

// ─── Harness state, hoisted above the module mocks that read it ───────────────

const harness = vi.hoisted(() => {
  const state = {
    /** What `getAttentionFeed` answers. Unset is a failure, not an empty list. */
    feed: null as import("@/services/gtmAPI").AttentionFeed | null,
    /** What `getActionQueue` answers. Ranked detail — never a reason for a row. */
    queue: null as import("@/services/gtmAPI").ActionQueuePage | null,
  };
  return { state };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

vi.mock("@/components/NinaGoalIntake", () => ({
  default: () => <div data-testid="nina-goal-intake" />,
}));

vi.mock("@/contexts/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/AuthContext")>();
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      spaces: [],
      currentSpace: null,
      selectSpace: () => {},
    }),
  };
});

vi.mock("@/services/ninnaAPI", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ninnaAPI")>();
  const brief: import("@/services/ninnaAPI").DailyBrief = {
    greeting: "Good morning.",
    headline: "Two prospects moved while you were away.",
    narrative: "Nothing in this brief is a GTM statement — the four blocks make those.",
    sinceLabel: "since your last visit",
    agentSummaries: [],
    decisions: [],
    health: { label: "healthy", score: 70, summary: "", drivers: [] },
    timeline: [],
    recommendations: [],
    meetings: [],
    topLeads: [],
    revenueMetrics: [],
    gtmSummary: [],
    generatedAt: new Date().toISOString(),
    isDemo: false,
  };
  return {
    ...actual,
    // The brief is chrome for these properties: it gates Nina's body and carries no GTM
    // claim, so it resolves immediately and identically on every run.
    getCachedBrief: () => null,
    ninnaAPI: {
      ...actual.ninnaAPI,
      getDailyBrief: async () => brief,
      recordVisit: () => {},
      chat: async () => ({ text: "", cards: [] }),
    },
  };
});

vi.mock("@/services/gtmAPI", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/gtmAPI")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      getAttentionFeed: async () => {
        if (!harness.state.feed) throw new Error("harness: no attention feed was set");
        return harness.state.feed;
      },
      getActionQueue: async () =>
        harness.state.queue ?? { items: [], nextCursor: null, hasMore: false },
      // Nina issues this read and renders nothing from it (Property 33's subject). It
      // answers so her load path completes; nothing here reads the result.
      getDashboard: async () => ({ periodDays: 7, computedAt: null, aggregates: [] }),
    },
  };
});

import GTMActionQueue, {
  ATTENTION_PERIOD_DAYS,
  dayHeadingOf,
  dayKeyOf,
  queueRowTestId,
  taskLabel,
} from "../GTMActionQueue";
import Ninna, { NINA_BLOCK_TEST_IDS, prospectRoute } from "../Ninna";
import { UNKNOWN_TEXT } from "@/components/gtm/ObservedValue";
import {
  ATTENTION_LABELS,
  GTM_ACTION_LABELS,
  GTM_PAGE_LABELS,
} from "@/components/gtm/labels";
import type {
  ActionQueueItem,
  ActionQueuePage,
  ActionType,
  AttentionFeed,
  AttentionItem,
  AttentionTrigger,
  ConsequenceTier,
  ObservedFact,
} from "@/services/gtmAPI";

// ─── The vocabulary the three clauses are drawn from ──────────────────────────
//
// R11.2's task line is three clauses in a fixed order, and Property 31 reads that order
// back out of the accessible name by locating each clause inside it. That instrument only
// means something if no clause can be found inside another one, so the three lists are
// pairwise non-substring — and the first test in Property 31's block asserts exactly that
// rather than trusting the reading below.

/** Prospect names, as they arrive: a first name on an `ObservedFact`. */
const PROSPECT_NAMES = ["Kerri", "Ada", "Ravi", "Ingrid", "Mikkel", "Bo"] as const;

/** `AttentionItem.reason` — server prose. Never composed in the browser, never here. */
const REASONS = [
  "replied to your message",
  "moved from evaluation to decision",
  "viewed your profile twice this week",
  "has gone quiet since the intro call",
  "asked what it costs",
] as const;

/** `AttentionItem.requiredResponse` — the short imperative beside it. */
const REQUIRED_RESPONSES = [
  "Review and respond",
  "Offer a time",
  "Re-engage before it lapses",
  "Send the pricing note",
] as const;

const COMPANIES = ["Analytical Engines", "Northwind", "Kestrel Labs"] as const;

/** The nine Attention_Triggers, as `gtmAPI.ts` declares them. */
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
] as const;

/** The four Consequence_Tiers, most consequential first. The endpoint's own order. */
const TIERS: readonly ConsequenceTier[] = ["IMMEDIATE", "MATERIAL", "IMPORTANT", "OTHER"] as const;

/** How consequential a band is. Higher is more consequential, so R11.4 is "non-increasing". */
const rankOf = (tier: string): number => {
  const at = TIERS.indexOf(tier as ConsequenceTier);
  return at === -1 ? -1 : TIERS.length - at;
};

const HOUR_MS = 3_600_000;

/** The workspace. One URL path segment, deliberately free of anything needing escaping. */
const SPACE_ID = "space-42";
const QUEUE_PATH = `/action-queue/${SPACE_ID}`;
const NINA_PATH = `/ninna/${SPACE_ID}`;
const DOSSIER_PATH = `/prospect-intelligence/${SPACE_ID}`;

const ROW_TESTID_PREFIX = queueRowTestId("");

const normalise = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

// ─── Payload fixtures ─────────────────────────────────────────────────────────

function fact(value: string | null): ObservedFact {
  return {
    value,
    isUnknown: value === null,
    sourceSurface: value === null ? null : "LINKEDIN_PROFILE_PAGE",
    observedAt: value === null ? null : new Date(Date.now() - 3 * HOUR_MS).toISOString(),
    isStale: false,
    isDerived: false,
  };
}

/** What `factText()` reduces a fact to inside a composed line: the value, or "Unknown". */
const factText = (held: ObservedFact) =>
  held.isUnknown || held.value === null ? UNKNOWN_TEXT : held.value;

interface ItemSpec {
  leadId: string;
  /** `null` generates the unknown branch — a prospect nobody observed a name for. */
  name: string | null;
  company: string | null;
  trigger: AttentionTrigger;
  reason: string;
  requiredResponse: string;
  tier: ConsequenceTier;
  /**
   * How long ago the attention became due, or `null` for an instant that cannot be read.
   *
   * The undated case is generated because it is the one the page must not file under
   * today: `due_at` is non-null server-side, so an unreadable one is a payload we should
   * bucket honestly rather than date ourselves.
   */
  dueHoursAgo: number | null;
  /** Whether the payload carried a route, or the page has to fall back to its own. */
  hasRoute: boolean;
}

const attentionItem = (spec: ItemSpec): AttentionItem => ({
  leadId: spec.leadId,
  prospectName: fact(spec.name),
  company: fact(spec.company),
  trigger: spec.trigger,
  reason: spec.reason,
  requiredResponse: spec.requiredResponse,
  consequenceTier: spec.tier,
  escalatedFrom: null,
  escalationReason: null,
  dueAt:
    spec.dueHoursAgo === null
      ? ""
      : new Date(Date.now() - spec.dueHoursAgo * HOUR_MS).toISOString(),
  computedAt: new Date().toISOString(),
  route: spec.hasRoute ? prospectRoute(SPACE_ID, spec.leadId) : "",
  criteria: [],
});

/**
 * The endpoint's own ordering: band first, then newest, then lead id (§6.1, R10.5).
 *
 * The generator applies this so the payload the page is handed is a *legal* feed. Without
 * it, "the rendered order is the payload's order" would be satisfied by a payload no
 * server could send, and R11.4 would go untested.
 */
function serverOrder(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    const band = rankOf(b.consequenceTier) - rankOf(a.consequenceTier);
    if (band !== 0) return band;
    const newest = (b.dueAt || "").localeCompare(a.dueAt || "");
    if (newest !== 0) return newest;
    return a.leadId.localeCompare(b.leadId);
  });
}

function feedOf(items: AttentionItem[]): AttentionFeed {
  const byTier: Partial<Record<ConsequenceTier, number>> = {};
  const byTrigger: Partial<Record<AttentionTrigger, number>> = {};
  for (const item of items) {
    byTier[item.consequenceTier] = (byTier[item.consequenceTier] ?? 0) + 1;
    byTrigger[item.trigger] = (byTrigger[item.trigger] ?? 0) + 1;
  }
  return {
    periodDays: ATTENTION_PERIOD_DAYS,
    computedAt: new Date().toISOString(),
    summary: { total: items.length, byTier, byTrigger },
    items,
  };
}

interface QueueSpec {
  leadId: string;
  name: string | null;
  verb: ActionType | null;
  executable: boolean;
}

const score = (value: number | null) => ({
  score: value,
  scoreKind: "RECOMMENDATION_SCORE" as const,
  scoreDisclaimer: "A prioritisation signal, not a predicted probability of conversion.",
  isDerived: true as const,
});

const queueRow = (spec: QueueSpec): ActionQueueItem => ({
  leadId: spec.leadId,
  recommendationId: `rec-${spec.leadId}`,
  profileId: `profile-${spec.leadId}`,
  profileUrl: null,
  name: fact(spec.name),
  headline: fact("Head of Engineering"),
  company: fact("Analytical Engines"),
  journeyState: fact("ENGAGED"),
  relationshipState: fact("CONNECTED"),
  actionType: "SEND_LINKEDIN_WARMUP",
  channel: "LINKEDIN",
  executionVerb: spec.verb,
  executable: spec.executable && spec.verb !== null,
  unexecutableReason: spec.executable && spec.verb !== null ? null : "ADVISORY",
  actionScore: score(72),
  actionConfidence: 61,
  stateConfidence: 58,
  priorityTier: "TODAY",
  urgency: 64,
  expectedSuccessProbability: 47,
  businessValue: 55,
  signalFreshness: 80,
  whyNow: [],
  expiresAt: null,
  computedAt: new Date().toISOString(),
});

const queuePageOf = (items: ActionQueueItem[]): ActionQueuePage => ({
  items,
  nextCursor: null,
  hasMore: false,
});

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * A lead identifier, as one URL query value.
 *
 * The formats the product issues plus a small constant pool, which is what makes two
 * items *share a prospect* in a good share of runs — one item per prospect per trigger is
 * the endpoint's rule, so a checklist with the same lead on two lines is a real payload
 * and the row test id repeats there. Values needing percent-escaping are excluded: the
 * destination assertion reads `lead_id` back through the router's own parser, and a
 * generator that also exercised escaping would be testing URL encoding instead of
 * navigation.
 */
const leadIdArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom("lead-1", "lead-2", "lead-3") },
  { weight: 2, arbitrary: fc.uuid() },
  {
    weight: 1,
    arbitrary: fc.string({
      unit: fc.constantFrom(
        ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_".split(""),
      ),
      minLength: 1,
      maxLength: 20,
    }),
  },
);

const itemSpecArb: fc.Arbitrary<ItemSpec> = fc.record({
  leadId: leadIdArb,
  name: fc.option(fc.constantFrom(...PROSPECT_NAMES), { nil: null, freq: 6 }),
  company: fc.option(fc.constantFrom(...COMPANIES), { nil: null, freq: 6 }),
  trigger: fc.constantFrom(...TRIGGERS),
  reason: fc.constantFrom(...REASONS),
  requiredResponse: fc.constantFrom(...REQUIRED_RESPONSES),
  tier: fc.constantFrom(...TIERS),
  // Inside the feed's own seven-day window, so every group heading is one the page has
  // copy for: today, yesterday, or the date. `null` is the unreadable instant.
  dueHoursAgo: fc.option(fc.integer({ min: 0, max: 24 * 7 }), { nil: null, freq: 8 }),
  hasRoute: fc.boolean(),
});

/** One item per prospect per trigger, which is the endpoint's guarantee. */
const feedSpecArb = (min: number, max: number) =>
  fc.uniqueArray(itemSpecArb, {
    selector: (spec) => `${spec.leadId}|${spec.trigger}`,
    minLength: min,
    maxLength: max,
  });

/** The three execution verbs, as one arbitrary the two queue generators share. */
const verbArb = fc.constantFrom("SEND_MESSAGE", "CONNECT", "MEETING_REQUEST") as fc.Arbitrary<ActionType>;

/**
 * Ranked rows for leads the feed never mentions.
 *
 * R11.5's negative case, served on every run of Property 30: the queue read is present,
 * it holds recommendations, and not one of them may become a task.
 */
const strangerQueueArb = fc.array(
  fc.record({
    leadId: fc.string({
      unit: fc.constantFrom(..."abcdef0123456789".split("")),
      minLength: 6,
      maxLength: 10,
    }).map((tail) => `stranger-${tail}`),
    name: fc.constantFrom(...PROSPECT_NAMES),
    verb: verbArb,
    executable: fc.boolean(),
  }),
  { minLength: 0, maxLength: 4 },
);

// ─── Render harness ───────────────────────────────────────────────────────────

/**
 * The dossier, as a sentinel that says which prospect it was handed.
 *
 * The real page is not the subject of any of these properties and mounting it would put
 * its own reads inside every navigation assertion. What "with that prospect selected"
 * needs is the two values the router parsed, so this renders exactly those.
 */
function DossierStub() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [search] = useSearchParams();
  return (
    <div
      data-testid="dossier-stub"
      data-space-id={spaceId ?? ""}
      data-lead-id={search.get("lead_id") ?? ""}
    />
  );
}

const BACK_CONTROL = "probe-back";

/**
 * Every location the router settled on, in order, plus a Back control.
 *
 * Consecutive duplicates are collapsed, so the log counts *transitions* rather than
 * renders — React re-renders the tree for reasons that are not navigations. Two entries
 * therefore means one step, three means two, and the Back control is the second reading
 * of the same claim: a control that pushed twice leaves the reader on the destination
 * after one Back.
 */
function LocationLog({ log }: { log: string[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const here = `${location.pathname}${location.search}`;
  if (log[log.length - 1] !== here) log.push(here);
  return (
    <button type="button" data-testid={BACK_CONTROL} onClick={() => navigate(-1)}>
      Back
    </button>
  );
}

function mountAt(path: string) {
  const log: string[] = [];
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/action-queue/:spaceId" element={<GTMActionQueue />} />
        <Route path="/ninna/:spaceId" element={<Ninna />} />
        <Route path="/prospect-intelligence/:spaceId" element={<DossierStub />} />
        <Route path="*" element={<div data-testid="elsewhere" />} />
      </Routes>
      <LocationLog log={log} />
    </MemoryRouter>,
  );
  return { container: utils.container, log, view: within(utils.container) };
}

/** The checklist has answered: either the list region or the nothing-needs-you sentence. */
async function settleQueue(container: HTMLElement) {
  await waitFor(() => {
    const listed = container.querySelector("ul[aria-label]") !== null;
    const empty = (container.textContent ?? "").includes(ATTENTION_LABELS.empty);
    expect(listed || empty).toBe(true);
  });
}

/** Nina's four blocks are on screen, which is what her two GTM reads landing looks like. */
async function settleNina(container: HTMLElement) {
  await waitFor(() => {
    expect(
      container.querySelector(`[data-testid="${NINA_BLOCK_TEST_IDS.suggestedActions}"]`),
    ).not.toBeNull();
  });
}

// ─── Reading the checklist back out of the DOM ────────────────────────────────

interface RenderedTask {
  /** `${leadId}|${trigger}` — the feed's own identity for an item. */
  key: string;
  leadId: string;
  trigger: string;
  tier: string;
  day: string;
  /** The accessible name of the task's control, which is the whole task line (R11.10). */
  name: string;
  control: HTMLElement;
  /** The disclosure beside a mandatory task, when the row carries one. */
  toggle: HTMLElement | null;
}

interface RenderedGroup {
  day: string;
  heading: string;
  tasks: RenderedTask[];
}

function readTask(row: Element): RenderedTask {
  const testId = row.getAttribute("data-testid") ?? "";
  const control = row.querySelector<HTMLElement>("button[aria-label]");
  if (!control) throw new Error(`row ${testId} rendered no task control`);
  return {
    key: `${testId.slice(ROW_TESTID_PREFIX.length)}|${row.getAttribute("data-attention-trigger") ?? ""}`,
    leadId: testId.slice(ROW_TESTID_PREFIX.length),
    trigger: row.getAttribute("data-attention-trigger") ?? "",
    tier: row.getAttribute("data-consequence-tier") ?? "",
    day: row.getAttribute("data-day") ?? "",
    name: normalise(control.getAttribute("aria-label")),
    control,
    toggle: row.querySelector<HTMLElement>("button[aria-expanded]"),
  };
}

/**
 * The list as groups, in the order they are presented.
 *
 * Walked as the list's own children rather than collected by attribute, because "each
 * task sits under the group equal to its due date" is a statement about *position*: a row
 * carrying `data-day="…"` while sitting under yesterday's heading has to fail.
 */
function groupsOf(container: HTMLElement): RenderedGroup[] {
  const list = container.querySelector("ul[aria-label]");
  if (!list) return [];
  const groups: RenderedGroup[] = [];
  for (const child of Array.from(list.children)) {
    if (child.hasAttribute("data-day-heading")) {
      groups.push({
        day: child.getAttribute("data-day-heading") ?? "",
        heading: normalise(child.querySelector("h2")?.textContent),
        tasks: [],
      });
      continue;
    }
    if (!child.hasAttribute("data-attention-trigger")) continue;
    if (groups.length === 0) throw new Error("a task was rendered before any day heading");
    groups[groups.length - 1].tasks.push(readTask(child));
  }
  return groups;
}

/** Anything that would make this a column-and-row record table (R11.6). */
const TABLE_SHAPED =
  'table, [role="table"], [role="grid"], [role="treegrid"], [role="row"], [role="rowgroup"], [role="columnheader"], [role="rowheader"], [role="gridcell"]';

const keyOf = (item: AttentionItem) => `${item.leadId}|${item.trigger}`;

beforeEach(() => {
  harness.state.feed = null;
  harness.state.queue = null;
  // jsdom implements no layout, so `scrollIntoView` is absent from the prototype and
  // Nina's chat dock — which calls it on every message change — would take the render
  // down. Stubbed rather than guarded in the page: the call is correct in a browser.
  if (!("scrollIntoView" in HTMLElement.prototype)) {
    (HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView =
      () => {};
  }
});

// ─── Property 30 ──────────────────────────────────────────────────────────────
//
// Feature: sales-workflow-frontend-restructure, Property 30: The checklist is exactly the
// feed, grouped and ordered.
//
// *For any* attention feed, the rendered task set equals the feed's item set with no
// additions, each task sits under the group equal to its due date, the bands are
// non-increasing within each group, there is exactly one list region and no record table.
//
// **Validates: Requirements 11.1, 11.3, 11.4, 11.5, 11.6, 11.7**

describe("Feature: sales-workflow-frontend-restructure, Property 30: The checklist is exactly the feed, grouped and ordered", () => {
  it(
    "renders one task per feed item, under its own due day, in the server's band order",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(feedSpecArb(0, 8), strangerQueueArb, async (specs, strangers) => {
          const items = serverOrder(specs.map(attentionItem));
          const feed = feedOf(items);
          harness.state.feed = feed;
          // Ranked rows for prospects the feed never named. None of them is a task.
          harness.state.queue = queuePageOf(strangers.map(queueRow));

          const { container, view } = mountAt(QUEUE_PATH);
          try {
            await settleQueue(container);

            const groups = groupsOf(container);
            const rendered = groups.flatMap((group) => group.tasks);
            const byKey = new Map(items.map((item) => [keyOf(item), item]));

            // ── The set is the feed's, with nothing added and nothing dropped (R11.1, R11.5) ──
            expect(rendered).toHaveLength(items.length);
            expect(rendered.map((task) => task.key).sort()).toEqual(
              items.map(keyOf).sort(),
            );

            // Each line is the item's own three clauses, composed once (R11.1).
            for (const task of rendered) {
              const item = byKey.get(task.key);
              expect(item).toBeDefined();
              expect(task.name).toBe(normalise(taskLabel(item!)));
              expect(task.tier).toBe(item!.consequenceTier);
            }

            // ── One group per due day, newest first, the undated bucket last (R11.3) ──
            const days = groups.map((group) => group.day);
            expect(new Set(days).size).toBe(days.length);
            expect(days).toEqual([...days].sort().reverse());

            for (const group of groups) {
              expect(group.heading).toBe(dayHeadingOf(group.day));
              // Every task under this heading is due on this day, and says so.
              for (const task of group.tasks) {
                const item = byKey.get(task.key)!;
                expect(task.day).toBe(group.day);
                expect(group.day).toBe(dayKeyOf(item.dueAt));
              }

              // ── The band order inside the group (R11.4) ──
              const ranks = group.tasks.map((task) => rankOf(task.tier));
              for (let at = 1; at < ranks.length; at += 1) {
                expect(ranks[at]).toBeLessThanOrEqual(ranks[at - 1]);
              }
              // …and it is the server's order, not a re-sort that happens to agree: the
              // group is the payload's own subsequence for this day.
              expect(group.tasks.map((task) => task.key)).toEqual(
                items.filter((item) => dayKeyOf(item.dueAt) === group.day).map(keyOf),
              );
            }

            // ── One list, no table (R11.6, R11.7) ──
            expect(view.queryAllByRole("list")).toHaveLength(items.length === 0 ? 0 : 1);
            expect(container.querySelectorAll(TABLE_SHAPED)).toHaveLength(0);

            // An empty feed is a sentence, not an empty list region (R11.9).
            if (items.length === 0) {
              expect(container.textContent).toContain(ATTENTION_LABELS.empty);
            }

            // Opening the one disclosure the page has must not add a second list region:
            // "exactly one" has to stay true after a press, not only on first paint.
            const mandatory = rendered.find((task) => task.toggle !== null);
            if (mandatory) {
              fireEvent.click(mandatory.toggle!);
              expect(view.queryAllByRole("list")).toHaveLength(1);
              expect(container.querySelectorAll(TABLE_SHAPED)).toHaveLength(0);
            }
          } finally {
            // At the end of the run, not the start of the next one: fast-check re-runs
            // this predicate while shrinking.
            cleanup();
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});

// ─── Property 31 ──────────────────────────────────────────────────────────────
//
// Feature: sales-workflow-frontend-restructure, Property 31: Every task is reachable and
// says what it is.
//
// *For any* attention feed, each task is keyboard focusable and operable and its
// accessible name carries the prospect, the trigger clause and the required response in
// that order; and *for any* ranked row Nina presents as a suggested action, its label is
// the verb followed by the prospect's name.
//
// **Validates: Requirements 11.2, 11.10, 13.6, 19.1**

describe("Feature: sales-workflow-frontend-restructure, Property 31: Every task is reachable and says what it is", () => {
  it("draws the three clauses from vocabularies none of which contains another", () => {
    // The instrument: Property 31 locates each clause inside the accessible name, which
    // says nothing at all if one clause can be found inside another. Asserted rather than
    // assumed, because a later edit to one of the three lists could quietly make every
    // ordering assertion below vacuous.
    const all = [...PROSPECT_NAMES, ...REASONS, ...REQUIRED_RESPONSES, UNKNOWN_TEXT];
    for (const one of all) {
      for (const other of all) {
        if (one === other) continue;
        expect(other.includes(one)).toBe(false);
      }
    }
  });

  it(
    "gives every task a focusable control whose name reads prospect, trigger, response",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          feedSpecArb(1, 6),
          fc.nat(),
          async (specs, pick) => {
            const items = serverOrder(specs.map(attentionItem));
            harness.state.feed = feedOf(items);
            harness.state.queue = queuePageOf([]);

            const { container, log } = mountAt(QUEUE_PATH);
            try {
              await settleQueue(container);

              const rendered = groupsOf(container).flatMap((group) => group.tasks);
              const byKey = new Map(items.map((item) => [keyOf(item), item]));
              expect(rendered).toHaveLength(items.length);

              for (const task of rendered) {
                // ── Reachable (R19.1) ──
                expect(task.control.tagName).toBe("BUTTON");
                expect(task.control).not.toBeDisabled();
                expect(task.control.getAttribute("tabindex")).not.toBe("-1");
                task.control.focus();
                expect(document.activeElement).toBe(task.control);

                // ── Says what it is, in the declared order (R11.2, R11.10) ──
                const item = byKey.get(task.key)!;
                const prospect = factText(item.prospectName);
                const at = (clause: string) => {
                  const found = task.name.indexOf(clause);
                  expect(found).toBeGreaterThanOrEqual(0);
                  return found;
                };
                expect(at(prospect)).toBeLessThan(at(item.reason));
                expect(at(item.reason)).toBeLessThan(at(item.requiredResponse));
              }

              // ── Operable by keyboard alone (R19.1) ──
              //
              // One generated task per run rather than all of them: the claim is about
              // the control's type, which is uniform across the list, and a keyboard
              // press costs far more than a focus call.
              const chosen = rendered[pick % rendered.length];
              const before = log.length;
              chosen.control.focus();
              const user = userEvent.setup({ document });
              await user.keyboard("{Enter}");
              expect(log.length).toBe(before + 1);
              expect(log[log.length - 1]).toContain(DOSSIER_PATH);
            } finally {
              cleanup();
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    "labels each of Nina's suggested actions with the verb, then the prospect",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(
            fc.record({
              leadId: leadIdArb,
              name: fc.option(fc.constantFrom(...PROSPECT_NAMES), { nil: null, freq: 5 }),
              verb: fc.option(verbArb, { nil: null, freq: 6 }),
              executable: fc.boolean(),
            }),
            { selector: (spec) => spec.leadId, minLength: 1, maxLength: 5 },
          ),
          async (specs) => {
            // At least one row a control can actually run, so the property has something
            // to read in every run; the rest of the mix is what proves an advisory row is
            // not a suggested action.
            const rows = [
              ...specs.map(queueRow),
              queueRow({
                leadId: "lead-executable",
                name: "Kerri",
                verb: "SEND_MESSAGE",
                executable: true,
              }),
            ];
            harness.state.feed = feedOf([]);
            harness.state.queue = queuePageOf(rows);

            const { container } = mountAt(NINA_PATH);
            try {
              await settleNina(container);

              const block = container.querySelector<HTMLElement>(
                `[data-testid="${NINA_BLOCK_TEST_IDS.suggestedActions}"]`,
              );
              expect(block).not.toBeNull();

              const eligible = rows.filter((row) => row.executable && row.executionVerb);
              const controls = Array.from(
                block!.querySelectorAll<HTMLElement>("button[data-lead-id]"),
              );
              expect(controls).toHaveLength(eligible.length);

              const byLead = new Map(eligible.map((row) => [row.leadId, row]));
              for (const control of controls) {
                const row = byLead.get(control.getAttribute("data-lead-id") ?? "");
                expect(row).toBeDefined();
                const verb = GTM_ACTION_LABELS[row!.executionVerb as ActionType];
                const prospect = factText(row!.name);
                const label = normalise(control.textContent);

                // "Contact Kerri" (R13.6): the verb from the one label table, then the
                // prospect's name, in that order and in one control.
                expect(label.startsWith(verb)).toBe(true);
                expect(label.slice(verb.length).trim().startsWith(prospect)).toBe(true);
                expect(label.indexOf(verb)).toBeLessThan(label.indexOf(prospect));
              }
            } finally {
              cleanup();
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ─── Property 32 ──────────────────────────────────────────────────────────────
//
// Feature: sales-workflow-frontend-restructure, Property 32: Selecting anything lands on
// its prospect in one step.
//
// *For any* attention item, queue item, opportunity, suggested action or meeting,
// activating it performs a single navigation to the dossier with that prospect selected.
//
// The three surfaces are asserted with one instrument: the location log counts the
// transitions and the dossier sentinel reports which prospect the router handed it, so
// "one step" and "its prospect" are the same two readings everywhere. The meeting arm is
// the destination contract rather than a rendered row, for the reason the file header
// gives — `pages/Meetings.tsx` is still the pre-task-18 page.
//
// **Validates: Requirements 11.8, 13.7, 14.10**

describe("Feature: sales-workflow-frontend-restructure, Property 32: Selecting anything lands on its prospect in one step", () => {
  /**
   * One activation, checked twice: the log holds exactly one transition, and the dossier
   * it landed on is the one for this prospect. Then Back, which is the second reading of
   * "one step" — a control that pushed two entries leaves the reader on the destination.
   */
  async function expectOneStepTo(
    container: HTMLElement,
    log: string[],
    from: string,
    leadId: string,
    activate: () => void,
  ) {
    expect(log).toEqual([from]);
    activate();

    const stub = container.querySelector<HTMLElement>('[data-testid="dossier-stub"]');
    expect(stub).not.toBeNull();
    expect(stub!.getAttribute("data-space-id")).toBe(SPACE_ID);
    expect(stub!.getAttribute("data-lead-id")).toBe(leadId);
    expect(log).toHaveLength(2);
    expect(log[1].startsWith(DOSSIER_PATH)).toBe(true);

    fireEvent.click(container.querySelector(`[data-testid="${BACK_CONTROL}"]`)!);
    await act(async () => {});
    expect(log[log.length - 1]).toBe(from);
  }

  it(
    "sends a selected checklist task to its own prospect's dossier",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          feedSpecArb(1, 6),
          fc.nat(),
          async (specs, pick) => {
            const items = serverOrder(specs.map(attentionItem));
            harness.state.feed = feedOf(items);
            harness.state.queue = queuePageOf([]);

            const { container, log } = mountAt(QUEUE_PATH);
            try {
              await settleQueue(container);
              const rendered = groupsOf(container).flatMap((group) => group.tasks);
              expect(rendered).toHaveLength(items.length);

              const chosen = rendered[pick % rendered.length];
              await expectOneStepTo(container, log, QUEUE_PATH, chosen.leadId, () =>
                fireEvent.click(chosen.control),
              );
            } finally {
              cleanup();
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    "sends a selected priority, opportunity or suggested action to its own prospect's dossier",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Nina's entries are addressed by lead id, so one item per prospect here.
          fc.uniqueArray(itemSpecArb, {
            selector: (spec) => spec.leadId,
            minLength: 2,
            maxLength: 5,
          }),
          fc.constantFrom("priority", "opportunity", "suggested"),
          fc.nat(),
          async (specs, kind, pick) => {
            // The two bands Nina's blocks 1 and 3 are views of, and a route on every
            // entry: her blocks follow `item.route` as sent and have no fallback, which
            // is correct — the endpoint's `route` is non-null.
            const items = serverOrder(
              specs.map((spec, at) =>
                attentionItem({
                  ...spec,
                  hasRoute: true,
                  tier: at % 2 === 0 ? "IMMEDIATE" : "MATERIAL",
                }),
              ),
            );
            const rows = items.map((item, at) =>
              queueRow({
                leadId: item.leadId,
                name: item.prospectName.value,
                verb: "SEND_MESSAGE",
                executable: at % 2 === 1,
              }),
            );
            harness.state.feed = feedOf(items);
            harness.state.queue = queuePageOf(rows);

            const { container, log } = mountAt(NINA_PATH);
            try {
              await settleNina(container);

              const blockId =
                kind === "priority"
                  ? NINA_BLOCK_TEST_IDS.priorities
                  : kind === "opportunity"
                    ? NINA_BLOCK_TEST_IDS.opportunities
                    : NINA_BLOCK_TEST_IDS.suggestedActions;
              const block = container.querySelector<HTMLElement>(
                `[data-testid="${blockId}"]`,
              );
              expect(block).not.toBeNull();

              // Each block addresses its entries by lead id; an opportunity's control is
              // the `Open prospect` button inside the entry rather than the entry itself.
              const entries = Array.from(
                block!.querySelectorAll<HTMLElement>("[data-lead-id]"),
              );
              expect(entries.length).toBeGreaterThan(0);

              const entry = entries[pick % entries.length];
              const leadId = entry.getAttribute("data-lead-id") ?? "";
              const control =
                entry.tagName === "BUTTON"
                  ? entry
                  : Array.from(entry.querySelectorAll<HTMLElement>("button")).find(
                      (candidate) =>
                        normalise(candidate.textContent) === GTM_PAGE_LABELS.entryAction,
                    );
              expect(control).toBeDefined();

              await expectOneStepTo(container, log, NINA_PATH, leadId, () =>
                fireEvent.click(control!),
              );
            } finally {
              cleanup();
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    "resolves a selected meeting's destination to the dossier with that prospect selected",
    { timeout: 60_000 },
    async () => {
      // R14.10's arm, at the level that exists today: the destination a selected meeting
      // carries is `prospectRoute()`, the composer §9.3 names and Nina's block 4 already
      // uses. What is asserted is that the composed path *is* the dossier with that
      // prospect selected and that entering it is one history entry — the rendered
      // meeting row lands in task 18.3's suite, once task 18 has re-sourced the page.
      await fc.assert(
        fc.asyncProperty(leadIdArb, async (leadId) => {
          const route = prospectRoute(SPACE_ID, leadId);
          const { container, log } = mountAt(route);
          try {
            const stub = container.querySelector<HTMLElement>('[data-testid="dossier-stub"]');
            expect(stub).not.toBeNull();
            expect(stub!.getAttribute("data-space-id")).toBe(SPACE_ID);
            expect(stub!.getAttribute("data-lead-id")).toBe(leadId);
            expect(log).toEqual([route]);
          } finally {
            cleanup();
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});
