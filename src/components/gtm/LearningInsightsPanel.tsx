// components/gtm/LearningInsightsPanel.tsx
//
// What the loop learned, and where it decided not to (R22.1–R22.5, R28.1).
//
// Three rules govern this panel.
//
// **A success rate never appears without its interval.** Two replies out of three is
// 67%, and so is two hundred out of three hundred; read side by side without the sample
// size and the confidence interval they look like the same fact, and a founder acts on
// the first as if it were the second. So the rate, `sampleSize`, `ciLow` and `ciHigh`
// are rendered by one component — `SuccessRateInterval` — and there is no other code
// path in this file that prints `successRate`. The three cannot be separated by a later
// edit without deleting the component that binds them.
//
// **The decision not to learn is rendered as legibly as the decision to.** A thin
// sample keeps the broader statistic and records `INSUFFICIENT_SAMPLE_RETAINED`, which
// is a real answer — "we have this workspace's numbers and they are not yet worth
// preferring" — and not a missing one. It gets a chip with words in it, the counts that
// produced it (`sampleSize` against `minSample`), and the server's own
// `decisionReason` verbatim.
//
// **`appliedScope` is not always the narrowest scope that exists.** `scope` is the
// population a row was computed over; `appliedScope` is the one the evaluation actually
// used. They differ exactly when a sample was too thin, and both are rendered because a
// reader who sees only one of them cannot tell whether a `USER` statistic exists and was
// declined or never existed at all.
//
// Nothing here computes. The counts, the rate, the bounds and the reason are all
// persisted values; `GTM_NBA_ACTION_LABELS`, `CHANNEL_LABEL` and the two scope tables
// are lookups, and `relTime` is a format. A value missing from a label table renders
// raw — an unmapped key is a display gap, not a licence to invent a friendlier string.

import { type ReactNode, useId } from "react";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearningScope, LearningScopeDecision, LearningUpdate } from "@/services/gtmAPI";
import { UNKNOWN_SR_NOTE, UNKNOWN_TEXT } from "./ObservedValue";
import { CHANNEL_LABEL, CHANNEL_TONE, GTM_NBA_ACTION_LABELS, TONE, absTime, relTime } from "./labels";

/**
 * The strings this panel needs and `labels.ts` does not carry.
 *
 * One exported object, in the shape `NextActionPanel.tsx`'s `ACTION_CARD_LABELS`
 * established, because `labels.ts` is closed for this feature.
 *
 * `insufficientNote` and `appliedScopeNote` are the pair that keeps a retained broader
 * statistic from reading as a missing one: the first says what happened, the second says
 * why the applied scope is wider than the row's own.
 */
export const LEARNING_PANEL_LABELS = {
  title: "Learning insights",
  list: "Outcome statistics behind the recommendations",
  note: "Every rate here carries its sample size and its confidence interval. A rate without them invites reading two outcomes as a trend.",

  computedScope: "Computed over",
  appliedScope: "Applied",
  decision: "Decision",
  sampleSize: "Sample size",
  minSample: "Minimum sample",
  successRate: "Success rate",
  interval: "95% interval",
  meanReward: "Mean reward",
  positive: "Positive",
  negative: "Negative",
  excludedUnknown: "Excluded as unknown",
  learningVersion: "Learning version",
  computedAt: "Computed",

  insufficientNote:
    "Too thin to learn from, so the broader statistic was kept. The numbers here are recorded and will be applied once the sample reaches the minimum.",
  appliedScopeNote:
    "The applied scope is wider than the scope this row was computed over. A narrow statistic exists and was declined, which is not the same as one that never existed.",
  intervalSrNote: " (confidence interval, low to high)",

  empty: "No outcome statistics yet",
  emptyNote:
    "Nothing has been aggregated for this prospect's action types. Recommendations use configured domain priors until outcomes accumulate, and the confidence beside them is reduced to say so.",
  noScopeDecision: "No scope decision recorded for this evaluation.",
} as const;

/**
 * The three Learning_Scopes, in words.
 *
 * `GLOBAL` reads "All workspaces" rather than "Global": what the operator wants to know
 * is whose behaviour the number is about, and "global" is the system's word for that,
 * not theirs.
 */
export const LEARNING_SCOPE_LABEL: Record<string, string> = {
  GLOBAL: "All workspaces",
  WORKSPACE: "This workspace",
  USER: "You",
};

/**
 * The two decisions the loop records.
 *
 * `INSUFFICIENT_SAMPLE_RETAINED` names both halves — the sample was thin, and the
 * broader statistic was kept — because "insufficient" alone reads as a failure and this
 * is a deliberate choice with a recorded reason.
 */
export const LEARNING_DECISION_LABEL: Record<string, string> = {
  APPLIED: "Applied",
  INSUFFICIENT_SAMPLE_RETAINED: "Too thin — broader statistic kept",
};

/** Decoration only; the label carries the meaning (R18.9). Neither decision is rose. */
export const LEARNING_DECISION_TONE: Record<string, string> = {
  APPLIED: "emerald",
  INSUFFICIENT_SAMPLE_RETAINED: "zinc",
};

/** A number as the server sent it, to two places when it has a fraction. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** The scope in words, or the raw value — never a guess. */
function scopeLabel(scope: LearningScope | string): string {
  return LEARNING_SCOPE_LABEL[scope] ?? scope;
}

export interface SuccessRateIntervalProps {
  successRate: number;
  sampleSize: number;
  ciLow: number;
  ciHigh: number;
  className?: string;
}

/**
 * The rate, its sample size and its interval, as one node.
 *
 * The reason this is a component rather than three rows in a `<dl>`: a rate separated
 * from its interval is a misleading number, and the only reliable way to keep them
 * together is to leave no way to render one without the others. Every caller in this
 * file goes through here.
 */
export function SuccessRateInterval({
  successRate,
  sampleSize,
  ciLow,
  ciHigh,
  className,
}: SuccessRateIntervalProps) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5", className)}>
      <span className="text-[13px] font-semibold text-zinc-900">
        <span className="sr-only">{LEARNING_PANEL_LABELS.successRate}: </span>
        {formatNumber(successRate)}
      </span>
      <span className="text-[11px] text-slate-600">
        {LEARNING_PANEL_LABELS.interval}
        {": "}
        {formatNumber(ciLow)}
        <span aria-hidden="true">{" – "}</span>
        <span className="sr-only">{" to "}</span>
        {formatNumber(ciHigh)}
        <span className="sr-only">{LEARNING_PANEL_LABELS.intervalSrNote}</span>
      </span>
      <span className="text-[11px] text-slate-600">
        {LEARNING_PANEL_LABELS.sampleSize}
        {": "}
        {formatNumber(sampleSize)}
      </span>
    </span>
  );
}

export interface LearningScopeDecisionSummaryProps {
  decision: LearningScopeDecision | null | undefined;
  className?: string;
}

/**
 * Which scope an evaluation applied, and why — the `LearningScopeDecision` shape.
 *
 * Exported so `ActionExplanation` renders the decision the same way this panel does:
 * `RecommendationExplanation.scope` and a `gtm_learning_stats` row carry the same
 * decision vocabulary, and it should not read two ways on one screen.
 */
export function LearningScopeDecisionSummary({ decision, className }: LearningScopeDecisionSummaryProps) {
  if (!decision) {
    return <p className={cn("text-[11px] text-slate-500", className)}>{LEARNING_PANEL_LABELS.noScopeDecision}</p>;
  }

  const retained = decision.decision === "INSUFFICIENT_SAMPLE_RETAINED";
  const tone = TONE[LEARNING_DECISION_TONE[decision.decision] ?? "zinc"] ?? TONE.zinc;

  return (
    <div className={cn("min-w-0", className)} data-decision={decision.decision}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11px] text-slate-600">
          {LEARNING_PANEL_LABELS.appliedScope}
          {": "}
          <span className="font-semibold text-zinc-800">{scopeLabel(decision.appliedScope)}</span>
        </span>

        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone)}>
          <span className="sr-only">{LEARNING_PANEL_LABELS.decision}: </span>
          {LEARNING_DECISION_LABEL[decision.decision] ?? decision.decision}
        </span>

        <span className="text-[11px] text-slate-600">
          {LEARNING_PANEL_LABELS.sampleSize}
          {": "}
          {formatNumber(decision.sampleSize)}
          {" · "}
          {LEARNING_PANEL_LABELS.minSample}
          {": "}
          {formatNumber(decision.minSample)}
        </span>
      </div>

      {/* The server's own reason, verbatim — it carries the counts that produced the
          decision, and composing a sentence here would be this file inventing them. */}
      {decision.decisionReason && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{decision.decisionReason}</p>
      )}

      {retained && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{LEARNING_PANEL_LABELS.insufficientNote}</p>
      )}
    </div>
  );
}

/** One `<dt>`/`<dd>` pair, in the markup the other panels use inside a `<dl>`. */
function StatRow({ label, field, children }: { label: string; field: string; children: ReactNode }) {
  return (
    <div className="min-w-0" data-field={field}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-semibold text-zinc-900">{children}</dd>
    </div>
  );
}

export interface LearningUpdateCardProps {
  update: LearningUpdate;
  className?: string;
}

/**
 * One statistic: the cohort it is about, the decision taken over it, and the numbers.
 *
 * `scope` and `appliedScope` both render. Where they differ the card says why, because
 * "this workspace's numbers exist and were declined" and "this workspace has no numbers"
 * are different facts and only the pair distinguishes them.
 */
export function LearningUpdateCard({ update, className }: LearningUpdateCardProps) {
  const headingId = useId();
  const actionLabel = GTM_NBA_ACTION_LABELS[update.actionType] ?? update.actionType;
  const channelTone = update.channel ? TONE[CHANNEL_TONE[update.channel] ?? "zinc"] ?? TONE.zinc : TONE.zinc;
  const scopesDiffer = update.appliedScope !== update.scope;
  const retained = update.decision === "INSUFFICIENT_SAMPLE_RETAINED";
  const decisionTone = TONE[LEARNING_DECISION_TONE[update.decision] ?? "zinc"] ?? TONE.zinc;

  return (
    <li
      className={cn("min-w-0 rounded-md border border-zinc-200 bg-white p-3", className)}
      data-action-type={update.actionType}
      data-scope={update.scope}
      data-applied-scope={update.appliedScope}
      data-decision={update.decision}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 id={headingId} className="text-[13px] font-semibold text-zinc-900">
          {actionLabel}
        </h3>

        {update.channel && (
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", channelTone)}>
            {CHANNEL_LABEL[update.channel] ?? update.channel}
          </span>
        )}

        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", decisionTone)}>
          <span className="sr-only">{LEARNING_PANEL_LABELS.decision}: </span>
          {LEARNING_DECISION_LABEL[update.decision] ?? update.decision}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <StatRow label={LEARNING_PANEL_LABELS.computedScope} field="scope">
          {scopeLabel(update.scope)}
        </StatRow>

        <StatRow label={LEARNING_PANEL_LABELS.appliedScope} field="applied_scope">
          {scopeLabel(update.appliedScope)}
        </StatRow>

        {/* The one row that carries the rate, and it cannot carry it alone. */}
        <StatRow label={LEARNING_PANEL_LABELS.successRate} field="success_rate">
          <SuccessRateInterval
            successRate={update.successRate}
            sampleSize={update.sampleSize}
            ciLow={update.ciLow}
            ciHigh={update.ciHigh}
          />
        </StatRow>

        <StatRow label={LEARNING_PANEL_LABELS.minSample} field="min_sample">
          {formatNumber(update.minSample)}
        </StatRow>

        {/* Signed on purpose: several outcome classes carry a non-positive reward, and a
            negative mean is a real reading rather than a formatting slip. */}
        <StatRow label={LEARNING_PANEL_LABELS.meanReward} field="mean_reward">
          {formatNumber(update.meanReward)}
        </StatRow>

        {/* Counted per cohort rather than inferred from a difference, so the excluded
            unknowns are visible instead of quietly widening the negative count. */}
        <StatRow label={LEARNING_PANEL_LABELS.positive} field="counts">
          {formatNumber(update.positiveCount)}
          <span className="font-normal text-slate-600">
            {" · "}
            {LEARNING_PANEL_LABELS.negative}
            {": "}
            {formatNumber(update.negativeCount)}
            {" · "}
            {LEARNING_PANEL_LABELS.excludedUnknown}
            {": "}
            {formatNumber(update.excludedUnknownCount)}
          </span>
        </StatRow>

        <StatRow label={LEARNING_PANEL_LABELS.learningVersion} field="learning_version">
          {update.learningVersion ?? (
            <span className="font-medium text-slate-500">
              {UNKNOWN_TEXT}
              <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
            </span>
          )}
        </StatRow>

        <StatRow label={LEARNING_PANEL_LABELS.computedAt} field="computed_at">
          {update.computedAt ? (
            <time dateTime={update.computedAt} title={absTime(update.computedAt)}>
              {relTime(update.computedAt)}
            </time>
          ) : (
            <span className="font-medium text-slate-500">
              {UNKNOWN_TEXT}
              <span className="sr-only">{UNKNOWN_SR_NOTE}</span>
            </span>
          )}
        </StatRow>
      </dl>

      {/* The server's reason first, then the note that says what the decision cost. */}
      {update.decisionReason && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{update.decisionReason}</p>
      )}

      {retained && (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{LEARNING_PANEL_LABELS.insufficientNote}</p>
      )}

      {scopesDiffer && (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{LEARNING_PANEL_LABELS.appliedScopeNote}</p>
      )}
    </li>
  );
}

export interface LearningInsightsPanelProps {
  /** `DebugView.learningUpdates` — the statistics the evaluation was scored against. */
  updates: LearningUpdate[];
  /**
   * The scope decision the recommendation recorded, where a caller holds one.
   * `RecommendationExplanation.scope`, rendered through the same summary
   * `ActionExplanation` uses so one decision does not read two ways.
   */
  scope?: LearningScopeDecision | null;
  className?: string;
}

export function LearningInsightsPanel({ updates, scope, className }: LearningInsightsPanelProps) {
  const titleId = useId();
  const noteId = useId();
  const rows = updates ?? [];

  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", className)}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        <GraduationCap className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        {LEARNING_PANEL_LABELS.title}
      </h2>
      <p id={noteId} className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {LEARNING_PANEL_LABELS.note}
      </p>

      {/* The applied scope for this evaluation, above the cohorts it was chosen from. */}
      {scope !== undefined && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <LearningScopeDecisionSummary decision={scope} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="mt-3">
          <p className="text-[13px] text-slate-500">{LEARNING_PANEL_LABELS.empty}</p>
          {/* Cold start is a state, not an error: the priors are configured values and
              the reduced confidence beside a recommendation is what says so (R22.5). */}
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{LEARNING_PANEL_LABELS.emptyNote}</p>
        </div>
      ) : (
        <ul
          className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2"
          aria-label={LEARNING_PANEL_LABELS.list}
          aria-describedby={noteId}
        >
          {rows.map((update, index) => (
            <LearningUpdateCard
              key={update.statId ?? `${update.scope}-${update.actionType}-${update.channel ?? "none"}-${index}`}
              update={update}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default LearningInsightsPanel;
