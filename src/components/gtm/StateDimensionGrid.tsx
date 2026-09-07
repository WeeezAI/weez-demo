// components/gtm/StateDimensionGrid.tsx
//
// The four dimensions, kept as four values, beside the one sentence that summarises
// them (R18.4, R6.3, R14.2).
//
// This panel is where the requirement that gave this layer its shape becomes visible
// markup. A screen wants one status line; the record holds four independent facts,
// each with its own evidence and its own observation time. Collapsing them is how a
// dashboard ends up saying "Connected" because someone clicked Connect. So both are
// rendered, and the relationship between them is spelled out rather than implied:
//
//   `displaySummary`   a convenience, computed server-side for display, marked
//                      `derived` and captioned "Display only". It carries no
//                      authority and nothing reads it back (R6.3).
//   the five values    `relationship_state`, `conversation_state`,
//                      `conversation_stage`, `execution_state`, `activity_level` —
//                      each an `ObservedFact`, each with its own provenance line,
//                      each able to read "Unknown" independently of the others.
//
// `conversation_stage` sits with the four rather than inside `conversation_state`
// because R18.4 names it separately. It is a projection of the conversation state,
// not a fifth dimension, and it is marked `derived` on the wire — so it arrives
// wearing that badge and the reader can tell the difference.
//
// `confirmation_status` is the last row. It is not an `ObservedFact`: it is what can
// be said about the outcome of the last requested action, which is a different kind
// of claim from an observation, and `ConfirmationStatusBadge` is the component that
// knows how to say it without turning "we couldn't confirm" into "it failed".
//
// The state engine extends this panel rather than replacing it (R9.6, R28.3). When a
// page passes `stateFull`, three things are *added* and nothing is taken away:
//
//   the added dimensions   `buying_stage`, `engagement_trend`, `activity_trend_flag`
//                          and one availability row per channel, rendered beside the
//                          four through the same `ObservedValue` primitive. Channel
//                          availability is never averaged across channels (R6.5).
//   per-dimension          the confidence the engine reports for a dimension, as a
//   confidence             chip on that dimension's own field — never one number
//                          standing for the whole state.
//   the journey badge      `JourneyStateBadge` in the heading row. The projection is
//                          recomputed on every read and authoritative over nothing
//                          (R9.2), so it is one more thing on the panel and never a
//                          substitute for the grid or for any dimension in it.
//
// The four dimensions are unchanged by all of that: four labels, four values, four
// provenance lines, read from `state` exactly as before.
//
// Nothing here computes. Every value is rendered from the payload through a label
// lookup and a tone lookup; the tones come from the shared `TONE` table, so chip
// contrast is the same 4.5:1 palette the rest of the app uses, and in every chip the
// text — not the colour — carries the meaning (R18.9). A value or a field name the
// label tables do not carry renders raw, which is this layer's convention: an unmapped
// key is a display gap, not a licence to invent a friendlier string.

import { useId } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ObservedFact, ProspectState, ProspectStateFull } from "@/services/gtmAPI";
import { ConfirmationStatusBadge } from "./ConfirmationStatusBadge";
import { JourneyStateBadge } from "./JourneyStateBadge";
import { ObservedValue } from "./ObservedValue";
import {
  CHANNEL_AVAILABILITY_LABEL,
  CHANNEL_LABEL,
  DIMENSION_LABEL,
  FIELD_LABEL,
  GTM_UI_LABELS,
  STATE_TONE,
  TONE,
} from "./labels";

export interface StateDimensionGridProps {
  state: ProspectState;
  /**
   * The state engine's full read, when the page has it (R9.6, R28.3).
   *
   * Optional, and additive by construction: without it this panel renders exactly
   * what it rendered before. With it, the dimensions the engine added appear *beside*
   * the four — same `<dl>`, same `ObservedValue` primitive — the per-dimension
   * confidence appears as a chip on each field, and the journey projection appears as
   * one badge in the heading row. The four never move, merge, or lose a field, and
   * nothing here replaces a dimension with the projection.
   *
   * The four dimensions keep reading from `state`, not from `stateFull.dimensions`:
   * the two carry the same facts, and having one source for the four rows keeps this
   * panel's oldest guarantee — four independently visible fields — in one place.
   */
  stateFull?: ProspectStateFull | null;
  className?: string;
}

/**
 * The rows, in the order the operator reads them: are we connected, how is the
 * conversation going, what stage is that, what did we last ask for, how active are
 * they. `relationship_state`, `conversation_state`, `execution_state`, and
 * `activity_level` are the four dimensions R6.3 requires to stay independently
 * visible; `conversation_stage` is the projection R18.4 names beside them.
 */
const DIMENSION_KEYS = [
  "relationship_state",
  "conversation_state",
  "conversation_stage",
  "execution_state",
  "activity_level",
] as const;

type DimensionKey = (typeof DIMENSION_KEYS)[number];

const DIMENSION_FACT: Record<DimensionKey, (state: ProspectState) => ObservedFact> = {
  relationship_state: (state) => state.relationshipState,
  conversation_state: (state) => state.conversationState,
  conversation_stage: (state) => state.conversationStage,
  execution_state: (state) => state.executionState,
  activity_level: (state) => state.activityLevel,
};

/**
 * The chip tone for a value, from the shared table.
 *
 * An unknown fact takes the `zinc` tone rather than the tone of whatever value
 * happens to be sitting in the `value` slot: a fact the layer has not observed must
 * not borrow the green of `CONNECTED` because a stale payload carried the string
 * along for debugging.
 */
function toneFor(fact: ObservedFact): string {
  if (fact.isUnknown || fact.value == null) return TONE.zinc;
  return TONE[STATE_TONE[fact.value] ?? "zinc"] ?? TONE.zinc;
}

/** The label for a dimension key, from the shared tables, raw key on a miss. */
function labelFor(key: string): string {
  return FIELD_LABEL[key] ?? DIMENSION_LABEL[key] ?? key;
}

/** One added dimension, in the shape this panel already renders. */
interface AddedDimension {
  key: string;
  label: string;
  fact: ObservedFact;
  confidence: number | null;
}

/**
 * A derived dimension value as an `ObservedFact`, so it renders through the one
 * primitive allowed to render a fact (R28.3).
 *
 * `UNKNOWN` collapses into `isUnknown` rather than travelling as a value: the engine
 * sends it as the honest fallback for "nothing placed this prospect yet", and it has
 * to reach the screen through `ObservedValue`'s unknown branch — the word "Unknown"
 * and the screen-reader note — rather than as a label that could pass for a reading.
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
 * The dimensions this engine added, in the order a reader wants them: where they are
 * in their own buying process, which way engagement is moving, what their activity is
 * doing, then one row per channel.
 *
 * Channel availability is one row per channel and never a blend — a prospect
 * reachable on LinkedIn and not by phone has two different facts, not one average
 * (R6.5).
 *
 * When the engine sent an observed `provenance.availability`, the row renders that
 * fact whole, so its surface, its observation time and its stale badge all survive
 * the trip to the screen. When it did not, the row falls back to the derived
 * availability blend and carries no provenance at all — `ObservedValue`'s provenance
 * line is suppressed rather than filled in. The alternative was to borrow
 * `observed.observedAt` off the unobserved fact, which would print an observation
 * time for a value nobody observed: a fabricated provenance line, and the one thing
 * this panel exists to prevent.
 */
function addedDimensions(full: ProspectStateFull): AddedDimension[] {
  const confidenceOf = (key: string): number | null => {
    const value = full.dimensionConfidence?.[key];
    return typeof value === "number" ? value : null;
  };

  const rows: AddedDimension[] = [
    {
      key: "buying_stage",
      label: labelFor("buying_stage"),
      fact: derivedFact(full.buyingStage?.value),
      confidence: typeof full.buyingStage?.confidence === "number"
        ? full.buyingStage.confidence
        : confidenceOf("buying_stage"),
    },
    {
      key: "engagement_trend",
      label: labelFor("engagement_trend"),
      fact: derivedFact(full.engagement?.trend, full.engagement?.evaluatedAt ?? null),
      confidence: confidenceOf("engagement_trend"),
    },
    {
      key: "activity_trend_flag",
      label: labelFor("activity_trend_flag"),
      fact: derivedFact(full.timing?.activityTrendFlag),
      confidence: confidenceOf("activity_trend_flag"),
    },
  ];

  for (const channel of full.channels ?? []) {
    const observed = channel.provenance?.availability;
    rows.push({
      key: `channel_availability_${channel.channel}`,
      label:
        CHANNEL_AVAILABILITY_LABEL[channel.channel] ??
        CHANNEL_LABEL[channel.channel] ??
        channel.channel,
      fact:
        observed && !observed.isUnknown && observed.value != null
          ? observed
          : derivedFact(channel.availability),
      confidence: typeof channel.confidence === "number" ? channel.confidence : null,
    });
  }

  return rows;
}

/**
 * A dimension's own confidence, beside the value (R28.3).
 *
 * The number is rendered as the server sent it, to two places when it has a fraction:
 * a format, like `relTime`, and not a computation — no band is derived from it here,
 * because a band is a judgement and this panel does not make any.
 *
 * Rendered only for a value that exists. A confidence of `0` printed next to
 * "Unknown" would put a plausible-looking number where a fact is missing, which is
 * the mistake this whole panel is built to avoid (R14.2).
 */
function ConfidenceChip({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0 text-[10px] font-semibold",
        TONE.zinc,
      )}
    >
      <span className="sr-only">{GTM_UI_LABELS.confidence}: </span>
      {Number.isInteger(value) ? String(value) : value.toFixed(2)}
    </span>
  );
}

/** The confidence chip for a fact, or nothing when there is no fact to qualify. */
function confidenceChipFor(fact: ObservedFact, confidence: number | null) {
  if (fact.isUnknown || fact.value == null) return null;
  if (confidence == null || !Number.isFinite(confidence)) return null;
  return <ConfidenceChip value={confidence} />;
}

export function StateDimensionGrid({ state, stateFull, className }: StateDimensionGridProps) {
  const titleId = useId();
  const summaryId = useId();
  const summary = state.displaySummary?.trim();
  const added = stateFull ? addedDimensions(stateFull) : [];

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      {/*
        The heading row, and the projection beside it (R9.6). One badge, added to this
        panel rather than substituted for anything in it: every dimension below stays
        exactly where it was, and the badge is described by the display-only note the
        panel already prints, so the summary sentence is not duplicated.
      */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Layers className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          {GTM_UI_LABELS.stateTitle}
        </h2>
        {stateFull && (
          <JourneyStateBadge journeyState={stateFull.journeyState} hideNote describedBy={summaryId} />
        )}
      </div>

      {/*
        The derived summary (R6.3). Visually secondary to the values below it, and
        captioned so its status is stated rather than inferred from the styling: it
        is a display convenience, and the dimensions underneath are the record.
      */}
      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            {FIELD_LABEL.display_summary}
          </span>
          <Badge
            variant="outline"
            className="border-zinc-200 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500"
          >
            derived
          </Badge>
        </div>
        <p className="mt-0.5 text-[13px] font-semibold text-zinc-900" aria-describedby={summaryId}>
          {summary || GTM_UI_LABELS.noSummary}
        </p>
        <p id={summaryId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {GTM_UI_LABELS.displayOnlyNote}
        </p>
      </div>

      {/*
        The dimensions themselves (R18.4). A `<dl>`, so `ObservedValue` stays in its
        default `<dt>`/`<dd>` variant and each label/value pair is real markup rather
        than two boxes that happen to sit next to each other.
      */}
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DIMENSION_KEYS.map((key) => {
          const fact = DIMENSION_FACT[key](state);
          const confidence = stateFull?.dimensionConfidence?.[key];
          return (
            <ObservedValue
              key={key}
              label={FIELD_LABEL[key] ?? key}
              fact={fact}
              className={cn("rounded-md border px-3 py-2", toneFor(fact))}
            >
              {confidenceChipFor(fact, typeof confidence === "number" ? confidence : null)}
            </ObservedValue>
          );
        })}

        {/*
          The dimensions this engine added (R9.6, R28.3). Beside the four, in the same
          list and through the same primitive — so each one carries its own
          observed-or-derived marker and its own confidence, and none of them is
          folded into a dimension above it. Absent unless the page passed the full
          read, which is why every existing caller renders unchanged.
        */}
        {added.map((row) => (
          <ObservedValue
            key={row.key}
            label={row.label}
            fact={row.fact}
            hideProvenance={row.fact.sourceSurface == null && row.fact.observedAt == null}
            className={cn("rounded-md border px-3 py-2", toneFor(row.fact))}
          >
            {confidenceChipFor(row.fact, row.confidence)}
          </ObservedValue>
        ))}

        {/* Not an observation: what can be said about the last requested action's
            outcome. Kept in the same list so it is as visible as the dimensions, and
            rendered by the badge that knows UNKNOWN is not a failure (R12.4). */}
        <div className={cn("min-w-0 rounded-md border px-3 py-2", TONE.zinc)}>
          <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            {FIELD_LABEL.confirmation_status}
          </dt>
          <dd className="mt-1">
            <ConfirmationStatusBadge status={state.confirmationStatus} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default StateDimensionGrid;
