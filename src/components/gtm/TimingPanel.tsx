// components/gtm/TimingPanel.tsx
//
// When to act, on the evidence — and what each part of that is allowed to claim
// (R28.1, R28.3).
//
// Three things in this payload are easy to over-read, and the panel is shaped around
// keeping them honest:
//
// **The window is an ideal, never a promise.** `idealNextActionWindowStart` /
// `...End` say when a touch is most likely to land given what we have observed. They
// are not a booking, not a deadline, and not a claim that anything will happen inside
// them. The caption says so in words, next to the window rather than in a tooltip, so
// the qualification survives a screenshot the way `DerivedScore`'s disclaimer does.
//
// **`withinBusinessHours: "UNKNOWN"` means no timezone resolved.** It does *not* mean
// "outside hours". Those are opposite claims — one is an absence of information about
// the prospect's clock, the other is a statement about it — so `UNKNOWN` collapses into
// `ObservedFact.isUnknown` in `derivedFact()` and renders through `ObservedValue`'s
// unknown branch, with a sentence beside it naming the confusion it is avoiding.
// `activityTrendFlag: "UNKNOWN"` collapses the same way for the same reason.
//
// **A null instant is an absence, not a zero and not "now".** No meaningful signal yet
// renders "Unknown", never a timestamp and never a dash standing in for one. A null
// `cooldownUntil` is the one absence with a positive meaning — no cooldown is set — and
// the row is omitted rather than made to claim either an unknown or a zero, which is
// the convention `ChannelIntelligencePanel` already applies to the same field.
//
// `signalFreshness` and `urgency` are numbers the engine derived, so they reach the
// screen through `DerivedScore` (R28.3) and arrive wearing the `derived` badge. The
// payload this file hands it carries an empty `scoreDisclaimer`, which means no
// disclaimer is rendered: neither number is a prioritisation score and neither carries
// a disclaimer on the wire, and composing one here is exactly what `DerivedScore`'s
// verbatim rule exists to prevent.
//
// Nothing here computes. The labels are dictionary lookups, `relTime` / `absTime` are
// formats, and `CONFIDENCE_LABEL` is deliberately unused because banding a number into
// "Low confidence" is a judgement this panel does not make.

import { type ReactNode, useId } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DerivedScore as DerivedScorePayload,
  ObservedFact,
  TimingState,
} from "@/services/gtmAPI";
import { DerivedScore } from "./DerivedScore";
import { ObservedValue, UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "./ObservedValue";
import { FIELD_LABEL, GTM_UI_LABELS, STATE_LABEL, TONE, absTime, relTime } from "./labels";

/**
 * The strings this panel needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `IntentPanel.tsx`'s `INTENT_PANEL_LABELS`
 * established, because `labels.ts` is closed for this feature. They belong beside
 * `GTM_UI_LABELS` / `FIELD_LABEL` and moving them there is a one-line change at each
 * use site.
 *
 * `windowNote` and `businessHoursUnknownNote` are the two that carry requirements
 * rather than chrome: the first says the window is an ideal, the second says an
 * unresolved timezone is not "outside hours".
 */
export const TIMING_PANEL_LABELS = {
  title: "Timing",
  note: "When a touch is most likely to land, read off the signals we hold.",
  windowNote:
    "An ideal, not a promise. It says when a touch is most likely to land, not that anything will happen inside it.",
  businessHoursUnknownNote:
    "No timezone resolved for this prospect, so we can't say whether now is inside their working hours. That is not the same as outside them.",
  windowSeparator: " to ",
  fields: {
    lastMeaningfulSignalAt: "Last meaningful signal",
    signalFreshness: "Signal freshness",
    urgency: "Urgency",
    cooldownUntil: "Cooling down until",
    idealWindow: "Ideal next-action window",
    withinBusinessHours: "Business hours",
    activityTrendFlag: "Activity trend",
  },
} as const;

/**
 * `BusinessHours`, minus `UNKNOWN` — which has no label and must not acquire one.
 *
 * A projection of `STATE_LABEL`, not a second table — the relationship
 * `GTM_ACTION_LABEL_BY_TYPE` has to `GTM_ACTION_LABELS`. The strings live in one
 * object, so this panel cannot print a timing value differently from
 * `StateDimensionGrid`, which renders the same dimensions through `ObservedValue` and
 * its `STATE_LABEL` lookup. What the narrowing adds is the vocabulary boundary:
 * `UNKNOWN` has no key here, so an unresolved timezone keeps its only path to the
 * screen — `ObservedValue`'s unknown branch — and can never pick up "Outside".
 */
export const BUSINESS_HOURS_LABEL: Record<string, string> = {
  WITHIN: STATE_LABEL.WITHIN,
  OUTSIDE: STATE_LABEL.OUTSIDE,
};

/** `ActivityTrendFlag`, minus `UNKNOWN`, projected from `STATE_LABEL` for the same reasons. */
export const ACTIVITY_TREND_FLAG_LABEL: Record<string, string> = {
  SPIKE: STATE_LABEL.SPIKE,
  STEADY: STATE_LABEL.STEADY,
  DECLINE: STATE_LABEL.DECLINE,
};

/**
 * Chip tones. Decoration only — every chip below renders its value as text through
 * `ObservedValue`, so colour is never the only carrier of meaning (R18.9).
 *
 * Nothing here is rose. A prospect outside their working hours or with declining
 * activity is a timing fact to read, not an error to fix.
 */
export const BUSINESS_HOURS_TONE: Record<string, string> = {
  WITHIN: "emerald",
  OUTSIDE: "amber",
};

export const ACTIVITY_TREND_FLAG_TONE: Record<string, string> = {
  SPIKE: "emerald",
  STEADY: "zinc",
  DECLINE: "amber",
};

/**
 * A derived enum as an `ObservedFact`, so it renders through the one primitive allowed
 * to render a fact (R28.3).
 *
 * The same helper `StateDimensionGrid` uses. `UNKNOWN` collapses into `isUnknown`
 * rather than travelling as a value — which is what keeps an unresolved timezone from
 * rendering as a statement about the prospect's clock.
 */
function derivedFact(value: string | null | undefined, observedAt: string | null = null): ObservedFact {
  const unknown = value == null || value === "" || value === "UNKNOWN";
  return {
    value: unknown ? null : value,
    isUnknown: unknown,
    sourceSurface: null,
    observedAt,
    isStale: false,
    isDerived: true,
  };
}

/**
 * A derived enum as a *labelled* fact.
 *
 * The lookup runs after the unknown collapse, so there is no order of operations in
 * which `UNKNOWN` picks up a label. The strings come from `STATE_LABEL` by way of the
 * projections above, which are the same strings `ObservedValue` would find on its own —
 * it renders `STATE_LABEL[value] ?? value`, and `STATE_LABEL` now carries both
 * vocabularies, so `StateDimensionGrid` prints exactly what this panel prints.
 */
function labelledFact(
  value: string | null | undefined,
  labels: Record<string, string>,
  observedAt: string | null = null,
): ObservedFact {
  const fact = derivedFact(value, observedAt);
  if (fact.isUnknown || fact.value == null) return fact;
  return { ...fact, value: labels[fact.value] ?? fact.value };
}

/** A number as the server sent it, to two places when it has a fraction. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * A derived number in the shape `DerivedScore` renders.
 *
 * `scoreDisclaimer` is empty on purpose: freshness and urgency carry none on the wire
 * because neither is a prioritisation score, and `DerivedScore` renders the disclaimer
 * verbatim or not at all. `scoreKind` never reaches the screen — the field's own label
 * is passed explicitly — so it is here to satisfy the payload shape and nothing more.
 *
 * `null` for a number the payload did not carry, which `DerivedScore` renders as
 * "Unknown". A `0` there would claim we measured no urgency at all.
 */
function derivedNumber(value: number | null | undefined): DerivedScorePayload {
  return {
    score: typeof value === "number" && Number.isFinite(value) ? value : null,
    scoreKind: "RECOMMENDATION_SCORE",
    scoreDisclaimer: "",
    isDerived: true,
  };
}

/** The confidence chip, for a value that exists. Never beside an unknown one. */
function ConfidenceChip({ value }: { value: number }) {
  return (
    <span className={cn("rounded-full border px-1.5 py-0 text-[10px] font-semibold", TONE.zinc)}>
      <span className="sr-only">{GTM_UI_LABELS.confidence}: </span>
      {formatNumber(value)}
    </span>
  );
}

/** The confidence for a fact, or nothing when there is no fact to qualify. */
function confidenceChipFor(fact: ObservedFact, confidence: number | null | undefined) {
  if (fact.isUnknown || fact.value == null) return null;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return null;
  return <ConfidenceChip value={confidence} />;
}

/** An instant, or "Unknown" — never a dash and never a substituted "now". */
function Instant({ iso }: { iso: string | null | undefined }) {
  if (!iso) {
    return (
      <span className="text-[13px] font-medium text-slate-500">
        {UNKNOWN_TEXT}
        <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
      </span>
    );
  }
  return (
    <time dateTime={iso} title={absTime(iso)} className="text-[13px] font-semibold text-zinc-900">
      {relTime(iso)}
    </time>
  );
}

/** One `<dt>`/`<dd>` pair, in the markup `ObservedValue` uses inside a `<dl>`. */
function FieldRow({
  label,
  field,
  children,
}: {
  label: string;
  field: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0" data-field={field}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export interface TimingPanelProps {
  /** `ProspectStateFull.timing` — exactly as the server sent it. */
  timing: TimingState;
  /**
   * `ProspectStateFull.dimensionConfidence`, when the page has it.
   *
   * `TimingState` carries no confidence of its own on the wire; the engine reports it
   * per dimension, and `activity_trend_flag` is the key for the one dimension on this
   * panel. Optional, and no chip is rendered without it — an invented confidence would
   * be worse than none.
   */
  dimensionConfidence?: Record<string, number> | null;
  className?: string;
}

export function TimingPanel({ timing, dimensionConfidence, className }: TimingPanelProps) {
  const titleId = useId();
  const noteId = useId();
  const windowNoteId = useId();

  const businessHours = labelledFact(timing?.withinBusinessHours, BUSINESS_HOURS_LABEL);
  const trendFlag = labelledFact(timing?.activityTrendFlag, ACTIVITY_TREND_FLAG_LABEL);

  const businessHoursTone = businessHours.isUnknown
    ? TONE.zinc
    : TONE[BUSINESS_HOURS_TONE[timing.withinBusinessHours] ?? "zinc"] ?? TONE.zinc;
  const trendFlagTone = trendFlag.isUnknown
    ? TONE.zinc
    : TONE[ACTIVITY_TREND_FLAG_TONE[timing.activityTrendFlag] ?? "zinc"] ?? TONE.zinc;

  const windowStart = timing?.idealNextActionWindowStart ?? null;
  const windowEnd = timing?.idealNextActionWindowEnd ?? null;

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Clock className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        {TIMING_PANEL_LABELS.title}
      </h2>
      <p id={noteId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {TIMING_PANEL_LABELS.note}
      </p>

      {/* The two derived numbers, through the primitive that never lets a score be a
          bare integer (R28.3). */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-describedby={noteId}>
        <div className={cn("rounded-md border px-3 py-2", TONE.zinc)} data-field="signal_freshness">
          <DerivedScore
            score={derivedNumber(timing?.signalFreshness)}
            label={TIMING_PANEL_LABELS.fields.signalFreshness}
            size="sm"
          />
        </div>
        <div className={cn("rounded-md border px-3 py-2", TONE.zinc)} data-field="urgency">
          <DerivedScore
            score={derivedNumber(timing?.urgency)}
            label={TIMING_PANEL_LABELS.fields.urgency}
            size="sm"
          />
        </div>
      </div>

      {/*
        The two derived enums, through the one primitive allowed to render a fact, and
        the instants beside them. A `<dl>`, so `ObservedValue` stays in its default
        `<dt>`/`<dd>` variant and every label/value pair is real markup.
      */}
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldRow
          label={TIMING_PANEL_LABELS.fields.lastMeaningfulSignalAt}
          field="last_meaningful_signal_at"
        >
          <Instant iso={timing?.lastMeaningfulSignalAt} />
        </FieldRow>

        <ObservedValue
          label={FIELD_LABEL.activity_trend_flag ?? TIMING_PANEL_LABELS.fields.activityTrendFlag}
          fact={trendFlag}
          hideProvenance
          className={cn("rounded-md border px-3 py-2", trendFlagTone)}
        >
          {confidenceChipFor(trendFlag, dimensionConfidence?.activity_trend_flag)}
        </ObservedValue>

        <ObservedValue
          label={TIMING_PANEL_LABELS.fields.withinBusinessHours}
          fact={businessHours}
          hideProvenance
          className={cn("rounded-md border px-3 py-2", businessHoursTone)}
        />

        {/*
          Rendered only when there is a cooldown. A null `cooldownUntil` means no
          cooldown is set — neither an unknown nor a zero — and a row claiming either
          would be this panel inventing a fact. Same convention
          `ChannelIntelligencePanel` applies to the same field.
        */}
        {timing?.cooldownUntil && (
          <FieldRow label={TIMING_PANEL_LABELS.fields.cooldownUntil} field="cooldown_until">
            <Instant iso={timing.cooldownUntil} />
          </FieldRow>
        )}
      </dl>

      {/*
        The window, and the sentence that keeps it from reading as a commitment. Both
        bounds print, each as "Unknown" where the payload has none: a window with one
        end missing is half a window, not a window starting now.
      */}
      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2" data-field="ideal_window">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {TIMING_PANEL_LABELS.fields.idealWindow}
        </p>
        <p className="mt-0.5" aria-describedby={windowNoteId}>
          <Instant iso={windowStart} />
          <span className="text-[13px] text-slate-500">{TIMING_PANEL_LABELS.windowSeparator}</span>
          <Instant iso={windowEnd} />
        </p>
        <p id={windowNoteId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {TIMING_PANEL_LABELS.windowNote}
        </p>
      </div>

      {/*
        What an unresolved timezone means, as real text rather than as a muted colour
        (R18.9). The sentence names the confusion it is preventing, because "we don't
        know their clock" and "it is the middle of their night" would lead an operator
        to opposite decisions.
      */}
      {businessHours.isUnknown && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {TIMING_PANEL_LABELS.businessHoursUnknownNote}
        </p>
      )}
    </section>
  );
}

export default TimingPanel;
