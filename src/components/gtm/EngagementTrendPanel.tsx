// components/gtm/EngagementTrendPanel.tsx
//
// Three trailing counts and the direction they point (R28.1, R28.3).
//
// **These are counts, not measures.** `count24h` / `count7d` / `count30d` are numbers
// of signals, counted from each signal's *event* timestamp rather than the moment it
// reached us — which is what stops a backfill from reading as a surge. Twelve signals
// imported on Tuesday about things that happened in March are twelve signals in the
// 30-day column only if they happened in the last thirty days, and the panel says which
// clock it counted on so nobody reads a migration as a hot prospect.
//
// **An uncounted zero is not a count of zero.** `FLAT` is the default direction and
// `evaluatedAt` is the field that says whether anyone has looked. Where `evaluatedAt` is
// null the three numbers are initial values rather than results, so they render as
// "Unknown" instead of as `0` — a printed zero would claim we counted and found nothing,
// which is a different statement from having never counted. Once `evaluatedAt` is set, a
// genuine `0` prints as `0`, because a counted zero is a real count and hiding it would
// be the opposite mistake.
//
// `FLAT` in that same never-evaluated state is still rendered — it is the value the
// engine holds and hiding it would be this panel inventing a silence — but the note
// beside it says it is the default rather than a reading. `RISING` and `DECLINING` are
// only reachable by evaluation, so they never need the caveat.
//
// The counts go through `DerivedScore` (R28.3) so each one arrives wearing the `derived`
// badge, and the direction goes through `ObservedValue`, the one primitive allowed to
// render a fact. The `DerivedScore` payloads this file hands over carry an empty
// `scoreDisclaimer`, which means no disclaimer is rendered: a count carries none on the
// wire, and composing one here is exactly what the verbatim rule exists to prevent.
//
// Nothing here computes — no ratio between the windows, no rate, no projection. The
// direction is the server's, the labels are dictionary lookups, and `relTime` is a
// format. `CONFIDENCE_LABEL` is deliberately unused: banding a number into "Low
// confidence" is a judgement this panel does not make.

import { useId } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DerivedScore as DerivedScorePayload,
  EngagementTrajectory,
  ObservedFact,
} from "@/services/gtmAPI";
import { DerivedScore } from "./DerivedScore";
import { ObservedValue, UNKNOWN_SR_NOTE } from "./ObservedValue";
import { FIELD_LABEL, GTM_UI_LABELS, STATE_LABEL, TONE, absTime, relTime } from "./labels";

/**
 * The strings this panel needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `IntentPanel.tsx`'s `INTENT_PANEL_LABELS`
 * established, because `labels.ts` is closed for this feature. They belong beside
 * `GTM_UI_LABELS` / `FIELD_LABEL` and moving them there is a one-line change at each
 * use site.
 *
 * `note`, `neverEvaluatedNote` and `flatIsDefaultNote` are the three that carry
 * requirements rather than chrome: what the counts counted, why they are not zeros, and
 * why `FLAT` here is a default rather than a finding.
 */
export const ENGAGEMENT_TREND_PANEL_LABELS = {
  title: "Engagement trend",
  note: "Counts of signals, not scores. Each signal is counted on when it happened, not on when it reached us, so a backfill can't read as a surge.",
  neverEvaluatedNote:
    "Nothing has counted these signals yet, so the windows read Unknown rather than zero. A zero would say we looked and found none.",
  flatIsDefaultNote: "Flat is the starting value here, not a reading — nothing has been counted yet.",
  neverEvaluated: "Not evaluated yet",
  fields: {
    count24h: "Last 24 hours",
    count7d: "Last 7 days",
    count30d: "Last 30 days",
    trend: "Direction",
    evaluatedAt: "Counted",
  },
} as const;

/**
 * `EngagementTrend`. Every value is a direction — there is no `UNKNOWN` in this union.
 *
 * A projection of `STATE_LABEL`, not a second table — the relationship
 * `GTM_ACTION_LABEL_BY_TYPE` has to `GTM_ACTION_LABELS`. The strings live in one
 * object, so this panel and `StateDimensionGrid` cannot print a direction two ways:
 * the grid renders `engagement_trend` through `ObservedValue`, which looks the value up
 * in `STATE_LABEL`, and what it finds there is what this table hands over.
 */
export const ENGAGEMENT_TREND_LABEL: Record<string, string> = {
  RISING: STATE_LABEL.RISING,
  FLAT: STATE_LABEL.FLAT,
  DECLINING: STATE_LABEL.DECLINING,
};

/**
 * Chip tones. Decoration only — `ObservedValue` renders the direction as text in the
 * same chip, so colour is never the only carrier of meaning (R18.9).
 *
 * `DECLINING` is amber rather than rose: falling engagement is a fact to read and act
 * on, not an error to fix.
 */
export const ENGAGEMENT_TREND_TONE: Record<string, string> = {
  RISING: "emerald",
  FLAT: "zinc",
  DECLINING: "amber",
};

/**
 * A derived enum as an `ObservedFact`, so it renders through the one primitive allowed
 * to render a fact (R28.3).
 *
 * The same helper `StateDimensionGrid` uses: `UNKNOWN` and null collapse into
 * `isUnknown` rather than travelling as a value. `EngagementTrend` has no `UNKNOWN`
 * member, so in practice the collapse here catches a missing payload — which is
 * unknown, not flat.
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
 * The direction as a labelled fact.
 *
 * The lookup runs after the unknown collapse, so no absent value can pick up a
 * direction. The string comes from `STATE_LABEL` by way of the projection above, which
 * is the same string `ObservedValue` would find on its own — it renders
 * `STATE_LABEL[value] ?? value`, and `STATE_LABEL` now carries all three directions, so
 * `StateDimensionGrid` prints exactly what this panel prints.
 */
function trendFact(trend: string | null | undefined, evaluatedAt: string | null): ObservedFact {
  const fact = derivedFact(trend, evaluatedAt);
  if (fact.isUnknown || fact.value == null) return fact;
  return { ...fact, value: ENGAGEMENT_TREND_LABEL[fact.value] ?? fact.value };
}

/** A number as the server sent it, to two places when it has a fraction. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * A count in the shape `DerivedScore` renders, or `null` where nothing has counted.
 *
 * `scoreDisclaimer` is empty on purpose: a count carries none on the wire, and
 * `DerivedScore` renders the disclaimer verbatim or not at all. `scoreKind` never
 * reaches the screen — the window's own label is passed explicitly.
 *
 * `counted` is what separates an absence from a zero. Unset, the number is the initial
 * value of a field nobody has evaluated, so it goes over as `null` and `DerivedScore`
 * prints "Unknown". Set, a `0` is a real count of nothing and prints as `0`.
 */
function countScore(value: number | null | undefined, counted: boolean): DerivedScorePayload {
  const usable = counted && typeof value === "number" && Number.isFinite(value);
  return {
    score: usable ? (value as number) : null,
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

export interface EngagementTrendPanelProps {
  /** `ProspectStateFull.engagement` — the three counts, the direction, the evaluation time. */
  engagement: EngagementTrajectory;
  /**
   * `ProspectStateFull.dimensionConfidence`, when the page has it.
   *
   * `EngagementTrajectory` carries no confidence of its own on the wire; the engine
   * reports it per dimension under `engagement_trend`. Optional, and no chip is
   * rendered without it — an invented confidence would be worse than none.
   */
  dimensionConfidence?: Record<string, number> | null;
  className?: string;
}

export function EngagementTrendPanel({
  engagement,
  dimensionConfidence,
  className,
}: EngagementTrendPanelProps) {
  const titleId = useId();
  const noteId = useId();

  const evaluatedAt = engagement?.evaluatedAt ?? null;
  const counted = Boolean(evaluatedAt);
  const fact = trendFact(engagement?.trend, evaluatedAt);
  const tone = fact.isUnknown
    ? TONE.zinc
    : TONE[ENGAGEMENT_TREND_TONE[engagement.trend] ?? "zinc"] ?? TONE.zinc;

  const windows = [
    { field: "count_24h", label: ENGAGEMENT_TREND_PANEL_LABELS.fields.count24h, value: engagement?.count24h },
    { field: "count_7d", label: ENGAGEMENT_TREND_PANEL_LABELS.fields.count7d, value: engagement?.count7d },
    { field: "count_30d", label: ENGAGEMENT_TREND_PANEL_LABELS.fields.count30d, value: engagement?.count30d },
  ];

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Activity className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        {ENGAGEMENT_TREND_PANEL_LABELS.title}
      </h2>
      <p id={noteId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {ENGAGEMENT_TREND_PANEL_LABELS.note}
      </p>

      {/* The three windows, each through the primitive that never lets a number be a
          bare integer (R28.3). No ratio between them is computed anywhere. */}
      <div
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
        aria-describedby={noteId}
      >
        {windows.map((window) => (
          <div
            key={window.field}
            data-field={window.field}
            className={cn("rounded-md border px-3 py-2", TONE.zinc)}
          >
            <DerivedScore score={countScore(window.value, counted)} label={window.label} size="sm" />
          </div>
        ))}
      </div>

      {/*
        The direction and the evaluation time. A `<dl>`, so `ObservedValue` stays in its
        default `<dt>`/`<dd>` variant and each label/value pair is real markup.
      */}
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ObservedValue
          label={FIELD_LABEL.engagement_trend ?? ENGAGEMENT_TREND_PANEL_LABELS.fields.trend}
          fact={fact}
          hideProvenance
          className={cn("rounded-md border px-3 py-2", tone)}
        >
          {confidenceChipFor(fact, dimensionConfidence?.engagement_trend)}
        </ObservedValue>

        <div className="min-w-0" data-field="evaluated_at">
          <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            {ENGAGEMENT_TREND_PANEL_LABELS.fields.evaluatedAt}
          </dt>
          <dd className="mt-0.5">
            {evaluatedAt ? (
              <time
                dateTime={evaluatedAt}
                title={absTime(evaluatedAt)}
                className="text-[13px] font-semibold text-zinc-900"
              >
                {relTime(evaluatedAt)}
              </time>
            ) : (
              <span className="text-[13px] font-medium text-slate-500">
                {ENGAGEMENT_TREND_PANEL_LABELS.neverEvaluated}
                <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
              </span>
            )}
          </dd>
        </div>
      </dl>

      {/*
        Why the windows read "Unknown" and why "Flat" is not a finding, as real text
        rather than as a muted colour (R18.9). Both sentences are about us, not about the
        prospect, which is exactly the distinction `evaluatedAt` exists to make.
      */}
      {!counted && (
        <>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {ENGAGEMENT_TREND_PANEL_LABELS.neverEvaluatedNote}
            <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
          </p>
          {engagement?.trend === "FLAT" && (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {ENGAGEMENT_TREND_PANEL_LABELS.flatIsDefaultNote}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default EngagementTrendPanel;
