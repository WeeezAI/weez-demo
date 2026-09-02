// components/gtm/IntentPanel.tsx
//
// Eleven intents, kept as eleven rows (R5.1, R5.5, R28.1, R28.3).
//
// The reason this panel exists is the reason the engine holds eleven records rather
// than one number: a hiring signal is not a buying signal, and collapsing them into
// "intent: 62" throws away the only part an operator can act on. So every type gets
// its own row, its own value, its own confidence and its own evaluation time.
//
// **A zero row is a row.** An intent nothing supports is materialised at value zero
// and confidence zero rather than left absent, and this panel renders it — never
// filters it out, never sorts it off the end into a "show more" (R5.5). That is what
// makes "no buying intent" readable *as* the absence of buying intent: the row is
// there, the number is 0, the confidence is 0, and the note beside it says nothing
// has been observed for that type. A missing row would read as "we didn't check",
// which is a different claim, and `evaluatedAt` is what tells the two apart — so
// where nothing has ever been evaluated the row says that instead.
//
// If the payload arrives short of eleven — an older cache, a partial read — the
// missing types are materialised here at zero/zero for the same reason the engine
// materialises them: eleven rows is the shape of the answer, and a shorter list
// would silently hide a type rather than report it as unsupported.
//
// **The value goes through `DerivedScore`.** R28.3 requires every state value to
// reach the screen through the existing primitives, so the number renders through
// `DerivedScore` with the intent's own name as its label. The payload this file
// hands it carries an empty `scoreDisclaimer`, which means no disclaimer is
// rendered: an intent value is a measure on the hundredths scale, not a
// prioritisation score, and it has no disclaimer of its own on the wire. This file
// composes none — inventing one is exactly what `DerivedScore`'s verbatim rule
// exists to prevent.
//
// Nothing here computes. `GTM_INTENT_LABELS` is a lookup and `relTime` is a format;
// the ordering is a sort over the numbers the server sent, with the label table's
// own order as the tie-break so the list is stable between reads. A type missing
// from the label table renders raw, which is this layer's convention: an unmapped
// key is a display gap, not a licence to invent a friendlier string.

import { useId, useMemo } from "react";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DerivedScore as DerivedScorePayload, Intent, IntentType } from "@/services/gtmAPI";
import { DerivedScore } from "./DerivedScore";
import { UNKNOWN_SR_NOTE } from "./ObservedValue";
import { GTM_INTENT_LABELS, GTM_UI_LABELS, TONE, absTime, relTime } from "./labels";

/**
 * The five strings this panel needs and `labels.ts` does not carry.
 *
 * Kept here in one exported object, in the shape `NextActionPanel.tsx`'s
 * `ACTION_CARD_LABELS` established, because `labels.ts` is closed for this feature.
 * They belong beside `GTM_UI_LABELS` and moving them there is a one-line change at
 * each use site.
 *
 * `noSupport` and `neverEvaluated` are the two halves R5.5 keeps apart: a type
 * nothing supports has been looked at and found unsupported, while a type with no
 * `evaluatedAt` has never been looked at. Both render at zero, and only the text
 * distinguishes them.
 */
export const INTENT_PANEL_LABELS = {
  title: "Intent by type",
  list: "Intent by type",
  note: "Eleven types, held separately. A hiring signal is not a buying signal, and neither is folded into the other.",
  noSupport: "Nothing observed for this intent",
  neverEvaluated: "Not evaluated yet",
  supportingSignals: "Supporting signals",
} as const;

/**
 * The eleven types, in the order `GTM_INTENT_LABELS` lists them.
 *
 * Used as the canonical set — a payload short of eleven is filled from here — and as
 * the sort's final tie-break, so two intents at the same value and the same
 * confidence do not swap places between reads.
 */
export const INTENT_TYPES = [
  "BUYING",
  "HIRING",
  "FUNDING",
  "EXPANSION",
  "PRODUCT_LAUNCH",
  "PAIN_PROBLEM",
  "RESEARCH",
  "COMPETITOR",
  "ENGAGEMENT",
  "CONVERSATION",
  "MEETING",
] as const satisfies readonly IntentType[];

/** `true` iff `INTENT_TYPES` covers `IntentType`. A missing member fails to compile. */
type Assert<T extends true> = T;
export type IntentTypesAreComplete = Assert<
  Exclude<IntentType, (typeof INTENT_TYPES)[number]> extends never ? true : false
>;

/** The canonical position of a type, for the sort's tie-break. */
const INTENT_ORDER: Record<string, number> = INTENT_TYPES.reduce<Record<string, number>>(
  (order, intentType, index) => {
    order[intentType] = index;
    return order;
  },
  {},
);

/**
 * The row for a type the payload did not carry, at zero value and zero confidence.
 *
 * The same materialisation the engine performs, done here so a short payload renders
 * eleven rows rather than hiding a type. `evaluatedAt` stays null, which is what
 * makes the row read "Not evaluated yet" rather than "Nothing observed": we do not
 * know that anyone looked.
 */
export function unsupportedIntent(intentType: IntentType): Intent {
  return {
    intentType,
    value: 0,
    confidence: 0,
    source: "DERIVED",
    evaluatedAt: null,
    decayRate: 0,
    signalIds: [],
    isDerived: true,
  };
}

/**
 * The intent's value in the shape `DerivedScore` renders.
 *
 * `scoreDisclaimer` is empty on purpose: an intent value carries none on the wire
 * because it is a measure and not a prioritisation number, and `DerivedScore` renders
 * the disclaimer verbatim or not at all. `scoreKind` never reaches the screen — the
 * intent's own label is passed explicitly — so the field is here to satisfy the
 * payload shape and nothing more.
 */
function intentScore(intent: Intent): DerivedScorePayload {
  return {
    score: intent.value,
    scoreKind: "RECOMMENDATION_SCORE",
    scoreDisclaimer: "",
    isDerived: true,
  };
}

/** A number as the server sent it, to two places when it has a fraction. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * All eleven rows, strongest first.
 *
 * Sorted on the numbers the server sent — value, then confidence — with the canonical
 * order as the last tie-break. No row is dropped and no threshold is applied: a
 * zero-confidence row sorts to the bottom and stays visible there.
 */
function orderedIntents(intents: Intent[]): Intent[] {
  const byType = new Map<string, Intent>();
  for (const intent of intents) {
    if (!byType.has(intent.intentType)) byType.set(intent.intentType, intent);
  }

  const rows = INTENT_TYPES.map((intentType) => byType.get(intentType) ?? unsupportedIntent(intentType));

  // Any type the payload carried that this build has never heard of still renders,
  // under its raw name, rather than being dropped for being unfamiliar. Read from the
  // deduplicated map, so a type appearing twice on the wire is still one row.
  for (const [intentType, intent] of byType) {
    if (!(intentType in INTENT_ORDER)) rows.push(intent);
  }

  return rows.sort((left, right) => {
    if (right.value !== left.value) return right.value - left.value;
    if (right.confidence !== left.confidence) return right.confidence - left.confidence;
    const leftIndex = INTENT_ORDER[left.intentType] ?? INTENT_TYPES.length;
    const rightIndex = INTENT_ORDER[right.intentType] ?? INTENT_TYPES.length;
    return leftIndex - rightIndex;
  });
}

export interface IntentPanelProps {
  /** `ProspectStateFull.intents` — the eleven records exactly as the server sent them. */
  intents: Intent[];
  className?: string;
}

export function IntentPanel({ intents, className }: IntentPanelProps) {
  const titleId = useId();
  const noteId = useId();
  const rows = useMemo(() => orderedIntents(intents ?? []), [intents]);

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Compass className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        {INTENT_PANEL_LABELS.title}
      </h2>
      <p id={noteId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {INTENT_PANEL_LABELS.note}
      </p>

      <ul
        className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
        aria-label={INTENT_PANEL_LABELS.list}
        aria-describedby={noteId}
      >
        {rows.map((intent) => {
          const label = GTM_INTENT_LABELS[intent.intentType] ?? intent.intentType;
          const unsupported = intent.value === 0 && intent.confidence === 0;
          const evaluated = Boolean(intent.evaluatedAt);

          return (
            <li
              key={intent.intentType}
              data-intent-type={intent.intentType}
              className={cn("min-w-0 rounded-md border px-3 py-2", TONE.zinc)}
            >
              {/* The value through the shared primitive (R28.3), labelled with the
                  type's own name so the number is never a standalone integer. */}
              <DerivedScore score={intentScore(intent)} label={label} size="sm" />

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {/*
                  Confidence, always rendered — including at zero, which is the whole
                  point of the row. The value beside it is a real measured 0 rather
                  than an absent fact, so a 0 here qualifies a number that exists.
                */}
                <span className={cn("rounded-full border px-1.5 py-0 text-[10px] font-semibold", TONE.zinc)}>
                  <span className="sr-only">{GTM_UI_LABELS.confidence}: </span>
                  {formatNumber(intent.confidence)}
                </span>

                {intent.signalIds.length > 0 && (
                  <span className="text-[11px] text-slate-500">
                    {INTENT_PANEL_LABELS.supportingSignals}
                    {": "}
                    {intent.signalIds.length}
                  </span>
                )}
              </div>

              {/*
                What the zero means, as real text rather than as a muted colour
                (R18.9). "Nothing observed for this intent" is a statement about the
                evidence; "Not evaluated yet" is a statement about us.
              */}
              {unsupported && (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {evaluated ? INTENT_PANEL_LABELS.noSupport : INTENT_PANEL_LABELS.neverEvaluated}
                </p>
              )}

              <p className="mt-0.5 text-[11px] text-slate-500">
                <span className="sr-only">{GTM_UI_LABELS.observed}: </span>
                {evaluated ? (
                  <time dateTime={intent.evaluatedAt as string} title={absTime(intent.evaluatedAt)}>
                    {relTime(intent.evaluatedAt)}
                  </time>
                ) : (
                  <>
                    {INTENT_PANEL_LABELS.neverEvaluated}
                    <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default IntentPanel;
