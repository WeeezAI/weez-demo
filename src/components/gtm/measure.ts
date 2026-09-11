// components/gtm/measure.ts
//
// Turning the engine's 0-100 measures into something a sales rep can act on.
//
// ─── The problem this solves ───────────────────────────────────────────────────
//
// Every strength, freshness, urgency and confidence the state engine persists is an
// integer 0-100 — `enums.MEASURE_GROUP_BOUNDS` calls it the Hundredths_Scale — and the
// screens rendered them as bare numbers:
//
//     Urgency 68   Business value 74   Signal freshness 41   State confidence 55
//
// A rep cannot do anything with that. Is 68 urgent? Is 41 stale? Four unlabelled numbers
// in a row is the visual language of a monitoring console, and it makes a product that is
// supposed to say "call this person today" look like a dashboard that needs interpreting.
// Worse, the numbers invite false precision: nobody should act differently on 68 than on
// 71, and putting them side by side implies they should.
//
// ─── Why the banding lives here and not in the backend ─────────────────────────
//
// **The backend deliberately publishes no banding for these.** It bands one thing —
// `action_score` into NOW / TODAY / THIS_WEEK / LATER, in `core/linkedin/gtm/
// priority_bands.py`, off three gated tunables — and nothing else. There is no served
// threshold for what counts as high urgency, and inventing one server-side would have been
// a claim about the domain that nobody had evidence for.
//
// So this is a **presentation** choice and it is labelled as one. The distinction this
// codebase draws everywhere applies here too: we are not claiming the engine said "high",
// we are choosing how to render a number it did say. Which is why
//
//   * the number is always still shown — the band never replaces it, so a reader who wants
//     the value has it and nothing is hidden behind a word;
//   * the thresholds are stated once, here, rather than inline at four call sites where
//     they would drift;
//   * `null` bands to nothing rather than to "Low". An unread measure and a low one are
//     different facts, and this is the one direction it must not guess in.
//
// There is precedent for frontend-owned thresholds in this app: `HIGH_QUALITY_FIT = 70` and
// `LOW_QUALITY_FIT = 50` already band ICP fit for Eva's quality filter.
//
// ─── The bands ────────────────────────────────────────────────────────────────
//
// Four, on quartile-ish boundaries, because four is what a person can hold: two would lose
// the difference between "worth a look" and "drop everything", and six would be back to
// asking the reader to interpret. The words are the rep's, not the engine's.

/** The bands, high to low. `null` is not a band — see `bandOf`. */
export type MeasureBand = "HIGH" | "MODERATE" | "LOW" | "MINIMAL";

/**
 * Where each band starts, inclusive. Stated once.
 *
 * Deliberately not tunable from the UI and deliberately not fetched: a threshold that moved
 * per workspace would make two reps reading the same prospect disagree about it in words
 * while agreeing about the number.
 */
export const MEASURE_BAND_FLOORS: ReadonlyArray<readonly [MeasureBand, number]> = [
  ["HIGH", 70],
  ["MODERATE", 45],
  ["LOW", 20],
  ["MINIMAL", 0],
];

/**
 * The band for a measure, or `null` when there is no measure.
 *
 * `null` in, `null` out — and that is the whole reason this returns a nullable rather than
 * defaulting. A prospect whose urgency has never been evaluated must not read "Minimal",
 * which is a statement that we looked and found almost nothing.
 */
export function bandOf(value: number | null | undefined): MeasureBand | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const found = MEASURE_BAND_FLOORS.find(([, floor]) => value >= floor);
  return found ? found[0] : "MINIMAL";
}

/**
 * The words a rep reads.
 *
 * Neutral rather than instructive. "High" describes the measure; it does not tell the rep to
 * act, because whether to act is what the Next Best Action is for and two different measures
 * reading "High" do not add up to an instruction.
 */
export const MEASURE_BAND_LABELS: Record<MeasureBand, string> = {
  HIGH: "High",
  MODERATE: "Moderate",
  LOW: "Low",
  MINIMAL: "Minimal",
};

/** The tone key, from the shared `TONE` table in `labels.ts`. */
export const MEASURE_BAND_TONE: Record<MeasureBand, string> = {
  HIGH: "emerald",
  MODERATE: "amber",
  LOW: "zinc",
  MINIMAL: "zinc",
};

/**
 * One line of plain English per measure, for the tooltip on its label.
 *
 * These are the sentences that replace a rep having to ask what the field means. Each says
 * what the number is *about*, in the terms the rep already thinks in, and none of them uses
 * the word "Hundredths", "dimension" or "belief".
 *
 * Keyed by the field name the wire uses, so a reader can match a tooltip to a payload field
 * without a second mapping.
 */
export const MEASURE_MEANINGS: Record<string, string> = {
  urgency: "How time-sensitive this looks, based on how recently something happened.",
  business_value: "How much this prospect is likely to be worth, from their ACV tier and fit.",
  signal_freshness: "How recent the newest thing we observed about them is.",
  state_confidence: "How sure Weez is about what it currently believes about this prospect.",
  action_confidence: "How sure Weez is about this specific recommendation.",
  expected_success_probability:
    "How often this kind of action has worked on prospects like this one.",
  effective_strength: "How much this signal counts once its age is taken into account.",
  icp_score: "How closely this prospect matches the customer profile you sell to.",
  identity_confidence: "How sure Weez is that this is the right person.",
};

/**
 * A measure, rendered the way a rep reads it: the word first, the number after.
 *
 * `High · 68` rather than `68`. The order is the point — the band is what the reader acts
 * on and the number is the audit trail, so the band comes first and the number is quieter.
 *
 * Returns the two pieces rather than JSX so the call site keeps control of its own layout.
 * `band` is null for an unread measure, and a caller that gets null should render its own
 * absence rather than a zero.
 */
export function measureParts(value: number | null | undefined): {
  band: MeasureBand | null;
  label: string | null;
  tone: string;
  /** The number, as a string, or null when there is nothing to show. */
  value: string | null;
} {
  const band = bandOf(value);
  if (band === null) {
    return { band: null, label: null, tone: "zinc", value: null };
  }
  return {
    band,
    label: MEASURE_BAND_LABELS[band],
    tone: MEASURE_BAND_TONE[band],
    value: String(Math.round(value as number)),
  };
}
