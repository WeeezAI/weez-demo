// components/gtm/ActionExplanation.tsx
//
// The four sections a recommendation argues itself with (R16.1, R16.2, R16.3, R27.1).
//
// `why now`, `why this channel`, `why this message`, `why not the other channels`. Four
// sections because they answer four different objections, and a founder overruling a
// recommendation is objecting to exactly one of them. Folding them into one paragraph
// would make the disagreement unaddressable.
//
// Three rules govern this file.
//
// **Absent is never zero.** Every row is a `FactorContribution`, and a factor nobody
// could observe renders as not observed — `DIRECTION_LABEL.UNAVAILABLE`, the server's
// `unavailableReason` beside it — rather than as a zero contribution. A zero says "we
// looked and this counted for nothing"; an absence says "we could not look". The two
// lead to different decisions, which is why `FactorReasoningList` is reused here rather
// than reimplemented: it already draws that distinction, and one drawing of it is what
// keeps it consistent between a channel score and an action score.
//
// **A never-scored alternative is not a badly-scored one.** In
// `whyNotTheOtherChannels`, `actionScore.score === null` beside an `exclusionReason`
// means the candidate was excluded *before* aggregation — do-not-contact, an unreachable
// channel, an unmet precondition — so there is no number, and there was never going to
// be one. A candidate that scored and lost has a number and a list of terms that pulled
// it down. This component branches on that before it reaches `DerivedScore`, because
// `DerivedScore` renders a null score as "Unknown" and "Unknown" would read as a
// measurement we mislaid rather than one we declined to take. The never-scored branch
// says "Not scored", says why, and shows no number; the scored branch shows the number
// and what lowered it. Both carry `data-scored` so the distinction is addressable
// without reading prose.
//
// **The explanation is composed from persisted terms, not from prose written here**
// (R16.6). Every string in this file is a heading, a label, or a note about how to read
// the section. The claims — signal ids, event timestamps, effective strengths,
// contributions, exclusion reasons, grounding ids, versions — are all rendered from the
// payload, so the same explanation renders the same way twice and can be audited against
// the rows it was built from (R16.4).
//
// Nothing here computes. `FACTOR_LABEL`, `GTM_NBA_ACTION_LABELS`, `GTM_EXCLUSION_LABELS`
// and `CHANNEL_LABEL` are lookups and `relTime` is a format. A value missing from a
// label table renders raw — `labels.ts` carries no `SignalType` or `MessagePurpose`
// table, and the documented convention is the raw value rather than an invented string.

import { type ReactNode, useId } from "react";
import { Ban, Compass, Lightbulb, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChannelComparison, RecommendationExplanation, WhyNow, WhyThisMessage } from "@/services/gtmAPI";
import { DerivedScore } from "./DerivedScore";
import { FactorReasoningList } from "./ChannelRecommendationPanel";
import { LearningScopeDecisionSummary } from "./LearningInsightsPanel";
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "./ObservedValue";
import {
  CHANNEL_LABEL,
  CHANNEL_TONE,
  FACTOR_LABEL,
  GTM_EXCLUSION_LABELS,
  GTM_NBA_ACTION_LABELS,
  GTM_UI_LABELS,
  TONE,
  absTime,
  relTime,
} from "./labels";

/**
 * The strings this component needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS`
 * established, because `labels.ts` is closed for this feature.
 *
 * `notScored` / `notScoredNote` and `scoredLower` / `heldAfterScoring` are the four
 * strings that keep the two kinds of rejected alternative apart. Nothing else in this
 * object is load-bearing.
 */
export const ACTION_EXPLANATION_LABELS = {
  title: "Why this action",
  note: "Four sections, composed from the terms the evaluation persisted. Nothing here is written at render time.",

  whyNow: "Why now",
  whyThisChannel: "Why this channel",
  whyThisMessage: "Why this message",
  whyNotTheOtherChannels: "Why not the other channels",

  // why now
  whyNowNote: "The signals whose effective strength moved the score, with the evidence behind each one.",
  whyNowEmpty: "No timing signals recorded for this recommendation.",
  effectiveStrength: "Effective strength",
  contribution: "Contribution",
  contributionAbsent: "Not recorded",
  signal: "Signal",
  evidence: "Evidence",
  term: "Term",

  // why this channel
  whyThisChannelNote:
    "Each term as the evaluation read it. A term nobody could observe is left out of the score rather than counted as zero.",

  // why this message
  whyThisMessageNote: "The facts an angle should be grounded in. Not a draft — the recommendation is made first.",
  whyThisMessageEmpty: "No message grounding recorded for this recommendation.",
  messagePurpose: "Purpose",
  groundingSignals: "Grounded in",
  noGroundingSignals: "No grounding signals recorded",
  noDraftYet: "No draft written yet",
  draft: "Draft",

  // why not the other channels
  whyNotNote:
    "Every alternative that was considered. One that was never scored is shown as never scored, not as a low number.",
  whyNotEmpty: "No alternatives recorded for this evaluation.",
  notScored: "Not scored",
  notScoredNote: "Excluded before scoring, so there is no number to compare against the recommendation.",
  notScoredSrNote: " (excluded before scoring)",
  scoredLower: "Scored lower",
  heldAfterScoring: "Scored, then held.",
  loweringTerms: "What lowered it",

  // footer
  scopeHeading: "Learning scope applied",
  versionsHeading: "Versions",
  policyVersion: "Policy",
  modelVersion: "Model",
  learningVersion: "Learning",
  weightSet: "Weight set",

  empty: "No explanation recorded for this recommendation.",
} as const;

/** A number as the server sent it, to two places when it has a fraction. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** One section: a heading, a note about how to read it, and the rows. */
function Section({
  icon: Icon,
  heading,
  note,
  children,
}: {
  icon: typeof Lightbulb;
  heading: string;
  note: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const noteId = useId();

  return (
    <div className="min-w-0" role="group" aria-labelledby={headingId} data-section={heading}>
      <h3 id={headingId} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        <Icon className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
        {heading}
      </h3>
      <p id={noteId} className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
        {note}
      </p>
      <div className="mt-1.5" aria-describedby={noteId}>
        {children}
      </div>
    </div>
  );
}

export interface WhyNowListProps {
  bullets: WhyNow[];
  className?: string;
}

/**
 * The first section: which signals made this the moment.
 *
 * `signalType` renders raw — `labels.ts` carries no table for the 29 values and the
 * convention on a miss is the raw value. `contributionHundredths` is nullable and a null
 * reads "Not recorded" rather than `0`: the term fed the score, and how much it fed it
 * was not persisted for this row.
 */
export function WhyNowList({ bullets, className }: WhyNowListProps) {
  if (!bullets || bullets.length === 0) {
    return <p className={cn("text-[11px] text-slate-500", className)}>{ACTION_EXPLANATION_LABELS.whyNowEmpty}</p>;
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {bullets.map((bullet, index) => {
        const termLabel = bullet.term ? FACTOR_LABEL[bullet.term] ?? bullet.term : null;
        return (
          <li
            key={`${bullet.signalId ?? "signal"}-${index}`}
            className="text-[12px] leading-snug"
            data-signal-type={bullet.signalType ?? undefined}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-semibold text-zinc-900">
                {bullet.signalType ?? (
                  <>
                    {UNKNOWN_TEXT}
                    <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
                  </>
                )}
              </span>

              {bullet.eventTimestamp && (
                <time
                  dateTime={bullet.eventTimestamp}
                  title={absTime(bullet.eventTimestamp)}
                  className="text-[11px] text-slate-500"
                >
                  {relTime(bullet.eventTimestamp)}
                </time>
              )}

              <span className="text-[11px] text-slate-600">
                {ACTION_EXPLANATION_LABELS.effectiveStrength}
                {": "}
                <span className="font-semibold text-zinc-800">{formatNumber(bullet.effectiveStrength)}</span>
              </span>

              {termLabel && (
                <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold", TONE.zinc)}>
                  <span className="sr-only">{ACTION_EXPLANATION_LABELS.term}: </span>
                  {termLabel}
                </span>
              )}
            </div>

            <p className="mt-0.5 break-all text-[11px] text-slate-500">
              {ACTION_EXPLANATION_LABELS.contribution}
              {": "}
              {/* Null is an absence, not a zero contribution. */}
              {bullet.contributionHundredths == null
                ? ACTION_EXPLANATION_LABELS.contributionAbsent
                : formatNumber(bullet.contributionHundredths)}
              {bullet.signalId && (
                <>
                  {" · "}
                  {ACTION_EXPLANATION_LABELS.signal}
                  {": "}
                  {bullet.signalId}
                </>
              )}
              {/* The evidence id, so the claim is inspectable through the reads that
                  already exist (R16.4). */}
              {bullet.evidenceId && (
                <>
                  {" · "}
                  {ACTION_EXPLANATION_LABELS.evidence}
                  {": "}
                  {bullet.evidenceId}
                </>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export interface WhyThisMessageSectionProps {
  message: WhyThisMessage | null | undefined;
  className?: string;
}

/**
 * The third section: which facts an angle should be grounded in.
 *
 * `messageId` is null until a draft exists, which is the common case, so the absence is
 * stated rather than left to look like a missing field.
 */
export function WhyThisMessageSection({ message, className }: WhyThisMessageSectionProps) {
  if (!message) {
    return (
      <p className={cn("text-[11px] text-slate-500", className)}>{ACTION_EXPLANATION_LABELS.whyThisMessageEmpty}</p>
    );
  }

  const grounding = message.groundingSignalIds ?? [];

  return (
    <div className={cn("min-w-0 text-[12px] leading-snug", className)} data-has-draft={message.messageId ? "true" : "false"}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[11px] text-slate-600">
          {ACTION_EXPLANATION_LABELS.messagePurpose}
          {": "}
          <span className="font-semibold text-zinc-800">
            {message.messagePurpose ?? (
              <>
                {UNKNOWN_TEXT}
                <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
              </>
            )}
          </span>
        </span>

        <span className="text-[11px] text-slate-600">
          {message.messageId ? (
            <>
              {ACTION_EXPLANATION_LABELS.draft}
              {": "}
              <span className="break-all font-semibold text-zinc-800">{message.messageId}</span>
            </>
          ) : (
            ACTION_EXPLANATION_LABELS.noDraftYet
          )}
        </span>
      </div>

      <p className="mt-0.5 break-all text-[11px] text-slate-500">
        {grounding.length > 0 ? (
          <>
            {ACTION_EXPLANATION_LABELS.groundingSignals}
            {": "}
            {grounding.join(", ")}
          </>
        ) : (
          ACTION_EXPLANATION_LABELS.noGroundingSignals
        )}
      </p>

      {/* The server's note, verbatim. */}
      {message.note && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{message.note}</p>}
    </div>
  );
}

export interface RejectedAlternativeProps {
  comparison: ChannelComparison;
  className?: string;
}

/**
 * One rejected alternative — and the one place the two kinds of rejection are told apart.
 *
 * `score === null` is the never-scored branch: excluded before aggregation, so no number
 * exists and none is shown. Anything else scored, and the number plus the terms that
 * pulled it down are what the reader compares. An alternative that scored *and* carries
 * an exclusion reason is a third case, and it says both: here is the number, and here is
 * why it was held anyway.
 */
export function RejectedAlternative({ comparison, className }: RejectedAlternativeProps) {
  const headingId = useId();
  const actionLabel = GTM_NBA_ACTION_LABELS[comparison.actionType] ?? comparison.actionType;
  const channelTone = comparison.channel ? TONE[CHANNEL_TONE[comparison.channel] ?? "zinc"] ?? TONE.zinc : TONE.zinc;
  const exclusionLabel = comparison.exclusionReason
    ? GTM_EXCLUSION_LABELS[comparison.exclusionReason] ?? comparison.exclusionReason
    : null;

  // The distinction, in one predicate: a null score was never computed. This is checked
  // before `DerivedScore` is reached, because `DerivedScore` would render it "Unknown"
  // and an unmeasured alternative is not a mislaid measurement.
  const neverScored = comparison.actionScore?.score == null;
  const loweringTerms = comparison.loweringTerms ?? [];

  return (
    <li
      className={cn("min-w-0 rounded-md border border-zinc-200 bg-white p-3", className)}
      data-action-type={comparison.actionType}
      data-scored={neverScored ? "never" : "scored"}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h4 id={headingId} className="text-[12px] font-semibold text-zinc-900">
          {actionLabel}
        </h4>

        {comparison.channel && (
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", channelTone)}>
            {CHANNEL_LABEL[comparison.channel] ?? comparison.channel}
          </span>
        )}

        {/* Which of the two rejections this is, as text rather than as an absence the
            reader has to notice (R18.9, R27.8). */}
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", TONE.zinc)}>
          {neverScored ? ACTION_EXPLANATION_LABELS.notScored : ACTION_EXPLANATION_LABELS.scoredLower}
          {neverScored && <span className="sr-only">{ACTION_EXPLANATION_LABELS.notScoredSrNote}</span>}
        </span>
      </div>

      {/* Why it was held, whichever branch it is in. A reason travels with every
          exclusion, which is the whole value of generating a candidate and excluding it
          rather than dropping it (R13.3). */}
      {exclusionLabel && <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{exclusionLabel}</p>}

      {neverScored ? (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{ACTION_EXPLANATION_LABELS.notScoredNote}</p>
      ) : (
        <>
          <div className="mt-1.5">
            <DerivedScore score={comparison.actionScore} size="sm" />
          </div>

          {exclusionLabel && (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {ACTION_EXPLANATION_LABELS.heldAfterScoring}
            </p>
          )}

          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
            {ACTION_EXPLANATION_LABELS.loweringTerms}
          </p>
          {/* The same rows as every other reasoning list, so an unavailable term reads as
              not observed here too (R16.3). */}
          <FactorReasoningList factors={loweringTerms} className="mt-1" />
        </>
      )}
    </li>
  );
}

export interface ActionExplanationProps {
  /** `CandidateAction.explanation` — populated on the recommended row, null elsewhere. */
  explanation: RecommendationExplanation | null | undefined;
  className?: string;
}

/**
 * The four sections, in the order a reader raises the objections.
 *
 * A null explanation says so. It is not an error — `explanation` is populated on the
 * recommended row and null on the others, and a recommendation with none has simply not
 * been argued yet.
 */
export function ActionExplanation({ explanation, className }: ActionExplanationProps) {
  const titleId = useId();

  if (!explanation) {
    return (
      <section
        className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Lightbulb className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          {ACTION_EXPLANATION_LABELS.title}
        </h2>
        <p className="mt-2 text-[13px] text-slate-500">{ACTION_EXPLANATION_LABELS.empty}</p>
      </section>
    );
  }

  const alternatives = explanation.whyNotTheOtherChannels ?? [];
  const versions = explanation.versions;

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <Lightbulb className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        {ACTION_EXPLANATION_LABELS.title}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{ACTION_EXPLANATION_LABELS.note}</p>

      <div className="mt-3 space-y-4">
        <Section
          icon={Lightbulb}
          heading={ACTION_EXPLANATION_LABELS.whyNow}
          note={ACTION_EXPLANATION_LABELS.whyNowNote}
        >
          <WhyNowList bullets={explanation.whyNow ?? []} />
        </Section>

        <Section
          icon={Compass}
          heading={ACTION_EXPLANATION_LABELS.whyThisChannel}
          note={ACTION_EXPLANATION_LABELS.whyThisChannelNote}
        >
          {/* Each row a `FactorContribution`, through the shared list — which is where
              "unavailable, not zero" is enforced rather than restated. */}
          <FactorReasoningList factors={explanation.whyThisChannel ?? []} />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{GTM_UI_LABELS.unavailableNote}</p>
        </Section>

        <Section
          icon={MessageSquare}
          heading={ACTION_EXPLANATION_LABELS.whyThisMessage}
          note={ACTION_EXPLANATION_LABELS.whyThisMessageNote}
        >
          <WhyThisMessageSection message={explanation.whyThisMessage} />
        </Section>

        <Section
          icon={Ban}
          heading={ACTION_EXPLANATION_LABELS.whyNotTheOtherChannels}
          note={ACTION_EXPLANATION_LABELS.whyNotNote}
        >
          {alternatives.length === 0 ? (
            <p className="text-[11px] text-slate-500">{ACTION_EXPLANATION_LABELS.whyNotEmpty}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {alternatives.map((comparison, index) => (
                <RejectedAlternative
                  key={`${comparison.actionType}-${comparison.channel ?? "none"}-${index}`}
                  comparison={comparison}
                />
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* The scope the evaluation applied, rendered through the same summary
          `LearningInsightsPanel` uses so one decision does not read two ways. */}
      <div className="mt-4 border-t border-zinc-100 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
          {ACTION_EXPLANATION_LABELS.scopeHeading}
        </p>
        <LearningScopeDecisionSummary decision={explanation.scope} className="mt-1" />
      </div>

      {/* Four values, not one composite string: they move independently, and a reader
          checking a persisted score against a policy needs to know which policy (R17). */}
      {versions && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
            {ACTION_EXPLANATION_LABELS.versionsHeading}
          </p>
          <dl className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {(
              [
                [ACTION_EXPLANATION_LABELS.policyVersion, "policy_version", versions.policyVersion],
                [ACTION_EXPLANATION_LABELS.modelVersion, "model_version", versions.modelVersion],
                [ACTION_EXPLANATION_LABELS.learningVersion, "learning_version", versions.learningVersion],
                [ACTION_EXPLANATION_LABELS.weightSet, "weight_set_id", versions.weightSetId],
              ] as const
            ).map(([label, field, value]) => (
              <div key={field} className="flex flex-wrap items-baseline gap-1.5" data-field={field}>
                <dt className="text-[11px] text-slate-500">{label}</dt>
                <dd className="break-all text-[11px] font-semibold text-zinc-800">
                  {value ?? (
                    <span className="font-medium text-slate-500">
                      {UNKNOWN_TEXT}
                      <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

export default ActionExplanation;
