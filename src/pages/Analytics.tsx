// pages/Analytics.tsx
//
// The Analytics_Page, at `/analytics/:spaceId` (R16.1–R16.9, design §10).
//
// One read — `getDailyAnalytics(brandId, { days })` — rendered as a real `<table>` of
// UTC calendar days, oldest first, with the six measures the route computes as its
// columns and the selected day expanded below it. Nothing on this page is counted in
// the browser: there is no total row, no per-column sum and no derived figure, because
// every number here is `count == leadIds.length` server-side and a second arithmetic
// path would be a second answer (R20.4, R15.8).
//
// ── Absent is not zero, and this page is where that distinction earns its keep ──
//
// `AnalyticsDayRow.metrics` is a `Partial<Record<AnalyticsMetricKey, AnalyticsMetric>>`,
// and the backend omits a key it could not compute rather than sending a `null` or a
// `0` (`analytics_metric_series` in `backend/api/gtm.py`). So three states are on this
// screen and all three read differently:
//
//   • a measured `0`      → `0`. The query ran over the day and found nobody.
//   • an absent metric    → `ANALYTICS_LABELS.metricUnavailable` in the cell, and the
//                            full sentence in the expanded panel. Never blank, never a
//                            dash, never a zero standing in for a measurement nobody
//                            took (R16.6).
//   • a date with no row  → `ANALYTICS_LABELS.noActivity`, in the panel, for a
//                            selection the returned range does not cover (R16.8).
//
// Presence is tested with `hasMetric()` — an own-property check — and never with
// `?? 0` or a truthiness test, either of which would silently turn "we never measured
// this" into "we measured nothing".
//
// ── Why the figures carry their own accessible name ──
//
// R16.1 and R16.9 ask for two different things and the page does both. The table is a
// real `<table>` with `<th scope="col">` metric labels and `<th scope="row">` dates, so
// the header association is genuine; *and* each figure carries the pinned
// `"{metric label}, {date}: {value}"` name as screen-reader text, so a reader who lands
// on one cell hears what it measures and which day it belongs to without navigating the
// headers. The visible glyphs are `aria-hidden` beside it, which is what keeps the two
// from being announced twice.
//
// The name is screen-reader text rather than an `aria-label` on purpose: `aria-label` on
// a `<span>` with no role is a prohibited-attribute violation, and this page is one of
// the four surfaces the accessibility audit covers (R19.6).
//
// ── The direction of change is the server's, or it is a sentence ──
//
// `↑ / ↓ / →` come from `metric.trend` and from nowhere else, each with `Rising` /
// `Falling` / `Flat` in the accessible name (R16.5). Where the payload carries no trend
// — the first day of a range has no earlier day to compare against — the page renders
// `ANALYTICS_LABELS.noTrend`, not a neutral arrow: `→` means *the server measured it and
// it did not move*, and using it for "we could not compare" would be this page inventing
// a finding. Only `most_likely_to_close` is compared day over day, so it is the one
// column with a trend slot; a trend that arrives on any other metric is still rendered
// rather than dropped.
//
// ── Structure ──
//
// One `banner` (the chrome header) and one `main` (the scrolling content), the two
// landmarks `GTMActionQueue` establishes. One `<h1>` present in every state, an `<h2>`
// on the table section and an `<h3>` on the expanded day. Every control is a real
// `button`, the range control is a named `group` of four with `aria-pressed`, and the
// day selection is a button inside the row header so the date stays the row's name.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ConversationSidebar from "@/components/ConversationSidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import gtmAPI from "@/services/gtmAPI";
import type {
  AnalyticsDayRow,
  AnalyticsMetric,
  AnalyticsMetricKey,
  AnalyticsTrend,
  DailyAnalytics,
} from "@/services/gtmAPI";

import { CreditBalanceBadge } from "@/components/gtm/CreditBalance";
import { useCredits } from "@/hooks/useCredits";
import { GTM_PAGE_LABELS, GTM_UI_LABELS, TONE, absTime, relTime } from "@/components/gtm/labels";
// The absence note `ObservedValue` exports, reused rather than restated (R19.4). No
// `ObservedFact` travels on the analytics payload — every value here is a count — so the
// component itself has nothing to render on this page; what it owns and this page needs
// is the one screen-reader note that says a value is absent rather than zero.
import { UNKNOWN_SR_NOTE } from "@/components/gtm/ObservedValue";
// The clause vocabulary, from the surface that already publishes it. A criterion is the
// filter that reproduces a figure, and a second table naming the same operators would let
// two surfaces disagree about what `AT_LEAST` says.
import { FILTER_OPERATOR_LABELS, criterionFieldText } from "./GTMDashboard";

/**
 * The strings this page needs and `labels.ts` does not carry (R18.1 state 15, R18.2,
 * R18.4).
 *
 * One exported object, in the shape `GTMActionQueue.tsx`'s `ACTION_QUEUE_LABELS` and
 * `NextActionPanel.tsx`'s `ACTION_CARD_LABELS` established: page-scoped copy lives with
 * the page, because `labels.ts` holds the vocabularies more than one surface reads and
 * these seven sentences are read by this one.
 *
 * Every entry names a next step rather than reporting an emptiness:
 *
 *   `metricUnavailable`      the cell form. Says *yet*, so a rep reads a pending
 *                            measurement rather than a broken column.
 *   `metricUnavailableFull`  the panel form, which says what the measurement needs
 *                            before it can appear — one prospect with the thing
 *                            recorded — and that it appears on its own once there is.
 *   `noActivity`             state 15 of the fifteen (R18.1): a selected day the
 *                            returned range holds no row for. It names the two things
 *                            that did not happen rather than saying "no data", so the
 *                            reader knows what the day was checked for.
 *   `noTrend`               why there is no arrow. A comparison needs two days.
 *   `loadFailed`            our failure, not an empty week, and it takes a retry
 *                            (R18.5) from `GTM_PAGE_LABELS.retry`.
 *   `criteriaLabel`         the heading over a figure's own filter clauses, which is
 *                            what keeps a number a link to the prospects behind it.
 *
 * Distinct from every other absence on the feature, and pointedly from
 * `GTM_ABSENCE_LABELS.noActivity`, which is about one prospect's observed activity —
 * this one is about a calendar day's counts, and the two are true at different times.
 */
export const ANALYTICS_LABELS = {
  pageTitle: "Day by day",
  metricUnavailable: "not measured yet",
  metricUnavailableFull:
    "Weez hasn't been able to measure this yet — it needs at least one prospect with this recorded. It appears here as soon as one does.",
  noActivity:
    "Nothing was recorded on this day. No prospect was contacted and no state moved.",
  noTrend: "No earlier day to compare against yet.",
  loadFailed: "Couldn't read your day-by-day numbers",
  criteriaLabel: "What was counted",
} as const;

/**
 * The page's chrome: the strings that are neither copy about an absence nor a metric name.
 *
 * Kept apart from `ANALYTICS_LABELS` so that table stays exactly the seven sentences
 * design §10 pinned — a table that grows a caption and a toast beside its absence copy is
 * a table nobody can check against the design any more.
 */
export const ANALYTICS_UI_LABELS = {
  tableTitle: "Every day in the range",
  tableCaption:
    "One row per day the read returned, oldest first. Dates are UTC calendar days, and each figure is named with its measure and its date.",
  dateColumn: "Date (UTC)",
  rangeLabel: "Range",

  /** The day-selection control, and the panel it opens. */
  selectPrompt:
    "Pick a day in the table to see what was counted on it and which prospects it counted.",
  selectedDayTitle: "The day you picked",
  leadIds: "Prospects counted",

  /** The two halves of the meetings figure, in the panel's own shorthand. */
  meetingsRecorded: "Meetings recorded",
  bookedSuffix: "booked",
  completedSuffix: "completed",

  /** The read came back with no day rows at all — a range, not a workspace, statement. */
  emptyRange:
    "No days came back for this range. Weez returns a row for every day it read, so a wider range is what brings the earlier days back.",

  /** Reached without a workspace. Nothing to retry — the route is missing its brand. */
  noWorkspace:
    "Open Analytics from inside a workspace, so it knows whose numbers to read.",

  // Live-region announcements about the page itself.
  statusLoading: "Loading your day-by-day numbers",
  statusRefreshing: "Refreshing your day-by-day numbers",
  countSuffix: "days in this range",

  refreshedToast: "Day-by-day numbers refreshed",
  refreshFailedToast: "Couldn't refresh your day-by-day numbers",
} as const;

/**
 * The six measures, named for a rep rather than for the column they came from.
 *
 * One vocabulary for both places a metric is named — the `<th scope="col">` and every
 * figure's accessible name — so the two cannot drift. `Record<AnalyticsMetricKey, …>`
 * rather than `Record<string, string>`: the key type is a `Literal` union the server pins,
 * so a seventh measure cannot reach this page without a label being written for it.
 *
 * `meetings_completed` is deliberately "Meetings completed" and not "Meetings held". The
 * count behind it is recorded outreach *outcomes* of `MEETING_BOOKED` — a judgement about
 * how a thread turned out — and no GTM table records a meeting happening, so a stronger
 * word would be a stronger claim than the data supports.
 */
export const ANALYTICS_METRIC_LABELS: Record<AnalyticsMetricKey, string> = {
  prospects_contacted: "Prospects contacted",
  state_changed: "Prospects whose state changed",
  most_likely_to_close: "Most likely to close",
  at_risk: "Losing or at risk",
  meetings_booked: "Meetings booked",
  meetings_completed: "Meetings completed",
};

/**
 * The columns, in order, and exactly `AnalyticsMetricKey`'s six members (R16.7).
 *
 * Read out of the label table rather than listed a second time, so the columns and the
 * names are the same set by construction.
 */
export const ANALYTICS_METRIC_COLUMNS = Object.keys(
  ANALYTICS_METRIC_LABELS,
) as AnalyticsMetricKey[];

/**
 * The one measure the route compares day over day.
 *
 * Named here because it decides which column carries a trend slot at all: the other five
 * have no direction on any day, and rendering `noTrend` under each of them would state
 * five absences nobody asked about.
 */
export const ANALYTICS_TREND_METRIC: AnalyticsMetricKey = "most_likely_to_close";

/** The direction, in words, for the accessible name (R16.5). */
export const ANALYTICS_TREND_LABELS: Record<AnalyticsTrend, string> = {
  RISING: "Rising",
  FALLING: "Falling",
  FLAT: "Flat",
};

/** The direction, as the glyph beside the figure. Always `aria-hidden`; the word is above. */
export const ANALYTICS_TREND_GLYPHS: Record<AnalyticsTrend, string> = {
  RISING: "↑",
  FALLING: "↓",
  FLAT: "→",
};

/** The ranges the control offers. All four inside the route's own 1–365 bound. */
export const ANALYTICS_RANGE_OPTIONS: readonly number[] = [7, 14, 30, 90];

/** The route's own default, so an unparameterised visit reads what the server would send. */
export const ANALYTICS_DEFAULT_DAYS = 7;

/**
 * The range, from the URL, narrowed to the four the control can show.
 *
 * Anything else falls back to the default rather than being passed on: a range the control
 * cannot highlight would leave the page showing one window and offering another.
 */
export function readRangeParam(raw: string | null): number {
  const parsed = Number(raw);
  return ANALYTICS_RANGE_OPTIONS.includes(parsed) ? parsed : ANALYTICS_DEFAULT_DAYS;
}

/** One range button's label. A format, not a claim: the number is the one requested. */
export function rangeOptionLabel(days: number): string {
  return `Last ${days} days`;
}

/** One day row's test hook, keyed by its date. */
export function analyticsRowTestId(date: string): string {
  return `analytics-day-${date}`;
}

/** One figure's test hook, keyed by the day and the measure it belongs to. */
export function analyticsCellTestId(date: string, key: AnalyticsMetricKey): string {
  return `analytics-cell-${date}-${key}`;
}

/** One panel figure's test hook. */
export function analyticsPanelFigureTestId(key: AnalyticsMetricKey): string {
  return `analytics-panel-figure-${key}`;
}

/**
 * Whether this row actually carries this measure.
 *
 * An own-property check, because that is the only test that tells the three cases apart:
 * `row.metrics[key] ?? 0` and `if (row.metrics[key])` both read an absent measurement and
 * a measured zero as the same thing, which is the one mistake this page exists to avoid.
 */
export function hasMetric(row: AnalyticsDayRow, key: AnalyticsMetricKey): boolean {
  return (
    Object.prototype.hasOwnProperty.call(row.metrics, key) && row.metrics[key] !== undefined
  );
}

/**
 * A UTC calendar date as a short day label — "Mon 12 Feb 2025".
 *
 * `timeZone: "UTC"` is the load-bearing option. The bucketing is by UTC calendar date of
 * the source column, so formatting in the reader's zone would put a figure under the day
 * before or after the one the count used. An unreadable date renders as the string the
 * server sent rather than as "Invalid Date".
 */
export function formatDayLabel(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

/** The same date, spelled out for the expanded day's heading — "Monday 12 February 2025". */
export function formatDayLabelLong(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

/**
 * One figure's accessible name: `"{metric label}, {date}: {value}"` (R16.1).
 *
 * The pinned form, built in one place so the table and the panel cannot say it two ways.
 * `trailing` carries what follows the value — the direction in words, or the sentence that
 * stands in for it — because a direction is part of what the figure says, not a second
 * figure beside it.
 */
export function figureAccessibleName(
  key: AnalyticsMetricKey,
  date: string,
  value: string,
  trailing?: string | null,
): string {
  const name = `${ANALYTICS_METRIC_LABELS[key]}, ${formatDayLabel(date)}: ${value}`;
  return trailing ? `${name}, ${trailing}` : name;
}

/**
 * What follows the value in the name, for the measure that is compared day over day.
 *
 * A trend the payload carries becomes its word; a trend-bearing measure with none becomes
 * `noTrend`. Every other measure gets nothing, because it has no direction to report.
 */
function trendTrailing(key: AnalyticsMetricKey, metric: AnalyticsMetric): string | null {
  if (metric.trend) return ANALYTICS_TREND_LABELS[metric.trend] ?? metric.trend;
  return key === ANALYTICS_TREND_METRIC ? ANALYTICS_LABELS.noTrend : null;
}

// ─── One figure in the table ──────────────────────────────────────────────────

interface MetricCellProps {
  date: string;
  metricKey: AnalyticsMetricKey;
  /** `undefined` is the absence, and it is the case this component is shaped around. */
  metric: AnalyticsMetric | undefined;
}

/**
 * One `<td>`: the measure for this day, or the sentence that says it was not measured.
 *
 * The `<td>` is always present — a table with a missing cell has a shifted column, and the
 * date it belongs to would then read against the wrong header — while the *figure* inside
 * it renders only when the row's `metrics` map holds the key (R16.7). What renders in its
 * place is `metricUnavailable` plus the screen-reader note `ObservedValue` exports, so a
 * reader hears the measure, the date and that nothing was measured rather than silence.
 */
function MetricCell({ date, metricKey, metric }: MetricCellProps) {
  const isTrendColumn = metricKey === ANALYTICS_TREND_METRIC;

  if (!metric) {
    return (
      <td
        data-testid={analyticsCellTestId(date, metricKey)}
        data-metric-state="absent"
        className="px-3 py-2.5 align-top"
      >
        <span className="sr-only">
          {figureAccessibleName(metricKey, date, ANALYTICS_LABELS.metricUnavailable)}
          {UNKNOWN_SR_NOTE}
        </span>
        <span aria-hidden="true" className="text-[11.5px] leading-relaxed text-slate-500">
          {ANALYTICS_LABELS.metricUnavailable}
        </span>
      </td>
    );
  }

  const value = String(metric.count);
  const trailing = trendTrailing(metricKey, metric);

  return (
    <td
      data-testid={analyticsCellTestId(date, metricKey)}
      data-metric-state="measured"
      data-trend={metric.trend ?? ""}
      className="px-3 py-2.5 align-top"
    >
      {/* The pinned name, for assistive technology. Everything visible below is hidden
          from it, so the figure is announced once and in the form R16.1 asks for. */}
      <span className="sr-only">
        {figureAccessibleName(metricKey, date, value, trailing)}
      </span>
      <span aria-hidden="true" className="block">
        <span className="text-[13px] font-semibold tabular-nums text-zinc-900">{value}</span>
        {metric.trend && (
          <span className="ml-1.5 text-[12px] font-semibold text-slate-500">
            {ANALYTICS_TREND_GLYPHS[metric.trend] ?? ""}
          </span>
        )}
        {/* No arrow where there is no comparison — the sentence instead (R16.5). */}
        {isTrendColumn && !metric.trend && (
          <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
            {ANALYTICS_LABELS.noTrend}
          </span>
        )}
      </span>
    </td>
  );
}

// ─── One figure in the expanded day ───────────────────────────────────────────

interface PanelFigureProps {
  date: string;
  metricKey: AnalyticsMetricKey;
  metric: AnalyticsMetric | undefined;
  /** The visible label. The accessible name always uses the full measure name. */
  visibleLabel: string;
  /**
   * `definition` (the default) renders a `<dt>`/`<dd>` group and must sit inside the
   * panel's `<dl>`. `plain` renders a paragraph and a value block, for the two meeting
   * halves that live *inside* one definition — a `<dl>` nested in a `<dd>` is not a
   * properly ordered definition group, and this page is one of the four the accessibility
   * audit covers (R19.6). `ObservedValue` draws the same distinction for the same reason.
   */
  variant?: "definition" | "plain";
}

/**
 * One measure on the expanded day: the figure, the filter that reproduces it, and the
 * prospects it counted (R16.3, R15.9).
 *
 * The clauses and the identifier list are the reason a figure here is not a bare number:
 * `count` **is** `leadIds.length` server-side, so the list is the count's own working, and
 * the criteria are the query that produced it. Neither is composed here.
 *
 * An absent measure renders `metricUnavailableFull` — the panel has room for the sentence
 * that says what the measurement is waiting for, which the cell does not (R16.6).
 */
function PanelFigure({
  date,
  metricKey,
  metric,
  visibleLabel,
  variant = "definition",
}: PanelFigureProps) {
  const labelClass = "text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400";

  /** The measure's name, as a term or as a paragraph depending on the container. */
  const label =
    variant === "definition" ? (
      <dt className={labelClass}>{visibleLabel}</dt>
    ) : (
      <p className={labelClass}>{visibleLabel}</p>
    );

  /** What the measure says. Wrapped as the definition's description, or as a plain block. */
  const describe = (body: ReactNode, className: string) =>
    variant === "definition" ? (
      <dd className={className}>{body}</dd>
    ) : (
      <div className={className}>{body}</div>
    );

  const wrap = (body: ReactNode, state: "absent" | "measured") => (
    <div
      data-testid={analyticsPanelFigureTestId(metricKey)}
      data-metric-state={state}
      data-trend={metric?.trend ?? ""}
      className="min-w-0"
    >
      {label}
      {body}
    </div>
  );

  if (!metric) {
    return wrap(
      describe(
        <>
          <span className="sr-only">
            {figureAccessibleName(metricKey, date, ANALYTICS_LABELS.metricUnavailableFull)}
            {UNKNOWN_SR_NOTE}
          </span>
          <span
            aria-hidden="true"
            className="block max-w-[52ch] text-[11.5px] leading-relaxed text-slate-500"
          >
            {ANALYTICS_LABELS.metricUnavailableFull}
          </span>
        </>,
        "mt-0.5",
      ),
      "absent",
    );
  }

  const value = String(metric.count);
  const trailing = trendTrailing(metricKey, metric);

  return wrap(
    describe(
      <>
        <span className="sr-only">{figureAccessibleName(metricKey, date, value, trailing)}</span>
        <span aria-hidden="true" className="block">
          <span className="text-[15px] font-semibold tabular-nums text-zinc-900">{value}</span>
          {metric.trend && (
            <span className="ml-1.5 text-[12px] font-semibold text-slate-500">
              {ANALYTICS_TREND_GLYPHS[metric.trend] ?? ""}
            </span>
          )}
          {metricKey === ANALYTICS_TREND_METRIC && !metric.trend && (
            <span className="mt-0.5 block text-[10.5px] leading-snug text-slate-500">
              {ANALYTICS_LABELS.noTrend}
            </span>
          )}
        </span>

        {/* The filter that reproduces the figure. The field keeps the server's own name on
            its `title`, so the readable phrase is never the only reading available. */}
        {metric.criteria.length > 0 && (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              {ANALYTICS_LABELS.criteriaLabel}
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {metric.criteria.map((criterion, index) => (
                <li
                  key={`${criterion.field}-${criterion.operator}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-relaxed text-slate-600"
                >
                  <span className="font-semibold text-zinc-800" title={criterion.field}>
                    {criterionFieldText(criterion.field)}
                  </span>
                  <span className="text-slate-500">
                    {FILTER_OPERATOR_LABELS[criterion.operator] ?? criterion.operator}
                  </span>
                  {criterion.values.length > 0 && (
                    <span className="font-medium text-zinc-800">
                      {criterion.values.join(", ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The prospects behind the number. Shown only when there are any: a measured `0`
            has an empty list by construction, and an empty heading would imply a lost one. */}
        {metric.leadIds.length > 0 && (
          <p className="min-w-0 break-words text-[11px] leading-relaxed text-slate-500">
            <span className="font-semibold text-zinc-800">
              {ANALYTICS_UI_LABELS.leadIds}
              {" ("}
              {metric.leadIds.length}
              {"): "}
            </span>
            {metric.leadIds.join(", ")}
          </p>
        )}
      </>,
      "mt-0.5 space-y-1.5",
    ),
    "measured",
  );
}

// ─── The expanded day ─────────────────────────────────────────────────────────

interface SelectedDayPanelProps {
  date: string;
  /** `null` when the returned range holds no row for this date (R16.8). */
  row: AnalyticsDayRow | null;
  headingId: string;
}

/**
 * The selected day, below the table (R16.3, R16.4).
 *
 * Below rather than instead of: the table stays on screen with the preceding dates in it,
 * because the comparison a rep is making is between days and a panel that replaced the
 * table would take the comparison away.
 *
 * Five named figures, which is R16.3's list — contacted, state moved, most likely to
 * close, losing or at risk, and the meetings recorded, that last one being the two meeting
 * measures under one heading because "meetings recorded" is one question with a booked and
 * a completed half.
 */
function SelectedDayPanel({ date, row, headingId }: SelectedDayPanelProps) {
  return (
    <section
      aria-labelledby={headingId}
      data-testid="analytics-selected-day"
      data-selected-date={date}
      className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-[13px] font-semibold text-zinc-900">
          <time dateTime={date}>{formatDayLabelLong(date)}</time>
        </h3>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          {ANALYTICS_UI_LABELS.selectedDayTitle}
        </span>
      </div>

      {row === null ? (
        // The selection is outside the rows that came back — a range was narrowed, or a
        // link named a day this read does not cover. State 15 of the fifteen (R18.1).
        <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed text-slate-600">
          {ANALYTICS_LABELS.noActivity}
        </p>
      ) : (
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PanelFigure
            date={row.date}
            metricKey="prospects_contacted"
            metric={row.metrics.prospects_contacted}
            visibleLabel={ANALYTICS_METRIC_LABELS.prospects_contacted}
          />
          <PanelFigure
            date={row.date}
            metricKey="state_changed"
            metric={row.metrics.state_changed}
            visibleLabel={ANALYTICS_METRIC_LABELS.state_changed}
          />
          <PanelFigure
            date={row.date}
            metricKey="most_likely_to_close"
            metric={row.metrics.most_likely_to_close}
            visibleLabel={ANALYTICS_METRIC_LABELS.most_likely_to_close}
          />
          <PanelFigure
            date={row.date}
            metricKey="at_risk"
            metric={row.metrics.at_risk}
            visibleLabel={ANALYTICS_METRIC_LABELS.at_risk}
          />

          {/* The fifth figure: the meetings recorded, in its two halves. One definition —
              "what meetings were recorded on this day" is one question — whose description
              holds both halves as plain blocks. Each half keeps its own full measure name in
              its accessible name, so a reader hears "Meetings booked, Mon 12 Feb 2025: 2"
              rather than "booked, 2". */}
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
              {ANALYTICS_UI_LABELS.meetingsRecorded}
            </dt>
            <dd className="mt-0.5 space-y-2">
              <PanelFigure
                date={row.date}
                metricKey="meetings_booked"
                metric={row.metrics.meetings_booked}
                visibleLabel={ANALYTICS_UI_LABELS.bookedSuffix}
                variant="plain"
              />
              <PanelFigure
                date={row.date}
                metricKey="meetings_completed"
                metric={row.metrics.meetings_completed}
                visibleLabel={ANALYTICS_UI_LABELS.completedSuffix}
                variant="plain"
              />
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

// ─── Loading placeholder, in the page's real geometry ─────────────────────────

function TableSkeleton() {
  return (
    <div className="mt-3 space-y-2.5" aria-busy="true">
      <span className="sr-only">{ANALYTICS_UI_LABELS.statusLoading}</span>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="grid grid-cols-7 gap-3">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <Skeleton key={cell} className="h-4 w-12" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── The page ─────────────────────────────────────────────────────────────────

export default function Analytics() {
  // The space is the brand: the same id `evaAPI` sends as `brand_id`.
  const { spaceId } = useParams<{ spaceId: string }>();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const tableTitleId = useId();
  const selectedHeadingId = useId();

  const brandId = spaceId ?? "";
  const days = readRangeParam(search.get("days"));

  const [analytics, setAnalytics] = useState<DailyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The day the rep picked, or `null` before they pick one.
   *
   * Deliberately not defaulted to the newest row: a selection is a statement that this is
   * the day being looked at, and making one on the rep's behalf would put a day's figures
   * under a heading nobody chose. It is kept across a range change on purpose — that is
   * how a selection can end up outside the returned rows, which is exactly the condition
   * R16.8 covers.
   */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // The balance, in chrome, from the provider that already wraps `Routes` (R17.1). This
  // page spends nothing, so there is nothing to refresh it after.
  const { balance } = useCredits();

  /**
   * The monotonic request counter from `GTMActionQueue` / `GTMProspect`. A response holding
   * a superseded ticket is dropped rather than allowed to overwrite a newer one, which is
   * what keeps a slow 90-day read from landing on top of the 7-day one asked for after it.
   */
  const reqRef = useRef(0);

  /**
   * The one read this page makes (R15.10, R15.8).
   *
   * `force` is the rep pressing refresh: the rows stay on screen while the request is in
   * flight and it toasts either way, exactly as the sibling pages do. Nothing here polls —
   * the numbers are a day's totals, and a table that changed under a reader mid-comparison
   * would be worse than one they refresh themselves.
   */
  const load = useCallback(
    async (force: boolean) => {
      if (!brandId) {
        setLoading(false);
        return;
      }
      const my = ++reqRef.current;
      setError(null);
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        const payload = await gtmAPI.getDailyAnalytics(brandId, { days });
        if (my !== reqRef.current) return;
        setAnalytics(payload);
        if (force) toast.success(ANALYTICS_UI_LABELS.refreshedToast);
      } catch (e) {
        if (my !== reqRef.current) return;
        setError(e instanceof Error ? e.message : ANALYTICS_LABELS.loadFailed);
        if (force) toast.error(ANALYTICS_UI_LABELS.refreshFailedToast);
        else setAnalytics(null);
      } finally {
        if (my === reqRef.current) {
          if (force) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [brandId, days],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  /** The range, written to the URL so the view is linkable and the back button works. */
  const onRange = useCallback(
    (next: number) => {
      const params = new URLSearchParams(search);
      params.set("days", String(next));
      setSearch(params);
    },
    [search, setSearch],
  );

  /**
   * The rows, oldest → newest (R16.2).
   *
   * Exactly the rows the read returned — none is added for a date the payload skipped, and
   * none is dropped — sorted by their own ISO dates, which sort lexicographically. The
   * server already orders them this way; sorting a copy means the presentation cannot
   * depend on that staying true.
   */
  const rows = useMemo(
    () => [...(analytics?.rows ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [analytics],
  );

  /** The selected day's row, or `null` when the returned range holds none for it. */
  const selectedRow = useMemo(
    () => (selectedDate ? rows.find((row) => row.date === selectedDate) ?? null : null),
    [rows, selectedDate],
  );

  /**
   * What the live region says.
   *
   * The page's own two states are announcements about the page. Otherwise it is a count of
   * the rows the server returned — a count of days, not a judgement about any of them, and
   * not a figure derived from what is in them.
   */
  const statusText = useMemo(() => {
    if (loading && rows.length === 0) return ANALYTICS_UI_LABELS.statusLoading;
    if (refreshing) return ANALYTICS_UI_LABELS.statusRefreshing;
    if (rows.length === 0) return "";
    return `${rows.length} ${ANALYTICS_UI_LABELS.countSuffix}`;
  }, [loading, refreshing, rows.length]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAFAFB] font-inter">
      <ConversationSidebar
        spaceId={spaceId!}
        onNewChat={() => navigate("/spaces")}
        onSelectConversation={() => {}}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* The page's one `banner`. */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-200/70 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-sm ring-2 ring-cyan-100">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {GTM_PAGE_LABELS.eyebrow}
              </span>
              {/* The page's single `<h1>`, present in every state. */}
              <h1 className="truncate text-sm font-semibold text-zinc-900">
                {ANALYTICS_LABELS.pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <p
              role="status"
              aria-live="polite"
              className="hidden max-w-[22rem] truncate text-[11.5px] font-medium text-slate-500 sm:block"
            >
              {refreshing && (
                <Loader2
                  className="mr-1.5 inline h-3 w-3 animate-spin align-[-1px]"
                  aria-hidden="true"
                />
              )}
              {statusText}
            </p>
            <CreditBalanceBadge balance={balance} className="hidden sm:inline-flex" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{GTM_UI_LABELS.refresh}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={() => navigate(`/prospect-intelligence/${spaceId ?? ""}`)}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{GTM_PAGE_LABELS.backToProspects}</span>
            </Button>
          </div>
        </header>

        {/* The content region, as the page's one `main` landmark. */}
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] space-y-4 px-6 pb-10 pt-6 lg:px-8">
            <section
              aria-labelledby={tableTitleId}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={tableTitleId} className="text-sm font-semibold text-zinc-900">
                    {ANALYTICS_UI_LABELS.tableTitle}
                  </h2>
                  <p className="mt-1 max-w-[70ch] text-[11px] leading-relaxed text-slate-500">
                    {ANALYTICS_UI_LABELS.selectPrompt}
                  </p>
                  {/* When the read ran and which days it covers. Both `<time>`, with the
                      absolute instant on the `title`, so a relative age is never the only
                      reading available. */}
                  {analytics && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {GTM_UI_LABELS.computed}
                      {": "}
                      {analytics.computedAt ? (
                        <time
                          dateTime={analytics.computedAt}
                          title={absTime(analytics.computedAt)}
                        >
                          {relTime(analytics.computedAt)}
                        </time>
                      ) : (
                        GTM_UI_LABELS.unavailableHeading
                      )}
                      {analytics.startDate && analytics.endDate && (
                        <>
                          {" · "}
                          <time dateTime={analytics.startDate}>
                            {formatDayLabel(analytics.startDate)}
                          </time>
                          {" – "}
                          <time dateTime={analytics.endDate}>
                            {formatDayLabel(analytics.endDate)}
                          </time>
                        </>
                      )}
                    </p>
                  )}
                </div>

                {/* The range. Four real buttons with `aria-pressed`, so the window in view
                    is announced rather than only shown as a filled chip. */}
                <div
                  role="group"
                  aria-label={ANALYTICS_UI_LABELS.rangeLabel}
                  className="flex shrink-0 flex-wrap items-center gap-1.5"
                >
                  {ANALYTICS_RANGE_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={option === days ? "default" : "outline"}
                      aria-pressed={option === days}
                      onClick={() => onRange(option)}
                    >
                      {rangeOptionLabel(option)}
                    </Button>
                  ))}
                </div>
              </div>

              {!brandId ? (
                // Nothing to retry: the route is missing the workspace it needs.
                <Alert className="mt-4">
                  <AlertTitle as="h3">{ANALYTICS_LABELS.loadFailed}</AlertTitle>
                  <AlertDescription>{ANALYTICS_UI_LABELS.noWorkspace}</AlertDescription>
                </Alert>
              ) : loading && rows.length === 0 ? (
                <TableSkeleton />
              ) : error && rows.length === 0 ? (
                // Our failure, not an empty week — and it takes a retry (R18.5).
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle as="h3">{ANALYTICS_LABELS.loadFailed}</AlertTitle>
                  <AlertDescription className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-[13px]">{error}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void load(true)}
                    >
                      {GTM_PAGE_LABELS.retry}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* A failed refresh with rows still held: the alert sits above the table
                      and the table stays. Stale-but-labelled beats empty. */}
                  {error && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertDescription className="flex flex-wrap items-center gap-3">
                        <span className="text-[13px]">{error}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void load(true)}
                        >
                          {GTM_PAGE_LABELS.retry}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {rows.length === 0 ? (
                    <p className="mt-4 max-w-[70ch] text-[13px] leading-relaxed text-slate-500">
                      {ANALYTICS_UI_LABELS.emptyRange}
                    </p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      {/* A real `<table>`: `<th scope="col">` measures and `<th scope="row">`
                          dates, so assistive technology conveys each figure with both
                          (R16.9). The caption names what the table is and that the dates are
                          UTC — the bucketing is by UTC calendar date, and a reader in another
                          zone must not read a boundary the count did not use. */}
                      <table className="w-full border-collapse text-left">
                        <caption className="sr-only">
                          {ANALYTICS_UI_LABELS.tableCaption}
                        </caption>
                        <thead>
                          <tr className="border-b border-zinc-200">
                            <th
                              scope="col"
                              className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400"
                            >
                              {ANALYTICS_UI_LABELS.dateColumn}
                            </th>
                            {ANALYTICS_METRIC_COLUMNS.map((key) => (
                              <th
                                key={key}
                                scope="col"
                                className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400"
                              >
                                {ANALYTICS_METRIC_LABELS[key]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const isSelected = row.date === selectedDate;
                            return (
                              <tr
                                key={row.date}
                                data-testid={analyticsRowTestId(row.date)}
                                data-selected={isSelected ? "true" : "false"}
                                className={cn(
                                  "border-b border-zinc-100 last:border-b-0",
                                  isSelected && "bg-cyan-50/60",
                                )}
                              >
                                {/* The row's own name is its date, and the control that
                                    picks the day sits inside it — so the thing a rep
                                    reaches for is the thing the row is named after. */}
                                <th scope="row" className="px-3 py-2.5 align-top">
                                  <button
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => setSelectedDate(row.date)}
                                    className={cn(
                                      "rounded-md text-left text-[12px] font-semibold text-zinc-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2",
                                      isSelected && "text-cyan-800",
                                    )}
                                  >
                                    <time dateTime={row.date}>{formatDayLabel(row.date)}</time>
                                  </button>
                                </th>
                                {ANALYTICS_METRIC_COLUMNS.map((key) => (
                                  <MetricCell
                                    key={key}
                                    date={row.date}
                                    metricKey={key}
                                    metric={hasMetric(row, key) ? row.metrics[key] : undefined}
                                  />
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* The expanded day, below the table rather than instead of it, so the
                      preceding dates stay in view for the comparison (R16.4). */}
                  {selectedDate !== null && (
                    <SelectedDayPanel
                      date={selectedDate}
                      row={selectedRow}
                      headingId={selectedHeadingId}
                    />
                  )}

                  {/* Nothing picked yet: the prompt says what a selection buys, and the
                      table above is already the whole range. */}
                  {selectedDate === null && rows.length > 0 && (
                    <p
                      className={cn(
                        "mt-4 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        TONE.zinc,
                      )}
                    >
                      {ANALYTICS_UI_LABELS.selectPrompt}
                    </p>
                  )}
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
