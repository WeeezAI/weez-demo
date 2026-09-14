// hooks/useWorkspaceSetup.ts
//
// "Has this workspace been started yet, and if not, what is the next step?"
//
// ── The problem this exists to solve ──
//
// A brand new workspace and a quiet established workspace used to look identical. Both
// showed Nina's four attention blocks with nothing in them and a `0`, both showed Market
// Intelligence hunting, both showed an empty action queue. Nothing on any surface said
// "you have not told Nina what you want yet", and the one control that would fix it — the
// goal intake — sat at the bottom of Nina's page behind a collapsed disclosure. So the
// first thing a founder saw after creating a workspace was a product that looked like it
// was already running and had found nothing.
//
// Three facts distinguish the two, and each already had an endpoint nobody was joining:
//
//   website connected   `GET /nina/readiness`  → `connections.website_connected`
//   goal set            `GET /nina/strategy`   → `exists`   (persisted since day one,
//                                                            never read back until now)
//   workforce launched  `GET /autopilot/campaign/{id}/active-status` → `active`
//
// ── Why a provider rather than a per-page hook ──
//
// The same three answers are wanted by the sidebar, by Nina, and by the connections page,
// and they are properties of the workspace rather than of a page. Read once above the
// routes, exactly as `useCredits` reads the balance, and for the same reason: three surfaces
// each fetching three endpoints would be nine requests for an answer that does not change
// between them.
//
// ── Fail open, always ──
//
// `useWorkspaceSetup()` outside the provider is not an error — it answers "unread", every
// consumer renders exactly what it rendered before this module existed, and nothing throws.
// A failed read is the same answer as an unread one. That asymmetry is deliberate:
//
//   showing setup guidance to a workspace that is already running is a real regression —
//   it would tell a founder mid-campaign to go start their campaign
//
//   showing the normal surfaces to a workspace that needs setup is the behaviour that
//   shipped for months, so falling back to it costs nothing new
//
// Which is why `needsSetup` requires all three answers to have actually landed. `null` is
// not `false` here: `false` means the server said no, `null` means nobody knows.

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

import { weezAPI } from "@/services/weezAPI";
import { brandIdFromPath } from "@/hooks/useCredits";

/** The three things that have to be true before Weez can work. In order. */
export type SetupStepId = "website" | "goal" | "launch";

/** Declared once so a consumer counts steps from here rather than from a literal. */
export const SETUP_STEP_ORDER: readonly SetupStepId[] = ["website", "goal", "launch"] as const;

export interface WorkspaceSetupState {
  /** The workspace these answers describe, or `undefined` off a workspace-scoped route. */
  brandId?: string;

  /** The website is connected. `null` before the read lands, and never a stand-in `false`. */
  websiteConnected: boolean | null;
  /** A GTM goal and strategy are stored for this workspace. `null` when unread. */
  goalSet: boolean | null;
  /** The outbound workforce is live. `null` when unread. */
  launched: boolean | null;

  loading: boolean;

  /**
   * Every answer landed and the workforce is not running yet.
   *
   * The only flag a surface should branch its layout on. False while anything is unread,
   * so a slow or failing read can never make a running workspace look unstarted.
   */
  needsSetup: boolean;

  /** The step to do next, or `null` when unread or when there is nothing left to do. */
  nextStep: SetupStepId | null;

  /** How many of the three steps are done, or `null` when unread. */
  completedSteps: number | null;

  /** Re-read all three. Call it after something that could have changed one. */
  refresh: () => Promise<void>;

  /**
   * Record a step locally, without waiting for a re-read.
   *
   * The intake knows it just persisted a strategy and the launch handler knows it just
   * activated the workforce; making either of them wait a round trip to stop showing
   * "do this next" would leave a completed step looking pending.
   */
  markWebsiteConnected: () => void;
  markGoalSet: () => void;
  markLaunched: () => void;
}

const NOOP = () => {};

/** The answer outside a provider: nothing is known, nothing is claimed, nothing breaks. */
const UNREAD: WorkspaceSetupState = {
  brandId: undefined,
  websiteConnected: null,
  goalSet: null,
  launched: null,
  loading: false,
  needsSetup: false,
  nextStep: null,
  completedSteps: null,
  refresh: async () => {},
  markWebsiteConnected: NOOP,
  markGoalSet: NOOP,
  markLaunched: NOOP,
};

const WorkspaceSetupContext = createContext<WorkspaceSetupState>(UNREAD);

/** The three raw answers, before any of them mean anything together. */
interface Answers {
  website: boolean | null;
  goal: boolean | null;
  launched: boolean | null;
}

const NOTHING_READ: Answers = { website: null, goal: null, launched: null };

/**
 * The next step, given what is known.
 *
 * Exported and pure so the ordering is testable without mounting a provider. Returns
 * `null` for "unread" and for "finished" alike, because neither is a step — a consumer
 * branches on `needsSetup` first and only then asks what is next.
 */
export function nextStepFrom(answers: Answers): SetupStepId | null {
  if (answers.website === null || answers.goal === null || answers.launched === null) return null;
  if (answers.launched) return null;
  if (!answers.website) return "website";
  if (!answers.goal) return "goal";
  return "launch";
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

  const [answers, setAnswers] = useState<Answers>(NOTHING_READ);
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

/** The shared setup state. Answers "unread" outside a provider rather than throwing. */
export function useWorkspaceSetup(): WorkspaceSetupState {
  return useContext(WorkspaceSetupContext);
}

export default useWorkspaceSetup;
