// hooks/WorkspaceSetupProvider.ts
//
// The producer half of the workspace setup state. See `useWorkspaceSetup.ts` for what the
// state means and why the two halves are separate files — the short version is that this is
// the only module in the pair that imports the API client, so the five surfaces that *read*
// the state do not pull it into their graphs.
//
// Mounted once, above `Routes`, in `App.tsx`. Nothing else should import it.

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

import { weezAPI } from "@/services/weezAPI";
import { brandIdFromPath } from "@/hooks/useCredits";
import {
  NOTHING_READ,
  WorkspaceSetupContext,
  nextStepFrom,
  type ActiveCampaign,
  type WorkspaceGoal,
  type WorkspaceSetupAnswers,
  type WorkspaceSetupState,
} from "@/hooks/useWorkspaceSetup";

/**
 * A field that has to be a non-empty string to count as stated.
 *
 * The strategy document is generated, so a field can arrive as `null`, missing, or an empty
 * string, and all three mean the same thing: Nina did not state it. Collapsing them here
 * means no consumer has to decide whether `""` is a value.
 */
const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** A field that has to be a real number to count as measured. `0` counts. */
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * The stored strategy document, projected onto what a summary renders.
 *
 * `doc.target` is what the founder asked for and `doc.strategy` is what Nina built from it,
 * so the goal is read from the first with the second as the fallback — a document written by
 * an older shape of the endpoint may only carry the nested one.
 */
function readGoal(doc: unknown): WorkspaceGoal | null {
  if (!doc || typeof doc !== "object") return null;
  const record = doc as Record<string, unknown>;
  const strategy = (record.strategy ?? {}) as Record<string, unknown>;
  const adjusted = (strategy.adjusted_target ?? {}) as Record<string, unknown>;
  const nested = (strategy.goal ?? {}) as Record<string, unknown>;
  const tier = (strategy.acv_tier_strategy ?? {}) as Record<string, unknown>;

  const goal: WorkspaceGoal = {
    target: text(record.target) ?? text(nested.requested),
    generatedAt: text(record.generated_at),
    conservative: text(adjusted.conservative),
    expected: text(adjusted.expected),
    stretch: text(adjusted.stretch),
    verdict: text(adjusted.verdict),
    acvTier: text(tier.label) ?? text(strategy.acv_tier),
  };

  // A document that yielded nothing worth printing is the same as no document. Without
  // this, a surface would render an empty goal card for a malformed payload.
  return Object.values(goal).some((value) => value !== null) ? goal : null;
}

/** The active-status payload, projected the same way. */
function readCampaign(payload: unknown): ActiveCampaign | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.active !== true) return null;

  // `0` is the server's answer for "this campaign has no dated window", and it is also what
  // it derives `progress` from — so `progress` is only a measurement when there is a window
  // to measure against. Reported as absent rather than as a zero.
  const totalDays = num(record.total_days);
  const windowed = totalDays !== null && totalDays > 0;

  return {
    name: text(record.campaign_name),
    statusTag: text(record.status_tag),
    mode: text(record.mode),
    currentDay: windowed ? num(record.current_day) : null,
    totalDays: windowed ? totalDays : null,
    daysRemaining: windowed ? num(record.days_remaining) : null,
    progress: windowed ? num(record.progress) : null,
    startedAt: text(record.started_at),
  };
}

export interface WorkspaceSetupProviderProps {
  children: ReactNode;
  /** Overrides the path-derived id. For tests and for any non-routed embedding. */
  brandId?: string;
}

export function WorkspaceSetupProvider({
  children,
  brandId: override,
}: WorkspaceSetupProviderProps) {
  const { pathname } = useLocation();
  const brandId = override ?? brandIdFromPath(pathname);

  const [answers, setAnswers] = useState<WorkspaceSetupAnswers>(NOTHING_READ);
  const [loading, setLoading] = useState(false);

  // Guards an out-of-order response from overwriting a newer one — the same `reqRef`
  // device `useCredits` and the GTM pages use. A `refresh()` fired right after the
  // founder connected their website can easily land before the initial read, and the
  // older answer would put the workspace back on step 1.
  const reqRef = useRef(0);

  const read = useCallback(async () => {
    if (!brandId) {
      reqRef.current += 1; // strand any in-flight read for the previous workspace
      setAnswers(NOTHING_READ);
      setLoading(false);
      return;
    }

    const seq = ++reqRef.current;
    setLoading(true);

    // Three independent reads, each with its own catch. One endpoint being down must not
    // erase the two answers that did arrive — a shared `try` would turn a single 500 into
    // "nothing is known", and `needsSetup` would go quiet for a workspace that genuinely
    // needs setup.
    const [readiness, strategy, campaign] = await Promise.all([
      weezAPI.getNinaReadiness(brandId).catch(() => null),
      weezAPI.getNinaStrategy(brandId).catch(() => null),
      weezAPI.getActiveCampaignStatus(brandId).catch(() => null),
    ]);

    if (seq !== reqRef.current) return; // a newer read superseded this one

    setAnswers({
      website: readiness ? Boolean(readiness.connections?.website_connected) : null,
      goal: strategy ? Boolean(strategy.exists) : null,
      launched: campaign ? Boolean(campaign.active) : null,
      // The content beside the flags. `GET /nina/strategy` has persisted the whole strategy
      // since day one and nothing read it back, which is why every surface could only ask
      // whether a goal existed and never say what it was.
      goalDetail: strategy?.exists ? readGoal(strategy.strategy) : null,
      campaign: readCampaign(campaign),
    });
    setLoading(false);
  }, [brandId]);

  // Re-reads when the workspace changes and not when the page does, so moving between
  // two surfaces of one workspace costs nothing.
  useEffect(() => {
    void read();
  }, [read]);

  const value = useMemo<WorkspaceSetupState>(() => {
    const allRead =
      answers.website !== null && answers.goal !== null && answers.launched !== null;
    const done = allRead
      ? [answers.website, answers.goal, answers.launched].filter(Boolean).length
      : null;

    return {
      brandId,
      websiteConnected: answers.website,
      goalSet: answers.goal,
      launched: answers.launched,
      goal: answers.goalDetail,
      campaign: answers.campaign,
      loading,
      needsSetup: allRead && !answers.launched,
      nextStep: nextStepFrom(answers),
      completedSteps: done,
      refresh: read,
      markWebsiteConnected: () => setAnswers((prev) => ({ ...prev, website: true })),
      // The flag only. The content stays whatever the last read said, because this mark is
      // made by the workflow the instant it persists a strategy and it does not have the
      // stored document — inventing one here would put a made-up goal on screen. The next
      // read fills it in; until then the surface knows a goal exists and says so without
      // claiming to know what it is.
      markGoalSet: () => setAnswers((prev) => ({ ...prev, goal: true })),
      // Launching implies the two steps before it, and the server agrees: the workforce
      // cannot start without a website and a strategy. Marking all three keeps the rail
      // from briefly showing a completed run as one step short. Content is preserved for
      // the same reason as above.
      markLaunched: () =>
        setAnswers((prev) => ({ ...prev, website: true, goal: true, launched: true })),
    };
  }, [answers, brandId, loading, read]);

  return createElement(WorkspaceSetupContext.Provider, { value }, children);
}

export default WorkspaceSetupProvider;
