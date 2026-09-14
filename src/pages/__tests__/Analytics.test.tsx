// pages/__tests__/Analytics.test.tsx
//
// **Property 38 — every figure is conveyed with its metric and its date.**
//
// One claim about the Analytics_Page, in the parts R16 breaks it into:
//
//   1. every figure's accessible name carries its measure *and* its row's date  (R16.1, R16.9)
//   2. one `<tr>` per returned Analytics_Day_Row, oldest → newest, and exactly the
//      six columns `AnalyticsMetricKey` pins                                    (R16.2)
//   3. the selected day's five named figures, with the preceding days still on
//      screen beside it                                                        (R16.3, R16.4)
//   4. the direction of change is the backend's `trend` value, or it is a
//      sentence — never a neutral arrow standing in for a comparison nobody made (R16.5)
//   5. a selected date the returned rows do not cover reads as a day with
//      nothing recorded                                                        (R16.8)
//
// ── The three readings this page exists to keep apart ─────────────────────────
//
// `analytics_metric_series` in `backend/api/gtm.py` returns only the measures the
// persisted records support, so an uncomputable measure reaches the browser as a
// **missing key** — not a `null`, not a `0`. Three states therefore have to read
// differently, and the generator draws all three with equal weight per measure per day:
//
//   absent key        → `ANALYTICS_LABELS.metricUnavailable` in the cell and
//                        `metricUnavailableFull` in the expanded day. Never `0`.
//   present, count 0  → `0`. The query ran over the day and found nobody.
//   present, count n  → `n`.
//
// A property that only ever drew positive counts would pass against a page written with
// `row.metrics[key] ?? 0`, which is the one mistake here that silently invents a finding.
//
// ── Why the trend arm is asserted in both directions ──────────────────────────
//
// A trend renders as `↑ / ↓ / →` with `Rising` / `Falling` / `Flat` in the name. Where
// the payload carries none, the trend-bearing measure renders `ANALYTICS_LABELS.noTrend`
// and **no glyph at all** — `→` means the server compared two days and found no movement,
// so using it for "there was nothing to compare against" would be the page stating a
// finding the payload does not hold. So each cell is checked for the glyph it must have
// and for the two it must not, and the draw puts a trend on measures other than
// `most_likely_to_close` too: only that one carries a trend slot by default, but a trend
// that arrives on any key is the server's statement and has to be rendered rather than
// dropped.
//
// ── Property-test hygiene these runs depend on ────────────────────────────────
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
//    document; it is 1 inside a run and 0 once the property is done. A leak then fails
//    where it happened instead of three runs later as an inexplicable cell count.
// 4. **An explicit 60s timeout on every mounting test.** A hundred mounts do not fit the
//    5s default, and the options object is the second argument — the trailing form is
//    deprecated.
//
// ── Stubs, and why each one ───────────────────────────────────────────────────
//
// `getDailyAnalytics` is stubbed at the client, keyed by the range requested, so the
// generated payload is the subject and the range control's effect is observable. The
// wire → domain mapping has its own suite (`services/__tests__/gtmAPI.test.ts`) and a
// JSON round-trip per run would put a hundred normalisations inside a property that makes
// no claim about them. `ConversationSidebar`, `sonner` and `useCredits` are existing
// chrome the page mounts unchanged: the sidebar reaches for auth and the network, the
// balance comes from a provider this route is not wrapped in here, and neither carries a
// figure this file makes a claim about.

import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

// ─── Harness state, hoisted above the module mocks that read it ───────────────

const BRAND = "space-analytics";

const harness = vi.hoisted(() => ({
  state: {
    /**
     * What `getDailyAnalytics` answers, keyed by the range asked for. A range with no
     * entry *rejects*: an unserved read is a harness mistake, and it must not look like
     * a workspace with no activity.
     */
    byDays: new Map<number, import("@/services/gtmAPI").DailyAnalytics>(),
    /** The ranges the page actually requested, so the control's effect is observable. */
    requested: [] as number[],
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/ConversationSidebar", () => ({
  // The leak sentinel counts these: one per mounted page, whatever state the page is in.
  default: () => <nav data-testid="analytics-sidebar" aria-label="Conversations" />,
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
  // The real client, with one read replaced — so a read this page is not supposed to make
  // reaches the network and fails loudly rather than resolving to a stub.
  const stub = {
    ...actual.default,
    getDailyAnalytics: async (
      _brandId: string,
      query: import("@/services/gtmAPI").DailyAnalyticsQuery = {},
    ) => {
      const days = query.days ?? 7;
      harness.state.requested.push(days);
      const payload = harness.state.byDays.get(days);
      if (!payload) throw new Error(`harness: no analytics payload served for ${days} days`);
      return payload;
    },
  };
  return { ...actual, gtmAPI: stub, default: stub };
});

import Analytics, {
  ANALYTICS_DEFAULT_DAYS,
  ANALYTICS_LABELS,
  ANALYTICS_METRIC_COLUMNS,
  ANALYTICS_METRIC_LABELS,
  ANALYTICS_RANGE_OPTIONS,
  ANALYTICS_TREND_GLYPHS,
  ANALYTICS_TREND_LABELS,
  ANALYTICS_TREND_METRIC,
  ANALYTICS_UI_LABELS,
  analyticsCellTestId,
  analyticsPanelFigureTestId,
  analyticsRowTestId,
  figureAccessibleName,
  formatDayLabel,
  formatDayLabelLong,
  hasMetric,
  rangeOptionLabel,
} from "../Analytics";
import { UNKNOWN_SR_NOTE } from "@/components/gtm/ObservedValue";
import type {
  AnalyticsDayRow,
  AnalyticsMetric,
  AnalyticsMetricKey,
  AnalyticsTrend,
  DailyAnalytics,
  FilterCriterion,
  FilterOperator,
} from "@/services/gtmAPI";

// ─── Payload builders ─────────────────────────────────────────────────────────

const ISO = "2024-05-01T09:00:00.000Z";
/** 2024-05-01, the first calendar day the offsets below count from. */
const BASE_MS = Date.UTC(2024, 4, 1);
const DAY_MS = 86_400_000;

const TRENDS: readonly AnalyticsTrend[] = ["RISING", "FALLING", "FLAT"];
const GLYPHS: readonly string[] = ["↑", "↓", "→"];
const OPERATORS: readonly FilterOperator[] = ["EQUALS", "IN", "AT_LEAST", "WITHIN_DAYS"];

/** A UTC calendar date, `n` days after the base day. */
function isoDate(offset: number): string {
  return new Date(BASE_MS + offset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * One drawn measure.
 *
 * `state` is the three-way distinction, drawn evenly: a key the server omitted, a key it
 * sent with a measured `0`, and a key it sent with a count. `trend` is drawn for every
 * key rather than only for `most_likely_to_close`, because a direction the payload carries
 * is the server's statement wherever it lands.
 */
interface MetricSpec {
  state: "absent" | "zero" | "counted";
  count: number;
  trend: AnalyticsTrend | null;
  criteria: number;
}

interface RowSpec {
  /** Days after the base day. Unique per payload, so one date is one row. */
  offset: number;
  metrics: Record<AnalyticsMetricKey, MetricSpec>;
}

/** The clauses that reproduce a figure. Distinctive values, so a containment check means something. */
function buildCriteria(key: AnalyticsMetricKey, howMany: number): FilterCriterion[] {
  return Array.from({ length: howMany }, (_, i) => ({
    field: `gtm_prospect_state.column_${key}_${i}`,
    operator: OPERATORS[i % OPERATORS.length],
    values: [`clause-${key}-${i}`],
  }));
}

/**
 * One measure, wire-consistent: `count` **is** `leadIds.length`, which is the invariant the
 * route holds server-side, so the number and the list it links to cannot disagree here
 * either.
 */
function buildMetric(date: string, key: AnalyticsMetricKey, spec: MetricSpec): AnalyticsMetric {
  const count = spec.state === "zero" ? 0 : spec.count;
  return {
    count,
    leadIds: Array.from({ length: count }, (_, i) => `lead-${date}-${key}-${i}`),
    criteria: buildCriteria(key, spec.criteria),
    trend: spec.trend,
  };
}

/**
 * One day row. An `absent` measure is a **missing key** — assigned nowhere, not assigned
 * `undefined` — because `hasOwnProperty` is what the page tests and a key present with an
 * undefined value would be a weaker payload than the wire produces.
 */
function buildRow(spec: RowSpec): AnalyticsDayRow {
  const date = isoDate(spec.offset);
  const metrics: Partial<Record<AnalyticsMetricKey, AnalyticsMetric>> = {};
  ANALYTICS_METRIC_COLUMNS.forEach((key) => {
    const metric = spec.metrics[key];
    if (metric.state === "absent") return;
    metrics[key] = buildMetric(date, key, metric);
  });
  return { date, metrics };
}

/**
 * A payload for one range.
 *
 * `served` is the row order the read answers with — reversed on half the draws, because
 * the page sorts its own copy and a presentation that depended on the server's ordering
 * staying true would pass a fixture and fail a week later.
 */
function buildPayload(specs: RowSpec[], days: number, reversed: boolean): DailyAnalytics {
  const rows = specs.map(buildRow);
  const ascending = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return {
    brandId: BRAND,
    days,
    startDate: ascending[0]?.date ?? "",
    endDate: ascending[ascending.length - 1]?.date ?? "",
    computedAt: ISO,
    rows: reversed ? [...rows].reverse() : rows,
  };
}

function serve(days: number, payload: DailyAnalytics) {
  harness.state.byDays.set(days, payload);
}

// ─── Generators ───────────────────────────────────────────────────────────────

const metricSpecArb: fc.Arbitrary<MetricSpec> = fc.record({
  state: fc.constantFrom<MetricSpec["state"]>("absent", "zero", "counted"),
  count: fc.integer({ min: 1, max: 3 }),
  // A third of the draws carry no direction, which is the arm `noTrend` covers.
  trend: fc.option(fc.constantFrom(...TRENDS), { nil: null, freq: 2 }),
  criteria: fc.integer({ min: 0, max: 2 }),
});

/** The six measures, named one by one so a seventh cannot slip in untyped. */
const metricsArb: fc.Arbitrary<Record<AnalyticsMetricKey, MetricSpec>> = fc.record({
  prospects_contacted: metricSpecArb,
  state_changed: metricSpecArb,
  most_likely_to_close: metricSpecArb,
  at_risk: metricSpecArb,
  meetings_booked: metricSpecArb,
  meetings_completed: metricSpecArb,
});

function rowsArb(offsets: { min: number; max: number }, minLength: number) {
  return fc.uniqueArray(
    fc.record({ offset: fc.integer(offsets), metrics: metricsArb }),
    { selector: (row) => row.offset, minLength, maxLength: 4 },
  );
}

/** Which day gets picked, or `null` for a run that picks none. */
const pickArb = fc.option(fc.nat({ max: 8 }), { nil: null, freq: 4 });

// ─── Mounting and reading ─────────────────────────────────────────────────────

const norm = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** How many Analytics pages are in the document. A tree leaked from a previous run is 2. */
const mounted = () => document.querySelectorAll('[data-testid="analytics-sidebar"]').length;

async function mountAnalytics(days = ANALYTICS_DEFAULT_DAYS): Promise<HTMLElement> {
  const { container } = render(
    <MemoryRouter initialEntries={[`/analytics/${BRAND}?days=${days}`]}>
      <Routes>
        <Route path="/analytics/:spaceId" element={<Analytics />} />
      </Routes>
    </MemoryRouter>,
  );

  // The table replaces the skeleton once the read lands; a range that came back with no
  // rows at all lands on the empty-range sentence instead.
  await waitFor(() => {
    const settled =
      container.querySelector("table") !== null ||
      within(container).queryByText(ANALYTICS_UI_LABELS.emptyRange) !== null;
    expect(settled).toBe(true);
  });

  return container;
}

/** The pinned name a screen reader is handed for one figure. */
const srTextOf = (node: Element) =>
  norm(
    Array.from(node.querySelectorAll(".sr-only"))
      .map((span) => span.textContent)
      .join(" "),
  );

/** What is on the screen beside it, and hidden from assistive technology. */
const visibleTextOf = (node: Element) =>
  norm(
    Array.from(node.querySelectorAll('[aria-hidden="true"]'))
      .map((span) => span.textContent)
      .join(" "),
  );

/**
 * One figure, checked against the row it belongs to.
 *
 * The same assertions serve the table cell and the panel figure — the two differ only in
 * which absence sentence stands in for a measure that was never computed — because R16.1
 * is one claim about *every* presented figure, and letting the panel be checked more
 * loosely than the table would leave half the page unstated.
 */
function expectFigure(
  node: Element,
  key: AnalyticsMetricKey,
  date: string,
  metric: AnalyticsMetric | undefined,
  absenceText: string,
) {
  const name = srTextOf(node);
  const visible = visibleTextOf(node);

  // ── The claim itself: the measure and the date travel with the figure (R16.1, R16.9) ──
  expect(name).toContain(ANALYTICS_METRIC_LABELS[key]);
  expect(name).toContain(formatDayLabel(date));

  if (!metric) {
    expect(node.getAttribute("data-metric-state")).toBe("absent");
    // The absence is a sentence in the name, and it is *not* a zero (R16.6).
    expect(name).toBe(norm(figureAccessibleName(key, date, absenceText) + UNKNOWN_SR_NOTE));
    expect(visible).toBe(absenceText);
    expect(visible).not.toContain("0");
    // Nothing about a direction, either way: there is no figure to have moved.
    GLYPHS.forEach((glyph) => expect(visible).not.toContain(glyph));
    return;
  }

  const value = String(metric.count);
  expect(node.getAttribute("data-metric-state")).toBe("measured");
  expect(node.getAttribute("data-trend")).toBe(metric.trend ?? "");
  expect(name).toContain(`: ${value}`);
  expect(name).not.toContain(absenceText);
  expect(visible).toContain(value);
  expect(visible).not.toContain(absenceText);

  // ── The direction is the server's, or it is a sentence (R16.5) ──
  if (metric.trend) {
    const word = ANALYTICS_TREND_LABELS[metric.trend];
    const glyph = ANALYTICS_TREND_GLYPHS[metric.trend];
    expect(name).toBe(figureAccessibleName(key, date, value, word));
    expect(visible).toContain(glyph);
    // Exactly the direction the payload carries, and neither of the other two.
    GLYPHS.filter((other) => other !== glyph).forEach((other) =>
      expect(visible).not.toContain(other),
    );
    expect(name).not.toContain(ANALYTICS_LABELS.noTrend);
  } else {
    // No comparison was made, so no arrow — not even the neutral one.
    GLYPHS.forEach((glyph) => expect(visible).not.toContain(glyph));
    Object.values(ANALYTICS_TREND_LABELS).forEach((word) => expect(name).not.toContain(word));

    if (key === ANALYTICS_TREND_METRIC) {
      expect(name).toBe(figureAccessibleName(key, date, value, ANALYTICS_LABELS.noTrend));
      expect(visible).toContain(ANALYTICS_LABELS.noTrend);
    } else {
      // A measure with no direction to report says nothing about one.
      expect(name).toBe(figureAccessibleName(key, date, value));
      expect(visible).not.toContain(ANALYTICS_LABELS.noTrend);
    }
  }
}

/** The rendered table: one `<tr>` per row, the six columns, and every figure in them. */
function expectTable(container: HTMLElement, payload: DailyAnalytics) {
  const ascending = [...payload.rows].sort((a, b) => a.date.localeCompare(b.date));
  const table = container.querySelector("table");
  expect(table).not.toBeNull();

  // Exactly `AnalyticsMetricKey`'s six members, in order, beside the date column — no
  // measure the endpoint does not supply, and none of the six missing.
  const headers = Array.from(table!.querySelectorAll('thead th[scope="col"]')).map((th) =>
    norm(th.textContent),
  );
  expect(headers).toEqual([
    ANALYTICS_UI_LABELS.dateColumn,
    ...ANALYTICS_METRIC_COLUMNS.map((key) => ANALYTICS_METRIC_LABELS[key]),
  ]);

  // ── One row per returned day row, oldest → newest (R16.2) ──
  const bodyRows = Array.from(table!.querySelectorAll("tbody tr"));
  expect(bodyRows).toHaveLength(payload.rows.length);
  expect(bodyRows.map((tr) => tr.getAttribute("data-testid"))).toEqual(
    ascending.map((row) => analyticsRowTestId(row.date)),
  );
  // Ascending as its own statement, read off the machine-readable dates in the row
  // headers rather than off the list this file already sorted.
  const renderedDates = bodyRows.map((tr) =>
    tr.querySelector('th[scope="row"] time')?.getAttribute("datetime") ?? "",
  );
  expect(renderedDates).toEqual([...renderedDates].sort((a, b) => a.localeCompare(b)));
  expect(renderedDates).toEqual(ascending.map((row) => row.date));

  bodyRows.forEach((tr, index) => {
    const row = ascending[index];
    const header = tr.querySelector('th[scope="row"]');
    expect(header).not.toBeNull();
    expect(norm(header!.textContent)).toContain(formatDayLabel(row.date));
    // Six figures, no seventh, and none dropped — a missing `<td>` would shift the column
    // its neighbour reads against.
    expect(tr.querySelectorAll("td")).toHaveLength(ANALYTICS_METRIC_COLUMNS.length);

    ANALYTICS_METRIC_COLUMNS.forEach((key) => {
      const cell = within(tr as HTMLElement).getByTestId(analyticsCellTestId(row.date, key));
      expectFigure(
        cell,
        key,
        row.date,
        hasMetric(row, key) ? row.metrics[key] : undefined,
        ANALYTICS_LABELS.metricUnavailable,
      );
    });
  });
}

/** The expanded day: the five named figures, the clauses, and the prospects counted. */
function expectPanel(container: HTMLElement, date: string, row: AnalyticsDayRow) {
  const panel = within(container).getByTestId("analytics-selected-day");
  expect(panel.getAttribute("data-selected-date")).toBe(date);
  expect(norm(panel.textContent)).toContain(formatDayLabelLong(date));

  ANALYTICS_METRIC_COLUMNS.forEach((key) => {
    const figure = within(panel).getByTestId(analyticsPanelFigureTestId(key));
    const metric = hasMetric(row, key) ? row.metrics[key] : undefined;
    expectFigure(figure, key, date, metric, ANALYTICS_LABELS.metricUnavailableFull);

    const text = norm(figure.textContent);
    if (!metric) return;

    // The filter that reproduces the figure, present exactly when the payload carries one.
    if (metric.criteria.length > 0) {
      expect(text).toContain(ANALYTICS_LABELS.criteriaLabel);
      metric.criteria.forEach((clause) =>
        clause.values.forEach((value) => expect(text).toContain(value)),
      );
    } else {
      expect(text).not.toContain(ANALYTICS_LABELS.criteriaLabel);
    }

    // The count's own working. A measured `0` has no list, and an empty heading would
    // imply a lost one.
    if (metric.leadIds.length > 0) {
      expect(text).toContain(ANALYTICS_UI_LABELS.leadIds);
      metric.leadIds.forEach((leadId) => expect(text).toContain(leadId));
    } else {
      expect(text).not.toContain(ANALYTICS_UI_LABELS.leadIds);
    }
  });
}

/** Picks a day by clicking the control inside that row's own header. */
function selectDay(container: HTMLElement, date: string) {
  const row = within(container).getByTestId(analyticsRowTestId(date));
  const button = row.querySelector('th[scope="row"] button');
  expect(button).not.toBeNull();
  fireEvent.click(button!);
}

beforeEach(() => {
  harness.state.byDays.clear();
  harness.state.requested = [];
});

// ─── The properties ───────────────────────────────────────────────────────────

/**
 * **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.8, 16.9**
 */
describe("Property 38: every figure is conveyed with its metric and its date", () => {
  it(
    "names every figure with its measure and its date, and states a direction only where the server sent one",
    // A hundred mounts of the page do not fit the 5s default.
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          rowsArb({ min: 0, max: 20 }, 1),
          fc.boolean(),
          pickArb,
          async (specs, reversed, pick) => {
            const payload = buildPayload(specs, ANALYTICS_DEFAULT_DAYS, reversed);
            serve(ANALYTICS_DEFAULT_DAYS, payload);

            const container = await mountAnalytics();
            try {
              // One page on the screen, so every reading below is this run's answer.
              expect(mounted()).toBe(1);

              expectTable(container, payload);

              const ascending = [...payload.rows].sort((a, b) => a.date.localeCompare(b.date));

              if (pick === null) {
                // Nothing picked: no expanded day, and the prompt is offered twice — beside
                // the heading and as the chip below the table.
                expect(
                  within(container).queryByTestId("analytics-selected-day"),
                ).toBeNull();
                expect(
                  within(container).getAllByText(ANALYTICS_UI_LABELS.selectPrompt),
                ).toHaveLength(2);
                return;
              }

              const index = pick % ascending.length;
              const chosen = ascending[index];
              selectDay(container, chosen.date);

              // ── The selected day, with its five named figures (R16.3) ──
              expectPanel(container, chosen.date, chosen);

              // ── …and the preceding dates still beside it (R16.4) ──
              expectTable(container, payload);
              ascending.slice(0, index).forEach((earlier) => {
                expect(
                  within(container).getByTestId(analyticsRowTestId(earlier.date)),
                ).toBeInTheDocument();
              });

              // The row that was picked is the row that says so, and it is the only one.
              const pressed = Array.from(
                container.querySelectorAll('tbody th[scope="row"] button[aria-pressed="true"]'),
              );
              expect(pressed).toHaveLength(1);
              expect(norm(pressed[0].textContent)).toContain(formatDayLabel(chosen.date));
              // The chip is gone, so the prompt is stated once rather than twice.
              expect(
                within(container).getAllByText(ANALYTICS_UI_LABELS.selectPrompt),
              ).toHaveLength(1);
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
    "keeps the day it was given across a range change and says that day holds no recorded activity",
    { timeout: 60_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(
          rowsArb({ min: 0, max: 20 }, 1),
          // The wider range answers with entirely different days, which is how a selection
          // ends up outside the returned rows — the condition R16.8 covers.
          rowsArb({ min: 100, max: 120 }, 0),
          fc.nat({ max: 8 }),
          async (firstSpecs, secondSpecs, pick) => {
            const first = buildPayload(firstSpecs, ANALYTICS_DEFAULT_DAYS, false);
            const wider = ANALYTICS_RANGE_OPTIONS[1];
            const second = buildPayload(secondSpecs, wider, false);
            serve(ANALYTICS_DEFAULT_DAYS, first);
            serve(wider, second);

            const container = await mountAnalytics();
            try {
              expect(mounted()).toBe(1);

              const ascending = [...first.rows].sort((a, b) => a.date.localeCompare(b.date));
              const chosen = ascending[pick % ascending.length];
              selectDay(container, chosen.date);
              expectPanel(container, chosen.date, chosen);

              // The range control, which is what moves the window out from under the
              // selection. The selection is kept on purpose (design §10).
              fireEvent.click(within(container).getByText(rangeOptionLabel(wider)));

              await waitFor(() => {
                expect(
                  within(container).queryByTestId(analyticsRowTestId(chosen.date)),
                ).toBeNull();
                if (second.rows.length > 0) {
                  expect(container.querySelectorAll("tbody tr")).toHaveLength(
                    second.rows.length,
                  );
                } else {
                  // A range that came back with no rows: the sentence about the range, not
                  // about the workspace.
                  expect(container.querySelector("table")).toBeNull();
                  expect(
                    within(container).getByText(ANALYTICS_UI_LABELS.emptyRange),
                  ).toBeInTheDocument();
                }
              });

              // ── The selection survived, and the day now reads as holding nothing (R16.8) ──
              const panel = within(container).getByTestId("analytics-selected-day");
              expect(panel.getAttribute("data-selected-date")).toBe(chosen.date);
              expect(norm(panel.textContent)).toContain(ANALYTICS_LABELS.noActivity);
              expect(norm(panel.textContent)).toContain(formatDayLabelLong(chosen.date));

              // Not one figure from the day that is no longer in the range — a stale
              // number under this heading would be a figure attributed to a day the read
              // does not cover.
              ANALYTICS_METRIC_COLUMNS.forEach((key) => {
                expect(
                  within(panel).queryByTestId(analyticsPanelFigureTestId(key)),
                ).toBeNull();
              });
              // Nor either metric-absence sentence: the day itself is the absence here.
              expect(norm(panel.textContent)).not.toContain(
                ANALYTICS_LABELS.metricUnavailableFull,
              );

              // The rows that did come back are still one row per returned row, in order.
              if (second.rows.length > 0) expectTable(container, second);

              // Both ranges were read, and each was read as asked for.
              expect(harness.state.requested).toContain(ANALYTICS_DEFAULT_DAYS);
              expect(harness.state.requested).toContain(wider);
            } finally {
              harness.state.requested = [];
              cleanup();
            }
          },
        ),
        { numRuns: 100 },
      );

      expect(mounted()).toBe(0);
    },
  );

  // ── The readable examples ───────────────────────────────────────────────────
  //
  // The properties answer "which name, over any payload". These answer "what does it
  // actually say", by sentence, so a zero standing in for a measurement nobody took fails
  // with the real string rather than with a generated spec.

  it("reads an absent measure, a measured zero and a count as three different things", async () => {
    serve(ANALYTICS_DEFAULT_DAYS, {
      brandId: BRAND,
      days: ANALYTICS_DEFAULT_DAYS,
      startDate: "2024-05-01",
      endDate: "2024-05-01",
      computedAt: ISO,
      rows: [
        {
          date: "2024-05-01",
          metrics: {
            // `prospects_contacted` is deliberately not a key at all.
            state_changed: { count: 0, leadIds: [], criteria: [], trend: null },
            at_risk: {
              count: 3,
              leadIds: ["lead-a", "lead-b", "lead-c"],
              criteria: [],
              trend: null,
            },
          },
        },
      ],
    });

    const container = await mountAnalytics();
    const q = within(container);

    const absent = q.getByTestId(analyticsCellTestId("2024-05-01", "prospects_contacted"));
    expect(absent.getAttribute("data-metric-state")).toBe("absent");
    expect(visibleTextOf(absent)).toBe(ANALYTICS_LABELS.metricUnavailable);
    expect(srTextOf(absent)).toBe(
      "Prospects contacted, Wed, 01 May 2024: not measured yet (not yet observed)",
    );

    const zero = q.getByTestId(analyticsCellTestId("2024-05-01", "state_changed"));
    expect(zero.getAttribute("data-metric-state")).toBe("measured");
    expect(visibleTextOf(zero)).toBe("0");
    expect(srTextOf(zero)).toBe("Prospects whose state changed, Wed, 01 May 2024: 0");

    const counted = q.getByTestId(analyticsCellTestId("2024-05-01", "at_risk"));
    expect(srTextOf(counted)).toBe("Losing or at risk, Wed, 01 May 2024: 3");

    // The expanded day says what the measurement is waiting for, which the cell has no
    // room for.
    selectDay(container, "2024-05-01");
    const panelAbsent = q.getByTestId(analyticsPanelFigureTestId("prospects_contacted"));
    expect(visibleTextOf(panelAbsent)).toBe(ANALYTICS_LABELS.metricUnavailableFull);
    expect(srTextOf(panelAbsent)).toContain(ANALYTICS_LABELS.metricUnavailableFull);

    // The count's own working: the list is the number, so both are on the screen.
    const panelCounted = q.getByTestId(analyticsPanelFigureTestId("at_risk"));
    expect(norm(panelCounted.textContent)).toContain("lead-a, lead-b, lead-c");
  });

  it("renders the arrow the server sent, and a sentence where it sent none", async () => {
    const metric = (trend: AnalyticsTrend | null): AnalyticsMetric => ({
      count: 4,
      leadIds: ["l1", "l2", "l3", "l4"],
      criteria: [],
      trend,
    });

    serve(ANALYTICS_DEFAULT_DAYS, {
      brandId: BRAND,
      days: ANALYTICS_DEFAULT_DAYS,
      startDate: "2024-05-01",
      endDate: "2024-05-02",
      computedAt: ISO,
      rows: [
        // The first day of a range has no earlier day to compare against.
        { date: "2024-05-01", metrics: { most_likely_to_close: metric(null) } },
        {
          date: "2024-05-02",
          metrics: {
            most_likely_to_close: metric("FLAT"),
            // A direction on another measure is still the server's statement.
            at_risk: metric("RISING"),
          },
        },
      ],
    });

    const container = await mountAnalytics();
    const q = within(container);

    const noComparison = q.getByTestId(
      analyticsCellTestId("2024-05-01", "most_likely_to_close"),
    );
    expect(srTextOf(noComparison)).toBe(
      "Most likely to close, Wed, 01 May 2024: 4, No earlier day to compare against yet.",
    );
    // `→` would say the server compared two days and found no movement. It did not compare.
    GLYPHS.forEach((glyph) => expect(visibleTextOf(noComparison)).not.toContain(glyph));

    const flat = q.getByTestId(analyticsCellTestId("2024-05-02", "most_likely_to_close"));
    expect(srTextOf(flat)).toBe("Most likely to close, Thu, 02 May 2024: 4, Flat");
    expect(visibleTextOf(flat)).toContain("→");
    expect(visibleTextOf(flat)).not.toContain(ANALYTICS_LABELS.noTrend);

    const rising = q.getByTestId(analyticsCellTestId("2024-05-02", "at_risk"));
    expect(srTextOf(rising)).toBe("Losing or at risk, Thu, 02 May 2024: 4, Rising");
    expect(visibleTextOf(rising)).toContain("↑");
  });
});
