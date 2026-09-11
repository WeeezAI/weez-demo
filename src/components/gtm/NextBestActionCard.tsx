// components/gtm/NextBestActionCard.tsx
//
// The primary element of an activated prospect's dossier: what to do, and why now.
//
// ─── Why this exists beside `NextActionPanel` rather than instead of it ───────
//
// `NextActionPanel` is the *execution* panel. It carries the message composer, the
// open-channel control, the confirm ladder and the feedback controls, and it is right where
// it is. This is the *decision* card: the two sentences an operator needs to know whether
// this prospect wants their attention at all, and a way through to the evidence and the
// execution if it does.
//
// The distinction is the whole point of the restructure. Prospect Intelligence answers
// "what should I do with this person right now, and why" in a few seconds. Mounting the
// full execution panel at the top of the dossier would answer it in about forty lines of
// controls, which is the information dump this card exists to avoid. So the reasoning and
// the execution are both one interaction away, and neither is on screen until asked for.
//
// Nothing here is composed at render time. `GTM_NBA_ACTION_LABELS` supplies the action
// name, `WhyNowList` — the same component `ActionExplanation` uses for its first section —
// renders the timing bullets from the references the evaluation persisted, and
// `UNEXECUTABLE_REASON_LABELS` says why a recommendation cannot be acted on when it
// cannot. A recommendation that has no persisted reasoning says so rather than being given
// a sentence.
//
// ─── Progressive disclosure ───────────────────────────────────────────────────
//
//   closed   NEXT BEST ACTION · the action · Why now? · the leading signal
//   opened   every timing bullet, then the full four-section explanation
//
// A native `<details>`/`<summary>`, for the reason `GTMProspect` uses one: it is focusable
// and Enter/Space operable as it stands, with no `aria-expanded` of ours to keep in sync
// with the element's own `open`.

import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CandidateAction, PriorityTier } from "@/services/gtmAPI";
import { ActionExplanation, WhyNowList } from "./ActionExplanation";
import {
  UNEXECUTABLE_REASON_LABELS,
  PRIORITY_TIER_LABELS,
} from "./NextActionPanel";
import {
  GTM_NBA_ACTION_LABELS,
  GTM_SIGNAL_TYPE_LABELS,
  CHANNEL_LABEL,
  TONE,
  absTime,
  relTime,
} from "./labels";

export const NEXT_BEST_ACTION_CARD_LABELS = {
  eyebrow: "Next best action",
  whyNow: "Why now?",
  /** The disclosure. Named for what it reveals rather than "Show more". */
  viewWhy: "View why",
  takeAction: "Take action",
  /**
   * No reasoning was persisted for this recommendation.
   *
   * Distinct from "no recommendation": something *was* recommended, and the argument for
   * it was not stored. Saying so is better than composing a sentence here, which would be
   * this card inventing the reasoning it exists to report.
   */
  noReasoning: "No timing reasoning was recorded for this recommendation.",
  /**
   * A timing bullet whose signal type was not recorded.
   *
   * Rare and not the same as `noReasoning`: something *was* observed and contributed to the
   * score, and what kind of thing it was did not travel. Saying "something we observed" is
   * true; naming a type would not be.
   */
  somethingObserved: "Something we observed",
} as const;

export interface NextBestActionCardProps {
  /** The recommended candidate — `NextBestAction.recommended`. */
  action: CandidateAction;
  /** The queue's band for this prospect, when the queue was read. Absent renders no tag. */
  priorityTier?: PriorityTier | null;
  /**
   * Go and do it. Routed to the execution surface, which owns the composer and the
   * open-channel control; this card never posts an action itself.
   *
   * Offered only where the server says the recommendation is executable. `executable` is
   * the only field a "do this now" affordance may read — a verb exists *and* its channel
   * has a registered adapter.
   */
  onTakeAction: () => void;
  className?: string;
}

export function NextBestActionCard({
  action,
  priorityTier = null,
  onTakeAction,
  className,
}: NextBestActionCardProps) {
  const title = GTM_NBA_ACTION_LABELS[action.actionType] ?? action.actionType;
  const channel = action.channel ? CHANNEL_LABEL[action.channel] ?? action.channel : null;
  const whyNow = action.explanation?.whyNow ?? [];
  const leading = whyNow.slice(0, 1);

  return (
    <section
      aria-labelledby="gtm-nba-card-heading"
      data-gtm-section="next-best-action"
      className={cn(
        "rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/70 to-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-violet-500">
          <Zap className="h-3 w-3" aria-hidden="true" />
          {NEXT_BEST_ACTION_CARD_LABELS.eyebrow}
        </p>
        {/* The band, not a score, so it carries no disclaimer. Absent when the queue was
            not read for this prospect — never defaulted to LATER, which is a real tier. */}
        {priorityTier && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              TONE.violet
            )}
          >
            {PRIORITY_TIER_LABELS[priorityTier] ?? priorityTier}
          </span>
        )}
      </div>

      {/* The decision, in the largest type on the card. */}
      <h2
        id="gtm-nba-card-heading"
        className="mt-1.5 text-[19px] font-semibold leading-tight tracking-tight text-zinc-900"
      >
        {title}
        {channel && <span className="text-zinc-400"> · {channel}</span>}
      </h2>

      {/* ── Why now, as a sentence ──
          The most important line on the card, so it is written for a rep rather than for
          somebody auditing a score.

          `WhyNowList` — the shared component — renders a bullet as
          `POST_ENGAGEMENT · 4 days ago · Effective strength: 68 · [Timing fit]`, which is
          exactly right in the expanded evidence below and wrong here: a rep has to translate
          three of those four before they can decide anything. So the summary composes the
          two parts that carry the decision — what happened, and when — and the full bullet
          with its strength and term is one click away, unchanged.

          Both come from persisted fields. Nothing is generated: the event name is a lookup
          on the signal type the evaluation recorded, and the time is its own timestamp. */}
      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {NEXT_BEST_ACTION_CARD_LABELS.whyNow}
        </p>
        <div className="mt-1">
          {leading.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-slate-500">
              {NEXT_BEST_ACTION_CARD_LABELS.noReasoning}
            </p>
          ) : (
            <ul className="space-y-1">
              {leading.map((bullet, index) => (
                <li
                  key={`${bullet.signalId ?? "signal"}-${index}`}
                  className="text-[13.5px] leading-snug text-zinc-800"
                  data-signal-type={bullet.signalType ?? undefined}
                >
                  <span className="font-semibold">
                    {bullet.signalType
                      ? GTM_SIGNAL_TYPE_LABELS[bullet.signalType] ?? bullet.signalType
                      : NEXT_BEST_ACTION_CARD_LABELS.somethingObserved}
                  </span>
                  {bullet.eventTimestamp && (
                    <>
                      {" "}
                      <time
                        dateTime={bullet.eventTimestamp}
                        title={absTime(bullet.eventTimestamp)}
                        className="text-zinc-500"
                      >
                        {relTime(bullet.eventTimestamp)}
                      </time>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {action.executable ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 rounded-full bg-violet-600 text-xs hover:bg-violet-700"
            onClick={onTakeAction}
          >
            {NEXT_BEST_ACTION_CARD_LABELS.takeAction}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : (
          // Not a disabled button. An advisory recommendation — WAIT, NURTURE,
          // RESEARCH_MORE — *is* the output, and a greyed-out control would frame a real
          // answer as a broken one. The three cases are told apart by the server.
          action.unexecutableReason && (
            <p className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[11.5px] text-slate-600">
              {UNEXECUTABLE_REASON_LABELS[action.unexecutableReason]}
            </p>
          )
        )}
      </div>

      {/* The evidence, one interaction away. Mounted only when opened: `ActionExplanation`
          renders four sections and there is no reason to build them for a card nobody has
          asked to expand. */}
      <details className="group mt-3 border-t border-violet-100 pt-3">
        <summary className="inline-flex cursor-pointer items-center gap-1 rounded text-[11.5px] font-semibold text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {NEXT_BEST_ACTION_CARD_LABELS.viewWhy}
          <ArrowRight
            className="h-3 w-3 transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-2.5 space-y-3">
          {whyNow.length > 1 && <WhyNowList bullets={whyNow} />}
          <ActionExplanation explanation={action.explanation ?? null} />
        </div>
      </details>
    </section>
  );
}

export default NextBestActionCard;
