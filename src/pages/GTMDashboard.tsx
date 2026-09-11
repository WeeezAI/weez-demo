// pages/GTMDashboard.tsx
//
// The GTM_Dashboard: the brand's seven actionable statements for one period
// (R28.5, R28.6, R28.7).
//
// Seven counts, and that is the whole page. What makes it worth having is the second
// half of every statement rather than the first: R28.6 requires each aggregate to
// *link to the rows behind it*, so "eleven prospects went cold" opens those eleven
// instead of leaving the operator to go and find them. A count that cannot be opened
// is informational, and this page is not allowed to render one.
//
// **Every link is built from the aggregate's own filter, never from its key.** The
// server returns each count with an `AggregateFilter` — a `route` naming the view and
// a list of `FilterCriterion` clauses that reproduce the number — and that payload is
// the only input to the link. There is deliberately no table in this file mapping
// `state_changed` to a URL: such a table would be a second copy of the server's
// resolver, free to drift from it, and a link built from it would claim a narrowing
// nobody computed. What this file *does* hold is a mapping from the `route` the server
// publishes to the page that renders it (`/gtm/prospects` → `ProspectIntelligence`,
// `/gtm/action-queue` → `GTMActionQueue`), because the server names an API path and
// only the frontend knows which screen shows it.
//
// **A clause only becomes a query parameter if the destination reads it.**
// `GTMActionQueue` honours `sort`, `channel` and `action_type` and nothing else, so a
// clause on a channel or an action type is carried across as that parameter — after
// passing that page's own exported guards, `readChannelParam` and
// `readActionTypeParam`, which are the vocabulary the destination will re-validate
// against anyway. Every other clause is *not* put in the URL: a parameter no page
// reads would be this page asserting a filter that was never applied. Those clauses
// are shown on the card instead, each one marked as narrowing the view or not, so the
// operator knows exactly how much of the statement the link carries. That
// `ProspectIntelligence` currently reads no filter parameters at all is a real gap and
// it is reported as one rather than papered over here.
//
// **An uncomputable statement is absent, not zero.** The page renders the aggregates
// the server returned and never the seven keys with gaps filled in: zero means "we
// looked and found none", which an unavailable aggregate does not support. The keys
// that did not arrive are named in a note as *not computed* — no number beside them —
// because a reader who cannot tell "none" from "unknown" has been misled either way.
//
// **Read-only.** `GET /gtm/dashboard` counts and writes nothing, and neither does this
// page: no recompute on mount, no background timer, one explicit refresh control.
//
// **Structure.** One `banner` (the chrome header) and one `main` (the scrolling
// content), as `GTMProspect` and `GTMActionQueue` establish. One `<h1>` present in
// every state, an `<h2>` on the statements section, an `<h3>` per statement card and on
// every alert title inside the section — h1 → h2 → h3, never skipping. Each count is a
// real `<a>` through react-router's `Link`, so it is keyboard-operable and carries the
// shared focus ring; the clause disclosure is a native `<details>` / `<summary>` for
// the same reason. No status marker is carried by tone alone.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, LayoutDashboard, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ConversationSidebar from "@/components/ConversationSidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  AggregateFilter,
  Dashboard,
  DashboardAggregate,
  DashboardAggregateKey,
  FilterCriterion,
  FilterOperator,
} from "@/services/gtmAPI";
import gtmAPI from "@/services/gtmAPI";
import {
  CREDIT_LABELS,
  CreditBalanceBadge,
  CreditLedgerPanel,
  CreditPriceList,
} from "@/components/gtm/CreditBalance";
import { useCredits } from "@/hooks/useCredits";

import {
  GTM_PAGE_LABELS,
  GTM_UI_LABELS,
  TONE,
  absTime,
  relTime,
} from "@/components/gtm/labels";
import { readActionTypeParam, readChannelParam } from "./GTMActionQueue";

/**
 * The strings this page needs and `labels.ts` does not carry.
 *
 * Two label gaps sit in here, and both are gaps rather than choices: `labels.ts` has no
 * table for the seven `DashboardAggregateKey` values and none for the seven
 * `FilterOperator` values. They belong there beside `GTM_PRIORITY_TIER_LABELS`, in the
 * same `Record<string, string>` shape, but that module was closed by task 14.3 and
 * adding to it now is out of scope — so they live here in the shape
 * `GTMActionQueue.tsx`'s `ACTION_QUEUE_LABELS` and `NextActionPanel.tsx`'s
 * `ACTION_CARD_LABELS` established, and moving them is a one-line change at each use
 * site. There is no third table: a criterion's *field* is rendered from the string the
 * server published rather than looked up, because inventing a friendly name for a
 * column this file has never seen would be guessing at what was counted.
 *
 * Everything already in `labels.ts` is taken from there: `GTM_PAGE_LABELS.eyebrow`,
 * `.backToProspects`, `.retry`, `.noLeadBody`, `GTM_UI_LABELS.refresh`, `.computed`,
 * `.unavailableHeading`, `TONE`, `relTime`, `absTime`.
 *
 * No entry states or implies that Weez sends anything. Nothing on this page opens a
 * channel at all — it counts and it links — and the two link labels name the view they
 * open and stop there.
 */
export const DASHBOARD_LABELS = {
  // "Learning", because that is what the navigation calls this surface and a page whose
  // title disagrees with the item that opened it makes an operator wonder whether they
  // arrived somewhere else. It was "GTM dashboard", which named the API this reads rather
  // than the stage of the journey it belongs to.
  pageTitle: "Learning",
  statementsTitle: "Actionable statements",

  /** Why each count is a link. The promise the page is making, said once. */
  statementsNote:
    "Each statement opens the rows it counted, so it can be worked rather than read.",

  // The period control. Written to the URL, so a period is linkable and the back
  // button moves between them.
  periodLabel: "Period",
  periodDays: (days: number) => `Last ${days} days`,

  // The clause disclosure. A filter shown as the machine-readable thing it is.
  clausesSummary: (count: number) =>
    count === 1 ? "How this was counted (1 clause)" : `How this was counted (${count} clauses)`,
  clauseCarried: "Narrows the view this opens",
  clauseNotCarried: "Not narrowed in the view this opens",
  noClauses: "No clauses published for this statement.",

  /** The window a statement's own filter was computed over. */
  window: (days: number) => `Counted over the last ${days} days`,

  /**
   * The two things that can be true of a count and are not the count.
   *
   * `absentHeading` is the load-bearing one: it names the statements that were **not
   * computed**, with no number beside them, because reporting an uncomputable
   * aggregate as zero would claim we looked and found none.
   */
  absentHeading: "Not computed for this period",
  absentNote:
    "These statements aren't shown as zero. Zero means we looked and found none, which isn't what happened here.",
  noViewForRoute: "This build doesn't know which view opens these rows.",

  // The page's own announcements. Statements about the page, never about a prospect.
  statusLoading: "Loading what Weez has learned",
  statusRefreshing: "Refreshing what Weez has learned",
  statusCount: (shown: number, total: number) => `${shown} of ${total} statements computed`,

  /**
   * Nothing computed, and what would change it.
   *
   * The first sentence is the fact; the second is the operator's next step, which is the
   * half a bare "no statements" leaves them to guess at. Learning is fed by recorded
   * outcomes, so an empty period on a new workspace is a workspace that has not acted yet
   * rather than one where something is broken.
   */
  empty:
    "No statements computed for this period. Weez learns from outcomes — activate intelligence on a prospect, work the recommended action, and record what came of it.",
  loadFailedTitle: "Couldn't load the dashboard",
  refreshedToast: "Dashboard refreshed",
  refreshFailedToast: "Couldn't refresh the dashboard",
} as const;

/**
 * The seven statements, each with the noun its count is in.
 *
 * `unit` exists because the seven counts are not all counts of prospects: the
 * comparative channel performance counts the brand's learned channel results for its
 * leading persona, and calling those "prospects" would be wrong on the one statement
 * that is about a cohort rather than a list of people.
 *
 * `Record<DashboardAggregateKey, …>` rather than the open `Record<string, string>` the
 * tables in `labels.ts` use: the seven keys are a closed union in `services/gtmAPI.ts`,
 * so the compiler is the thing that checks all seven are labelled and
 * `DASHBOARD_AGGREGATE_KEYS` below can be read straight off this object instead of
 * being spelled out a second time.
 */
export const DASHBOARD_AGGREGATE_LABELS: Record<
  DashboardAggregateKey,
  { title: string; statement: string; unit: string }
> = {
  state_changed: {
    title: "State changed",
    statement: "Something we observed moved these prospects to a different state.",
    unit: "prospects",
  },
  newly_high_intent: {
    title: "Newly high intent",
    statement: "These crossed the high buying-intent threshold in this period.",
    unit: "prospects",
  },
  more_reachable_elsewhere: {
    title: "More reachable elsewhere",
    statement:
      "Another channel scores higher for these than the one last used on them.",
    unit: "prospects",
  },
  went_cold: {
    title: "Went cold",
    statement: "Engagement turned declining for these in this period.",
    unit: "prospects",
  },
  needs_followup: {
    title: "Needs follow-up",
    statement: "An open thread on these has been quiet past the follow-up window.",
    unit: "prospects",
  },
  high_intent_no_action: {
    title: "High intent, nothing done",
    statement: "High buying intent, and no action ever recorded as taken.",
    unit: "prospects",
  },
  channel_performance_leading_persona: {
    title: "Channel performance, leading persona",
    statement:
      "What the brand has learned about each channel for its most common seniority band.",
    unit: "channel results",
  },
};

/**
 * The seven keys, read off the label table.
 *
 * One list, derived rather than restated, so "which seven" cannot be answered two
 * different ways in one file. Used only to name the statements the server did *not*
 * return — never to synthesise one.
 */
export const DASHBOARD_AGGREGATE_KEYS = Object.keys(
  DASHBOARD_AGGREGATE_LABELS,
) as DashboardAggregateKey[];

/**
 * How one clause compares, in words.
 *
 * The second `labels.ts` gap. Each reads as the middle of a sentence — "intent type
 * *is* BUYING", "position *never recorded* EXECUTED" — because that is where it is
 * rendered: between a field the server named and the values it compared against.
 *
 * `ABSENT` is the one worth reading twice. It is not "is empty": the clause means the
 * row was never written at all, which is the distinction `high_intent_no_action` is
 * built on — a prospect with no `EXECUTED` event is one nobody has acted on, not one
 * whose action was recorded as nothing.
 */
export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  EQUALS: "is",
  IN: "is one of",
  AT_LEAST: "is at least",
  AT_MOST: "is at most",
  WITHIN_DAYS: "moved within, in days",
  ABSENT: "never recorded",
  CHANGED_TO: "changed to",
};

// ─── Building a link out of a filter ──────────────────────────────────────────

/** The two views a dashboard statement can open. */
export type DashboardDestination = "ACTION_QUEUE" | "PROSPECTS";

/**
 * The server's `route` → the page that renders it.
 *
 * The one mapping in this file, and it is keyed by the route the *filter* published
 * rather than by the aggregate's key. That distinction is the whole point: the server
 * decides which view a statement opens and may move one statement to the other view
 * without this file changing, whereas a key → URL table here would be a duplicate of
 * `DASHBOARD_RESOLVERS` that nothing keeps in step.
 *
 * A route this build does not recognise resolves to `null`, and the count then renders
 * without a link and says so — rather than guessing at a view and sending the operator
 * somewhere the number was not taken from.
 */
export const DASHBOARD_ROUTE_DESTINATIONS: Record<string, DashboardDestination> = {
  "/gtm/action-queue": "ACTION_QUEUE",
  "/gtm/prospects": "PROSPECTS",
};

/** Where each destination lives in this app, under the existing `:spaceId` (R28.7). */
export const DASHBOARD_DESTINATION_PATHS: Record<
  DashboardDestination,
  (brandId: string) => string
> = {
  ACTION_QUEUE: (brandId) => `/action-queue/${encodeURIComponent(brandId)}`,
  PROSPECTS: (brandId) => `/prospect-intelligence/${encodeURIComponent(brandId)}`,
};

/** What the link says it opens. Named by destination, so a re-routed statement re-labels itself. */
export const DASHBOARD_DESTINATION_LABELS: Record<DashboardDestination, string> = {
  ACTION_QUEUE: "Work these in the action queue",
  PROSPECTS: "Open these prospects",
};

/**
 * The query parameters each destination actually reads, keyed by the column a clause
 * is on.
 *
 * `GTMActionQueue` reads `sort`, `channel` and `action_type` from the URL and nothing
 * else, so only the two that a filter clause could ever be about appear here.
 * `ProspectIntelligence` reads no filter parameters at all today — hence the empty
 * table, which is a statement of fact about that page rather than an oversight: a
 * clause put in its URL would be narrowing nothing.
 */
export const DASHBOARD_HONOURED_PARAMS: Record<
  DashboardDestination,
  Record<string, string>
> = {
  ACTION_QUEUE: { channel: "channel", action_type: "action_type" },
  PROSPECTS: {},
};

/** The operators a single-valued equality parameter can carry. */
const EQUALITY_OPERATORS: readonly FilterOperator[] = ["EQUALS", "IN"];

/**
 * A criterion's bare column, without the table that qualifies it.
 *
 * `gtm_action_recommendations.channel` and `channel` are the same clause as far as a
 * query parameter is concerned, and the server publishes both shapes — qualified for
 * clauses that are one column, bare for the two that are derived comparisons.
 */
export function criterionColumn(field: string): string {
  const dot = field.lastIndexOf(".");
  return dot === -1 ? field : field.slice(dot + 1);
}

/** The route, without a trailing slash or a query the server did not mean as one. */
function normaliseRoute(route: string): string {
  const path = route.split("?")[0].replace(/\/+$/, "");
  return path;
}

/** Which view this filter opens, or `null` when this build does not know the route. */
export function destinationOf(filter: AggregateFilter): DashboardDestination | null {
  return DASHBOARD_ROUTE_DESTINATIONS[normaliseRoute(filter.route)] ?? null;
}

/**
 * The value a clause contributes to a query parameter, or `null` if it cannot.
 *
 * Guarded through the destination's own readers — `GTMActionQueue` exports
 * `readChannelParam` and `readActionTypeParam` and validates with them on arrival — so
 * a link never carries a value that page would drop. A multi-valued or inequality
 * clause contributes nothing: `channel` takes one channel, and "at least" is not
 * something a single-value parameter can express, so narrowing on it would be a
 * narrower filter than the count used.
 */
function honouredValue(param: string, criterion: FilterCriterion): string | null {
  if (!EQUALITY_OPERATORS.includes(criterion.operator)) return null;
  if (criterion.values.length !== 1) return null;
  const [raw] = criterion.values;
  if (param === "channel") return readChannelParam(raw);
  if (param === "action_type") return readActionTypeParam(raw);
  return null;
}

/** A link built from one aggregate's filter, and what the destination could take of it. */
export interface AggregateLink {
  destination: DashboardDestination;
  /** The `to` for a `Link`: the destination path, plus the clauses it reads. */
  to: string;
  /** The clauses that reached the destination as parameters it honours. */
  carried: FilterCriterion[];
  /** The clauses it has no parameter for. Shown on the card rather than sent. */
  uncarried: FilterCriterion[];
}

/**
 * One aggregate's link, from the aggregate's own filter.
 *
 * The route decides the page; the clauses decide the query string; nothing about the
 * aggregate's key is consulted. `null` when the brand is missing from the route or the
 * filter names a view this build does not have — both cases the card renders as a
 * count without a link rather than as a link to somewhere plausible.
 */
export function aggregateLink(brandId: string, filter: AggregateFilter): AggregateLink | null {
  const destination = destinationOf(filter);
  if (!brandId || !destination) return null;

  const honoured = DASHBOARD_HONOURED_PARAMS[destination];
  const params = new URLSearchParams();
  const carried: FilterCriterion[] = [];
  const uncarried: FilterCriterion[] = [];

  for (const criterion of filter.criteria) {
    const param = honoured[criterionColumn(criterion.field)];
    const value = param ? honouredValue(param, criterion) : null;
    if (param && value !== null) {
      params.set(param, value);
      carried.push(criterion);
    } else {
      uncarried.push(criterion);
    }
  }

  const base = DASHBOARD_DESTINATION_PATHS[destination](brandId);
  const query = params.toString();
  return { destination, to: query ? `${base}?${query}` : base, carried, uncarried };
}

// ─── Reading the period off the URL ───────────────────────────────────────────

/** The windows the control offers. All inside the route's own 1–365 bound. */
export const DASHBOARD_PERIOD_OPTIONS: readonly number[] = [7, 30, 90];

/** The route's own default, so an unparameterised visit reads what the server would send. */
export const DASHBOARD_DEFAULT_PERIOD_DAYS = 7;

/**
 * The period, from the URL, narrowed to the options offered.
 *
 * Anything else falls back to the default rather than being passed on: a period the
 * control cannot show would leave the page displaying one window and highlighting
 * another.
 */
export function readPeriodParam(raw: string | null): number {
  const parsed = Number(raw);
  return DASHBOARD_PERIOD_OPTIONS.includes(parsed) ? parsed : DASHBOARD_DEFAULT_PERIOD_DAYS;
}

/** One statement's test hook, keyed by its aggregate. */
export function aggregateTestId(key: DashboardAggregateKey): string {
  return `gtm-dashboard-aggregate-${key}`;
}

// ─── One clause ───────────────────────────────────────────────────────────────

/**
 * A criterion's field, as the server named it, made readable without being renamed.
 *
 * A format and not a lookup: the table qualifier goes and the underscores become
 * spaces, which is why `days_since_last_outbound_observed_at` reads as a phrase while
 * still being the string the server published. There is deliberately no dictionary
 * behind this — a friendlier name for a column this file has never seen would be a
 * guess at what was counted, and the whole value of the clause list is that it is the
 * filter itself.
 */
export function criterionFieldText(field: string): string {
  return criterionColumn(field).replace(/_/g, " ");
}

interface ClauseProps {
  criterion: FilterCriterion;
  /** Whether this clause reached the destination as a parameter it reads. */
  carried: boolean;
}

function Clause({ criterion, carried }: ClauseProps) {
  const operator = FILTER_OPERATOR_LABELS[criterion.operator] ?? criterion.operator;
  return (
    <li className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[11px] leading-relaxed text-slate-600">
      {/* The raw field on `title`, so the readable phrase is never the only reading. */}
      <span className="font-semibold text-zinc-800" title={criterion.field}>
        {criterionFieldText(criterion.field)}
      </span>
      <span className="text-slate-500">{operator}</span>
      {criterion.values.length > 0 && (
        <span className="font-medium text-zinc-800">{criterion.values.join(", ")}</span>
      )}
      {/* Text, not a tone: whether a clause travelled is information, so it says so. */}
      <span
        className={cn(
          "rounded-full border px-1.5 py-0 text-[9.5px] font-semibold uppercase tracking-[0.08em]",
          carried ? TONE.emerald : TONE.zinc,
        )}
      >
        {carried ? DASHBOARD_LABELS.clauseCarried : DASHBOARD_LABELS.clauseNotCarried}
      </span>
    </li>
  );
}

// ─── One statement ────────────────────────────────────────────────────────────

export interface AggregateCardProps {
  brandId: string;
  aggregate: DashboardAggregate;
}

/**
 * One `<li>`: what the statement says, the count as the link that opens it, and the
 * clauses that produced it.
 *
 * The count is inside the `Link`, not beside it, so the thing an operator reaches for
 * is the thing that navigates — and it is an `<a>` with an `href`, keyboard-operable
 * without a handler on a `<div>`. The link's accessible name is the count, the noun and
 * the destination together ("11 prospects · Work these in the action queue"), which
 * reads on its own out of context the way a link has to.
 */
export function AggregateCard({ brandId, aggregate }: AggregateCardProps) {
  const label = DASHBOARD_AGGREGATE_LABELS[aggregate.key];
  const link = useMemo(() => aggregateLink(brandId, aggregate.filter), [brandId, aggregate.filter]);
  const clauses = aggregate.filter.criteria;
  const carried = new Set(link?.carried ?? []);

  return (
    <li
      data-testid={aggregateTestId(aggregate.key)}
      data-aggregate-key={aggregate.key}
      data-aggregate-count={aggregate.count}
      className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-zinc-900">
          {label?.title ?? aggregate.key}
        </h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">
          {label?.statement ?? ""}
        </p>
      </div>

      {link ? (
        <Link
          to={link.to}
          className="group inline-flex min-w-0 items-baseline gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="text-2xl font-semibold leading-none text-zinc-900">
            {aggregate.count}
          </span>
          <span className="min-w-0 text-[11.5px] font-semibold text-violet-700 group-hover:underline">
            {label?.unit ?? ""}
            {" · "}
            {DASHBOARD_DESTINATION_LABELS[link.destination]}
            <ArrowUpRight className="ml-0.5 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
          </span>
        </Link>
      ) : (
        // No link: the route is one this build cannot resolve, so the count stands on
        // its own and says why it is not openable rather than guessing at a view.
        <div className="min-w-0">
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold leading-none text-zinc-900">
              {aggregate.count}
            </span>
            <span className="text-[11.5px] font-semibold text-slate-600">
              {label?.unit ?? ""}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{DASHBOARD_LABELS.noViewForRoute}</p>
        </div>
      )}

      {/* The window this statement's own filter was computed over, when it carries
          one. Two of the seven are standing facts rather than events and publish no
          window; showing them a period they were not clipped to would be wrong. */}
      {aggregate.filter.periodDays !== null && (
        <p className="text-[11px] text-slate-500">
          {DASHBOARD_LABELS.window(aggregate.filter.periodDays)}
        </p>
      )}

      {/* The filter itself, collapsed. A native disclosure: the `<summary>` is
          focusable and Enter/Space operable as it stands, with no `aria-expanded` of
          ours to keep in sync with the element's own `open`. */}
      <details className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50/60">
        <summary className="cursor-pointer rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {DASHBOARD_LABELS.clausesSummary(clauses.length)}
        </summary>
        <div className="border-t border-zinc-200 px-2.5 py-2">
          {clauses.length === 0 ? (
            <p className="text-[11px] text-slate-500">{DASHBOARD_LABELS.noClauses}</p>
          ) : (
            <ul className="space-y-1.5">
              {clauses.map((criterion, index) => (
                <Clause
                  key={`${criterion.field}-${criterion.operator}-${index}`}
                  criterion={criterion}
                  carried={carried.has(criterion)}
                />
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

// ─── Loading placeholder, in the page's real geometry ─────────────────────────

function CardSkeleton() {
  return (
    <li className="flex flex-col gap-2.5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <Skeleton className="h-3.5 w-36" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-6 w-full rounded-md" />
    </li>
  );
}

// ─── The page ─────────────────────────────────────────────────────────────────

export default function GTMDashboard() {
  // The space is the brand: the same id `evaAPI` sends as `brand_id` (R28.7).
  const { spaceId } = useParams<{ spaceId: string }>();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const statementsTitleId = useId();

  const brandId = spaceId ?? "";
  const periodDays = readPeriodParam(search.get("period_days"));

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The credit ledger, as a second read whose failure is its own. This page charges
  // nothing, so there is nothing to refresh it after — the balance only moves when the
  // operator spends on another surface, and that surface re-reads its own.
  const { credits, balance } = useCredits();

  /**
   * The monotonic request counter from `GTMProspect.tsx` and `GTMActionQueue.tsx`.
   * Every read takes a ticket and a response holding a superseded one is dropped, so a
   * slow 90-day read cannot land on top of the 7-day one the operator asked for after
   * it.
   */
  const reqRef = useRef(0);

  /**
   * The one read this page makes.
   *
   * `force` is the operator pressing refresh: the statements stay on screen while the
   * request is in flight and it toasts either way, exactly as `GTMProspect.load` and
   * `GTMActionQueue.load` do. No timer calls this — the route counts and does not
   * recompute, so re-reading is something a person asks for.
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
        const next = await gtmAPI.getDashboard(brandId, { periodDays });
        if (my !== reqRef.current) return;
        setDashboard(next);
        if (force) toast.success(DASHBOARD_LABELS.refreshedToast);
      } catch (e) {
        if (my !== reqRef.current) return;
        setError(e instanceof Error ? e.message : DASHBOARD_LABELS.loadFailedTitle);
        if (force) toast.error(DASHBOARD_LABELS.refreshFailedToast);
        else setDashboard(null);
      } finally {
        if (my === reqRef.current) {
          if (force) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [brandId, periodDays],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  /** The period, written to the URL so the view is linkable and the back button works. */
  const onPeriod = useCallback(
    (next: number) => {
      const params = new URLSearchParams(search);
      params.set("period_days", String(next));
      setSearch(params);
    },
    [search, setSearch],
  );

  const aggregates = dashboard?.aggregates ?? [];

  /**
   * The statements the server did not return.
   *
   * Named, never numbered. This is the whole "absent, not zero" rule as one line: the
   * page holds the seven keys only so it can say which ones did not arrive, and it
   * builds no `DashboardAggregate` for any of them.
   */
  const absent = useMemo(() => {
    const present = new Set(aggregates.map((item) => item.key));
    return DASHBOARD_AGGREGATE_KEYS.filter((key) => !present.has(key));
  }, [aggregates]);

  /**
   * What the live region says. The page's own two states are announcements about the
   * page; otherwise it is how many of the seven were computed — a count of statements,
   * not a judgement about any prospect.
   */
  const statusText = useMemo(() => {
    if (loading && aggregates.length === 0) return DASHBOARD_LABELS.statusLoading;
    if (refreshing) return DASHBOARD_LABELS.statusRefreshing;
    if (!dashboard) return "";
    return DASHBOARD_LABELS.statusCount(aggregates.length, DASHBOARD_AGGREGATE_KEYS.length);
  }, [aggregates.length, dashboard, loading, refreshing]);

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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-white shadow-sm ring-2 ring-violet-100">
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {GTM_PAGE_LABELS.eyebrow}
              </span>
              {/* The page's single `<h1>`, present in every state. */}
              <h1 className="truncate text-sm font-semibold text-zinc-900">
                {DASHBOARD_LABELS.pageTitle}
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
                <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin align-[-1px]" aria-hidden="true" />
              )}
              {statusText}
            </p>
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
              aria-labelledby={statementsTitleId}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={statementsTitleId} className="text-sm font-semibold text-zinc-900">
                    {DASHBOARD_LABELS.statementsTitle}
                  </h2>
                  <p className="mt-1 max-w-[60ch] text-[11px] leading-relaxed text-slate-500">
                    {DASHBOARD_LABELS.statementsNote}
                  </p>
                  {/* When the counts were taken. `<time>` with the absolute instant on
                      the `title`, so a relative age is never the only reading. */}
                  {dashboard?.computedAt && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {GTM_UI_LABELS.computed}
                      {": "}
                      <time dateTime={dashboard.computedAt} title={absTime(dashboard.computedAt)}>
                        {relTime(dashboard.computedAt)}
                      </time>
                    </p>
                  )}
                </div>

                {/* The period. Real buttons with `aria-pressed`, so the current window
                    is announced rather than only shown as a filled chip. */}
                <div
                  role="group"
                  aria-label={DASHBOARD_LABELS.periodLabel}
                  className="flex shrink-0 flex-wrap items-center gap-1.5"
                >
                  {DASHBOARD_PERIOD_OPTIONS.map((days) => (
                    <Button
                      key={days}
                      type="button"
                      size="sm"
                      variant={days === periodDays ? "default" : "outline"}
                      aria-pressed={days === periodDays}
                      onClick={() => onPeriod(days)}
                    >
                      {DASHBOARD_LABELS.periodDays(days)}
                    </Button>
                  ))}
                </div>
              </div>

              {!brandId ? (
                // Nothing to retry: the route is missing the brand it needs. `h3`
                // because this section is the `h2` — the outline never skips.
                <Alert className="mt-4">
                  <AlertTitle as="h3">{DASHBOARD_LABELS.loadFailedTitle}</AlertTitle>
                  <AlertDescription>{GTM_PAGE_LABELS.noLeadBody}</AlertDescription>
                </Alert>
              ) : loading && aggregates.length === 0 ? (
                // The announcement sits outside the `<ul>`: a list may only contain
                // list items, so a bare `<span>` in there would be a structure error
                // on the one element whose structure carries meaning.
                <>
                  <p className="sr-only">{DASHBOARD_LABELS.statusLoading}</p>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                  </ul>
                </>
              ) : error && aggregates.length === 0 ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle as="h3">{DASHBOARD_LABELS.loadFailedTitle}</AlertTitle>
                  <AlertDescription className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-[13px]">{error}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => void load(true)}>
                      {GTM_PAGE_LABELS.retry}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* A failed refresh with statements still held: the alert sits above
                      them and they stay. Stale-but-labelled beats empty. */}
                  {error && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertDescription className="flex flex-wrap items-center gap-3">
                        <span className="text-[13px]">{error}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => void load(true)}>
                          {GTM_PAGE_LABELS.retry}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {aggregates.length === 0 ? (
                    <p className="mt-4 text-[13px] text-slate-500">{DASHBOARD_LABELS.empty}</p>
                  ) : (
                    // A `<ul>`: the seven are a set, not a ranking. Named, because a
                    // list with no accessible name is one a reader has to guess at.
                    <ul
                      aria-label={DASHBOARD_LABELS.statementsTitle}
                      className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                    >
                      {aggregates.map((aggregate) => (
                        <AggregateCard
                          key={aggregate.key}
                          brandId={brandId}
                          aggregate={aggregate}
                        />
                      ))}
                    </ul>
                  )}

                  {/* The statements that were not computed. Named, with no number: a
                      zero here would claim we looked and found none. */}
                  {absent.length > 0 && (
                    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50/60 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        {DASHBOARD_LABELS.absentHeading}
                      </p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {absent.map((key) => (
                          <li
                            key={key}
                            className={cn(
                              "rounded-full border px-2 py-0 text-[10px] font-semibold",
                              TONE.zinc,
                            )}
                          >
                            {DASHBOARD_AGGREGATE_LABELS[key].title}
                            {": "}
                            {GTM_UI_LABELS.unavailableHeading}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 max-w-[70ch] text-[11px] leading-relaxed text-slate-500">
                        {DASHBOARD_LABELS.absentNote}
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── Credits ──
                On this page because it is the one surface whose subject is the workspace
                rather than a prospect: what the loop learned, and what the workspace spent
                learning it. The seven statements above answer "is Weez getting better";
                this answers "what has that cost", and the two belong on one screen.

                The price list and the ledger are the server's — no total is computed here.
                A client that summed a page of history would disagree with the balance the
                moment the window stopped covering every movement. */}
            <section className="mt-6 space-y-4" aria-labelledby="credits-heading">
              <div className="flex items-baseline justify-between gap-3">
                <h2
                  id="credits-heading"
                  className="text-[13px] font-semibold text-zinc-900"
                >
                  {CREDIT_LABELS.balance}
                </h2>
                <CreditBalanceBadge balance={balance} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/40 p-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    {CREDIT_LABELS.prices}
                  </h3>
                  <CreditPriceList prices={credits?.prices ?? []} className="mt-2" />
                </div>
                <CreditLedgerPanel
                  credits={credits}
                  className="rounded-lg border border-border/40 p-4"
                />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
