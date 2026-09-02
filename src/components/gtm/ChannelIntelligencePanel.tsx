// components/gtm/ChannelIntelligencePanel.tsx
//
// Three channels, three columns, never a blend (R6.5, R6.6, R28.1, R28.3).
//
// A prospect who ignores email and answers on LinkedIn has a low email
// `responsiveness` and a high LinkedIn one. Those are two facts about two channels,
// and the average of them is a fact about nothing — it would recommend email to
// someone who has never opened one and hide the channel that actually works. So this
// panel is built so that a cross-channel number has nowhere to come from:
//
//   • the render walks `CHANNEL_KEYS` and each column receives exactly one
//     `ChannelState`, so no component in this file ever holds two of them at once;
//   • there is no arithmetic anywhere in the file — no sum, no mean, no reduce over
//     channels, no "overall reachability" row, and no summary line above the columns;
//   • every field renders the number the server wrote for *that* channel, formatted
//     the way `relTime` formats a timestamp and derived no further.
//
// A channel the payload has no row for renders its fields as "Unknown" rather than as
// zeros. Absence is not zero, and a zero here would read as "we looked and this
// channel scores nothing".
//
// **`UNAVAILABLE` is an absence, not a low score** (R6.6). No contact identifier means
// nothing could be scored, so the engine writes `availability: UNAVAILABLE` beside
// `suitability: 0`. Printing a bare `0` there would invite the reader to compare it
// with a genuine 12, so the suitability slot says "Not scored" and the column carries
// the reason as real text.
//
// Provenance travels with the three fields that are read rather than counted —
// `availability`, `activity`, `responsiveness` — which is why availability renders
// through `ObservedValue` (the one primitive allowed to render a fact, R28.3) and the
// two measures print their own surface and observation time underneath. The remaining
// fields are counted from the ledger and have no surface to name.
//
// This panel carries no label table of its own for `availability`, and that is the
// point: the value goes to `ObservedValue`, which looks it up in `STATE_LABEL`, so
// `AVAILABLE` / `UNAVAILABLE` read here exactly as they read in `StateDimensionGrid`.
// It never had a competing local table to remove — the two places rendered the same
// unlabelled token — and `STATE_LABEL` now labels both at once. `UNAVAILABLE` reads
// "No contact identifier" there for the same reason `notScored` sits in the
// suitability slot here: the absence is named rather than dressed up as a verdict on
// the channel (R6.6).
//
// Nothing here computes: `CHANNEL_LABEL`, `CHANNEL_TONE` and `SURFACE_LABEL` are
// lookups, `relTime` is a format, and a value missing from a label table renders raw
// rather than as a friendlier guess.

import { type ReactNode, useId } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChannelKey, ChannelState, ObservedFact } from "@/services/gtmAPI";
import { ObservedValue, UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "./ObservedValue";
import { CHANNEL_LABEL, CHANNEL_TONE, GTM_UI_LABELS, SURFACE_LABEL, TONE, absTime, relTime } from "./labels";

/**
 * The strings this panel needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS`
 * established, because `labels.ts` is closed for this feature. `fields` covers the
 * `gtm_channel_states` columns R6.2 names; the confidence row reuses
 * `GTM_UI_LABELS.confidence` rather than restating it.
 *
 * `unavailableNote` and `notScored` are the two halves of R6.6: the reason, and the
 * slot where a zero would otherwise sit.
 */
export const CHANNEL_PANEL_LABELS = {
  title: "Channel intelligence",
  note: "Each channel is read on its own evidence. No field here is averaged across channels.",
  noState: "Nothing recorded for this channel yet.",
  unavailableNote:
    "No contact identifier for this channel, so nothing was scored. That is an absence, not a low score.",
  notScored: "Not scored",
  notScoredSrNote: " (no contact identifier for this channel)",
  fields: {
    availability: "Availability",
    reachability: "Reachability",
    activity: "Activity",
    engagement: "Engagement",
    responsiveness: "Responsiveness",
    responseRate: "Response rate",
    historicalConversionRate: "Historical conversion rate",
    suitability: "Suitability",
    lastInteractionAt: "Last interaction",
    lastInboundAt: "Last inbound",
    lastOutboundAt: "Last outbound",
    cooldownUntil: "Cooling down until",
    consecutiveUnanswered: "Consecutive unanswered",
  },
} as const;

/** The three channels R6.1 holds a row for, in the order the operator reads them. */
export const CHANNEL_KEYS = ["LINKEDIN", "EMAIL", "PHONE"] as const satisfies readonly ChannelKey[];

/** `true` iff `CHANNEL_KEYS` covers `ChannelKey`. A missing member fails to compile. */
type Assert<T extends true> = T;
export type ChannelKeysAreComplete = Assert<
  Exclude<ChannelKey, (typeof CHANNEL_KEYS)[number]> extends never ? true : false
>;

/** A number as the server sent it, to two places when it has a fraction. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * The availability fact for one channel.
 *
 * Prefers the engine's own `provenance.availability`, so the surface and observation
 * time travel with the value. Falling back to the bare enum keeps the value visible
 * without inventing a provenance for it, and a missing row is unknown rather than
 * `UNAVAILABLE` — "no row" and "no contact identifier" are different statements.
 */
function availabilityFact(state: ChannelState | null): ObservedFact {
  const observed = state?.provenance?.availability;
  if (observed && !observed.isUnknown && observed.value != null) return observed;
  const value = state?.availability;
  const unknown = value == null || value === "UNKNOWN";
  return {
    value: unknown ? null : value,
    isUnknown: unknown,
    sourceSurface: null,
    observedAt: observed?.observedAt ?? null,
    isStale: observed?.isStale ?? false,
    isDerived: false,
  };
}

/** The provenance line `ObservedValue` prints, for the two measures that have one. */
function ProvenanceLine({ fact }: { fact: ObservedFact | undefined }) {
  if (!fact || (fact.sourceSurface == null && fact.observedAt == null)) return null;
  return (
    <span className="mt-0.5 block text-[11px] text-slate-500">
      <span className="sr-only">Observed on </span>
      {fact.sourceSurface ? SURFACE_LABEL[fact.sourceSurface] ?? fact.sourceSurface : UNKNOWN_TEXT}
      {" · "}
      {fact.observedAt ? (
        <time dateTime={fact.observedAt} title={absTime(fact.observedAt)}>
          {relTime(fact.observedAt)}
        </time>
      ) : (
        UNKNOWN_TEXT
      )}
    </span>
  );
}

interface FieldRowProps {
  label: string;
  /** The field name, so a test and a reader can address one channel's one field. */
  field: string;
  children: ReactNode;
  provenance?: ObservedFact;
}

/** One `<dt>`/`<dd>` pair, in the markup `ObservedValue` uses inside a `<dl>`. */
function FieldRow({ label, field, children, provenance }: FieldRowProps) {
  return (
    <div className="min-w-0" data-field={field}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</dt>
      <dd className="mt-0.5">
        {children}
        <ProvenanceLine fact={provenance} />
      </dd>
    </div>
  );
}

/** A measure on the hundredths scale, or "Unknown" where there is no row to read. */
function Measure({ value }: { value: number | null | undefined }) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <span className="text-[13px] font-medium text-slate-500">
        {UNKNOWN_TEXT}
        <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
      </span>
    );
  }
  return <span className="text-[13px] font-semibold text-zinc-900">{formatNumber(value)}</span>;
}

/** An observation time, or "Unknown" — a channel with no last inbound has never had one. */
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

export interface ChannelColumnProps {
  channel: ChannelKey;
  /** This channel's state, or null when the payload holds no row for it. */
  state: ChannelState | null;
  className?: string;
}

/**
 * One channel's column.
 *
 * Receives one `ChannelState` and has no way to reach another, which is where R6.5 is
 * enforced rather than asserted: there is no second row in scope to average with.
 */
export function ChannelColumn({ channel, state, className }: ChannelColumnProps) {
  const headingId = useId();
  const label = CHANNEL_LABEL[channel] ?? channel;
  const tone = TONE[CHANNEL_TONE[channel] ?? "zinc"] ?? TONE.zinc;
  const unavailable = state?.availability === "UNAVAILABLE";
  const provenance = state?.provenance ?? {};

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-channel={channel}
      className={cn("min-w-0 rounded-md border border-zinc-200 bg-white p-3", className)}
    >
      <h3 id={headingId} className="text-sm font-semibold text-zinc-900">
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]", tone)}>
          {label}
        </span>
      </h3>

      {/* The reason a zero suitability is not a low score, as text beside it (R6.6). */}
      {unavailable && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{CHANNEL_PANEL_LABELS.unavailableNote}</p>
      )}

      {state == null ? (
        <p className="mt-2 text-[13px] text-slate-500">{CHANNEL_PANEL_LABELS.noState}</p>
      ) : (
        <dl className="mt-2 grid grid-cols-1 gap-2">
          {/* The one field with its own surface, through the one primitive allowed to
              render a fact (R14.2, R28.3). */}
          <ObservedValue
            label={CHANNEL_PANEL_LABELS.fields.availability}
            fact={availabilityFact(state)}
            hideProvenance={
              provenance.availability?.sourceSurface == null && provenance.availability?.observedAt == null
            }
          />

          <FieldRow label={CHANNEL_PANEL_LABELS.fields.reachability} field="reachability">
            <Measure value={state.reachability} />
          </FieldRow>

          <FieldRow
            label={CHANNEL_PANEL_LABELS.fields.activity}
            field="activity"
            provenance={provenance.activity}
          >
            <Measure value={state.activity} />
          </FieldRow>

          <FieldRow label={CHANNEL_PANEL_LABELS.fields.engagement} field="engagement">
            <Measure value={state.engagement} />
          </FieldRow>

          <FieldRow
            label={CHANNEL_PANEL_LABELS.fields.responsiveness}
            field="responsiveness"
            provenance={provenance.responsiveness}
          >
            <Measure value={state.responsiveness} />
          </FieldRow>

          <FieldRow label={CHANNEL_PANEL_LABELS.fields.responseRate} field="response_rate">
            <Measure value={state.responseRate} />
          </FieldRow>

          <FieldRow
            label={CHANNEL_PANEL_LABELS.fields.historicalConversionRate}
            field="historical_conversion_rate"
          >
            <Measure value={state.historicalConversionRate} />
          </FieldRow>

          <FieldRow label={GTM_UI_LABELS.confidence} field="confidence">
            <Measure value={state.confidence} />
          </FieldRow>

          {/* R6.6 — an unreachable channel was not scored, and the slot says so
              instead of showing the zero the engine writes there. */}
          <FieldRow label={CHANNEL_PANEL_LABELS.fields.suitability} field="suitability">
            {unavailable ? (
              <span className="text-[13px] font-medium text-slate-500">
                {CHANNEL_PANEL_LABELS.notScored}
                <span className="sr-only">{CHANNEL_PANEL_LABELS.notScoredSrNote}</span>
              </span>
            ) : (
              <Measure value={state.suitability} />
            )}
          </FieldRow>

          <FieldRow label={CHANNEL_PANEL_LABELS.fields.lastInteractionAt} field="last_interaction_at">
            <Instant iso={state.lastInteractionAt} />
          </FieldRow>

          <FieldRow label={CHANNEL_PANEL_LABELS.fields.lastInboundAt} field="last_inbound_at">
            <Instant iso={state.lastInboundAt} />
          </FieldRow>

          <FieldRow label={CHANNEL_PANEL_LABELS.fields.lastOutboundAt} field="last_outbound_at">
            <Instant iso={state.lastOutboundAt} />
          </FieldRow>

          {/* Rendered only when there is a cooldown. A null `cooldown_until` means no
              cooldown is set, which is neither an unknown nor a zero, and a row
              claiming either would be this panel inventing a fact. */}
          {state.cooldownUntil && (
            <FieldRow label={CHANNEL_PANEL_LABELS.fields.cooldownUntil} field="cooldown_until">
              <Instant iso={state.cooldownUntil} />
            </FieldRow>
          )}

          {/* A count from the ledger, not a measure: zero unanswered messages is a
              real count and renders as one. */}
          <FieldRow label={CHANNEL_PANEL_LABELS.fields.consecutiveUnanswered} field="consecutive_unanswered">
            <span className="text-[13px] font-semibold text-zinc-900">
              {formatNumber(state.consecutiveUnanswered ?? 0)}
            </span>
          </FieldRow>
        </dl>
      )}
    </div>
  );
}

export interface ChannelIntelligencePanelProps {
  /** `ProspectStateFull.channels` — one row per channel, exactly as the server sent them. */
  channels: ChannelState[];
  className?: string;
}

export function ChannelIntelligencePanel({ channels, className }: ChannelIntelligencePanelProps) {
  const titleId = useId();
  const noteId = useId();

  // One lookup, so each column is handed its own row and nothing holds two.
  const byChannel = new Map<string, ChannelState>();
  for (const state of channels ?? []) {
    if (!byChannel.has(state.channel)) byChannel.set(state.channel, state);
  }

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <BarChart3 className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        {CHANNEL_PANEL_LABELS.title}
      </h2>
      <p id={noteId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {CHANNEL_PANEL_LABELS.note}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-describedby={noteId}>
        {CHANNEL_KEYS.map((channel) => (
          <ChannelColumn key={channel} channel={channel} state={byChannel.get(channel) ?? null} />
        ))}

        {/* A channel the backend adds tomorrow renders as itself rather than being
            dropped for being unfamiliar. Still one column per row, still no blend. */}
        {[...byChannel.keys()]
          .filter((channel) => !(CHANNEL_KEYS as readonly string[]).includes(channel))
          .map((channel) => (
            <ChannelColumn
              key={channel}
              channel={channel as ChannelKey}
              state={byChannel.get(channel) ?? null}
            />
          ))}
      </div>
    </section>
  );
}

export default ChannelIntelligencePanel;
