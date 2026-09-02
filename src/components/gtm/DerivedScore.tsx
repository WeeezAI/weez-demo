// components/gtm/DerivedScore.tsx
//
// A score is never a bare integer on this screen (R1.8, R9.6, R14.5).
//
// Three things always ship together: the number, the `derived` marker, and the
// disclaimer that says what kind of number it is. The disclaimer is real DOM text
// rather than a tooltip, so it survives a screen reader, a screenshot, and a
// copy-paste into a deck — which is exactly where a score gets quoted out of
// context and mistaken for a predicted probability.
//
// The disclaimer string is carried on the payload (`DerivedScore.scoreDisclaimer`),
// written by the engine that computed the score. This component renders it verbatim
// and composes nothing: a score with no disclaimer would rather show no disclaimer
// than one this file invented.
//
// `score === null` means the score could not be computed. It renders "Unknown",
// never `0` — a zero would claim we looked and found nothing worth counting.

import { useId } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DerivedScore as DerivedScorePayload } from "@/services/gtmAPI";
import { SCORE_KIND_LABEL } from "./labels";
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "./ObservedValue";

export interface DerivedScoreProps {
  score: DerivedScorePayload;
  /** Defaults to the payload's own score kind, e.g. "Recommendation score". */
  label?: string;
  /** `lg` for the panel headline number, `sm` beside a channel name. */
  size?: "sm" | "lg";
  className?: string;
}

export function DerivedScore({ score, label, size = "lg", className }: DerivedScoreProps) {
  const disclaimerId = useId();
  const kindLabel = label ?? SCORE_KIND_LABEL[score.scoreKind] ?? score.scoreKind;
  const hasDisclaimer = Boolean(score.scoreDisclaimer);
  const isUnknown = score.score === null || score.score === undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">{kindLabel}</p>

      {/* A `div`, not a `p`: `Badge` renders a `div` and may not nest in a paragraph. */}
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {isUnknown ? (
          <span className={cn("font-medium text-slate-500", size === "lg" ? "text-lg" : "text-[13px]")}>
            {UNKNOWN_TEXT}
            <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
          </span>
        ) : (
          <span
            className={cn("font-semibold leading-none text-zinc-900", size === "lg" ? "text-2xl" : "text-[15px]")}
            aria-describedby={hasDisclaimer ? disclaimerId : undefined}
          >
            {score.score}
          </span>
        )}

        {/* R14.5 — the marker rides with the number, not with the panel title. */}
        <Badge
          variant="outline"
          className="border-zinc-200 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500"
        >
          derived
        </Badge>
      </div>

      {hasDisclaimer && (
        <p id={disclaimerId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {score.scoreDisclaimer}
        </p>
      )}
    </div>
  );
}

export default DerivedScore;
