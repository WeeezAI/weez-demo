// components/gtm/BuyingStagePanel.tsx
//
// Where the prospect stands in their own buying process, and how sure we are (R28.1,
// R28.3).
//
// **`UNKNOWN` is not `UNAWARE`.** That distinction is the entire reason this panel is
// careful. `UNAWARE` is a placement: we looked at the signals and they say this person
// has not recognised the problem yet. `UNKNOWN` is the absence of a placement: the
// signal set was too thin to put them anywhere, which is also the initial value for
// every prospect nobody has evaluated. One is a reading, the other is a gap, and a
// panel that renders them the same way turns "we don't know" into "they don't know" —
// a claim about the prospect we have no evidence for.
//
// So `UNKNOWN` never reaches the value slot as a label. It collapses into
// `ObservedFact.isUnknown` in `derivedFact()` and comes out of `ObservedValue`'s
// unknown branch as the word "Unknown" plus the screen-reader note — the same spelling
// of absence every other fact on the page uses.
//
// **A confidence of 0 is not printed beside an unknown value.** The engine writes
// `UNKNOWN` at confidence zero together, as one statement, and a `0` sitting next to
// "Unknown" would read as a measurement that came back low rather than as a reading
// that never happened. The confidence chip renders only where there is a placement to
// qualify (the rule `StateDimensionGrid` already applies); where there is not, the
// panel says so in words instead.
//
// **The signal ids are the evidence.** They are rendered, not counted away: a stage is
// a derived value, and the ids are what an operator follows to see what derived it.
// An empty list means nothing supports the placement yet, and that is stated rather
// than left as blank space.
//
// The value goes through `ObservedValue` (R28.3) — the one primitive allowed to render
// a fact — so the `derived` badge, the unknown branch and the provenance conventions
// come from the same place they do everywhere else. Nothing here computes. The stage
// label is a dictionary lookup and the confidence is formatted, not banded:
// `CONFIDENCE_LABEL` is deliberately unused, because turning 0.42 into "Low
// confidence" is a judgement and this panel does not make any.

import { useId } from "react";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuyingStage, BuyingStageState, ObservedFact } from "@/services/gtmAPI";
import { ObservedValue } from "./ObservedValue";
import { FIELD_LABEL, GTM_UI_LABELS, STATE_LABEL, TONE } from "./labels";

/**
 * The strings this panel needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS` and
 * `IntentPanel.tsx`'s `INTENT_PANEL_LABELS` established, because `labels.ts` is closed
 * for this feature. They belong beside `GTM_UI_LABELS` / `STATE_LABEL` and moving them
 * there is a one-line change at each use site.
 *
 * `unknownNote` is the load-bearing one: it says the stage is unplaced and says
 * explicitly that this is not `UNAWARE`, so the gap cannot be read as a finding.
 */
export const BUYING_STAGE_PANEL_LABELS = {
  title: "Buying stage",
  note: "Where they are in their own buying process, derived from the signals we hold. Not a forecast.",
  unknownNote:
    "Nothing has placed this prospect in a stage yet. That is a gap in what we know, not a finding that they are unaware.",
  supportingSignals: "Supporting signals",
  supportingSignalsList: "Signal ids supporting this buying stage",
  noSupportingSignals: "No signals support a stage yet.",
  fields: {
    stage: "Buying stage",
  },
} as const;

/**
 * The five placeable stages, in the order a buyer moves through them.
 *
 * A projection of `STATE_LABEL`, not a second table — the same relationship
 * `GTM_ACTION_LABEL_BY_TYPE` has to `GTM_ACTION_LABELS`. The strings live in exactly
 * one object, so this panel and `StateDimensionGrid` cannot print a stage two ways:
 * the grid renders `buying_stage` through `ObservedValue`, which looks the value up in
 * `STATE_LABEL`, and what it finds there is what this table hands over.
 *
 * What this narrowing *adds* is the vocabulary boundary. `UNKNOWN` is absent on
 * purpose: it has no key here and cannot acquire one, so the only path from `UNKNOWN`
 * to the screen stays `ObservedValue`'s unknown branch. `STATE_LABEL.UNKNOWN` is the
 * word "Unknown" and nothing in this table can override it with a stage.
 */
export const BUYING_STAGE_LABEL: Record<string, string> = {
  UNAWARE: STATE_LABEL.UNAWARE,
  PROBLEM_AWARE: STATE_LABEL.PROBLEM_AWARE,
  SOLUTION_AWARE: STATE_LABEL.SOLUTION_AWARE,
  EVALUATING: STATE_LABEL.EVALUATING,
  DECIDING: STATE_LABEL.DECIDING,
};

/**
 * The chip tone per stage. Decoration only — `ObservedValue` renders the stage as text
 * in the same chip, so colour is never the thing carrying the meaning (R18.9).
 */
export const BUYING_STAGE_TONE: Record<string, string> = {
  UNAWARE: "zinc",
  PROBLEM_AWARE: "sky",
  SOLUTION_AWARE: "sky",
  EVALUATING: "violet",
  DECIDING: "emerald",
};

/**
 * A derived enum as an `ObservedFact`, so it renders through the one primitive allowed
 * to render a fact (R28.3).
 *
 * The same helper `StateDimensionGrid` uses, for the same reason: `UNKNOWN` collapses
 * into `isUnknown` rather than travelling as a value, so the honest fallback reaches
 * the screen as "Unknown" and never as a label that could pass for a reading.
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
 * The stage as a fact, labelled.
 *
 * The label lookup happens *after* the unknown collapse, so there is no order of
 * operations in which `UNKNOWN` picks up a stage name. The string comes from
 * `STATE_LABEL` by way of the projection above, which is the same string
 * `ObservedValue` would find on its own — it renders `STATE_LABEL[value] ?? value`, and
 * `STATE_LABEL` now carries all five stages, so `StateDimensionGrid` prints exactly
 * what this panel prints. Labelling here rather than leaving it to the primitive keeps
 * the collapse-then-look-up order visible in one function.
 */
function stageFact(stage: BuyingStage | null | undefined): ObservedFact {
  const fact = derivedFact(stage);
  if (fact.isUnknown || fact.value == null) return fact;
  return { ...fact, value: BUYING_STAGE_LABEL[fact.value] ?? fact.value };
}

/** A number as the server sent it, to two places when it has a fraction. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * The confidence for the stage, or nothing when there is no stage to qualify.
 *
 * A `0` beside "Unknown" would put a plausible-looking measurement where a reading is
 * missing, which is the one thing this panel exists to prevent (R14.2).
 */
function ConfidenceChip({ value }: { value: number }) {
  return (
    <span className={cn("rounded-full border px-1.5 py-0 text-[10px] font-semibold", TONE.zinc)}>
      <span className="sr-only">{GTM_UI_LABELS.confidence}: </span>
      {formatNumber(value)}
    </span>
  );
}

export interface BuyingStagePanelProps {
  /** `ProspectStateFull.buyingStage` — the value, its confidence and its signal ids. */
  buyingStage: BuyingStageState;
  className?: string;
}

export function BuyingStagePanel({ buyingStage, className }: BuyingStagePanelProps) {
  const titleId = useId();
  const noteId = useId();

  const fact = stageFact(buyingStage?.value);
  const placed = !fact.isUnknown && fact.value != null;
  const confidence = buyingStage?.confidence;
  const signalIds = buyingStage?.signalIds ?? [];
  const tone = placed
    ? TONE[BUYING_STAGE_TONE[buyingStage.value] ?? "zinc"] ?? TONE.zinc
    : TONE.zinc;

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
      data-buying-stage={buyingStage?.value ?? "UNKNOWN"}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Wallet className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        {BUYING_STAGE_PANEL_LABELS.title}
      </h2>
      <p id={noteId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {BUYING_STAGE_PANEL_LABELS.note}
      </p>

      {/* A `<dl>`, so `ObservedValue` stays in its default `<dt>`/`<dd>` variant. */}
      <dl className="mt-3" aria-describedby={noteId}>
        <ObservedValue
          label={FIELD_LABEL.buying_stage ?? BUYING_STAGE_PANEL_LABELS.fields.stage}
          fact={fact}
          hideProvenance
          className={cn("rounded-md border px-3 py-2", tone)}
        >
          {/* Only where there is a placement to qualify. */}
          {placed && typeof confidence === "number" && Number.isFinite(confidence) && (
            <ConfidenceChip value={confidence} />
          )}
        </ObservedValue>
      </dl>

      {/*
        What "Unknown" means here, as real text rather than as a muted colour (R18.9).
        The sentence names the mistake it is preventing, because "Unknown" and
        "Unaware" are one keystroke apart on this screen and only one of them is
        supported by evidence.
      */}
      {!placed && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {BUYING_STAGE_PANEL_LABELS.unknownNote}
        </p>
      )}

      {/*
        The evidence (R28.1). The ids are rendered rather than counted, because a
        derived value is only checkable if what derived it travels with it. An empty
        list is stated — a blank space would read as "we didn't print them".
      */}
      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {BUYING_STAGE_PANEL_LABELS.supportingSignals}
        </p>
        {signalIds.length === 0 ? (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {BUYING_STAGE_PANEL_LABELS.noSupportingSignals}
          </p>
        ) : (
          <ul
            className="mt-1 flex flex-wrap gap-1"
            aria-label={BUYING_STAGE_PANEL_LABELS.supportingSignalsList}
          >
            {signalIds.map((signalId) => (
              <li
                key={signalId}
                className={cn("rounded border px-1.5 py-0 font-mono text-[10px]", TONE.zinc)}
              >
                {signalId}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default BuyingStagePanel;
