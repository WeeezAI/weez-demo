// hooks/useWorkspaceSetup.ts
//
// "Has this workspace been started yet, and if not, what is the next step?"
//
// ── The problem this exists to solve ──
//
// A brand new workspace and a quiet established workspace used to look identical. Both
// showed Nina's four attention blocks with nothing in them and a `0`, both showed Market
// Intelligence hunting, both showed an empty action queue. Nothing on any surface said
// "you have not told Nina what you want yet", and the workflow that would fix it sat at the
// bottom of Nina's page behind a collapsed disclosure.
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
// The same three answers are wanted by the sidebar, by Nina, by Market Intelligence, by the
// dossier and by the connections page, and they are properties of the workspace rather than
// of a page. Read once above the routes, exactly as `useCredits` reads the balance, and for
// the same reason: five surfaces each fetching three endpoints would be fifteen requests for
// an answer that does not change between them.
//
// ── Why the provider is not in this file ──
//
// This module is the *consumer* half: the vocabulary, the context and the hook, and nothing
// that talks to a network. `WorkspaceSetupProvider.ts` is the producer half, and it is the
// only one that imports `weezAPI`.
//
// The split is not tidiness. Everything that reads this state is a page or a component that
// renders — `ConversationSidebar`, `WorkspaceSetupChecklist`, four pages — and several of
// them make no API calls of their own. With the read in this file, importing the hook
// dragged the whole API client into their module graphs: `pages/ProspectIntelligence.tsx`
// picked up `weezAPI` transitively despite never calling it, which is a real cost in the
// bundle and a measurable one in the suites that mount it. Consumers now import a module
// whose only dependency is React.
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

import { createContext, useContext } from "react";

/** The three things that have to be true before Weez can work. In order. */
export type SetupStepId = "website" | "goal" | "launch";

/** Declared once so a consumer counts steps from here rather than from a literal. */
export const SETUP_STEP_ORDER: readonly SetupStepId[] = ["website", "goal", "launch"] as const;

/**
 * The stored GTM goal, narrowed to what a surface actually renders.
 *
 * A projection of `GET /nina/strategy`'s document rather than the document itself. The
 * stored strategy is a large, loosely-typed blob — Eva's plan, Max's plan, guardrails,
 * risks, ten generations of history — and the workflow that produced it is the right place
 * to render all of that. What a *summary* needs is the handful of fields below, so those are
 * what cross this boundary: a page reading `goal.expected` cannot be reaching into an
 * untyped blob for something the server never promised.
 *
 * Every field is nullable and every absence is `null`, never a stand-in. "Nina did not
 * state a stretch number" and "the stretch number is empty" are different facts and only
 * one of them is worth printing.
 */
export interface WorkspaceGoal {
  /** What the founder asked for, in their words. */
  target: string | null;
  /** When Nina generated this plan, ISO. */
  generatedAt: string | null;
  /** The plan's own range. Strings, because Nina states units ("18 meetings"). */
  conservative: string | null;
  expected: string | null;
  stretch: string | null;
  /** Nina's read on the ask: realistic, aggressive, unrealistic. */
  verdict: string | null;
  /** The ACV playbook this plan runs, e.g. "Medium ACV". */
  acvTier: string | null;
}

/**
 * The live campaign, narrowed the same way.
 *
 * From `GET /autopilot/campaign/{id}/active-status`. `totalDays` is `null` rather than `0`
 * for a campaign with no dated window, because the server returns `0` for both "no window"
 * and its derived `progress`, and "day 1 of 0, 0% complete" is not a statement anybody
 * should read. The degraded payload the backend returns for a campaign it knows is live but
 * cannot describe leaves every one of these `null`, which renders as "live" and no stats —
 * which is exactly what is true.
 */
export interface ActiveCampaign {
  name: string | null;
  /** What the workforce is doing, in the server's own words. */
  statusTag: string | null;
  /** Aggressiveness, e.g. "Medium". */
  mode: string | null;
  currentDay: number | null;
  /** `null` when the campaign has no dated window, never `0`. */
  totalDays: number | null;
  daysRemaining: number | null;
  /** 0–100. A genuine `0` on day one; `null` when there is no window to measure against. */
  progress: number | null;
  startedAt: string | null;
}

export interface WorkspaceSetupState {
  /** The workspace these answers describe, or `undefined` off a workspace-scoped route. */
  brandId?: string;

  /** The website is connected. `null` before the read lands, and never a stand-in `false`. */
  websiteConnected: boolean | null;
  /** A GTM goal and strategy are stored for this workspace. `null` when unread. */
  goalSet: boolean | null;
  /** The outbound workforce is live. `null` when unread. */
  launched: boolean | null;

  /**
   * The stored goal, when there is one.
   *
   * `null` covers three cases a surface treats identically: unread, the read failed, and
   * the workspace genuinely has no goal. `goalSet` is the flag for the third; this is the
   * content, and a surface that has it can say what the workspace is going after instead of
   * asking whether anybody has said.
   */
  goal: WorkspaceGoal | null;

  /** The live campaign, when one is running. `null` when unread or not running. */
  campaign: ActiveCampaign | null;

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
   * The workflow knows it just persisted a strategy and the launch handler knows it just
   * activated the workforce; making either of them wait a round trip to stop showing
   * "do this next" would leave a completed step looking pending.
   */
  markWebsiteConnected: () => void;
  markGoalSet: () => void;
  markLaunched: () => void;
}

const NOOP = () => {};

/** The answer outside a provider: nothing is known, nothing is claimed, nothing breaks. */
export const UNREAD_WORKSPACE_SETUP: WorkspaceSetupState = {
  brandId: undefined,
  websiteConnected: null,
  goalSet: null,
  launched: null,
  goal: null,
  campaign: null,
  loading: false,
  needsSetup: false,
  nextStep: null,
  completedSteps: null,
  refresh: async () => {},
  markWebsiteConnected: NOOP,
  markGoalSet: NOOP,
  markLaunched: NOOP,
};

/** Shared with the provider module, which is the only thing allowed to write it. */
export const WorkspaceSetupContext =
  createContext<WorkspaceSetupState>(UNREAD_WORKSPACE_SETUP);

/**
 * The three raw answers, before any of them mean anything together, plus the two payloads
 * the second and third reads carried.
 *
 * `goal` and `launched` stay booleans and the content sits beside them, so the step logic
 * below reads the same way it did when the content did not exist: `nextStepFrom` is about
 * whether each fact is known and true, never about what a payload said.
 */
export interface WorkspaceSetupAnswers {
  website: boolean | null;
  goal: boolean | null;
  launched: boolean | null;
  goalDetail: WorkspaceGoal | null;
  campaign: ActiveCampaign | null;
}

export const NOTHING_READ: WorkspaceSetupAnswers = {
  website: null,
  goal: null,
  launched: null,
  goalDetail: null,
  campaign: null,
};

/**
 * The next step, given what is known.
 *
 * Pure, and here rather than in the provider, so the ordering is testable without mounting
 * anything. Returns `null` for "unread" and for "finished" alike, because neither is a step
 * — a consumer branches on `needsSetup` first and only then asks what is next.
 */
export function nextStepFrom(answers: WorkspaceSetupAnswers): SetupStepId | null {
  if (answers.website === null || answers.goal === null || answers.launched === null) return null;
  if (answers.launched) return null;
  if (!answers.website) return "website";
  if (!answers.goal) return "goal";
  return "launch";
}

/** The shared setup state. Answers "unread" outside a provider rather than throwing. */
export function useWorkspaceSetup(): WorkspaceSetupState {
  return useContext(WorkspaceSetupContext);
}

export default useWorkspaceSetup;
