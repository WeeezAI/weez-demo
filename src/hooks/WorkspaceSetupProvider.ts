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
  type WorkspaceSetupAnswers,
  type WorkspaceSetupState,
} from "@/hooks/useWorkspaceSetup";

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
      loading,
      needsSetup: allRead && !answers.launched,
      nextStep: nextStepFrom(answers),
      completedSteps: done,
      refresh: read,
      markWebsiteConnected: () => setAnswers((prev) => ({ ...prev, website: true })),
      markGoalSet: () => setAnswers((prev) => ({ ...prev, goal: true })),
      // Launching implies the two steps before it, and the server agrees: the workforce
      // cannot start without a website and a strategy. Marking all three keeps the rail
      // from briefly showing a completed run as one step short.
      markLaunched: () => setAnswers({ website: true, goal: true, launched: true }),
    };
  }, [answers, brandId, loading, read]);

  return createElement(WorkspaceSetupContext.Provider, { value }, children);
}

export default WorkspaceSetupProvider;
