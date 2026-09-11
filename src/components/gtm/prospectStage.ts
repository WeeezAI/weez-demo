// components/gtm/prospectStage.ts
//
// Which stage of the journey one prospect is in, derived from the fields the backend
// already sends.
//
// This is the spine of the Prospect Intelligence surface. **Activate Intelligence is a
// state transition, not a destination**: there is no separate intelligence page, and the
// dossier progressively becomes a decision cockpit as the prospect moves through
//
//     DISCOVERED → ENRICHED → [ Contact Directly | Activate Intelligence ] → ACTIVATED
//                                                                              ↓
//                                        EPS → Signals → NBA → Action → Learning
//
// so something has to say where a given prospect stands. That is this function, and it is
// deliberately pure: one object in, one stage out, no fetching and no hooks, so the rule
// can be read in one place and asserted without rendering a page.
//
// ─── Every stage is a real field, not a timer ─────────────────────────────────
//
// The one thing this must never do is invent a stage the backend cannot support. So each
// one names the field it is read from:
//
//   ENRICHING    `busy === "enriching"` — a request this page has in flight. The only
//                stage that is about the page rather than about the prospect.
//   RESOLVING    `busy === "resolving"` — an identity search this page just asked for.
//                Transient only. `resolve-identity` navigates nothing itself: it queues a
//                job and the verdict lands on a later read.
//   ENRICHED     no `profileId`. **The decision point, whatever the identity verdict says**
//                — see the long note at the bottom of `prospectStageOf`.
//   ACTIVATING   `busy === "activating"` — the track request is in flight.
//   WAITING      `profileId` exists — intelligence is active — and `stateVersion === 0`.
//                That zero is exact, not a heuristic: activation opens the fifteen belief
//                rows at their resting values and moves no dimension, so the backend
//                itself reports `state_version: 0` until something is actually observed
//                (`api/gtm.py`'s track route says so, and `TrackProspectOut` documents
//                it). Bright Data observation is asynchronous, so this stage is normal and
//                can last a while — naming it is what stops an empty EPS panel from
//                reading as a broken product.
//   ACTIVE       `stateVersion > 0`: a dimension has moved, so there is a real belief.
//                No recommendation yet.
//   RECOMMENDED  a recommendation exists. The NBA is on screen and there is something to
//                do.
//
// ─── What is deliberately not here ────────────────────────────────────────────
//
// No `EXPIRED` and no `PAUSED`. Neither is expressible: `TrackProspectOut` carries no
// expiry field, the profile row's existence *is* the tracking flag, and `api/gtm.py`
// states there is deliberately no pause and no stop. A stage nothing can reach would be a
// promise the product cannot keep — an operator seeing "Paused" would look for the
// control that resumes it, and there is none.

export type ProspectStage =
  | "ENRICHING"
  | "RESOLVING"
  | "ENRICHED"
  | "ACTIVATING"
  | "WAITING"
  | "ACTIVE"
  | "RECOMMENDED";

/** A request this page has in flight, which outranks whatever the rows currently say. */
export type ProspectBusy = "enriching" | "resolving" | "activating" | null;

export interface ProspectStageInput {
  /**
   * `profile.profileId` — the `li_gtm_profiles` row. **This is the activation flag.**
   * There is no tracking-state column in the schema; the row's existence is what
   * "intelligence is active" means, and it is created only by the track route.
   */
  profileId?: string | null;
  /**
   * `ProspectStateFull.stateVersion`, or null when the belief has not been read.
   *
   * Null is not zero. A read that has not happened cannot distinguish "activated and
   * nothing observed" from "activated and observed", so an unread belief on an activated
   * prospect stays `WAITING` — which is the honest answer and also the safe one, because
   * it claims less.
   */
  stateVersion?: number | null;
  /** Whether the ranking produced a recommendation. `NextBestAction.recommended != null`. */
  hasRecommendation?: boolean;
  /** A write this page started. Outranks the rows: it is newer than they are. */
  busy?: ProspectBusy;
}

/**
 * The stage this prospect is in.
 *
 * Ordered by precedence, and the order matters: an in-flight write is newer than the
 * payload the page is holding, so `busy` is checked first. Everything after it is read
 * from persisted fields.
 */
export function prospectStageOf(input: ProspectStageInput): ProspectStage {
  const {
    profileId = null,
    stateVersion = null,
    hasRecommendation = false,
    busy = null,
  } = input;

  // 1. What this page is doing right now.
  if (busy === "enriching") return "ENRICHING";
  if (busy === "activating") return "ACTIVATING";
  if (busy === "resolving") return "RESOLVING";

  const activated = typeof profileId === "string" && profileId.trim().length > 0;

  // 2. Activated: the only question left is how much has been observed.
  if (activated) {
    if (hasRecommendation) return "RECOMMENDED";
    if (typeof stateVersion === "number" && stateVersion > 0) return "ACTIVE";
    return "WAITING";
  }

  // 3. Not activated — and that is the whole test.
  //
  // **The identity verdict is deliberately not consulted here, and reading it was a real
  // bug.** An earlier version returned `ENRICHED` only for a `VERIFIED` identity and fell
  // through to `RESOLVING` otherwise, which meant a prospect nobody had searched for on
  // LinkedIn showed *no decision at all* — neither Contact Directly nor Activate
  // Intelligence — because `showsDecision()` admits only `ENRICHED`. That is exactly
  // backwards. A confirmed LinkedIn identity is a precondition of **activation**, because
  // the track route refuses anything unverified and observing an unconfirmed profile would
  // attach a belief to the wrong person. It is not a precondition of the operator *having a
  // choice to make*: they have a name, a role, a company and an email from enrichment, and
  // deciding whether to reach out on that is entirely reasonable.
  //
  // So every prospect that reaches this surface and is not yet activated is at the decision
  // point. Which of the two cards can actually be pressed is decided beside each control —
  // activation by `trackRefusal()`, which is the same rule the route applies, and contact by
  // its own availability condition. A control that would be refused is not rendered, and the
  // reason appears in its place with the search that would change the answer next to it.
  return "ENRICHED";
}

/** Whether intelligence is active for this prospect — i.e. the profile row exists. */
export function isIntelligenceActive(stage: ProspectStage): boolean {
  return stage === "WAITING" || stage === "ACTIVE" || stage === "RECOMMENDED";
}

/**
 * Whether the two-way decision belongs on screen.
 *
 * Every stage before activation, which today is `ENRICHED` and the two transient ones that
 * resolve back into it. After activation the decision has been made, which is the whole
 * reason the dossier transforms rather than keeping a pair of buttons around that no longer
 * mean anything.
 *
 * `RESOLVING` and `ENRICHING` are included deliberately. They are things *this page is
 * doing*, not answers about the prospect, and an in-flight identity search is a poor reason
 * to take the operator's choice off the screen — they may well want to press Contact
 * Directly while it runs. The controls carry their own busy state; the stage banner says
 * what is happening.
 */
export function showsDecision(stage: ProspectStage): boolean {
  return stage === "ENRICHED" || stage === "RESOLVING" || stage === "ENRICHING";
}
