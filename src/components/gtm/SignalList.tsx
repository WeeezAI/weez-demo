// components/gtm/SignalList.tsx
//
// The facts the state was folded from, in the order they happened (R28.1, R28.3).
//
// Four rules govern this list, and three of them are rules about not helping.
//
// **The server owns the order.** `gtm_signals` is keyset-paged newest-first on the
// *event* timestamp — when the fact happened, not when it was read, so a backfill does
// not read as a surge. This component holds the pages in the order they arrive and
// sorts nothing: there is no comparator here and no `Date` arithmetic on a sort key.
// Each further page is strictly earlier, which is what `Load earlier signals` says.
//
// **An expired signal is still shown.** `include_expired` defaults true server-side
// and this component never overrides it: signals are retained for the lifetime of the
// prospect and stay queryable long after they stop influencing state. Retaining the
// record and retaining its influence are different things, and the difference is
// rendered rather than implied — an `atFloor` row carries a marker saying it now
// contributes its profile floor and nothing more, and its `effectiveStrength` shows
// what that floor is.
//
// **`effectiveStrength` is read, never recomputed.** The number is the product of
// strength, confidence, relevance and the freshness multiplier from the decay profile,
// recomputed server-side at request time. This file prints it. Deriving it in the
// browser would mean holding a second copy of the decay tables and getting a different
// answer the day one of them changes.
//
// **The type renders as the server sent it.** `labels.ts` carries no table for the 29
// `SignalType` values, and the convention when a label is missing is to render the raw
// value: an unmapped enum is a display gap, not a licence to invent a friendlier
// string. The gap is reported with this task rather than closed here, because
// `labels.ts` is closed for this feature.
//
// Structure and failure handling follow `ProspectTimeline`: this component fetches its
// own page, owns its own error with a retry, and renders an inline failure rather than
// taking the page down (R18.8). A list that cannot load must not cost the operator the
// next action.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import gtmAPI, { type Signal, type SignalType } from "@/services/gtmAPI";
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "./ObservedValue";
import { SURFACE_LABEL, TONE, absTime, relTime } from "./labels";

/**
 * The strings this list needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS`
 * established, because `labels.ts` is closed for this feature.
 *
 * `atFloor` and `atFloorNote` are the pair that keeps a retained signal from reading
 * as an influential one: the marker is visible text and the note says what "at floor"
 * costs, so neither claim depends on the row being greyer than its neighbours.
 */
export const SIGNAL_LIST_LABELS = {
  title: "Signals",
  list: "Signals observed for this prospect, newest first",
  note: "Ordered by when each fact happened. Expired signals are kept and shown — retained is not the same as still counting.",
  loading: "Loading signals",
  loadingEarlier: "Loading earlier signals",
  loadEarlier: "Load earlier signals",
  empty: "No signals recorded yet",
  retry: "Try again",
  loadFailed: "Couldn't load the signals",
  loadEarlierFailed: "Couldn't load earlier signals",
  effectiveStrength: "Effective strength",
  decayProfile: "Decay profile",
  expires: "Expires",
  atFloor: "At floor",
  atFloorNote: "Past its retention horizon — retained, contributing its profile floor and nothing more.",
  observedOn: "Observed on ",
} as const;

/**
 * How wide the observed instant is.
 *
 * A fact known to the day is not a fact known to the second, and the row says which,
 * so a relative time does not imply a precision the observation never had. `EXACT`
 * needs no note, which is why it carries an empty string and renders nothing.
 */
export const TIMESTAMP_PRECISION_LABELS: Record<string, string> = {
  EXACT: "",
  DAY: "Known to the day",
  WEEK: "Known to the week",
  MONTH: "Known to the month",
};

/** The default page size — the server's own default for this collection. */
export const SIGNAL_PAGE_SIZE = 25;

/** A number as the server sent it, to two places when it has a fraction. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export interface SignalRowProps {
  signal: Signal;
  className?: string;
}

/**
 * One `<li>`: what was observed, when it happened, what it is worth now, and whether it
 * still counts.
 *
 * The type is the raw enum value — the documented fallback for a key no label table
 * carries — and travels in `data-signal-type` as well, so a caller can address a row
 * without reading its text.
 */
export function SignalRow({ signal, className }: SignalRowProps) {
  const precisionNote = TIMESTAMP_PRECISION_LABELS[signal.eventTimestampPrecision] ?? "";

  return (
    <li
      className={cn("flex gap-3 py-3", className)}
      data-signal-type={signal.signalType}
      data-at-floor={signal.atFloor ? "true" : "false"}
    >
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          signal.atFloor ? "border-zinc-200 bg-zinc-50 text-slate-500" : "border-zinc-200 bg-white text-zinc-700",
        )}
      >
        <Radar className="h-3.5 w-3.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold text-zinc-900">{signal.signalType}</span>

          {signal.eventTimestamp && (
            <time
              dateTime={signal.eventTimestamp}
              title={absTime(signal.eventTimestamp)}
              className="text-[11px] font-medium text-slate-500"
            >
              {relTime(signal.eventTimestamp)}
            </time>
          )}
          {!signal.eventTimestamp && (
            <span className="text-[11px] font-medium text-slate-500">
              {UNKNOWN_TEXT}
              <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
            </span>
          )}

          {/* The marker is text, not a colour: an at-floor row has to read as one in a
              greyscale screenshot and to a screen reader (R18.9). */}
          {signal.atFloor && (
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", TONE.zinc)}>
              {SIGNAL_LIST_LABELS.atFloor}
            </span>
          )}
        </div>

        <p className="mt-0.5 text-[11px] text-slate-500">
          <span className="font-semibold text-zinc-800">{SIGNAL_LIST_LABELS.effectiveStrength}</span>
          {": "}
          <span className="font-semibold text-zinc-800">{formatNumber(signal.effectiveStrength)}</span>
          {" · "}
          {SIGNAL_LIST_LABELS.decayProfile}
          {": "}
          {signal.decayProfile ?? (
            <>
              {UNKNOWN_TEXT}
              <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
            </>
          )}
          {signal.expiresAt && (
            <>
              {" · "}
              {SIGNAL_LIST_LABELS.expires}
              {": "}
              <time dateTime={signal.expiresAt} title={absTime(signal.expiresAt)}>
                {relTime(signal.expiresAt)}
              </time>
            </>
          )}
        </p>

        {/* Provenance (R14.3): where the fact was seen. The payload behind it is
            deliberately not rendered — an evidence blob is not a body to print. */}
        <p className="mt-0.5 text-[11px] text-slate-500">
          <span className="sr-only">{SIGNAL_LIST_LABELS.observedOn}</span>
          {SURFACE_LABEL[signal.sourceSurface] ?? signal.sourceSurface}
          {precisionNote && (
            <>
              {" · "}
              {precisionNote}
            </>
          )}
        </p>

        {signal.atFloor && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{SIGNAL_LIST_LABELS.atFloorNote}</p>
        )}
      </div>
    </li>
  );
}

export interface SignalListProps {
  /** The brand that owns the prospect. Every GTM route is brand-scoped. */
  brandId: string;
  leadId: string;
  /** Signals per page. Defaults to the collection's own page size. */
  pageSize?: number;
  /** One type only, when a caller wants it. Absent means every type. */
  signalType?: SignalType | null;
  /**
   * Change to refetch from the newest signal — what the page does when a GTM
   * WebSocket event arrives or a silent refresh comes round.
   */
  refreshKey?: number | string;
  className?: string;
}

/**
 * The prospect's signals, newest first by event timestamp, paged backwards.
 *
 * `includeExpired` is never passed: the server's default keeps expired signals in the
 * answer, and excluding them would be this component deciding which retained facts the
 * operator may see.
 */
export function SignalList({
  brandId,
  leadId,
  pageSize = SIGNAL_PAGE_SIZE,
  signalType = null,
  refreshKey,
  className,
}: SignalListProps) {
  const titleId = useId();
  const [items, setItems] = useState<Signal[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [earlierError, setEarlierError] = useState<string | null>(null);

  // The monotonic request counter `ProspectTimeline` uses: a response from a
  // superseded request is dropped rather than allowed to overwrite a newer one.
  const reqRef = useRef(0);

  const loadNewest = useCallback(async () => {
    const req = ++reqRef.current;
    setLoading(true);
    setError(null);
    setEarlierError(null);
    try {
      const page = await gtmAPI.getSignals(brandId, leadId, {
        limit: pageSize,
        signalType: signalType ?? undefined,
      });
      if (req !== reqRef.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      if (req !== reqRef.current) return;
      setError(err instanceof Error ? err.message : SIGNAL_LIST_LABELS.loadFailed);
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, [brandId, leadId, pageSize, signalType]);

  useEffect(() => {
    void loadNewest();
  }, [loadNewest, refreshKey]);

  const loadEarlier = useCallback(async () => {
    if (!cursor) return;
    const req = reqRef.current;
    setLoadingEarlier(true);
    setEarlierError(null);
    try {
      const page = await gtmAPI.getSignals(brandId, leadId, {
        limit: pageSize,
        cursor,
        signalType: signalType ?? undefined,
      });
      if (req !== reqRef.current) return;
      setItems((held) => {
        const seen = new Set(held.map((signal) => signal.signalId));
        // Every signal in this page is earlier than everything already held, so it
        // goes on the end. An id already on screen is skipped rather than shown
        // twice — a keyset walk should not overlap, and if it ever does the operator
        // must not see one fact as two.
        return [...held, ...page.items.filter((signal) => !seen.has(signal.signalId))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      if (req !== reqRef.current) return;
      setEarlierError(err instanceof Error ? err.message : SIGNAL_LIST_LABELS.loadEarlierFailed);
    } finally {
      if (req === reqRef.current) setLoadingEarlier(false);
    }
  }, [brandId, cursor, leadId, pageSize, signalType]);

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Radar className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        {SIGNAL_LIST_LABELS.title}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{SIGNAL_LIST_LABELS.note}</p>

      {loading && items.length === 0 ? (
        <div className="mt-2" aria-busy="true">
          <span className="sr-only">{SIGNAL_LIST_LABELS.loading}</span>
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex gap-3 py-3">
              <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <Alert variant="destructive" role="alert" className="mt-3">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span className="text-[13px]">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void loadNewest()}>
              {SIGNAL_LIST_LABELS.retry}
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <p className="mt-2 py-3 text-[13px] text-slate-500">{SIGNAL_LIST_LABELS.empty}</p>
      ) : (
        <ol className="mt-2 divide-y divide-zinc-100" aria-label={SIGNAL_LIST_LABELS.list}>
          {items.map((signal) => (
            <SignalRow key={signal.signalId} signal={signal} />
          ))}
        </ol>
      )}

      {earlierError && (
        <Alert variant="destructive" role="alert" className="mt-3">
          <AlertDescription className="text-[13px]">{earlierError}</AlertDescription>
        </Alert>
      )}

      {/* Both conditions, not just `hasMore`: the cursor is what the next walk is made
          of, so without one there is nothing to load and a control that did nothing
          would be worse than no control. */}
      {hasMore && cursor && (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => void loadEarlier()} disabled={loadingEarlier}>
            {loadingEarlier && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {SIGNAL_LIST_LABELS.loadEarlier}
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {loadingEarlier ? SIGNAL_LIST_LABELS.loadingEarlier : ""}
          </span>
        </div>
      )}
    </section>
  );
}

export default SignalList;
