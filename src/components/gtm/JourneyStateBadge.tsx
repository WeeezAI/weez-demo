// components/gtm/JourneyStateBadge.tsx
//
// The 21-value journey projection, as one badge that never speaks for the record
// (R9.6, R9.2).
//
// The projection is a read-only function of the dimensions, recomputed on every read,
// with no persisted authoritative column behind it (R9.2). That is the whole reason
// this file is a badge and not a panel: it is a scannable summary of where a prospect
// stands, and the evidence lives in the dimension grid it sits beside. So the badge
// is rendered *in addition to* the grid — never in place of it, and never in place of
// any single dimension — and it says what it is in its own text:
//
//   • `GTM_UI_LABELS.computed` rides in front of the value as visible text, so the
//     badge cannot be mistaken for something that was observed.
//   • `GTM_UI_LABELS.displayOnlyNote` names the relationship out loud — this is a
//     display convenience and the dimensions carry their own evidence — and is
//     associated with the value through `aria-describedby` rather than left as a
//     tooltip. Where the surrounding panel already prints that note, `hideNote`
//     suppresses the duplicate and `describedBy` points at the copy that is there.
//
// Nothing here computes. The text is a `GTM_JOURNEY_LABELS` lookup over the value the
// server sent, and a value missing from that table renders raw rather than as a
// friendlier guess. An unobserved projection renders "Unknown" through the same two
// constants `ObservedValue` uses, so absence reads identically wherever it appears —
// never `NEW`, which is a real journey position and would be a plausible-looking lie.
//
// The tone comes from the shared `STATE_TONE` / `TONE` tables and is decoration: the
// text carries the meaning, and the icon is `aria-hidden` beside it (R18.9).

import { useId } from "react";
import { Route } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ObservedFact } from "@/services/gtmAPI";
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "./ObservedValue";
import { GTM_JOURNEY_LABELS, GTM_UI_LABELS, STATE_TONE, TONE } from "./labels";

export interface JourneyStateBadgeProps {
  /** `ProspectStateFull.journeyState` — the projection exactly as the server sent it. */
  journeyState: ObservedFact;
  /**
   * Suppress the display-only note where the surrounding panel prints it once itself,
   * as `StateDimensionGrid` does. Pass `describedBy` with it so the value stays
   * associated with the copy that is already on screen.
   */
  hideNote?: boolean;
  /** The id of an existing note to describe the value with when `hideNote` is set. */
  describedBy?: string;
  className?: string;
}

/**
 * The chip tone for a projection value.
 *
 * `zinc` for anything the shared table does not tone — thirteen of the twenty-one
 * journey values are journey-only — and `zinc` for an unknown projection, which must
 * not borrow the colour of a value a stale payload left in the slot.
 */
function toneFor(fact: ObservedFact): string {
  if (fact.isUnknown || fact.value == null) return TONE.zinc;
  return TONE[STATE_TONE[fact.value] ?? "zinc"] ?? TONE.zinc;
}

export function JourneyStateBadge({
  journeyState,
  hideNote = false,
  describedBy,
  className,
}: JourneyStateBadgeProps) {
  const ownNoteId = useId();
  const isUnknown = journeyState.isUnknown || journeyState.value == null;
  const noteId = hideNote ? describedBy : ownNoteId;

  return (
    <div className={cn("min-w-0", className)}>
      <span
        className={cn(
          "inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-0.5",
          toneFor(journeyState),
        )}
        aria-describedby={noteId}
      >
        <Route className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {/* The marker is visible text, not a colour and not a tooltip: the badge has
            to read as a computed summary even in a greyscale screenshot. */}
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-80">
          {GTM_UI_LABELS.computed}
        </span>
        {isUnknown ? (
          <span className="text-[12px] font-medium">
            {UNKNOWN_TEXT}
            <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
          </span>
        ) : (
          <span className="text-[12px] font-semibold">
            {GTM_JOURNEY_LABELS[journeyState.value as string] ?? journeyState.value}
          </span>
        )}
      </span>

      {!hideNote && (
        <p id={ownNoteId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {GTM_UI_LABELS.displayOnlyNote}
        </p>
      )}
    </div>
  );
}

export default JourneyStateBadge;
