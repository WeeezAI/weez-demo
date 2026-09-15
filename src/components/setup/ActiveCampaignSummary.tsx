// components/setup/ActiveCampaignSummary.tsx
//
// What a workspace is going after, and how far into it the campaign is.
//
// ── What was wrong ──
//
// Nina's goal section said the same thing forever. A founder who had set a full GTM target,
// watched the strategy get built and launched the workforce came back the next morning to
// "Your GTM goal — Set your GTM goal — Nina reads your product, customers and industry
// context, asks only for what is missing, then lays out the strategy she would run." Both
// halves are wrong once a goal exists: the control's verb says nothing has been set, and the
// copy describes something that already happened. It reads as though the campaign they are
// running does not exist.
//
// The data to say the true thing was already stored and already fetched, twice over.
// `POST /nina/strategy` has persisted the whole strategy since day one, and nothing ever
// read it back — so no surface could name the goal even though every surface had one.
// `GET /autopilot/campaign/{id}/active-status` returns the campaign's day, window and what
// the workforce is doing, and it was being read only to decide a boolean.
//
// ── Every value here is the server's ──
//
// The goal, the range, the verdict, the day, the window and the status line are read and
// rendered. Nothing is computed here — not the progress percentage (the server derives it
// from the same dates it reports), not the days remaining, not a completion estimate. And
// nothing is filled in: a field the server did not state is left out of the layout rather
// than printed as blank or as a zero, which is why the progress row disappears entirely for
// a campaign with no dated window instead of claiming "day 1 of 0".

import { CalendarClock, CheckCircle2, Target } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ActiveCampaign, WorkspaceGoal } from "@/hooks/useWorkspaceSetup";

/** Every word this block says, in one table. */
export const ACTIVE_CAMPAIGN_LABELS = {
  /** The section heading a page uses when there is a campaign to describe. */
  sectionTitle: "Your active campaign",
  /** And the control beside it, which is no longer "Set". */
  changeGoal: "Change goal",

  goingAfter: "Going after",
  live: "Live",
  /** Used when the server described the campaign but not what it is doing. */
  liveFallback: "Eva is discovering accounts and Max is preparing outreach.",

  planTitle: "What Nina expects",
  conservative: "Conservative",
  expected: "Expected",
  stretch: "Stretch",

  mode: "Pace",
  dayOf: (current: number, total: number) => `Day ${current} of ${total}`,
  daysRemaining: (days: number) => `${days} ${days === 1 ? "day" : "days"} remaining`,
  progressAria: "Campaign progress",

  startedOn: (date: string) => `Started ${date}`,
  planSetOn: (date: string) => `Plan set ${date}`,

  /**
   * The goal exists but the read that would describe it has not landed.
   *
   * A real state, and a different one from "no goal": the workflow marks a goal as set the
   * instant it persists a strategy, before anything has read the document back. Saying so
   * beats either asking a founder to set a goal they just set or inventing a summary.
   */
  goalSetUnread:
    "This workspace has a GTM goal. Nina's plan for it is still loading — open it to read the strategy she is running.",
} as const;

export const ACTIVE_CAMPAIGN_TEST_IDS = {
  summary: "active-campaign-summary",
  plan: "active-campaign-plan",
  progress: "active-campaign-progress",
} as const;

/** The verdict's tone. Unknown verdicts fall through to neutral rather than to a guess. */
const VERDICT_TONE: Record<string, string> = {
  realistic: "bg-emerald-50 text-emerald-700 border-emerald-200",
  aggressive: "bg-amber-50 text-amber-700 border-amber-200",
  unrealistic: "bg-rose-50 text-rose-700 border-rose-200",
};

/**
 * A date, as a short readable string, or `null` if it is not one.
 *
 * Never throws and never renders "Invalid Date": a stored timestamp is generated data, and
 * an unparseable one is an absent one.
 */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export interface ActiveCampaignSummaryProps {
  /** The stored goal, or `null` when the document has not been read. */
  goal: WorkspaceGoal | null;
  /** The live campaign, or `null` when nothing is running or nothing was read. */
  campaign: ActiveCampaign | null;
  className?: string;
}

export function ActiveCampaignSummary({
  goal,
  campaign,
  className,
}: ActiveCampaignSummaryProps) {
  // Nothing to describe. The caller decides whether that means "no goal" or "not read yet";
  // this component only refuses to invent a summary out of two nulls.
  if (goal === null && campaign === null) {
    return (
      <p
        data-testid={ACTIVE_CAMPAIGN_TEST_IDS.summary}
        className={cn(
          "rounded-2xl border border-gray-100 bg-white p-5 text-xs leading-relaxed text-gray-500",
          className
        )}
      >
        {ACTIVE_CAMPAIGN_LABELS.goalSetUnread}
      </p>
    );
  }

  const range = (
    [
      [ACTIVE_CAMPAIGN_LABELS.conservative, goal?.conservative],
      [ACTIVE_CAMPAIGN_LABELS.expected, goal?.expected],
      [ACTIVE_CAMPAIGN_LABELS.stretch, goal?.stretch],
    ] as const
  ).filter(([, value]) => value != null) as [string, string][];

  const verdict = goal?.verdict ?? null;
  const started = shortDate(campaign?.startedAt ?? null);
  const planSet = shortDate(goal?.generatedAt ?? null);

  const hasWindow =
    campaign?.currentDay != null && campaign?.totalDays != null && campaign.totalDays > 0;

  return (
    <div
      data-testid={ACTIVE_CAMPAIGN_TEST_IDS.summary}
      className={cn(
        "space-y-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm",
        className
      )}
    >
      {/* The goal itself. First, and biggest: it is the answer to the question the old copy
          was still asking. */}
      {goal?.target != null && (
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Target className="h-3 w-3" />
            {ACTIVE_CAMPAIGN_LABELS.goingAfter}
          </p>
          <p className="mt-1 text-base font-bold leading-snug tracking-tight text-gray-900">
            {goal.target}
          </p>
        </div>
      )}

      {/* Running, and what the workforce is doing — the server's own sentence. */}
      {campaign !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
            {/* Decorative: the word beside it carries the state. */}
            <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {ACTIVE_CAMPAIGN_LABELS.live}
          </span>
          <span className="min-w-0 text-[13px] leading-relaxed text-gray-600">
            {campaign.statusTag ?? ACTIVE_CAMPAIGN_LABELS.liveFallback}
          </span>
        </div>
      )}

      {/* Where the campaign is in its window. Absent entirely when there is no window,
          rather than shown as day one of zero. */}
      {hasWindow && (
        <div data-testid={ACTIVE_CAMPAIGN_TEST_IDS.progress} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-bold tabular-nums text-gray-900">
              {ACTIVE_CAMPAIGN_LABELS.dayOf(campaign!.currentDay!, campaign!.totalDays!)}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
              {campaign!.daysRemaining != null && (
                <span className="tabular-nums">
                  {ACTIVE_CAMPAIGN_LABELS.daysRemaining(campaign!.daysRemaining)}
                </span>
              )}
              {campaign!.mode != null && (
                <span>
                  {ACTIVE_CAMPAIGN_LABELS.mode}: {campaign!.mode}
                </span>
              )}
            </span>
          </div>
          {/* The server's percentage, not one recomputed from the two day numbers beside it
              — two derivations of one figure is how they come to disagree. */}
          {campaign!.progress != null && (
            <div
              role="progressbar"
              aria-label={ACTIVE_CAMPAIGN_LABELS.progressAria}
              aria-valuenow={campaign!.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
            >
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, campaign!.progress))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Nina's own range for the ask, and her verdict on it. The plan, not a measurement:
          this is what she said to expect, which is why it is labelled that way and not
          "results". */}
      {range.length > 0 && (
        <div data-testid={ACTIVE_CAMPAIGN_TEST_IDS.plan} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {ACTIVE_CAMPAIGN_LABELS.planTitle}
            </h3>
            <span className="flex items-center gap-1.5">
              {goal?.acvTier != null && (
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                  {goal.acvTier}
                </span>
              )}
              {verdict != null && (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest",
                    VERDICT_TONE[verdict.toLowerCase()] ??
                      "bg-gray-50 text-gray-600 border-gray-200"
                  )}
                >
                  {verdict}
                </span>
              )}
            </span>
          </div>
          <dl
            className={cn(
              "grid gap-2",
              range.length === 3 ? "grid-cols-3" : range.length === 2 ? "grid-cols-2" : "grid-cols-1"
            )}
          >
            {range.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 px-3 py-2.5 text-center">
                <dt className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm font-black tracking-tight text-gray-900">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(started != null || planSet != null) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
          {started != null && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3 w-3" />
              {ACTIVE_CAMPAIGN_LABELS.startedOn(started)}
            </span>
          )}
          {planSet != null && (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              {ACTIVE_CAMPAIGN_LABELS.planSetOn(planSet)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export default ActiveCampaignSummary;
