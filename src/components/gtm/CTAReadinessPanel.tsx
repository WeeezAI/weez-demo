// components/gtm/CTAReadinessPanel.tsx
//
// Whether this conversation is warm enough to ask for a meeting, and what produced
// that answer (R9.5, R9.6, R18.7).
//
// Four things ship together, and the fourth is the one that keeps the other three
// honest:
//
//   `score`         a derived number, through `DerivedScore`, so it arrives with the
//                   disclaimer that says it is a prioritisation signal and not a
//                   predicted probability (R9.6). Absent reads "Unknown", not `0`.
//   `ctaState`      the band or gate the engine landed on, as a chip whose tone comes
//                   from the shared `TONE` table and whose meaning is in its text.
//   `recommendedCta`the ask to make, in words.
//   `decidedBy`     whether a score band produced that state or an evidence gate did
//                   (R9.4). `MEETING_REQUESTED` and `MEETING_BOOKED` mirror the
//                   reconciled `conversation_state` and are never reached by
//                   arithmetic, so a reader who sees "Meeting booked" can tell
//                   whether Weez observed a booking or merely scored one highly.
//
// The reasoning list is the same component the channel cards use, because a factor
// row reads the same whether it fed a channel score or this one: the factor's name,
// the persisted value the engine actually read, and which way it pulled. Printing the
// persisted value means the reasoning can be checked against the record instead of
// taken on trust (R9.5).
//
// Nothing here computes. No band is re-derived, no state is inferred from the score,
// and the score is never compared against a threshold in the browser — if the server
// says `NOT_READY` at 71, this panel says `NOT_READY` at 71.

import { useId } from "react";
import { CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CTA } from "@/services/gtmAPI";
import { FactorReasoningList } from "./ChannelRecommendationPanel";
import { DerivedScore } from "./DerivedScore";
import { UNKNOWN_TEXT } from "./ObservedValue";
import {
  CTA_DECIDED_BY_LABEL,
  FIELD_LABEL,
  GTM_UI_LABELS,
  RECOMMENDED_CTA_LABEL,
  STATE_LABEL,
  STATE_TONE,
  TONE,
  absTime,
  relTime,
} from "./labels";

export interface CTAReadinessPanelProps {
  cta: CTA;
  className?: string;
}

export function CTAReadinessPanel({ cta, className }: CTAReadinessPanelProps) {
  const titleId = useId();
  const ctaState = cta.ctaState;
  const stateTone = TONE[STATE_TONE[ctaState] ?? "zinc"] ?? TONE.zinc;

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <CalendarCheck className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          {GTM_UI_LABELS.ctaTitle}
        </h2>
        {/* The state, as a chip. Tone from the shared table; the words carry the
            meaning, so the chip still reads correctly in greyscale (R18.9). */}
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            stateTone,
          )}
        >
          <span className="sr-only">{FIELD_LABEL.cta_state}: </span>
          {STATE_LABEL[ctaState] ?? ctaState}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DerivedScore score={cta.score} label={FIELD_LABEL.cta_score} />

        {/* The suggested ask. A `<dl>` because it is a label/value pair, and absent
            reads "Unknown" rather than inviting an ask the engine did not recommend. */}
        <dl className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            {GTM_UI_LABELS.recommendedCta}
          </dt>
          <dd className="mt-0.5 text-[13px] font-semibold leading-snug text-zinc-900">
            {cta.recommendedCta
              ? RECOMMENDED_CTA_LABEL[cta.recommendedCta] ?? cta.recommendedCta
              : UNKNOWN_TEXT}
          </dd>
        </dl>
      </div>

      {/* R9.5 — the specific persisted factors that produced the state. */}
      <div className="mt-4 border-t border-zinc-100 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {GTM_UI_LABELS.reasoningHeading}
        </p>
        <FactorReasoningList factors={cta.reasoning} className="mt-1.5" />
      </div>

      {/* Score band or evidence gate (R9.4). The distinction is the difference
          between "we scored this highly" and "we saw the booking". */}
      {(cta.decidedBy || cta.computedAt) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-zinc-100 pt-2.5 text-[11px] text-slate-500">
          {cta.decidedBy && (
            <span>
              {GTM_UI_LABELS.decidedBy}
              {": "}
              {CTA_DECIDED_BY_LABEL[cta.decidedBy] ?? cta.decidedBy}
            </span>
          )}
          {cta.computedAt && (
            <span>
              {GTM_UI_LABELS.computed}{" "}
              <time dateTime={cta.computedAt} title={absTime(cta.computedAt)}>
                {relTime(cta.computedAt)}
              </time>
            </span>
          )}
        </p>
      )}
    </section>
  );
}

export default CTAReadinessPanel;
