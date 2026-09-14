// pages/GTMActionQueue.tsx
//
// The Attention_Checklist: the short list of prospects that need the representative
// today, grouped by the day the attention became due (R11.1 — R11.10).
//
// **What changed, and what deliberately did not.** The page shell is the one this file
// established — `ConversationSidebar`, the sticky `banner` carrying the single `<h1>`,
// the `<main>` landmark, the monotonic `reqRef`, `loading` / `refreshing` / `error`, the
// inline `Alert` with a `Try again` — and so are `ACTION_QUEUE_LABELS`, the keyset
// paging idiom, the `sort` / `channel` / `action_type` URL params and `queueRowTestId()`.
// What changed is the list's **source and shape** (§6.1, §6.2).
//
// **The feed is the list, and it is the only list.**
//
//     GET /gtm/attention-feed?brand_id&period_days=7&limit=50   the checklist
//     GET /gtm/action-queue?brand_id&…                          ranked detail, joined
//
// `getActionQueue` does not build the checklist and cannot add a row to it (R11.5): a
// task exists because the *feed* said a trigger fired, and a ranked recommendation is
// one of the nine reasons that happens rather than the definition of the list. The
// dashboard is not read at all (R10.11) — an attention list assembled from aggregates
// would be this page's opinion about which counts imply work, and the server already
// answers that question.
//
// The queue read is retained for exactly one job: when an `ACTION_MANDATORY` task is
// expanded, the matching `ActionQueueItem` supplies the `whyNow` references, the four
// EPS dimensions and the `executionVerb`. One read for the whole page, joined by
// `leadId`, exactly as the dossier does it — and a task from any of the other eight
// triggers simply has no queue row, which `absenceSentence()` already has the
// vocabulary for. The join is imported from the dossier rather than restated here:
// `overlayFor` / `absenceSentence` are the one place this product decides what "no row"
// means, and a second copy would be a second answer.
//
// **A checklist, not a table.** One task per item, each a real `<button>` inside one
// `<ul>`/`<li>` (R11.6, R11.7). No `role="table"`, no `role="grid"`, no second
// browsing list — and no nested list either, which is why the expanded detail is built
// from `<p>`s and `<div>`s: "exactly one list region" has to stay true after a
// disclosure is opened, not only on first paint.
//
// **Nothing here re-orders or re-derives.** The feed arrives ordered by
// `consequence_tier` and the grouping preserves that order inside each day (R11.4);
// the day buckets are `due_at`'s calendar day, newest first (R11.3); the tier's
// meaning is text from `CONSEQUENCE_TIER_LABELS` rather than a colour. The one
// composition on the page is the task label, and it is composed from the item's own
// fields in the R11.2 form — the middle clause is `AttentionItem.reason`, which is
// server prose, never a sentence this file writes.
//
// **The sort and filter params scope the ranked detail, not the checklist.** They are
// the queue read's parameters and they stay the queue read's parameters, so a dashboard
// statement that links in with `?channel=…` still lands somewhere coherent. The page
// says so out loud (`detailScope`), because a "Filtered by" chip over a checklist it
// does not filter would be a misleading count waiting to happen.
//
// **No credit is spent here — but the balance is still in chrome.** The ranked
// `ActionCard` and its four controls live on the dossier now, so this page shows no
// *price*: a checklist that carried an execution control would be a second place for the
// send rule to be got wrong, and there is exactly one. That is a claim about prices, and
// it is not the claim R17.1 makes. R17.1 is about the *balance* — `App_Chrome` presents it
// on every route inside the authenticated application, spending or not, because a rep
// reading a checklist is entitled to know what they hold before they open the dossier and
// press something. So the badge is back in the header (task 10.8's Property 42 found its
// absence), and it is the one thing here fed from credits: `useCredits()` reads the
// workspace balance once, above `Routes`, and this page adds no read of its own and no
// price anywhere.
//
// **Structure.** One `banner` and one `main`, the two landmarks the sibling pages
// establish. The `<h1>` is present in every state; the day headings are the `<h2>`s, so
// the outline is h1 → h2 and a screen-reader user walking the list hears which day they
// are in. Every control is a real `button` and every status indicator carries text
// rather than only a tone.

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, ListChecks, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ConversationSidebar from "@/components/ConversationSidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  ActionQueueItem,
  ActionQueueSort,
  AttentionItem,
  CandidateActionType,
  ChannelKey,
  ObservedFact,
} from "@/services/gtmAPI";
import gtmAPI from "@/services/gtmAPI";

import { MEASURE_MEANINGS, measureParts } from "@/components/gtm/measure";
import { CreditBalanceBadge } from "@/components/gtm/CreditBalance";
import { useCredits } from "@/hooks/useCredits";
import { ACTION_CARD_LABELS } from "@/components/gtm/NextActionPanel";
import { UNKNOWN_TEXT } from "@/components/gtm/ObservedValue";
import {
  ATTENTION_LABELS,
  ATTENTION_TRIGGER_LABELS,
  CHANNEL_LABEL,
  CONSEQUENCE_TIER_LABELS,
  FACTOR_LABEL,
  GTM_ACTION_LABEL_BY_TYPE,
  GTM_NBA_ACTION_LABELS,
  GTM_PAGE_LABELS,
  GTM_UI_LABELS,
  TONE,
  absTime,
  relTime,
} from "@/components/gtm/labels";
import {
  type OverlayState,
  type QueueOverlay,
  absenceSentence,
  overlayFor,
} from "./ProspectIntelligence";

/**
 * The strings this page needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS` and
 * `SignalList.tsx`'s `SIGNAL_LIST_LABELS` established, because `labels.ts` was closed
 * by task 14.3 and adding to it now is out of scope. The checklist's own copy — the
 * heading, the list's accessible name, the separator, the empty state, the failure and
 * the two relative day headings — is `ATTENTION_LABELS` in `labels.ts`, because Nina's
 * blocks read from the same feed and the two surfaces must not drift.
 *
 * Everything already in `labels.ts` is taken from there rather than restated:
 * `GTM_PAGE_LABELS.eyebrow`, `.backToProspects`, `.retry`, `GTM_UI_LABELS.computed`,
 * `.refresh`, `.reasoningHeading`, `.noReasoning`, `.unavailableHeading`,
 * `CONSEQUENCE_TIER_LABELS`, `ATTENTION_TRIGGER_LABELS`, `GTM_ACTION_LABEL_BY_TYPE`,
 * `GTM_NBA_ACTION_LABELS`, `CHANNEL_LABEL`.
 *
 * No entry states or implies that Weez sends anything.
 */
export const ACTION_QUEUE_LABELS = {
  pageTitle: "Action queue",
  queueTitle: "Ranked actions",
  list: "Recommended actions across prospects, highest priority first",

  /**
   * The note that keeps the tier honest. It names the six inputs R27.6 bands from, so
   * a reader knows the badge is re-derivable from the row rather than a verdict.
   */
  tierNote:
    "Ranked by urgency, expected outcome, business value, signal freshness, action confidence and relationship state. Each of the six is shown on the row it ranked.",

  // The banding inputs, on the expanded task where the ranking is discussed.
  urgency: "Urgency",
  businessValue: "Business value",
  signalFreshness: "Signal freshness",
  stateConfidence: "State confidence",

  expires: "Expires",

  /** When the attention became due — `due_at`, not the instant the feed was computed. */
  dueLabel: "Due",

  /** The band an item was raised *from*, so an escalated tier stays re-derivable. */
  escalatedFrom: "Raised from",

  // The ordering control. `ACTION_CARD_LABELS.priority` supplies the other option.
  sortLabel: "Order",
  sortRecency: "Most recent",

  // The filters a dashboard statement links in with (R28.6). Read from the URL and
  // named on screen, because a filtered read that does not say so is a misleading one.
  filteredBy: "Filtered by",
  clearFilters: "Show every action",

  /**
   * What the ordering and the filter actually scope, now that the list is the feed.
   *
   * They are the *queue* read's parameters, and the queue read is ranked detail behind a
   * mandatory task rather than the checklist. Saying so is the whole reason this string
   * exists: a `Filtered by` chip above a list the filter does not touch would invite the
   * reader to treat a full checklist as a filtered one.
   */
  detailScope:
    "The ordering and the filter scope the ranked detail behind a mandatory task. They never shorten the checklist — every prospect that needs you is listed.",

  // Paging, in `SignalList`'s idiom, on the ranked read: the first page is the highest
  // priority and each further page ranks below it. It widens the join, never the list.
  loadMore: "Load more actions",
  loadingMore: "Loading more actions",
  loadMoreFailed: "Couldn't load more actions",

  // The page's own announcements. Statements about the page, never about a prospect.
  statusLoading: "Loading what needs you today",
  statusRefreshing: "Refreshing what needs you today",
  countSuffix: "actions in the queue",
  taskCountSuffix: "tasks need you today",

  /** The day bucket for an item whose `due_at` could not be read. Never dated by us. */
  dayUnknown: "Due date not recorded",

  // ── The expanded `ACTION_MANDATORY` task ──
  //
  // One disclosure, on the one trigger whose news is that *not* acting is the news. The
  // ranking behind it is a claim about the recommendation, so it sits behind a press
  // rather than beside every task.
  detailToggle: "Why this can't wait",
  detailVerb: "What acting on this looks like",
  detailAdvisory: "Advisory only — there is no channel to open for this one.",

  /**
   * No *ranked recommendation* exists, and what would put one here.
   *
   * The sentence is unchanged and still precise — the ranked read holds live
   * recommendations, and an empty one means nothing is ranked. It also says where ranked
   * prospects come from, which is the reader's actual next step: only a prospect with
   * intelligence active is ever evaluated, so an empty ranking on a workspace full of
   * enriched prospects is a workspace that has not activated any of them.
   *
   * **The key is `emptyRankedOnly` because that is the narrower claim it makes.** A
   * missing ranking is one of nine reasons a prospect can need attention, and the
   * checklist's own empty state — nothing needs you at all — is
   * `ATTENTION_LABELS.empty` in `labels.ts`. Named `empty`, this sentence read like the
   * general answer and would have been reached for as one; named for what it is about,
   * it cannot be. `emptyFiltered` is untouched: a filter that matches nothing is a
   * statement about the filter either way. Both now speak for the expanded task, which
   * is the only place the ranked read is presented.
   */
  emptyRankedOnly:
    "No actions need your attention right now. This queue fills with prospects whose intelligence is active — activate one in Prospect Intelligence and its recommendation appears here.",
  emptyFiltered: "No live recommendations match this filter.",
  loadFailedTitle: "Couldn't load the action queue",
  refreshedToast: "Action queue refreshed",
  refreshFailedToast: "Couldn't refresh the action queue",

  /** Where the row's reasoning actually lives, since the queue row does not carry it. */
  reasoningElsewhere: "The full scoring terms are on the prospect's own page.",
} as const;

/** The default page size of the ranked read — the server's own default. */
export const ACTION_QUEUE_PAGE_SIZE = 25;

/** The checklist's window and cap, which are the route's own defaults, stated once. */
export const ATTENTION_PERIOD_DAYS = 7;
export const ATTENTION_FEED_LIMIT = 50;

/** One row's test hook, keyed by the prospect, so a checklist of tasks is addressable. */
export function queueRowTestId(leadId: string): string {
  return `gtm-action-queue-row-${leadId}`;
}

/**
 * The ordering, from the URL. `priority` for anything else, which is the route's own
 * default — an unreadable parameter must not become a second ordering.
 */
export function readSortParam(raw: string | null): ActionQueueSort {
  return raw === "recency" ? "recency" : "priority";
}

/**
 * The channel filter, from the URL, validated against the label table.
 *
 * The table is the vocabulary: `CHANNEL_LABEL` is keyed by the three `ChannelKey`
 * values, so guarding on it narrows the string without this file spelling the value
 * set out a fourth time. A value the table does not carry is dropped rather than sent
 * on to the server as a filter nothing can match.
 */
export function readChannelParam(raw: string | null): ChannelKey | null {
  return raw && raw in CHANNEL_LABEL ? (raw as ChannelKey) : null;
}

/** The action-type filter, guarded the same way against `GTM_NBA_ACTION_LABELS`. */
export function readActionTypeParam(raw: string | null): CandidateActionType | null {
  return raw && raw in GTM_NBA_ACTION_LABELS ? (raw as CandidateActionType) : null;
}

/**
 * The one text an `ObservedFact` reduces to inside a composed sentence.
 *
 * `ObservedValue` is the only thing allowed to *render* a fact, and it renders a
 * labelled slot — which a task line is not. So the task label borrows that component's
 * one spelling of absence rather than inventing a second: a prospect nobody observed a
 * name for reads "Unknown", never an empty gap and never a lead id.
 */
function factText(fact: ObservedFact): string {
  if (fact.isUnknown || fact.value == null) return UNKNOWN_TEXT;
  return String(fact.value);
}

/**
 * One task, in the R11.2 form: prospect, the trigger's reason clause, the response.
 *
 * `${prospectName} ${reason}${taskSeparator}${requiredResponse}` — "Kerri replied to
 * your message → Review and respond". The middle clause is the server's prose and the
 * arrow is `ATTENTION_LABELS.taskSeparator`, which carries its own spaces; runs of
 * whitespace are collapsed so the string a reader hears is the string a test can write,
 * and so an item with an empty clause does not read with a hole in it.
 *
 * This is the whole accessible name of the task's control (R11.10), which is why it is a
 * function rather than four spans: the name has to be one string, composed once.
 */
export function taskLabel(item: AttentionItem): string {
  const parts = `${factText(item.prospectName)} ${item.reason}${ATTENTION_LABELS.taskSeparator}${item.requiredResponse}`;
  return parts.replace(/\s+/g, " ").trim();
}

/**
 * `due_at`'s calendar day in the reader's own timezone, as `YYYY-MM-DD`.
 *
 * Local rather than UTC because `Today` and `Yesterday` are claims about the reader's
 * day, and a rep in Mumbai reading a 21:00 UTC event must not be told it happened
 * tomorrow. An unreadable instant yields `""` — its own bucket, never today's.
 */
export function dayKeyOf(iso?: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return calendarDayKey(at);
}

function calendarDayKey(at: Date): string {
  const month = `${at.getMonth() + 1}`.padStart(2, "0");
  const day = `${at.getDate()}`.padStart(2, "0");
  return `${at.getFullYear()}-${month}-${day}`;
}

/**
 * The group heading for a day key: `Today`, `Yesterday`, or the date itself (R11.3).
 *
 * There is no "3 days ago" heading. A date is unambiguous and a rounded interval is not,
 * and the two relative headings are the only ones a reader never has to convert.
 *
 * `now` is a parameter so the boundary is testable without a clock stub. Yesterday is
 * computed by stepping the calendar date rather than by subtracting 24 hours, which is
 * the same day twice on a DST fall-back and the wrong day on a spring-forward.
 */
export function dayHeadingOf(dayKey: string, now: Date = new Date()): string {
  if (!dayKey) return ACTION_QUEUE_LABELS.dayUnknown;
  if (dayKey === calendarDayKey(now)) return ATTENTION_LABELS.today;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey === calendarDayKey(yesterday)) return ATTENTION_LABELS.yesterday;
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** One day's tasks, in the order the server sent them. */
export interface AttentionDayGroup {
  /** The local calendar day, `YYYY-MM-DD`, or `""` for an unreadable `due_at`. */
  day: string;
  heading: string;
  items: AttentionItem[];
}

/**
 * The feed's items bucketed by their due day, newest day first (R11.3, R11.4).
 *
 * Two orderings, and only one of them is ours. The *days* are sorted — descending, so
 * today heads the page and the undated bucket ("" sorts below every date) sits last.
 * The *items inside a day* are appended in arrival order and never touched, because the
 * feed already returns them by `consequence_tier` and re-sorting here would replace the
 * server's answer with a second opinion about the same question.
 *
 * Every item lands in exactly one group and no item is dropped: an unreadable `due_at`
 * gets a bucket that says so rather than being silently filed under today.
 */
export function groupByDueDay(
  items: AttentionItem[],
  now: Date = new Date(),
): AttentionDayGroup[] {
  const byDay = new Map<string, AttentionItem[]>();
  for (const item of items) {
    const key = dayKeyOf(item.dueAt);
    const held = byDay.get(key);
    if (held) held.push(item);
    else byDay.set(key, [item]);
  }
  return [...byDay.keys()]
    .sort()
    .reverse()
    .map((day) => ({
      day,
      heading: dayHeadingOf(day, now),
      items: byDay.get(day) ?? [],
    }));
}

/** The tone each band wears. Decoration — `CONSEQUENCE_TIER_LABELS` carries the meaning. */
const TIER_TONE: Record<string, string> = {
  IMMEDIATE: "rose",
  MATERIAL: "amber",
  IMPORTANT: "sky",
  OTHER: "zinc",
};

// ─── One task ─────────────────────────────────────────────────────────────────

export interface AttentionTaskProps {
  item: AttentionItem;
  /** The group this task sits in, mirrored onto the row for a reader and for a scan. */
  day: string;
  /** The ranked row behind it, or the reason there isn't one. */
  overlay: OverlayState;
  /** The whole ranked read came back empty, which is a different statement per-item. */
  rankedEmpty: boolean;
  /** …and empty *because of the filter*, which is a statement about the filter. */
  rankedFiltered: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** One step to the prospect (R11.8). */
  onSelect: () => void;
  /** Re-read the ranked page the join comes from (R18.5). */
  onRetryDetail: () => void;
  /** Walk the ranked read's cursor, for a task the first page did not reach. */
  onLoadMoreDetail: () => void;
  canLoadMoreDetail: boolean;
  loadingMoreDetail: boolean;
}

/**
 * One `<li>`: the task as a `<button>`, its band, and — for `ACTION_MANDATORY` — the
 * ranking behind it behind a disclosure.
 *
 * The control's accessible name is the whole task string and nothing else (R11.10), set
 * as an `aria-label` so the visible line can be styled in four pieces without the name
 * changing shape. The band, the trigger and the due instant are `aria-describedby`, so a
 * screen reader hears the task first and its context second rather than a name with a
 * tier bolted onto the front.
 *
 * The disclosure is a sibling of the task control, never nested inside it: a task has one
 * primary action — go to the prospect — and reading the ranking is a second choice, not a
 * second meaning for the same press.
 */
function AttentionTask({
  item,
  day,
  overlay,
  rankedEmpty,
  rankedFiltered,
  expanded,
  onToggle,
  onSelect,
  onRetryDetail,
  onLoadMoreDetail,
  canLoadMoreDetail,
  loadingMoreDetail,
}: AttentionTaskProps) {
  const rowId = useId();
  const bandId = `${rowId}-band`;
  const detailId = `${rowId}-detail`;
  const label = taskLabel(item);
  const tier = CONSEQUENCE_TIER_LABELS[item.consequenceTier] ?? item.consequenceTier;
  const trigger = ATTENTION_TRIGGER_LABELS[item.trigger] ?? item.trigger;
  const mandatory = item.trigger === "ACTION_MANDATORY";

  return (
    <li
      data-testid={queueRowTestId(item.leadId)}
      data-consequence-tier={item.consequenceTier}
      data-attention-trigger={item.trigger}
      data-day={day}
      className="rounded-lg px-1 py-1.5 hover:bg-zinc-50/80"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        {/* The task. One press, one destination. */}
        <button
          type="button"
          aria-label={label}
          aria-describedby={bandId}
          onClick={onSelect}
          className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left text-[13px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <span aria-hidden="true" className="mr-1.5 text-zinc-300">
            ▸
          </span>
          <span className="font-semibold text-zinc-900">{factText(item.prospectName)}</span>{" "}
          <span className="text-zinc-700">{item.reason}</span>
          <span className="text-zinc-400">{ATTENTION_LABELS.taskSeparator}</span>
          <span className="font-medium text-violet-700">{item.requiredResponse}</span>
        </button>

        {/* The band, the trigger and when it became due. Text first, tone second: a
            reader who cannot see the colour still learns that something needs them now. */}
        <p id={bandId} className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <span
            className={cn(
              "rounded-full border px-1.5 py-0 text-[10px] font-semibold",
              TONE[TIER_TONE[item.consequenceTier] ?? "zinc"] ?? TONE.zinc,
            )}
          >
            {tier}
          </span>
          <span className={cn("rounded-full border px-1.5 py-0 text-[10px] font-semibold", TONE.zinc)}>
            {trigger}
          </span>
          <span>
            {ACTION_QUEUE_LABELS.dueLabel}
            {": "}
            {item.dueAt ? (
              <time dateTime={item.dueAt} title={absTime(item.dueAt)}>
                {relTime(item.dueAt)}
              </time>
            ) : (
              GTM_UI_LABELS.unavailableHeading
            )}
          </span>
        </p>
      </div>

      {/* An escalated band names where it came from and why, so the tier reads as
          re-derivable from the item rather than as a verdict. The server refuses a
          half-populated pair, so one check covers both. */}
      {item.escalatedFrom && item.escalationReason && (
        <p className="mt-0.5 pl-6 text-[11px] leading-relaxed text-slate-500">
          {ACTION_QUEUE_LABELS.escalatedFrom}
          {": "}
          {CONSEQUENCE_TIER_LABELS[item.escalatedFrom] ?? item.escalatedFrom}
          {" · "}
          {item.escalationReason}
        </p>
      )}

      {mandatory && (
        <div className="mt-1 pl-6">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={onToggle}
            className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
            {ACTION_QUEUE_LABELS.detailToggle}
          </button>

          {/* Rendered in both states and hidden when collapsed, so `aria-controls`
              always resolves to a real element. Hidden content is out of the
              accessibility tree, so the page still holds exactly one list region. */}
          <div id={detailId} hidden={!expanded} className="mt-1.5">
            <RankedDetail
              overlay={overlay}
              rankedEmpty={rankedEmpty}
              rankedFiltered={rankedFiltered}
              onRetryDetail={onRetryDetail}
              onLoadMoreDetail={onLoadMoreDetail}
              canLoadMoreDetail={canLoadMoreDetail}
              loadingMoreDetail={loadingMoreDetail}
            />
          </div>
        </div>
      )}
    </li>
  );
}

// ─── The ranked detail behind one mandatory task ──────────────────────────────

/**
 * `whyNow`, the four EPS dimensions and the `executionVerb`, from the joined row.
 *
 * Built from `<p>`s and `<div>`s rather than from a `<ul>` and a `<dl>`, which is not a
 * styling preference: R11.7 asks for one list region on the page and a nested list would
 * be a second one the moment this opened.
 *
 * There is no execution control here. The verb is *stated* — what acting on this looks
 * like — and the press that does it lives on the dossier, which is the one surface that
 * opens a channel and records a `CLICKED`.
 */
function RankedDetail({
  overlay,
  rankedEmpty,
  rankedFiltered,
  onRetryDetail,
  onLoadMoreDetail,
  canLoadMoreDetail,
  loadingMoreDetail,
}: {
  overlay: OverlayState;
  rankedEmpty: boolean;
  rankedFiltered: boolean;
  onRetryDetail: () => void;
  onLoadMoreDetail: () => void;
  canLoadMoreDetail: boolean;
  loadingMoreDetail: boolean;
}) {
  if (overlay.kind !== "row") {
    // Three absences, kept apart. `failed` is about us and earns a retry; `unknown`
    // means the ranked page we took was shorter than the queue, which another identical
    // read would answer identically — so what it earns is the next page. `none` on an
    // empty ranked read is the page-level sentence rather than the per-lead one, because
    // "nothing is ranked at all" is more use to the reader than "not this prospect".
    const sentence =
      overlay.kind === "none" && rankedEmpty
        ? rankedFiltered
          ? ACTION_QUEUE_LABELS.emptyFiltered
          : ACTION_QUEUE_LABELS.emptyRankedOnly
        : absenceSentence(overlay);
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-zinc-200 px-3 py-2">
        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-slate-600">{sentence}</p>
        {overlay.kind === "failed" && (
          <Button type="button" size="sm" variant="outline" onClick={onRetryDetail}>
            {GTM_PAGE_LABELS.retry}
          </Button>
        )}
        {overlay.kind === "unknown" && canLoadMoreDetail && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onLoadMoreDetail}
            disabled={loadingMoreDetail}
          >
            {loadingMoreDetail && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {ACTION_QUEUE_LABELS.loadMore}
          </Button>
        )}
      </div>
    );
  }

  const item: ActionQueueItem = overlay.item;
  const verb = item.executionVerb;

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
      {/* Why now: the signals whose effective strength carried the timing. A set of
          references, never a sentence composed here. */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {GTM_UI_LABELS.reasoningHeading}
        </p>
        {item.whyNow.length === 0 ? (
          <p className="mt-1 text-[12px] text-slate-500">{GTM_UI_LABELS.noReasoning}</p>
        ) : (
          <div className="mt-1 space-y-1">
            {item.whyNow.map((bullet, index) => {
              const when = relTime(bullet.eventTimestamp);
              const termLabel = bullet.term ? FACTOR_LABEL[bullet.term] ?? bullet.term : null;
              return (
                <p
                  key={`${index}-${bullet.signalId ?? bullet.signalType ?? "signal"}`}
                  className="flex gap-1.5 text-[12px] leading-relaxed text-slate-600"
                >
                  <span aria-hidden="true">·</span>
                  <span className="min-w-0">
                    {bullet.signalType ?? termLabel ?? ""}
                    {bullet.signalType && termLabel ? ` · ${termLabel}` : ""}
                    {when && (
                      <span title={absTime(bullet.eventTimestamp)} className="text-slate-500">
                        {` · ${when}`}
                      </span>
                    )}
                  </span>
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* The four EPS dimensions the ranking recorded. Each reads "High · 68" rather
          than "68": the band is the reading, the number is the audit trail, and an
          unread measure says so instead of banding to a zero. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {(
          [
            ["urgency", ACTION_QUEUE_LABELS.urgency, item.urgency],
            [
              "expected_success_probability",
              ACTION_CARD_LABELS.expectedOutcome,
              item.expectedSuccessProbability,
            ],
            ["business_value", ACTION_QUEUE_LABELS.businessValue, item.businessValue],
            ["signal_freshness", ACTION_QUEUE_LABELS.signalFreshness, item.signalFreshness],
          ] as const
        ).map(([key, label, raw]) => {
          const measure = measureParts(raw);
          return (
            <div key={key} className="min-w-0">
              <p
                title={MEASURE_MEANINGS[key]}
                className="cursor-help text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400"
              >
                {label}
              </p>
              <p className="mt-0.5 flex items-baseline gap-1.5">
                {measure.label === null ? (
                  <span className="text-[12px] text-slate-500">
                    {GTM_UI_LABELS.unavailableHeading}
                  </span>
                ) : (
                  <>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold",
                        TONE[measure.tone] ?? TONE.zinc,
                      )}
                    >
                      {measure.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-slate-500">{measure.value}</span>
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* The execution verb, as a statement. An advisory recommendation — WAIT,
          RESEARCH_MORE — is a real recommendation that simply has no channel, and it
          says that rather than rendering an empty slot. */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {ACTION_QUEUE_LABELS.detailVerb}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-700">
          {verb
            ? GTM_ACTION_LABEL_BY_TYPE[verb] ?? verb
            : ACTION_QUEUE_LABELS.detailAdvisory}
        </p>
      </div>

      {/* When the ranking stops being live, where its scoring terms are, and — because
          this is the one place a queue instant is presented — when it was computed. */}
      <p className="text-[11px] text-slate-500">
        {GTM_UI_LABELS.computed}
        {": "}
        {item.computedAt ? (
          <time dateTime={item.computedAt} title={absTime(item.computedAt)}>
            {relTime(item.computedAt)}
          </time>
        ) : (
          GTM_UI_LABELS.unavailableHeading
        )}
        {item.expiresAt && (
          <>
            {" · "}
            {ACTION_QUEUE_LABELS.expires}
            {": "}
            <time dateTime={item.expiresAt} title={absTime(item.expiresAt)}>
              {relTime(item.expiresAt)}
            </time>
          </>
        )}
      </p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        {ACTION_QUEUE_LABELS.reasoningElsewhere}
      </p>
    </div>
  );
}

// ─── Loading placeholder, in the page's real geometry ─────────────────────────

function TaskSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <Skeleton className="h-3.5 w-[28rem] max-w-full" />
      <Skeleton className="h-4 w-24 rounded-full" />
    </div>
  );
}

// ─── The page ─────────────────────────────────────────────────────────────────

export default function GTMActionQueue() {
  // The space is the brand: the same id `evaAPI` sends as `brand_id`.
  const { spaceId } = useParams<{ spaceId: string }>();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();

  const brandId = spaceId ?? "";
  const sort = readSortParam(search.get("sort"));
  const channel = readChannelParam(search.get("channel"));
  const actionType = readActionTypeParam(search.get("action_type"));

  // ── The checklist ──
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── The ranked read, joined by `leadId` for an expanded mandatory task ──
  //
  // Held apart from the checklist on purpose: it is a secondary read and it is never
  // allowed to take the list down. A failure here is a sentence inside one disclosure.
  const [ranked, setRanked] = useState<QueueOverlay | null>(null);
  const [rankedFailed, setRankedFailed] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  /** Which mandatory task is expanded, by lead. One at a time, like the dossier's bands. */
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  // The balance, in chrome, from the provider that already wraps `Routes` (R17.1). No
  // credit is spent on this page, so there is nothing to refresh it after and no price to
  // render — the balance is chrome, not a price. Rendered unconditionally:
  // `CreditBalanceBadge` is what decides that an unread balance shows nothing, and a
  // `balance && …` guard here would hide a genuine 0 (R17.7).
  const { balance } = useCredits();

  /**
   * The monotonic request counters from `GTMProspect.tsx`, one per read. Every read
   * takes a ticket; a response holding a superseded ticket is dropped rather than
   * allowed to overwrite a newer one — which is what keeps a slow read from landing on
   * top of the one the operator asked for afterwards.
   */
  const feedRef = useRef(0);
  const rankedRef = useRef(0);

  /**
   * The checklist. One read, and the only read that decides what is on the page.
   *
   * `force` is the operator pressing refresh: it keeps the tasks on screen while the
   * request is in flight and toasts either way, exactly as `GTMProspect.load` does.
   * There is no `silent` mode and no timer calling this — a checklist that reordered
   * itself while somebody worked down it would be worse than a stale one.
   */
  const loadFeed = useCallback(
    async (force: boolean) => {
      if (!brandId) {
        setLoading(false);
        return;
      }
      const my = ++feedRef.current;
      setError(null);
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        const feed = await gtmAPI.getAttentionFeed(brandId, {
          periodDays: ATTENTION_PERIOD_DAYS,
          limit: ATTENTION_FEED_LIMIT,
        });
        if (my !== feedRef.current) return;
        // The server's order, kept. The grouping below buckets it and never re-sorts it.
        setItems(feed.items);
        if (force) toast.success(ACTION_QUEUE_LABELS.refreshedToast);
      } catch (e) {
        if (my !== feedRef.current) return;
        setError(e instanceof Error ? e.message : ATTENTION_LABELS.loadFailed);
        if (force) toast.error(ACTION_QUEUE_LABELS.refreshFailedToast);
        // No partial list assembled from another source: the feed is the list, so a
        // failed feed shows no list at all (§13.3).
        else setItems([]);
      } finally {
        if (my === feedRef.current) {
          if (force) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [brandId],
  );

  useEffect(() => {
    void loadFeed(false);
  }, [loadFeed]);

  /**
   * The one ranked read, joined onto the checklist by lead id.
   *
   * It cannot add a task and it is never consulted about which prospects are listed
   * (R11.5). `complete` is what keeps the absence honest: a lead missing from a page we
   * read to the end has no live recommendation, and a lead missing from a truncated page
   * is simply a lead we did not look at.
   */
  const loadRanked = useCallback(async () => {
    if (!brandId) {
      setRanked(null);
      setRankedFailed(false);
      return;
    }
    const my = ++rankedRef.current;
    setRankedFailed(false);
    setMoreError(null);
    try {
      const page = await gtmAPI.getActionQueue(brandId, {
        sort,
        limit: ACTION_QUEUE_PAGE_SIZE,
        channel,
        actionType,
      });
      if (my !== rankedRef.current) return;
      setRanked({
        byLead: new Map(page.items.map((row) => [row.leadId, row])),
        complete: !page.hasMore,
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      if (my !== rankedRef.current) return;
      setRanked(null);
      setRankedFailed(true);
      setCursor(null);
      setHasMore(false);
    }
  }, [actionType, brandId, channel, sort]);

  useEffect(() => {
    void loadRanked();
  }, [loadRanked]);

  /**
   * The next page of the ranked read, in `SignalList`'s cursor idiom.
   *
   * It widens the join and nothing else: every row lands in `byLead`, no row becomes a
   * task, and the checklist above is untouched. A lead already held is skipped rather
   * than replaced — a keyset walk should not overlap, and if it ever does the first
   * answer is the one the page has been showing.
   */
  const loadMoreRanked = useCallback(async () => {
    if (!cursor) return;
    const my = rankedRef.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await gtmAPI.getActionQueue(brandId, {
        sort,
        limit: ACTION_QUEUE_PAGE_SIZE,
        cursor,
        channel,
        actionType,
      });
      if (my !== rankedRef.current) return;
      setRanked((held) => {
        const byLead = new Map(held?.byLead ?? []);
        for (const row of page.items) if (!byLead.has(row.leadId)) byLead.set(row.leadId, row);
        return { byLead, complete: !page.hasMore };
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (e) {
      if (my !== rankedRef.current) return;
      setMoreError(e instanceof Error ? e.message : ACTION_QUEUE_LABELS.loadMoreFailed);
    } finally {
      if (my === rankedRef.current) setLoadingMore(false);
    }
  }, [actionType, brandId, channel, cursor, sort]);

  /** The ordering, written to the URL so the view is linkable and the back button works. */
  const onSort = useCallback(
    (next: ActionQueueSort) => {
      const params = new URLSearchParams(search);
      params.set("sort", next);
      setSearch(params);
    },
    [search, setSearch],
  );

  /** Drops both filters and keeps the ordering. */
  const onClearFilters = useCallback(() => {
    const params = new URLSearchParams(search);
    params.delete("channel");
    params.delete("action_type");
    setSearch(params);
  }, [search, setSearch]);

  /**
   * Selecting a task lands on its prospect, in one step (R11.8).
   *
   * `item.route` is the server's string and is followed as sent — the endpoint owns
   * where a task goes. The fallback exists for a payload that carried none, and it is
   * the same destination that route names, built from the two ids the item already has,
   * so a task is never a control that does nothing.
   */
  const onSelect = useCallback(
    (item: AttentionItem) => {
      if (item.route) {
        navigate(item.route);
        return;
      }
      navigate(
        `/prospect-intelligence/${encodeURIComponent(brandId)}?lead_id=${encodeURIComponent(item.leadId)}`,
      );
    },
    [brandId, navigate],
  );

  /**
   * What the live region says.
   *
   * The page's own two states are announcements about the page. Otherwise it is a count
   * of the tasks the server sent — a count of what is on screen, computed on render and
   * held nowhere, which is what keeps R20.4 true here.
   */
  const statusText = useMemo(() => {
    if (loading && items.length === 0) return ACTION_QUEUE_LABELS.statusLoading;
    if (refreshing) return ACTION_QUEUE_LABELS.statusRefreshing;
    if (items.length === 0) return "";
    return `${items.length} ${ACTION_QUEUE_LABELS.taskCountSuffix}`;
  }, [items.length, loading, refreshing]);

  const groups = useMemo(() => groupByDueDay(items), [items]);

  const filters = useMemo(() => {
    const named: string[] = [];
    if (channel) named.push(CHANNEL_LABEL[channel] ?? channel);
    if (actionType) named.push(GTM_NBA_ACTION_LABELS[actionType] ?? actionType);
    return named;
  }, [actionType, channel]);

  /** The ranked read landed, reached the end, and held nothing. */
  const rankedEmpty = Boolean(ranked && ranked.complete && ranked.byLead.size === 0);

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
              <ListChecks className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {GTM_PAGE_LABELS.eyebrow}
              </span>
              {/* The page's single `<h1>`, present in every state. It is the promise the
                  surface makes rather than a noun for a container. */}
              <h1 className="truncate text-sm font-semibold text-zinc-900">
                {ATTENTION_LABELS.pageTitle}
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
            <CreditBalanceBadge balance={balance} className="hidden sm:inline-flex" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full border-zinc-200 text-xs"
              onClick={() => {
                void loadFeed(true);
                void loadRanked();
              }}
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
          <div className="mx-auto w-full max-w-[1100px] space-y-4 px-6 pb-10 pt-6 lg:px-8">
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="min-w-0 max-w-[60ch] text-[11px] leading-relaxed text-slate-500">
                  {ACTION_QUEUE_LABELS.detailScope}
                </p>

                {/* The ordering. Two real buttons with `aria-pressed`, so the current
                    ordering is announced rather than only shown as a filled chip. */}
                <div
                  role="group"
                  aria-label={ACTION_QUEUE_LABELS.sortLabel}
                  className="flex shrink-0 items-center gap-1.5"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={sort === "priority" ? "default" : "outline"}
                    aria-pressed={sort === "priority"}
                    onClick={() => onSort("priority")}
                  >
                    {ACTION_CARD_LABELS.priority}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sort === "recency" ? "default" : "outline"}
                    aria-pressed={sort === "recency"}
                    onClick={() => onSort("recency")}
                  >
                    {ACTION_QUEUE_LABELS.sortRecency}
                  </Button>
                </div>
              </div>

              {/* A filtered ranked read says so, and offers the way out. A dashboard
                  statement links in here with a filter, and an operator who followed that
                  link must not read a filtered detail read as the whole ranking. */}
              {filters.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-zinc-800">
                    {ACTION_QUEUE_LABELS.filteredBy}
                    {": "}
                  </span>
                  {filters.map((name) => (
                    <span
                      key={name}
                      className={cn("rounded-full border px-2 py-0 text-[10px] font-semibold", TONE.zinc)}
                    >
                      {name}
                    </span>
                  ))}
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onClearFilters}>
                    {ACTION_QUEUE_LABELS.clearFilters}
                  </Button>
                </p>
              )}

              {!brandId ? (
                // Nothing to retry: the route is missing the brand it needs.
                <Alert className="mt-4">
                  <AlertTitle as="h2">{ACTION_QUEUE_LABELS.loadFailedTitle}</AlertTitle>
                  <AlertDescription>{GTM_PAGE_LABELS.noLeadBody}</AlertDescription>
                </Alert>
              ) : loading && items.length === 0 ? (
                <div className="mt-2 divide-y divide-zinc-100" aria-busy="true">
                  <span className="sr-only">{ACTION_QUEUE_LABELS.statusLoading}</span>
                  <TaskSkeleton />
                  <TaskSkeleton />
                  <TaskSkeleton />
                </div>
              ) : error && items.length === 0 ? (
                // The feed could not be read, so there is no list — not a shorter one
                // built from somewhere else (§13.3). The retry is the next step (R18.5).
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle as="h2">{ATTENTION_LABELS.loadFailed}</AlertTitle>
                  <AlertDescription className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-[13px]">{error}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => void loadFeed(true)}>
                      {GTM_PAGE_LABELS.retry}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* A failed refresh with tasks still held: the alert sits above the
                      list, and the list stays. Stale-but-labelled beats empty. */}
                  {error && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertDescription className="flex flex-wrap items-center gap-3">
                        <span className="text-[13px]">{error}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => void loadFeed(true)}>
                          {GTM_PAGE_LABELS.retry}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {items.length === 0 ? (
                    <p className="mt-4 max-w-[70ch] text-[13px] leading-relaxed text-slate-600">
                      {ATTENTION_LABELS.empty}
                    </p>
                  ) : (
                    // The page's one list region (R11.6, R11.7), named because the order
                    // is meaning here. The day headings are `<li>`s so the whole
                    // checklist stays a single list rather than one list per day.
                    <ul aria-label={ATTENTION_LABELS.list} className="mt-4 space-y-1">
                      {groups.map((group) => (
                        <Fragment key={group.day || "undated"}>
                          <li data-day-heading={group.day} className="pt-3 first:pt-0">
                            <h2 className="border-b border-zinc-100 pb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                              {group.heading}
                            </h2>
                          </li>
                          {group.items.map((item) => (
                            <AttentionTask
                              key={`${item.leadId}-${item.trigger}`}
                              item={item}
                              day={group.day}
                              overlay={overlayFor(item.leadId, ranked, rankedFailed)}
                              rankedEmpty={rankedEmpty}
                              rankedFiltered={filters.length > 0}
                              expanded={expandedLeadId === item.leadId}
                              onToggle={() =>
                                setExpandedLeadId((held) =>
                                  held === item.leadId ? null : item.leadId,
                                )
                              }
                              onSelect={() => onSelect(item)}
                              onRetryDetail={() => void loadRanked()}
                              onLoadMoreDetail={() => void loadMoreRanked()}
                              canLoadMoreDetail={hasMore && Boolean(cursor)}
                              loadingMoreDetail={loadingMore}
                            />
                          ))}
                        </Fragment>
                      ))}
                    </ul>
                  )}

                  {moreError && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertDescription className="text-[13px]">{moreError}</AlertDescription>
                    </Alert>
                  )}
                  <span className="sr-only" role="status" aria-live="polite">
                    {loadingMore ? ACTION_QUEUE_LABELS.loadingMore : ""}
                  </span>
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
