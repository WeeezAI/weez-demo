// components/gtm/__tests__/panels.test.tsx
//
// The five intelligence panels, tested for the honesty rules they exist to enforce
// rather than for their markup.
//
// The primitives are already covered in `primitives.test.tsx`; what these tests are
// for is the panels' own claims — the places where a panel could quietly compute
// something the server did not send, or collapse two facts into one, or fill a gap
// with a zero. Five claims, one per panel, plus the two that span all of them:
//
//   `ProspectHeader`                identity reaches the screen only through
//                                   `ObservedValue`, so an unobserved profile reads
//                                   "Unknown" instead of falling back to an id
//                                   (R18.1)
//   `ActivityPanel`                 score, band, and observation time are three
//                                   separate claims; staleness is an age, not an
//                                   absence, and does not change the band
//                                   (R18.2, R2.6)
//   `ChannelRecommendationPanel`    the recommended channel is the server's argmax,
//                                   matched by equality — never re-derived here —
//                                   and what could not be observed is rendered
//                                   rather than buried (R18.3, R1.3, R1.7)
//   `StateDimensionGrid`            the summary is display-only and marked derived;
//                                   the four dimensions and `conversation_stage`
//                                   stay independently visible beside it
//                                   (R18.4, R6.3)
//   `CTAReadinessPanel`             the readiness score carries its disclaimer, and
//                                   `decidedBy` says whether a band or an evidence
//                                   gate produced the state (R9.5, R9.6)
//
// Spanning all five: no derived number appears as a bare integer, and no unknown fact
// renders as `0`, `false`, an em dash, or a value from some dimension's enumeration.
//
// ── The state engine's panels ──────────────────────────────────────────────────
//
// Twelve more panels arrive with the evolving prospect state engine, and they are
// tested here rather than in a new module because they make the same class of claim
// the five above make and are swept by the same `axe` configuration at the bottom of
// this file. What is added is deliberately narrow — three claims, not a second copy
// of each panel's own behaviour:
//
//   1. **Every status indicator has a text alternative.** Each of these panels tones
//      a chip by value, and every one of those tones is decoration: the same fact has
//      to be readable in a greyscale screenshot and to a screen reader. So each panel
//      is checked for the *sentence* that carries the meaning its colour also carries
//      — and, for the panels whose zero is ambiguous, for the sentence that says which
//      kind of zero it is ("nothing observed" versus "nobody looked"). Those strings
//      are asserted through each module's own exported label object rather than
//      retyped here, because a relabelling should move the test with it.
//   2. **Every control they introduce is keyboard-reachable with a visible focus
//      ring.** Only two of the twelve render controls — `SignalList`'s pager and
//      `StateHistoryPanel`'s `as_of` picker — and both are walked with
//      `userEvent.tab()` from the document body, so the claim is about the real tab
//      order rather than about which elements exist. The ring is the project's four
//      `focus-visible` utilities, which is what is checkable in jsdom: it proves each
//      control came from the design system's focus treatment instead of being
//      hand-rolled without one.
//   3. **The `CLICKED` / `STARTED` pair never reads as performed.** `ProspectTimeline`
//      gained both positions, and a timeline entry is where a request would most
//      easily start reading as a send.
//
// `primitives.test.tsx` stays untouched: this feature adds no primitive, and
// `ObservedValue` / `DerivedScore` / the status labels are its subject, not this one's.
//
// ── Where three of them now live (R20.8, §15.3) ────────────────────────────────
//
// The restructure moves `BuyingStagePanel`, `IntentPanel` and `ChannelIntelligencePanel`
// off the retired `GTMProspect` page and behind the dossier's "Where this prospect
// stands" disclosure. Their own claims above are unaffected — they are pure renders of
// the props they are handed — but "which surface builds them, and when" is not a claim
// any of them can keep, so the last block in this file mounts the real dossier through
// the real transport and reads the DOM. Same idiom as
// `components/gtm/__tests__/insufficientCredits.test.tsx`, which already mounts that page
// from this folder.
//
// It is deliberately about *mounting and order*, not about requests. All three read
// slices of a payload the selection already holds, so opening that section costs nothing,
// and the request budget belongs to `ProspectDossier.compose.test.tsx`'s property 6.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Activity,
  BuyingStageState,
  CTA,
  CandidateAction,
  ChannelResult,
  ChannelState,
  DerivedScore as DerivedScorePayload,
  EngagementTrajectory,
  FactorContribution,
  Intent,
  LearningUpdate,
  ObservedFact,
  ProspectProfile,
  ProspectState,
  ProspectStateFull,
  RecommendationExplanation,
  Signal,
  TimelineEntry,
  TimingState,
} from "@/services/gtmAPI";
import { ActionExplanation, ACTION_EXPLANATION_LABELS } from "../ActionExplanation";
import { ActivityPanel } from "../ActivityPanel";
import { BuyingStagePanel, BUYING_STAGE_PANEL_LABELS } from "../BuyingStagePanel";
import { CTAReadinessPanel } from "../CTAReadinessPanel";
import { ChannelIntelligencePanel, CHANNEL_PANEL_LABELS } from "../ChannelIntelligencePanel";
import { ChannelRecommendationPanel } from "../ChannelRecommendationPanel";
import { EngagementTrendPanel, ENGAGEMENT_TREND_PANEL_LABELS } from "../EngagementTrendPanel";
import { IntentPanel, INTENT_PANEL_LABELS, INTENT_TYPES } from "../IntentPanel";
import {
  IdentityPanel,
  trackRefusal,
  trackingState,
  verificationFact,
} from "../IdentityPanel";
import { JourneyStateBadge } from "../JourneyStateBadge";
import { LearningInsightsPanel, LEARNING_PANEL_LABELS } from "../LearningInsightsPanel";
import { ProspectHeader } from "../ProspectHeader";
import { ProspectTimelineEntry } from "../ProspectTimeline";
import { SignalList, SIGNAL_LIST_LABELS } from "../SignalList";
import { StateDimensionGrid } from "../StateDimensionGrid";
import { StateHistoryPanel, STATE_HISTORY_LABELS } from "../StateHistoryPanel";
import { TimingPanel, TIMING_PANEL_LABELS } from "../TimingPanel";
import { UNKNOWN_TEXT } from "../ObservedValue";
import {
  CHANNEL_AVAILABILITY_LABEL,
  CHANNEL_LABEL,
  FIELD_LABEL,
  GTM_IDENTITY_LABELS,
  GTM_INTENT_LABELS,
  GTM_LIFECYCLE_LABELS,
  GTM_PAGE_LABELS,
  GTM_TRACKING_STATE_LABELS,
  GTM_UI_LABELS,
  GTM_VERIFICATION_LABELS,
  PROSPECT_INTELLIGENCE_SECTIONS,
  STATE_LABEL,
  TONE,
} from "../labels";
import ProspectIntelligence from "@/pages/ProspectIntelligence";
import { CreditsProvider } from "@/hooks/useCredits";
import { evaAPI, type EvaWorkspace, type QualifiedLead } from "@/services/evaAPI";

// The page mounted in the last block pulls both of these in. Neither is any of this
// file's business: the sidebar owns a conversation read of its own, and nothing here
// asserts on a toast.
vi.mock("sonner", () => {
  const toastFn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    dismiss: vi.fn(),
  });
  return { toast: toastFn, Toaster: () => null };
});

vi.mock("@/components/ConversationSidebar", () => ({
  default: () => <nav aria-label="Conversations" />,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DISCLAIMER = "A prioritisation signal, not a predicted probability of conversion.";

function score(value: number | null): DerivedScorePayload {
  return {
    score: value,
    scoreKind: "RECOMMENDATION_SCORE",
    scoreDisclaimer: DISCLAIMER,
    isDerived: true,
  };
}

function observed(value: string, over: Partial<ObservedFact> = {}): ObservedFact {
  return {
    value,
    isUnknown: false,
    sourceSurface: "LINKEDIN_PROFILE_PAGE",
    observedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    isStale: false,
    isDerived: false,
    ...over,
  };
}

const UNKNOWN_FACT: ObservedFact = {
  value: null,
  isUnknown: true,
  sourceSurface: null,
  observedAt: null,
  isStale: false,
  isDerived: false,
};

function factor(over: Partial<FactorContribution> = {}): FactorContribution {
  return {
    factor: "icp_match",
    available: true,
    weight: 0.2,
    value: 80,
    persistedValue: "STRONG",
    source: "sales_leads",
    contributionHundredths: 16,
    direction: "RAISES",
    unavailableReason: null,
    ...over,
  };
}

const PROFILE: ProspectProfile = {
  leadId: "lead-1",
  profileId: "profile-1",
  profileUrl: "https://www.linkedin.com/in/example",
  publicIdentifier: "example",
  name: observed("Ada Lovelace"),
  headline: observed("Head of Engineering"),
  company: observed("Analytical Engines"),
  role: observed("Head of Engineering"),
  location: observed("London"),
  seniority: observed("EXECUTIVE", { isDerived: true }),
  icpMatch: observed("STRONG", { isDerived: true }),
  intentSignal: observed("HIGH", { isDerived: true }),
  acvTier: observed("MID", { isDerived: true }),
  leadScore: score(82),
  // No identity attempt on record, which is the shape the server sends for a lead
  // nobody has tried to resolve: the three keys are dropped, not sent as nulls, and
  // `null` here means *nobody has tried* rather than `NO_MATCH`.
  linkedinVerificationStatus: null,
  linkedinVerifiedAt: null,
  linkedinMatchConfidence: null,
  // No unsettled candidate: these are present only while an identity is waiting on
  // a human verdict, and null is the same "nobody has tried" as the three above.
  identityCandidateUrl: null,
  identityMatchEvidence: null,
  identityFailureReason: null,
};

const UNOBSERVED_PROFILE: ProspectProfile = {
  ...PROFILE,
  name: UNKNOWN_FACT,
  headline: UNKNOWN_FACT,
  company: UNKNOWN_FACT,
  role: UNKNOWN_FACT,
  location: UNKNOWN_FACT,
  seniority: UNKNOWN_FACT,
  icpMatch: UNKNOWN_FACT,
  intentSignal: UNKNOWN_FACT,
  acvTier: UNKNOWN_FACT,
  leadScore: score(null),
  profileUrl: null,
};

const ACTIVITY: Activity = {
  score: score(64),
  level: observed("HIGH", { sourceSurface: "LINKEDIN_ACTIVITY_TAB", isDerived: true }),
  observedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
  isStale: false,
  sourceSurface: "LINKEDIN_ACTIVITY_TAB",
  components: { recency: 40, frequency: 24 },
};

const EMPTY_ACTIVITY: Activity = {
  score: score(null),
  level: UNKNOWN_FACT,
  observedAt: null,
  isStale: false,
  sourceSurface: null,
  components: {},
};

const CHANNELS: ChannelResult[] = [
  {
    channel: "LINKEDIN",
    score: score(78),
    confidence: "HIGH",
    recommendation: "LINKEDIN_WARMUP_MESSAGE",
    reasoning: [factor(), factor({ factor: "linkedin_activity_level", persistedValue: "HIGH" })],
    unavailableFactors: [],
    availableWeightMass: 100,
    computedAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    channel: "EMAIL",
    score: score(51),
    confidence: "MEDIUM",
    recommendation: "EMAIL_FIRST_TOUCH",
    reasoning: [
      factor({ factor: "signal_recency", direction: "LOWERS", persistedValue: "31d" }),
      factor({
        factor: "phone_available",
        available: false,
        direction: "UNAVAILABLE",
        persistedValue: null,
        unavailableReason: "No phone number on the lead",
      }),
    ],
    unavailableFactors: ["phone_available"],
    availableWeightMass: 85,
    computedAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    channel: "PHONE",
    score: score(null),
    confidence: "LOW",
    recommendation: "HOLD_INSUFFICIENT_DATA",
    reasoning: [],
    unavailableFactors: ["phone_available", "prior_interaction_outcomes"],
    availableWeightMass: 40,
    computedAt: null,
  },
];

const STATE: ProspectState = {
  relationshipState: observed("CONNECTED"),
  conversationState: observed("WAITING_FOR_REPLY", { sourceSurface: "LINKEDIN_MESSAGING_THREAD" }),
  conversationStage: observed("WARMUP", { isDerived: true }),
  executionState: observed("VERIFICATION_PENDING", { sourceSurface: "WEEZ_UI_CLICK" }),
  activityLevel: observed("HIGH", { sourceSurface: "LINKEDIN_ACTIVITY_TAB", isDerived: true }),
  confirmationStatus: "WAITING_FOR_CONFIRMATION",
  displaySummary: "Verification pending — waiting for confirmation",
  displaySummaryIsDerived: true,
};

const UNKNOWN_STATE: ProspectState = {
  relationshipState: UNKNOWN_FACT,
  conversationState: UNKNOWN_FACT,
  conversationStage: UNKNOWN_FACT,
  executionState: UNKNOWN_FACT,
  activityLevel: UNKNOWN_FACT,
  confirmationStatus: "NOT_APPLICABLE",
  displaySummary: "",
  displaySummaryIsDerived: true,
};

const CTA_PAYLOAD: CTA = {
  score: score(58),
  ctaState: "SOFT_CTA_READY",
  recommendedCta: "SOFT_INTEREST_CHECK",
  decidedBy: "CTA_SCORE_BAND",
  reasoning: [
    factor({ factor: "reply", persistedValue: "CURIOUS" }),
    factor({ factor: "depth", persistedValue: "3 exchanges", direction: "NEUTRAL" }),
  ],
  computedAt: new Date(Date.now() - 1800_000).toISOString(),
};

// ─── Fixtures for the state engine's panels ───────────────────────────────────
//
// Built to exercise the branches the three added claims live in: one supported intent
// beside ten unsupported ones, one reachable channel beside one with no identifier, an
// unplaced buying stage, a never-counted engagement trajectory, and an unresolved
// timezone. The absent-value branches are the ones written last and reviewed least,
// which is exactly why the text alternatives are asserted on them.

function intent(intentType: Intent["intentType"], over: Partial<Intent> = {}): Intent {
  return {
    intentType,
    value: 0,
    confidence: 0,
    source: "DERIVED",
    evaluatedAt: null,
    decayRate: 0,
    signalIds: [],
    isDerived: true,
    ...over,
  };
}

/** One supported type, one looked-at-and-empty type, nine never evaluated. */
const INTENTS: Intent[] = [
  intent("BUYING", {
    value: 72,
    confidence: 61,
    evaluatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    signalIds: ["sig-1", "sig-2"],
  }),
  intent("HIRING", { evaluatedAt: new Date(Date.now() - 3600_000).toISOString() }),
  ...INTENT_TYPES.filter((each) => each !== "BUYING" && each !== "HIRING").map((each) =>
    intent(each),
  ),
];

function channelState(
  channel: ChannelState["channel"],
  over: Partial<ChannelState> = {},
): ChannelState {
  return {
    channel,
    availability: "AVAILABLE",
    reachability: 70,
    activity: 55,
    engagement: 40,
    responsiveness: 35,
    responseRate: 20,
    historicalConversionRate: 8,
    confidence: 60,
    suitability: 66,
    lastInteractionAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
    lastInboundAt: null,
    lastOutboundAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
    cooldownUntil: null,
    consecutiveUnanswered: 0,
    provenance: {},
    ...over,
  };
}

/** LinkedIn reachable, email reachable but quiet, phone with no identifier at all. */
const CHANNEL_STATES: ChannelState[] = [
  channelState("LINKEDIN", {
    provenance: {
      availability: observed("AVAILABLE"),
      activity: observed("HIGH", { sourceSurface: "LINKEDIN_ACTIVITY_TAB" }),
    },
  }),
  channelState("EMAIL", { responsiveness: 5, suitability: 22, confidence: 30 }),
  channelState("PHONE", {
    availability: "UNAVAILABLE",
    reachability: 0,
    activity: 0,
    engagement: 0,
    responsiveness: 0,
    responseRate: 0,
    historicalConversionRate: 0,
    confidence: 0,
    suitability: 0,
    lastInteractionAt: null,
    lastOutboundAt: null,
  }),
];

/** Placed, and its opposite: nothing has placed the prospect at all. */
const BUYING_STAGE: BuyingStageState = {
  value: "EVALUATING",
  confidence: 58,
  signalIds: ["sig-1"],
  isDerived: true,
};

const UNPLACED_BUYING_STAGE: BuyingStageState = {
  value: "UNKNOWN",
  confidence: 0,
  signalIds: [],
  isDerived: true,
};

const ENGAGEMENT: EngagementTrajectory = {
  count24h: 2,
  count7d: 6,
  count30d: 11,
  trend: "RISING",
  evaluatedAt: new Date(Date.now() - 3600_000).toISOString(),
};

/** Never counted: `FLAT` is the starting value here, not a reading. */
const UNCOUNTED_ENGAGEMENT: EngagementTrajectory = {
  count24h: 0,
  count7d: 0,
  count30d: 0,
  trend: "FLAT",
  evaluatedAt: null,
};

const TIMING: TimingState = {
  lastMeaningfulSignalAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
  signalFreshness: 74,
  urgency: 62,
  cooldownUntil: null,
  idealNextActionWindowStart: new Date(Date.now() + 3600_000).toISOString(),
  idealNextActionWindowEnd: new Date(Date.now() + 5 * 3600_000).toISOString(),
  withinBusinessHours: "WITHIN",
  activityTrendFlag: "SPIKE",
};

/** No timezone resolved, which is not the same as being outside working hours. */
const TIMING_WITHOUT_TIMEZONE: TimingState = {
  ...TIMING,
  withinBusinessHours: "UNKNOWN",
  activityTrendFlag: "UNKNOWN",
};

const DIMENSION_CONFIDENCE: Record<string, number> = {
  relationship_state: 82,
  conversation_state: 71,
  buying_stage: 58,
  engagement_trend: 64,
  activity_trend_flag: 49,
};

const STATE_FULL: ProspectStateFull = {
  leadId: "lead-1",
  stateVersion: 7,
  journeyState: observed("CONVERSATION_ACTIVE", { isDerived: true }),
  stateConfidence: 66,
  stateFlags: [],
  dimensions: {},
  identity: {
    confidence: 88,
    verifiedAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
    sourceSurface: "LINKEDIN_PROFILE_PAGE",
    observedAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
  },
  icp: {
    score: score(74),
    confidence: 62,
    components: [factor()],
    evaluatedAt: new Date(Date.now() - 3600_000).toISOString(),
    signalIds: ["sig-1"],
    discoveryIcpPassed: true,
    discoveryCriteria: "Series B SaaS, 50-250 staff",
    discoveryAcvTier: "MID",
  },
  intents: INTENTS,
  channels: CHANNEL_STATES,
  engagement: ENGAGEMENT,
  buyingStage: BUYING_STAGE,
  timing: TIMING,
  dimensionConfidence: DIMENSION_CONFIDENCE,
  doNotContact: UNKNOWN_FACT,
  updatedAt: new Date(Date.now() - 1800_000).toISOString(),
};

function signal(over: Partial<Signal> = {}): Signal {
  return {
    signalId: "sig-1",
    signalType: "PROFILE_VIEW",
    source: "LINKEDIN",
    sourceSurface: "LINKEDIN_PROFILE_PAGE",
    eventTimestamp: new Date(Date.now() - 6 * 3600_000).toISOString(),
    eventTimestampPrecision: "EXACT",
    ingestedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    strength: 60,
    confidence: 80,
    relevance: 70,
    effectiveStrength: 34,
    decayProfile: "EXPONENTIAL",
    expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
    atFloor: false,
    originTable: "li_gtm_profiles",
    originId: "profile-1",
    payload: {},
    ...over,
  };
}

/** One live signal and one retained past its horizon — retained is not still counting. */
const SIGNALS: Signal[] = [
  signal(),
  signal({
    signalId: "sig-2",
    signalType: "POST_ENGAGEMENT",
    effectiveStrength: 5,
    atFloor: true,
    expiresAt: new Date(Date.now() - 3600_000).toISOString(),
  }),
];

const SNAPSHOTS = [
  {
    snapshotId: "snap-2",
    recordedAt: new Date(Date.now() - 3600_000).toISOString(),
    stateVersion: 7,
    changedDimensions: ["buying_stage"],
    confidence: 66,
    journeyState: "CONVERSATION_ACTIVE",
    triggeringSignalId: "sig-1",
    triggeringActionId: null,
    state: {},
  },
];

const LEARNING_UPDATES: LearningUpdate[] = [
  {
    statId: "stat-1",
    scope: "WORKSPACE",
    scopeUserId: null,
    actionType: "SEND_LINKEDIN_WARMUP",
    channel: "LINKEDIN",
    sampleSize: 48,
    positiveCount: 19,
    negativeCount: 29,
    excludedUnknownCount: 2,
    successRate: 40,
    ciLow: 27,
    ciHigh: 54,
    meanReward: 12,
    decision: "APPLIED",
    decisionReason: null,
    appliedScope: "WORKSPACE",
    minSample: 30,
    learningVersion: "learning-v1",
    computedAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    statId: "stat-2",
    scope: "USER",
    scopeUserId: "user-1",
    actionType: "REQUEST_MEETING",
    channel: "LINKEDIN",
    sampleSize: 4,
    positiveCount: 1,
    negativeCount: 3,
    excludedUnknownCount: 0,
    successRate: 25,
    ciLow: 5,
    ciHigh: 70,
    meanReward: 3,
    // The pair the panel exists to keep apart: a thin sample, and the broader
    // statistic kept in its place.
    decision: "INSUFFICIENT_SAMPLE_RETAINED",
    decisionReason: "4 outcomes against a minimum of 30",
    appliedScope: "WORKSPACE",
    minSample: 30,
    learningVersion: "learning-v1",
    computedAt: new Date(Date.now() - 3600_000).toISOString(),
  },
];

const EXPLANATION: RecommendationExplanation = {
  whyNow: [
    {
      signalId: "sig-1",
      signalType: "PROFILE_VIEW",
      eventTimestamp: new Date(Date.now() - 6 * 3600_000).toISOString(),
      effectiveStrength: 34,
      term: "signal_freshness",
      contributionHundredths: 18,
      evidenceId: "ev-1",
    },
  ],
  whyThisChannel: [
    factor({ factor: "channel_suitability", persistedValue: "66" }),
    factor({
      factor: "phone_available",
      available: false,
      direction: "UNAVAILABLE",
      persistedValue: null,
      unavailableReason: "No phone number on the lead",
    }),
  ],
  whyThisMessage: {
    messageId: null,
    messagePurpose: "WARMUP",
    groundingSignalIds: ["sig-1"],
    note: "Ground the angle in the hiring push.",
  },
  whyNotTheOtherChannels: [
    {
      actionType: "SEND_EMAIL",
      channel: "EMAIL",
      // Scored, and lower. A real comparison.
      actionScore: score(41),
      exclusionReason: null,
      loweringTerms: [factor({ factor: "channel_suitability", direction: "LOWERS" })],
    },
    {
      actionType: "CALL",
      channel: "PHONE",
      // Never scored, which must not read as a low number.
      actionScore: score(null),
      exclusionReason: "CHANNEL_UNAVAILABLE",
      loweringTerms: [],
    },
  ],
  scope: {
    appliedScope: "WORKSPACE",
    sampleSize: 48,
    minSample: 30,
    decision: "APPLIED",
    decisionReason: null,
  },
  versions: {
    policyVersion: "policy-v3",
    modelVersion: "model-v2",
    learningVersion: "learning-v1",
    weightSetId: "weights-1",
  },
};

const RECOMMENDED_ACTION: CandidateAction = {
  recommendationId: "reco-1",
  actionType: "SEND_LINKEDIN_WARMUP",
  channel: "LINKEDIN",
  rank: 1,
  isRecommended: true,
  actionScore: score(77),
  actionConfidence: 63,
  stateConfidence: 66,
  terms: [factor({ factor: "expected_success_probability", value: 41 })],
  unavailableTerms: ["prior_interaction_outcomes"],
  availableWeightMass: 88,
  exclusionReason: null,
  explanation: EXPLANATION,
  expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
  computedAt: new Date(Date.now() - 900_000).toISOString(),
};

/** A lifecycle ledger row, which is how `CLICKED` and `STARTED` reach the timeline. */
function lifecycleEntry(eventType: string): TimelineEntry {
  return {
    eventId: `ev-${eventType}`,
    eventType,
    eventAt: new Date(Date.now() - 600_000).toISOString(),
    summary: `reco-1 · ${eventType}`,
    outcome: "RECORDED",
    dimension: null,
    priorValue: null,
    newValue: null,
    actorId: "user-1",
    actorType: "USER",
    evidenceId: null,
    evidenceSourceSurface: null,
    evidenceObservedValue: null,
    evidenceObservedAt: null,
    evidenceConfidence: null,
    relatedActionId: "act-1",
    relatedMessageId: null,
    signalId: null,
    recommendationId: "reco-1",
  };
}

// ─── The two panels that read their own collections ───────────────────────────
//
// `SignalList` and `StateHistoryPanel` fetch, page and fail on their own, so the
// transport is stubbed by URL and the real `gtmAPI` normaliser runs from wire to DOM
// exactly as it does on the page. Every other panel in this file is a pure render and
// is unaffected by the stub.

const HOUR = 3600_000;

function wireSignal(from: Signal, precision = "EXACT") {
  return {
    signal_id: from.signalId,
    signal_type: from.signalType,
    source: from.source,
    source_surface: from.sourceSurface,
    event_timestamp: from.eventTimestamp,
    event_timestamp_precision: precision,
    ingested_at: from.ingestedAt,
    strength: from.strength,
    confidence: from.confidence,
    relevance: from.relevance,
    effective_strength: from.effectiveStrength,
    decay_profile: from.decayProfile,
    expires_at: from.expiresAt,
    at_floor: from.atFloor,
    origin_table: from.originTable,
    origin_id: from.originId,
    payload: {},
  };
}

function wireSnapshot(from: (typeof SNAPSHOTS)[number]) {
  return {
    snapshot_id: from.snapshotId,
    recorded_at: from.recordedAt,
    state_version: from.stateVersion,
    changed_dimensions: from.changedDimensions,
    confidence: from.confidence,
    journey_state: from.journeyState,
    triggering_signal_id: from.triggeringSignalId,
    triggering_action_id: from.triggeringActionId,
    state: {},
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

/**
 * Serve both collections, with a cursor behind each so the two pagers mount.
 *
 * `/state/history` is matched before `/signals` because neither path is a prefix of
 * the other and order is therefore only about readability here — but the history path
 * does contain `/state`, which is why nothing in this file matches on that alone.
 */
function serveCollections(signals = SIGNALS, snapshots = SNAPSHOTS) {
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);
    const body = url.includes("/state/history")
      ? { items: snapshots.map(wireSnapshot), next_cursor: "cursor-1", has_more: true }
      : { items: signals.map(wireSignal), next_cursor: "cursor-1", has_more: true };
    return { ok: true, status: 200, json: async () => body };
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // `gtmFetch` reads the session token from `sessionStorage` and puts it on the
  // `Authorization` header. Nothing here asserts on it; it just has to exist.
  sessionStorage.setItem("token", "session-abc");
  serveCollections();
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

/**
 * The four `focus-visible` utilities every control in this design system carries,
 * read off `components/ui/button.tsx` and `components/ui/input.tsx`.
 *
 * jsdom cannot compute a rendered outline, so this is not a measurement of a visible
 * ring — it is the assertion that every control came from the design system's focus
 * treatment instead of being hand-rolled without one. The same list the dossier's own
 * accessibility suite walks the page with — `pages/__tests__/ProspectDossier.a11y.test.tsx`,
 * since §15.2's swap landed in task 13.1.
 */
const FOCUS_VISIBLE_CLASSES = [
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-ring",
  "focus-visible:ring-offset-2",
];

/** The roles a control in these panels can hold. */
const CONTROL_ROLES = ["button", "link", "textbox", "combobox"] as const;

/** Tab from the document body and collect what receives focus at each stop. */
async function tabOrder(limit = 20): Promise<HTMLElement[]> {
  const user = userEvent.setup();
  (document.activeElement as HTMLElement | null)?.blur();

  const stops: HTMLElement[] = [];
  for (let step = 0; step < limit; step += 1) {
    await user.tab();
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body) break;
    if (stops.includes(active)) break;
    stops.push(active);
  }
  return stops;
}

// ─── ProspectHeader (R18.1) ───────────────────────────────────────────────────

describe("ProspectHeader", () => {
  it("renders identity, the three qualification chips, and the lead score", () => {
    const { container } = render(<ProspectHeader profile={PROFILE} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    // Headline and role happen to read the same on this fixture; both slots are filled.
    expect(screen.getAllByText("Head of Engineering")).toHaveLength(2);
    expect(screen.getByText("Analytical Engines")).toBeInTheDocument();
    expect(screen.getByText("London")).toBeInTheDocument();

    // R18.1 — ICP match, intent signal, and ACV tier each named and each present.
    ["ICP match", "Intent signal", "ACV tier"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument(),
    );

    // The lead score is a derived number, so it arrives labelled and disclaimed.
    expect(screen.getByText("Lead score")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(container.textContent).toContain(DISCLAIMER);
  });

  it("takes chip contrast from the shared TONE table", () => {
    const { container } = render(<ProspectHeader profile={PROFILE} />);
    const chip = screen.getByText("ICP match").closest("div");
    expect(chip?.className).toContain(TONE.violet);
  });

  it("reads Unknown for an unobserved profile rather than substituting an id", () => {
    const { container } = render(<ProspectHeader profile={UNOBSERVED_PROFILE} />);
    const text = container.textContent ?? "";

    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
    expect(text).not.toContain("lead-1");
    expect(text).not.toContain("profile-1");
    expect(text).not.toMatch(/\b0\b/);
    expect(text).not.toContain("—");
  });

  it("offers a refresh control only when a handler is given, and disables it while in flight", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();

    const { unmount } = render(<ProspectHeader profile={PROFILE} onRefresh={onRefresh} />);
    await user.click(screen.getByRole("button", { name: GTM_UI_LABELS.refresh }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    unmount();

    render(<ProspectHeader profile={PROFILE} onRefresh={onRefresh} refreshing />);
    expect(screen.getByRole("button", { name: GTM_UI_LABELS.refreshing })).toBeDisabled();
  });

  it("renders no refresh control when no handler is given", () => {
    render(<ProspectHeader profile={PROFILE} />);
    expect(screen.queryByRole("button", { name: GTM_UI_LABELS.refresh })).not.toBeInTheDocument();
  });
});

// ─── ActivityPanel (R18.2, R2.6) ──────────────────────────────────────────────

describe("ActivityPanel", () => {
  it("renders the score, the level, and the observation timestamp as three claims", () => {
    const { container } = render(<ActivityPanel activity={ACTIVITY} />);

    expect(screen.getByText("Activity score")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(container.textContent).toContain(DISCLAIMER);

    expect(screen.getByText("High")).toBeInTheDocument();
    expect(container.textContent).toContain("LinkedIn activity");
    expect(container.querySelector("time")).toHaveAttribute("dateTime", ACTIVITY.observedAt!);
  });

  it("shows the stale chip without changing the level", () => {
    render(<ActivityPanel activity={{ ...ACTIVITY, isStale: true }} />);
    expect(screen.getByText("Stale observation")).toBeInTheDocument();
    // The band is the server's and does not move because the observation aged.
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders no stale chip on a fresh observation", () => {
    render(<ActivityPanel activity={ACTIVITY} />);
    expect(screen.queryByText("Stale observation")).not.toBeInTheDocument();
  });

  it("reads Unknown for an empty activity set rather than zero", () => {
    const { container } = render(<ActivityPanel activity={EMPTY_ACTIVITY} />);
    const text = container.textContent ?? "";

    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);
    expect(text).not.toMatch(/\b0\b/);
    expect(text).not.toContain("Inactive");
  });
});

// ─── ChannelRecommendationPanel (R18.3, R1.3, R1.7) ───────────────────────────

describe("ChannelRecommendationPanel", () => {
  it("renders one card per channel with score, confidence, recommendation, and reasoning", () => {
    render(<ChannelRecommendationPanel channels={CHANNELS} recommendedChannel="LINKEDIN" />);

    const cards = screen.getAllByRole("listitem").filter((li) => li.querySelector("h3"));
    expect(cards).toHaveLength(3);

    const linkedin = screen.getByText("LinkedIn").closest("li")!;
    expect(within(linkedin).getByText("78")).toBeInTheDocument();
    expect(within(linkedin).getByText("High confidence")).toBeInTheDocument();
    expect(
      within(linkedin).getByText("Send a warm-up message on LinkedIn"),
    ).toBeInTheDocument();
    expect(within(linkedin).getByText("ICP match")).toBeInTheDocument();
    expect(within(linkedin).getByText("LinkedIn activity")).toBeInTheDocument();
    // One direction chip per reasoning row, both raising on this fixture.
    expect(within(linkedin).getAllByText("Raises")).toHaveLength(2);
  });

  it("marks the server's recommended channel and only that one", () => {
    render(<ChannelRecommendationPanel channels={CHANNELS} recommendedChannel="EMAIL" />);

    const badges = screen.getAllByText(GTM_UI_LABELS.recommendedChannel);
    expect(badges).toHaveLength(1);
    // Equality against the payload, not a client-side argmax: LinkedIn scores 78 to
    // Email's 51 and is still not marked, because the server said Email.
    expect(badges[0].closest("li")).toContainElement(screen.getByText("Email"));
  });

  it("promotes no card when the server sent no recommended channel", () => {
    render(<ChannelRecommendationPanel channels={CHANNELS} recommendedChannel={null} />);
    expect(screen.queryByText(GTM_UI_LABELS.recommendedChannel)).not.toBeInTheDocument();
    expect(screen.getByText(GTM_UI_LABELS.noRecommendedChannel)).toBeInTheDocument();
  });

  it("renders what could not be observed, with the note that it was dropped rather than zeroed", () => {
    render(<ChannelRecommendationPanel channels={CHANNELS} recommendedChannel="LINKEDIN" />);

    const email = screen.getByText("Email").closest("li")!;
    // The section heading and the direction chip both read "Not observed" — the
    // heading names the list, the chip marks the row that was dropped.
    expect(within(email).getByText(GTM_UI_LABELS.unavailableHeading, { selector: "p" })).toBeInTheDocument();
    expect(within(email).getByText("Not observed", { selector: "span" })).toBeInTheDocument();
    expect(within(email).getByText("No phone number on the lead")).toBeInTheDocument();
    expect(within(email).getByText(GTM_UI_LABELS.unavailableNote)).toBeInTheDocument();
    // The dropped factor is also named in its own list, not only in the reasoning.
    expect(within(email).getByText("Phone number", { selector: "li" })).toBeInTheDocument();
  });

  it("renders an uncomputed score as Unknown rather than zero", () => {
    render(<ChannelRecommendationPanel channels={CHANNELS} recommendedChannel="LINKEDIN" />);
    const phone = screen.getByText("Phone").closest("li")!;
    expect(within(phone).getByText("Unknown")).toBeInTheDocument();
    expect(within(phone).getByText("Hold — too little observed to recommend a channel")).toBeInTheDocument();
  });

  it("says so when nothing has been evaluated", () => {
    render(<ChannelRecommendationPanel channels={[]} recommendedChannel={null} />);
    expect(screen.getByText(GTM_UI_LABELS.noEvaluation)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("routes the re-evaluate control to its handler", async () => {
    const onReevaluate = vi.fn();
    const user = userEvent.setup();
    render(
      <ChannelRecommendationPanel
        channels={CHANNELS}
        recommendedChannel="LINKEDIN"
        onReevaluate={onReevaluate}
      />,
    );
    await user.click(screen.getByRole("button", { name: GTM_UI_LABELS.reevaluate }));
    expect(onReevaluate).toHaveBeenCalledTimes(1);
  });
});

// ─── StateDimensionGrid (R18.4, R6.3) ─────────────────────────────────────────

describe("StateDimensionGrid", () => {
  it("marks the combined summary derived and display-only", () => {
    render(<StateDimensionGrid state={STATE} />);

    expect(screen.getByText(STATE.displaySummary)).toBeInTheDocument();
    expect(screen.getByText(GTM_UI_LABELS.displayOnlyNote)).toBeInTheDocument();

    // The `derived` badge belongs to the summary itself, not to the panel: scoped to
    // the summary's own label so a badge on some dimension below cannot satisfy this.
    const summaryLabelRow = screen.getByText(FIELD_LABEL.display_summary).parentElement!;
    expect(within(summaryLabelRow).getByText("derived")).toBeInTheDocument();
  });

  it("renders the four dimensions and conversation_stage as independently visible values", () => {
    const { container } = render(<StateDimensionGrid state={STATE} />);

    // Each dimension is its own label/value pair, not a merged status.
    const labels = ["Relationship", "Conversation", "Stage", "Last requested action", "Activity level"];
    labels.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Waiting for reply")).toBeInTheDocument();
    expect(screen.getByText("Warm-up")).toBeInTheDocument();
    expect(screen.getByText("Verification pending")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();

    // Five facts, so five `<dt>`s for the dimensions plus one for the confirmation row.
    expect(container.querySelectorAll("dt")).toHaveLength(labels.length + 1);
  });

  it("keeps each dimension's own provenance beside it", () => {
    const { container } = render(<StateDimensionGrid state={STATE} />);
    const text = container.textContent ?? "";
    expect(text).toContain("LinkedIn profile");
    expect(text).toContain("LinkedIn thread");
    expect(text).toContain("Your click in Weez");
  });

  it("renders the confirmation status as its own visible value", () => {
    render(<StateDimensionGrid state={STATE} />);
    expect(screen.getByText("Confirmation")).toBeInTheDocument();
    expect(screen.getByText("Waiting for confirmation")).toBeInTheDocument();
  });

  it("takes chip contrast from the shared TONE table, and gives an unknown fact the neutral tone", () => {
    const { unmount } = render(<StateDimensionGrid state={STATE} />);
    expect(screen.getByText("Relationship").closest("div")?.className).toContain(TONE.emerald);
    unmount();

    // A payload carrying a stale value alongside `isUnknown` must not borrow that
    // value's tone: the fact has not been observed.
    render(
      <StateDimensionGrid
        state={{ ...STATE, relationshipState: { ...UNKNOWN_FACT, value: "CONNECTED" } }}
      />,
    );
    const chip = screen.getByText("Relationship").closest("div");
    expect(chip?.className).toContain(TONE.zinc);
    expect(chip?.className).not.toContain(TONE.emerald);
  });

  it("reads Unknown for every unobserved dimension, with no substitute value", () => {
    const { container } = render(<StateDimensionGrid state={UNKNOWN_STATE} />);
    const text = container.textContent ?? "";

    expect(screen.getAllByText("Unknown")).toHaveLength(5);
    expect(screen.getByText(GTM_UI_LABELS.noSummary)).toBeInTheDocument();

    // None of the forbidden stand-ins for a fact nobody has observed.
    expect(text).not.toMatch(/\b0\b/);
    expect(text).not.toContain("false");
    expect(text).not.toContain("—");
    expect(text).not.toContain("Not connected");
    expect(text).not.toContain("Not started");
    expect(text).not.toContain("Inactive");
  });
});

// ─── CTAReadinessPanel (R9.5, R9.6) ───────────────────────────────────────────

describe("CTAReadinessPanel", () => {
  it("renders the readiness score with its disclaimer, the state, and the suggested ask", () => {
    const { container } = render(<CTAReadinessPanel cta={CTA_PAYLOAD} />);

    expect(screen.getByText("Readiness score")).toBeInTheDocument();
    expect(screen.getByText("58")).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText("derived")).toBeInTheDocument();

    expect(screen.getByText("Soft CTA ready")).toBeInTheDocument();
    expect(screen.getByText("Test interest gently")).toBeInTheDocument();
    expect(container.textContent).toContain(GTM_UI_LABELS.recommendedCta);
  });

  it("renders the persisted factors that produced the state", () => {
    render(<CTAReadinessPanel cta={CTA_PAYLOAD} />);

    expect(screen.getByText(GTM_UI_LABELS.reasoningHeading)).toBeInTheDocument();
    expect(screen.getByText("Reply so far")).toBeInTheDocument();
    expect(screen.getByText("CURIOUS")).toBeInTheDocument();
    expect(screen.getByText("Exchange depth")).toBeInTheDocument();
    expect(screen.getByText("3 exchanges")).toBeInTheDocument();
  });

  it("says whether a score band or an evidence gate produced the state", () => {
    const { container, unmount } = render(<CTAReadinessPanel cta={CTA_PAYLOAD} />);
    expect(container.textContent).toContain("Readiness score band");
    unmount();

    render(
      <CTAReadinessPanel
        cta={{
          ...CTA_PAYLOAD,
          ctaState: "MEETING_BOOKED",
          decidedBy: "CONVERSATION_STATE_MEETING_BOOKED",
          recommendedCta: "NONE",
        }}
      />,
    );
    expect(screen.getByText(/Observed booking/)).toBeInTheDocument();
    expect(screen.getByText("Meeting booked")).toBeInTheDocument();
  });

  it("takes the state chip tone from the shared TONE table", () => {
    render(<CTAReadinessPanel cta={CTA_PAYLOAD} />);
    const chip = screen.getByText("Soft CTA ready").closest("span");
    expect(chip?.className).toContain(TONE.sky);
  });

  it("reads Unknown rather than zero when nothing has been scored", () => {
    const { container } = render(
      <CTAReadinessPanel
        cta={{
          score: score(null),
          ctaState: "NOT_READY",
          recommendedCta: null,
          decidedBy: null,
          reasoning: [],
          computedAt: null,
        }}
      />,
    );
    const text = container.textContent ?? "";

    expect(screen.getAllByText("Unknown")).toHaveLength(2);
    expect(screen.getByText(GTM_UI_LABELS.noReasoning)).toBeInTheDocument();
    expect(text).not.toMatch(/\b0\b/);
    expect(text).not.toContain("—");
  });
});

// ─── The state engine's panels: text alternatives (R27.8, R28.3) ──────────────
//
// Every panel below tones a chip by value, and every one of those tones is
// decoration. What each test asserts is the *words* that carry the same meaning the
// colour carries — and, where a zero is ambiguous, the sentence that says which kind
// of zero it is. Each string is read from the panel's own exported label object, so a
// relabelling moves the assertion with it instead of silently passing.

describe("text alternatives on the state engine's panels", () => {
  it("says in words which kind of zero an unsupported intent is", () => {
    render(<IntentPanel intents={INTENTS} />);

    // Eleven types, held separately, every one present — including the nine nobody
    // has looked at (R5.5).
    const rows = within(screen.getByRole("list", { name: INTENT_PANEL_LABELS.list }));
    expect(rows.getAllByRole("listitem")).toHaveLength(INTENT_TYPES.length);

    // The supported one, with its value and its supporting-signal count as text.
    expect(screen.getByText(GTM_INTENT_LABELS.BUYING)).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();

    // The two halves R5.5 keeps apart. `HIRING` was evaluated and found unsupported;
    // the other nine have never been looked at, and the panel says so in words rather
    // than leaving two identical zeros to be told apart by their tone.
    expect(screen.getByText(INTENT_PANEL_LABELS.noSupport)).toBeInTheDocument();
    expect(screen.getAllByText(INTENT_PANEL_LABELS.neverEvaluated).length).toBeGreaterThan(1);

    // Each confidence chip names itself for assistive technology, so the bare number
    // beside a value is never an unlabelled integer.
    expect(screen.getAllByText(`${GTM_UI_LABELS.confidence}:`).length).toBeGreaterThan(0);
  });

  it("says in words that an unreachable channel was not scored, rather than scored zero", () => {
    const { container } = render(<ChannelIntelligencePanel channels={CHANNEL_STATES} />);

    // Three columns, each its own labelled group — the markup that makes "never
    // averaged across channels" readable as well as true (R6.5).
    expect(screen.getAllByRole("group")).toHaveLength(3);
    expect(container.textContent).toContain(CHANNEL_PANEL_LABELS.note);

    // R6.6 — the phone row has no identifier, so its suitability slot reads as an
    // absence and the reason sits beside it as a sentence.
    const phone = container.querySelector('[data-channel="PHONE"]') as HTMLElement;
    expect(within(phone).getByText(CHANNEL_PANEL_LABELS.notScored)).toBeInTheDocument();
    expect(within(phone).getByText(CHANNEL_PANEL_LABELS.unavailableNote)).toBeInTheDocument();

    // And the reachable rows carry no such note: the sentence is a statement about
    // this channel, not panel chrome.
    const linkedin = container.querySelector('[data-channel="LINKEDIN"]') as HTMLElement;
    expect(
      within(linkedin).queryByText(CHANNEL_PANEL_LABELS.unavailableNote),
    ).not.toBeInTheDocument();
  });

  it("says in words that an unplaced buying stage is a gap and not `UNAWARE`", () => {
    const { unmount } = render(<BuyingStagePanel buyingStage={BUYING_STAGE} />);
    expect(screen.getByText("Evaluating")).toBeInTheDocument();
    expect(screen.getByText("sig-1")).toBeInTheDocument();
    expect(
      screen.queryByText(BUYING_STAGE_PANEL_LABELS.unknownNote),
    ).not.toBeInTheDocument();
    unmount();

    render(<BuyingStagePanel buyingStage={UNPLACED_BUYING_STAGE} />);
    // "Unknown" and "Unaware" are one keystroke apart on this screen and only one of
    // them is supported by evidence, so the distinction is spelled out.
    expect(screen.getByText(UNKNOWN_TEXT)).toBeInTheDocument();
    expect(screen.getByText(BUYING_STAGE_PANEL_LABELS.unknownNote)).toBeInTheDocument();
    expect(screen.getByText(BUYING_STAGE_PANEL_LABELS.noSupportingSignals)).toBeInTheDocument();
    expect(screen.queryByText("Unaware of the problem")).not.toBeInTheDocument();
  });

  it("says in words why the engagement windows read Unknown and why Flat is a default", () => {
    const { unmount } = render(
      <EngagementTrendPanel engagement={ENGAGEMENT} dimensionConfidence={DIMENSION_CONFIDENCE} />,
    );
    expect(screen.getByText("Rising")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(
      screen.queryByText(ENGAGEMENT_TREND_PANEL_LABELS.neverEvaluatedNote),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <EngagementTrendPanel
        engagement={UNCOUNTED_ENGAGEMENT}
        dimensionConfidence={DIMENSION_CONFIDENCE}
      />,
    );
    // Both sentences are about us rather than about the prospect, which is the whole
    // distinction `evaluatedAt` exists to make.
    expect(screen.getByText(ENGAGEMENT_TREND_PANEL_LABELS.neverEvaluatedNote)).toBeInTheDocument();
    expect(screen.getByText(ENGAGEMENT_TREND_PANEL_LABELS.flatIsDefaultNote)).toBeInTheDocument();
    expect(screen.getByText(ENGAGEMENT_TREND_PANEL_LABELS.neverEvaluated)).toBeInTheDocument();
  });

  it("says in words that an unresolved timezone is not the same as outside working hours", () => {
    const { container, unmount } = render(
      <TimingPanel timing={TIMING} dimensionConfidence={DIMENSION_CONFIDENCE} />,
    );
    expect(screen.getByText("Within their working hours")).toBeInTheDocument();
    expect(screen.getByText("Spiking")).toBeInTheDocument();
    // The window carries the sentence that keeps it from reading as a commitment.
    expect(container.textContent).toContain(TIMING_PANEL_LABELS.windowNote);
    expect(
      screen.queryByText(TIMING_PANEL_LABELS.businessHoursUnknownNote),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <TimingPanel
        timing={TIMING_WITHOUT_TIMEZONE}
        dimensionConfidence={DIMENSION_CONFIDENCE}
      />,
    );
    expect(screen.getByText(TIMING_PANEL_LABELS.businessHoursUnknownNote)).toBeInTheDocument();
    expect(screen.queryByText("Outside their working hours")).not.toBeInTheDocument();
  });

  it("marks the journey projection computed in text, and reads Unknown when it is", () => {
    const { unmount } = render(<JourneyStateBadge journeyState={STATE_FULL.journeyState} />);
    // The marker is visible text, not a colour and not a tooltip: the badge has to
    // read as a computed summary in a greyscale screenshot (R9.6).
    expect(screen.getByText(GTM_UI_LABELS.computed)).toBeInTheDocument();
    expect(screen.getByText("Conversation active")).toBeInTheDocument();
    expect(screen.getByText(GTM_UI_LABELS.displayOnlyNote)).toBeInTheDocument();
    unmount();

    render(<JourneyStateBadge journeyState={UNKNOWN_FACT} />);
    expect(screen.getByText(UNKNOWN_TEXT)).toBeInTheDocument();
    expect(screen.getByText(GTM_UI_LABELS.computed)).toBeInTheDocument();
  });

  it("adds the engine's dimensions and the projection beside the four, never in place of them", () => {
    const { container } = render(<StateDimensionGrid state={STATE} stateFull={STATE_FULL} />);

    // The panel's oldest guarantee, unmoved: four dimensions plus
    // `conversation_stage`, each its own label/value pair (R6.3, R18.4).
    ["Relationship", "Conversation", "Stage", "Last requested action", "Activity level"].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument(),
    );
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Waiting for reply")).toBeInTheDocument();

    // The projection as one added badge, not a replacement (R9.6).
    expect(screen.getByText(GTM_UI_LABELS.computed)).toBeInTheDocument();
    expect(screen.getByText("Conversation active")).toBeInTheDocument();

    // The added dimensions beside the four, in the same list and through the same
    // primitive — one row per channel, so nothing is blended (R6.5).
    //
    // The values read as words, from `STATE_LABEL`, which is canonical for every
    // dimension value on this screen: `ObservedValue` looks each value up there, and
    // the dedicated panels that also render these dimensions take their strings from
    // the same table as projections rather than carrying their own. So the text
    // alternative is present, colour carries none of the meaning, and one fact reads
    // one way wherever it appears — asserted directly in the test below.
    expect(screen.getByText(STATE_LABEL.EVALUATING)).toBeInTheDocument();
    expect(screen.getByText(STATE_LABEL.RISING)).toBeInTheDocument();
    expect(screen.getByText(STATE_LABEL.SPIKE)).toBeInTheDocument();
    //
    // The headings come from `CHANNEL_AVAILABILITY_LABEL` rather than from three
    // literals, so the test tracks the table a relabelling would move.
    [
      CHANNEL_AVAILABILITY_LABEL.LINKEDIN,
      CHANNEL_AVAILABILITY_LABEL.EMAIL,
      CHANNEL_AVAILABILITY_LABEL.PHONE,
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());

    // And a channel row names the dimension it reports, never the channel itself:
    // `ChannelIntelligencePanel` heads a column "LinkedIn" on the same prospect page,
    // and one string standing for two different facts on one screen is exactly the
    // collision these headings exist to avoid.
    const channelHeadings = Array.from(container.querySelectorAll("dt")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(channelHeadings).not.toContain(CHANNEL_LABEL.LINKEDIN);

    // Two reachable channels and one with no identifier: three separate readings, and
    // the unreachable one is not silently absent from the grid. `UNAVAILABLE` names the
    // absence rather than reading as a verdict on the channel (R6.6).
    expect(screen.getAllByText(STATE_LABEL.AVAILABLE)).toHaveLength(2);
    expect(screen.getByText(STATE_LABEL.UNAVAILABLE)).toBeInTheDocument();

    // Five original rows plus the confirmation row, plus three added dimensions and
    // three channel rows: every one still a real `<dt>`/`<dd>` pair.
    expect(container.querySelectorAll("dt")).toHaveLength(12);
  });

  /**
   * The defect this pins: an unknown observation's timestamp, reattached to a derived
   * value.
   *
   * `provenance.availability` can arrive present *and* unknown — the engine looked,
   * saw nothing, and the fact still carries the instant it looked. The row then falls
   * back to the derived availability blend, and it used to carry that instant along
   * with it: a provenance line reading "Unknown · 9h ago" under a value nobody
   * observed then, or at all. A fabricated observation time is worse than a missing
   * one, so a derived row now carries no provenance at all and `ObservedValue`
   * suppresses the line.
   *
   * The branch no other test in this file reaches: `CHANNEL_STATES` gives LinkedIn a
   * known observed fact and the other two an empty `provenance`, so the fallback is
   * only ever entered with nothing to borrow.
   */
  it("carries no observation time on a derived availability row, even when the unknown fact had one", () => {
    const probedAt = new Date(Date.now() - 9 * 3600_000).toISOString();
    const probedNothing: ProspectStateFull = {
      ...STATE_FULL,
      channels: [
        channelState("LINKEDIN", {
          // A real derived value on the dimension itself...
          availability: "AVAILABLE",
          // ...and an observation that found nothing, timestamped all the same.
          provenance: {
            availability: observed("AVAILABLE", {
              value: null,
              isUnknown: true,
              observedAt: probedAt,
            }),
          },
        }),
      ],
    };

    const { container } = render(<StateDimensionGrid state={STATE} stateFull={probedNothing} />);
    const row = screen.getByText(CHANNEL_AVAILABILITY_LABEL.LINKEDIN).closest("div")!;

    // The derived blend still reaches the screen, in words and wearing its badge.
    expect(within(row).getByText(STATE_LABEL.AVAILABLE)).toBeInTheDocument();
    expect(within(row).getByText("derived")).toBeInTheDocument();

    // And nothing under it claims an observation: no provenance line, no `<time>`, and
    // the probe's instant nowhere on the panel.
    expect(row.textContent).not.toContain("Observed on");
    expect(row.querySelector("time")).toBeNull();
    expect(container.querySelector(`time[datetime="${probedAt}"]`)).toBeNull();
  });

  /**
   * The regression that made this fix necessary: one value, two strings, one screen.
   *
   * `StateDimensionGrid` renders `buying_stage`, `engagement_trend`,
   * `activity_trend_flag` and channel availability through `ObservedValue`'s
   * `STATE_LABEL` lookup, and four dedicated panels render the same dimensions. While
   * those panels carried their own label tables, the grid printed `EVALUATING` beside a
   * panel printing "Evaluating" — the same fact, read two ways, in one screenshot.
   *
   * So the two renderings are compared to each other rather than each to its own
   * literal. A panel that reintroduced a local table would still satisfy "the panel says
   * Evaluating"; it could not satisfy this.
   *
   * `within_business_hours` is absent from the list because the grid does not carry that
   * row — there is no second rendering of it to disagree with.
   */
  it("prints an added dimension the same way in the grid as in its dedicated panel", () => {
    const grid = render(<StateDimensionGrid state={STATE} stateFull={STATE_FULL} />);
    const gridText = grid.container.textContent ?? "";
    grid.unmount();

    const shared: readonly [string, string, () => ReturnType<typeof render>][] = [
      ["EVALUATING", STATE_LABEL.EVALUATING, () => render(<BuyingStagePanel buyingStage={BUYING_STAGE} />)],
      ["RISING", STATE_LABEL.RISING, () => render(<EngagementTrendPanel engagement={ENGAGEMENT} />)],
      ["SPIKE", STATE_LABEL.SPIKE, () => render(<TimingPanel timing={TIMING} />)],
      [
        "AVAILABLE",
        STATE_LABEL.AVAILABLE,
        () => render(<ChannelIntelligencePanel channels={CHANNEL_STATES} />),
      ],
      [
        "UNAVAILABLE",
        STATE_LABEL.UNAVAILABLE,
        () => render(<ChannelIntelligencePanel channels={CHANNEL_STATES} />),
      ],
    ];

    shared.forEach(([token, label, renderPanel]) => {
      // The grid says it in words, and does not say it as the enum.
      expect(gridText, `grid renders ${token}`).toContain(label);
      expect(gridText, `grid leaks the raw token ${token}`).not.toContain(token);

      // And the dedicated panel says the same string — not a synonym of it.
      const panel = renderPanel();
      expect(within(panel.container).getAllByText(label).length, token).toBeGreaterThan(0);
      panel.unmount();
    });
  });

  /**
   * The other half of the same regression: the row *headings*.
   *
   * The values above were canonicalised on `STATE_LABEL`; the headings are looked up
   * separately, through `labelFor()`, which falls through to the raw key when both
   * `FIELD_LABEL` and `DIMENSION_LABEL` miss. So the three dimensions the engine adds
   * printed `buying_stage`, `engagement_trend` and `activity_trend_flag` as their
   * headings while their values read in words — half a row in English and half in
   * enum.
   *
   * Read off the rendered `<dt>` nodes rather than from a list of keys, so a row added
   * to the grid later is covered by this without an edit, and asserted as a shape
   * (`a_b`) rather than against three literals, so a fourth unlabelled dimension fails
   * here too.
   */
  it("labels every row heading in words, never as a raw snake_case key", () => {
    const { container } = render(<StateDimensionGrid state={STATE} stateFull={STATE_FULL} />);

    const headings = Array.from(container.querySelectorAll("dt")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    // The same twelve rows the test above counts.
    expect(headings).toHaveLength(12);

    headings.forEach((heading) => {
      expect(heading, "a row with no heading at all").not.toBe("");
      expect(heading, `row heading leaks the raw key ${heading}`).not.toMatch(
        /^[a-z0-9]+(?:_[a-z0-9]+)+$/,
      );
    });

    // And each added dimension's heading is the string its own panel uses, so the row
    // and the panel that expands it cannot name the same dimension two ways.
    expect(headings).toContain(BUYING_STAGE_PANEL_LABELS.title);
    expect(headings).toContain(ENGAGEMENT_TREND_PANEL_LABELS.title);
    expect(headings).toContain(TIMING_PANEL_LABELS.fields.activityTrendFlag);
    expect(FIELD_LABEL.buying_stage).toBe(BUYING_STAGE_PANEL_LABELS.title);
    expect(FIELD_LABEL.engagement_trend).toBe(ENGAGEMENT_TREND_PANEL_LABELS.title);
    expect(FIELD_LABEL.activity_trend_flag).toBe(TIMING_PANEL_LABELS.fields.activityTrendFlag);
  });

  it("reads a CLICKED or STARTED timeline entry as requested and opened, never as performed", () => {
    const { container, unmount } = render(
      <ul>
        <ProspectTimelineEntry entry={lifecycleEntry("CLICKED")} />
      </ul>,
    );
    // R27.3 — the words are the shared lifecycle labels and they stop at what
    // happened. Nothing on the row says the action was carried out.
    expect(screen.getByText(GTM_LIFECYCLE_LABELS.CLICKED)).toBe(
      screen.getByText("Action requested"),
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).not.toMatch(/\bsent\b/i);
    unmount();

    render(
      <ul>
        <ProspectTimelineEntry entry={lifecycleEntry("STARTED")} />
      </ul>,
    );
    expect(screen.getByText(GTM_LIFECYCLE_LABELS.STARTED)).toBe(
      screen.getByText("Channel opened"),
    );
    expect(screen.getByText("Channel opened").className).toContain(TONE.zinc);
  });

  it("marks an alternative that was never scored as never scored, not as a low number", () => {
    const { container } = render(<ActionExplanation explanation={EXPLANATION} />);

    // The four sections R27.1 names, each present by its own heading.
    [
      ACTION_EXPLANATION_LABELS.whyNow,
      ACTION_EXPLANATION_LABELS.whyThisChannel,
      ACTION_EXPLANATION_LABELS.whyThisMessage,
      ACTION_EXPLANATION_LABELS.whyNotTheOtherChannels,
    ].forEach((heading) => expect(screen.getByText(heading)).toBeInTheDocument());

    // The phone alternative was excluded before scoring, so it says so in words and
    // the sentence beside it explains that there is no number to compare (R13.3).
    expect(screen.getByText(ACTION_EXPLANATION_LABELS.notScored)).toBeInTheDocument();
    expect(screen.getByText(ACTION_EXPLANATION_LABELS.notScoredNote)).toBeInTheDocument();
    // The email alternative was scored and lower, and reads as a comparison.
    expect(screen.getByText(ACTION_EXPLANATION_LABELS.scoredLower)).toBeInTheDocument();
    expect(container.textContent).toContain(ACTION_EXPLANATION_LABELS.note);
  });

  it("names a retained broader statistic in words rather than leaving it as a tone", () => {
    render(<LearningInsightsPanel updates={LEARNING_UPDATES} scope={EXPLANATION.scope} />);

    const list = screen.getByRole("list", { name: LEARNING_PANEL_LABELS.list });
    // R22.3 — the decision is named, and the sentence says both halves: the sample was
    // thin, and the broader statistic was kept. Neither is inferable from a chip tone,
    // and the chip names itself for a screen reader.
    expect(screen.getByText("Too thin — broader statistic kept")).toBeInTheDocument();
    expect(within(list).getAllByText(`${LEARNING_PANEL_LABELS.decision}:`)).toHaveLength(2);
    expect(screen.getByText(LEARNING_PANEL_LABELS.insufficientNote)).toBeInTheDocument();
    // The narrow cohort was declined in favour of a wider one, which is a different
    // fact from having no narrow cohort — so both scopes render and the pair is
    // explained.
    expect(screen.getByText(LEARNING_PANEL_LABELS.appliedScopeNote)).toBeInTheDocument();

    // Every rate carries its sample size and its interval, in the one node that makes
    // rendering the rate without them impossible.
    within(list)
      .getAllByRole("listitem")
      .forEach((row) => {
        expect(row.textContent).toContain(LEARNING_PANEL_LABELS.sampleSize);
        expect(row.textContent).toContain(LEARNING_PANEL_LABELS.interval);
      });
  });

  it("marks an at-floor signal in text, and says what being at floor costs", async () => {
    const { container } = render(<SignalList brandId="brand-1" leadId="lead-1" />);

    const list = await screen.findByRole("list", { name: SIGNAL_LIST_LABELS.list });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);

    // N5's rendering: the expired signal is retained *and* shown, and the marker plus
    // the note say that retained is not the same as still counting.
    const expired = container.querySelector('[data-at-floor="true"]') as HTMLElement;
    expect(within(expired).getByText(SIGNAL_LIST_LABELS.atFloor)).toBeInTheDocument();
    expect(screen.getByText(SIGNAL_LIST_LABELS.atFloorNote)).toBeInTheDocument();

    // And the live signal carries no marker: it is a claim about that row.
    const live = container.querySelector('[data-at-floor="false"]') as HTMLElement;
    expect(within(live).queryByText(SIGNAL_LIST_LABELS.atFloor)).not.toBeInTheDocument();
  });

  it("states in words which belief an as-of probe is showing", async () => {
    render(<StateHistoryPanel brandId="brand-1" leadId="lead-1" />);
    await screen.findByRole("list", { name: STATE_HISTORY_LABELS.list });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(STATE_HISTORY_LABELS.asOfLabel), "2024-03-04T09:30");
    await user.click(screen.getByRole("button", { name: STATE_HISTORY_LABELS.asOfApply }));

    // A narrowed history must not read like the whole history, and it is announced
    // politely because the operator asked for it (R11.4). Found among the panel's live
    // regions by its text rather than by position: the pager owns one too.
    const applied = await waitFor(() => {
      const region = screen
        .getAllByRole("status")
        .find((node) => node.textContent?.includes(STATE_HISTORY_LABELS.asOfApplied.trim()));
      expect(region).toBeDefined();
      return region as HTMLElement;
    });
    expect(applied).toHaveAttribute("aria-live", "polite");

    // The escape hatch appears only once a probe is applied.
    expect(
      screen.getByRole("button", { name: STATE_HISTORY_LABELS.asOfClear }),
    ).toBeInTheDocument();
  });
});

// ─── The state engine's panels: keyboard operability (R27.8) ───────────────────

describe("keyboard operability on the state engine's panels", () => {
  it("puts every control the new panels render on the tab order, each with a focus ring", async () => {
    render(
      <div>
        <IntentPanel intents={INTENTS} />
        <BuyingStagePanel buyingStage={BUYING_STAGE} />
        <ChannelIntelligencePanel channels={CHANNEL_STATES} />
        <EngagementTrendPanel engagement={ENGAGEMENT} dimensionConfidence={DIMENSION_CONFIDENCE} />
        <TimingPanel timing={TIMING} dimensionConfidence={DIMENSION_CONFIDENCE} />
        <JourneyStateBadge journeyState={STATE_FULL.journeyState} />
        <ActionExplanation explanation={EXPLANATION} />
        <LearningInsightsPanel updates={LEARNING_UPDATES} scope={EXPLANATION.scope} />
        <SignalList brandId="brand-1" leadId="lead-1" />
        <StateHistoryPanel brandId="brand-1" leadId="lead-1" />
      </div>,
    );
    // Both collections landed, so both pagers are mounted and in scope.
    await screen.findByRole("button", { name: SIGNAL_LIST_LABELS.loadEarlier });
    await screen.findByRole("button", { name: STATE_HISTORY_LABELS.loadEarlier });

    const stops = await tabOrder();

    // Non-vacuous: the `as_of` field and the two pagers. Three and not four, because
    // the apply control is disabled until the picker holds a value — a disabled control
    // is correctly off the tab order, and it is excluded from the rendered set below
    // for the same reason.
    expect(stops.length).toBeGreaterThanOrEqual(3);

    // Every control that is on screen is also on the tab order. This is the
    // regression a `div` with an `onClick` would introduce, and it fails here.
    const rendered = CONTROL_ROLES.flatMap((role) => screen.queryAllByRole(role)).filter(
      (node) => !node.hasAttribute("disabled"),
    );
    const reached = new Set(stops);
    expect(rendered.filter((node) => !reached.has(node))).toEqual([]);

    // And every stop carries the design system's focus treatment.
    stops.forEach((node) => expect(node).toHaveClass(...FOCUS_VISIBLE_CLASSES));
  });

  it("drives the signal pager from the keyboard alone", async () => {
    render(<SignalList brandId="brand-1" leadId="lead-1" />);
    const pager = await screen.findByRole("button", { name: SIGNAL_LIST_LABELS.loadEarlier });
    expect(pager).toHaveClass(...FOCUS_VISIBLE_CLASSES);

    // Reachable is not the same as operable, so the page is turned with keys only.
    serveCollections([signal({ signalId: "sig-3", signalType: "COMPANY_NEWS" })]);
    const user = userEvent.setup();
    pager.focus();
    await user.keyboard("{Enter}");

    const list = await screen.findByRole("list", { name: SIGNAL_LIST_LABELS.list });
    await within(list).findByText("COMPANY_NEWS");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("drives the as-of picker from the keyboard alone", async () => {
    render(<StateHistoryPanel brandId="brand-1" leadId="lead-1" />);
    await screen.findByRole("list", { name: STATE_HISTORY_LABELS.list });

    const user = userEvent.setup();
    const field = screen.getByLabelText(STATE_HISTORY_LABELS.asOfLabel);
    // A native `datetime-local` and real buttons, so the whole group needs no custom
    // key handling — the ring and the operability both come with the primitives.
    expect(field).toHaveClass(...FOCUS_VISIBLE_CLASSES);

    field.focus();
    await user.keyboard("2024-03-04T09:30");
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: STATE_HISTORY_LABELS.asOfApply }),
    );
    await user.keyboard("{Enter}");

    // Operated end to end without a pointer: the probe is applied and announced.
    const applied = await waitFor(() => {
      const region = screen
        .getAllByRole("status")
        .find((node) => node.textContent?.includes(STATE_HISTORY_LABELS.asOfApplied.trim()));
      expect(region).toBeDefined();
      return region as HTMLElement;
    });
    expect(applied).toHaveAttribute("aria-live", "polite");
  });
});

// ─── Cross-panel invariants ───────────────────────────────────────────────────

describe("no bare integers", () => {
  it("prints every derived number with its kind label and disclaimer", () => {
    const { container } = render(
      <div>
        <ProspectHeader profile={PROFILE} />
        <ActivityPanel activity={ACTIVITY} />
        <ChannelRecommendationPanel channels={CHANNELS} recommendedChannel="LINKEDIN" />
        <CTAReadinessPanel cta={CTA_PAYLOAD} />
      </div>,
    );

    // Every rendered number is a score, and every score has a disclaimer beside it:
    // five scores were supplied with values (82, 64, 78, 51, 58), and `PHONE` has
    // none, so six disclaimers appear in total.
    expect(screen.getAllByText(DISCLAIMER)).toHaveLength(6);

    // Each number is associated with its disclaimer for assistive technology.
    ["82", "64", "78", "51", "58"].forEach((value) => {
      const describedBy = screen.getByText(value).getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent(DISCLAIMER);
    });

    expect(container.querySelectorAll("h2")).toHaveLength(3);
  });
});

describe("accessibility", () => {
  // An explicit budget, not vitest's 5s default. This case mounts every panel at once and
  // runs axe over the whole tree, which genuinely takes seconds — and the default is a
  // default rather than a considered budget for it, so under a loaded machine it was
  // timing out on the axe pass and reporting as a violation it had not found. The
  // assertion below is unchanged: still zero violations, over the same tree.
  it("is clean on a fully populated set of panels", async () => {
    const { container } = render(
      <div>
        <ProspectHeader profile={PROFILE} onRefresh={() => {}} updatedAt={new Date().toISOString()} />
        <ChannelRecommendationPanel
          channels={CHANNELS}
          recommendedChannel="LINKEDIN"
          weightSetLabel="default-v1"
          onReevaluate={() => {}}
        />
        <ActivityPanel activity={ACTIVITY} />
        <StateDimensionGrid state={STATE} stateFull={STATE_FULL} />
        <CTAReadinessPanel cta={CTA_PAYLOAD} />

        {/* The state engine's twelve, in the same sweep and under the same
            configuration — one axe setup for this module, not two. */}
        <IntentPanel intents={INTENTS} />
        <BuyingStagePanel buyingStage={BUYING_STAGE} />
        <ChannelIntelligencePanel channels={CHANNEL_STATES} />
        <EngagementTrendPanel engagement={ENGAGEMENT} dimensionConfidence={DIMENSION_CONFIDENCE} />
        <TimingPanel timing={TIMING} dimensionConfidence={DIMENSION_CONFIDENCE} />
        <JourneyStateBadge journeyState={STATE_FULL.journeyState} />
        <ActionExplanation explanation={EXPLANATION} />
        <LearningInsightsPanel updates={LEARNING_UPDATES} scope={EXPLANATION.scope} />
        <SignalList brandId="brand-1" leadId="lead-1" />
        <StateHistoryPanel brandId="brand-1" leadId="lead-1" />
        <ul>
          <ProspectTimelineEntry entry={lifecycleEntry("CLICKED")} />
          <ProspectTimelineEntry entry={lifecycleEntry("STARTED")} />
        </ul>
      </div>,
    );
    // Both collections have to have landed, or the sweep would cover two skeletons.
    await screen.findByRole("list", { name: SIGNAL_LIST_LABELS.list });
    await screen.findByRole("list", { name: STATE_HISTORY_LABELS.list });

    expect(await axe(container)).toHaveNoViolations();
  }, 20_000);

  it("is clean on an unknown-heavy payload", async () => {
    const { container } = render(
      <div>
        <ProspectHeader profile={UNOBSERVED_PROFILE} headingAs="h2" />
        <ChannelRecommendationPanel channels={[]} recommendedChannel={null} />
        <ActivityPanel activity={EMPTY_ACTIVITY} />
        <StateDimensionGrid state={UNKNOWN_STATE} />
        <CTAReadinessPanel
          cta={{
            score: score(null),
            ctaState: "NOT_READY",
            recommendedCta: null,
            decidedBy: null,
            reasoning: [],
            computedAt: null,
          }}
        />

        {/* The added panels' absent-value branches: no intent supported, no channel
            row at all, no stage placed, nothing counted, no timezone resolved, no
            projection, no explanation and no statistics. */}
        <IntentPanel intents={[]} />
        <BuyingStagePanel buyingStage={UNPLACED_BUYING_STAGE} />
        <ChannelIntelligencePanel channels={[]} />
        <EngagementTrendPanel engagement={UNCOUNTED_ENGAGEMENT} />
        <TimingPanel timing={TIMING_WITHOUT_TIMEZONE} />
        <JourneyStateBadge journeyState={UNKNOWN_FACT} />
        <ActionExplanation explanation={null} />
        <LearningInsightsPanel updates={[]} scope={null} />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  }, 20_000);
});

// ══════════════════════════════════════════════════════════════════════════════
// IdentityPanel — the three decisions it makes, made in isolation
// ══════════════════════════════════════════════════════════════════════════════
//
// `pages/__tests__/ProspectDossier.identity.test.tsx` drives this block through the real
// page and the real transport, which is where the claims about *behaviour* belong. What
// is tested here is the part of it that is a pure function of the verdict, because
// three of the panel's decisions are pure and each of them is a place where a null
// could quietly become a value:
//
//   • `verificationFact` — absence collapses before any label is looked up, and
//     provenance is claimed only where it exists.
//   • `trackRefusal` — one branch per 409 the route returns, `null` only where the
//     route would accept.
//   • `trackingState` — the server's own rule (the profile row is the flag), not a
//     second one invented in the browser.
//
// Asserted on the functions rather than on rendered text, so a failure points at the
// decision instead of at a fixture.

describe("IdentityPanel", () => {
  const NOW = "2025-03-04T09:30:00+00:00";

  /** A profile block carrying only what this panel reads. */
  function identityProfile(over: Partial<ProspectProfile> = {}): ProspectProfile {
    return {
      leadId: "lead-1",
      profileId: null,
      profileUrl: null,
      publicIdentifier: null,
      name: observed("Ada Lovelace"),
      headline: UNKNOWN_FACT,
      company: UNKNOWN_FACT,
      role: UNKNOWN_FACT,
      location: UNKNOWN_FACT,
      seniority: UNKNOWN_FACT,
      icpMatch: UNKNOWN_FACT,
      intentSignal: UNKNOWN_FACT,
      acvTier: UNKNOWN_FACT,
      leadScore: score(null),
      linkedinVerificationStatus: null,
      linkedinVerifiedAt: null,
      linkedinMatchConfidence: null,
      identityCandidateUrl: null,
      identityMatchEvidence: null,
      identityFailureReason: null,
      ...over,
    };
  }

  it("collapses an absent verdict into unknown before any label is looked up", () => {
    const absent = verificationFact(null, null);
    expect(absent.isUnknown).toBe(true);
    // No value at all, so there is no order of operations in which "nobody has tried"
    // acquires a verdict's wording.
    expect(absent.value).toBeNull();
    expect(absent.sourceSurface).toBeNull();
    expect(absent.observedAt).toBeNull();
    // And it is not the NO_MATCH label under another name.
    expect(absent.value).not.toBe(GTM_VERIFICATION_LABELS.NO_MATCH);
  });

  it("claims a surface and an instant only for a verdict that opened a page", () => {
    const verified = verificationFact("VERIFIED", NOW);
    expect(verified.value).toBe(GTM_VERIFICATION_LABELS.VERIFIED);
    expect(verified.sourceSurface).toBe("LINKEDIN_PROFILE_PAGE");
    expect(verified.observedAt).toBe(NOW);
    // A verdict is the resolver's judgement over a search, not a value read off a page.
    expect(verified.isDerived).toBe(true);

    // `NO_MATCH` opened no page, so claiming one would be a fabricated provenance —
    // even when a stale `verifiedAt` is passed alongside it.
    const noMatch = verificationFact("NO_MATCH", NOW);
    expect(noMatch.value).toBe(GTM_VERIFICATION_LABELS.NO_MATCH);
    expect(noMatch.sourceSurface).toBeNull();
    expect(noMatch.observedAt).toBeNull();
  });

  it("gives each refusal its own reason, and refuses nothing that the route accepts", () => {
    expect(trackRefusal(null, null)).toBe(GTM_IDENTITY_LABELS.cannotTrack.unresolved);
    expect(trackRefusal("POSSIBLE_MATCH", "https://x")).toBe(
      GTM_IDENTITY_LABELS.cannotTrack.possibleMatch,
    );
    expect(trackRefusal("NO_MATCH", null)).toBe(GTM_IDENTITY_LABELS.cannotTrack.noMatch);
    // A verdict this screen does not know is held rather than guessed at.
    expect(trackRefusal("SOMETHING_NEW", "https://x")).toBe(
      GTM_IDENTITY_LABELS.cannotTrack.unrecognised,
    );
    // Defensive: a verification with no address has no page to observe.
    expect(trackRefusal("VERIFIED", null)).toBe(GTM_IDENTITY_LABELS.cannotTrack.noAddress);
    expect(trackRefusal("VERIFIED", "")).toBe(GTM_IDENTITY_LABELS.cannotTrack.noAddress);

    // The one case the route accepts is the one case with nothing to explain.
    expect(trackRefusal("VERIFIED", "https://www.linkedin.com/in/ada")).toBeNull();

    // A provider's url beside an unresolved verdict is still a refusal: a url is not a
    // verdict, and this is the branch that proves the two are not confused.
    expect(trackRefusal(null, "https://www.linkedin.com/in/candidate")).toBe(
      GTM_IDENTITY_LABELS.cannotTrack.unresolved,
    );
  });

  it("reads tracking off row existence, and tells cannot-track apart from not-tracked", () => {
    // The server's own rule: the profile row *is* the flag.
    expect(trackingState("VERIFIED", "profile-1")).toBe("TRACKING");
    expect(trackingState(null, "profile-1")).toBe("TRACKING");
    // A verified prospect nobody has clicked Track on is a decision waiting to be made.
    expect(trackingState("VERIFIED", null)).toBe("NOT_TRACKING");
    // An unresolved one is a precondition that has not been met, which is different.
    expect(trackingState(null, null)).toBe("UNRESOLVED");
    expect(trackingState("NO_MATCH", null)).toBe("UNRESOLVED");
    expect(GTM_TRACKING_STATE_LABELS.NOT_TRACKING).not.toBe(
      GTM_TRACKING_STATE_LABELS.UNRESOLVED,
    );
  });

  it("has no PAUSED and no STOPPED to render", () => {
    // Neither is expressible: `TrackProspectOut.tracking_state` has one member, derived
    // from row existence. A label for a state nothing can reach would send an operator
    // looking for a control that does not exist.
    expect(GTM_TRACKING_STATE_LABELS.PAUSED).toBeUndefined();
    expect(GTM_TRACKING_STATE_LABELS.STOPPED).toBeUndefined();
    expect(Object.keys(GTM_TRACKING_STATE_LABELS).sort()).toEqual([
      "NOT_TRACKING",
      "TRACKING",
      "UNRESOLVED",
    ]);
  });

  it("offers the search and not the tracking control when nothing has been resolved", async () => {
    const { container } = render(
      <IdentityPanel
        profile={identityProfile()}
        onResolveIdentity={() => {}}
        onTrackProspect={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: GTM_IDENTITY_LABELS.resolve }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: GTM_IDENTITY_LABELS.track }),
    ).not.toBeInTheDocument();
    // Absence in the value slot, with the sentence that says which absence it is.
    expect(screen.getByText(UNKNOWN_TEXT)).toBeInTheDocument();
    expect(screen.getByText(GTM_VERIFICATION_LABELS.UNRESOLVED)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("offers the tracking control on a verified identity, and is clean under axe", async () => {
    const { container } = render(
      <IdentityPanel
        profile={identityProfile({
          profileId: "profile-1",
          profileUrl: "https://www.linkedin.com/in/ada",
          linkedinVerificationStatus: "VERIFIED",
          linkedinVerifiedAt: NOW,
          linkedinMatchConfidence: 93,
        })}
        onResolveIdentity={() => {}}
        onTrackProspect={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: GTM_IDENTITY_LABELS.track })).toBeInTheDocument();
    expect(screen.getByText(GTM_VERIFICATION_LABELS.VERIFIED)).toBeInTheDocument();
    expect(screen.getByText(GTM_IDENTITY_LABELS.verifiedUrl)).toBeInTheDocument();
    // The profile row already exists, so the tracking row reads tracked.
    expect(screen.getByText(GTM_TRACKING_STATE_LABELS.TRACKING)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// The three panels behind "Where this prospect stands" (R20.8, §15.3)
// ══════════════════════════════════════════════════════════════════════════════
//
// `BuyingStagePanel`, `IntentPanel` and `ChannelIntelligencePanel` are the content of one
// dossier disclosure — `PROSPECT_INTELLIGENCE_SECTIONS.standing` — and of nothing else.
// Everything above this line is a claim about what each renders when it is handed a
// payload. This is the claim none of them can make about itself: that they are built when
// the operator opens that section, and not before.
//
// `IntelligenceSection` takes its `children` as a function, so a collapsed `<details>`
// never calls it and the three panels are not in the tree at all. That distinction is what
// this block is for. `<details>` already hides content; a section that merely hid these
// would still have constructed them, and the closed state would be indistinguishable from
// the open one to anything reading the DOM — including the axe sweep further up, which
// would then be auditing panels no operator had asked for.
//
// ── The markers, and why not the titles ───────────────────────────────────────
//
// `BUYING_STAGE_PANEL_LABELS.title` is the string "Buying stage", and so is
// `FIELD_LABEL.buying_stage` — which `StateDimensionGrid` renders in the *always-open*
// grid above the inventory, on every activated dossier. So a title query would find the
// grid's row and report the panel present while the section was still shut. Each panel is
// therefore located by something only it renders: its own `note` sentence, its own list
// name, and `BuyingStagePanel`'s `data-buying-stage` attribute.
//
// ── The stage the inventory needs ─────────────────────────────────────────────
//
// The whole disclosure region renders only while `isIntelligenceActive(stage)` —
// `WAITING`, `ACTIVE` or `RECOMMENDED` — so the fixture serves a `li_gtm_profiles` row.
// An `ENRICHED` dossier has no `<details>` on it at all, which is the last case below.

describe("behind the standing disclosure on the dossier", () => {
  /** A real brand id: `evaAPI` and `CreditsProvider` both refuse anything else. */
  const BRAND = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  const EVA_LEAD = "lead_ada7f1";
  const GTM_LEAD = "9c1e2b44-77aa-4c1e-9f6b-0f3a5c8d1e20";
  const PERSON = "Ada Lovelace";
  const COMPANY = "Analytical Engines";
  const LINKEDIN = "https://www.linkedin.com/in/ada-lovelace";
  const ISO = "2024-05-01T12:00:00.000Z";

  /** The stage the served payload places the prospect in, so it can be read back. */
  const SERVED_STAGE = "EVALUATING";

  function pageLead(): QualifiedLead {
    return {
      id: EVA_LEAD,
      entityId: "ent-1",
      company: COMPANY,
      domain: "analyticalengines.com",
      website: "https://analyticalengines.com",
      industry: "B2B SaaS",
      employeeRange: "51-200",
      hqLocation: "London",
      acvTier: "medium",
      identityVerified: true,
      enrichable: true,
      icpFit: 82,
      recommendedAction: "queued_review",
      escalation: "none",
      qualificationReason: "Hiring for a data platform team.",
      primaryEvent: "Posted three data-platform roles",
      eventType: "job_posting",
      signals: [],
      contact: {
        name: PERSON,
        role: "Head of Engineering",
        email: "ada@analyticalengines.com",
        emailVerified: true,
        linkedinUrl: LINKEDIN,
      },
      enrichment: { website: "https://analyticalengines.com", status: "enriched" },
      handoffState: "enriched",
      status: "qualified",
      notes: "",
      createdAt: ISO,
      updatedAt: ISO,
      gtmLeadId: GTM_LEAD,
    };
  }

  function pageWorkspace(): EvaWorkspace {
    const leads = [pageLead()];
    return {
      signals: [],
      entities: [],
      leads,
      potentialLeads: [],
      channels: [],
      icp: {
        brand_name: "Weez",
        industry: "B2B SaaS",
        segments: ["Mid-market SaaS"],
        personas: ["RevOps"],
        value_prop: "unify GTM reporting into one decision view",
      },
      metrics: {
        channelsMonitored: 4,
        signalsCaptured: 0,
        signalsThisWeek: 0,
        orgsTracked: 1,
        potentialLeads: 0,
        qualifiedLeads: leads.length,
        enrichedLeads: leads.length,
        emailsFound: leads.length,
        handedToMax: 0,
        byTier: { low: 0, medium: 1, high: 0 },
        bySignalType: {},
      },
      // Discovery has landed, so the page arms no silent re-read behind these mounts.
      sweepState: "complete",
      isDemo: false,
    };
  }

  // ─── The wire, as `schemas/gtm.py` serialises it ────────────────────────────

  function wireFact(value: string | null) {
    return {
      value,
      is_unknown: value === null,
      source_surface: value === null ? null : "LINKEDIN_PROFILE_PAGE",
      observed_at: value === null ? null : ISO,
      is_stale: false,
      is_derived: false,
    };
  }

  /**
   * `ProspectOut`, carrying the three collections the standing section renders.
   *
   * All three arrive on the *detail* payload — `buying_stage`, `intents` and
   * `channel_states` — which is what makes the section free to open: the page holds them
   * from the selection's own read and the disclosure asks for nothing.
   */
  function wireDetail(activated: boolean) {
    return {
      lead_id: GTM_LEAD,
      profile: {
        lead_id: GTM_LEAD,
        // The activation flag. Without it there is no disclosure inventory at all.
        profile_id: activated ? "profile-1" : null,
        profile_url: activated ? LINKEDIN : null,
        public_identifier: activated ? "ada-lovelace" : null,
        linkedin_verification_status: "VERIFIED",
        linkedin_verified_at: ISO,
        linkedin_match_confidence: 93,
        name: wireFact(PERSON),
        headline: wireFact("Head of Engineering"),
        company: wireFact(COMPANY),
        role: wireFact("Head of Engineering"),
        location: wireFact("London"),
        lead_score: {
          score: 82,
          score_kind: "RECOMMENDATION_SCORE",
          score_disclaimer:
            "A prioritisation signal, not a predicted probability of conversion.",
          is_derived: true,
        },
      },
      state: {
        relationship_state: wireFact("NOT_CONNECTED"),
        conversation_state: wireFact("WARMUP_READY"),
        confirmation_status: "NOT_APPLICABLE",
        display_summary: "Not connected · warm-up ready",
        display_summary_is_derived: true,
      },
      buying_stage: { value: SERVED_STAGE, confidence: 58, signal_ids: ["sig-1"] },
      intents: [
        {
          intent_type: "BUYING",
          value: 72,
          confidence: 61,
          source: "DERIVED",
          evaluated_at: ISO,
          decay_rate: 0,
          signal_ids: ["sig-1"],
          is_derived: true,
        },
      ],
      channel_states: [
        {
          channel: "LINKEDIN",
          availability: "AVAILABLE",
          reachability: 70,
          activity: 55,
          engagement: 40,
          responsiveness: 35,
          response_rate: 20,
          historical_conversion_rate: 8,
          confidence: 60,
          suitability: 66,
          last_interaction_at: ISO,
          last_inbound_at: null,
          last_outbound_at: ISO,
          cooldown_until: null,
          consecutive_unanswered: 0,
          provenance: {},
        },
      ],
      updated_at: ISO,
    };
  }

  function wireCredits() {
    return {
      brand_id: BRAND,
      balance: 40,
      prices: [
        { action: "ENRICH", credits: 1 },
        { action: "CONTACT", credits: 1 },
        { action: "ACTIVATE", credits: 2 },
      ],
      history: [],
    };
  }

  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  /**
   * Every route the dossier can reach, replacing this module's `serveCollections()`.
   *
   * Ordered longest-first: `/prospect/{id}/state/history` contains `/state`, and the bare
   * detail read has to come last or it would answer for all of them.
   */
  function servePage(activated: boolean) {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/credits")) return ok(wireCredits());
      if (url.includes("/action-queue")) return ok({ items: [], has_more: false });
      if (url.includes("/next-best-action")) return ok({ lead_id: GTM_LEAD });
      if (url.includes("/state/history"))
        return ok({ items: [], next_cursor: null, has_more: false });
      if (url.includes("/state")) return ok({ lead_id: GTM_LEAD, state_version: 0 });
      if (url.includes("/signals")) return ok({ items: [], next_cursor: null, has_more: false });
      if (url.includes("/timeline"))
        return ok({ entries: [], next_cursor: null, has_more: false });
      if (url.includes("/debug")) return ok({ lead_id: GTM_LEAD, learning_updates: [] });
      if (url.includes(`/prospect/${GTM_LEAD}`)) return ok(wireDetail(activated));
      return ok({});
    });
  }

  // ─── Harness ────────────────────────────────────────────────────────────────

  const DOSSIER = 'section[aria-label="Prospect dossier"]';
  const STAGE_MARKER = "[data-gtm-stage]";
  /** `BuyingStagePanel`'s own attribute. `StateDimensionGrid` carries no such thing. */
  const BUYING_STAGE_BLOCK = "[data-buying-stage]";

  const stageOf = (root: ParentNode) =>
    root.querySelector(STAGE_MARKER)?.getAttribute("data-gtm-stage") ?? null;

  /** The `<summary>` of one disclosure, found by the section's own label. */
  function disclosure(root: ParentNode, summary: string): HTMLElement {
    const match = Array.from(root.querySelectorAll("summary")).find((element) =>
      Array.from(element.querySelectorAll("span")).some(
        (span) => (span.textContent ?? "").trim() === summary,
      ),
    );
    if (!match) throw new Error(`no disclosure labelled ${JSON.stringify(summary)}`);
    return match as HTMLElement;
  }

  /** Whether `a` precedes `b` in document order. */
  function isBefore(a: Node, b: Node): boolean {
    return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={[`/prospect-intelligence/${BRAND}`]}>
        <CreditsProvider brandId={BRAND}>
          <Routes>
            <Route path="/prospect-intelligence/:spaceId" element={<ProspectIntelligence />} />
          </Routes>
        </CreditsProvider>
      </MemoryRouter>,
    );
  }

  /**
   * The loaded dossier, waited on the *stage* rather than on the marker carrying it.
   *
   * Band 3 paints immediately and a prospect whose read is in flight reads as `ENRICHED`,
   * which is a real answer rather than a placeholder — so waiting for the element alone
   * would let a case read the page before its payload landed. `WAITING` is reachable only
   * once the profile row is on the payload.
   */
  async function openDossier(activated: boolean) {
    servePage(activated);
    const { container } = renderPage();
    await waitFor(() => expect(stageOf(container)).toBe(activated ? "WAITING" : "ENRICHED"));
    return {
      container,
      dossier: container.querySelector(DOSSIER) as HTMLElement,
      user: userEvent.setup(),
    };
  }

  // Overrides this module's `serveCollections()` for these cases only: nested hooks run
  // after the outer ones, so `fetchMock` is already stubbed onto `fetch` by the time this
  // re-implements it. The workspace spy is restored by `restoreMocks`.
  beforeEach(() => {
    vi.spyOn(evaAPI, "getWorkspace").mockResolvedValue(pageWorkspace());
  });

  // The instrument. A case that could not find the section would report an absence with
  // nothing to do with whether the three panels mount.
  it("puts the standing section on the dossier, collapsed", async () => {
    const { dossier } = await openDossier(true);

    const summary = disclosure(dossier, PROSPECT_INTELLIGENCE_SECTIONS.standing);
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    // It says what is behind it before anything is opened, which is what makes the
    // disclosure a question rather than a mystery.
    expect(summary.textContent).toContain(PROSPECT_INTELLIGENCE_SECTIONS.standingNote);
  });

  it("builds none of the three while the section is closed", async () => {
    const { container, dossier } = await openDossier(true);

    // Not hidden — absent. Each panel is located by something only it renders, never by a
    // title: "Buying stage" is also `FIELD_LABEL.buying_stage`, which the always-open
    // dimension grid prints on every activated dossier.
    expect(container.querySelector(BUYING_STAGE_BLOCK)).toBeNull();
    expect(within(dossier).queryByText(BUYING_STAGE_PANEL_LABELS.note)).toBeNull();
    expect(within(dossier).queryByText(INTENT_PANEL_LABELS.note)).toBeNull();
    expect(within(dossier).queryByRole("list", { name: INTENT_PANEL_LABELS.list })).toBeNull();
    expect(within(dossier).queryByText(CHANNEL_PANEL_LABELS.note)).toBeNull();

    // The grid above the inventory is unaffected: it renders `buying_stage` from the same
    // read, always open, and that is the row a title query would have found. Asserting it
    // is present is what makes the four absences above assertions about the panels rather
    // than about the dossier having loaded.
    expect(within(dossier).getByText(FIELD_LABEL.buying_stage!)).toBeInTheDocument();
  });

  it("builds all three, in order, once the section is opened", async () => {
    const { container, dossier, user } = await openDossier(true);
    const summary = disclosure(dossier, PROSPECT_INTELLIGENCE_SECTIONS.standing);
    const details = summary.closest("details") as HTMLElement;

    await user.click(summary);

    const buyingStage = await waitFor(() => {
      const found = container.querySelector(BUYING_STAGE_BLOCK);
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    const intents = within(details).getByRole("list", { name: INTENT_PANEL_LABELS.list });
    const channels = within(details).getByText(CHANNEL_PANEL_LABELS.note);

    // All three inside *that* disclosure, and not merely somewhere on the page.
    [buyingStage, intents, channels].forEach((element) =>
      expect(details).toContainElement(element),
    );

    // The order the section composes them in: their own position, what they want, then
    // which channel reaches them.
    expect(isBefore(buyingStage, intents)).toBe(true);
    expect(isBefore(intents, channels)).toBe(true);

    // And each is reading the served payload rather than a resting default. The stage is
    // the one the server placed them in, the intent list holds the eleven types it always
    // holds, and the channel panel is scoped to its own evidence.
    expect(buyingStage).toHaveAttribute("data-buying-stage", SERVED_STAGE);
    expect(within(buyingStage).getByText(STATE_LABEL[SERVED_STAGE]!)).toBeInTheDocument();
    expect(within(intents).getAllByRole("listitem")).toHaveLength(INTENT_TYPES.length);
    expect(within(details).getByText(GTM_INTENT_LABELS.BUYING!)).toBeInTheDocument();

    // One column per channel, in `CHANNEL_KEYS` order, and only the served one carries a
    // row: the two the payload said nothing about state the absence rather than showing a
    // zero, which is the same rule the panel's own cases above assert on fixtures.
    const columns = Array.from(details.querySelectorAll("[data-channel]")) as HTMLElement[];
    expect(columns.map((column) => column.getAttribute("data-channel"))).toEqual([
      "LINKEDIN",
      "EMAIL",
      "PHONE",
    ]);
    expect(within(columns[0]!).queryByText(CHANNEL_PANEL_LABELS.noState)).toBeNull();
    expect(within(columns[1]!).getByText(CHANNEL_PANEL_LABELS.noState)).toBeInTheDocument();

    // The section's own "nothing was read" line stays away: all three panels rendered, so
    // there is nothing for it to say.
    expect(within(details).queryByText(GTM_PAGE_LABELS.noIntelligenceRead)).toBeNull();
  });

  it("keeps them built after the section is closed again", async () => {
    // The section latches on first open rather than tracking `open`: closing must not
    // throw away work the operator already asked for, so re-opening is free.
    const { container, dossier, user } = await openDossier(true);
    const summary = disclosure(dossier, PROSPECT_INTELLIGENCE_SECTIONS.standing);
    const details = summary.closest("details") as HTMLDetailsElement;

    await user.click(summary);
    await waitFor(() => expect(container.querySelector(BUYING_STAGE_BLOCK)).not.toBeNull());

    await user.click(summary);

    expect(details.open).toBe(false);
    expect(container.querySelector(BUYING_STAGE_BLOCK)).not.toBeNull();
  });

  it("cannot be reached on an enriched dossier, which has no inventory at all", async () => {
    // The inventory renders only while `isIntelligenceActive(stage)`. Before activation
    // nothing has been evaluated, so there is no section to open — and a case that
    // expected one here would be measuring the fixture rather than the page.
    const { container, dossier } = await openDossier(false);

    expect(dossier.querySelectorAll("details")).toHaveLength(0);
    expect(container.querySelector(BUYING_STAGE_BLOCK)).toBeNull();
    expect(within(dossier).queryByText(PROSPECT_INTELLIGENCE_SECTIONS.standing)).toBeNull();
    expect(within(dossier).queryByText(CHANNEL_PANEL_LABELS.note)).toBeNull();
    // Still a dossier: the prospect is named, so the absences above are the composition
    // and not a failed read. `getAllByText`, because the decision the enriched dossier is
    // showing names the person in its own copy as well as in band 2's heading.
    expect(within(dossier).getAllByText(PERSON).length).toBeGreaterThan(0);
  });
});
