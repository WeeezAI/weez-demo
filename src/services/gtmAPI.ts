// services/gtmAPI.ts
//
// GTM Intelligence — the transport and the types for the LinkedIn
// relationship-intelligence screen.
//
// Fourteen routes under `${WEEZ_BASE_URL}/gtm`, every one of them scoped by a
// `brand_id` query parameter and authorised by the same session token the rest of
// the app already carries. The shapes here are projections of `backend/schemas/
// gtm.py`, which is the authoritative contract: this module renames the wire's
// snake_case keys to the camelCase the components read and does nothing else to
// them.
//
// What this module deliberately does not do
// -----------------------------------------
// **It does not compute.** No score, no state, no level, no band is derived here.
// A number on the screen is a number an engine persisted, and the label that makes
// it legible travels with it (`DerivedScore.scoreDisclaimer`) rather than being
// applied at render time.
//
// **It does not fill a gap.** `ObservedFact.value === null` means unknown, and it
// is the only spelling of unknown — never `0`, never `""`, never a plausible
// default. A fact with no source surface and no observation time comes back with
// `isUnknown` already true from the server, and this module preserves that rather
// than second-guessing it.
//
// **It declares no credential field (R15.2).** No type below has a field — and no
// request body below has a key — whose name reads as a token, a cookie, a session,
// a secret, or an api key. LinkedIn credentials live server-side and never reach
// the browser. The session token is read from `sessionStorage` inside `gtmFetch`
// and put straight onto the `Authorization` header; it is never a field on a type.
// `__tests__/gtmAPI.test.ts` scans this file with the same expression
// `schemas/gtm.py` uses.
//
// Conventions mirror `services/evaAPI.ts`: a base URL built from `CONFIG`, one
// private `gtmFetch<T>()` that attaches the bearer token and turns a non-`ok`
// response into an `Error` carrying the server's `detail`, and a single default-
// exported object of methods.

import CONFIG from "./config";

export const GTM_BASE_URL = `${CONFIG.WEEZ_BASE_URL}/gtm`;

// ─── Value sets (mirror schemas/gtm.py, which checks them against enums.py) ───

/** The first of the Four_State_Dimensions: are we connected on LinkedIn. */
export type RelationshipState =
  | "UNKNOWN"
  | "NOT_CONNECTED"
  | "CONNECTION_PENDING"
  | "CONNECTED"
  | "REJECTED";

/** The second: how far the conversation itself has got. */
export type ConversationState =
  | "NOT_STARTED"
  | "WARMUP_READY"
  | "WARMUP_SENT"
  | "WAITING_FOR_REPLY"
  | "CONVERSATION_ACTIVE"
  | "CTA_READY"
  | "MEETING_REQUESTED"
  | "MEETING_BOOKED"
  | "CLOSED";

/** The third: how far a *requested action* got. Never a claim about an outcome. */
export type ExecutionState =
  | "NOT_STARTED"
  | "ACTION_REQUESTED"
  | "ACTION_IN_PROGRESS"
  | "ACTION_SUCCEEDED"
  | "ACTION_FAILED"
  | "VERIFICATION_PENDING"
  | "VERIFIED";

/** The fourth: the observed activity band. "UNKNOWN" is not "INACTIVE". */
export type ActivityLevel =
  | "UNKNOWN"
  | "INACTIVE"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH";

/** A display projection of `conversationState`, not a fifth dimension. */
export type ConversationStage =
  | "CONNECTION"
  | "WARMUP"
  | "ENGAGEMENT"
  | "DISCOVERY"
  | "VALUE"
  | "CTA"
  | "MEETING";

/**
 * How sure we are about an action's outcome. Sits *beside* `executionState` and is
 * never folded into it: `UNKNOWN` means the verification budget ran out with
 * nothing observed, which is a statement about us and must never render as a
 * failure of the operator's action.
 */
export type ConfirmationStatus =
  | "NOT_APPLICABLE"
  | "WAITING_FOR_CONFIRMATION"
  | "CONFIRMED"
  | "UNKNOWN";

export type CtaState =
  | "NOT_READY"
  | "SOFT_CTA_READY"
  | "MEETING_CTA_READY"
  | "MEETING_REQUESTED"
  | "MEETING_BOOKED";

export type ReplyClassification =
  | "INTERESTED"
  | "CURIOUS"
  | "QUESTION"
  | "PAIN_ACKNOWLEDGED"
  | "OBJECTION"
  | "NOT_INTERESTED"
  | "MEETING_INTENT"
  | "REFERRAL"
  | "WRONG_PERSON"
  | "OPT_OUT"
  | "OTHER";

export type ChannelKey = "LINKEDIN" | "EMAIL" | "PHONE";

/** Where a fact was seen. The provenance half of every `ObservedFact`. */
export type SourceSurface =
  | "LINKEDIN_PROFILE_PAGE"
  | "LINKEDIN_ACTIVITY_TAB"
  | "LINKEDIN_MESSAGING_THREAD"
  | "LINKEDIN_INVITATION_MANAGER"
  | "LINKEDIN_API_ORG_SOCIAL"
  | "HUMAN_CONFIRMATION"
  | "CALENDAR_BOOKING"
  | "WEEZ_UI_CLICK";

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export type FactorKey =
  | "icp_match"
  | "intent_class"
  | "acv_tier"
  | "signal_strength"
  | "signal_recency"
  | "linkedin_activity_level"
  | "email_available"
  | "phone_available"
  | "prior_interaction_count"
  | "prior_interaction_outcomes"
  | "relationship_state"
  | "seniority";

/** Which way a factor pulled a channel's score, or that it could not be read. */
export type FactorDirection = "RAISES" | "LOWERS" | "NEUTRAL" | "UNAVAILABLE";

export type OutcomeClass =
  | "MEETING_BOOKED"
  | "POSITIVE_REPLY"
  | "REPLIED"
  | "CONNECTION_ACCEPTED"
  | "OBJECTION"
  | "CONNECTION_IGNORED"
  | "NO_RESPONSE"
  | "WRONG_PERSON"
  | "OPTED_OUT"
  | "UNKNOWN";

export type ActionType = "CONNECT" | "SEND_MESSAGE" | "MEETING_REQUEST";

export type MessagePurpose = "WARMUP" | "FOLLOWUP" | "CTA";

export type MessageDirection = "OUTBOUND" | "INBOUND";

export type ObservationPurpose = "PROFILE" | "ACTIVITY" | "RELATIONSHIP" | "THREAD";

export type ActorType = "USER" | "SYSTEM" | "SERVICE";

export type EventOutcome =
  | "APPLIED"
  | "REJECTED_NO_EVIDENCE"
  | "REJECTED_STALE"
  | "REJECTED_ILLEGAL"
  | "DUPLICATE"
  | "CORRECTED"
  | "RECORDED";

export type EnqueueOutcome = "ENQUEUED" | "DEDUPED";

/** The two orderings the ranked queue supports. */
export type ProspectSort = "score" | "recency";

// ─── The evolving-state vocabulary (mirrors the same value sets in gtm.py) ────
//
// Nine more value sets, none of them a member added to one of the four above.
// `enums.py` owns them, `schemas/gtm.py` pins each Literal against it at import,
// and this block is the third spelling of the same lists — which is why every set
// here is written out rather than widened from an existing one.

/** `signals.SignalType` — 29 types, `UNCLASSIFIED` last and carrying relevance 0. */
export type SignalType =
  | "LINKEDIN_POST"
  | "LINKEDIN_COMMENT"
  | "LINKEDIN_REACTION"
  | "LINKEDIN_SHARE"
  | "PROFILE_VIEWED_US"
  | "JOB_CHANGE"
  | "PROMOTION"
  | "COMPANY_GROWTH"
  | "FUNDING_ROUND"
  | "PRODUCT_LAUNCH"
  | "HIRING_SIGNAL"
  | "TECH_STACK_CHANGE"
  | "COMPETITOR_MENTION"
  | "PAIN_STATEMENT"
  | "CONNECTION_REQUESTED"
  | "CONNECTION_ACCEPTED"
  | "CONNECTION_REJECTED"
  | "INBOUND_REPLY"
  | "POSITIVE_REPLY"
  | "NEGATIVE_REPLY"
  | "OBJECTION"
  | "MEETING_REQUESTED"
  | "MEETING_BOOKED"
  | "OPTED_OUT"
  | "WRONG_PERSON"
  | "EMAIL_BOUNCED"
  | "ACTION_EXECUTED"
  | "HUMAN_NOTE"
  | "UNCLASSIFIED";

/** Where a fact was observed, which is a different question from what it is about. */
export type SignalSource =
  | "LINKEDIN_OBSERVATION"
  | "HUMAN_ENTRY"
  | "INBOUND_REPLY"
  | "ACTION_OUTCOME"
  | "ENRICHMENT";

/** How wide the observed instant is. A fact known to the day is not known to the second. */
export type TimestampPrecision = "EXACT" | "DAY" | "WEEK" | "MONTH";

/** The eleven intent types held per prospect. A hiring signal is not a buying signal. */
export type IntentType =
  | "BUYING"
  | "HIRING"
  | "FUNDING"
  | "EXPANSION"
  | "PRODUCT_LAUNCH"
  | "PAIN_PROBLEM"
  | "RESEARCH"
  | "COMPETITOR"
  | "ENGAGEMENT"
  | "CONVERSATION"
  | "MEETING";

/** Where the prospect stands in their own buying process. `UNKNOWN` is not `UNAWARE`. */
export type BuyingStage =
  | "UNKNOWN"
  | "UNAWARE"
  | "PROBLEM_AWARE"
  | "SOLUTION_AWARE"
  | "EVALUATING"
  | "DECIDING";

export type EngagementTrend = "RISING" | "FLAT" | "DECLINING";

export type ActivityTrendFlag = "SPIKE" | "STEADY" | "DECLINE" | "UNKNOWN";

/** `UNAVAILABLE` is an absence — no contact identifier — and never a low score. */
export type ChannelAvailability = "UNKNOWN" | "AVAILABLE" | "UNAVAILABLE";

/** `UNKNOWN` whenever no timezone resolved. An unresolved timezone is not "outside". */
export type BusinessHours = "WITHIN" | "OUTSIDE" | "UNKNOWN";

/**
 * The 21-value journey projection.
 *
 * A projection of the four dimensions, recomputed on every read and never
 * authoritative: it renders *beside* the dimensions, never instead of them.
 */
export type JourneyState =
  | "DO_NOT_CONTACT"
  | "DISQUALIFIED"
  | "MEETING_BOOKED"
  | "MEETING_REQUESTED"
  | "DISCOVERY"
  | "NO_RESPONSE"
  | "CONVERSATION_ACTIVE"
  | "AWAITING_REPLY"
  | "WARMUP_SENT"
  | "DORMANT"
  | "NURTURE"
  | "CONNECTION_REJECTED"
  | "CONNECTION_REQUESTED"
  | "CONNECTION_PENDING"
  | "NO_ENGAGEMENT"
  | "CONNECTED"
  | "NOT_CONNECTED"
  | "RESEARCH_NEEDED"
  | "QUALIFIED"
  | "IDENTIFIED"
  | "NEW";

/** The queue's band. Banded from six inputs that all travel beside it, so no disclaimer. */
export type PriorityTier = "NOW" | "TODAY" | "THIS_WEEK" | "LATER";

/**
 * The thirteen Candidate_Action types the ranking considers.
 *
 * Not `ActionType`, which stays the three things an operator can be asked to do in
 * a browser. Four of these target no channel at all, and every one of them names
 * something the **operator** does: the value set describes the work being proposed,
 * and no route behind it acts inside LinkedIn or a mailbox.
 */
export type CandidateActionType =
  | "CONNECT_LINKEDIN"
  | "SEND_LINKEDIN_WARMUP"
  | "SEND_LINKEDIN_FOLLOWUP"
  | "SEND_EMAIL"
  | "SEND_EMAIL_FOLLOWUP"
  | "CALL"
  | "WAIT"
  | "RESEARCH_MORE"
  | "CHANGE_MESSAGE_ANGLE"
  | "ASK_DISCOVERY_QUESTION"
  | "REQUEST_MEETING"
  | "NURTURE"
  | "STOP_OUTREACH";

/** The nine reasons a candidate was considered and not recommended. */
export type ExclusionReason =
  | "DO_NOT_CONTACT"
  | "CHANNEL_UNAVAILABLE"
  | "COOLDOWN_ACTIVE"
  | "USER_SUPPRESSED"
  | "NEXT_ACTION_SUPPRESSED"
  | "FREQUENCY_CAP"
  | "PRECONDITION_UNMET"
  | "INSUFFICIENT_CONFIDENCE"
  | "STATE_STALE_DEPRIORITISED";

/** The eleven scoring terms. Nine contribute, two subtract. */
export type ActionTermKey =
  | "expected_success_probability"
  | "business_value"
  | "channel_fit"
  | "timing_fit"
  | "relationship_fit"
  | "intent_fit"
  | "historical_performance"
  | "confidence"
  | "risk"
  | "fatigue_penalty"
  | "cooldown_penalty";

/** The eleven lifecycle positions, as they travel on a recorded ledger row. */
export type LifecyclePosition =
  | "RECOMMENDED"
  | "VIEWED"
  | "CLICKED"
  | "STARTED"
  | "EXECUTED"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "SYSTEM_OBSERVED"
  | "OUTCOME_RECEIVED";

/**
 * The five positions the lifecycle route admits — `action_lifecycle`'s
 * `NON_DIMENSION_POSITIONS`.
 *
 * The other six move a state dimension and are refused there with a 422 naming the
 * route that owns them, so the type is narrowed here rather than left to a runtime
 * refusal. `CLICKED` in particular belongs to the existing `action/request` route.
 */
export type NonDimensionLifecyclePosition =
  | "RECOMMENDED"
  | "VIEWED"
  | "CANCELLED"
  | "EXPIRED"
  | "OUTCOME_RECEIVED";

/** The seven human judgements about a recommendation. */
export type FeedbackType =
  | "GOOD_RECOMMENDATION"
  | "NOT_RELEVANT"
  | "WRONG_CHANNEL"
  | "WRONG_TIMING"
  | "WRONG_MESSAGE"
  | "ALREADY_HANDLED"
  | "DO_NOT_RECOMMEND_AGAIN";

/** A judgement about the recommendation, or a record that the operator chose otherwise. */
export type FeedbackKind = "FEEDBACK" | "OVERRIDE";

export type LearningScope = "GLOBAL" | "WORKSPACE" | "USER";

/** `INSUFFICIENT_SAMPLE_RETAINED` is the decision *not* to learn, recorded as one. */
export type LearningDecision = "APPLIED" | "INSUFFICIENT_SAMPLE_RETAINED";

/** The seven dashboard statements, keyed so each count carries its own filter. */
export type DashboardAggregateKey =
  | "state_changed"
  | "newly_high_intent"
  | "more_reachable_elsewhere"
  | "went_cold"
  | "needs_followup"
  | "high_intent_no_action"
  | "channel_performance_leading_persona";

/** How one clause of a dashboard filter compares. */
export type FilterOperator =
  | "EQUALS"
  | "IN"
  | "AT_LEAST"
  | "AT_MOST"
  | "WITHIN_DAYS"
  | "ABSENT"
  | "CHANGED_TO";

/** The two orderings the cross-prospect action queue supports. */
export type ActionQueueSort = "priority" | "recency";

// ─── The two honesty primitives ───────────────────────────────────────────────

/**
 * A value plus the provenance that makes it a fact.
 *
 * `value === null` means UNKNOWN, and it is the only spelling of unknown. A value
 * that arrived without a surface and without an observation time comes back with
 * `isUnknown` true — the value is still carried so a gap can be debugged, but the
 * UI reads `isUnknown` and renders "Unknown".
 *
 * `isDerived` marks a value the layer computed rather than read off a surface;
 * `isStale` marks an observation older than the freshness window. Stale is not
 * unknown: it is a fact with an age.
 */
export interface ObservedFact {
  value: string | null;
  isUnknown: boolean;
  sourceSurface: SourceSurface | null;
  observedAt: string | null;
  isStale: boolean;
  isDerived: boolean;
}

/**
 * A prioritisation signal, always labelled. There is no bare integer score in any
 * GTM payload: `scoreKind` and `scoreDisclaimer` are persisted alongside the
 * number so the label cannot be lost in transit or forgotten at render time.
 *
 * `score === null` means the score could not be computed — not that it is zero.
 */
export interface DerivedScore {
  score: number | null;
  scoreKind: "RECOMMENDATION_SCORE";
  scoreDisclaimer: string;
  isDerived: true;
}

/**
 * One factor's contribution to one score.
 *
 * Available and unavailable factors both appear: "we could not see this" is part
 * of why a recommendation says what it says, and an unavailable factor is reported
 * as absent rather than scored zero.
 */
export interface FactorContribution {
  factor: string;
  available: boolean;
  weight: number | null;
  value: number | null;
  persistedValue: string | null;
  source: string | null;
  contributionHundredths: number | null;
  direction: FactorDirection | null;
  unavailableReason: string | null;
}

// ─── Intelligence panels ──────────────────────────────────────────────────────

/**
 * One channel's scored result.
 *
 * `availableWeightMass` is the weight actually applied, in hundredths of the full
 * column — which is what caps `confidence` below `HIGH` whenever something was
 * missing, so the card can explain its own confidence without a second lookup.
 */
export interface ChannelResult {
  channel: ChannelKey;
  score: DerivedScore;
  confidence: Confidence;
  recommendation: string;
  reasoning: FactorContribution[];
  unavailableFactors: FactorKey[];
  availableWeightMass: number | null;
  computedAt: string | null;
}

/**
 * One evaluation: three channel results and the winner.
 *
 * `persisted` is false when the input fingerprint was already on the table and
 * this pass wrote nothing. The results are still returned — identical inputs
 * produce an identical score by construction.
 */
export interface ChannelEvaluation {
  evaluationId: string | null;
  channels: ChannelResult[];
  recommendedChannel: ChannelKey | null;
  weightSetLabel: string | null;
  computedAt: string | null;
  persisted: boolean;
}

/**
 * Observed LinkedIn activity, banded.
 *
 * `score.score` is absent — not zero — when nothing has been observed, and `level`
 * then reads unknown: a zero would claim "we looked and this person is dormant",
 * which an empty set does not support.
 */
export interface Activity {
  score: DerivedScore;
  level: ObservedFact;
  observedAt: string | null;
  isStale: boolean;
  sourceSurface: SourceSurface | null;
  /** The banded inputs behind the score, keyed as the engine wrote them. */
  components: Record<string, number>;
}

/**
 * Who this prospect is: observed identity from the profile page, plus Eva's
 * qualification. `seniority`, `icpMatch`, `intentSignal`, and `acvTier` arrive
 * marked derived, so the UI can say so.
 */
export interface ProspectProfile {
  leadId: string;
  profileId: string | null;
  profileUrl: string | null;
  publicIdentifier: string | null;
  name: ObservedFact;
  headline: ObservedFact;
  company: ObservedFact;
  role: ObservedFact;
  location: ObservedFact;
  seniority: ObservedFact;
  icpMatch: ObservedFact;
  intentSignal: ObservedFact;
  acvTier: ObservedFact;
  leadScore: DerivedScore;
}

/**
 * The four dimensions as four fields. Never merged.
 *
 * `conversationStage` is the display projection of `conversationState`, and
 * `confirmationStatus` sits beside `executionState` rather than inside it.
 * `displaySummary` is the one combined label the screen shows: display-only,
 * marked derived, and carrying no authority — each dimension stays independently
 * visible beside it.
 */
export interface ProspectState {
  relationshipState: ObservedFact;
  conversationState: ObservedFact;
  conversationStage: ObservedFact;
  executionState: ObservedFact;
  activityLevel: ObservedFact;
  confirmationStatus: ConfirmationStatus;
  displaySummary: string;
  displaySummaryIsDerived: true;
}

/**
 * CTA readiness for the conversation. `decidedBy` says whether the score band or
 * an evidence gate produced `ctaState`: the meeting states mirror the reconciled
 * `conversationState` and are never reached by a score.
 */
export interface CTA {
  score: DerivedScore;
  ctaState: CtaState;
  recommendedCta: string | null;
  decidedBy: string | null;
  reasoning: FactorContribution[];
  computedAt: string | null;
}

/**
 * One message row: a draft we prepared, or a reply we observed.
 *
 * The three content fields are three different claims and are never collapsed:
 *   `generatedContent` — what the model wrote, byte-identical after an edit
 *   `editedContent`    — what the human decided to say. Intent, not evidence
 *   `sentContent`      — what was observed in the thread or explicitly confirmed.
 *                        The only one of the three that proves a message exists
 *
 * `generatedContent` is null on a generation failure, with
 * `generationFailureReason` populated: a draft that could not be written is a
 * record, not an error.
 *
 * `charLimit` is the channel cap for this purpose, sent so the composer's counter
 * is read rather than recomputed in the browser.
 */
export interface Message {
  messageId: string;
  conversationId: string;
  direction: MessageDirection;
  messagePurpose: MessagePurpose | null;
  version: number;
  generatedContent: string | null;
  editedContent: string | null;
  sentContent: string | null;
  generationFailureReason: string | null;
  charLimit: number | null;
  editedByUserId: string | null;
  editedAt: string | null;
  observedText: string | null;
  replyClassification: ReplyClassification | null;
  replyConfidence: number | null;
  needsHumanReview: boolean;
  derivedNextAction: string | null;
  suggestedResponse: string | null;
  referralDetail: string | null;
  sourceSurface: SourceSurface | null;
  observedAt: string | null;
  createdAt: string | null;
}

/**
 * One requested human action: a destination and a payload, and no capability.
 *
 * `destinationUrl` is where the operator goes and `payloadText` is what they copy.
 * Weez cannot act inside LinkedIn and nothing on this shape implies otherwise.
 *
 * Both halves of the story travel side by side: `executionState` is how far the
 * request got, `confirmationStatus` is how sure we are about its outcome.
 * `attemptsRemaining` is what makes `UNKNOWN` legible — an operator seeing
 * "couldn't confirm" is entitled to know the budget ran out rather than that
 * something failed.
 */
export interface Action {
  actionId: string;
  profileId: string | null;
  conversationId: string | null;
  messageId: string | null;
  actionType: ActionType;
  channel: ChannelKey;
  executionState: ExecutionState;
  confirmationStatus: ConfirmationStatus;
  isVerified: boolean;
  requestedByUserId: string | null;
  requestedAt: string | null;
  destinationUrl: string | null;
  payloadText: string | null;
  instructions: string | null;
  linkedinOpenedAt: string | null;
  verificationAttempts: number;
  verificationBudget: number;
  attemptsRemaining: number;
  nextVerificationAt: string | null;
  verifiedAt: string | null;
  outcomeEvidenceId: string | null;
  failureReason: string | null;
}

/**
 * The next move Weez proposes, with the payload ready.
 *
 * `latestAction` is the last action requested for this prospect, so the
 * confirmation badge can sit next to the control without a second call.
 * `isSuppressed` is the stop: a terminal reply suppresses further outreach, and
 * the reason a control is absent is reported rather than left as silence.
 */
export interface NextAction {
  actionType: ActionType;
  channel: ChannelKey;
  recommendation: string;
  reasoning: string[];
  messageId: string | null;
  destinationUrl: string | null;
  payloadText: string | null;
  instructions: string | null;
  latestAction: Action | null;
  isSuppressed: boolean;
}

/**
 * One append-only ledger entry.
 *
 * The row's free-form `detail` JSON is deliberately not projected by the API, so
 * there is nothing here to render from it — and no set of keys a schema scan
 * cannot see. Message bodies never appear in a timeline entry.
 */
export interface TimelineEntry {
  eventId: string;
  eventType: string;
  eventAt: string;
  summary: string;
  outcome: EventOutcome;
  dimension: string | null;
  priorValue: string | null;
  newValue: string | null;
  actorId: string;
  actorType: ActorType;
  evidenceId: string | null;
  evidenceSourceSurface: SourceSurface | null;
  evidenceObservedValue: string | null;
  evidenceObservedAt: string | null;
  evidenceConfidence: Confidence | null;
  relatedActionId: string | null;
  relatedMessageId: string | null;
  /**
   * Two additive references, so one entry shape carries three append-only ledgers:
   * the state events, the signal-reconciliation outcomes (which name the signal
   * decided about) and the recorded action lifecycle positions (which name the
   * recommendation they belong to). Both are null on an existing timeline row.
   */
  signalId: string | null;
  recommendationId: string | null;
}

// ─── The prospect payloads ────────────────────────────────────────────────────

/**
 * Everything the prospect screen renders.
 *
 * `channels` is either three results or none: the engine scores all three channels
 * in one evaluation, so a prospect whose evaluation has not run reports no
 * channels and no `recommendedChannel` rather than a fabricated winner.
 *
 * `messageVersions` retains prior drafts newest-first; `latestMessage` is the head
 * of that list, kept as its own field because it is what the composer opens with.
 */
export interface ProspectDetail {
  leadId: string;
  profile: ProspectProfile;
  activity: Activity;
  channels: ChannelResult[];
  recommendedChannel: ChannelKey | null;
  state: ProspectState;
  cta: CTA;
  nextAction: NextAction | null;
  latestMessage: Message | null;
  messageVersions: Message[];
  updatedAt: string | null;
}

/** One row of the ranked queue. The four dimensions travel here too, in `state`. */
export interface ProspectListItem {
  leadId: string;
  profileId: string | null;
  profileUrl: string | null;
  name: ObservedFact;
  headline: ObservedFact;
  company: ObservedFact;
  score: DerivedScore;
  recommendedChannel: ChannelKey | null;
  confidence: Confidence | null;
  recommendation: string | null;
  activity: Activity;
  state: ProspectState;
  nextActionType: ActionType | null;
  updatedAt: string | null;
}

/** One keyset-paged page of the queue. `nextCursor` is null iff `hasMore` is false. */
export interface ProspectListPage {
  items: ProspectListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** One page of the prospect timeline, in the order the server returned it. */
export interface TimelinePage {
  entries: TimelineEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Acknowledgement that a read was requested.
 *
 * `DEDUPED` is not a failure: an identical request inside the dedupe window
 * returns the job already queued, so a caller can poll one id whether or not it
 * won the race to create it.
 */
export interface ObservationEnqueued {
  outcome: EnqueueOutcome;
  purpose: ObservationPurpose;
  jobId: number | null;
  sourceSurface: SourceSurface | null;
  deduped: boolean;
  reason: string | null;
}

/**
 * Acknowledgement that an outreach outcome was persisted.
 *
 * `recorded` is false when the observation was already on the table: an outcome
 * observed twice is one fact, and a cohort is a count of facts rather than a count
 * of reads.
 *
 * Two outcomes here too, never one. Recording an outreach outcome is a learning
 * write *and* an application of the same fact to the prospect state as a signal, and
 * either can decline while the other succeeds — an `observedAt` further in the
 * future than the server's clock-skew tolerance is refused by the signal engine as
 * implausible, so the outcome and its reward land and no belief moves. The eight
 * fields below are that second verdict, and they are the same names and meanings
 * `SignalRecorded` carries for the same two engines.
 *
 * `applyOutcome === null` means no application was attempted: the signal ingest
 * itself was refused, and the reason is on the ingest ledger the debug view returns.
 * Every one of the eight is nullable rather than defaulted, because the same shape
 * is also how the debug view projects a *historical* outcome row, where there is no
 * application in front of it at all — a `stateVersion` of 0 there would be a claim
 * about a fold that never ran.
 */
export interface OutcomeRecorded {
  outcomeId: string;
  channelUsed: ChannelKey;
  outcomeClass: OutcomeClass;
  observedAt: string | null;
  sourceSurface: SourceSurface | null;
  recorded: boolean;
  signalId: string | null;
  applyOutcome: EventOutcome | null;
  applyReason: string | null;
  changedDimensions: string[] | null;
  stateVersion: number | null;
  snapshotId: string | null;
  nbaMarked: boolean | null;
  outOfOrder: boolean | null;
}

// ─── The evolving prospect state ──────────────────────────────────────────────
//
// Projections of `gtm_signals`, `gtm_prospect_state`, `gtm_prospect_intents`,
// `gtm_channel_states` and `gtm_state_snapshots`. The two honesty primitives above
// carry every state value and every score, and a measure on the hundredths scale
// (0–100) travels as a plain bounded integer rather than dressed as a score.

/**
 * One observed fact about one prospect.
 *
 * The four numbers are four independent claims: `strength` is how much the fact
 * would matter if it were fresh, `confidence` how sure we are it is true,
 * `relevance` how much it bears on this brand's motion, and `effectiveStrength`
 * their product with the freshness multiplier from the decay profile — recomputed
 * server-side at request time, so what is shown is current rather than cached.
 *
 * `atFloor` says the fact was already past its retention horizon when it arrived,
 * so it entered contributing its profile floor and nothing more. An expired signal
 * is still returned: retaining the record and retaining its influence are different
 * things.
 */
export interface Signal {
  signalId: string;
  signalType: SignalType;
  source: SignalSource;
  sourceSurface: SourceSurface;
  eventTimestamp: string | null;
  eventTimestampPrecision: TimestampPrecision;
  ingestedAt: string | null;
  strength: number;
  confidence: number;
  relevance: number;
  effectiveStrength: number;
  decayProfile: string | null;
  expiresAt: string | null;
  atFloor: boolean;
  originTable: string | null;
  originId: string | null;
  /** The evidence behind the fact, sanitised server-side. Keys are data, not a vocabulary. */
  payload: Record<string, unknown>;
}

/** One keyset-paged page of a prospect's signals, newest-first by event timestamp. */
export interface SignalPage {
  items: Signal[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * One of the eleven intent records held per prospect.
 *
 * A type nothing supports is materialised at value zero and confidence zero rather
 * than left absent, so "no buying intent" and "never looked" are the same shape to
 * read and `evaluatedAt` is what distinguishes them. `value` is a measure, not a
 * score: it carries no kind and no disclaimer because it is not a prioritisation
 * number.
 */
export interface Intent {
  intentType: IntentType;
  value: number;
  confidence: number;
  source: string;
  evaluatedAt: string | null;
  decayRate: number;
  signalIds: string[];
  isDerived: boolean;
}

/**
 * One channel's durable state — three rows per prospect, never averaged together.
 *
 * A prospect who ignores email but answers on LinkedIn has a low email
 * `responsiveness` and a high LinkedIn one, not a mediocre blend.
 * `availability: "UNAVAILABLE"` beside `suitability: 0` is an absence rather than a
 * low score.
 *
 * `provenance` carries the surface and observation time of the three fields that
 * are read rather than counted — `availability`, `activity`, `responsiveness` — so
 * the LinkedIn row's copied activity says where it came from.
 */
export interface ChannelState {
  channel: ChannelKey;
  availability: ChannelAvailability;
  reachability: number;
  activity: number;
  engagement: number;
  responsiveness: number;
  responseRate: number;
  historicalConversionRate: number;
  confidence: number;
  suitability: number;
  lastInteractionAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  cooldownUntil: string | null;
  consecutiveUnanswered: number;
  provenance: Record<string, ObservedFact>;
}

/**
 * Where the prospect stands in their own buying process.
 *
 * `UNKNOWN` at confidence zero is both the initial value and the honest fallback: a
 * signal set too weak to place the prospect leaves the stage unknown rather than
 * guessing one.
 */
export interface BuyingStageState {
  value: BuyingStage;
  confidence: number;
  signalIds: string[];
  isDerived: true;
}

/**
 * The trailing engagement counts and their direction.
 *
 * Counts rather than measures, counted from each signal's event timestamp rather
 * than its ingestion time, so a backfill cannot read as a surge. `FLAT` is the
 * default and `evaluatedAt` is what says whether anyone has looked.
 */
export interface EngagementTrajectory {
  count24h: number;
  count7d: number;
  count30d: number;
  trend: EngagementTrend;
  evaluatedAt: string | null;
}

/**
 * When to act, on the evidence. The window is an ideal, never a promise about it.
 *
 * `withinBusinessHours` is `UNKNOWN` whenever no timezone resolved — an unresolvable
 * timezone is not "outside hours".
 */
export interface TimingState {
  lastMeaningfulSignalAt: string | null;
  signalFreshness: number;
  urgency: number;
  cooldownUntil: string | null;
  idealNextActionWindowStart: string | null;
  idealNextActionWindowEnd: string | null;
  withinBusinessHours: BusinessHours;
  activityTrendFlag: ActivityTrendFlag;
}

/** How sure we are this is the right person, and when that was settled. */
export interface IdentityState {
  confidence: number;
  verifiedAt: string | null;
  sourceSurface: SourceSurface | null;
  observedAt: string | null;
}

/**
 * Two ICP verdicts, never merged.
 *
 * `score` / `confidence` / `components` are this layer's re-evaluation, folded from
 * signals and inspectable through `signalIds`; the three `discovery*` fields are the
 * original qualification, left exactly as it was recorded. A prospect can be strong
 * on one and weak on the other, and a reader is entitled to see which.
 */
export interface IcpState {
  score: DerivedScore;
  confidence: number;
  components: FactorContribution[];
  evaluatedAt: string | null;
  signalIds: string[];
  discoveryIcpPassed: boolean | null;
  discoveryCriteria: string | null;
  discoveryAcvTier: string | null;
}

/**
 * Everything the layer believes about one prospect, and why.
 *
 * `dimensions` holds the four ledger-backed dimensions as four `ObservedFact`s,
 * keyed as the engine wrote them. The dimensions this engine added sit *beside*
 * them in their own fields — `buyingStage`, `engagement.trend`,
 * `timing.activityTrendFlag`, `channels[].availability` — and `journeyState` is the
 * derived projection, which renders next to the grid rather than in place of it.
 *
 * `stateConfidence` and `dimensionConfidence` are one overall number and one per
 * dimension. `stateFlags` carries `STATE_STALE` while the overall confidence sits
 * below the configured threshold: a flag, not a silence.
 *
 * `doNotContact` is an `ObservedFact` because the flag is worthless without the
 * surface that set it, and an unset flag is *absence* rather than `false`: "nobody
 * has told us to stop" and "we observed that we may continue" are different claims.
 */
export interface ProspectStateFull {
  leadId: string;
  stateVersion: number;
  journeyState: ObservedFact;
  stateConfidence: number;
  stateFlags: string[];
  dimensions: Record<string, ObservedFact>;
  identity: IdentityState;
  icp: IcpState;
  intents: Intent[];
  channels: ChannelState[];
  engagement: EngagementTrajectory;
  buyingStage: BuyingStageState;
  timing: TimingState;
  dimensionConfidence: Record<string, number>;
  doNotContact: ObservedFact;
  updatedAt: string | null;
}

/**
 * One append-only state snapshot.
 *
 * `state` is the whole belief as it stood at `recordedAt`, so "what did Weez
 * believe on the fourth?" is one read rather than a replay of per-dimension events.
 * `changedDimensions` is what moved in the change this snapshot records, which is
 * what makes a history page readable without diffing two payloads.
 *
 * `journeyState` is a plain string here and not the 21-value union: the persisted
 * copy is a history convenience carrying no constraint, and pinning it would turn an
 * old row into a render error.
 */
export interface StateSnapshot {
  snapshotId: string;
  recordedAt: string | null;
  stateVersion: number;
  changedDimensions: string[];
  confidence: number;
  journeyState: string | null;
  triggeringSignalId: string | null;
  triggeringActionId: string | null;
  state: Record<string, unknown>;
}

/**
 * One page of the state history, newest-first.
 *
 * An `asOf` query answers with the snapshot in force at that instant as a one-item
 * page — the same shape, so a caller reads one response format either way. Before
 * the first snapshot the page is empty: the layer had no recorded belief then.
 */
export interface StateHistoryPage {
  items: StateSnapshot[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * What recording one fact acknowledges: two outcomes, and what the second moved.
 *
 * Two engines and two ledger stages, and either can decline while the other
 * succeeds — a duplicate fact is retained and applies nothing, a well-formed fact
 * whose evidence the reconciler refuses is recorded and moves no dimension. Both
 * travel, each with its own reason, so a caller can tell those apart.
 *
 * `applyOutcome` is null only where no application was attempted, which is the
 * ingest-rejection path. `snapshotId === null` is how a reader knows no new snapshot
 * was written. `nbaMarked` says the recompute mark was set — emphatically not a
 * ranking: nothing was generated, scored or persisted behind it.
 */
export interface SignalRecorded {
  leadId: string;
  signalId: string | null;
  dedupeKey: string | null;
  ingestOutcome: EventOutcome;
  ingestReason: string | null;
  unclassified: boolean;
  atFloor: boolean;
  eventTimestampInferred: boolean;
  applyOutcome: EventOutcome | null;
  applyReason: string | null;
  changedDimensions: string[];
  stateVersion: number;
  snapshotId: string | null;
  nbaMarked: boolean;
}

// ─── The ranking, the queue and the learning updates ──────────────────────────
//
// There is still no second score kind: an action score is a `DerivedScore` carrying
// the same persisted kind and disclaimer a channel score carries, and an action
// confidence, an urgency and a business value are measures rather than scores.
//
// `actionConfidence` and `stateConfidence` are two fields, never one. How much the
// ranking trusts itself and how much it trusted the belief it ranked over are
// different claims, and neither is derived from the other.

/**
 * One signal behind the timing of a recommendation — the first explanation section.
 *
 * Each bullet names the signal whose effective strength contributed, when the fact
 * happened, the term it fed and the evidence that resolves it, so "why now" is a set
 * of references rather than a sentence composed at render time.
 */
export interface WhyNow {
  signalId: string | null;
  signalType: SignalType | null;
  eventTimestamp: string | null;
  effectiveStrength: number;
  term: ActionTermKey | null;
  contributionHundredths: number | null;
  evidenceId: string | null;
}

/**
 * The third section: which facts an angle should be grounded in.
 *
 * Deliberately not a draft — `Message` carries those. `messageId` is null until a
 * draft exists, which is the common case: the recommendation is made first.
 */
export interface WhyThisMessage {
  messageId: string | null;
  messagePurpose: MessagePurpose | null;
  groundingSignalIds: string[];
  note: string | null;
}

/**
 * One rejected alternative, with its score and what lowered it.
 *
 * `actionScore.score === null` beside an `exclusionReason` is an alternative that was
 * never scored — excluded before aggregation — which is different from one that
 * scored badly.
 */
export interface ChannelComparison {
  actionType: CandidateActionType;
  channel: ChannelKey | null;
  actionScore: DerivedScore;
  exclusionReason: ExclusionReason | null;
  loweringTerms: FactorContribution[];
}

/**
 * Which learning scope the evaluation applied, and why.
 *
 * `appliedScope` is not always the narrowest scope that exists: a thin user or
 * workspace sample keeps the broader statistic and `decision` reads
 * `INSUFFICIENT_SAMPLE_RETAINED` with the counts in `decisionReason`. The decision
 * not to learn is recorded as legibly as the decision to.
 */
export interface LearningScopeDecision {
  appliedScope: LearningScope;
  sampleSize: number;
  minSample: number;
  decision: LearningDecision;
  decisionReason: string | null;
}

/**
 * The policy, model and learning versions plus the applied weight set.
 *
 * Four values rather than one composite string, because they move independently: a
 * scoring change bumps `policyVersion` alone, and a superseded weight set changes
 * `weightSetId` for later evaluations while leaving every persisted score as it was.
 */
export interface VersionQuad {
  policyVersion: string | null;
  modelVersion: string | null;
  learningVersion: string | null;
  weightSetId: string | null;
}

/**
 * The four-section explanation, as persisted on the recommended row.
 *
 * Every section is a list of references composed from persisted terms and signal
 * ids, so the same explanation renders the same way twice and can be audited against
 * the rows it was built from.
 */
export interface RecommendationExplanation {
  whyNow: WhyNow[];
  whyThisChannel: FactorContribution[];
  whyThisMessage: WhyThisMessage | null;
  whyNotTheOtherChannels: ChannelComparison[];
  scope: LearningScopeDecision | null;
  versions: VersionQuad | null;
}

/**
 * One candidate action, considered.
 *
 * Every candidate travels, the excluded ones included: an excluded row carries its
 * `exclusionReason`, no `rank`, and a score that is absent rather than zero, because
 * "we refused to score this" and "this scored nothing" are different statements.
 *
 * `terms` is the eleven component terms and `unavailableTerms` names the ones whose
 * input was missing — recorded, never defaulted to zero, so a gap in our knowledge
 * does not read as a fact about the prospect. `availableWeightMass` is the weight
 * actually applied, so a reader can re-derive the score instead of trusting it.
 *
 * `explanation` is populated on the recommended row and null on the others: the four
 * sections are composed once, for the action actually being argued for.
 */
export interface CandidateAction {
  recommendationId: string;
  actionType: CandidateActionType;
  channel: ChannelKey | null;
  rank: number | null;
  isRecommended: boolean;
  actionScore: DerivedScore;
  actionConfidence: number;
  stateConfidence: number;
  terms: FactorContribution[];
  unavailableTerms: ActionTermKey[];
  availableWeightMass: number;
  exclusionReason: ExclusionReason | null;
  explanation: RecommendationExplanation | null;
  expiresAt: string | null;
  computedAt: string | null;
}

/**
 * The persisted ranking for one prospect.
 *
 * `recommended` is the one row carrying `isRecommended`, with its explanation;
 * `candidates` is every row of the evaluation including the excluded ones and their
 * reasons. `recommended` is null when no evaluation has run — not a fabricated
 * `WAIT`, which would be inventing a recommendation nobody scored.
 *
 * The version quad travels on every response, cached or fresh, so a client always
 * knows which policy produced what it is looking at. `lifecycle` reuses the ledger
 * entry shape: `eventType` carries the position and `eventAt` the instant.
 */
export interface NextBestAction {
  leadId: string;
  evaluationId: string | null;
  computedAt: string | null;
  expiresAt: string | null;
  recommended: CandidateAction | null;
  candidates: CandidateAction[];
  policyVersion: string | null;
  modelVersion: string | null;
  learningVersion: string | null;
  weightSetId: string | null;
  learningScopeApplied: LearningScope | null;
  lifecycle: TimelineEntry | null;
}

/**
 * One learning statistic the evaluation applied.
 *
 * `sampleSize` travels with `ciLow` / `ciHigh` because a success rate without its
 * interval invites reading two outcomes as a trend, and `excludedUnknownCount` is
 * recorded per cohort rather than inferred from a difference. `scope` is the
 * population the row was computed over and `appliedScope` the one the evaluation
 * used; the two differ exactly when a sample was too thin to learn from.
 * `meanReward` is signed, because several outcome classes carry a non-positive one.
 */
export interface LearningUpdate {
  statId: string | null;
  scope: LearningScope;
  scopeUserId: string | null;
  actionType: CandidateActionType;
  channel: ChannelKey | null;
  sampleSize: number;
  positiveCount: number;
  negativeCount: number;
  excludedUnknownCount: number;
  successRate: number;
  ciLow: number;
  ciHigh: number;
  meanReward: number;
  decision: LearningDecision;
  decisionReason: string | null;
  appliedScope: LearningScope;
  minSample: number;
  learningVersion: string | null;
  computedAt: string | null;
}

/**
 * One row of the cross-prospect action queue.
 *
 * `priorityTier` is a band rather than a score, so it carries no disclaimer — and
 * the six inputs it was banded from all travel beside it: `urgency`,
 * `expectedSuccessProbability`, `businessValue`, `signalFreshness`,
 * `actionConfidence` and `relationshipState`. The tier is therefore re-derivable
 * from the row rather than an opaque badge.
 *
 * `recommendationId` is what makes the card usable: the feedback and lifecycle
 * routes both post against it.
 */
export interface ActionQueueItem {
  leadId: string;
  recommendationId: string | null;
  profileId: string | null;
  profileUrl: string | null;
  name: ObservedFact;
  headline: ObservedFact;
  company: ObservedFact;
  journeyState: ObservedFact;
  relationshipState: ObservedFact;
  actionType: CandidateActionType;
  channel: ChannelKey | null;
  actionScore: DerivedScore;
  actionConfidence: number;
  stateConfidence: number;
  priorityTier: PriorityTier;
  urgency: number;
  expectedSuccessProbability: number;
  businessValue: number;
  signalFreshness: number;
  whyNow: WhyNow[];
  expiresAt: string | null;
  computedAt: string | null;
}

/** One keyset-paged page of the action queue, highest priority first. */
export interface ActionQueuePage {
  items: ActionQueueItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * One clause of the filter behind a dashboard aggregate.
 *
 * A declared shape rather than a mapping: every count has to be a link, and a link
 * built from keys no scan can enumerate is exactly what this layer forbids.
 */
export interface FilterCriterion {
  field: string;
  operator: FilterOperator;
  values: string[];
}

/**
 * The query that reproduces one aggregate's count.
 *
 * `route` is the view the link opens and `criteria` the clauses to send, so a
 * statement links to the rows behind it instead of restating the number.
 */
export interface AggregateFilter {
  route: string;
  criteria: FilterCriterion[];
  periodDays: number | null;
}

/** One actionable statement: a count, and the filter that reproduces it. */
export interface DashboardAggregate {
  key: DashboardAggregateKey;
  count: number;
  filter: AggregateFilter;
}

/**
 * The dashboard's aggregates for one brand over one period.
 *
 * A statement that could not be computed is *absent* rather than reported as zero:
 * zero means "we looked and found none", which an unavailable aggregate does not
 * support.
 */
export interface Dashboard {
  periodDays: number;
  computedAt: string | null;
  aggregates: DashboardAggregate[];
}

/**
 * What one recorded judgement about a recommendation looks like, read back.
 *
 * The persisted row, so the card can show what *was* recorded rather than what it
 * hoped was recorded. `classification` and `adjustmentBasis` each carry one value by
 * construction: a preference is excluded from the success statistics and never reads
 * as outcome-derived learning.
 *
 * `suppressionWritten` and `recomputeMarked` report the two things the route did
 * besides writing the row — a permanent suppression for `DO_NOT_RECOMMEND_AGAIN`,
 * and the recompute mark that re-ranks this prospect and no other.
 */
export interface FeedbackRecorded {
  feedbackId: string;
  leadId: string;
  recommendationId: string | null;
  kind: FeedbackKind;
  feedbackType: FeedbackType | null;
  recommendedActionType: CandidateActionType | null;
  chosenActionType: CandidateActionType | null;
  classification: "USER_PREFERENCE_SIGNAL";
  comment: string | null;
  scoreAdjustment: number | null;
  adjustmentBasis: "PREFERENCE_DERIVED";
  suppressionWritten: boolean;
  recomputeMarked: boolean;
  recordedAt: string | null;
}

/**
 * The whole chain behind one prospect, read-only.
 *
 * The answer to "why does Weez believe this?", assembled from rows that already
 * exist: the current state exactly as the state route reports it, the signals it was
 * folded from, the reconciliation outcomes that decided about each of them, the
 * transitions, the snapshot headers, the recorded lifecycle positions, the observed
 * outcomes, and the newest evaluation's candidate set with the statistics it was
 * scored against.
 *
 * Three of the collections are ledger entries — `signalOutcomes`,
 * `stateTransitions` and `lifecycleEvents` — which is what the two additive
 * references on `TimelineEntry` exist for: three append-only tables, one entry shape.
 */
export interface DebugView {
  leadId: string;
  state: ProspectStateFull;
  signals: Signal[];
  signalOutcomes: TimelineEntry[];
  stateTransitions: TimelineEntry[];
  snapshots: StateSnapshot[];
  lifecycleEvents: TimelineEntry[];
  outcomes: OutcomeRecorded[];
  candidates: CandidateAction[];
  recommended: NextBestAction | null;
  learningUpdates: LearningUpdate[];
}

// ─── Request inputs ───────────────────────────────────────────────────────────

/**
 * The operator's click: an intent, recorded as one.
 *
 * `idempotencyKey` is required and unique server-side, so a double click, a
 * retried fetch, or a reloaded tab produces one requested action and one prepared
 * delivery rather than two. 8–64 characters; the page builds it from the ids it
 * already holds (`${leadId}:${actionType}:${messageId}:${version}`).
 */
export interface ActionRequestInput {
  actionType: ActionType;
  messageId?: string | null;
  idempotencyKey: string;
}

/**
 * The operator asserting an outcome Weez could not observe.
 *
 * `sentText` is what they say they sent. Server-side it reaches `sentContent`
 * under `HUMAN_CONFIRMATION` and nowhere else.
 */
export interface ActionConfirmInput {
  sentText?: string | null;
  /** ISO-8601. Defaults server-side to now. */
  observedAt?: string | null;
}

/** Ask for a new draft. `purpose` picks the directive and the character cap. */
export interface MessageGenerateInput {
  purpose?: MessagePurpose;
}

/**
 * Ask the LinkedIn VM to read one surface.
 *
 * `url` is required for every purpose except `PROFILE`, which defaults to the
 * prospect's persisted profile URL: this layer does not build LinkedIn addresses,
 * so it cannot reach a surface it was not pointed at.
 */
export interface ObserveInput {
  purpose: ObservationPurpose;
  url?: string | null;
  priority?: number;
}

/**
 * Record an observed outreach outcome for the learning loop.
 *
 * The evidence is part of the request rather than an afterthought: an outcome with
 * no surface and no observation time is not an outcome. `WEEZ_UI_CLICK` is refused
 * server-side — a click is evidence of a request, never of a result.
 */
export interface OutcomeInput {
  channelUsed: ChannelKey;
  outcomeClass: OutcomeClass;
  sourceSurface: SourceSurface;
  /** ISO-8601, required. */
  observedAt: string;
  observedValue?: string | null;
  confidence?: Confidence;
  observationRef?: string | null;
  recommendationId?: string | null;
  actionId?: string | null;
}

/** Paging and ordering for the ranked queue. */
export interface ProspectListQuery {
  sort?: ProspectSort;
  limit?: number;
  cursor?: string | null;
}

/** Paging for the prospect timeline. The server orders ascending by default. */
export interface TimelineQuery {
  limit?: number;
  cursor?: string | null;
  /** True walks the same keyset backwards, for the screen's reverse render. */
  newestFirst?: boolean;
}

/**
 * Paging for the state history, plus the history picker's probe.
 *
 * `asOf` is answered as a one-item page holding the snapshot in force at that
 * instant, so the picker and the pager read one response shape.
 */
export interface StateHistoryQuery {
  limit?: number;
  cursor?: string | null;
  /** ISO-8601. The snapshot in force at this instant, as a one-item page. */
  asOf?: string | null;
}

/**
 * Paging and filtering for the signal list.
 *
 * `includeExpired` defaults true server-side: signals are retained for the lifetime
 * of the prospect and stay queryable after they stop influencing state. Excluding
 * them is a presentation choice, never a retention one.
 */
export interface SignalQuery {
  limit?: number;
  cursor?: string | null;
  signalType?: SignalType | null;
  includeExpired?: boolean;
}

/**
 * Record one observed fact about one prospect.
 *
 * `strength`, `confidence` and `relevance` are optional because the engine defaults
 * them per type: a caller with no opinion about how much a fact is worth should not
 * have to invent one. `eventTimestamp` is optional for the same reason and carries
 * its own precision, because a fact known to the day is not a fact known to the
 * second — the missing-precision penalty is the engine's to apply.
 *
 * `sourceSurface` is narrowed server-side: an operator's typed fact is recorded as
 * `HUMAN_CONFIRMATION` whatever the body says.
 */
export interface SignalInput {
  signalType: SignalType;
  source: SignalSource;
  sourceSurface: SourceSurface;
  /** ISO-8601. Filled server-side from the source's coarsest precision when absent. */
  eventTimestamp?: string | null;
  eventTimestampPrecision?: TimestampPrecision | null;
  strength?: number | null;
  confidence?: number | null;
  relevance?: number | null;
  payload?: Record<string, unknown> | null;
  originTable?: string | null;
  originId?: string | null;
  dedupeKey?: string | null;
}

/**
 * The operator's judgement about one recommendation.
 *
 * `recommendationId` is required: a judgement about no particular recommendation is
 * an opinion the learning loop cannot attribute. `chosenActionType` is what makes the
 * row an override — the operator did something other than what was recommended — and
 * the server derives the kind from its presence rather than trusting a label.
 *
 * The classification is the layer's decision and is deliberately absent here.
 */
export interface FeedbackInput {
  recommendationId: string;
  feedbackType: FeedbackType;
  comment?: string | null;
  chosenActionType?: CandidateActionType | null;
}

/**
 * Record one lifecycle position that moves no state dimension.
 *
 * In practice two: `VIEWED` when a card is first rendered, `CANCELLED` when the
 * operator dismisses it. The open-channel control does not come here — it calls
 * `requestAction`, which already owns that path.
 *
 * `dedupeKey` is optional because the server composes one from the recommendation and
 * the position with no instant in it, so a re-rendered card or a retried fetch
 * records one position rather than two. The acting identity and the instant are the
 * server's: a browser may not assert who acted or when.
 */
export interface LifecycleInput {
  recommendationId: string;
  position: NonDimensionLifecyclePosition;
  actionType: CandidateActionType;
  channel?: ChannelKey | null;
  dedupeKey?: string | null;
}

/**
 * Whether to re-rank before reading.
 *
 * `refresh` recomputes at most this one prospect, and an unchanged input fingerprint
 * writes nothing and returns the ranking already on the table.
 */
export interface NextBestActionQuery {
  refresh?: boolean;
}

/** Paging, ordering and filtering for the cross-prospect action queue. */
export interface ActionQueueQuery {
  sort?: ActionQueueSort;
  limit?: number;
  cursor?: string | null;
  channel?: ChannelKey | null;
  actionType?: CandidateActionType | null;
}

/** The window the dashboard's seven statements are computed over. */
export interface DashboardQuery {
  periodDays?: number;
}

/** `limit` caps each debug collection independently; every one is newest-first. */
export interface DebugViewQuery {
  limit?: number;
}

// ─── Wire shapes (snake_case, exactly as schemas/gtm.py serialises them) ──────
//
// Kept private and un-exported: the components read the camelCase shapes above,
// and the normalisers below are the only place the two vocabularies meet. Every
// field is optional here because a normaliser's job is to survive a payload, not
// to assume one.

interface WireObservedFact {
  value?: string | null;
  is_unknown?: boolean;
  source_surface?: SourceSurface | null;
  observed_at?: string | null;
  is_stale?: boolean;
  is_derived?: boolean;
}

interface WireDerivedScore {
  score?: number | null;
  score_kind?: "RECOMMENDATION_SCORE";
  score_disclaimer?: string;
  is_derived?: true;
}

interface WireFactorContribution {
  factor?: string;
  available?: boolean;
  weight?: number | null;
  value?: number | null;
  persisted_value?: string | null;
  source?: string | null;
  contribution_hundredths?: number | null;
  direction?: FactorDirection | null;
  unavailable_reason?: string | null;
}

interface WireChannelResult {
  channel?: ChannelKey;
  score?: WireDerivedScore;
  confidence?: Confidence;
  recommendation?: string;
  reasoning?: WireFactorContribution[];
  unavailable_factors?: FactorKey[];
  available_weight_mass?: number | null;
  computed_at?: string | null;
}

interface WireChannelEvaluation {
  evaluation_id?: string | null;
  channels?: WireChannelResult[];
  recommended_channel?: ChannelKey | null;
  weight_set_label?: string | null;
  computed_at?: string | null;
  persisted?: boolean;
}

interface WireActivity {
  score?: WireDerivedScore;
  level?: WireObservedFact;
  observed_at?: string | null;
  is_stale?: boolean;
  source_surface?: SourceSurface | null;
  components?: Record<string, number>;
}

interface WireProspectProfile {
  lead_id?: string;
  profile_id?: string | null;
  profile_url?: string | null;
  public_identifier?: string | null;
  name?: WireObservedFact;
  headline?: WireObservedFact;
  company?: WireObservedFact;
  role?: WireObservedFact;
  location?: WireObservedFact;
  seniority?: WireObservedFact;
  icp_match?: WireObservedFact;
  intent_signal?: WireObservedFact;
  acv_tier?: WireObservedFact;
  lead_score?: WireDerivedScore;
}

interface WireProspectState {
  relationship_state?: WireObservedFact;
  conversation_state?: WireObservedFact;
  conversation_stage?: WireObservedFact;
  execution_state?: WireObservedFact;
  activity_level?: WireObservedFact;
  confirmation_status?: ConfirmationStatus;
  display_summary?: string;
  display_summary_is_derived?: true;
}

interface WireCTA {
  score?: WireDerivedScore;
  cta_state?: CtaState;
  recommended_cta?: string | null;
  decided_by?: string | null;
  reasoning?: WireFactorContribution[];
  computed_at?: string | null;
}

interface WireMessage {
  message_id?: string;
  conversation_id?: string;
  direction?: MessageDirection;
  message_purpose?: MessagePurpose | null;
  version?: number;
  generated_content?: string | null;
  edited_content?: string | null;
  sent_content?: string | null;
  generation_failure_reason?: string | null;
  char_limit?: number | null;
  edited_by_user_id?: string | null;
  edited_at?: string | null;
  observed_text?: string | null;
  reply_classification?: ReplyClassification | null;
  reply_confidence?: number | null;
  needs_human_review?: boolean;
  derived_next_action?: string | null;
  suggested_response?: string | null;
  referral_detail?: string | null;
  source_surface?: SourceSurface | null;
  observed_at?: string | null;
  created_at?: string | null;
}

interface WireAction {
  action_id?: string;
  profile_id?: string | null;
  conversation_id?: string | null;
  message_id?: string | null;
  action_type?: ActionType;
  channel?: ChannelKey;
  execution_state?: ExecutionState;
  confirmation_status?: ConfirmationStatus;
  is_verified?: boolean;
  requested_by_user_id?: string | null;
  requested_at?: string | null;
  destination_url?: string | null;
  payload_text?: string | null;
  instructions?: string | null;
  linkedin_opened_at?: string | null;
  verification_attempts?: number;
  verification_budget?: number;
  attempts_remaining?: number;
  next_verification_at?: string | null;
  verified_at?: string | null;
  outcome_evidence_id?: string | null;
  failure_reason?: string | null;
}

interface WireNextAction {
  action_type?: ActionType;
  channel?: ChannelKey;
  recommendation?: string;
  reasoning?: string[];
  message_id?: string | null;
  destination_url?: string | null;
  payload_text?: string | null;
  instructions?: string | null;
  latest_action?: WireAction | null;
  is_suppressed?: boolean;
}

interface WireTimelineEntry {
  event_id?: string;
  event_type?: string;
  event_at?: string;
  summary?: string;
  outcome?: EventOutcome;
  dimension?: string | null;
  prior_value?: string | null;
  new_value?: string | null;
  actor_id?: string;
  actor_type?: ActorType;
  evidence_id?: string | null;
  evidence_source_surface?: SourceSurface | null;
  evidence_observed_value?: string | null;
  evidence_observed_at?: string | null;
  evidence_confidence?: Confidence | null;
  related_action_id?: string | null;
  related_message_id?: string | null;
  signal_id?: string | null;
  recommendation_id?: string | null;
}

interface WireProspectDetail {
  lead_id?: string;
  profile?: WireProspectProfile;
  activity?: WireActivity;
  channels?: WireChannelResult[];
  recommended_channel?: ChannelKey | null;
  state?: WireProspectState;
  cta?: WireCTA;
  next_action?: WireNextAction | null;
  latest_message?: WireMessage | null;
  message_versions?: WireMessage[];
  updated_at?: string | null;
}

interface WireProspectListItem {
  lead_id?: string;
  profile_id?: string | null;
  profile_url?: string | null;
  name?: WireObservedFact;
  headline?: WireObservedFact;
  company?: WireObservedFact;
  score?: WireDerivedScore;
  recommended_channel?: ChannelKey | null;
  confidence?: Confidence | null;
  recommendation?: string | null;
  activity?: WireActivity;
  state?: WireProspectState;
  next_action_type?: ActionType | null;
  updated_at?: string | null;
}

interface WireProspectListPage {
  items?: WireProspectListItem[];
  next_cursor?: string | null;
  has_more?: boolean;
}

interface WireTimelinePage {
  entries?: WireTimelineEntry[];
  next_cursor?: string | null;
  has_more?: boolean;
}

interface WireObservationEnqueued {
  outcome?: EnqueueOutcome;
  purpose?: ObservationPurpose;
  job_id?: number | null;
  source_surface?: SourceSurface | null;
  deduped?: boolean;
  reason?: string | null;
}

interface WireOutcomeRecorded {
  outcome_id?: string;
  channel_used?: ChannelKey;
  outcome_class?: OutcomeClass;
  observed_at?: string | null;
  source_surface?: SourceSurface | null;
  recorded?: boolean;
  signal_id?: string | null;
  apply_outcome?: EventOutcome | null;
  apply_reason?: string | null;
  changed_dimensions?: string[] | null;
  state_version?: number | null;
  snapshot_id?: string | null;
  nba_marked?: boolean | null;
  out_of_order?: boolean | null;
}

interface WireSignal {
  signal_id?: string;
  signal_type?: SignalType;
  source?: SignalSource;
  source_surface?: SourceSurface;
  event_timestamp?: string | null;
  event_timestamp_precision?: TimestampPrecision;
  ingested_at?: string | null;
  strength?: number;
  confidence?: number;
  relevance?: number;
  effective_strength?: number;
  decay_profile?: string | null;
  expires_at?: string | null;
  at_floor?: boolean;
  origin_table?: string | null;
  origin_id?: string | null;
  payload?: Record<string, unknown>;
}

interface WireSignalPage {
  items?: WireSignal[];
  next_cursor?: string | null;
  has_more?: boolean;
}

interface WireIntent {
  intent_type?: IntentType;
  value?: number;
  confidence?: number;
  source?: string;
  evaluated_at?: string | null;
  decay_rate?: number;
  signal_ids?: string[];
  is_derived?: boolean;
}

interface WireChannelState {
  channel?: ChannelKey;
  availability?: ChannelAvailability;
  reachability?: number;
  activity?: number;
  engagement?: number;
  responsiveness?: number;
  response_rate?: number;
  historical_conversion_rate?: number;
  confidence?: number;
  suitability?: number;
  last_interaction_at?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  cooldown_until?: string | null;
  consecutive_unanswered?: number;
  provenance?: Record<string, WireObservedFact>;
}

interface WireBuyingStageState {
  value?: BuyingStage;
  confidence?: number;
  signal_ids?: string[];
  is_derived?: true;
}

interface WireEngagementTrajectory {
  count_24h?: number;
  count_7d?: number;
  count_30d?: number;
  trend?: EngagementTrend;
  evaluated_at?: string | null;
}

interface WireTimingState {
  last_meaningful_signal_at?: string | null;
  signal_freshness?: number;
  urgency?: number;
  cooldown_until?: string | null;
  ideal_next_action_window_start?: string | null;
  ideal_next_action_window_end?: string | null;
  within_business_hours?: BusinessHours;
  activity_trend_flag?: ActivityTrendFlag;
}

interface WireIdentityState {
  confidence?: number;
  verified_at?: string | null;
  source_surface?: SourceSurface | null;
  observed_at?: string | null;
}

interface WireIcpState {
  score?: WireDerivedScore;
  confidence?: number;
  components?: WireFactorContribution[];
  evaluated_at?: string | null;
  signal_ids?: string[];
  discovery_icp_passed?: boolean | null;
  discovery_criteria?: string | null;
  discovery_acv_tier?: string | null;
}

interface WireProspectStateFull {
  lead_id?: string;
  state_version?: number;
  journey_state?: WireObservedFact;
  state_confidence?: number;
  state_flags?: string[];
  dimensions?: Record<string, WireObservedFact>;
  identity?: WireIdentityState;
  icp?: WireIcpState;
  intents?: WireIntent[];
  channels?: WireChannelState[];
  engagement?: WireEngagementTrajectory;
  buying_stage?: WireBuyingStageState;
  timing?: WireTimingState;
  dimension_confidence?: Record<string, number>;
  do_not_contact?: WireObservedFact;
  updated_at?: string | null;
}

interface WireStateSnapshot {
  snapshot_id?: string;
  recorded_at?: string | null;
  state_version?: number;
  changed_dimensions?: string[];
  confidence?: number;
  journey_state?: string | null;
  triggering_signal_id?: string | null;
  triggering_action_id?: string | null;
  state?: Record<string, unknown>;
}

interface WireStateHistoryPage {
  items?: WireStateSnapshot[];
  next_cursor?: string | null;
  has_more?: boolean;
}

interface WireSignalRecorded {
  lead_id?: string;
  signal_id?: string | null;
  dedupe_key?: string | null;
  ingest_outcome?: EventOutcome;
  ingest_reason?: string | null;
  unclassified?: boolean;
  at_floor?: boolean;
  event_timestamp_inferred?: boolean;
  apply_outcome?: EventOutcome | null;
  apply_reason?: string | null;
  changed_dimensions?: string[];
  state_version?: number;
  snapshot_id?: string | null;
  nba_marked?: boolean;
}

interface WireWhyNow {
  signal_id?: string | null;
  signal_type?: SignalType | null;
  event_timestamp?: string | null;
  effective_strength?: number;
  term?: ActionTermKey | null;
  contribution_hundredths?: number | null;
  evidence_id?: string | null;
}

interface WireWhyThisMessage {
  message_id?: string | null;
  message_purpose?: MessagePurpose | null;
  grounding_signal_ids?: string[];
  note?: string | null;
}

interface WireChannelComparison {
  action_type?: CandidateActionType;
  channel?: ChannelKey | null;
  action_score?: WireDerivedScore;
  exclusion_reason?: ExclusionReason | null;
  lowering_terms?: WireFactorContribution[];
}

interface WireLearningScopeDecision {
  applied_scope?: LearningScope;
  sample_size?: number;
  min_sample?: number;
  decision?: LearningDecision;
  decision_reason?: string | null;
}

interface WireVersionQuad {
  policy_version?: string | null;
  model_version?: string | null;
  learning_version?: string | null;
  weight_set_id?: string | null;
}

interface WireRecommendationExplanation {
  why_now?: WireWhyNow[];
  why_this_channel?: WireFactorContribution[];
  why_this_message?: WireWhyThisMessage | null;
  why_not_the_other_channels?: WireChannelComparison[];
  scope?: WireLearningScopeDecision | null;
  versions?: WireVersionQuad | null;
}

interface WireCandidateAction {
  recommendation_id?: string;
  action_type?: CandidateActionType;
  channel?: ChannelKey | null;
  rank?: number | null;
  is_recommended?: boolean;
  action_score?: WireDerivedScore;
  action_confidence?: number;
  state_confidence?: number;
  terms?: WireFactorContribution[];
  unavailable_terms?: ActionTermKey[];
  available_weight_mass?: number;
  exclusion_reason?: ExclusionReason | null;
  explanation?: WireRecommendationExplanation | null;
  expires_at?: string | null;
  computed_at?: string | null;
}

interface WireNextBestAction {
  lead_id?: string;
  evaluation_id?: string | null;
  computed_at?: string | null;
  expires_at?: string | null;
  recommended?: WireCandidateAction | null;
  candidates?: WireCandidateAction[];
  policy_version?: string | null;
  model_version?: string | null;
  learning_version?: string | null;
  weight_set_id?: string | null;
  learning_scope_applied?: LearningScope | null;
  lifecycle?: WireTimelineEntry | null;
}

interface WireLearningUpdate {
  stat_id?: string | null;
  scope?: LearningScope;
  scope_user_id?: string | null;
  action_type?: CandidateActionType;
  channel?: ChannelKey | null;
  sample_size?: number;
  positive_count?: number;
  negative_count?: number;
  excluded_unknown_count?: number;
  success_rate?: number;
  ci_low?: number;
  ci_high?: number;
  mean_reward?: number;
  decision?: LearningDecision;
  decision_reason?: string | null;
  applied_scope?: LearningScope;
  min_sample?: number;
  learning_version?: string | null;
  computed_at?: string | null;
}

interface WireActionQueueItem {
  lead_id?: string;
  recommendation_id?: string | null;
  profile_id?: string | null;
  profile_url?: string | null;
  name?: WireObservedFact;
  headline?: WireObservedFact;
  company?: WireObservedFact;
  journey_state?: WireObservedFact;
  relationship_state?: WireObservedFact;
  action_type?: CandidateActionType;
  channel?: ChannelKey | null;
  action_score?: WireDerivedScore;
  action_confidence?: number;
  state_confidence?: number;
  priority_tier?: PriorityTier;
  urgency?: number;
  expected_success_probability?: number;
  business_value?: number;
  signal_freshness?: number;
  why_now?: WireWhyNow[];
  expires_at?: string | null;
  computed_at?: string | null;
}

interface WireActionQueuePage {
  items?: WireActionQueueItem[];
  next_cursor?: string | null;
  has_more?: boolean;
}

interface WireFilterCriterion {
  field?: string;
  operator?: FilterOperator;
  values?: string[];
}

interface WireAggregateFilter {
  route?: string;
  criteria?: WireFilterCriterion[];
  period_days?: number | null;
}

interface WireDashboardAggregate {
  key?: DashboardAggregateKey;
  count?: number;
  filter?: WireAggregateFilter;
}

interface WireDashboard {
  period_days?: number;
  computed_at?: string | null;
  aggregates?: WireDashboardAggregate[];
}

interface WireFeedbackRecorded {
  feedback_id?: string;
  lead_id?: string;
  recommendation_id?: string | null;
  kind?: FeedbackKind;
  feedback_type?: FeedbackType | null;
  recommended_action_type?: CandidateActionType | null;
  chosen_action_type?: CandidateActionType | null;
  classification?: "USER_PREFERENCE_SIGNAL";
  comment?: string | null;
  score_adjustment?: number | null;
  adjustment_basis?: "PREFERENCE_DERIVED";
  suppression_written?: boolean;
  recompute_marked?: boolean;
  recorded_at?: string | null;
}

interface WireDebugView {
  lead_id?: string;
  state?: WireProspectStateFull;
  signals?: WireSignal[];
  signal_outcomes?: WireTimelineEntry[];
  state_transitions?: WireTimelineEntry[];
  snapshots?: WireStateSnapshot[];
  lifecycle_events?: WireTimelineEntry[];
  outcomes?: WireOutcomeRecorded[];
  candidates?: WireCandidateAction[];
  recommended?: WireNextBestAction | null;
  learning_updates?: WireLearningUpdate[];
}

// ─── Normalisers: wire shape -> the shape the components read ─────────────────
//
// Renaming only. Nothing below computes a score, derives a state, or supplies a
// value the server did not send — an absent field becomes `null`, which is what
// the payload meant, and never `0` or `""`.

/** Nothing has been observed. The honest default for every fact. */
export function unknownFact(): ObservedFact {
  return {
    value: null,
    isUnknown: true,
    sourceSurface: null,
    observedAt: null,
    isStale: false,
    isDerived: false,
  };
}

function toFact(raw?: WireObservedFact | null): ObservedFact {
  if (!raw) return unknownFact();
  const value = raw.value ?? null;
  return {
    value,
    // Absence is unknown whatever the payload says, which is the same rule the
    // server applies before sending.
    isUnknown: value === null ? true : raw.is_unknown ?? false,
    sourceSurface: raw.source_surface ?? null,
    observedAt: raw.observed_at ?? null,
    isStale: raw.is_stale ?? false,
    isDerived: raw.is_derived ?? false,
  };
}

function toScore(raw?: WireDerivedScore | null): DerivedScore {
  return {
    score: raw?.score ?? null,
    scoreKind: "RECOMMENDATION_SCORE",
    // Carried, never composed: the disclaimer is a persisted string, and inventing
    // one here would be this module labelling a score it did not compute.
    scoreDisclaimer: raw?.score_disclaimer ?? "",
    isDerived: true,
  };
}

function toFactor(raw: WireFactorContribution): FactorContribution {
  return {
    factor: raw.factor ?? "",
    available: raw.available ?? true,
    weight: raw.weight ?? null,
    value: raw.value ?? null,
    persistedValue: raw.persisted_value ?? null,
    source: raw.source ?? null,
    contributionHundredths: raw.contribution_hundredths ?? null,
    direction: raw.direction ?? null,
    unavailableReason: raw.unavailable_reason ?? null,
  };
}

function toFactors(raw?: WireFactorContribution[] | null): FactorContribution[] {
  return (raw ?? []).map(toFactor);
}

function toChannelResult(raw: WireChannelResult): ChannelResult {
  return {
    channel: raw.channel,
    score: toScore(raw.score),
    confidence: raw.confidence,
    recommendation: raw.recommendation ?? "",
    reasoning: toFactors(raw.reasoning),
    unavailableFactors: raw.unavailable_factors ?? [],
    availableWeightMass: raw.available_weight_mass ?? null,
    computedAt: raw.computed_at ?? null,
  };
}

function toChannelEvaluation(raw: WireChannelEvaluation): ChannelEvaluation {
  return {
    evaluationId: raw.evaluation_id ?? null,
    channels: (raw.channels ?? []).map(toChannelResult),
    recommendedChannel: raw.recommended_channel ?? null,
    weightSetLabel: raw.weight_set_label ?? null,
    computedAt: raw.computed_at ?? null,
    persisted: raw.persisted ?? true,
  };
}

function toActivity(raw?: WireActivity | null): Activity {
  return {
    score: toScore(raw?.score),
    level: toFact(raw?.level),
    observedAt: raw?.observed_at ?? null,
    isStale: raw?.is_stale ?? false,
    sourceSurface: raw?.source_surface ?? null,
    // Passed through untouched: the keys are the engine's component names and are
    // data, not a vocabulary this module gets to rename.
    components: raw?.components ?? {},
  };
}

function toProfile(raw?: WireProspectProfile | null): ProspectProfile {
  return {
    leadId: raw?.lead_id ?? "",
    profileId: raw?.profile_id ?? null,
    profileUrl: raw?.profile_url ?? null,
    publicIdentifier: raw?.public_identifier ?? null,
    name: toFact(raw?.name),
    headline: toFact(raw?.headline),
    company: toFact(raw?.company),
    role: toFact(raw?.role),
    location: toFact(raw?.location),
    seniority: toFact(raw?.seniority),
    icpMatch: toFact(raw?.icp_match),
    intentSignal: toFact(raw?.intent_signal),
    acvTier: toFact(raw?.acv_tier),
    leadScore: toScore(raw?.lead_score),
  };
}

function toState(raw?: WireProspectState | null): ProspectState {
  return {
    relationshipState: toFact(raw?.relationship_state),
    conversationState: toFact(raw?.conversation_state),
    conversationStage: toFact(raw?.conversation_stage),
    executionState: toFact(raw?.execution_state),
    activityLevel: toFact(raw?.activity_level),
    confirmationStatus: raw?.confirmation_status ?? "NOT_APPLICABLE",
    displaySummary: raw?.display_summary ?? "",
    displaySummaryIsDerived: true,
  };
}

function toCTA(raw?: WireCTA | null): CTA {
  return {
    score: toScore(raw?.score),
    ctaState: raw?.cta_state ?? "NOT_READY",
    recommendedCta: raw?.recommended_cta ?? null,
    decidedBy: raw?.decided_by ?? null,
    reasoning: toFactors(raw?.reasoning),
    computedAt: raw?.computed_at ?? null,
  };
}

function toMessage(raw?: WireMessage | null): Message | null {
  if (!raw) return null;
  return {
    messageId: raw.message_id ?? "",
    conversationId: raw.conversation_id ?? "",
    direction: raw.direction ?? "OUTBOUND",
    messagePurpose: raw.message_purpose ?? null,
    version: raw.version ?? 1,
    generatedContent: raw.generated_content ?? null,
    editedContent: raw.edited_content ?? null,
    sentContent: raw.sent_content ?? null,
    generationFailureReason: raw.generation_failure_reason ?? null,
    charLimit: raw.char_limit ?? null,
    editedByUserId: raw.edited_by_user_id ?? null,
    editedAt: raw.edited_at ?? null,
    observedText: raw.observed_text ?? null,
    replyClassification: raw.reply_classification ?? null,
    replyConfidence: raw.reply_confidence ?? null,
    needsHumanReview: raw.needs_human_review ?? false,
    derivedNextAction: raw.derived_next_action ?? null,
    suggestedResponse: raw.suggested_response ?? null,
    referralDetail: raw.referral_detail ?? null,
    sourceSurface: raw.source_surface ?? null,
    observedAt: raw.observed_at ?? null,
    createdAt: raw.created_at ?? null,
  };
}

function toAction(raw?: WireAction | null): Action | null {
  if (!raw) return null;
  return {
    actionId: raw.action_id ?? "",
    profileId: raw.profile_id ?? null,
    conversationId: raw.conversation_id ?? null,
    messageId: raw.message_id ?? null,
    actionType: raw.action_type,
    channel: raw.channel ?? "LINKEDIN",
    executionState: raw.execution_state,
    confirmationStatus: raw.confirmation_status ?? "NOT_APPLICABLE",
    isVerified: raw.is_verified ?? false,
    requestedByUserId: raw.requested_by_user_id ?? null,
    requestedAt: raw.requested_at ?? null,
    destinationUrl: raw.destination_url ?? null,
    payloadText: raw.payload_text ?? null,
    instructions: raw.instructions ?? null,
    linkedinOpenedAt: raw.linkedin_opened_at ?? null,
    verificationAttempts: raw.verification_attempts ?? 0,
    verificationBudget: raw.verification_budget ?? 0,
    attemptsRemaining: raw.attempts_remaining ?? 0,
    nextVerificationAt: raw.next_verification_at ?? null,
    verifiedAt: raw.verified_at ?? null,
    outcomeEvidenceId: raw.outcome_evidence_id ?? null,
    failureReason: raw.failure_reason ?? null,
  };
}

function toNextAction(raw?: WireNextAction | null): NextAction | null {
  if (!raw) return null;
  return {
    actionType: raw.action_type,
    channel: raw.channel ?? "LINKEDIN",
    recommendation: raw.recommendation ?? "",
    reasoning: raw.reasoning ?? [],
    messageId: raw.message_id ?? null,
    destinationUrl: raw.destination_url ?? null,
    payloadText: raw.payload_text ?? null,
    instructions: raw.instructions ?? null,
    latestAction: toAction(raw.latest_action),
    isSuppressed: raw.is_suppressed ?? false,
  };
}

function toTimelineEntry(raw: WireTimelineEntry): TimelineEntry {
  return {
    eventId: raw.event_id ?? "",
    eventType: raw.event_type ?? "",
    eventAt: raw.event_at ?? "",
    summary: raw.summary ?? "",
    outcome: raw.outcome ?? "RECORDED",
    dimension: raw.dimension ?? null,
    priorValue: raw.prior_value ?? null,
    newValue: raw.new_value ?? null,
    actorId: raw.actor_id ?? "",
    actorType: raw.actor_type ?? "SYSTEM",
    evidenceId: raw.evidence_id ?? null,
    evidenceSourceSurface: raw.evidence_source_surface ?? null,
    evidenceObservedValue: raw.evidence_observed_value ?? null,
    evidenceObservedAt: raw.evidence_observed_at ?? null,
    evidenceConfidence: raw.evidence_confidence ?? null,
    relatedActionId: raw.related_action_id ?? null,
    relatedMessageId: raw.related_message_id ?? null,
    signalId: raw.signal_id ?? null,
    recommendationId: raw.recommendation_id ?? null,
  };
}

function toProspectDetail(raw: WireProspectDetail): ProspectDetail {
  return {
    leadId: raw.lead_id ?? "",
    profile: toProfile(raw.profile),
    activity: toActivity(raw.activity),
    channels: (raw.channels ?? []).map(toChannelResult),
    recommendedChannel: raw.recommended_channel ?? null,
    state: toState(raw.state),
    cta: toCTA(raw.cta),
    nextAction: toNextAction(raw.next_action),
    latestMessage: toMessage(raw.latest_message),
    messageVersions: (raw.message_versions ?? [])
      .map(toMessage)
      .filter((item): item is Message => item !== null),
    updatedAt: raw.updated_at ?? null,
  };
}

function toProspectListItem(raw: WireProspectListItem): ProspectListItem {
  return {
    leadId: raw.lead_id ?? "",
    profileId: raw.profile_id ?? null,
    profileUrl: raw.profile_url ?? null,
    name: toFact(raw.name),
    headline: toFact(raw.headline),
    company: toFact(raw.company),
    score: toScore(raw.score),
    recommendedChannel: raw.recommended_channel ?? null,
    confidence: raw.confidence ?? null,
    recommendation: raw.recommendation ?? null,
    activity: toActivity(raw.activity),
    state: toState(raw.state),
    nextActionType: raw.next_action_type ?? null,
    updatedAt: raw.updated_at ?? null,
  };
}

/**
 * One acknowledged outreach outcome.
 *
 * `fallback` carries what the caller asserted, so the write path echoes the request
 * back when the server left a field off; a read has no request to fall back to and
 * passes none. `recorded: false` is not a failure — the observation was already held.
 */
function toOutcomeRecorded(
  raw: WireOutcomeRecorded,
  fallback: { channelUsed?: ChannelKey; outcomeClass?: OutcomeClass } = {}
): OutcomeRecorded {
  return {
    outcomeId: raw.outcome_id ?? "",
    channelUsed: raw.channel_used ?? fallback.channelUsed ?? "LINKEDIN",
    outcomeClass: raw.outcome_class ?? fallback.outcomeClass ?? "UNKNOWN",
    observedAt: raw.observed_at ?? null,
    sourceSurface: raw.source_surface ?? null,
    recorded: raw.recorded ?? true,
    // The state half. Every one falls back to `null` rather than to `0` / `[]` /
    // `false`: absent here means the server attempted no application, or is an
    // older build that cannot report one, and a zero would read as a fold that ran
    // and moved nothing.
    signalId: raw.signal_id ?? null,
    applyOutcome: raw.apply_outcome ?? null,
    applyReason: raw.apply_reason ?? null,
    changedDimensions: raw.changed_dimensions ?? null,
    stateVersion: raw.state_version ?? null,
    snapshotId: raw.snapshot_id ?? null,
    nbaMarked: raw.nba_marked ?? null,
    outOfOrder: raw.out_of_order ?? null,
  };
}

// ─── Normalisers for the evolving state, the ranking and the queue ────────────
//
// Same rules as above, and the same helpers: a fact goes through `toFact`, a score
// through `toScore`, a term through `toFactor`. A measure absent from the payload
// becomes `0` only where the server declares that default — a hundredths measure is
// bounded 0–100 and its zero is a value the row holds, unlike a score, whose absence
// stays `null`.

function toSignal(raw: WireSignal): Signal {
  return {
    signalId: raw.signal_id ?? "",
    signalType: raw.signal_type ?? "UNCLASSIFIED",
    source: raw.source ?? "HUMAN_ENTRY",
    sourceSurface: raw.source_surface ?? "HUMAN_CONFIRMATION",
    eventTimestamp: raw.event_timestamp ?? null,
    eventTimestampPrecision: raw.event_timestamp_precision ?? "EXACT",
    ingestedAt: raw.ingested_at ?? null,
    strength: raw.strength ?? 0,
    confidence: raw.confidence ?? 0,
    relevance: raw.relevance ?? 0,
    effectiveStrength: raw.effective_strength ?? 0,
    decayProfile: raw.decay_profile ?? null,
    expiresAt: raw.expires_at ?? null,
    atFloor: raw.at_floor ?? false,
    originTable: raw.origin_table ?? null,
    originId: raw.origin_id ?? null,
    // Passed through untouched: the keys are the evidence the engine recorded and
    // are data, not a vocabulary this module gets to rename.
    payload: raw.payload ?? {},
  };
}

function toIntent(raw: WireIntent): Intent {
  return {
    intentType: raw.intent_type ?? "BUYING",
    value: raw.value ?? 0,
    confidence: raw.confidence ?? 0,
    source: raw.source ?? "DERIVED",
    evaluatedAt: raw.evaluated_at ?? null,
    decayRate: raw.decay_rate ?? 0,
    signalIds: raw.signal_ids ?? [],
    isDerived: raw.is_derived ?? true,
  };
}

/** The provenance map's three keys are field names the server owns; the values are facts. */
function toProvenance(raw?: Record<string, WireObservedFact> | null): Record<string, ObservedFact> {
  const out: Record<string, ObservedFact> = {};
  Object.entries(raw ?? {}).forEach(([field, fact]) => {
    out[field] = toFact(fact);
  });
  return out;
}

function toChannelState(raw: WireChannelState): ChannelState {
  return {
    channel: raw.channel ?? "LINKEDIN",
    // Unknown, not unavailable: "we have not looked" is not "there is no way in".
    availability: raw.availability ?? "UNKNOWN",
    reachability: raw.reachability ?? 0,
    activity: raw.activity ?? 0,
    engagement: raw.engagement ?? 0,
    responsiveness: raw.responsiveness ?? 0,
    responseRate: raw.response_rate ?? 0,
    historicalConversionRate: raw.historical_conversion_rate ?? 0,
    confidence: raw.confidence ?? 0,
    suitability: raw.suitability ?? 0,
    lastInteractionAt: raw.last_interaction_at ?? null,
    lastInboundAt: raw.last_inbound_at ?? null,
    lastOutboundAt: raw.last_outbound_at ?? null,
    cooldownUntil: raw.cooldown_until ?? null,
    consecutiveUnanswered: raw.consecutive_unanswered ?? 0,
    provenance: toProvenance(raw.provenance),
  };
}

function toBuyingStage(raw?: WireBuyingStageState | null): BuyingStageState {
  return {
    value: raw?.value ?? "UNKNOWN",
    confidence: raw?.confidence ?? 0,
    signalIds: raw?.signal_ids ?? [],
    isDerived: true,
  };
}

function toEngagement(raw?: WireEngagementTrajectory | null): EngagementTrajectory {
  return {
    count24h: raw?.count_24h ?? 0,
    count7d: raw?.count_7d ?? 0,
    count30d: raw?.count_30d ?? 0,
    trend: raw?.trend ?? "FLAT",
    evaluatedAt: raw?.evaluated_at ?? null,
  };
}

function toTiming(raw?: WireTimingState | null): TimingState {
  return {
    lastMeaningfulSignalAt: raw?.last_meaningful_signal_at ?? null,
    signalFreshness: raw?.signal_freshness ?? 0,
    urgency: raw?.urgency ?? 0,
    cooldownUntil: raw?.cooldown_until ?? null,
    idealNextActionWindowStart: raw?.ideal_next_action_window_start ?? null,
    idealNextActionWindowEnd: raw?.ideal_next_action_window_end ?? null,
    withinBusinessHours: raw?.within_business_hours ?? "UNKNOWN",
    activityTrendFlag: raw?.activity_trend_flag ?? "UNKNOWN",
  };
}

function toIdentityState(raw?: WireIdentityState | null): IdentityState {
  return {
    confidence: raw?.confidence ?? 0,
    verifiedAt: raw?.verified_at ?? null,
    sourceSurface: raw?.source_surface ?? null,
    observedAt: raw?.observed_at ?? null,
  };
}

function toIcpState(raw?: WireIcpState | null): IcpState {
  return {
    score: toScore(raw?.score),
    confidence: raw?.confidence ?? 0,
    components: toFactors(raw?.components),
    evaluatedAt: raw?.evaluated_at ?? null,
    signalIds: raw?.signal_ids ?? [],
    // Three fields, not one verdict: the discovery-time qualification is left
    // exactly as it was recorded, beside the re-evaluation above it.
    discoveryIcpPassed: raw?.discovery_icp_passed ?? null,
    discoveryCriteria: raw?.discovery_criteria ?? null,
    discoveryAcvTier: raw?.discovery_acv_tier ?? null,
  };
}

function toDimensions(raw?: Record<string, WireObservedFact> | null): Record<string, ObservedFact> {
  const out: Record<string, ObservedFact> = {};
  Object.entries(raw ?? {}).forEach(([dimension, fact]) => {
    out[dimension] = toFact(fact);
  });
  return out;
}

function toProspectStateFull(raw: WireProspectStateFull): ProspectStateFull {
  return {
    leadId: raw.lead_id ?? "",
    stateVersion: raw.state_version ?? 0,
    journeyState: toFact(raw.journey_state),
    stateConfidence: raw.state_confidence ?? 0,
    stateFlags: raw.state_flags ?? [],
    // The four ledger-backed dimensions, keyed as the engine wrote them, and the
    // rest of this payload's dimensions sitting beside them in their own fields.
    dimensions: toDimensions(raw.dimensions),
    identity: toIdentityState(raw.identity),
    icp: toIcpState(raw.icp),
    intents: (raw.intents ?? []).map(toIntent),
    channels: (raw.channels ?? []).map(toChannelState),
    engagement: toEngagement(raw.engagement),
    buyingStage: toBuyingStage(raw.buying_stage),
    timing: toTiming(raw.timing),
    dimensionConfidence: raw.dimension_confidence ?? {},
    doNotContact: toFact(raw.do_not_contact),
    updatedAt: raw.updated_at ?? null,
  };
}

function toStateSnapshot(raw: WireStateSnapshot): StateSnapshot {
  return {
    snapshotId: raw.snapshot_id ?? "",
    recordedAt: raw.recorded_at ?? null,
    stateVersion: raw.state_version ?? 0,
    changedDimensions: raw.changed_dimensions ?? [],
    confidence: raw.confidence ?? 0,
    journeyState: raw.journey_state ?? null,
    triggeringSignalId: raw.triggering_signal_id ?? null,
    triggeringActionId: raw.triggering_action_id ?? null,
    // The whole persisted belief, sanitised server-side and carried as data.
    state: raw.state ?? {},
  };
}

function toWhyNow(raw: WireWhyNow): WhyNow {
  return {
    signalId: raw.signal_id ?? null,
    signalType: raw.signal_type ?? null,
    eventTimestamp: raw.event_timestamp ?? null,
    effectiveStrength: raw.effective_strength ?? 0,
    term: raw.term ?? null,
    contributionHundredths: raw.contribution_hundredths ?? null,
    evidenceId: raw.evidence_id ?? null,
  };
}

function toWhyThisMessage(raw?: WireWhyThisMessage | null): WhyThisMessage | null {
  if (!raw) return null;
  return {
    messageId: raw.message_id ?? null,
    messagePurpose: raw.message_purpose ?? null,
    groundingSignalIds: raw.grounding_signal_ids ?? [],
    note: raw.note ?? null,
  };
}

function toChannelComparison(raw: WireChannelComparison): ChannelComparison {
  return {
    actionType: raw.action_type ?? "WAIT",
    channel: raw.channel ?? null,
    actionScore: toScore(raw.action_score),
    exclusionReason: raw.exclusion_reason ?? null,
    loweringTerms: toFactors(raw.lowering_terms),
  };
}

function toLearningScopeDecision(
  raw?: WireLearningScopeDecision | null
): LearningScopeDecision | null {
  if (!raw) return null;
  return {
    appliedScope: raw.applied_scope ?? "GLOBAL",
    sampleSize: raw.sample_size ?? 0,
    minSample: raw.min_sample ?? 0,
    decision: raw.decision ?? "APPLIED",
    decisionReason: raw.decision_reason ?? null,
  };
}

function toVersionQuad(raw?: WireVersionQuad | null): VersionQuad | null {
  if (!raw) return null;
  return {
    policyVersion: raw.policy_version ?? null,
    modelVersion: raw.model_version ?? null,
    learningVersion: raw.learning_version ?? null,
    weightSetId: raw.weight_set_id ?? null,
  };
}

function toExplanation(
  raw?: WireRecommendationExplanation | null
): RecommendationExplanation | null {
  if (!raw) return null;
  return {
    whyNow: (raw.why_now ?? []).map(toWhyNow),
    whyThisChannel: toFactors(raw.why_this_channel),
    whyThisMessage: toWhyThisMessage(raw.why_this_message),
    whyNotTheOtherChannels: (raw.why_not_the_other_channels ?? []).map(toChannelComparison),
    scope: toLearningScopeDecision(raw.scope),
    versions: toVersionQuad(raw.versions),
  };
}

function toCandidateAction(raw: WireCandidateAction): CandidateAction {
  return {
    recommendationId: raw.recommendation_id ?? "",
    actionType: raw.action_type ?? "WAIT",
    channel: raw.channel ?? null,
    // An excluded candidate carries no rank, which is absence and not a last place.
    rank: raw.rank ?? null,
    isRecommended: raw.is_recommended ?? false,
    actionScore: toScore(raw.action_score),
    actionConfidence: raw.action_confidence ?? 0,
    stateConfidence: raw.state_confidence ?? 0,
    terms: toFactors(raw.terms),
    unavailableTerms: raw.unavailable_terms ?? [],
    availableWeightMass: raw.available_weight_mass ?? 0,
    exclusionReason: raw.exclusion_reason ?? null,
    explanation: toExplanation(raw.explanation),
    expiresAt: raw.expires_at ?? null,
    computedAt: raw.computed_at ?? null,
  };
}

function toNextBestAction(raw: WireNextBestAction): NextBestAction {
  return {
    leadId: raw.lead_id ?? "",
    evaluationId: raw.evaluation_id ?? null,
    computedAt: raw.computed_at ?? null,
    expiresAt: raw.expires_at ?? null,
    // Absent rather than fabricated: no evaluation yet is a true answer a card can
    // render, and inventing a winner here would be this module ranking.
    recommended: raw.recommended ? toCandidateAction(raw.recommended) : null,
    candidates: (raw.candidates ?? []).map(toCandidateAction),
    policyVersion: raw.policy_version ?? null,
    modelVersion: raw.model_version ?? null,
    learningVersion: raw.learning_version ?? null,
    weightSetId: raw.weight_set_id ?? null,
    learningScopeApplied: raw.learning_scope_applied ?? null,
    lifecycle: raw.lifecycle ? toTimelineEntry(raw.lifecycle) : null,
  };
}

function toLearningUpdate(raw: WireLearningUpdate): LearningUpdate {
  return {
    statId: raw.stat_id ?? null,
    scope: raw.scope ?? "GLOBAL",
    scopeUserId: raw.scope_user_id ?? null,
    actionType: raw.action_type ?? "WAIT",
    channel: raw.channel ?? null,
    sampleSize: raw.sample_size ?? 0,
    positiveCount: raw.positive_count ?? 0,
    negativeCount: raw.negative_count ?? 0,
    excludedUnknownCount: raw.excluded_unknown_count ?? 0,
    successRate: raw.success_rate ?? 0,
    ciLow: raw.ci_low ?? 0,
    ciHigh: raw.ci_high ?? 0,
    meanReward: raw.mean_reward ?? 0,
    decision: raw.decision ?? "APPLIED",
    decisionReason: raw.decision_reason ?? null,
    appliedScope: raw.applied_scope ?? "GLOBAL",
    minSample: raw.min_sample ?? 0,
    learningVersion: raw.learning_version ?? null,
    computedAt: raw.computed_at ?? null,
  };
}

function toActionQueueItem(raw: WireActionQueueItem): ActionQueueItem {
  return {
    leadId: raw.lead_id ?? "",
    recommendationId: raw.recommendation_id ?? null,
    profileId: raw.profile_id ?? null,
    profileUrl: raw.profile_url ?? null,
    name: toFact(raw.name),
    headline: toFact(raw.headline),
    company: toFact(raw.company),
    journeyState: toFact(raw.journey_state),
    relationshipState: toFact(raw.relationship_state),
    actionType: raw.action_type ?? "WAIT",
    channel: raw.channel ?? null,
    actionScore: toScore(raw.action_score),
    actionConfidence: raw.action_confidence ?? 0,
    stateConfidence: raw.state_confidence ?? 0,
    priorityTier: raw.priority_tier ?? "LATER",
    // The six banding inputs travel beside the tier, so the label is re-derivable.
    urgency: raw.urgency ?? 0,
    expectedSuccessProbability: raw.expected_success_probability ?? 0,
    businessValue: raw.business_value ?? 0,
    signalFreshness: raw.signal_freshness ?? 0,
    whyNow: (raw.why_now ?? []).map(toWhyNow),
    expiresAt: raw.expires_at ?? null,
    computedAt: raw.computed_at ?? null,
  };
}

function toFilterCriterion(raw: WireFilterCriterion): FilterCriterion {
  return {
    field: raw.field ?? "",
    operator: raw.operator ?? "EQUALS",
    values: raw.values ?? [],
  };
}

function toAggregateFilter(raw?: WireAggregateFilter | null): AggregateFilter {
  return {
    route: raw?.route ?? "",
    criteria: (raw?.criteria ?? []).map(toFilterCriterion),
    periodDays: raw?.period_days ?? null,
  };
}

function toDashboardAggregate(raw: WireDashboardAggregate): DashboardAggregate {
  return {
    key: raw.key ?? "state_changed",
    count: raw.count ?? 0,
    filter: toAggregateFilter(raw.filter),
  };
}

function toFeedbackRecorded(raw: WireFeedbackRecorded): FeedbackRecorded {
  return {
    feedbackId: raw.feedback_id ?? "",
    leadId: raw.lead_id ?? "",
    recommendationId: raw.recommendation_id ?? null,
    kind: raw.kind ?? "FEEDBACK",
    feedbackType: raw.feedback_type ?? null,
    recommendedActionType: raw.recommended_action_type ?? null,
    chosenActionType: raw.chosen_action_type ?? null,
    // Both carried as the one value the server declares: a recorded preference is
    // excluded from the success statistics, and this is not the place to soften that.
    classification: "USER_PREFERENCE_SIGNAL",
    comment: raw.comment ?? null,
    scoreAdjustment: raw.score_adjustment ?? null,
    adjustmentBasis: "PREFERENCE_DERIVED",
    suppressionWritten: raw.suppression_written ?? false,
    recomputeMarked: raw.recompute_marked ?? false,
    recordedAt: raw.recorded_at ?? null,
  };
}

function toDebugView(raw: WireDebugView): DebugView {
  return {
    leadId: raw.lead_id ?? "",
    state: toProspectStateFull(raw.state ?? {}),
    signals: (raw.signals ?? []).map(toSignal),
    signalOutcomes: (raw.signal_outcomes ?? []).map(toTimelineEntry),
    stateTransitions: (raw.state_transitions ?? []).map(toTimelineEntry),
    snapshots: (raw.snapshots ?? []).map(toStateSnapshot),
    lifecycleEvents: (raw.lifecycle_events ?? []).map(toTimelineEntry),
    outcomes: (raw.outcomes ?? []).map(toOutcomeRecorded),
    candidates: (raw.candidates ?? []).map(toCandidateAction),
    recommended: raw.recommended ? toNextBestAction(raw.recommended) : null,
    learningUpdates: (raw.learning_updates ?? []).map(toLearningUpdate),
  };
}

// ─── Backend transport ────────────────────────────────────────────────────────

/**
 * One page of query parameters, `brand_id` first and always.
 *
 * Every GTM route is brand-scoped server-side twice over — ownership is verified
 * and then every query filters on the brand — so a missing `brand_id` is a 422 and
 * another brand's valid id is a 404. Undefined and null values are dropped rather
 * than sent as the strings "undefined" and "null".
 */
function gtmQuery(brandId: string, extra: Record<string, unknown> = {}): string {
  const params = new URLSearchParams({ brand_id: String(brandId ?? "") });
  Object.entries(extra).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  return params.toString();
}

/**
 * The one place a request leaves this module.
 *
 * The session token is read from `sessionStorage` and put onto the `Authorization`
 * header. It is deliberately not a parameter, not a field on any type, and not
 * part of any payload: the only shape it ever takes in this module is this header.
 *
 * A non-`ok` response becomes an `Error` carrying the server's `detail`, so the
 * page's error state shows what the backend actually said rather than a status
 * code.
 */
async function gtmFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${GTM_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "69420",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `GTM backend error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* non-JSON body — keep the status line */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

const POST: RequestInit = { method: "POST" };

// ─── The API ──────────────────────────────────────────────────────────────────

export const gtmAPI = {
  /**
   * `GET /gtm/prospects` — the brand's prospects in recommendation order,
   * keyset-paged. Ranked from the persisted winning row of each prospect's newest
   * evaluation, so opening the queue computes nothing.
   */
  listProspects: async (
    brandId: string,
    query: ProspectListQuery = {}
  ): Promise<ProspectListPage> => {
    const search = gtmQuery(brandId, {
      sort: query.sort,
      limit: query.limit,
      cursor: query.cursor,
    });
    const raw = await gtmFetch<WireProspectListPage>(`/prospects?${search}`);
    return {
      items: (raw.items ?? []).map(toProspectListItem),
      nextCursor: raw.next_cursor ?? null,
      hasMore: raw.has_more ?? false,
    };
  },

  /**
   * `GET /gtm/prospect/{lead_id}` — everything the prospect screen renders, read
   * from the rows the engines wrote. A prospect whose evaluation has not run
   * reports no channels and no recommended channel rather than a fabricated
   * winner.
   */
  getProspect: async (brandId: string, leadId: string): Promise<ProspectDetail> => {
    const raw = await gtmFetch<WireProspectDetail>(
      `/prospect/${encodeURIComponent(leadId)}?${gtmQuery(brandId)}`
    );
    return toProspectDetail(raw);
  },

  /**
   * `GET /gtm/prospect/{lead_id}/timeline` — the append-only ledger for one
   * prospect, ascending by event timestamp unless `newestFirst` is set. Cursor
   * paged; the cursor is opaque and is handed straight back.
   */
  getTimeline: async (
    brandId: string,
    leadId: string,
    query: TimelineQuery = {}
  ): Promise<TimelinePage> => {
    const search = gtmQuery(brandId, {
      limit: query.limit,
      cursor: query.cursor,
      newest_first: query.newestFirst === undefined ? undefined : query.newestFirst,
    });
    const raw = await gtmFetch<WireTimelinePage>(
      `/prospect/${encodeURIComponent(leadId)}/timeline?${search}`
    );
    return {
      entries: (raw.entries ?? []).map(toTimelineEntry),
      nextCursor: raw.next_cursor ?? null,
      hasMore: raw.has_more ?? false,
    };
  },

  /**
   * `POST /gtm/prospect/{lead_id}/recommend-channel` — score every channel now and
   * persist the result. The one call that moves a score, which is why it is
   * explicit: re-evaluating unchanged inputs writes nothing and returns the
   * evaluation already on the table with `persisted: false`.
   */
  recommendChannel: async (brandId: string, leadId: string): Promise<ChannelEvaluation> => {
    const raw = await gtmFetch<WireChannelEvaluation>(
      `/prospect/${encodeURIComponent(leadId)}/recommend-channel?${gtmQuery(brandId)}`,
      POST
    );
    return toChannelEvaluation(raw);
  },

  /**
   * `GET /gtm/prospect/{lead_id}/cta` — the persisted CTA readiness projection.
   * Read, not recomputed: a prospect with no conversation reports `NOT_READY` with
   * no score.
   */
  getCTA: async (brandId: string, leadId: string): Promise<CTA> => {
    const raw = await gtmFetch<WireCTA>(
      `/prospect/${encodeURIComponent(leadId)}/cta?${gtmQuery(brandId)}`
    );
    return toCTA(raw);
  },

  /**
   * `POST /gtm/prospect/{lead_id}/message/generate` — draft one message and persist
   * it as a new version.
   *
   * Always resolves to a persisted row. A generation that could not be written
   * comes back with `generatedContent: null` and `generationFailureReason`
   * populated — a draft that failed is a record, not an error, and the composer
   * shows it with a Regenerate control rather than an error banner.
   */
  generateMessage: async (
    brandId: string,
    leadId: string,
    input: MessageGenerateInput = {}
  ): Promise<Message | null> => {
    const raw = await gtmFetch<WireMessage>(
      `/prospect/${encodeURIComponent(leadId)}/message/generate?${gtmQuery(brandId)}`,
      { ...POST, body: JSON.stringify({ purpose: input.purpose ?? "WARMUP" }) }
    );
    return toMessage(raw);
  },

  /**
   * `PATCH /gtm/message/{message_id}` — save the operator's edit.
   *
   * The text is stored exactly as given, in `editedContent` and only there:
   * `generatedContent` stays byte-identical to what the model produced, which is
   * what makes the pair auditable.
   */
  saveEdit: async (
    brandId: string,
    messageId: string,
    editedContent: string
  ): Promise<Message | null> => {
    const raw = await gtmFetch<WireMessage>(
      `/message/${encodeURIComponent(messageId)}?${gtmQuery(brandId)}`,
      { method: "PATCH", body: JSON.stringify({ edited_content: editedContent }) }
    );
    return toMessage(raw);
  },

  /**
   * `POST /gtm/message/{message_id}/regenerate` — draft again for the same
   * conversation and purpose, as a new version. The predecessor is left completely
   * alone, so the version selector can still offer what the operator was shown
   * before.
   */
  regenerate: async (brandId: string, messageId: string): Promise<Message | null> => {
    const raw = await gtmFetch<WireMessage>(
      `/message/${encodeURIComponent(messageId)}/regenerate?${gtmQuery(brandId)}`,
      POST
    );
    return toMessage(raw);
  },

  /**
   * `POST /gtm/prospect/{lead_id}/action/request` — record that the operator
   * intends to act, and get back what they need to do it themselves.
   *
   * What comes back is a destination and a payload: where to go, and what to copy.
   * Weez cannot act inside LinkedIn and nothing on the response implies otherwise.
   *
   * Idempotent on `idempotencyKey`: a double click, a retried fetch, or a reloaded
   * tab returns the one action already requested rather than a second delivery.
   */
  requestAction: async (
    brandId: string,
    leadId: string,
    input: ActionRequestInput
  ): Promise<Action | null> => {
    const raw = await gtmFetch<WireAction>(
      `/prospect/${encodeURIComponent(leadId)}/action/request?${gtmQuery(brandId)}`,
      {
        ...POST,
        body: JSON.stringify({
          action_type: input.actionType,
          message_id: input.messageId ?? null,
          idempotency_key: input.idempotencyKey,
        }),
      }
    );
    return toAction(raw);
  },

  /**
   * `POST /gtm/action/{action_id}/opened` — record that the operator opened the
   * destination in LinkedIn.
   *
   * Opening a chat is not sending a message: no message record is written, no
   * `sentContent` is set, and `conversationState` does not move.
   */
  markOpened: async (brandId: string, actionId: string): Promise<Action | null> => {
    const raw = await gtmFetch<WireAction>(
      `/action/${encodeURIComponent(actionId)}/opened?${gtmQuery(brandId)}`,
      POST
    );
    return toAction(raw);
  },

  /**
   * `POST /gtm/action/{action_id}/confirm` — the operator's confirmation of an
   * outcome Weez could not observe.
   *
   * A confirmation the server declines is not an error here: the refusal is
   * recorded on the timeline with its reason and the response carries the state
   * that actually holds, so the caller renders what is true rather than what was
   * hoped for.
   */
  confirmAction: async (
    brandId: string,
    actionId: string,
    input: ActionConfirmInput = {}
  ): Promise<Action | null> => {
    const raw = await gtmFetch<WireAction>(
      `/action/${encodeURIComponent(actionId)}/confirm?${gtmQuery(brandId)}`,
      {
        ...POST,
        body: JSON.stringify({
          sent_text: input.sentText ?? null,
          observed_at: input.observedAt ?? null,
        }),
      }
    );
    return toAction(raw);
  },

  /**
   * `GET /gtm/action/{action_id}` — one requested action: how far it got, and how
   * sure we are about its outcome. `executionState` and `confirmationStatus` are
   * both returned and never collapsed.
   */
  getAction: async (brandId: string, actionId: string): Promise<Action | null> => {
    const raw = await gtmFetch<WireAction>(
      `/action/${encodeURIComponent(actionId)}?${gtmQuery(brandId)}`
    );
    return toAction(raw);
  },

  /**
   * `POST /gtm/prospect/{lead_id}/observe` — enqueue one read of one surface. The
   * API never navigates itself; the LinkedIn VM is the only consumer.
   *
   * `DEDUPED` is not a failure: an identical request inside the dedupe window
   * returns the job already queued.
   */
  observe: async (
    brandId: string,
    leadId: string,
    input: ObserveInput
  ): Promise<ObservationEnqueued> => {
    const raw = await gtmFetch<WireObservationEnqueued>(
      `/prospect/${encodeURIComponent(leadId)}/observe?${gtmQuery(brandId)}`,
      {
        ...POST,
        body: JSON.stringify({
          purpose: input.purpose,
          url: input.url ?? null,
          priority: input.priority ?? 0,
        }),
      }
    );
    return {
      outcome: raw.outcome ?? "ENQUEUED",
      purpose: raw.purpose ?? input.purpose,
      jobId: raw.job_id ?? null,
      sourceSurface: raw.source_surface ?? null,
      deduped: raw.deduped ?? false,
      reason: raw.reason ?? null,
    };
  },

  /**
   * `POST /gtm/prospect/{lead_id}/outcome` — persist one observed outreach outcome
   * for the learning loop.
   *
   * Idempotent on the outcome's dedupe key: re-recording the same observation
   * returns the row already held with `recorded: false`, which is what keeps a
   * cohort a count of facts rather than a count of reads.
   */
  recordOutcome: async (
    brandId: string,
    leadId: string,
    input: OutcomeInput
  ): Promise<OutcomeRecorded> => {
    const raw = await gtmFetch<WireOutcomeRecorded>(
      `/prospect/${encodeURIComponent(leadId)}/outcome?${gtmQuery(brandId)}`,
      {
        ...POST,
        body: JSON.stringify({
          channel_used: input.channelUsed,
          outcome_class: input.outcomeClass,
          source_surface: input.sourceSurface,
          observed_at: input.observedAt,
          observed_value: input.observedValue ?? null,
          confidence: input.confidence ?? "MEDIUM",
          observation_ref: input.observationRef ?? null,
          recommendation_id: input.recommendationId ?? null,
          action_id: input.actionId ?? null,
        }),
      }
    );
    return toOutcomeRecorded(raw, {
      channelUsed: input.channelUsed,
      outcomeClass: input.outcomeClass,
    });
  },

  // ─── The evolving prospect state, the ranking and the queue ─────────────────
  //
  // Ten more routes, in route order. Same conventions as the fourteen above: the
  // prospect is a path segment, the brand is the `brand_id` query parameter the
  // page holds as its `:spaceId` route parameter, and the response is renamed and
  // nothing else.

  /**
   * `GET /gtm/prospect/{lead_id}/state` — everything the layer believes about one
   * prospect, and why.
   *
   * Read-only: it recomputes nothing, creates no row and touches no recompute mark
   * — a state query is not a reason to revise a state. The four ledger-backed
   * dimensions arrive as four facts and the journey projection sits beside them.
   */
  getProspectState: async (brandId: string, leadId: string): Promise<ProspectStateFull> => {
    const raw = await gtmFetch<WireProspectStateFull>(
      `/prospect/${encodeURIComponent(leadId)}/state?${gtmQuery(brandId)}`
    );
    return toProspectStateFull(raw);
  },

  /**
   * `GET /gtm/prospect/{lead_id}/state/history` — the append-only state history,
   * newest first and keyset-paged.
   *
   * With `asOf` set the answer is the one snapshot in force at that instant, as a
   * one-item page, so the picker and the pager read one response shape. Before the
   * first snapshot the page is empty rather than holding the earliest snapshot: the
   * layer had no recorded belief then.
   */
  getStateHistory: async (
    brandId: string,
    leadId: string,
    query: StateHistoryQuery = {}
  ): Promise<StateHistoryPage> => {
    const search = gtmQuery(brandId, {
      limit: query.limit,
      cursor: query.cursor,
      as_of: query.asOf,
    });
    const raw = await gtmFetch<WireStateHistoryPage>(
      `/prospect/${encodeURIComponent(leadId)}/state/history?${search}`
    );
    return {
      items: (raw.items ?? []).map(toStateSnapshot),
      nextCursor: raw.next_cursor ?? null,
      hasMore: raw.has_more ?? false,
    };
  },

  /**
   * `GET /gtm/prospect/{lead_id}/signals` — the facts the state was folded from,
   * newest first by event timestamp and keyset-paged.
   *
   * Ordered by when each fact happened rather than when it was read, so a backfill
   * does not read as a surge. Expired signals are included by default and their
   * `effectiveStrength` is recomputed server-side at request time, in memory, with
   * the persisted cache left as the engines stamped it.
   */
  getSignals: async (
    brandId: string,
    leadId: string,
    query: SignalQuery = {}
  ): Promise<SignalPage> => {
    const search = gtmQuery(brandId, {
      limit: query.limit,
      cursor: query.cursor,
      signal_type: query.signalType,
      include_expired:
        query.includeExpired === undefined ? undefined : query.includeExpired,
    });
    const raw = await gtmFetch<WireSignalPage>(
      `/prospect/${encodeURIComponent(leadId)}/signals?${search}`
    );
    return {
      items: (raw.items ?? []).map(toSignal),
      nextCursor: raw.next_cursor ?? null,
      hasMore: raw.has_more ?? false,
    };
  },

  /**
   * `POST /gtm/prospect/{lead_id}/signal` — record one observed fact, and let it
   * move the state.
   *
   * Two outcomes come back, never one: the fact may be retained as a duplicate and
   * apply nothing, or be recorded and have its evidence refused by the reconciler.
   * `nbaMarked` says the recompute mark was set — the route ranks nothing and opens
   * nothing.
   */
  postSignal: async (
    brandId: string,
    leadId: string,
    input: SignalInput
  ): Promise<SignalRecorded> => {
    const raw = await gtmFetch<WireSignalRecorded>(
      `/prospect/${encodeURIComponent(leadId)}/signal?${gtmQuery(brandId)}`,
      {
        ...POST,
        body: JSON.stringify({
          signal_type: input.signalType,
          source: input.source,
          source_surface: input.sourceSurface,
          event_timestamp: input.eventTimestamp ?? null,
          event_timestamp_precision: input.eventTimestampPrecision ?? null,
          strength: input.strength ?? null,
          confidence: input.confidence ?? null,
          relevance: input.relevance ?? null,
          payload: input.payload ?? null,
          origin_table: input.originTable ?? null,
          origin_id: input.originId ?? null,
          dedupe_key: input.dedupeKey ?? null,
        }),
      }
    );
    return {
      leadId: raw.lead_id ?? leadId,
      signalId: raw.signal_id ?? null,
      dedupeKey: raw.dedupe_key ?? null,
      ingestOutcome: raw.ingest_outcome ?? "RECORDED",
      ingestReason: raw.ingest_reason ?? null,
      unclassified: raw.unclassified ?? false,
      atFloor: raw.at_floor ?? false,
      eventTimestampInferred: raw.event_timestamp_inferred ?? false,
      // Null only where no application was attempted, which is the ingest-rejection
      // path: there was no signal row to apply.
      applyOutcome: raw.apply_outcome ?? null,
      applyReason: raw.apply_reason ?? null,
      changedDimensions: raw.changed_dimensions ?? [],
      stateVersion: raw.state_version ?? 0,
      snapshotId: raw.snapshot_id ?? null,
      nbaMarked: raw.nba_marked ?? false,
    };
  },

  /**
   * `GET /gtm/prospect/{lead_id}/next-best-action` — the persisted ranking for one
   * prospect, with every alternative considered.
   *
   * Read-only by default. A prospect with no evaluation is an empty candidate set
   * and no recommendation, which is a true answer a card can render rather than a
   * fabricated one. `refresh` recomputes at most this one prospect, and an
   * unchanged input fingerprint writes nothing.
   */
  getNextBestAction: async (
    brandId: string,
    leadId: string,
    query: NextBestActionQuery = {}
  ): Promise<NextBestAction> => {
    const search = gtmQuery(brandId, {
      refresh: query.refresh === undefined ? undefined : query.refresh,
    });
    const raw = await gtmFetch<WireNextBestAction>(
      `/prospect/${encodeURIComponent(leadId)}/next-best-action?${search}`
    );
    return toNextBestAction(raw);
  },

  /**
   * `POST /gtm/prospect/{lead_id}/feedback` — record one human judgement about one
   * recommendation, and let it change the queue.
   *
   * The persisted row comes back, so the card shows what was recorded rather than
   * what it hoped was recorded. `suppressionWritten` and `recomputeMarked` report
   * the two things the route did besides writing the row.
   */
  postFeedback: async (
    brandId: string,
    leadId: string,
    input: FeedbackInput
  ): Promise<FeedbackRecorded> => {
    const raw = await gtmFetch<WireFeedbackRecorded>(
      `/prospect/${encodeURIComponent(leadId)}/feedback?${gtmQuery(brandId)}`,
      {
        ...POST,
        body: JSON.stringify({
          recommendation_id: input.recommendationId,
          feedback_type: input.feedbackType,
          comment: input.comment ?? null,
          chosen_action_type: input.chosenActionType ?? null,
        }),
      }
    );
    return toFeedbackRecorded(raw);
  },

  /**
   * `POST /gtm/prospect/{lead_id}/lifecycle` — record one lifecycle position that
   * moves no state dimension.
   *
   * In practice `VIEWED` when a card is first rendered and `CANCELLED` when the
   * operator dismisses it. The five admitted positions are the type of `position`;
   * the other six move a dimension and belong to the routes that own them.
   *
   * **This is not the open-channel path.** That control calls `requestAction`
   * against the existing `action/request` route, exactly as `NextActionPanel` does
   * today through `actionIdempotencyKey()`.
   *
   * Idempotent: with no `dedupeKey` the server composes one from the recommendation
   * and the position with no instant in it, so a re-rendered card records one
   * position rather than two. The ledger row comes back either way.
   */
  postLifecycle: async (
    brandId: string,
    leadId: string,
    input: LifecycleInput
  ): Promise<TimelineEntry> => {
    const raw = await gtmFetch<WireTimelineEntry>(
      `/prospect/${encodeURIComponent(leadId)}/lifecycle?${gtmQuery(brandId)}`,
      {
        ...POST,
        body: JSON.stringify({
          recommendation_id: input.recommendationId,
          position: input.position,
          action_type: input.actionType,
          channel: input.channel ?? null,
          dedupe_key: input.dedupeKey ?? null,
        }),
      }
    );
    return toTimelineEntry(raw);
  },

  /**
   * `GET /gtm/action-queue` — the brand's live recommendations as one ranked queue,
   * keyset-paged.
   *
   * One item per prospect: the newest live evaluation's winner, so a superseded card
   * is never worked and a dismissed one is gone. Read-only — a queue that
   * re-evaluated on open would reorder itself because somebody looked at it.
   */
  getActionQueue: async (
    brandId: string,
    query: ActionQueueQuery = {}
  ): Promise<ActionQueuePage> => {
    const search = gtmQuery(brandId, {
      sort: query.sort,
      limit: query.limit,
      cursor: query.cursor,
      channel: query.channel,
      action_type: query.actionType,
    });
    const raw = await gtmFetch<WireActionQueuePage>(`/action-queue?${search}`);
    return {
      items: (raw.items ?? []).map(toActionQueueItem),
      nextCursor: raw.next_cursor ?? null,
      hasMore: raw.has_more ?? false,
    };
  },

  /**
   * `GET /gtm/dashboard` — the brand's seven actionable statements for the period.
   *
   * Each count carries the filter that reproduces it, so a statement is a link to
   * the rows behind it rather than a restated number. A statement that could not be
   * computed is absent rather than reported as zero.
   */
  getDashboard: async (brandId: string, query: DashboardQuery = {}): Promise<Dashboard> => {
    const search = gtmQuery(brandId, { period_days: query.periodDays });
    const raw = await gtmFetch<WireDashboard>(`/dashboard?${search}`);
    return {
      periodDays: raw.period_days ?? query.periodDays ?? 7,
      computedAt: raw.computed_at ?? null,
      aggregates: (raw.aggregates ?? []).map(toDashboardAggregate),
    };
  },

  /**
   * `GET /gtm/prospect/{lead_id}/debug` — the whole chain behind one prospect.
   *
   * The state, the signals it was folded from, the reconciliation outcomes, the
   * transitions, the snapshot headers, the recorded lifecycle positions, the
   * observed outcomes, and the newest evaluation's candidates with the statistics
   * they were scored against. `limit` caps each collection independently and every
   * one is newest-first. It writes nothing: reading why a belief exists must not be
   * the thing that changes it.
   */
  getDebugView: async (
    brandId: string,
    leadId: string,
    query: DebugViewQuery = {}
  ): Promise<DebugView> => {
    const search = gtmQuery(brandId, { limit: query.limit });
    const raw = await gtmFetch<WireDebugView>(
      `/prospect/${encodeURIComponent(leadId)}/debug?${search}`
    );
    return toDebugView(raw);
  },
};

export default gtmAPI;
