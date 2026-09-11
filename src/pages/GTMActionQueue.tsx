// pages/GTMActionQueue.tsx
//
// The cross-prospect Action_Queue: one ranked list of the brand's live
// recommendations, worked top to bottom (R27.6, R27.7, R27.8, R28.7).
//
// This is `pages/GTMProspect.tsx` turned sideways. That page is one prospect and
// every read about it; this one is one recommendation per prospect and nothing else.
// The page shape is deliberately the same — `ConversationSidebar`, the sticky chrome
// `<header>` carrying the single `<h1>`, the `<main>` landmark, the monotonic
// `reqRef`, `loading` / `refreshing` / `error`, the inline `Alert` with a `Try again`
// — so the two screens fail the same way and a reader learns the idiom once.
//
// **The rows are `ActionCard`s.** R27.5 is explicit that the card extends
// `NextActionPanel` rather than being duplicated, and that rule does not stop at the
// prospect page: there is exactly one component in this product that opens a channel
// and records a `CLICKED`, and a queue with its own card would be a second place for
// the send rule to be got wrong. So `ActionCard` is imported from
// `components/gtm/NextActionPanel` and mounted once per row, unchanged.
//
// **The adapter, and why it is here.** `ActionCard` takes a `CandidateAction` and the
// queue returns an `ActionQueueItem` — two projections of the same
// `gtm_action_recommendations` row, one carrying the eleven scoring terms and the
// four-section explanation, the other carrying the banding inputs and the prospect's
// display fields. `queueItemToCandidateAction()` below is the one place the two meet.
// It moves fields across and invents none: the four fields the queue row does not
// carry (`terms`, `unavailableTerms`, `availableWeightMass`, the explanation's other
// three sections) are left empty rather than filled with plausible numbers, because a
// zero weight mass the queue never sent would be this page asserting a fact about the
// evaluation. What is empty here is *absent from the queue payload*, not absent from
// the evaluation — the prospect page reads the full ranking, and `Edit reasoning`
// navigates there rather than pretending the terms are on this row.
//
// **The tier is re-derivable, not an opaque badge.** R27.6 bands `priority_tier` from
// six inputs and every one of them travels on the row. Two of them — the
// Action_Confidence and the expected outcome — are rendered by `ActionCard` itself, so
// this page renders the other four beside it (`urgency`, `business_value`,
// `signal_freshness`, `relationship_state`) plus the `state_confidence` that is a
// different claim from the Action_Confidence and never folded into it. Between the
// card and the row, all six are on screen exactly once.
//
// **The queue is read-only.** `GET /gtm/action-queue` re-ranks nothing, and this page
// does not ask it to: there is no `refresh` parameter on the call, no re-evaluation on
// mount, and no background timer. A queue that re-ranked because somebody looked at it
// would reorder itself under the operator's cursor, so re-reading is an explicit
// control the operator presses — and the only thing it does is read.
//
// **Structure.** One `banner` (the chrome header) and one `main` (the scrolling
// content), the same two landmarks `GTMProspect` establishes and for the same reason:
// without the `main`, content-level `<header>`s resolve to a second banner. One `<h1>`
// present in every state, an `<h2>` on the queue section, and each `ActionCard`'s own
// `<h3>` inside its `<li>`. The list is a real `<ol>` with an accessible name — the
// order is the ranking, which is information — every control is a real `button`, and
// every status indicator carries text rather than only a tone.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ListOrdered, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import ConversationSidebar from "@/components/ConversationSidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  ActionQueueItem,
  ActionQueueSort,
  CandidateAction,
  CandidateActionType,
  ChannelKey,
} from "@/services/gtmAPI";
import gtmAPI from "@/services/gtmAPI";

import { CreditBalanceBadge } from "@/components/gtm/CreditBalance";
import { useCredits } from "@/hooks/useCredits";
import { JourneyStateBadge } from "@/components/gtm/JourneyStateBadge";
import { MEASURE_MEANINGS, measureParts } from "@/components/gtm/measure";
import {
  ACTION_CARD_LABELS,
  ActionCard,
  PRIORITY_TIER_LABELS,
} from "@/components/gtm/NextActionPanel";
import { ObservedValue } from "@/components/gtm/ObservedValue";
import {
  CHANNEL_LABEL,
  FIELD_LABEL,
  GTM_NBA_ACTION_LABELS,
  GTM_PAGE_LABELS,
  GTM_UI_LABELS,
  TONE,
  absTime,
  relTime,
} from "@/components/gtm/labels";

/**
 * The strings this page needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS` and
 * `SignalList.tsx`'s `SIGNAL_LIST_LABELS` established, because `labels.ts` was closed
 * by task 14.3 and adding to it now is out of scope. They belong there beside
 * `GTM_PAGE_LABELS`, and moving them is a one-line change at each use site.
 *
 * Everything already in `labels.ts` is taken from there rather than restated:
 * `GTM_PAGE_LABELS.eyebrow`, `.backToProspects`, `.retry`, `.entryAction`,
 * `GTM_UI_LABELS.computed`, `.confidence`, `.refresh`, `.viewProfile`,
 * `GTM_PRIORITY_TIER_LABELS` through `PRIORITY_TIER_LABELS`, `GTM_NBA_ACTION_LABELS`,
 * `CHANNEL_LABEL`, `FIELD_LABEL`.
 *
 * No entry states or implies that Weez sends anything. The only strings on this page
 * that name a channel are the tier and channel labels and the action titles, and the
 * titles come from `GTM_NBA_ACTION_LABELS`, which carries the `Open <channel> &
 * <verb>` form.
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

  // The banding inputs `ActionCard` does not render itself.
  urgency: "Urgency",
  businessValue: "Business value",
  signalFreshness: "Signal freshness",
  stateConfidence: "State confidence",

  expires: "Expires",

  // The ordering control. `ACTION_CARD_LABELS.priority` supplies the other option.
  sortLabel: "Order",
  sortRecency: "Most recent",

  // The filters a dashboard statement links in with (R28.6). Read from the URL and
  // named on screen, because a filtered list that does not say so is a misleading one.
  filteredBy: "Filtered by",
  clearFilters: "Show every action",

  // Paging, in `SignalList`'s idiom: the first page is the highest priority and each
  // further page ranks below it.
  loadMore: "Load more actions",
  loadingMore: "Loading more actions",
  loadMoreFailed: "Couldn't load more actions",

  // The page's own announcements. Statements about the page, never about a prospect.
  statusLoading: "Loading the action queue",
  statusRefreshing: "Refreshing the action queue",
  countSuffix: "actions in the queue",

  /**
   * Nothing needs attention, and what would put something here.
   *
   * The first sentence was already true and already precise — this queue holds live
   * recommendations, and an empty one means nothing is ranked. What it did not say is where
   * ranked prospects come from, which is the operator's actual next step: only a prospect
   * with intelligence active is ever evaluated, so an empty queue on a workspace full of
   * enriched prospects is a workspace that has not activated any of them.
   */
  empty:
    "No actions need your attention right now. This queue fills with prospects whose intelligence is active — activate one in Prospect Intelligence and its recommendation appears here.",
  emptyFiltered: "No live recommendations match this filter.",
  loadFailedTitle: "Couldn't load the action queue",
  refreshedToast: "Action queue refreshed",
  refreshFailedToast: "Couldn't refresh the action queue",

  /** Where the row's reasoning actually lives, since the queue row does not carry it. */
  reasoningElsewhere: "The full scoring terms are on the prospect's own page.",
} as const;

/** The default page size — the server's own default for this collection. */
export const ACTION_QUEUE_PAGE_SIZE = 25;

/** One row's test hook, keyed by the prospect, so a queue of rows is addressable. */
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
 * A number as the server sent it, to two places when it has a fraction.
 *
 * `ActionCard`'s and `SignalList`'s convention, repeated because it is a format and
 * not a computation: no band is derived from the number here, no percentage is
 * invented, and nothing is rounded into a claim.
 */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * One `ActionQueueItem`, as the `CandidateAction` `ActionCard` takes.
 *
 * Two projections of one `gtm_action_recommendations` row, so this is a rename and a
 * regrouping — there is no arithmetic in it and no field it fills in.
 *
 * What the queue row carries moves across as it is: the recommendation id the feedback
 * and lifecycle routes post against, the action type, the channel, the action score
 * with the disclaimer the engine persisted, the two confidences, and the `why_now`
 * bullets, which reach the card through `explanation` because that is where the card
 * reads them.
 *
 * What the queue row does *not* carry is left empty:
 *   `terms`, `unavailableTerms`  the eleven scoring terms. The card's reasoning
 *                                disclosure therefore has nothing to list, and the row
 *                                says where they are instead of showing a fabricated
 *                                set. `Edit reasoning` navigates to that page.
 *   `availableWeightMass`        0 is the type's floor and not a claim the card
 *                                renders; it is *not* on the queue payload, and the
 *                                comment is here so nobody later reads it as one.
 *   `whyThisChannel`,            the other three explanation sections. Composed once,
 *   `whyThisMessage`,            on the recommended row, and returned by the ranking
 *   `whyNotTheOtherChannels`     read rather than by the queue.
 *
 * `isRecommended` is true because the queue *is* the recommended rows —
 * `is_recommended = true AND expires_at > now` is the collection's own filter — and
 * `rank` is null because a rank within one prospect's evaluation is not this row's
 * position in a cross-prospect queue, and reusing the field would say it was.
 */
export function queueItemToCandidateAction(item: ActionQueueItem): CandidateAction {
  return {
    recommendationId: item.recommendationId ?? "",
    actionType: item.actionType,
    channel: item.channel,
    // The outreach translation crosses as it is, like every other carried field: both
    // payloads project the same `gtm_action_recommendations` row and the server answers
    // this question identically on each, so re-deriving it here would be a second opinion
    // about which verb an action takes.
    executionVerb: item.executionVerb,
    executable: item.executable,
    unexecutableReason: item.unexecutableReason,
    rank: null,
    isRecommended: true,
    actionScore: item.actionScore,
    actionConfidence: item.actionConfidence,
    stateConfidence: item.stateConfidence,
    terms: [],
    unavailableTerms: [],
    availableWeightMass: 0,
    exclusionReason: null,
    explanation: {
      whyNow: item.whyNow,
      whyThisChannel: [],
      whyThisMessage: null,
      whyNotTheOtherChannels: [],
      scope: null,
      versions: null,
    },
    expiresAt: item.expiresAt,
    computedAt: item.computedAt,
  };
}

// ─── One row ──────────────────────────────────────────────────────────────────

export interface ActionQueueRowProps {
  brandId: string;
  item: ActionQueueItem;
  /** What Contact Directly costs, from the server's price list. */
  contactPrice?: number | null;
  /** Opens the prospect's own page, which is where the full ranking lives. */
  onOpenProspect: (leadId: string) => void;
}

/**
 * One `<li>`: who the prospect is, what the tier was banded from, and the card.
 *
 * The identity is `ObservedValue`, which is the only thing allowed to render an
 * `ObservedFact` — so a prospect whose name was never observed reads "Unknown" here
 * rather than showing a lead id or an empty slot. The journey badge sits beside it as
 * the projection it is, carrying its own display-only note.
 */
function ActionQueueRow({
  brandId,
  item,
  contactPrice = null,
  onOpenProspect,
}: ActionQueueRowProps) {
  const action = useMemo(() => queueItemToCandidateAction(item), [item]);

  return (
    <li
      data-testid={queueRowTestId(item.leadId)}
      data-priority-tier={item.priorityTier}
      data-action-type={item.actionType}
      data-channel={item.channel ?? ""}
      className="py-4 first:pt-0 last:pb-0"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Who this is, and what the tier was banded from. */}
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <ObservedValue
              label={FIELD_LABEL.name}
              fact={item.name}
              variant="inline"
              hideProvenance
            />
            <ObservedValue
              label={FIELD_LABEL.company}
              fact={item.company}
              variant="inline"
              hideProvenance
            />
          </div>

          <ObservedValue
            label={FIELD_LABEL.headline}
            fact={item.headline}
            variant="inline"
            hideProvenance
          />

          <JourneyStateBadge journeyState={item.journeyState} />

          {/* Four of the six banding inputs, plus the state confidence the ranking
              trusted — a different claim from the Action_Confidence on the card, and
              never folded into it. The other two inputs are on the card.

              Each reads "High · 68" rather than "68". Four bare numbers in a row is the
              visual language of a monitoring console: a rep cannot tell whether 68 is
              urgent, and side-by-side integers imply a precision nobody should act on. The
              band is the reading, the number is the audit trail, and the label carries one
              plain sentence saying what the measure is about — see `measure.ts` for why the
              banding is the UI's own and why the number is never replaced. */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {(
              [
                ["urgency", ACTION_QUEUE_LABELS.urgency, item.urgency],
                ["business_value", ACTION_QUEUE_LABELS.businessValue, item.businessValue],
                [
                  "signal_freshness",
                  ACTION_QUEUE_LABELS.signalFreshness,
                  item.signalFreshness,
                ],
                [
                  "state_confidence",
                  ACTION_QUEUE_LABELS.stateConfidence,
                  item.stateConfidence,
                ],
              ] as const
            ).map(([key, label, raw]) => {
              const measure = measureParts(raw);
              return (
                <div key={key} className="min-w-0">
                  <dt
                    title={MEASURE_MEANINGS[key]}
                    className="cursor-help text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400"
                  >
                    {label}
                  </dt>
                  <dd className="mt-0.5 flex items-baseline gap-1.5">
                    {measure.label === null ? (
                      // Never a zero for an unread measure.
                      <span className="text-[12px] text-slate-500">
                        {GTM_UI_LABELS.unavailableHeading}
                      </span>
                    ) : (
                      <>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold",
                            TONE[measure.tone] ?? TONE.zinc
                          )}
                        >
                          {measure.label}
                        </span>
                        <span className="text-[11px] tabular-nums text-slate-500">
                          {measure.value}
                        </span>
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
            {/* The sixth input, and the only one of them that is an observed fact
                rather than a measure — so it renders through `ObservedValue` with its
                provenance rather than as a bare value. */}
            <ObservedValue
              label={FIELD_LABEL.relationship_state}
              fact={item.relationshipState}
              className="col-span-2"
            />
          </dl>

          {/* When the ranking was computed, and when it stops being live. Both are
              `<time>` with the absolute instant on the `title`, so a relative age is
              never the only reading available. */}
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

          {/* The entry into the prospect's own page, carrying `lead_id` under the
              existing `:spaceId` route parameter (R28.7). A real `button`, so it is
              reachable by keyboard and carries the shared focus ring. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenProspect(item.leadId)}
          >
            {GTM_PAGE_LABELS.entryAction}
          </Button>
        </div>

        {/* The card, unchanged. It renders the action title, the tier, the score with
            the engine's own disclaimer, the Action_Confidence, the channel, the
            expected outcome, the why-now bullets and the four controls. */}
        <div className="min-w-0">
          <ActionCard
            brandId={brandId}
            leadId={item.leadId}
            action={action}
            priorityTier={item.priorityTier}
            destinationUrl={item.profileUrl}
            expectedSuccessProbability={item.expectedSuccessProbability}
            contactPrice={contactPrice}
            onEditReasoning={() => onOpenProspect(item.leadId)}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            {ACTION_QUEUE_LABELS.reasoningElsewhere}
          </p>
        </div>
      </div>
    </li>
  );
}

// ─── Loading placeholder, in the page's real geometry ─────────────────────────

function RowSkeleton() {
  return (
    <div className="grid gap-3 py-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-2.5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-3 w-full" />
      </div>
      <div className="min-w-0 space-y-2 rounded-lg border border-zinc-200 bg-white p-3.5">
        <Skeleton className="h-3.5 w-52" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-8 w-40 rounded-md" />
      </div>
    </div>
  );
}

// ─── The page ─────────────────────────────────────────────────────────────────

export default function GTMActionQueue() {
  // The space is the brand: the same id `evaAPI` sends as `brand_id`.
  const { spaceId } = useParams<{ spaceId: string }>();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const queueTitleId = useId();

  const brandId = spaceId ?? "";
  const sort = readSortParam(search.get("sort"));
  const channel = readChannelParam(search.get("channel"));
  const actionType = readActionTypeParam(search.get("action_type"));

  const [items, setItems] = useState<ActionQueueItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The balance, read once. This page charges nothing itself — the cards do, through
  // `requestAction` — so there is nothing to refresh it after; a card that spends a credit
  // navigates the operator to the prospect page, which reads its own.
  const { balance, priceFor } = useCredits();
  const contactPrice = priceFor("CONTACT");
  const [moreError, setMoreError] = useState<string | null>(null);

  /**
   * The monotonic request counter from `GTMProspect.tsx`. Every read takes a ticket; a
   * response holding a superseded ticket is dropped rather than allowed to overwrite a
   * newer one — which is what keeps a slow unfiltered read from landing on top of a
   * filtered one the operator asked for afterwards.
   */
  const reqRef = useRef(0);

  /**
   * The one read this page makes.
   *
   * `force` is the operator pressing refresh: it keeps the rows on screen while the
   * request is in flight and toasts either way, exactly as `GTMProspect.load` does.
   * There is no `silent` mode and no timer calling this — see the header: a queue that
   * reordered itself while somebody worked down it would be worse than a stale one.
   */
  const load = useCallback(
    async (force: boolean) => {
      if (!brandId) {
        setLoading(false);
        return;
      }
      const my = ++reqRef.current;
      setError(null);
      setMoreError(null);
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        const page = await gtmAPI.getActionQueue(brandId, {
          sort,
          limit: ACTION_QUEUE_PAGE_SIZE,
          channel,
          actionType,
        });
        if (my !== reqRef.current) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        if (force) toast.success(ACTION_QUEUE_LABELS.refreshedToast);
      } catch (e) {
        if (my !== reqRef.current) return;
        setError(e instanceof Error ? e.message : ACTION_QUEUE_LABELS.loadFailedTitle);
        if (force) toast.error(ACTION_QUEUE_LABELS.refreshFailedToast);
        else setItems([]);
      } finally {
        if (my === reqRef.current) {
          if (force) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [actionType, brandId, channel, sort],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  /**
   * The next page, in `SignalList`'s cursor idiom.
   *
   * Every item in this page ranks below everything already held, so it goes on the
   * end. A lead already on screen is skipped rather than shown twice — a keyset walk
   * should not overlap, and if it ever does the operator must not work one
   * recommendation as two.
   */
  const loadMore = useCallback(async () => {
    if (!cursor) return;
    const my = reqRef.current;
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
      if (my !== reqRef.current) return;
      setItems((held) => {
        const seen = new Set(held.map((row) => row.leadId));
        return [...held, ...page.items.filter((row) => !seen.has(row.leadId))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (e) {
      if (my !== reqRef.current) return;
      setMoreError(e instanceof Error ? e.message : ACTION_QUEUE_LABELS.loadMoreFailed);
    } finally {
      if (my === reqRef.current) setLoadingMore(false);
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

  const onOpenProspect = useCallback(
    (leadId: string) => {
      navigate(
        `/relationship-intelligence/${encodeURIComponent(brandId)}?lead_id=${encodeURIComponent(leadId)}`,
      );
    },
    [brandId, navigate],
  );

  /**
   * What the live region says.
   *
   * The page's own two states are announcements about the page. Otherwise it is a
   * count of the rows the server returned — a count of facts, not a judgement about
   * any of them.
   */
  const statusText = useMemo(() => {
    if (loading && items.length === 0) return ACTION_QUEUE_LABELS.statusLoading;
    if (refreshing) return ACTION_QUEUE_LABELS.statusRefreshing;
    if (items.length === 0) return "";
    return `${items.length} ${ACTION_QUEUE_LABELS.countSuffix}`;
  }, [items.length, loading, refreshing]);

  const filters = useMemo(() => {
    const named: string[] = [];
    if (channel) named.push(CHANNEL_LABEL[channel] ?? channel);
    if (actionType) named.push(GTM_NBA_ACTION_LABELS[actionType] ?? actionType);
    return named;
  }, [actionType, channel]);

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
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {GTM_PAGE_LABELS.eyebrow}
              </span>
              {/* The page's single `<h1>`, present in every state. */}
              <h1 className="truncate text-sm font-semibold text-zinc-900">
                {ACTION_QUEUE_LABELS.pageTitle}
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
            {/* The balance, in chrome. Every card on this page carries a control that
                spends it, so the operator can see what they have before pressing one. */}
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
              aria-labelledby={queueTitleId}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={queueTitleId} className="text-sm font-semibold text-zinc-900">
                    {ACTION_QUEUE_LABELS.queueTitle}
                  </h2>
                  <p className="mt-1 max-w-[60ch] text-[11px] leading-relaxed text-slate-500">
                    {ACTION_QUEUE_LABELS.tierNote}
                  </p>
                </div>

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

              {/* A filtered queue says so, and offers the way out. A dashboard
                  statement links in here with a filter, and an operator who followed
                  that link must not read a filtered count as the whole queue. */}
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
                // Nothing to retry: the route is missing the brand it needs. `as="h2"`
                // would repeat this section's own level, so the alert titles below use
                // `h3` — the outline is h1 → h2 → h3 and never skips.
                <Alert className="mt-4">
                  <AlertTitle as="h3">{ACTION_QUEUE_LABELS.loadFailedTitle}</AlertTitle>
                  <AlertDescription>{GTM_PAGE_LABELS.noLeadBody}</AlertDescription>
                </Alert>
              ) : loading && items.length === 0 ? (
                <div className="mt-2 divide-y divide-zinc-100" aria-busy="true">
                  <span className="sr-only">{ACTION_QUEUE_LABELS.statusLoading}</span>
                  <RowSkeleton />
                  <RowSkeleton />
                </div>
              ) : error && items.length === 0 ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle as="h3">{ACTION_QUEUE_LABELS.loadFailedTitle}</AlertTitle>
                  <AlertDescription className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-[13px]">{error}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => void load(true)}>
                      {GTM_PAGE_LABELS.retry}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* A failed refresh with rows still held: the alert sits above the
                      list, and the list stays. Stale-but-labelled beats empty. */}
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

                  {items.length === 0 ? (
                    <p className="mt-4 text-[13px] text-slate-500">
                      {filters.length > 0
                        ? ACTION_QUEUE_LABELS.emptyFiltered
                        : ACTION_QUEUE_LABELS.empty}
                    </p>
                  ) : (
                    // An `<ol>` because the order is the ranking, and named because a
                    // list with no accessible name is a list a reader has to guess at.
                    <ol
                      aria-label={ACTION_QUEUE_LABELS.list}
                      className="mt-4 divide-y divide-zinc-100"
                    >
                      {items.map((item) => (
                        <ActionQueueRow
                          key={item.recommendationId ?? item.leadId}
                          brandId={brandId}
                          item={item}
                          contactPrice={contactPrice}
                          onOpenProspect={onOpenProspect}
                        />
                      ))}
                    </ol>
                  )}

                  {moreError && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertDescription className="text-[13px]">{moreError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Both conditions, not just `hasMore`: the cursor is what the next
                      walk is made of, so without one there is nothing to load and a
                      control that did nothing would be worse than no control. */}
                  {hasMore && cursor && (
                    <div className="mt-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void loadMore()}
                        disabled={loadingMore}
                      >
                        {loadingMore && (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        )}
                        {ACTION_QUEUE_LABELS.loadMore}
                      </Button>
                      <span className="sr-only" role="status" aria-live="polite">
                        {loadingMore ? ACTION_QUEUE_LABELS.loadingMore : ""}
                      </span>
                    </div>
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
