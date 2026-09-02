// components/gtm/StateHistoryPanel.tsx
//
// "What did Weez believe about this prospect on the fourth?" — answered from the
// record rather than reconstructed (R11.4, R28.1).
//
// Five rules govern this panel, and four of them are rules about not helping.
//
// **The picker and the pager read one response shape.** `getStateHistory` answers a
// cursor walk with a newest-first page, and it answers an `as_of` probe with the one
// snapshot in force at that instant — as a one-item page, same fields, same envelope.
// So there is one `StateHistoryPage` handler here and one render path, not a picker
// mode and a pager mode that drift apart. The probe simply narrows the page to one
// row; nothing about how a row is drawn changes.
//
// **Before the first snapshot the page is empty, and stays empty.** A probe earlier
// than the prospect's first recorded change comes back with no items, and this panel
// says so. It does not fall back to the earliest snapshot, because the earliest
// snapshot is what Weez believed *later* — showing it would answer a question about
// the fourth with a fact from the ninth. "The layer had no recorded belief then" is
// the true answer and the only one this panel will give.
//
// **The server owns the order.** `gtm_state_snapshots` is keyset-paged newest-first
// on `(recorded_at, id)`. This component holds the pages in the order they arrive and
// sorts nothing: no comparator, no `Date` arithmetic on a sort key. Each further page
// is strictly earlier, which is what `Load earlier snapshots` says.
//
// **The state blob is not a body.** Every snapshot carries `state` — the whole belief
// as it stood — and this panel renders none of it. What it renders is the snapshot
// *header*: when it was recorded, which version it is, which dimensions moved,
// the confidence, the journey projection, and the ids of the signal or action that
// triggered it. A serialised state object printed into the DOM would be a wall of
// keys nobody reads and a place for a server-supplied string to land on screen
// unreviewed. The header is what makes a history page legible without diffing two
// payloads, and it is enough.
//
// **Nothing here computes.** `DIMENSION_LABEL` and `GTM_JOURNEY_LABELS` are lookups,
// `relTime` / `absTime` are formats, and `isoFromLocalInput` is a parse of what the
// operator typed. A value missing from a label table renders raw — an unmapped key is
// a display gap, not a licence to invent a friendlier string.
//
// Structure and failure handling follow `SignalList` and `ProspectTimeline`: this
// component fetches its own page, owns its own error with a working retry, and renders
// an inline failure rather than taking the page down (R18.8). Every control is a real
// `<button>` or `<input>` with the shared focus-visible ring, and every status marker
// carries text rather than relying on its tone (R27.8, R18.9).

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { History, Loader2, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import gtmAPI, { type StateSnapshot } from "@/services/gtmAPI";
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "./ObservedValue";
import { DIMENSION_LABEL, GTM_JOURNEY_LABELS, GTM_UI_LABELS, TONE, absTime, relTime } from "./labels";

/**
 * The strings this panel needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS`
 * established and `SIGNAL_LIST_LABELS` followed, because `labels.ts` is closed for this
 * feature. They belong beside `GTM_UI_LABELS` and moving them there is a one-line
 * change at each use site.
 *
 * `emptyBeforeFirst` is the load-bearing one. It is the answer to a probe earlier than
 * the first recorded change, and it says what is absent — a recorded belief — rather
 * than offering the earliest snapshot as a near-enough substitute.
 */
export const STATE_HISTORY_LABELS = {
  title: "State history",
  list: "Recorded state snapshots, newest first",
  note: "One snapshot per applied state change, kept for the lifetime of the prospect. Nothing here is rewritten.",

  // The `as_of` picker.
  asOfLegend: "What did we believe at a moment?",
  asOfLabel: "Point in time",
  asOfApply: "Show what we believed then",
  asOfClear: "Back to the latest",
  asOfInvalid: "That isn't a time we can read. Pick a date and a time.",
  asOfApplied: "Showing the snapshot in force at ",
  asOfHint: "Answers with the one snapshot in force at that instant.",

  // Loading, failure, paging.
  loading: "Loading state history",
  loadingEarlier: "Loading earlier snapshots",
  loadEarlier: "Load earlier snapshots",
  retry: "Try again",
  loadFailed: "Couldn't load the state history",
  loadEarlierFailed: "Couldn't load earlier snapshots",

  // The two empties. They are different answers to different questions.
  empty: "No state snapshots recorded yet",
  emptyBeforeFirst:
    "No recorded belief at that moment. The first snapshot for this prospect is later than the time you picked, so there is nothing to show — and the earliest snapshot is not shown in its place, because that is what we believed afterwards.",

  // Snapshot header fields.
  version: "Version",
  changed: "Changed",
  noChanged: "No dimension change recorded on this snapshot",
  journey: "Journey",
  recorded: "Recorded",
  triggeringSignal: "Triggering signal",
  triggeringAction: "Triggering action",
  noTrigger: "No triggering signal or action recorded",
} as const;

/** The default page size — the server's own default for this collection. */
export const STATE_HISTORY_PAGE_SIZE = 25;

/**
 * The ISO-8601 instant behind what a `datetime-local` control holds, or null.
 *
 * A `datetime-local` value has no offset and is read in the operator's own zone, which
 * is the zone they typed it in. Null for anything unreadable — including the empty
 * string — so a malformed probe becomes a visible message rather than a request the
 * server has to reject.
 */
export function isoFromLocalInput(value: string): string | null {
  if (!value) return null;
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return null;
  return new Date(at).toISOString();
}

/** A number as the server sent it, to two places when it has a fraction. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export interface StateSnapshotRowProps {
  snapshot: StateSnapshot;
  className?: string;
}

/**
 * One `<li>`: the snapshot header, and deliberately nothing else.
 *
 * `snapshot.state` is in scope here and is never read. The header answers "when, which
 * version, what moved, how sure, where in the journey, and what triggered it", which is
 * the whole of what a history row is for.
 */
export function StateSnapshotRow({ snapshot, className }: StateSnapshotRowProps) {
  const changed = snapshot.changedDimensions ?? [];
  const journeyLabel = snapshot.journeyState
    ? GTM_JOURNEY_LABELS[snapshot.journeyState] ?? snapshot.journeyState
    : null;
  const hasTrigger = Boolean(snapshot.triggeringSignalId || snapshot.triggeringActionId);

  return (
    <li
      className={cn("flex gap-3 py-3", className)}
      data-snapshot-id={snapshot.snapshotId}
      data-state-version={snapshot.stateVersion}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700">
        <History className="h-3.5 w-3.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* The version is the snapshot's identity in the sequence, so it leads and
              carries its own name for a reader who cannot see the layout. */}
          <span className="text-[13px] font-semibold text-zinc-900">
            {STATE_HISTORY_LABELS.version} {snapshot.stateVersion}
          </span>

          {snapshot.recordedAt ? (
            <time
              dateTime={snapshot.recordedAt}
              title={absTime(snapshot.recordedAt)}
              className="text-[11px] font-medium text-slate-500"
            >
              <span className="sr-only">{STATE_HISTORY_LABELS.recorded}: </span>
              {relTime(snapshot.recordedAt)}
            </time>
          ) : (
            <span className="text-[11px] font-medium text-slate-500">
              <span className="sr-only">{STATE_HISTORY_LABELS.recorded}: </span>
              {UNKNOWN_TEXT}
              <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
            </span>
          )}

          {/* The projection as it stood, in words. Zinc for every value: the tone is
              decoration and the label carries the meaning (R18.9). */}
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              TONE.zinc,
            )}
          >
            <span className="sr-only">{STATE_HISTORY_LABELS.journey}: </span>
            {journeyLabel ?? (
              <>
                {UNKNOWN_TEXT}
                <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
              </>
            )}
          </span>

          <span className={cn("rounded-full border px-1.5 py-0 text-[10px] font-semibold", TONE.zinc)}>
            <span className="sr-only">{GTM_UI_LABELS.confidence}: </span>
            {formatNumber(snapshot.confidence)}
          </span>
        </div>

        {/* What moved in the change this snapshot records — the field that makes a
            history page readable without diffing two payloads. An empty list says so
            rather than rendering an empty row. */}
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          {changed.length > 0 ? (
            <>
              <span className="font-semibold text-zinc-800">{STATE_HISTORY_LABELS.changed}</span>
              {": "}
              {changed.map((dimension) => DIMENSION_LABEL[dimension] ?? dimension).join(", ")}
            </>
          ) : (
            STATE_HISTORY_LABELS.noChanged
          )}
        </p>

        {/* The ids behind the change, so a claim in this row is inspectable through the
            reads that already exist (R16.4). Neither present is stated, not implied. */}
        <p className="mt-0.5 break-all text-[11px] text-slate-500">
          {hasTrigger ? (
            <>
              {snapshot.triggeringSignalId && (
                <>
                  {STATE_HISTORY_LABELS.triggeringSignal}
                  {": "}
                  {snapshot.triggeringSignalId}
                </>
              )}
              {snapshot.triggeringSignalId && snapshot.triggeringActionId && " · "}
              {snapshot.triggeringActionId && (
                <>
                  {STATE_HISTORY_LABELS.triggeringAction}
                  {": "}
                  {snapshot.triggeringActionId}
                </>
              )}
            </>
          ) : (
            STATE_HISTORY_LABELS.noTrigger
          )}
        </p>
      </div>
    </li>
  );
}

export interface StateHistoryPanelProps {
  /** The brand that owns the prospect. Every GTM route is brand-scoped. */
  brandId: string;
  leadId: string;
  /** Snapshots per page. Defaults to the collection's own page size. */
  pageSize?: number;
  /**
   * Change to refetch from the newest snapshot — what the page does when a GTM
   * WebSocket event arrives or a silent refresh comes round.
   */
  refreshKey?: number | string;
  className?: string;
}

/**
 * The append-only state history, newest first, with an `as_of` probe over the same page.
 *
 * The probe is state, not a separate fetch path: setting it re-runs the one loader with
 * `asOf` attached, and clearing it re-runs the same loader without. That is why there is
 * a single `StateHistoryPage` handler and a single render below.
 */
export function StateHistoryPanel({
  brandId,
  leadId,
  pageSize = STATE_HISTORY_PAGE_SIZE,
  refreshKey,
  className,
}: StateHistoryPanelProps) {
  const titleId = useId();
  const asOfId = useId();
  const asOfHintId = useId();

  const [items, setItems] = useState<StateSnapshot[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [earlierError, setEarlierError] = useState<string | null>(null);

  /** What the picker holds, and what has actually been asked for. Two values. */
  const [asOfDraft, setAsOfDraft] = useState("");
  const [appliedAsOf, setAppliedAsOf] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  // The monotonic request counter `ProspectTimeline` uses: a response from a superseded
  // request is dropped rather than allowed to overwrite a newer one. Switching the probe
  // on and off is exactly the race it exists for.
  const reqRef = useRef(0);

  const loadNewest = useCallback(async () => {
    const req = ++reqRef.current;
    setLoading(true);
    setError(null);
    setEarlierError(null);
    try {
      const page = await gtmAPI.getStateHistory(brandId, leadId, {
        limit: pageSize,
        asOf: appliedAsOf ?? undefined,
      });
      if (req !== reqRef.current) return;
      // One handler for both answers: a cursor page and a one-item `as_of` page are the
      // same envelope, and an empty page is a real answer rather than a miss to paper
      // over.
      setItems(page.items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      if (req !== reqRef.current) return;
      setError(err instanceof Error ? err.message : STATE_HISTORY_LABELS.loadFailed);
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, [appliedAsOf, brandId, leadId, pageSize]);

  useEffect(() => {
    void loadNewest();
  }, [loadNewest, refreshKey]);

  const loadEarlier = useCallback(async () => {
    if (!cursor) return;
    const req = reqRef.current;
    setLoadingEarlier(true);
    setEarlierError(null);
    try {
      const page = await gtmAPI.getStateHistory(brandId, leadId, {
        limit: pageSize,
        cursor,
        asOf: appliedAsOf ?? undefined,
      });
      if (req !== reqRef.current) return;
      setItems((held) => {
        const seen = new Set(held.map((snapshot) => snapshot.snapshotId));
        // Every snapshot in this page is earlier than everything already held, so it
        // goes on the end. An id already on screen is skipped rather than shown twice —
        // a keyset walk should not overlap, and if it ever does the operator must not
        // read one recorded belief as two.
        return [...held, ...page.items.filter((snapshot) => !seen.has(snapshot.snapshotId))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      if (req !== reqRef.current) return;
      setEarlierError(err instanceof Error ? err.message : STATE_HISTORY_LABELS.loadEarlierFailed);
    } finally {
      if (req === reqRef.current) setLoadingEarlier(false);
    }
  }, [appliedAsOf, brandId, cursor, leadId, pageSize]);

  /** Apply the probe. An unreadable draft becomes a message, never a request. */
  const applyAsOf = useCallback(() => {
    const iso = isoFromLocalInput(asOfDraft);
    if (!iso) {
      setPickerError(STATE_HISTORY_LABELS.asOfInvalid);
      return;
    }
    setPickerError(null);
    setAppliedAsOf(iso);
  }, [asOfDraft]);

  /** Drop the probe and go back to the newest page. */
  const clearAsOf = useCallback(() => {
    setPickerError(null);
    setAsOfDraft("");
    setAppliedAsOf(null);
  }, []);

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <History className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        {STATE_HISTORY_LABELS.title}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{STATE_HISTORY_LABELS.note}</p>

      {/* The `as_of` picker. A native date-time control and real buttons, so the whole
          group is keyboard-operable with the shared focus-visible ring and needs no
          custom key handling (R27.8). */}
      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-[11px] font-semibold text-zinc-800">{STATE_HISTORY_LABELS.asOfLegend}</p>

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-0">
            <label htmlFor={asOfId} className="block text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
              {STATE_HISTORY_LABELS.asOfLabel}
            </label>
            <Input
              id={asOfId}
              type="datetime-local"
              value={asOfDraft}
              aria-describedby={asOfHintId}
              aria-invalid={pickerError ? true : undefined}
              onChange={(event) => {
                setAsOfDraft(event.target.value);
                setPickerError(null);
              }}
              className="mt-0.5 h-9 w-[15rem] text-[13px]"
            />
          </div>

          <Button size="sm" variant="outline" onClick={applyAsOf} disabled={!asOfDraft}>
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {STATE_HISTORY_LABELS.asOfApply}
          </Button>

          {appliedAsOf && (
            <Button size="sm" variant="ghost" onClick={clearAsOf}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {STATE_HISTORY_LABELS.asOfClear}
            </Button>
          )}
        </div>

        <p id={asOfHintId} className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          {STATE_HISTORY_LABELS.asOfHint}
        </p>

        {pickerError && (
          <p role="alert" className="mt-1 text-[11px] font-medium text-rose-700">
            {pickerError}
          </p>
        )}

        {/* What is on screen, as text: a narrowed history must not read like the whole
            history. Announced politely, because the operator asked for it. */}
        {appliedAsOf && (
          <p className="mt-1 text-[11px] font-medium text-zinc-800" role="status" aria-live="polite">
            {STATE_HISTORY_LABELS.asOfApplied}
            <time dateTime={appliedAsOf} title={absTime(appliedAsOf)}>
              {absTime(appliedAsOf)}
            </time>
          </p>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="mt-2" aria-busy="true">
          <span className="sr-only">{STATE_HISTORY_LABELS.loading}</span>
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
              {STATE_HISTORY_LABELS.retry}
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        // The two empties. With a probe applied, an empty page means the probe is
        // earlier than the first recorded change — and the earliest snapshot is
        // deliberately not offered in its place.
        <p className="mt-2 py-3 text-[13px] leading-relaxed text-slate-500">
          {appliedAsOf ? STATE_HISTORY_LABELS.emptyBeforeFirst : STATE_HISTORY_LABELS.empty}
        </p>
      ) : (
        <ol className="mt-2 divide-y divide-zinc-100" aria-label={STATE_HISTORY_LABELS.list}>
          {items.map((snapshot) => (
            <StateSnapshotRow key={snapshot.snapshotId} snapshot={snapshot} />
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
          would be worse than no control. An `as_of` page is one item and carries no
          cursor, which is what keeps the pager away on its own rather than by a second
          rule about which mode we are in. */}
      {hasMore && cursor && (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => void loadEarlier()} disabled={loadingEarlier}>
            {loadingEarlier && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {STATE_HISTORY_LABELS.loadEarlier}
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {loadingEarlier ? STATE_HISTORY_LABELS.loadingEarlier : ""}
          </span>
        </div>
      )}
    </section>
  );
}

export default StateHistoryPanel;
