// components/gtm/ChannelRecommendationPanel.tsx
//
// Three channels, three cards, one winner — and the winner is the server's
// (R18.3, R1.3, R1.7, R1.8).
//
// The panel renders `channels` in the order the API sent them and marks whichever
// one equals `recommendedChannel`. It does not sort, does not compare scores, and
// does not pick a winner when the server sent none: an evaluation that has not run
// reports no channels, and this panel says so rather than promoting the first card
// it happens to hold. The argmax is a documented total order over score, then
// confidence, then channel — resolved once, server-side, and persisted.
//
// Two things every card must say beyond its number:
//
// **Confidence.** Coverage caps it: any factor nobody could observe puts it below
// `HIGH` (R1.7). The chip pairs a tone with the words "Low / Medium / High
// confidence", so the reading survives a greyscale screenshot.
//
// **What could not be seen.** `unavailableFactors` is rendered as its own list,
// with the note that an unavailable factor was dropped from the weight mass rather
// than scored zero. "We could not see this" is part of why a recommendation says
// what it says, and burying it would make a thin score look like a confident one.
//
// No number is rendered raw. The score goes through `DerivedScore` and arrives with
// its disclaimer; the weights and hundredth-contributions the payload also carries
// are deliberately not printed, because a bare `0.20` beside a factor name reads as
// precision this screen has not earned the right to claim.

import { useId } from "react";
import { Loader2, RefreshCw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ChannelResult, FactorContribution } from "@/services/gtmAPI";
import { DerivedScore } from "./DerivedScore";
import { UNKNOWN_TEXT } from "./ObservedValue";
import {
  CHANNEL_LABEL,
  CHANNEL_TONE,
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
  DIRECTION_LABEL,
  DIRECTION_TONE,
  FACTOR_LABEL,
  GTM_UI_LABELS,
  RECOMMENDATION_LABEL,
  TONE,
  absTime,
  relTime,
} from "./labels";

export interface ChannelRecommendationPanelProps {
  /** Exactly as the API sent them. Three results, or none. */
  channels: ChannelResult[];
  /** The server's argmax. `null` means no evaluation has run — not "pick one". */
  recommendedChannel: string | null;
  /** Which weight set produced these scores, when the payload names it. */
  weightSetLabel?: string | null;
  /** Ask for a fresh evaluation. Omit and the control is not rendered. */
  onReevaluate?: () => void;
  evaluating?: boolean;
  className?: string;
}

/**
 * One factor's contribution, in words.
 *
 * Shared with `CTAReadinessPanel`, because a reasoning row reads the same whether
 * the factor fed a channel score or a readiness score (R1.7, R9.5). `persistedValue`
 * is the raw value the engine actually read — printed as text, so the reasoning can
 * be checked against the record rather than taken on trust — and an absent one
 * reads "Unknown".
 */
export function FactorReasoningList({
  factors,
  className,
}: {
  factors: FactorContribution[];
  className?: string;
}) {
  if (!factors || factors.length === 0) {
    return <p className={cn("text-[11px] text-slate-500", className)}>{GTM_UI_LABELS.noReasoning}</p>;
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {factors.map((factor, index) => {
        const direction = factor.available ? factor.direction ?? "NEUTRAL" : "UNAVAILABLE";
        return (
          <li
            key={`${factor.factor}-${index}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] leading-snug"
          >
            <span className="font-medium text-zinc-800">
              {FACTOR_LABEL[factor.factor] ?? factor.factor}
            </span>
            <span className="text-slate-600">
              {factor.available ? factor.persistedValue ?? UNKNOWN_TEXT : UNKNOWN_TEXT}
            </span>
            <span
              className={cn(
                "rounded-full border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide",
                TONE[DIRECTION_TONE[direction] ?? "zinc"] ?? TONE.zinc,
              )}
            >
              {DIRECTION_LABEL[direction] ?? direction}
            </span>
            {!factor.available && factor.unavailableReason && (
              <span className="text-[11px] text-slate-500">{factor.unavailableReason}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ChannelCard({
  result,
  isRecommended,
}: {
  result: ChannelResult;
  isRecommended: boolean;
}) {
  const channel = result.channel ?? "";
  const confidence = result.confidence ?? "LOW";
  const tone = TONE[CHANNEL_TONE[channel] ?? "zinc"] ?? TONE.zinc;

  return (
    <li
      className={cn(
        "rounded-lg border p-4",
        isRecommended ? "border-zinc-900/20 bg-zinc-50 ring-1 ring-zinc-900/10" : "border-zinc-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", tone)}>
            {CHANNEL_LABEL[channel] ?? channel}
          </span>
        </h3>
        {/* The recommended-channel indicator (R18.3). Icon plus words, so the
            distinction is not carried by the ring alone. */}
        {isRecommended && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              TONE.emerald,
            )}
          >
            <Star className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {GTM_UI_LABELS.recommendedChannel}
          </span>
        )}
      </div>

      <div className="mt-3">
        <DerivedScore score={result.score} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            TONE[CONFIDENCE_TONE[confidence] ?? "zinc"] ?? TONE.zinc,
          )}
        >
          <span className="sr-only">{GTM_UI_LABELS.confidence}: </span>
          {CONFIDENCE_LABEL[confidence] ?? confidence}
        </span>
      </div>

      <p className="mt-3 text-[12px] font-medium leading-snug text-zinc-800">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {GTM_UI_LABELS.recommendation}
        </span>
        <span className="mt-0.5 block">
          {RECOMMENDATION_LABEL[result.recommendation] ?? result.recommendation ?? UNKNOWN_TEXT}
        </span>
      </p>

      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {GTM_UI_LABELS.reasoningHeading}
        </p>
        <FactorReasoningList factors={result.reasoning} className="mt-1.5" />
      </div>

      {result.unavailableFactors && result.unavailableFactors.length > 0 && (
        <div className="mt-3 border-t border-zinc-100 pt-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
            {GTM_UI_LABELS.unavailableHeading}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {result.unavailableFactors.map((factor) => (
              <li
                key={factor}
                className={cn(
                  "rounded-full border px-1.5 py-0 text-[10px] font-medium",
                  TONE.zinc,
                )}
              >
                {FACTOR_LABEL[factor] ?? factor}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            {GTM_UI_LABELS.unavailableNote}
          </p>
        </div>
      )}

      {result.computedAt && (
        <p className="mt-3 text-[11px] text-slate-500">
          {GTM_UI_LABELS.computed}{" "}
          <time dateTime={result.computedAt} title={absTime(result.computedAt)}>
            {relTime(result.computedAt)}
          </time>
        </p>
      )}
    </li>
  );
}

export function ChannelRecommendationPanel({
  channels,
  recommendedChannel,
  weightSetLabel,
  onReevaluate,
  evaluating = false,
  className,
}: ChannelRecommendationPanelProps) {
  const titleId = useId();
  const results = channels ?? [];

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-sm font-semibold text-zinc-900">
          {GTM_UI_LABELS.channelsTitle}
        </h2>
        {onReevaluate && (
          <Button variant="outline" size="sm" onClick={onReevaluate} disabled={evaluating}>
            {evaluating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {GTM_UI_LABELS.reevaluate}
          </Button>
        )}
      </div>

      {results.length === 0 ? (
        <p className="mt-3 text-[12px] leading-relaxed text-slate-500">{GTM_UI_LABELS.noEvaluation}</p>
      ) : (
        <>
          {!recommendedChannel && (
            <p className="mt-3 text-[11px] text-slate-500">{GTM_UI_LABELS.noRecommendedChannel}</p>
          )}
          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {results.map((result) => (
              <ChannelCard
                key={result.channel}
                result={result}
                // Equality against the server's answer. Not a comparison of scores.
                isRecommended={Boolean(recommendedChannel) && result.channel === recommendedChannel}
              />
            ))}
          </ul>
          {weightSetLabel && (
            <p className="mt-3 text-[11px] text-slate-500">Weight set: {weightSetLabel}</p>
          )}
        </>
      )}
    </section>
  );
}

export default ChannelRecommendationPanel;
